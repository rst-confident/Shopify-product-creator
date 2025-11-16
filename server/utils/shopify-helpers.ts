/**
 * Shopify API Helper Functions
 *
 * This module provides direct GraphQL API access to Shopify stores.
 * No Shopify SDK required - uses store-specific access tokens only.
 */

import axios from 'axios';
import logger from './logger';
import { retryWithBackoff } from './retry';

// Shopify API version
const SHOPIFY_API_VERSION = '2024-01';

/**
 * Make a direct GraphQL API call to Shopify
 * @param accessToken - Store-specific Shopify access token
 * @param shop - Shop domain (e.g., "mystore.myshopify.com")
 * @param query - GraphQL query or mutation
 * @param variables - GraphQL variables
 * @returns GraphQL response data
 */
async function shopifyGraphQL(
  accessToken: string,
  shop: string,
  query: string,
  variables?: any
): Promise<any> {
  const url = `https://${shop}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`;

  const response = await axios.post(
    url,
    { query, variables },
    {
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json',
      },
    }
  );

  if (response.data.errors) {
    throw new Error(`Shopify GraphQL errors: ${JSON.stringify(response.data.errors)}`);
  }

  return response.data;
}

export interface ShopifyProduct {
  id: string;
  title: string;
  description?: string;
  variants: ShopifyVariant[];
  images?: Array<{ src: string }>;
}

export interface ShopifyVariant {
  id: string;
  sku: string;
  barcode: string | null;
  price: string;
  inventoryQuantity?: number;
  selectedOptions: Array<{ name: string; value: string }>;
}

export interface VariantSearchResult {
  variantId: string;
  productId: string;
  productTitle: string;
  sku: string;
  price: string;
  inventoryQuantity: number;
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
    const response = await retryWithBackoff(
      () => shopifyGraphQL(accessToken, shop, query, { query: `title:*${searchQuery}*` }),
      3,
      `Search Shopify products: ${searchQuery}`
    );

    const products = response.data.products.edges.map((edge: any) => ({
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
    const response = await retryWithBackoff(
      () => shopifyGraphQL(accessToken, shop, query, { first: Math.min(limit, 250) }),
      3,
      'Get all Shopify products'
    );

    const products = response.data.products.edges.map((edge: any) => ({
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
    const response = await retryWithBackoff(
      () => shopifyGraphQL(accessToken, shop, mutation, {
        productId,
        variants: variantInputs,
      }),
      3,
      `Add variants to product ${productId}`
    );

    const result = response.data.productVariantsBulkCreate;

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
    const response = await retryWithBackoff(
      () => shopifyGraphQL(accessToken, shop, mutation, { input }),
      3,
      `Create product: ${product.title}`
    );

    const result = response.data.productCreate;

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

/**
 * Search Shopify for existing product variant by SKU
 * @param accessToken - Shopify access token
 * @param shop - Shop domain
 * @param sku - SKU to search for
 * @returns Variant details if found, null otherwise
 */
export async function searchShopifyProductBySKU(
  accessToken: string,
  shop: string,
  sku: string
): Promise<VariantSearchResult | null> {
  const query = `
    query searchProductsBySKU($query: String!) {
      productVariants(first: 1, query: $query) {
        edges {
          node {
            id
            sku
            price
            inventoryQuantity
            product {
              id
              title
            }
          }
        }
      }
    }
  `;

  try {
    const response = await retryWithBackoff(
      () => shopifyGraphQL(accessToken, shop, query, { query: `sku:${sku}` }),
      3,
      `Search Shopify by SKU: ${sku}`
    );

    const edges = response.data.productVariants.edges;

    if (edges.length === 0) {
      logger.debug('SKU not found in Shopify', { sku });
      return null;
    }

    const variant = edges[0].node;

    logger.info('Found existing variant by SKU', {
      sku,
      variantId: variant.id,
      productId: variant.product.id,
    });

    return {
      variantId: variant.id,
      productId: variant.product.id,
      productTitle: variant.product.title,
      sku: variant.sku,
      price: variant.price,
      inventoryQuantity: variant.inventoryQuantity || 0,
    };
  } catch (error) {
    logger.error('Failed to search Shopify by SKU', { error, sku });
    throw error;
  }
}

/**
 * Update existing Shopify product (full update)
 * @param accessToken - Shopify access token
 * @param shop - Shop domain
 * @param productId - Shopify product ID
 * @param updates - Product fields to update
 */
export async function updateShopifyProduct(
  accessToken: string,
  shop: string,
  productId: string,
  updates: {
    title?: string;
    description?: string;
    variants?: Array<{
      id: string;
      price?: string;
      sku?: string;
    }>;
    images?: Array<{ src: string }>;
  }
): Promise<void> {
  const mutation = `
    mutation productUpdate($input: ProductInput!) {
      productUpdate(input: $input) {
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

  const input: any = { id: productId };

  if (updates.title) input.title = updates.title;
  if (updates.description) input.descriptionHtml = updates.description.replace(/\n/g, '<br>');
  if (updates.variants) input.variants = updates.variants;
  if (updates.images) input.images = updates.images;

  try {
    const response = await retryWithBackoff(
      () => shopifyGraphQL(accessToken, shop, mutation, { input }),
      3,
      `Update product ${productId}`
    );

    const result = response.data.productUpdate;

    if (result.userErrors && result.userErrors.length > 0) {
      const errorMessage = result.userErrors.map((e: any) => e.message).join(', ');
      throw new Error(`Shopify API error: ${errorMessage}`);
    }

    logger.info('Updated Shopify product', { productId });
  } catch (error) {
    logger.error('Failed to update Shopify product', { error, productId });
    throw error;
  }
}

/**
 * Update variant inventory level only
 * @param accessToken - Shopify access token
 * @param shop - Shop domain
 * @param variantId - Shopify variant ID
 * @param inventoryQuantity - New inventory quantity
 */
export async function updateVariantInventory(
  accessToken: string,
  shop: string,
  variantId: string,
  inventoryQuantity: number
): Promise<void> {
  // First, get the inventory item ID
  const queryInventoryItem = `
    query getInventoryItem($id: ID!) {
      productVariant(id: $id) {
        inventoryItem {
          id
        }
      }
    }
  `;

  try {
    const inventoryResponse = await retryWithBackoff(
      () => shopifyGraphQL(accessToken, shop, queryInventoryItem, { id: variantId }),
      3,
      `Get inventory item for variant ${variantId}`
    );

    const inventoryItemId = inventoryResponse.data.productVariant.inventoryItem.id;

    // Get the first location
    const queryLocation = `
      query {
        locations(first: 1) {
          edges {
            node {
              id
            }
          }
        }
      }
    `;

    const locationResponse = await retryWithBackoff(
      () => shopifyGraphQL(accessToken, shop, queryLocation),
      3,
      'Get first location'
    );

    const locationId = locationResponse.data.locations.edges[0].node.id;

    // Update inventory
    const mutation = `
      mutation inventoryAdjustQuantity($input: InventoryAdjustQuantityInput!) {
        inventoryAdjustQuantity(input: $input) {
          inventoryLevel {
            id
            available
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    const adjustResponse = await retryWithBackoff(
      () => shopifyGraphQL(accessToken, shop, mutation, {
        input: {
          inventoryLevelId: `gid://shopify/InventoryLevel/${inventoryItemId.split('/').pop()}?inventory_item_id=${inventoryItemId.split('/').pop()}`,
          availableDelta: inventoryQuantity,
        },
      }),
      3,
      `Update inventory for variant ${variantId}`
    );

    const result = adjustResponse.data.inventoryAdjustQuantity;

    if (result.userErrors && result.userErrors.length > 0) {
      const errorMessage = result.userErrors.map((e: any) => e.message).join(', ');
      throw new Error(`Shopify API error: ${errorMessage}`);
    }

    logger.info('Updated variant inventory', { variantId, inventoryQuantity });
  } catch (error) {
    logger.error('Failed to update variant inventory', { error, variantId, inventoryQuantity });
    throw error;
  }
}

/**
 * Update product metafields (for preorder info)
 * @param accessToken - Shopify access token
 * @param shop - Shop domain
 * @param productId - Shopify product ID
 * @param metafields - Metafields to set
 */
export async function updateProductMetafields(
  accessToken: string,
  shop: string,
  productId: string,
  metafields: Array<{
    namespace: string;
    key: string;
    type: string;
    value: string;
  }>
): Promise<void> {
  const mutation = `
    mutation metafieldsSet($metafields: [MetafieldsSetInput!]!) {
      metafieldsSet(metafields: $metafields) {
        metafields {
          id
          namespace
          key
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  const metafieldInputs = metafields.map((mf) => ({
    ownerId: productId,
    namespace: mf.namespace,
    key: mf.key,
    type: mf.type,
    value: mf.value,
  }));

  try {
    const response = await retryWithBackoff(
      () => shopifyGraphQL(accessToken, shop, mutation, { metafields: metafieldInputs }),
      3,
      `Update metafields for product ${productId}`
    );

    const result = response.data.metafieldsSet;

    if (result.userErrors && result.userErrors.length > 0) {
      const errorMessage = result.userErrors.map((e: any) => e.message).join(', ');
      throw new Error(`Shopify API error: ${errorMessage}`);
    }

    logger.info('Updated product metafields', { productId, metafieldCount: metafields.length });
  } catch (error) {
    logger.error('Failed to update product metafields', { error, productId });
    throw error;
  }
}
