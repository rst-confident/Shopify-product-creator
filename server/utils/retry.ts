/**
 * Retry utilities with exponential backoff
 */

import logger from './logger';
import { MAX_RETRY_ATTEMPTS, RETRY_BACKOFF_BASE_MS } from './constants';

/**
 * Retry a function with exponential backoff
 * @param fn Function to retry
 * @param maxRetries Maximum number of retry attempts
 * @param context Description for logging
 * @returns Result of the function
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = MAX_RETRY_ATTEMPTS,
  context: string = 'operation'
): Promise<T> {
  let lastError: Error;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;

      // Don't retry on client errors (4xx)
      if (error.response?.status >= 400 && error.response?.status < 500) {
        throw error;
      }

      if (attempt < maxRetries - 1) {
        const delay = RETRY_BACKOFF_BASE_MS * Math.pow(2, attempt);
        logger.warn(`${context} failed, retrying in ${delay}ms`, {
          attempt: attempt + 1,
          maxRetries,
          error: error.message,
        });
        await sleep(delay);
      }
    }
  }

  logger.error(`${context} failed after ${maxRetries} attempts`, {
    error: lastError!.message,
  });
  throw lastError!;
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Retry axios requests specifically
 */
export function configureAxiosRetry(axios: any): void {
  const axiosRetry = require('axios-retry');

  axiosRetry(axios, {
    retries: MAX_RETRY_ATTEMPTS,
    retryDelay: (retryCount: number) => {
      return RETRY_BACKOFF_BASE_MS * Math.pow(2, retryCount - 1);
    },
    retryCondition: (error: any) => {
      // Retry on network errors or 5xx responses
      return (
        axiosRetry.isNetworkOrIdempotentRequestError(error) ||
        (error.response?.status >= 500 && error.response?.status < 600)
      );
    },
  });
}
