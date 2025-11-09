/**
 * Product Processing Routes
 * Processes CSV data with mappings and prepares products for import
 */

import express from 'express';
import { AuthRequest, verifyRequest } from '../middleware/auth';
import { getClient, query } from '../db';
import logger from '../utils/logger';
import { validatePrice, filterValidImageUrls } from '../utils/validation';
import {
  generateSKU,
  extractBaseTitle,
  generateProductIdentifier
} from '../utils/sku';
import { searchShopifyProducts } from '../utils/shopify-helpers';
import {
  MAX_CSV_ROWS,
  SHOPIFY_QUERY_BATCH_SIZE
} from '../utils/constants';

const router = express.Router();

interface MappedProduct {
  title: string;
  price: string;
  ean?: string;
  sku?: string;
  color?: string;
  image_url_1?: string;
  image_url_2?: string;
  image_url_3?: string;
  description_fabric?: string;
  description_quality?: string;
  description_fit?: string;
  description_care?: string;
  description_material?: string;
  description_style?: string;
  description_generic?: string;
}

interface ProcessedProduct {
  title: string;
  baseTitle: string;
  price: number;
  ean: string | null;
  sku: string;
  color: string | null;
  imageUrls: string[];
  description: string;
  productIdentifier: string;
  parentGroupId: string;
  importAction: 'create_new' | 'add_variant';
  matchedShopifyProductId: string | null;
}

/**
 * Process CSV data with mappings
 * Generates SKUs, detects existing products, and prepares for import
 */
router.post('/', verifyRequest, async (req: AuthRequest, res) => {
  const client = await getClient();

  try {
    const { fileId, mappings, records, supplierName } = req.body;

    // Validate input
    if (!records || records.length === 0) {
      return res.status(400).json({ error: 'No records to process' });
    }

    if (records.length > MAX_CSV_ROWS) {
      return res.status(400).json({
        error: `Too many rows. Maximum ${MAX_CSV_ROWS} products per upload`
      });
    }

    logger.info('Starting product processing', {
      fileId,
      recordCount: records.length,
      supplier: supplierName,
    });

    // Start transaction
    await client.query('BEGIN');

    // Map CSV records to product structure
    const mappedProducts: MappedProduct[] = records.map((record: any) => {
      const product: any = {};
      Object.keys(mappings).forEach((csvColumn) => {
        const shopifyField = mappings[csvColumn].shopifyField;
        if (shopifyField !== 'ignore' && record[csvColumn]) {
          product[shopifyField] = record[csvColumn];
        }
      });
      return product;
    });

    // Get existing EANs from Shopify to check for duplicates
    const existingEANs = await checkDuplicateEANs(
      req.accessToken!,
      req.shop!,
      mappedProducts.map((p) => p.ean).filter(Boolean) as string[]
    );

    // Process each product
    const processedProducts: ProcessedProduct[] = [];
    const duplicates: Array<{ title: string; ean: string; reason: string }> = [];

    for (const product of mappedProducts) {
      try {
        // Check for duplicate EAN
        if (product.ean && existingEANs.includes(product.ean)) {
          duplicates.push({
            title: product.title,
            ean: product.ean,
            reason: 'EAN already exists in Shopify',
          });
          continue;
        }

        // Validate price
        const validatedPrice = validatePrice(product.price);

        // Extract base title (remove color)
        const baseTitle = extractBaseTitle(product.title, product.color);

        // Generate intelligent SKU
        const sku = generateSKU(baseTitle, product.color, supplierName, product.sku);

        // Generate product identifier for matching
        const productIdentifier = generateProductIdentifier(baseTitle, supplierName);

        // Combine description fields
        const descriptionParts: string[] = [];
        if (product.description_fabric) descriptionParts.push(`Fabric: ${product.description_fabric}`);
        if (product.description_material) descriptionParts.push(`Material: ${product.description_material}`);
        if (product.description_quality) descriptionParts.push(`Quality: ${product.description_quality}`);
        if (product.description_fit) descriptionParts.push(`Fit: ${product.description_fit}`);
        if (product.description_style) descriptionParts.push(`Style: ${product.description_style}`);
        if (product.description_care) descriptionParts.push(`Care: ${product.description_care}`);
        if (product.description_generic) descriptionParts.push(product.description_generic);
        const description = descriptionParts.join('\n\n');

        // Collect and validate image URLs
        const imageUrls = filterValidImageUrls([
          product.image_url_1,
          product.image_url_2,
          product.image_url_3,
        ]);

        // Parent group ID for this product family
        const parentGroupId = `${supplierName}-${baseTitle}`.toLowerCase().replace(/\s+/g, '-');

        processedProducts.push({
          title: product.title,
          baseTitle,
          price: validatedPrice,
          ean: product.ean || null,
          sku,
          color: product.color || null,
          imageUrls,
          description,
          productIdentifier,
          parentGroupId,
          importAction: 'create_new', // Will be updated after matching
          matchedShopifyProductId: null,
        });

      } catch (error: any) {
        logger.warn('Failed to process product', {
          title: product.title,
          error: error.message,
        });
        duplicates.push({
          title: product.title,
          ean: product.ean || 'N/A',
          reason: error.message,
        });
      }
    }

    // Search Shopify for existing products to match
    logger.info('Searching for existing products in Shopify', {
      productCount: processedProducts.length,
    });

    const uniqueBaseTitles = [...new Set(processedProducts.map(p => p.baseTitle))];
    const existingProducts = await searchExistingProducts(
      req.accessToken!,
      req.shop!,
      uniqueBaseTitles
    );

    // Match processed products to existing Shopify products
    const productMatches = matchProducts(processedProducts, existingProducts);

    // Update import actions based on matches
    processedProducts.forEach((product, index) => {
      const match = productMatches.get(index);
      if (match) {
        product.importAction = 'add_variant';
        product.matchedShopifyProductId = match;
        logger.info('Product matched to existing Shopify product', {
          title: product.title,
          baseTitle: product.baseTitle,
          shopifyProductId: match,
        });
      }
    });

    // Group products by parent group (for statistics)
    const productGroups = new Map<string, ProcessedProduct[]>();
    processedProducts.forEach((product) => {
      const group = productGroups.get(product.parentGroupId) || [];
      group.push(product);
      productGroups.set(product.parentGroupId, group);
    });

    // Bulk insert into database using transaction
    const savedProducts = await bulkInsertProducts(
      client,
      processedProducts,
      fileId,
      req.storeId!,
      supplierName
    );

    // Update file status
    await client.query(
      'UPDATE uploaded_files SET status = $1 WHERE id = $2',
      ['processed', fileId]
    );

    // Commit transaction
    await client.query('COMMIT');

    logger.info('Product processing completed', {
      total: records.length,
      processed: savedProducts.length,
      duplicates: duplicates.length,
      createNew: processedProducts.filter(p => p.importAction === 'create_new').length,
      addVariant: processedProducts.filter(p => p.importAction === 'add_variant').length,
    });

    res.json({
      success: true,
      summary: {
        totalRows: records.length,
        productsReady: savedProducts.length,
        duplicatesSkipped: duplicates.length,
        productFamilies: productGroups.size,
        willCreateNew: processedProducts.filter(p => p.importAction === 'create_new').length,
        willAddVariants: processedProducts.filter(p => p.importAction === 'add_variant').length,
      },
      duplicates,
      products: savedProducts,
    });

  } catch (error: any) {
    // Rollback transaction on error
    await client.query('ROLLBACK');
    logger.error('Product processing failed', { error: error.message, stack: error.stack });
    res.status(500).json({ error: 'Failed to process products: ' + error.message });
  } finally {
    client.release();
  }
});

/**
 * Check for duplicate EANs in Shopify
 */
async function checkDuplicateEANs(
  accessToken: string,
  shop: string,
  eans: string[]
): Promise<string[]> {
  if (eans.length === 0) return [];

  const client = new (await import('../shopify/config')).default.clients.Graphql({
    session: { accessToken, shop } as any
  });

  const existingEANs: string[] = [];

  // Query in batches
  for (let i = 0; i < eans.length; i += SHOPIFY_QUERY_BATCH_SIZE) {
    const batch = eans.slice(i, i + SHOPIFY_QUERY_BATCH_SIZE);
    const barcodeQuery = batch.map((ean) => `barcode:${ean}`).join(' OR ');

    try {
      const response: any = await client.query({
        data: {
          query: `{
            productVariants(first: ${SHOPIFY_QUERY_BATCH_SIZE}, query: "${barcodeQuery}") {
              edges {
                node {
                  barcode
                }
              }
            }
          }`,
        },
      });

      const variants = response.body.data.productVariants.edges;
      variants.forEach((edge: any) => {
        if (edge.node.barcode) {
          existingEANs.push(edge.node.barcode);
        }
      });
    } catch (error) {
      logger.error('Error checking duplicate EANs', { error, batch });
    }
  }

  return existingEANs;
}

/**
 * Search for existing products in Shopify by base titles
 */
async function searchExistingProducts(
  accessToken: string,
  shop: string,
  baseTitles: string[]
): Promise<Map<string, string>> {
  const existingProducts = new Map<string, string>();

  // Search for each unique base title
  for (const baseTitle of baseTitles) {
    try {
      const products = await searchShopifyProducts(accessToken, shop, baseTitle);

      products.forEach((product) => {
        const normalized = product.title.toLowerCase().replace(/[^a-z0-9]/g, '');
        existingProducts.set(normalized, product.id);
      });
    } catch (error) {
      logger.warn('Failed to search for existing product', { baseTitle, error });
    }
  }

  return existingProducts;
}

/**
 * Match processed products to existing Shopify products
 */
function matchProducts(
  processedProducts: ProcessedProduct[],
  existingProducts: Map<string, string>
): Map<number, string> {
  const matches = new Map<number, string>();

  processedProducts.forEach((product, index) => {
    const normalized = product.baseTitle.toLowerCase().replace(/[^a-z0-9]/g, '');

    if (existingProducts.has(normalized)) {
      matches.set(index, existingProducts.get(normalized)!);
    }
  });

  return matches;
}

/**
 * Bulk insert products into database
 */
async function bulkInsertProducts(
  client: any,
  products: ProcessedProduct[],
  fileId: number,
  storeId: number,
  supplierName: string
): Promise<Array<ProcessedProduct & { id: number }>> {
  const savedProducts: Array<ProcessedProduct & { id: number }> = [];

  // Use parameterized bulk insert
  for (const product of products) {
    const result = await client.query(
      `INSERT INTO products_queue
       (uploaded_file_id, store_id, supplier_name, product_title, base_title,
        price, ean, sku, color, image_urls, description, parent_group_id,
        product_identifier, matched_shopify_product_id, import_action, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, 'pending')
       RETURNING id`,
      [
        fileId,
        storeId,
        supplierName,
        product.title,
        product.baseTitle,
        product.price,
        product.ean,
        product.sku,
        product.color,
        JSON.stringify(product.imageUrls),
        product.description,
        product.parentGroupId,
        product.productIdentifier,
        product.matchedShopifyProductId,
        product.importAction,
      ]
    );

    savedProducts.push({
      id: result.rows[0].id,
      ...product,
    });

    // Create variant record if color exists
    if (product.color) {
      await client.query(
        `INSERT INTO product_variants (product_queue_id, parent_group_id, variant_type, variant_value)
         VALUES ($1, $2, 'color', $3)`,
        [result.rows[0].id, product.parentGroupId, product.color]
      );
    }
  }

  return savedProducts;
}

export default router;
