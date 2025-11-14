import { Pool, PoolClient } from 'pg';
import logger from '../utils/logger';
import {
  DB_POOL_MAX_SIZE,
  DB_POOL_IDLE_TIMEOUT_MS,
  DB_POOL_CONNECTION_TIMEOUT_MS,
} from '../utils/constants';

// Determine SSL configuration
// Only use SSL if explicitly enabled via DATABASE_SSL=true
// This allows local Docker PostgreSQL to work without SSL
const sslConfig = process.env.DATABASE_SSL === 'true'
  ? { rejectUnauthorized: false }
  : false;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: sslConfig,
  max: DB_POOL_MAX_SIZE,
  idleTimeoutMillis: DB_POOL_IDLE_TIMEOUT_MS,
  connectionTimeoutMillis: DB_POOL_CONNECTION_TIMEOUT_MS,
});

export const query = async (text: string, params?: any[]) => {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    logger.debug('Database query executed', { duration, rows: res.rowCount });
    return res;
  } catch (error) {
    logger.error('Database query error', { error, query: text });
    throw error;
  }
};

export const getClient = async (): Promise<PoolClient> => {
  const client = await pool.connect();
  return client;
};

export default pool;
