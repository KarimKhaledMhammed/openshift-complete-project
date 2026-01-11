#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "🚀 Deploying to OpenShift..."

# Ensure we're in the correct project
oc project bookstore-project

# Apply base resources (includes MySQL, backend, frontend, redis)
echo "📦 Applying base resources..."
oc apply -k "$PROJECT_ROOT/openshift/base"

# Wait for MySQL to initialize
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

# Apply security resources
echo "🔒 Applying security policies..."
oc apply -k "$PROJECT_ROOT/openshift/security"

# Apply autoscaling resources
echo "📈 Applying autoscaling configuration..."
oc apply -k "$PROJECT_ROOT/openshift/autoscaling"

echo ""
echo "📊 Pod Status:"
oc get pods -l app=bookstore

echo ""
echo "🌐 Application URL:"
oc get route bookstore -o jsonpath='{.spec.host}' && echo ""
