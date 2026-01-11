#!/bin/bash
set -e

# Resolve script directory and project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "🏗️  Building images on OpenShift..."

# Ensure we are logged in and in the correct project
PROJECT_NAME="bookstore-project"
oc project "$PROJECT_NAME"

# Function to create build config and start build
setup_build() {
    APP_NAME=$1
    DIR_NAME=$2
    TAG="v1.0"
    
    echo ""
    echo "📦 Building $APP_NAME..."
    
    # Create ImageStream if not exists
    oc create is "$APP_NAME" 2>/dev/null || echo "   ImageStream already exists"
    
    # Create BuildConfig (Binary input, Docker strategy)
    oc delete bc "$APP_NAME" 2>/dev/null || true
    oc new-build --name "$APP_NAME" --strategy=docker --binary --to="$APP_NAME:$TAG" >/dev/null
    
    echo "   Uploading source from $DIR_NAME..."
    oc start-build "$APP_NAME" --from-dir="$PROJECT_ROOT/$DIR_NAME" --follow
}

# Backend (Node.js)
setup_build "bookstore-backend" "backend"

# Frontend (Nginx)
setup_build "bookstore-frontend" "frontend"

# Database (MySQL 8.0)
setup_build "bookstore-database" "database"

echo ""
echo "✅ All images built successfully!"
echo ""
echo "📋 Image Summary:"
echo "   - bookstore-backend:v1.0  (Node.js 18)"
echo "   - bookstore-frontend:v1.0 (Nginx)"
echo "   - bookstore-database:v1.0 (MySQL 8.0)"
echo ""
echo "Next step: Run './scripts/deploy-openshift.sh' to deploy"
