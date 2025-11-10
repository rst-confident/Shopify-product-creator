#!/bin/bash

# Shopify Product Import App - Deployment Script
# This script is run on the VM to deploy the latest version

set -e  # Exit on error

echo "========================================"
echo "Shopify Product Import - Deployment"
echo "========================================"
echo ""

# Configuration
APP_DIR="/home/ubuntu/shopify-product-import"
BRANCH="${DEPLOY_BRANCH:-claude/shopify-product-import-mvp-011CUwJS7CQA4qp5h11AL2F3}"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running as ubuntu user
if [ "$USER" != "ubuntu" ]; then
    print_error "This script must be run as the 'ubuntu' user"
    print_status "Switching to ubuntu user..."
    exec sudo -u ubuntu bash "$0" "$@"
fi

# Navigate to app directory
print_status "Navigating to app directory: $APP_DIR"
cd "$APP_DIR"

# Check if .env file exists
if [ ! -f .env ]; then
    print_error ".env file not found!"
    print_status "Creating .env from .env.example..."
    cp .env.example .env
    print_warning "Please configure .env file with your credentials before running the app!"
    exit 1
fi

# Pull latest changes
print_status "Pulling latest changes from branch: $BRANCH"
git fetch origin
git checkout "$BRANCH"
git pull origin "$BRANCH"

# Check if docker-compose is available
if ! command -v docker-compose &> /dev/null; then
    print_error "docker-compose not found! Installing..."
    sudo apt-get update
    sudo apt-get install -y docker-compose
fi

# Stop existing containers
print_status "Stopping existing containers..."
docker-compose down || true

# Remove old images to force rebuild
print_status "Removing old images..."
docker-compose rm -f || true

# Build new images
print_status "Building new Docker images..."
docker-compose build --no-cache

# Start containers
print_status "Starting containers..."
docker-compose up -d

# Wait for services to be healthy
print_status "Waiting for services to be healthy..."
sleep 10

# Check container status
print_status "Checking container status..."
docker-compose ps

# Show logs
print_status "Showing recent logs..."
docker-compose logs --tail=50

echo ""
print_status "Deployment completed successfully!"
echo ""
print_status "Application is running on port 3001"
print_status "Health check: http://localhost:3001/api/health"
echo ""
print_warning "To view logs: cd $APP_DIR && docker-compose logs -f"
print_warning "To restart: cd $APP_DIR && docker-compose restart"
print_warning "To stop: cd $APP_DIR && docker-compose down"
echo ""
