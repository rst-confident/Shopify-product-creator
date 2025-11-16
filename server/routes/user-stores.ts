import express from 'express';
import { query } from '../db';
import { requireAuth } from '../middleware/auth';
import logger from '../utils/logger';

const router = express.Router();

// All routes require authentication
router.use(requireAuth);

/**
 * GET /api/user/stores
 * Get current user's stores
 */
router.get('/', async (req, res) => {
  try {
    const userId = req.session.userId;

    const result = await query(
      'SELECT * FROM stores WHERE user_id = $1 ORDER BY created_at DESC',
      [userId]
    );

    res.json({ stores: result.rows });
  } catch (error: any) {
    logger.error('Get user stores error', { error: error.message, stack: error.stack });
    res.status(500).json({ error: 'Failed to get stores' });
  }
});

/**
 * GET /api/user/stores/:id
 * Get a specific store (if owned by user)
 */
router.get('/:id', async (req, res) => {
  try {
    const userId = req.session.userId;
    const { id } = req.params;

    const result = await query(
      'SELECT * FROM stores WHERE id = $1 AND user_id = $2',
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Store not found' });
    }

    res.json({ store: result.rows[0] });
  } catch (error: any) {
    logger.error('Get store error', { error: error.message, stack: error.stack });
    res.status(500).json({ error: 'Failed to get store' });
  }
});

/**
 * POST /api/user/stores
 * Create a new store for current user
 */
router.post('/', async (req, res) => {
  try {
    const userId = req.session.userId;
    const { storeName, shopifyDomain, shopifyAccessToken, openrouterApiKey, selectedAiModel } = req.body;

    if (!storeName || !shopifyDomain || !shopifyAccessToken) {
      return res.status(400).json({ error: 'storeName, shopifyDomain, and shopifyAccessToken are required' });
    }

    const result = await query(
      `INSERT INTO stores (user_id, store_name, shopify_domain, shopify_access_token, openrouter_api_key, selected_ai_model)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [userId, storeName, shopifyDomain, shopifyAccessToken, openrouterApiKey || null, selectedAiModel || 'anthropic/claude-3.5-sonnet']
    );

    logger.info('Store created', { storeId: result.rows[0].id, userId });

    res.json({ store: result.rows[0] });
  } catch (error: any) {
    logger.error('Create store error', { error: error.message, stack: error.stack });
    res.status(500).json({ error: 'Failed to create store' });
  }
});

/**
 * PUT /api/user/stores/:id
 * Update a store (if owned by user)
 */
router.put('/:id', async (req, res) => {
  try {
    const userId = req.session.userId;
    const { id } = req.params;
    const { storeName, shopifyDomain, shopifyAccessToken, openrouterApiKey, selectedAiModel } = req.body;

    // Verify ownership
    const ownerCheck = await query('SELECT id FROM stores WHERE id = $1 AND user_id = $2', [id, userId]);
    if (ownerCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Store not found' });
    }

    let updateQuery = 'UPDATE stores SET';
    const params: any[] = [];
    const updates: string[] = [];
    let paramIndex = 1;

    if (storeName !== undefined) {
      updates.push(` store_name = $${paramIndex++}`);
      params.push(storeName);
    }

    if (shopifyDomain !== undefined) {
      updates.push(` shopify_domain = $${paramIndex++}`);
      params.push(shopifyDomain);
    }

    if (shopifyAccessToken !== undefined) {
      updates.push(` shopify_access_token = $${paramIndex++}`);
      params.push(shopifyAccessToken);
    }

    if (openrouterApiKey !== undefined) {
      updates.push(` openrouter_api_key = $${paramIndex++}`);
      params.push(openrouterApiKey || null);
    }

    if (selectedAiModel !== undefined) {
      updates.push(` selected_ai_model = $${paramIndex++}`);
      params.push(selectedAiModel);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    updates.push(` updated_at = CURRENT_TIMESTAMP`);
    updateQuery += updates.join(',');
    updateQuery += ` WHERE id = $${paramIndex} RETURNING *`;
    params.push(id);

    const result = await query(updateQuery, params);

    logger.info('Store updated', { storeId: id, userId });

    res.json({ store: result.rows[0] });
  } catch (error: any) {
    logger.error('Update store error', { error: error.message, stack: error.stack });
    res.status(500).json({ error: 'Failed to update store' });
  }
});

/**
 * DELETE /api/user/stores/:id
 * Delete a store (if owned by user)
 */
router.delete('/:id', async (req, res) => {
  try {
    const userId = req.session.userId;
    const { id } = req.params;

    const result = await query(
      'DELETE FROM stores WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Store not found' });
    }

    logger.info('Store deleted', { storeId: id, userId });

    res.json({ message: 'Store deleted successfully' });
  } catch (error: any) {
    logger.error('Delete store error', { error: error.message, stack: error.stack });
    res.status(500).json({ error: 'Failed to delete store' });
  }
});

export default router;
