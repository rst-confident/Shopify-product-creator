# Multi-stage build for Shopify Product Import App

# Stage 1: Build frontend
FROM node:18-alpine AS frontend-builder

WORKDIR /app/client

# Copy client package files
COPY client/package*.json ./
RUN npm ci

# Copy client source
COPY client/ ./

# Build frontend
RUN npm run build

# Stage 2: Build backend
FROM node:18-alpine AS backend-builder

WORKDIR /app/server

# Copy server package files
COPY package*.json ./
COPY server/package*.json ./
RUN npm ci --only=production

# Stage 3: Production image
FROM node:18-alpine

# Install PostgreSQL client for database migrations
RUN apk add --no-cache postgresql-client

WORKDIR /app

# Copy backend dependencies
COPY --from=backend-builder /app/node_modules ./node_modules
COPY --from=backend-builder /app/server/node_modules ./server/node_modules

# Copy backend source
COPY server ./server
COPY package*.json ./

# Copy frontend build
COPY --from=frontend-builder /app/client/dist ./client/dist

# Create logs directory
RUN mkdir -p logs && chmod 777 logs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start the application
CMD ["node", "server/index.js"]
