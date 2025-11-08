import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { createServer } from 'http';

// Load environment variables
dotenv.config();

// Import routes
import authRoutes from './routes/auth';
import settingsRoutes from './routes/settings';
import uploadRoutes from './routes/upload';
import mappingRoutes from './routes/mapping';
import processRoutes from './routes/process';
import queueRoutes from './routes/queue';
import importRoutes from './routes/import';

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
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

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Server error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

// Start server
const server = createServer(app);

server.listen(PORT, () => {
  console.log(`
🚀 Shopify Product Import Server
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Environment: ${process.env.NODE_ENV || 'development'}
Port: ${PORT}
Host: ${process.env.HOST || 'localhost'}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  `);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing HTTP server');
  server.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});

export default app;
