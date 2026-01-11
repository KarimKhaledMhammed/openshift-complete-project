#!/bin/bash

echo "🔍 Checking Prerequisites..."

CHECKS_PASSED=true

# Check Podman
if ! command -v podman &> /dev/null; then
    echo "❌ Podman is not installed."
    CHECKS_PASSED=false
else
    echo "✅ Podman found: $(podman --version)"
fi

# Check OC CLI
if ! command -v oc &> /dev/null; then
    echo "❌ OpenShift CLI (oc) is not installed."
    CHECKS_PASSED=false
else
    echo "✅ OpenShift CLI found: $(oc version --client | grep Client)"
fi

# Check Trivy
if ! command -v trivy &> /dev/null; then
    echo "⚠️  Trivy not found (Required for security scanning)."
else
    echo "✅ Trivy found: $(trivy --version | head -n 1)"
fi

if [ "$CHECKS_PASSED" = true ]; then
    echo "🎉 All core prerequisites met."
    exit 0
else
    echo "❌ Some prerequisites are missing."
    exit 1
fi
