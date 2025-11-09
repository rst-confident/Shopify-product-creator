import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { createServer } from 'http';
import { mkdirSync } from 'fs';
import rateLimit from 'express-rate-limit';

// Load environment variables
dotenv.config();

// Import utilities
import logger, { requestLogger } from './utils/logger';
import { validateEnvironment } from './utils/validation';
import { RATE_LIMIT_WINDOW_MS, RATE_LIMIT_MAX_REQUESTS } from './utils/constants';
import { startBackgroundJobs } from './jobs/cleanup';

// Validate environment before starting
try {
  validateEnvironment();
  logger.info('Environment validation passed');
} catch (error: any) {
  logger.error('Environment validation failed', { error: error.message });
  console.error('\n❌ Environment validation failed:');
  console.error(error.message);
  console.error('\nPlease check your .env file and ensure all required variables are set.\n');
  process.exit(1);
}

// Create required directories
mkdirSync('uploads', { recursive: true });
mkdirSync('logs', { recursive: true });

// Import routes
import authRoutes from './routes/auth';
import settingsRoutes from './routes/settings';
import uploadRoutes from './routes/upload';
import mappingRoutes from './routes/mapping';
import processRoutes from './routes/process';
import queueRoutes from './routes/queue';
import importRoutes from './routes/import';
import { query } from './db';

const app = express();
const PORT = process.env.PORT || 3001;

// CORS configuration - Restrict to app domain
app.use(
  cors({
    origin: process.env.SHOPIFY_APP_URL || 'https://produktimport.wemarket.dk',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// Request logging
app.use(requestLogger);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting for API routes
const apiLimiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MS,
  max: RATE_LIMIT_MAX_REQUESTS,
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn('Rate limit exceeded', {
      ip: req.ip,
      path: req.path,
    });
    res.status(429).json({
      error: 'Too many requests, please try again later.',
    });
  },
});

// Apply rate limiting to all API routes
app.use('/api/', apiLimiter);

// Health check endpoint (with database check)
app.get('/health', async (req, res) => {
  try {
    // Check database connection
    await query('SELECT 1');

    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      database: 'connected',
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      version: process.env.npm_package_version || '1.0.0',
    });
  } catch (error) {
    logger.error('Health check failed', { error });
    res.status(503).json({
      status: 'error',
      message: 'Service unavailable',
      database: 'disconnected',
    });
  }
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/mapping', mappingRoutes);
app.use('/api/process', processRoutes);
app.use('/api/queue', queueRoutes);
app.use('/api/import', importRoutes);

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  const clientPath = path.join(__dirname, '../client');
  app.use(express.static(clientPath));

  app.get('*', (req, res) => {
    res.sendFile(path.join(clientPath, 'index.html'));
  });
}

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Global error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  // Don't leak internal details in production
  const isDevelopment = process.env.NODE_ENV === 'development';

  res.status(err.status || 500).json({
    error: isDevelopment ? err.message : 'An error occurred. Please try again.',
    ...(isDevelopment && { stack: err.stack }),
  });
});

// Start server
const server = createServer(app);

server.listen(PORT, () => {
  logger.info('Server started', {
    environment: process.env.NODE_ENV || 'development',
    port: PORT,
    host: process.env.HOST || 'localhost',
  });

  console.log(`
🚀 Shopify Product Import Server
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Environment: ${process.env.NODE_ENV || 'development'}
Port: ${PORT}
Host: ${process.env.HOST || 'localhost'}
Logs: logs/combined.log
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  `);

  // Start background jobs
  startBackgroundJobs();
});

// Graceful shutdown
const shutdown = async (signal: string) => {
  logger.info(`${signal} signal received: closing HTTP server`);

  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });

  // Force close after 10 seconds
  setTimeout(() => {
    logger.error('Forcefully shutting down after timeout');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', { error });
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection', { reason, promise });
});

export default app;
