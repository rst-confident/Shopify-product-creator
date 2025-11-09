import { Pool, PoolClient } from 'pg';
import logger from '../utils/logger';
import {
  DB_POOL_MAX_SIZE,
  DB_POOL_IDLE_TIMEOUT_MS,
  DB_POOL_CONNECTION_TIMEOUT_MS,
} from '../utils/constants';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
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
