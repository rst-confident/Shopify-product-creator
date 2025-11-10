/**
 * Import Routes
 * Handles importing products to Shopify with three import types:
 * - normal: Create/update full product with all data
 * - preorder: Handle inventory with preorder metafields
 * - inventory_change: Only update inventory levels
 */

import express from 'express';
import { AuthRequest, verifyRequest } from '../middleware/auth';
import { query, getClient } from '../db';
import logger from '../utils/logger';
import {
  createShopifyProduct,
  updateShopifyProduct,
  updateVariantInventory,
  updateProductMetafields
} from '../utils/shopify-helpers';

const router = express.Router();

interface QueueProduct {
  id: number;
  title: string;
  baseTitle: string;
  price: number;
  ean: string | null;
  sku: string;
  color: string | null;
  inventoryQuantity: number;
  imageUrls: string[];
  description: string;
  parentGroupId: string;
  productIdentifier: string;
  importAction: 'create_new' | 'update_existing';
  importType: 'normal' | 'preorder' | 'inventory_change';
  matchedShopifyProductId: string | null;
  matchedShopifyVariantId: string | null;
  preOrderTiming: string | null;
  preOrderMonth: string | null;
}

/**
 * Danish months mapping
 */
const DANISH_MONTHS: { [key: string]: string } = {
  'january': 'januar',
  'february': 'februar',
  'march': 'marts',
  'april': 'april',
  'may': 'maj',
  'june': 'juni',
  'july': 'juli',
  'august': 'august',
  'september': 'september',
  'october': 'oktober',
  'november': 'november',
  'december': 'december',
};

/**
 * Generate preorder info text in Danish
 */
function generatePreOrderInfo(timing: string | null, month: string | null): string {
  if (!timing || !month) {
    return 'Pre-order - Kommer snart';
  }

  const danishMonth = DANISH_MONTHS[month.toLowerCase()] || month;

  switch (timing.toLowerCase()) {
    case 'start':
      return `I starten af ${danishMonth}`;
    case 'middle':
      return `I midten af ${danishMonth}`;
    case 'end':
      return `I slutningen af ${danishMonth}`;
    default:
      return `I ${danishMonth}`;
  }
}

/**
 * Import selected products to Shopify
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
         inventory_quantity as "inventoryQuantity", image_urls as "imageUrls", description,
         parent_group_id as "parentGroupId", product_identifier as "productIdentifier",
         import_action as "importAction", import_type as "importType",
         matched_shopify_product_id as "matchedShopifyProductId",
         matched_shopify_variant_id as "matchedShopifyVariantId",
         pre_order_timing as "preOrderTiming", pre_order_month as "preOrderMonth"
       FROM products_queue
       WHERE id = ANY($1) AND store_id = $2 AND status = 'pending'`,
      [productIds, req.storeId]
    );

    const products: QueueProduct[] = result.rows;

    if (products.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'No products found to import' });
    }

    const successfulImports: number[] = [];
    const failedImports: Array<{ productId: number; title: string; error: string }> = [];

    const shopifyStatus = publishStatus.toUpperCase() as 'ACTIVE' | 'DRAFT';

    // Group products by import type and action
    const toCreateNormal = new Map<string, QueueProduct[]>();
    const toUpdateNormal: QueueProduct[] = [];
    const toHandlePreorder: QueueProduct[] = [];
    const toUpdateInventoryOnly: QueueProduct[] = [];

    products.forEach((product) => {
      if (product.importType === 'inventory_change') {
        // Inventory change: only update inventory
        toUpdateInventoryOnly.push(product);
      } else if (product.importType === 'preorder') {
        // Preorder: handle both create and update
        toHandlePreorder.push(product);
      } else if (product.importType === 'normal') {
        if (product.importAction === 'create_new') {
          // Normal create: group by product identifier
          const key = product.productIdentifier;
          const group = toCreateNormal.get(key) || [];
          group.push(product);
          toCreateNormal.set(key, group);
        } else {
          // Normal update: process individually
          toUpdateNormal.push(product);
        }
      }
    });

    logger.info('Import distribution', {
      createNormal: toCreateNormal.size,
      updateNormal: toUpdateNormal.length,
      preorder: toHandlePreorder.length,
      inventoryOnly: toUpdateInventoryOnly.length,
    });

    // 1. Handle inventory-only updates
    for (const product of toUpdateInventoryOnly) {
      try {
        if (!product.matchedShopifyVariantId) {
          throw new Error('No matched variant ID for inventory update');
        }

        await updateVariantInventory(
          req.accessToken!,
          req.shop!,
          product.matchedShopifyVariantId,
          product.inventoryQuantity
        );

        await client.query(
          `UPDATE products_queue
           SET status = 'imported', shopify_product_id = $1
           WHERE id = $2`,
          [product.matchedShopifyProductId, product.id]
        );

        successfulImports.push(product.id);

        logger.info('Updated inventory only', {
          sku: product.sku,
          variantId: product.matchedShopifyVariantId,
          quantity: product.inventoryQuantity,
        });

      } catch (error: any) {
        logger.error('Failed to update inventory', {
          error: error.message,
          productId: product.id,
          sku: product.sku,
        });

        failedImports.push({
          productId: product.id,
          title: product.title,
          error: error.message || 'Failed to update inventory',
        });
      }
    }

    // 2. Create normal products
    for (const [productIdentifier, groupProducts] of toCreateNormal.entries()) {
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

        logger.info('Created normal product', {
          shopifyProductId,
          productIdentifier,
          variantCount: groupProducts.length,
        });

      } catch (error: any) {
        logger.error('Failed to create normal product', {
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

    // 3. Update normal products (full update)
    for (const product of toUpdateNormal) {
      try {
        if (!product.matchedShopifyProductId || !product.matchedShopifyVariantId) {
          throw new Error('No matched product/variant ID for update');
        }

        // Update product data
        await updateShopifyProduct(
          req.accessToken!,
          req.shop!,
          product.matchedShopifyProductId,
          {
            title: product.title,
            description: product.description,
            images: product.imageUrls.length > 0
              ? product.imageUrls.map((url: string) => ({ src: url }))
              : undefined,
            variants: [
              {
                id: product.matchedShopifyVariantId,
                price: product.price.toString(),
                sku: product.sku,
              },
            ],
          }
        );

        // Update inventory
        await updateVariantInventory(
          req.accessToken!,
          req.shop!,
          product.matchedShopifyVariantId,
          product.inventoryQuantity
        );

        await client.query(
          `UPDATE products_queue
           SET status = 'imported', shopify_product_id = $1
           WHERE id = $2`,
          [product.matchedShopifyProductId, product.id]
        );

        successfulImports.push(product.id);

        logger.info('Updated normal product fully', {
          sku: product.sku,
          productId: product.matchedShopifyProductId,
        });

      } catch (error: any) {
        logger.error('Failed to update normal product', {
          error: error.message,
          productId: product.id,
          sku: product.sku,
        });

        failedImports.push({
          productId: product.id,
          title: product.title,
          error: error.message || 'Failed to update product',
        });
      }
    }

    // 4. Handle preorder products
    for (const product of toHandlePreorder) {
      try {
        let shopifyProductId: string;

        // Create or update product
        if (product.importAction === 'create_new') {
          // Create new preorder product
          shopifyProductId = await createNewProductWithVariants(
            req.accessToken!,
            req.shop!,
            [product],
            shopifyStatus
          );
        } else {
          // Use existing product
          if (!product.matchedShopifyProductId || !product.matchedShopifyVariantId) {
            throw new Error('No matched product/variant ID for preorder update');
          }
          shopifyProductId = product.matchedShopifyProductId;

          // Update inventory
          await updateVariantInventory(
            req.accessToken!,
            req.shop!,
            product.matchedShopifyVariantId,
            product.inventoryQuantity
          );
        }

        // Handle preorder metafields based on inventory
        if (product.inventoryQuantity === 0) {
          // Set preorder metafields
          const preOrderInfo = generatePreOrderInfo(
            product.preOrderTiming,
            product.preOrderMonth
          );

          await updateProductMetafields(
            req.accessToken!,
            req.shop!,
            shopifyProductId,
            [
              {
                namespace: 'custom',
                key: 'pre_order',
                type: 'boolean',
                value: 'true',
              },
              {
                namespace: 'custom',
                key: 'pre_order_info',
                type: 'single_line_text_field',
                value: preOrderInfo,
              },
            ]
          );

          logger.info('Set preorder metafields', {
            shopifyProductId,
            preOrderInfo,
          });
        } else {
          // Remove preorder metafields (set to false/empty)
          await updateProductMetafields(
            req.accessToken!,
            req.shop!,
            shopifyProductId,
            [
              {
                namespace: 'custom',
                key: 'pre_order',
                type: 'boolean',
                value: 'false',
              },
              {
                namespace: 'custom',
                key: 'pre_order_info',
                type: 'single_line_text_field',
                value: '',
              },
            ]
          );

          logger.info('Removed preorder metafields (product in stock)', {
            shopifyProductId,
            inventoryQuantity: product.inventoryQuantity,
          });
        }

        await client.query(
          `UPDATE products_queue
           SET status = 'imported', shopify_product_id = $1
           WHERE id = $2`,
          [shopifyProductId, product.id]
        );

        successfulImports.push(product.id);

        logger.info('Handled preorder product', {
          sku: product.sku,
          shopifyProductId,
          inventory: product.inventoryQuantity,
          isPreorder: product.inventoryQuantity === 0,
        });

      } catch (error: any) {
        logger.error('Failed to handle preorder product', {
          error: error.message,
          productId: product.id,
          sku: product.sku,
        });

        failedImports.push({
          productId: product.id,
          title: product.title,
          error: error.message || 'Failed to handle preorder',
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
        normalCreated: toCreateNormal.size,
        normalUpdated: toUpdateNormal.length,
        preorderHandled: toHandlePreorder.length,
        inventoryOnlyUpdated: toUpdateInventoryOnly.length,
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

export default router;
