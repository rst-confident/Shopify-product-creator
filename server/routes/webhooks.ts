import express, { Request, Response } from 'express';
import crypto from 'crypto';
import logger from '../utils/logger';
import { query } from '../db';

const router = express.Router();

/**
 * Verify webhook signature from Shopify
 */
const verifyWebhook = (req: Request): boolean => {
  const hmacHeader = req.headers['x-shopify-hmac-sha256'] as string;

  if (!hmacHeader) {
    return false;
  }

  const body = (req as any).rawBody || JSON.stringify(req.body);

  const hash = crypto
    .createHmac('sha256', process.env.SHOPIFY_API_SECRET!)
    .update(body, 'utf8')
    .digest('base64');

  return hash === hmacHeader;
};

/**
 * Middleware to verify all webhooks
 */
const verifyWebhookMiddleware = (req: Request, res: Response, next: Function) => {
  if (!verifyWebhook(req)) {
    logger.warn('Webhook verification failed', {
      shop: req.headers['x-shopify-shop-domain'],
      topic: req.headers['x-shopify-topic'],
    });
    return res.status(401).json({ error: 'Unauthorized - Invalid webhook signature' });
  }

  next();
};

/**
 * GDPR Webhook: Customer Data Request
 * https://shopify.dev/docs/apps/webhooks/configuration/mandatory-webhooks
 *
 * Triggered when a customer requests their data.
 * You must provide the customer's data within 30 days.
 */
router.post('/customers/data_request', verifyWebhookMiddleware, async (req: Request, res: Response) => {
  try {
    const { shop_domain, customer, orders_requested } = req.body;

    logger.info('Customer data request received', {
      shop: shop_domain,
      customerId: customer?.id,
      email: customer?.email,
    });

    // Log the request for compliance
    await query(
      `INSERT INTO gdpr_requests (request_type, shop_domain, customer_id, customer_email, request_data, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      ['data_request', shop_domain, customer?.id, customer?.email, JSON.stringify(req.body)]
    );

    // TODO: Implement actual data retrieval logic
    // This app only stores:
    // - CSV uploads (no customer data)
    // - Product queue (no customer data)
    // - Settings (no customer data)
    // So there's typically no customer data to provide

    res.status(200).json({ message: 'Data request received and logged' });
  } catch (error: any) {
    logger.error('Error processing customer data request', { error: error.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GDPR Webhook: Customer Data Erasure (Redaction)
 *
 * Triggered when a customer requests deletion of their data.
 * You must delete the customer's data within 30 days.
 */
router.post('/customers/redact', verifyWebhookMiddleware, async (req: Request, res: Response) => {
  try {
    const { shop_domain, customer } = req.body;

    logger.info('Customer data redaction request received', {
      shop: shop_domain,
      customerId: customer?.id,
      email: customer?.email,
    });

    // Log the request for compliance
    await query(
      `INSERT INTO gdpr_requests (request_type, shop_domain, customer_id, customer_email, request_data, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())`,
      ['customer_redact', shop_domain, customer?.id, customer?.email, JSON.stringify(req.body)]
    );

    // TODO: Implement actual data deletion logic
    // This app doesn't store customer data, but you should verify this
    // and delete any records if they exist

    res.status(200).json({ message: 'Redaction request received and processed' });
  } catch (error: any) {
    logger.error('Error processing customer redaction request', { error: error.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GDPR Webhook: Shop Data Erasure
 *
 * Triggered 48 hours after a shop uninstalls your app.
 * You must delete all shop data.
 */
router.post('/shop/redact', verifyWebhookMiddleware, async (req: Request, res: Response) => {
  try {
    const { shop_domain } = req.body;

    logger.info('Shop data redaction request received', {
      shop: shop_domain,
    });

    // Log the request for compliance
    await query(
      `INSERT INTO gdpr_requests (request_type, shop_domain, request_data, created_at)
       VALUES ($1, $2, $3, NOW())`,
      ['shop_redact', shop_domain, JSON.stringify(req.body)]
    );

    // Delete all shop data
    try {
      // Get store ID
      const storeResult = await query(
        'SELECT id FROM stores WHERE shopify_domain = $1',
        [shop_domain]
      );

      if (storeResult.rows.length > 0) {
        const storeId = storeResult.rows[0].id;

        // Delete products queue
        await query('DELETE FROM products_queue WHERE store_id = $1', [storeId]);

        // Delete product variants
        await query('DELETE FROM product_variants WHERE store_id = $1', [storeId]);

        // Delete uploaded files
        await query('DELETE FROM uploaded_files WHERE store_id = $1', [storeId]);

        // Delete sessions
        await query('DELETE FROM sessions WHERE shop = $1', [shop_domain]);

        // Delete store record
        await query('DELETE FROM stores WHERE id = $1', [storeId]);

        logger.info('Shop data deleted successfully', { shop: shop_domain });
      } else {
        logger.info('No shop data found to delete', { shop: shop_domain });
      }

      res.status(200).json({ message: 'Shop data redaction completed' });
    } catch (deleteError: any) {
      logger.error('Error deleting shop data', {
        shop: shop_domain,
        error: deleteError.message
      });
      res.status(500).json({ error: 'Error deleting shop data' });
    }
  } catch (error: any) {
    logger.error('Error processing shop redaction request', { error: error.message });
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
