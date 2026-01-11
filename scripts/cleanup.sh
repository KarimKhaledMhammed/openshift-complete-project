#!/bin/bash
set -e

echo "🧹 Cleaning up OpenShift resources..."

# Ensure we're in the correct project
oc project bookstore-project 2>/dev/null || {
    echo "❌ Project 'bookstore-project' not found"
    exit 1
}

# Delete deployments
echo "📦 Deleting deployments..."
oc delete deployment backend frontend mysql redis --ignore-not-found=true

# Delete services
echo "🌐 Deleting services..."
oc delete service backend frontend mysql redis --ignore-not-found=true

# Delete routes
echo "🛣️  Deleting routes..."
oc delete route bookstore --ignore-not-found=true

# Delete PVCs
echo "💾 Deleting persistent volume claims..."
oc delete pvc mysql-pvc --ignore-not-found=true

# Delete secrets
echo "🔐 Deleting secrets..."
oc delete secret bookstore-secrets --ignore-not-found=true

# Delete network policies
echo "🔒 Deleting network policies..."
oc delete networkpolicy --all --ignore-not-found=true

# Delete HPA
echo "📈 Deleting autoscaling resources..."
oc delete hpa bookstore-backend-hpa --ignore-not-found=true
oc delete pdb bookstore-backend-pdb --ignore-not-found=true

# Delete builds and imagestreams
echo "🏗️  Deleting builds and images..."
oc delete bc bookstore-backend bookstore-frontend bookstore-database --ignore-not-found=true
oc delete is bookstore-backend bookstore-frontend bookstore-database --ignore-not-found=true

echo ""
echo "✅ Cleanup complete!"
echo ""
echo "To redeploy:"
echo "  1. ./scripts/build-on-openshift.sh"
echo "  2. ./scripts/deploy-openshift.sh"
