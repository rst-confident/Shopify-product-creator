import express from 'express';
import { AuthRequest, verifyRequest } from '../middleware/auth';
import { query } from '../db';

const router = express.Router();

// Get products in queue
router.get('/', verifyRequest, async (req: AuthRequest, res) => {
  try {
    const result = await query(
      `SELECT
         pq.id,
         pq.product_title,
         pq.price,
         pq.ean,
         pq.sku,
         pq.color,
         pq.image_urls,
         pq.description,
         pq.supplier_name,
         pq.status,
         pq.parent_group_id,
         pq.created_at,
         uf.filename as source_file
       FROM products_queue pq
       LEFT JOIN uploaded_files uf ON pq.uploaded_file_id = uf.id
       WHERE pq.store_id = $1 AND pq.status = 'pending'
       ORDER BY pq.created_at DESC`,
      [req.storeId]
    );

    const products = result.rows.map((row) => ({
      id: row.id,
      title: row.product_title,
      price: parseFloat(row.price),
      ean: row.ean,
      sku: row.sku,
      color: row.color,
      imageUrls: row.image_urls,
      description: row.description,
      supplierName: row.supplier_name,
      status: row.status,
      parentGroupId: row.parent_group_id,
      sourceFile: row.source_file,
      createdAt: row.created_at,
    }));

    res.json({ products });
  } catch (error) {
    console.error('Get queue error:', error);
    res.status(500).json({ error: 'Failed to get products queue' });
  }
});

// Delete products from queue
router.delete('/', verifyRequest, async (req: AuthRequest, res) => {
  try {
    const { productIds } = req.body;

    if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
      return res.status(400).json({ error: 'Product IDs required' });
    }

    await query(
      'DELETE FROM products_queue WHERE id = ANY($1) AND store_id = $2',
      [productIds, req.storeId]
    );

    res.json({ success: true, deleted: productIds.length });
  } catch (error) {
    console.error('Delete queue products error:', error);
    res.status(500).json({ error: 'Failed to delete products' });
  }
});

// Get queue statistics
router.get('/stats', verifyRequest, async (req: AuthRequest, res) => {
  try {
    const result = await query(
      `SELECT
         COUNT(*) as total_products,
         COUNT(DISTINCT parent_group_id) as product_families,
         COUNT(DISTINCT supplier_name) as suppliers
       FROM products_queue
       WHERE store_id = $1 AND status = 'pending'`,
      [req.storeId]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get queue stats error:', error);
    res.status(500).json({ error: 'Failed to get queue statistics' });
  }
});

export default router;
