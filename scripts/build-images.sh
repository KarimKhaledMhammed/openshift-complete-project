#!/bin/bash
set -e

# Define image registry/user (local for now)
REGISTRY="localhost"

# Resolve script directory and project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "🏗️  Building Bookstore Images..."

# Backend
echo "📦 Building Backend..."
podman build -t bookstore-backend:v1.0 "$PROJECT_ROOT/backend"

# Frontend
echo "📦 Building Frontend..."
podman build -t bookstore-frontend:v1.0 "$PROJECT_ROOT/frontend"

# Database
echo "📦 Building Database..."
podman build -t bookstore-database:v1.0 "$PROJECT_ROOT/database"

echo "✅ All images built successfully!"
podman images | grep bookstore
