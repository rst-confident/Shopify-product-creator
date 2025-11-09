/**
 * Background jobs for cleanup and maintenance
 */

import { query } from '../db';
import logger from '../utils/logger';
import { SESSION_CLEANUP_INTERVAL_MS } from '../utils/constants';

/**
 * Clean up expired sessions from database
 */
export async function cleanupExpiredSessions(): Promise<void> {
  try {
    const result = await query('DELETE FROM sessions WHERE expires < NOW()');
    if (result.rowCount && result.rowCount > 0) {
      logger.info(`Cleaned up ${result.rowCount} expired sessions`);
    }
  } catch (error) {
    logger.error('Failed to cleanup expired sessions', { error });
  }
}

/**
 * Start all background jobs
 */
export function startBackgroundJobs(): void {
  logger.info('Starting background jobs');

  // Clean up expired sessions every hour
  setInterval(cleanupExpiredSessions, SESSION_CLEANUP_INTERVAL_MS);

  // Run cleanup immediately on startup
  cleanupExpiredSessions();
}
