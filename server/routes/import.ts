/**
 * Import Routes
 * Handles importing products to Shopify
 */

import express from 'express';
import { AuthRequest, verifyRequest } from '../middleware/auth';
import { query, getClient } from '../db';
import logger from '../utils/logger';
import { createShopifyProduct, addVariantsToProduct } from '../utils/shopify-helpers';

const router = express.Router();

interface QueueProduct {
  id: number;
  title: string;
  baseTitle: string;
  price: number;
  ean: string | null;
  sku: string;
  color: string | null;
  imageUrls: string[];
  description: string;
  parentGroupId: string;
  productIdentifier: string;
  importAction: 'create_new' | 'add_variant';
  matchedShopifyProductId: string | null;
}

/**
 * Import selected products to Shopify
 * Intelligently creates new products or adds variants to existing ones
 */
router.post('/', verifyRequest, async (req: AuthRequest, res) => {
  const client = await getClient();

  try {
    const { productIds, publishStatus = 'draft' } = req.body;

    if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
      return res.status(400).json({ error: 'Product IDs required' });
    }

    logger.info('Starting product import', {
      productCount: productIds.length,
      publishStatus,
    });

    // Start transaction
    await client.query('BEGIN');

    // Get products from queue
    const result = await client.query(
      `SELECT
         id, product_title as title, base_title as "baseTitle", price, ean, sku, color,
         image_urls as "imageUrls", description, parent_group_id as "parentGroupId",
         product_identifier as "productIdentifier", import_action as "importAction",
         matched_shopify_product_id as "matchedShopifyProductId"
       FROM products_queue
       WHERE id = ANY($1) AND store_id = $2 AND status = 'pending'`,
      [productIds, req.storeId]
    );

    const products: QueueProduct[] = result.rows;

    if (products.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'No products found to import' });
    }

    // Group products by import action and parent group
    const toCreateNew = new Map<string, QueueProduct[]>();
    const toAddVariants = new Map<string, QueueProduct[]>();

    products.forEach((product) => {
      if (product.importAction === 'add_variant' && product.matchedShopifyProductId) {
        const key = product.matchedShopifyProductId;
        const group = toAddVariants.get(key) || [];
        group.push(product);
        toAddVariants.set(key, group);
      } else {
        const key = product.productIdentifier;
        const group = toCreateNew.get(key) || [];
        group.push(product);
        toCreateNew.set(key, group);
      }
    });

    const successfulImports: number[] = [];
    const failedImports: Array<{ productId: number; title: string; error: string }> = [];

    const shopifyStatus = publishStatus.toUpperCase() as 'ACTIVE' | 'DRAFT';

    // Process products to create as new
    logger.info('Creating new products', { count: toCreateNew.size });

    for (const [productIdentifier, groupProducts] of toCreateNew.entries()) {
      try {
        const shopifyProductId = await createNewProductWithVariants(
          req.accessToken!,
          req.shop!,
          groupProducts,
          shopifyStatus
        );

        // Update all products in group with Shopify product ID
        for (const product of groupProducts) {
          await client.query(
            `UPDATE products_queue
             SET status = 'imported', shopify_product_id = $1
             WHERE id = $2`,
            [shopifyProductId, product.id]
          );
          successfulImports.push(product.id);
        }

        logger.info('Created new product', {
          shopifyProductId,
          productIdentifier,
          variantCount: groupProducts.length,
        });

      } catch (error: any) {
        logger.error('Failed to create new product', {
          error: error.message,
          productIdentifier,
        });

        groupProducts.forEach((p) => {
          failedImports.push({
            productId: p.id,
            title: p.title,
            error: error.message || 'Failed to create product',
          });
        });
      }
    }

    // Process products to add as variants
    logger.info('Adding variants to existing products', { count: toAddVariants.size });

    for (const [shopifyProductId, groupProducts] of toAddVariants.entries()) {
      try {
        await addNewVariants(
          req.accessToken!,
          req.shop!,
          shopifyProductId,
          groupProducts
        );

        // Update all products in group
        for (const product of groupProducts) {
          await client.query(
            `UPDATE products_queue
             SET status = 'imported', shopify_product_id = $1
             WHERE id = $2`,
            [shopifyProductId, product.id]
          );
          successfulImports.push(product.id);
        }

        logger.info('Added variants to existing product', {
          shopifyProductId,
          variantCount: groupProducts.length,
        });

      } catch (error: any) {
        logger.error('Failed to add variants', {
          error: error.message,
          shopifyProductId,
        });

        groupProducts.forEach((p) => {
          failedImports.push({
            productId: p.id,
            title: p.title,
            error: error.message || 'Failed to add variant',
          });
        });
      }
    }

    // Commit transaction
    await client.query('COMMIT');

    logger.info('Import completed', {
      successful: successfulImports.length,
      failed: failedImports.length,
    });

    res.json({
      success: true,
      summary: {
        totalRequested: productIds.length,
        successful: successfulImports.length,
        failed: failedImports.length,
        newProductsCreated: toCreateNew.size,
        variantsAdded: toAddVariants.size,
      },
      failedImports,
    });

  } catch (error: any) {
    // Rollback transaction on error
    await client.query('ROLLBACK');
    logger.error('Import failed', { error: error.message, stack: error.stack });
    res.status(500).json({ error: 'Failed to import products: ' + error.message });
  } finally {
    client.release();
  }
});

/**
 * Create a new product with variants in Shopify
 */
async function createNewProductWithVariants(
  accessToken: string,
  shop: string,
  products: QueueProduct[],
  status: 'ACTIVE' | 'DRAFT'
): Promise<string> {
  // Use first product as base
  const baseProduct = products[0];

  // Determine if product has color variants
  const hasColorVariants = products.some(p => p.color !== null);

  let productData: any;

  if (hasColorVariants) {
    // Product with color variants
    productData = {
      title: baseProduct.baseTitle, // Use base title without color
      description: baseProduct.description,
      status,
      options: ['Color'],
      variants: products.map((p) => ({
        price: p.price.toString(),
        sku: p.sku,
        barcode: p.ean || undefined,
        options: p.color ? [p.color] : undefined,
      })),
    };

    // Use images from first product
    if (baseProduct.imageUrls && baseProduct.imageUrls.length > 0) {
      productData.images = baseProduct.imageUrls.map((url: string) => ({ src: url }));
    }
  } else {
    // Single product without variants
    productData = {
      title: baseProduct.title, // Use full title
      description: baseProduct.description,
      status,
      variants: [
        {
          price: baseProduct.price.toString(),
          sku: baseProduct.sku,
          barcode: baseProduct.ean || undefined,
        },
      ],
    };

    if (baseProduct.imageUrls && baseProduct.imageUrls.length > 0) {
      productData.images = baseProduct.imageUrls.map((url: string) => ({ src: url }));
    }
  }

  const shopifyProductId = await createShopifyProduct(accessToken, shop, productData);

  return shopifyProductId;
}

/**
 * Add variants to existing Shopify product
 */
async function addNewVariants(
  accessToken: string,
  shop: string,
  shopifyProductId: string,
  products: QueueProduct[]
): Promise<void> {
  const variants = products.map((p) => ({
    price: p.price.toString(),
    sku: p.sku,
    barcode: p.ean,
    options: p.color ? [p.color] : [],
  }));

  await addVariantsToProduct(accessToken, shop, shopifyProductId, variants);
}

export default router;
