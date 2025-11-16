import express from 'express';
import { requireAuth } from '../middleware/auth';
import { query } from '../db';
import axios from 'axios';

const router = express.Router();

// All routes require authentication
router.use(requireAuth);

// Helper to verify store ownership
async function verifyStoreOwnership(storeId: number, userId: number): Promise<boolean> {
  const result = await query(
    'SELECT id FROM stores WHERE id = $1 AND user_id = $2',
    [storeId, userId]
  );
  return result.rows.length > 0;
}

// Get settings
router.get('/', async (req, res) => {
  try {
    const { storeId } = req.query;

    if (!storeId) {
      return res.status(400).json({ error: 'Store ID is required' });
    }

    if (!(await verifyStoreOwnership(Number(storeId), req.session.userId))) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const result = await query(
      'SELECT openrouter_api_key, selected_ai_model FROM stores WHERE id = $1',
      [storeId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Store not found' });
    }

    const store = result.rows[0];
    res.json({
      hasApiKey: !!store.openrouter_api_key,
      apiKey: store.openrouter_api_key ? '***' + store.openrouter_api_key.slice(-4) : null,
      selectedModel: store.selected_ai_model,
    });
  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json({ error: 'Failed to get settings' });
  }
});

// Update settings
router.post('/', async (req, res) => {
  try {
    const { storeId, openrouterApiKey, selectedModel } = req.body;

    if (!storeId) {
      return res.status(400).json({ error: 'Store ID is required' });
    }

    if (!(await verifyStoreOwnership(storeId, req.session.userId))) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await query(
      `UPDATE stores
       SET openrouter_api_key = $1, selected_ai_model = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $3`,
      [openrouterApiKey, selectedModel, storeId]
    );

    res.json({ success: true, message: 'Settings updated successfully' });
  } catch (error) {
    console.error('Update settings error:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

// Test OpenRouter connection
router.post('/test-connection', async (req, res) => {
  try {
    const { apiKey } = req.body;

    const response = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: 'anthropic/claude-3.5-sonnet',
        messages: [{ role: 'user', content: 'Test' }],
        max_tokens: 10,
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      }
    );

    res.json({
      success: true,
      message: 'Connection successful',
      model: response.data.model
    });
  } catch (error: any) {
    console.error('Test connection error:', error.response?.data || error.message);
    res.status(400).json({
      success: false,
      error: 'Connection failed. Please check your API key.'
    });
  }
});

export default router;
