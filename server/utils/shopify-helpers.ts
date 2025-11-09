/**
 * Shopify API Helper Functions
 */

import shopify from '../shopify/config';
import logger from './logger';
import { retryWithBackoff } from './retry';

export interface ShopifyProduct {
  id: string;
  title: string;
  variants: ShopifyVariant[];
}

export interface ShopifyVariant {
  id: string;
  sku: string;
  barcode: string | null;
  price: string;
  selectedOptions: Array<{ name: string; value: string }>;
}

/**
 * Search Shopify for existing products by title
 * @param accessToken - Shopify access token
 * @param shop - Shop domain
 * @param searchQuery - Search query (e.g., "Winter Coat")
 * @returns Array of matching products
 */
export async function searchShopifyProducts(
  accessToken: string,
  shop: string,
  searchQuery: string
): Promise<ShopifyProduct[]> {
  const client = new shopify.clients.Graphql({
    session: { accessToken, shop } as any
  });

  const query = `
    query searchProducts($query: String!) {
      products(first: 50, query: $query) {
        edges {
          node {
            id
            title
            variants(first: 100) {
              edges {
                node {
                  id
                  sku
                  barcode
                  price
                  selectedOptions {
                    name
                    value
                  }
                }
              }
            }
          }
        }
      }
    }
  `;

  try {
    const response: any = await retryWithBackoff(
      () => client.query({
        data: {
          query,
          variables: { query: `title:*${searchQuery}*` },
        },
      }),
      3,
      `Search Shopify products: ${searchQuery}`
    );

    const products = response.body.data.products.edges.map((edge: any) => ({
      id: edge.node.id,
      title: edge.node.title,
      variants: edge.node.variants.edges.map((v: any) => v.node),
    }));

    logger.info('Shopify product search completed', {
      query: searchQuery,
      found: products.length,
    });

    return products;
  } catch (error) {
    logger.error('Failed to search Shopify products', { error, query: searchQuery });
    throw error;
  }
}

/**
 * Get all products from Shopify (paginated)
 * Use sparingly - can be expensive for large catalogs
 * @param accessToken - Shopify access token
 * @param shop - Shop domain
 * @param limit - Maximum products to fetch
 * @returns Array of products
 */
export async function getAllShopifyProducts(
  accessToken: string,
  shop: string,
  limit: number = 250
): Promise<ShopifyProduct[]> {
  const client = new shopify.clients.Graphql({
    session: { accessToken, shop } as any
  });

  const query = `
    query getProducts($first: Int!) {
      products(first: $first) {
        edges {
          node {
            id
            title
            variants(first: 100) {
              edges {
                node {
                  id
                  sku
                  barcode
                  price
                  selectedOptions {
                    name
                    value
                  }
                }
              }
            }
          }
        }
      }
    }
  `;

  try {
    const response: any = await retryWithBackoff(
      () => client.query({
        data: {
          query,
          variables: { first: Math.min(limit, 250) },
        },
      }),
      3,
      'Get all Shopify products'
    );

    const products = response.body.data.products.edges.map((edge: any) => ({
      id: edge.node.id,
      title: edge.node.title,
      variants: edge.node.variants.edges.map((v: any) => v.node),
    }));

    logger.info('Retrieved Shopify products', { count: products.length });

    return products;
  } catch (error) {
    logger.error('Failed to get Shopify products', { error });
    throw error;
  }
}

/**
 * Add variants to existing Shopify product
 * @param accessToken - Shopify access token
 * @param shop - Shop domain
 * @param productId - Shopify product ID
 * @param variants - Variants to add
 * @returns Created variant IDs
 */
export async function addVariantsToProduct(
  accessToken: string,
  shop: string,
  productId: string,
  variants: Array<{
    price: string;
    sku: string;
    barcode?: string;
    options: string[];
  }>
): Promise<string[]> {
  const client = new shopify.clients.Graphql({
    session: { accessToken, shop } as any
  });

  const mutation = `
    mutation productVariantsBulkCreate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
      productVariantsBulkCreate(productId: $productId, variants: $variants) {
        productVariants {
          id
          sku
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  const variantInputs = variants.map((v) => ({
    price: v.price,
    sku: v.sku,
    barcode: v.barcode,
    options: v.options,
    inventoryPolicy: 'DENY',
  }));

  try {
    const response: any = await retryWithBackoff(
      () => client.query({
        data: {
          query: mutation,
          variables: {
            productId,
            variants: variantInputs,
          },
        },
      }),
      3,
      `Add variants to product ${productId}`
    );

    const result = response.body.data.productVariantsBulkCreate;

    if (result.userErrors && result.userErrors.length > 0) {
      const errorMessage = result.userErrors.map((e: any) => e.message).join(', ');
      throw new Error(`Shopify API error: ${errorMessage}`);
    }

    const variantIds = result.productVariants.map((v: any) => v.id);

    logger.info('Added variants to existing product', {
      productId,
      variantCount: variantIds.length,
    });

    return variantIds;
  } catch (error) {
    logger.error('Failed to add variants to product', { error, productId });
    throw error;
  }
}

/**
 * Create new product with variants in Shopify
 * @param accessToken - Shopify access token
 * @param shop - Shop domain
 * @param product - Product data
 * @returns Created product ID
 */
export async function createShopifyProduct(
  accessToken: string,
  shop: string,
  product: {
    title: string;
    description: string;
    status: 'ACTIVE' | 'DRAFT';
    variants: Array<{
      price: string;
      sku: string;
      barcode?: string;
      options?: string[];
    }>;
    options?: string[];
    images?: Array<{ src: string }>;
  }
): Promise<string> {
  const client = new shopify.clients.Graphql({
    session: { accessToken, shop } as any
  });

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

  const input: any = {
    title: product.title,
    descriptionHtml: product.description.replace(/\n/g, '<br>'),
    status: product.status,
    variants: product.variants.map((v) => ({
      price: v.price,
      sku: v.sku,
      barcode: v.barcode,
      options: v.options,
      inventoryPolicy: 'DENY',
    })),
  };

  if (product.options && product.options.length > 0) {
    input.options = product.options;
  }

  if (product.images && product.images.length > 0) {
    input.images = product.images;
  }

  try {
    const response: any = await retryWithBackoff(
      () => client.query({
        data: {
          query: mutation,
          variables: { input },
        },
      }),
      3,
      `Create product: ${product.title}`
    );

    const result = response.body.data.productCreate;

    if (result.userErrors && result.userErrors.length > 0) {
      const errorMessage = result.userErrors.map((e: any) => e.message).join(', ');
      throw new Error(`Shopify API error: ${errorMessage}`);
    }

    const productId = result.product.id;

    logger.info('Created new Shopify product', {
      productId,
      title: product.title,
      variantCount: product.variants.length,
    });

    return productId;
  } catch (error) {
    logger.error('Failed to create Shopify product', { error, title: product.title });
    throw error;
  }
}
