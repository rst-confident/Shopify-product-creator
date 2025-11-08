import express from 'express';
import multer from 'multer';
import { parse } from 'csv-parse/sync';
import { readFileSync, unlinkSync } from 'fs';
import { AuthRequest, verifyRequest } from '../middleware/auth';
import { query } from '../db';

const router = express.Router();

// Configure multer for file upload
const upload = multer({
  dest: 'uploads/',
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'));
    }
  },
});

// Upload CSV file
router.post('/', verifyRequest, upload.single('file'), async (req: AuthRequest, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { supplierName, notes } = req.body;

    if (!supplierName) {
      unlinkSync(req.file.path);
      return res.status(400).json({ error: 'Supplier name is required' });
    }

    // Parse CSV to get row count and preview
    const fileContent = readFileSync(req.file.path, 'utf-8');
    const records = parse(fileContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });

    if (records.length === 0) {
      unlinkSync(req.file.path);
      return res.status(400).json({ error: 'CSV file is empty' });
    }

    // Store file record
    const result = await query(
      `INSERT INTO uploaded_files (store_id, filename, supplier_name, notes, row_count, status)
       VALUES ($1, $2, $3, $4, $5, 'uploaded') RETURNING id`,
      [req.storeId, req.file.originalname, supplierName, notes || '', records.length]
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
  } catch (error) {
    console.error('Upload error:', error);
    if (req.file) {
      unlinkSync(req.file.path);
    }
    res.status(500).json({ error: 'Failed to process CSV file' });
  }
});

// Get uploaded files
router.get('/', verifyRequest, async (req: AuthRequest, res) => {
  try {
    const result = await query(
      `SELECT id, filename, supplier_name, notes, upload_date, status, row_count
       FROM uploaded_files
       WHERE store_id = $1
       ORDER BY upload_date DESC
       LIMIT 50`,
      [req.storeId]
    );

    res.json({ files: result.rows });
  } catch (error) {
    console.error('Get uploaded files error:', error);
    res.status(500).json({ error: 'Failed to get uploaded files' });
  }
});

export default router;
