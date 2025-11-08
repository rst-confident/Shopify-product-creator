import express from 'express';
import { AuthRequest, verifyRequest } from '../middleware/auth';
import { query } from '../db';
import shopify from '../shopify/config';

const router = express.Router();

interface QueueProduct {
  id: number;
  title: string;
  price: number;
  ean: string | null;
  sku: string;
  color: string | null;
  imageUrls: string[];
  description: string;
  parentGroupId: string;
}

// Import selected products to Shopify
router.post('/', verifyRequest, async (req: AuthRequest, res) => {
  try {
    const { productIds, publishStatus = 'draft' } = req.body;

    if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
      return res.status(400).json({ error: 'Product IDs required' });
    }

    // Get products from queue
    const result = await query(
      `SELECT
         id, product_title as title, price, ean, sku, color,
         image_urls as "imageUrls", description, parent_group_id as "parentGroupId"
       FROM products_queue
       WHERE id = ANY($1) AND store_id = $2 AND status = 'pending'`,
      [productIds, req.storeId]
    );

    const products: QueueProduct[] = result.rows;

    if (products.length === 0) {
      return res.status(404).json({ error: 'No products found to import' });
    }

    // Group products by parent group ID (for variants)
    const productGroups = new Map<string, QueueProduct[]>();
    products.forEach((product) => {
      const group = productGroups.get(product.parentGroupId) || [];
      group.push(product);
      productGroups.set(product.parentGroupId, group);
    });

    const client = new shopify.clients.Graphql({ session: { accessToken: req.accessToken, shop: req.shop } as any });

    const successfulImports: number[] = [];
    const failedImports: Array<{ productId: number; title: string; error: string }> = [];

    // Import each product group
    for (const [parentGroupId, groupProducts] of productGroups.entries()) {
      try {
        if (groupProducts.length === 1 && !groupProducts[0].color) {
          // Single product without variants
          await importSingleProduct(client, groupProducts[0], publishStatus);
          successfulImports.push(groupProducts[0].id);
        } else {
          // Product with color variants
          await importProductWithVariants(client, groupProducts, publishStatus);
          groupProducts.forEach((p) => successfulImports.push(p.id));
        }
      } catch (error: any) {
        console.error(`Import error for group ${parentGroupId}:`, error);
        groupProducts.forEach((p) => {
          failedImports.push({
            productId: p.id,
            title: p.title,
            error: error.message || 'Unknown error',
          });
        });
      }
    }

    // Update status of successfully imported products
    if (successfulImports.length > 0) {
      await query(
        `UPDATE products_queue
         SET status = 'imported'
         WHERE id = ANY($1)`,
        [successfulImports]
      );
    }

    res.json({
      success: true,
      summary: {
        totalRequested: productIds.length,
        successful: successfulImports.length,
        failed: failedImports.length,
      },
      failedImports,
    });
  } catch (error) {
    console.error('Import error:', error);
    res.status(500).json({ error: 'Failed to import products' });
  }
});

// Import single product without variants
async function importSingleProduct(
  client: any,
  product: QueueProduct,
  publishStatus: string
) {
  const mutation = `
    mutation productCreate($input: ProductInput!) {
      productCreate(input: $input) {
        product {
          id
          title
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  const input = {
    title: product.title,
    descriptionHtml: product.description.replace(/\n/g, '<br>'),
    status: publishStatus.toUpperCase(),
    variants: [
      {
        price: product.price.toString(),
        sku: product.sku,
        barcode: product.ean || undefined,
        inventoryPolicy: 'DENY',
      },
    ],
  };

  // Add images if available
  if (product.imageUrls && product.imageUrls.length > 0) {
    input.images = product.imageUrls.map((url: string) => ({ src: url }));
  }

  const response: any = await client.query({
    data: {
      query: mutation,
      variables: { input },
    },
  });

  if (response.body.data.productCreate.userErrors.length > 0) {
    throw new Error(response.body.data.productCreate.userErrors[0].message);
  }
}

// Import product with color variants
async function importProductWithVariants(
  client: any,
  products: QueueProduct[],
  publishStatus: string
) {
  // Use first product as base
  const baseProduct = products[0];

  // Remove color from title for base product
  const baseTitle = baseProduct.title
    .replace(/\s*(black|white|red|blue|green|yellow|pink|purple|grey|gray|brown|orange|beige|navy|cream)\s*/gi, '')
    .trim();

  const mutation = `
    mutation productCreate($input: ProductInput!) {
      productCreate(input: $input) {
        product {
          id
          title
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  // Create variants for each color
  const variants = products.map((product) => ({
    price: product.price.toString(),
    sku: product.sku,
    barcode: product.ean || undefined,
    inventoryPolicy: 'DENY',
    options: product.color ? [product.color] : undefined,
  }));

  const input = {
    title: baseTitle,
    descriptionHtml: baseProduct.description.replace(/\n/g, '<br>'),
    status: publishStatus.toUpperCase(),
    options: ['Color'],
    variants,
  };

  // Add images from first product
  if (baseProduct.imageUrls && baseProduct.imageUrls.length > 0) {
    input.images = baseProduct.imageUrls.map((url: string) => ({ src: url }));
  }

  const response: any = await client.query({
    data: {
      query: mutation,
      variables: { input },
    },
  });

  if (response.body.data.productCreate.userErrors.length > 0) {
    throw new Error(response.body.data.productCreate.userErrors[0].message);
  }
}

export default router;
