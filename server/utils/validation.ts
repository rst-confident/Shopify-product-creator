/**
 * Input validation utilities using Joi
 */

import Joi from 'joi';
import {
  MAX_SUPPLIER_NAME_LENGTH,
  MAX_PRODUCT_TITLE_LENGTH,
  MIN_PRICE,
  MAX_PRICE,
} from './constants';

/**
 * Validate environment variables on startup
 */
export function validateEnvironment(): void {
  // Standalone app - only requires basic environment variables
  // Shopify access tokens are stored per-store in the database
  const requiredEnvVars = [
    'HOST',
    'DATABASE_URL',
    'SESSION_SECRET',
  ];

  const missing: string[] = [];

  requiredEnvVars.forEach((varName) => {
    if (!process.env[varName]) {
      missing.push(varName);
    }
  });

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}\n` +
      `Please check your .env file and ensure all required variables are set.`
    );
  }

  // Validate SESSION_SECRET strength
  if (process.env.SESSION_SECRET!.length < 32) {
    throw new Error(
      'SESSION_SECRET must be at least 32 characters long for security.\n' +
      'Generate a strong secret with: openssl rand -hex 32'
    );
  }
}

/**
 * Sanitize supplier name
 */
export function sanitizeSupplierName(name: string): string {
  // Remove potentially dangerous characters
  const sanitized = name
    .trim()
    .replace(/[<>"']/g, '') // Remove HTML/SQL injection chars
    .substring(0, MAX_SUPPLIER_NAME_LENGTH);

  if (sanitized.length === 0) {
    throw new Error('Supplier name cannot be empty');
  }

  return sanitized;
}

/**
 * Validate price
 */
export function validatePrice(price: any): number {
  const parsed = parseFloat(price);

  if (isNaN(parsed)) {
    throw new Error(`Invalid price: "${price}" is not a number`);
  }

  if (parsed < MIN_PRICE) {
    throw new Error(`Price must be at least ${MIN_PRICE}`);
  }

  if (parsed > MAX_PRICE) {
    throw new Error(`Price cannot exceed ${MAX_PRICE}`);
  }

  return parsed;
}

/**
 * Validate image URL
 */
export function validateImageUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}

/**
 * Filter and validate image URLs
 */
export function filterValidImageUrls(urls: (string | undefined)[]): string[] {
  return urls
    .filter((url): url is string => Boolean(url))
    .filter(validateImageUrl);
}

/**
 * Validate CSV upload request
 */
export const uploadValidationSchema = Joi.object({
  supplierName: Joi.string()
    .trim()
    .min(1)
    .max(MAX_SUPPLIER_NAME_LENGTH)
    .required()
    .messages({
      'string.empty': 'Supplier name is required',
      'string.max': `Supplier name cannot exceed ${MAX_SUPPLIER_NAME_LENGTH} characters`,
    }),
  notes: Joi.string().allow('').optional(),
});

/**
 * Validate mapping request
 */
export const mappingValidationSchema = Joi.object({
  headers: Joi.array().items(Joi.string()).min(1).required(),
  sampleData: Joi.array().items(Joi.object()).min(1).required(),
});

/**
 * Validate process request
 */
export const processValidationSchema = Joi.object({
  fileId: Joi.number().integer().positive().required(),
  mappings: Joi.object().required(),
  records: Joi.array().items(Joi.object()).min(1).required(),
  supplierName: Joi.string().trim().min(1).max(MAX_SUPPLIER_NAME_LENGTH).required(),
});

/**
 * Validate import request
 */
export const importValidationSchema = Joi.object({
  productIds: Joi.array().items(Joi.number().integer().positive()).min(1).required(),
  publishStatus: Joi.string().valid('draft', 'active').default('draft'),
});

/**
 * Validate settings update
 */
export const settingsValidationSchema = Joi.object({
  openrouterApiKey: Joi.string().pattern(/^sk-or-/).optional(),
  selectedModel: Joi.string().optional(),
});
