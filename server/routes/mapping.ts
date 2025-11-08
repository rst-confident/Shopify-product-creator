import express from 'express';
import { AuthRequest, verifyRequest } from '../middleware/auth';
import { query } from '../db';
import axios from 'axios';

const router = express.Router();

// Available Shopify fields for mapping
export const SHOPIFY_FIELDS = [
  'title',
  'price',
  'ean',
  'sku',
  'color',
  'image_url_1',
  'image_url_2',
  'image_url_3',
  'description_fabric',
  'description_quality',
  'description_fit',
  'description_care',
  'description_material',
  'description_style',
  'description_generic',
  'ignore',
];

// AI-powered column mapping
router.post('/ai-suggest', verifyRequest, async (req: AuthRequest, res) => {
  try {
    const { headers, sampleData } = req.body;

    // Get OpenRouter API key
    const storeResult = await query(
      'SELECT openrouter_api_key, selected_ai_model FROM stores WHERE id = $1',
      [req.storeId]
    );

    if (storeResult.rows.length === 0) {
      return res.status(404).json({ error: 'Store not found' });
    }

    const { openrouter_api_key, selected_ai_model } = storeResult.rows[0];

    if (!openrouter_api_key) {
      return res.status(400).json({ error: 'OpenRouter API key not configured' });
    }

    // Create prompt for AI
    const prompt = `You are a data mapping assistant for a Shopify product import system.

I have a CSV file with the following columns and sample data:

${headers.map((header: string, idx: number) => {
  const samples = sampleData.map((row: any) => row[header]).join(', ');
  return `Column: "${header}"\nSample values: ${samples}`;
}).join('\n\n')}

Available Shopify fields to map to:
${SHOPIFY_FIELDS.join(', ')}

Please suggest the best mapping for each CSV column to a Shopify field. Return ONLY a JSON object with this exact format:
{
  "mappings": {
    "csv_column_name": {
      "shopifyField": "field_name",
      "confidence": 0.95
    }
  }
}

Rules:
- confidence should be between 0 and 1
- Use "ignore" for columns that don't match any Shopify field
- Map image columns to image_url_1, image_url_2, image_url_3
- Map description-related columns to appropriate description fields
- Only return the JSON object, no other text`;

    const response = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: selected_ai_model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 2000,
        temperature: 0.1,
      },
      {
        headers: {
          Authorization: `Bearer ${openrouter_api_key}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const aiResponse = response.data.choices[0].message.content;

    // Parse AI response
    let mappings;
    try {
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        mappings = parsed.mappings;
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      console.error('Failed to parse AI response:', aiResponse);
      return res.status(500).json({ error: 'Failed to parse AI response' });
    }

    res.json({ mappings });
  } catch (error: any) {
    console.error('AI mapping error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to generate AI mapping suggestions' });
  }
});

// Save mapping configuration
router.post('/save', verifyRequest, async (req: AuthRequest, res) => {
  try {
    const { fileId, mappings } = req.body;

    await query(
      'UPDATE uploaded_files SET mapping_config = $1 WHERE id = $2 AND store_id = $3',
      [JSON.stringify(mappings), fileId, req.storeId]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Save mapping error:', error);
    res.status(500).json({ error: 'Failed to save mapping configuration' });
  }
});

// Get available Shopify fields
router.get('/fields', verifyRequest, async (req: AuthRequest, res) => {
  res.json({ fields: SHOPIFY_FIELDS });
});

export default router;
