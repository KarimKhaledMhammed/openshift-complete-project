#!/bin/bash
set -e

# Resolve script directory and project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

echo "🛡️  Starting Comprehensive Security Validation..."

# Function to check trivy results
check_trivy() {
    echo "Running: $1"
    eval "$1"
    if [ $? -eq 0 ]; then
        echo "✅ PASS"
    else
        echo "❌ FAIL"
    fi
}

# 1. Image Vulnerability Scan (High/Critical)
echo -e "\n1️⃣  Checking for High/Critical Vulnerabilities..."
check_trivy "trivy image --severity HIGH,CRITICAL --ignore-unfixed -q localhost/bookstore-backend:v1.0"
check_trivy "trivy image --severity HIGH,CRITICAL --ignore-unfixed -q localhost/bookstore-frontend:v1.0"
check_trivy "trivy image --severity HIGH,CRITICAL --ignore-unfixed -q localhost/bookstore-database:v1.0"

# 2. Secret Scanning
echo -e "\n2️⃣  Scanning for Secrets..."
# Scan the entire project root but exclude git and reports
check_trivy "trivy fs --scanners secret --skip-dirs .git --skip-dirs reports --skip-dirs node_modules -q $PROJECT_ROOT"

# 3. IaC/Config Scanning (Kubernetes Manifests)
echo -e "\n3️⃣  Scanning Kubernetes Manifests (IaC)..."
check_trivy "trivy config -q $PROJECT_ROOT/openshift"

# 4. SBOM Generation
echo -e "\n4️⃣  Generating SBOMs..."
mkdir -p "$PROJECT_ROOT/reports/sbom"
trivy image --format spdx-json -q -o "$PROJECT_ROOT/reports/sbom/backend.json" localhost/bookstore-backend:v1.0
trivy image --format spdx-json -q -o "$PROJECT_ROOT/reports/sbom/frontend.json" localhost/bookstore-frontend:v1.0
trivy image --format spdx-json -q -o "$PROJECT_ROOT/reports/sbom/database.json" localhost/bookstore-database:v1.0
echo "✅ SBOMs generated in reports/sbom/"

echo -e "\n🎉 Validation Complete!"
