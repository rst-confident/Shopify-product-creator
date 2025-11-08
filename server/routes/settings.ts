import express from 'express';
import { AuthRequest, verifyRequest } from '../middleware/auth';
import { query } from '../db';
import axios from 'axios';

const router = express.Router();

// Get settings
router.get('/', verifyRequest, async (req: AuthRequest, res) => {
  try {
    const result = await query(
      'SELECT openrouter_api_key, selected_ai_model FROM stores WHERE id = $1',
      [req.storeId]
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
router.post('/', verifyRequest, async (req: AuthRequest, res) => {
  try {
    const { openrouterApiKey, selectedModel } = req.body;

    await query(
      `UPDATE stores
       SET openrouter_api_key = $1, selected_ai_model = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $3`,
      [openrouterApiKey, selectedModel, req.storeId]
    );

    res.json({ success: true, message: 'Settings updated successfully' });
  } catch (error) {
    console.error('Update settings error:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

// Test OpenRouter connection
router.post('/test-connection', verifyRequest, async (req: AuthRequest, res) => {
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
