#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Default environment
ENVIRONMENT="${1:-}"

echo "🚀 Deploying to OpenShift..."
echo ""

# If no environment specified, ask user
if [ -z "$ENVIRONMENT" ]; then
    echo "📋 Select deployment environment:"
    echo "   1) dev  - Development (1 replica, lower resources, debug logging)"
    echo "   2) prod - Production (3+ replicas, full resources, autoscaling)"
    echo ""
    read -p "Enter choice (1 or 2): " choice
    
    case $choice in
        1)
            ENVIRONMENT="dev"
            ;;
        2)
            ENVIRONMENT="prod"
            ;;
        *)
            echo "❌ Invalid choice. Please enter 1 or 2."
            exit 1
            ;;
    esac
fi

# Validate environment
if [ "$ENVIRONMENT" != "dev" ] && [ "$ENVIRONMENT" != "prod" ]; then
    echo "❌ Invalid environment: $ENVIRONMENT"
    echo "   Usage: $0 [dev|prod]"
    exit 1
fi

echo ""
echo "🎯 Deploying to: $ENVIRONMENT environment"
echo ""

# Ensure we're in the correct project
oc project bookstore-project

# Determine which overlay to use
if [ "$ENVIRONMENT" = "dev" ]; then
    OVERLAY_PATH="$PROJECT_ROOT/openshift/overlays/dev"
    echo "📦 Applying development configuration..."
    echo "   - Single replica for all services"
    echo "   - Lower resource limits (saves 80% resources)"
    echo "   - Debug logging enabled"
else
    OVERLAY_PATH="$PROJECT_ROOT/openshift/overlays/prod"
    echo "📦 Applying production configuration..."
    echo "   - Multiple replicas (3 for backend/frontend)"
    echo "   - Higher resource limits (4x dev resources)"
    echo "   - Production logging"
    echo "   - Autoscaling enabled (HPA: 3-10)"
fi

echo ""
oc apply -k "$OVERLAY_PATH"

# Wait for MySQL to initialize
echo ""
echo "⏳ Waiting for MySQL 8.0 to initialize..."
sleep 15
oc wait --for=condition=ready pod -l component=database --timeout=120s || true

# Check if MySQL initialized correctly
echo "🔍 Verifying MySQL initialization..."
if oc logs deployment/mysql 2>/dev/null | grep -q "MySQL init process done"; then
    echo "✅ MySQL 8.0 initialized successfully"
    echo "   - Database 'bookstore' created"
    echo "   - User 'bookstore' created with full privileges"
    echo "   - Sample data loaded (8 books)"
else
    echo "⚠️  Warning: MySQL may still be initializing"
    echo "   Check logs with: oc logs deployment/mysql"
fi

# Apply security resources (both environments)
echo ""
echo "🔒 Applying security policies..."
oc apply -k "$PROJECT_ROOT/openshift/security"

# Apply autoscaling (production only)
if [ "$ENVIRONMENT" = "prod" ]; then
    echo ""
    echo "📈 Applying autoscaling configuration..."
    oc apply -k "$PROJECT_ROOT/openshift/autoscaling"
else
    echo ""
    echo "ℹ️  Skipping autoscaling (dev environment uses fixed replicas)"
fi

echo ""
echo "📊 Pod Status:"
oc get pods -l app=bookstore

echo ""
echo "🌐 Application URL:"
oc get route bookstore -o jsonpath='{.spec.host}' && echo ""

echo ""
echo "✅ Deployment complete!"
echo ""
echo "📝 Quick commands:"
echo "   View logs:    oc logs -f deployment/backend"
echo "   Check status: oc get pods -l app=bookstore"
echo "   Scale up:     oc scale deployment/backend --replicas=3"
echo ""
