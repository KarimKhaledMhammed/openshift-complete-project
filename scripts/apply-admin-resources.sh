#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "🔐 Applying admin-level resources to OpenShift..."
echo ""
echo "⚠️  NOTE: This script requires cluster-admin privileges"
echo "   If you're using CRC, login with: oc login -u kubeadmin"
echo ""

# Check if we're logged in
if ! oc whoami &>/dev/null; then
    echo "❌ Not logged in to OpenShift"
    echo "   Please login first: oc login"
    exit 1
fi

# Check current user
CURRENT_USER=$(oc whoami)
echo "📋 Current user: $CURRENT_USER"
echo ""

# Ensure we're in the correct project
oc project bookstore-project

echo "📦 Applying admin resources..."
echo "   - ResourceQuota (namespace limits)"
echo "   - LimitRange (default container limits)"
echo ""

# Apply admin resources
oc apply -k "$PROJECT_ROOT/openshift/admin"

echo ""
echo "✅ Admin resources applied successfully!"
echo ""
echo "📊 Verify with:"
echo "   oc get resourcequota -n bookstore-project"
echo "   oc get limitrange -n bookstore-project"
echo "   oc describe resourcequota bookstore-quota -n bookstore-project"
echo ""
