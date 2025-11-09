/**
 * Application-wide constants
 * Replaces magic numbers throughout the codebase
 */

// File Upload
export const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
export const MAX_FILE_SIZE_MB = 5;
export const MAX_CSV_ROWS = 10000;
export const ALLOWED_FILE_TYPES = ['text/csv', 'application/vnd.ms-excel'];

// SKU Generation
export const INITIAL_SKU_COUNTER = 1000;
export const SKU_PREFIX = 'SKU';

// Shopify API
export const SHOPIFY_QUERY_BATCH_SIZE = 50;
export const SHOPIFY_MAX_VARIANTS_PER_PRODUCT = 100;

// Database
export const DB_POOL_MAX_SIZE = 20;
export const DB_POOL_IDLE_TIMEOUT_MS = 30000;
export const DB_POOL_CONNECTION_TIMEOUT_MS = 2000;

// Session
export const SESSION_SECRET_MIN_LENGTH = 32;
export const SESSION_CLEANUP_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

// API Rate Limiting
export const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
export const RATE_LIMIT_MAX_REQUESTS = 100;

// Retry Configuration
export const MAX_RETRY_ATTEMPTS = 3;
export const RETRY_BACKOFF_BASE_MS = 1000; // 1 second

// AI/OpenRouter
export const AI_MAX_TOKENS = 2000;
export const AI_TEMPERATURE = 0.1;
export const AI_REQUEST_TIMEOUT_MS = 60000; // 60 seconds

// Sample Data
export const SAMPLE_DATA_ROWS = 3;

// Input Validation
export const MAX_SUPPLIER_NAME_LENGTH = 100;
export const MAX_PRODUCT_TITLE_LENGTH = 500;
export const MIN_PRICE = 0.01;
export const MAX_PRICE = 999999.99;

// Colors - Comprehensive list for detection
export const COMMON_COLORS = [
  'black', 'white', 'red', 'blue', 'green', 'yellow', 'pink', 'purple',
  'grey', 'gray', 'brown', 'orange', 'beige', 'navy', 'cream', 'maroon',
  'olive', 'lime', 'aqua', 'teal', 'silver', 'gold', 'fuchsia', 'magenta',
  'violet', 'indigo', 'turquoise', 'tan', 'khaki', 'coral', 'salmon',
  'burgundy', 'charcoal', 'ivory', 'pearl', 'jade', 'amber', 'rose',
  'wine', 'chocolate', 'mint', 'lavender', 'peach', 'plum', 'emerald',
  'sapphire', 'ruby', 'bronze', 'copper', 'crimson', 'scarlet',
  // Multi-word colors
  'navy blue', 'dark red', 'light blue', 'dark green', 'light green',
  'dark grey', 'light grey', 'dark gray', 'light gray', 'dark brown',
  'light brown', 'dark purple', 'light purple', 'royal blue', 'sky blue',
  'forest green', 'lime green', 'bright red', 'bright blue', 'bright green',
  'pale pink', 'hot pink', 'deep purple', 'bright yellow', 'golden yellow',
  'off white', 'pure white', 'jet black', 'coal black', 'midnight blue'
];

// UX Timing
export const SUCCESS_MESSAGE_DURATION_MS = 10000; // 10 seconds
export const LOADING_DEBOUNCE_MS = 300;
