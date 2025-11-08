import express from 'express';
import { AuthRequest, verifyRequest } from '../middleware/auth';
import { query } from '../db';
import shopify from '../shopify/config';

const router = express.Router();

interface MappedProduct {
  title: string;
  price: number;
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

// Process CSV data with mappings
router.post('/', verifyRequest, async (req: AuthRequest, res) => {
  try {
    const { fileId, mappings, records, supplierName } = req.body;

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
      mappedProducts.map((p) => p.ean).filter(Boolean)
    );

    // Get existing SKUs from queue and Shopify
    const existingSKUs = await getExistingSKUs(req.storeId!, req.accessToken!, req.shop!);

    let skuCounter = existingSKUs.maxCounter || 1000;

    // Process each product
    const processedProducts = [];
    const duplicates = [];

    for (const product of mappedProducts) {
      // Check for duplicate EAN
      if (product.ean && existingEANs.includes(product.ean)) {
        duplicates.push({
          title: product.title,
          ean: product.ean,
          reason: 'EAN already exists in Shopify',
        });
        continue;
      }

      // Assign SKU if not provided
      if (!product.sku) {
        skuCounter++;
        product.sku = `SKU${skuCounter}`;
      }

      // Combine description fields
      const descriptionParts = [];
      if (product.description_fabric) descriptionParts.push(`Fabric: ${product.description_fabric}`);
      if (product.description_material) descriptionParts.push(`Material: ${product.description_material}`);
      if (product.description_quality) descriptionParts.push(`Quality: ${product.description_quality}`);
      if (product.description_fit) descriptionParts.push(`Fit: ${product.description_fit}`);
      if (product.description_style) descriptionParts.push(`Style: ${product.description_style}`);
      if (product.description_care) descriptionParts.push(`Care: ${product.description_care}`);
      if (product.description_generic) descriptionParts.push(product.description_generic);

      const description = descriptionParts.join('\n\n');

      // Collect image URLs
      const imageUrls = [
        product.image_url_1,
        product.image_url_2,
        product.image_url_3,
      ].filter(Boolean);

      // Create parent group ID for variants (based on title without color)
      const baseTitle = product.title.replace(/\s*(black|white|red|blue|green|yellow|pink|purple|grey|gray|brown|orange|beige|navy|cream)\s*/gi, '').trim();
      const parentGroupId = baseTitle.toLowerCase().replace(/\s+/g, '-');

      processedProducts.push({
        title: product.title,
        price: parseFloat(product.price) || 0,
        ean: product.ean || null,
        sku: product.sku,
        color: product.color || null,
        imageUrls,
        description,
        parentGroupId,
      });
    }

    // Group products by parent group (for variants)
    const productGroups = new Map<string, any[]>();
    processedProducts.forEach((product) => {
      const group = productGroups.get(product.parentGroupId) || [];
      group.push(product);
      productGroups.set(product.parentGroupId, group);
    });

    // Save to queue
    const savedProducts = [];
    for (const product of processedProducts) {
      const result = await query(
        `INSERT INTO products_queue
         (uploaded_file_id, store_id, supplier_name, product_title, price, ean, sku, color, image_urls, description, parent_group_id, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'pending')
         RETURNING id`,
        [
          fileId,
          req.storeId,
          supplierName,
          product.title,
          product.price,
          product.ean,
          product.sku,
          product.color,
          JSON.stringify(product.imageUrls),
          product.description,
          product.parentGroupId,
        ]
      );

      savedProducts.push({
        id: result.rows[0].id,
        ...product,
      });

      // Create variant record if color exists
      if (product.color) {
        await query(
          `INSERT INTO product_variants (product_queue_id, parent_group_id, variant_type, variant_value)
           VALUES ($1, $2, 'color', $3)`,
          [result.rows[0].id, product.parentGroupId, product.color]
        );
      }
    }

    // Update file status
    await query(
      'UPDATE uploaded_files SET status = $1 WHERE id = $2',
      ['processed', fileId]
    );

    res.json({
      success: true,
      summary: {
        totalRows: records.length,
        productsReady: savedProducts.length,
        duplicatesSkipped: duplicates.length,
        productFamilies: productGroups.size,
      },
      duplicates,
      products: savedProducts,
    });
  } catch (error) {
    console.error('Process error:', error);
    res.status(500).json({ error: 'Failed to process products' });
  }
});

// Check for duplicate EANs in Shopify
async function checkDuplicateEANs(
  accessToken: string,
  shop: string,
  eans: string[]
): Promise<string[]> {
  try {
    if (eans.length === 0) return [];

    const client = new shopify.clients.Graphql({ session: { accessToken, shop } as any });

    // Query in batches of 50
    const existingEANs: string[] = [];
    for (let i = 0; i < eans.length; i += 50) {
      const batch = eans.slice(i, i + 50);
      const barcodeQuery = batch.map((ean) => `barcode:${ean}`).join(' OR ');

      const response: any = await client.query({
        data: {
          query: `{
            productVariants(first: 50, query: "${barcodeQuery}") {
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
    }

    return existingEANs;
  } catch (error) {
    console.error('Error checking duplicate EANs:', error);
    return [];
  }
}

// Get existing SKUs from queue and Shopify
async function getExistingSKUs(
  storeId: number,
  accessToken: string,
  shop: string
): Promise<{ skus: string[]; maxCounter: number }> {
  try {
    // Get SKUs from queue
    const queueResult = await query(
      'SELECT sku FROM products_queue WHERE store_id = $1 AND sku IS NOT NULL',
      [storeId]
    );

    const skus = queueResult.rows.map((row) => row.sku);

    // Extract max counter from SKUs like "SKU1001", "SKU1002"
    let maxCounter = 1000;
    skus.forEach((sku) => {
      const match = sku.match(/SKU(\d+)/);
      if (match) {
        const counter = parseInt(match[1], 10);
        if (counter > maxCounter) {
          maxCounter = counter;
        }
      }
    });

    return { skus, maxCounter };
  } catch (error) {
    console.error('Error getting existing SKUs:', error);
    return { skus: [], maxCounter: 1000 };
  }
}

export default router;
