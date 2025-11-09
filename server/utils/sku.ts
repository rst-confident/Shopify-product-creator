/**
 * SKU Generation and Product Matching Utilities
 */

import { createHash } from 'crypto';
import logger from './logger';

/**
 * Generate a consistent SKU from product attributes
 * @param baseTitle - Product title without color
 * @param color - Color variant (optional)
 * @param supplierName - Supplier name for prefix (optional)
 * @param existingSKU - Existing SKU to preserve (optional)
 * @returns Generated SKU
 */
export function generateSKU(
  baseTitle: string,
  color?: string,
  supplierName?: string,
  existingSKU?: string
): string {
  // If SKU already exists and is meaningful, keep it
  if (existingSKU && !existingSKU.match(/^SKU\d+$/)) {
    return existingSKU;
  }

  // Strategy 1: Acronym-based (recommended for readability)
  const words = baseTitle
    .trim()
    .split(/\s+/)
    .filter(word => word.length > 0);

  let acronym: string;

  if (words.length === 1) {
    // Single word: use first 4 chars
    acronym = words[0].substring(0, 4).toUpperCase();
  } else if (words.length === 2) {
    // Two words: first 2 chars of each
    acronym = words.map(w => w.substring(0, 2)).join('').toUpperCase();
  } else {
    // Multiple words: first char of each (max 6 words)
    acronym = words.slice(0, 6).map(w => w[0]).join('').toUpperCase();
  }

  // Add color code
  let colorCode = '';
  if (color) {
    colorCode = `-${color.substring(0, 3).toUpperCase()}`;
  }

  // Add supplier prefix if provided
  let supplierPrefix = '';
  if (supplierName) {
    const supplierWords = supplierName.trim().split(/\s+/);
    if (supplierWords.length === 1) {
      supplierPrefix = supplierWords[0].substring(0, 3).toUpperCase() + '-';
    } else {
      supplierPrefix = supplierWords.slice(0, 2).map(w => w[0]).join('').toUpperCase() + '-';
    }
  }

  const sku = `${supplierPrefix}${acronym}${colorCode}`;

  // Ensure SKU is not too long (Shopify limit is 255, but keep it reasonable)
  return sku.substring(0, 50);
}

/**
 * Generate multiple SKUs for a group of color variants
 * Ensures all variants of same product have consistent SKU pattern
 *
 * @param products - Array of products with same base title
 * @param supplierName - Supplier name
 * @returns Map of product ID to SKU
 */
export function generateConsistentSKUs(
  products: Array<{ title: string; color?: string; sku?: string }>,
  supplierName?: string
): Map<number, string> {
  const skuMap = new Map<number, string>();

  if (products.length === 0) return skuMap;

  // Get base title (remove color from first product's title)
  const baseTitle = extractBaseTitle(products[0].title, products[0].color);

  products.forEach((product, index) => {
    const sku = generateSKU(baseTitle, product.color, supplierName, product.sku);
    skuMap.set(index, sku);
  });

  return skuMap;
}

/**
 * Extract base product title by removing color
 * @param title - Full product title
 * @param color - Known color (if available)
 * @returns Base title without color
 */
export function extractBaseTitle(title: string, color?: string): string {
  let baseTitle = title.trim();

  // If we know the color, remove it specifically
  if (color) {
    const colorPattern = new RegExp(`\\s*${color}\\s*`, 'gi');
    baseTitle = baseTitle.replace(colorPattern, ' ');
  }

  // Also remove common color words as fallback
  const COMMON_COLORS = [
    'black', 'white', 'red', 'blue', 'green', 'yellow', 'pink', 'purple',
    'grey', 'gray', 'brown', 'orange', 'beige', 'navy', 'cream', 'maroon',
    'olive', 'lime', 'aqua', 'teal', 'silver', 'gold', 'navy blue', 'dark red',
    'light blue', 'dark green', 'light green', 'bright red'
  ];

  const colorPattern = new RegExp(
    `\\b(${COMMON_COLORS.join('|')})\\b`,
    'gi'
  );
  baseTitle = baseTitle.replace(colorPattern, '');

  // Clean up multiple spaces
  return baseTitle.replace(/\s+/g, ' ').trim();
}

/**
 * Generate a unique product identifier for matching
 * Used to determine if two products are the same base product
 *
 * @param title - Product title
 * @param supplierName - Supplier name
 * @returns Unique identifier
 */
export function generateProductIdentifier(
  title: string,
  supplierName?: string
): string {
  const baseTitle = extractBaseTitle(title);
  const normalized = baseTitle.toLowerCase().replace(/[^a-z0-9]/g, '');
  const supplier = supplierName ? supplierName.toLowerCase().replace(/[^a-z0-9]/g, '') : '';

  // Create hash for consistent matching
  const hash = createHash('md5')
    .update(`${supplier}-${normalized}`)
    .digest('hex')
    .substring(0, 16);

  return hash;
}

/**
 * Check if two products are variants of the same base product
 * @param product1 - First product
 * @param product2 - Second product
 * @returns True if they are variants of same product
 */
export function areProductVariants(
  product1: { title: string; supplierName?: string },
  product2: { title: string; supplierName?: string }
): boolean {
  const id1 = generateProductIdentifier(product1.title, product1.supplierName);
  const id2 = generateProductIdentifier(product2.title, product2.supplierName);

  return id1 === id2;
}

/**
 * Match products to existing Shopify products by title similarity
 * @param newProducts - Products to import
 * @param existingProducts - Products already in Shopify
 * @returns Map of new product index to existing Shopify product ID
 */
export function matchToExistingProducts(
  newProducts: Array<{ title: string; color?: string; supplierName?: string }>,
  existingProducts: Array<{ id: string; title: string }>
): Map<number, string> {
  const matches = new Map<number, string>();

  newProducts.forEach((newProduct, index) => {
    const newBaseTitle = extractBaseTitle(newProduct.title, newProduct.color);
    const newNormalized = newBaseTitle.toLowerCase().replace(/[^a-z0-9]/g, '');

    for (const existing of existingProducts) {
      const existingNormalized = existing.title.toLowerCase().replace(/[^a-z0-9]/g, '');

      // Check for exact match or very close match
      if (existingNormalized === newNormalized ||
          calculateSimilarity(newNormalized, existingNormalized) > 0.9) {
        matches.set(index, existing.id);
        logger.info('Matched product to existing Shopify product', {
          newTitle: newProduct.title,
          existingTitle: existing.title,
          existingId: existing.id
        });
        break;
      }
    }
  });

  return matches;
}

/**
 * Calculate similarity between two strings (0-1 scale)
 * Uses Levenshtein distance
 */
function calculateSimilarity(str1: string, str2: string): number {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;

  if (longer.length === 0) return 1.0;

  const editDistance = levenshteinDistance(longer, shorter);
  return (longer.length - editDistance) / longer.length;
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[str2.length][str1.length];
}

/**
 * Examples of generated SKUs:
 *
 * generateSKU("Winter Coat", "Black")           → "WC-BLA"
 * generateSKU("Winter Coat", "Red")             → "WC-RED"
 * generateSKU("Summer Dress", "Blue", "SupplierA") → "SA-SD-BLU"
 * generateSKU("T-Shirt", "White")               → "TSHI-WHI"
 * generateSKU("Leather Jacket Premium", "Brown") → "LJP-BRO"
 */
