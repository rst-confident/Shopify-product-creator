import express from 'express';
import multer from 'multer';
import { parse } from 'csv-parse/sync';
import { readFileSync, unlinkSync } from 'fs';
import xlsx from 'xlsx';
import { requireAuth } from '../middleware/auth';
import { query } from '../db';

const router = express.Router();

// All routes require authentication
router.use(requireAuth);

// Configure multer for file upload
const upload = multer({
  dest: 'uploads/',
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ];
    const allowedExtensions = ['.csv', '.xls', '.xlsx'];

    const hasValidMime = allowedTypes.includes(file.mimetype);
    const hasValidExt = allowedExtensions.some((ext) => file.originalname.toLowerCase().endsWith(ext));

    if (hasValidMime || hasValidExt) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV and Excel files (.csv, .xls, .xlsx) are allowed'));
    }
  },
});

/**
 * Parse file based on extension
 */
function parseFile(filePath: string, originalName: string): any[] {
  const lowerName = originalName.toLowerCase();

  // Parse Excel files
  if (lowerName.endsWith('.xlsx') || lowerName.endsWith('.xls')) {
    const workbook = xlsx.readFile(filePath);
    const sheetName = workbook.SheetNames[0]; // Use first sheet
    const worksheet = workbook.Sheets[sheetName];
    const records = xlsx.utils.sheet_to_json(worksheet, { defval: '' });
    return records;
  }

  // Parse CSV files
  if (lowerName.endsWith('.csv')) {
    const fileContent = readFileSync(filePath, 'utf-8');
    const records = parse(fileContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });
    return records;
  }

  throw new Error('Unsupported file format');
}

/**
 * POST /api/upload
 * Upload CSV or Excel file
 */
router.post('/', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { supplierName, notes, storeId } = req.body;

    if (!supplierName) {
      unlinkSync(req.file.path);
      return res.status(400).json({ error: 'Supplier name is required' });
    }

    if (!storeId) {
      unlinkSync(req.file.path);
      return res.status(400).json({ error: 'Store ID is required' });
    }

    // Verify user owns this store
    const storeCheck = await query(
      'SELECT id FROM stores WHERE id = $1 AND user_id = $2',
      [storeId, req.session.userId]
    );

    if (storeCheck.rows.length === 0) {
      unlinkSync(req.file.path);
      return res.status(403).json({ error: 'You do not have access to this store' });
    }

    // Parse file
    const records = parseFile(req.file.path, req.file.originalname);

    if (records.length === 0) {
      unlinkSync(req.file.path);
      return res.status(400).json({ error: 'File is empty' });
    }

    // Store file record
    const result = await query(
      `INSERT INTO uploaded_files (store_id, filename, supplier_name, notes, row_count, status)
       VALUES ($1, $2, $3, $4, $5, 'uploaded') RETURNING id`,
      [storeId, req.file.originalname, supplierName, notes || '', records.length]
    );

    const fileId = result.rows[0].id;

    // Get column headers
    const headers = Object.keys(records[0]);

    // Get sample data (first 3 rows)
    const sampleData = records.slice(0, 3).map((row: any) => {
      const sample: any = {};
      headers.forEach((header) => {
        sample[header] = row[header];
      });
      return sample;
    });

    // Clean up uploaded file
    unlinkSync(req.file.path);

    res.json({
      success: true,
      fileId,
      filename: req.file.originalname,
      rowCount: records.length,
      headers,
      sampleData,
      records, // Full data for processing
    });
  } catch (error: any) {
    console.error('Upload error:', error);
    if (req.file) {
      unlinkSync(req.file.path);
    }
    res.status(500).json({ error: error.message || 'Failed to process file' });
  }
});

/**
 * GET /api/upload
 * Get uploaded files for a store
 */
router.get('/', async (req, res) => {
  try {
    const { storeId } = req.query;

    if (!storeId) {
      return res.status(400).json({ error: 'Store ID is required' });
    }

    // Verify user owns this store
    const storeCheck = await query(
      'SELECT id FROM stores WHERE id = $1 AND user_id = $2',
      [storeId, req.session.userId]
    );

    if (storeCheck.rows.length === 0) {
      return res.status(403).json({ error: 'You do not have access to this store' });
    }

    const result = await query(
      `SELECT id, filename, supplier_name, notes, upload_date, status, row_count
       FROM uploaded_files
       WHERE store_id = $1
       ORDER BY upload_date DESC
       LIMIT 50`,
      [storeId]
    );

    res.json({ files: result.rows });
  } catch (error) {
    console.error('Get uploaded files error:', error);
    res.status(500).json({ error: 'Failed to get uploaded files' });
  }
});

export default router;
