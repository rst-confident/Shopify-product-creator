import express from 'express';
import { query } from '../db';
import { hashPassword } from '../utils/password';
import { requireAdmin } from '../middleware/auth';
import logger from '../utils/logger';

const router = express.Router();

// All routes require admin access
router.use(requireAdmin);

/**
 * GET /api/admin/users
 * Get all users
 */
router.get('/users', async (req, res) => {
  try {
    const result = await query(
      'SELECT id, email, name, role, created_at FROM users ORDER BY created_at DESC',
      []
    );

    res.json({ users: result.rows });
  } catch (error: any) {
    logger.error('Get users error', { error: error.message, stack: error.stack });
    res.status(500).json({ error: 'Failed to get users' });
  }
});

/**
 * POST /api/admin/users
 * Create a new user
 */
router.post('/users', async (req, res) => {
  try {
    const { email, password, name, role } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const trimmedEmail = email.toLowerCase().trim();

    // Check if user already exists
    const existing = await query('SELECT id FROM users WHERE email = $1', [trimmedEmail]);

    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'User with this email already exists' });
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Create user
    const result = await query(
      `INSERT INTO users (email, password_hash, name, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, name, role, created_at`,
      [trimmedEmail, passwordHash, name || null, role || 'user']
    );

    logger.info('User created', { userId: result.rows[0].id, email: trimmedEmail });

    res.json({ user: result.rows[0] });
  } catch (error: any) {
    logger.error('Create user error', { error: error.message, stack: error.stack });
    res.status(500).json({ error: 'Failed to create user' });
  }
});

/**
 * PUT /api/admin/users/:id
 * Update user
 */
router.put('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { email, password, name, role } = req.body;

    let updateQuery = 'UPDATE users SET';
    const params: any[] = [];
    const updates: string[] = [];
    let paramIndex = 1;

    if (email) {
      updates.push(` email = $${paramIndex++}`);
      params.push(email.toLowerCase().trim());
    }

    if (password) {
      const passwordHash = await hashPassword(password);
      updates.push(` password_hash = $${paramIndex++}`);
      params.push(passwordHash);
    }

    if (name !== undefined) {
      updates.push(` name = $${paramIndex++}`);
      params.push(name || null);
    }

    if (role) {
      updates.push(` role = $${paramIndex++}`);
      params.push(role);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    updates.push(` updated_at = CURRENT_TIMESTAMP`);
    updateQuery += updates.join(',');
    updateQuery += ` WHERE id = $${paramIndex} RETURNING id, email, name, role, updated_at`;
    params.push(id);

    const result = await query(updateQuery, params);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    logger.info('User updated', { userId: id });

    res.json({ user: result.rows[0] });
  } catch (error: any) {
    logger.error('Update user error', { error: error.message, stack: error.stack });
    res.status(500).json({ error: 'Failed to update user' });
  }
});

/**
 * DELETE /api/admin/users/:id
 * Delete user (and all their stores)
 */
router.delete('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query('DELETE FROM users WHERE id = $1 RETURNING id', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    logger.info('User deleted', { userId: id });

    res.json({ message: 'User deleted successfully' });
  } catch (error: any) {
    logger.error('Delete user error', { error: error.message, stack: error.stack });
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

/**
 * GET /api/admin/stores
 * Get all stores (across all users)
 */
router.get('/stores', async (req, res) => {
  try {
    const result = await query(
      `SELECT s.*, u.email as user_email, u.name as user_name
       FROM stores s
       LEFT JOIN users u ON s.user_id = u.id
       ORDER BY s.created_at DESC`,
      []
    );

    res.json({ stores: result.rows });
  } catch (error: any) {
    logger.error('Get all stores error', { error: error.message, stack: error.stack });
    res.status(500).json({ error: 'Failed to get stores' });
  }
});

/**
 * POST /api/admin/stores
 * Create a store for a user
 */
router.post('/stores', async (req, res) => {
  try {
    const { userId, storeName, shopifyDomain, shopifyAccessToken, openrouterApiKey, selectedAiModel } = req.body;

    if (!userId || !storeName || !shopifyDomain || !shopifyAccessToken) {
      return res.status(400).json({ error: 'userId, storeName, shopifyDomain, and shopifyAccessToken are required' });
    }

    // Check if user exists
    const userCheck = await query('SELECT id FROM users WHERE id = $1', [userId]);
    if (userCheck.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const result = await query(
      `INSERT INTO stores (user_id, store_name, shopify_domain, shopify_access_token, openrouter_api_key, selected_ai_model)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [userId, storeName, shopifyDomain, shopifyAccessToken, openrouterApiKey || null, selectedAiModel || 'anthropic/claude-3.5-sonnet']
    );

    logger.info('Store created by admin', { storeId: result.rows[0].id, userId });

    res.json({ store: result.rows[0] });
  } catch (error: any) {
    logger.error('Create store error', { error: error.message, stack: error.stack });
    res.status(500).json({ error: 'Failed to create store' });
  }
});

/**
 * PUT /api/admin/stores/:id
 * Update a store
 */
router.put('/stores/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { storeName, shopifyDomain, shopifyAccessToken, openrouterApiKey, selectedAiModel } = req.body;

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

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Store not found' });
    }

    logger.info('Store updated by admin', { storeId: id });

    res.json({ store: result.rows[0] });
  } catch (error: any) {
    logger.error('Update store error', { error: error.message, stack: error.stack });
    res.status(500).json({ error: 'Failed to update store' });
  }
});

/**
 * DELETE /api/admin/stores/:id
 * Delete a store
 */
router.delete('/stores/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query('DELETE FROM stores WHERE id = $1 RETURNING id', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Store not found' });
    }

    logger.info('Store deleted by admin', { storeId: id });

    res.json({ message: 'Store deleted successfully' });
  } catch (error: any) {
    logger.error('Delete store error', { error: error.message, stack: error.stack });
    res.status(500).json({ error: 'Failed to delete store' });
  }
});

export default router;
