#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "🏃 Running Bookstore Application Locally..."

# Check if Podman is running
if ! podman info >/dev/null 2>&1; then
    echo "❌ Podman is not running. Please start Podman first."
    exit 1
fi

# Stop and remove existing containers
echo "🧹 Cleaning up existing containers..."
podman stop frontend backend redis mysql 2>/dev/null || true
podman rm frontend backend redis mysql 2>/dev/null || true
podman network rm bookstore-net 2>/dev/null || true

# Create network
echo "🌐 Creating network..."
podman network create bookstore-net

# Build images
echo "🏗️  Building images..."
podman build -t bookstore-database:v1.0 "$PROJECT_ROOT/database"
podman build -t bookstore-backend:v1.0 "$PROJECT_ROOT/backend"
podman build -t bookstore-frontend:v1.0 "$PROJECT_ROOT/frontend"

# Start MySQL
echo "🚀 Starting MySQL..."
podman run -d --name mysql --network bookstore-net \
  -e MYSQL_ROOT_PASSWORD=securepassword123 \
  -e MYSQL_DATABASE=bookstore \
  -e MYSQL_USER=bookstore \
  -e MYSQL_PASSWORD=securepassword123 \
  -p 3306:3306 \
  bookstore-database:v1.0

# Wait for MySQL to initialize
echo "⏳ Waiting for MySQL 8.0 to initialize..."
sleep 15

# Start Redis
echo "🚀 Starting Redis..."
podman run -d --name redis --network bookstore-net \
  -p 6379:6379 \
  redis:7.0-alpine

# Start Backend
echo "🚀 Starting Backend..."
podman run -d --name backend --network bookstore-net \
  -e DB_HOST=mysql \
  -e DB_USER=bookstore \
  -e DB_PASSWORD=securepassword123 \
  -e DB_NAME=bookstore \
  -e REDIS_HOST=redis \
  -p 3000:3000 \
  bookstore-backend:v1.0

# Start Frontend
echo "🚀 Starting Frontend..."
podman run -d --name frontend --network bookstore-net \
  -p 8080:8080 \
  bookstore-frontend:v1.0

# Check service status
echo ""
echo "📊 Service Status:"
podman ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

echo ""
echo "✅ Application is running!"
echo ""
echo "🌐 Access the application:"
echo "   Frontend: http://localhost:8080"
echo "   Backend API: http://localhost:3000"
echo "   MySQL: localhost:3306 (user: bookstore, password: securepassword123)"
echo "   Redis: localhost:6379"
echo ""
echo "📝 View logs:"
echo "   podman logs -f backend"
echo "   podman logs -f mysql"
echo ""
echo "🛑 Stop services:"
echo "   podman stop frontend backend redis mysql"
echo "   podman rm frontend backend redis mysql"
echo "   podman network rm bookstore-net"
