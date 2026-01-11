#!/bin/bash
set -e

# Resolve script directory and project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Directory for reports
REPORT_DIR="$PROJECT_ROOT/reports"
mkdir -p "$REPORT_DIR"

echo "============================================"
echo "🛡️  Starting Trivy Security Scan..."
echo "============================================"

# Function to scan an image
scan_image() {
    IMAGE_NAME=$1
    REPORT_FILE="$REPORT_DIR/scan-$(echo $IMAGE_NAME | cut -d'/' -f2 | cut -d':' -f1).txt"
    
    echo "🔍 Scanning $IMAGE_NAME..."
    echo "📄 Saving report to $REPORT_FILE"
    
    # Run Trivy scan
    # --skip-db-update: Skip downloading vulnerability DB to save time (assumes it was downloaded once)
    # --scanners vuln: Focus on vulnerabilities (can add secret,config if needed)
    trivy image --skip-db-update "$IMAGE_NAME" > "$REPORT_FILE"
    
    echo "✅ Scan for $IMAGE_NAME completed."
    echo "--------------------------------------------"
}

# Check if Trivy is installed
if ! command -v trivy &> /dev/null; then
    echo "❌ Error: trivy is not installed. Please install it first."
    exit 1
fi

# Scan all images
scan_image "localhost/bookstore-database:v1.0"
scan_image "localhost/bookstore-backend:v1.0"
scan_image "localhost/bookstore-frontend:v1.0"

echo "🎉 All scans completed! Reports are available in the '$REPORT_DIR' directory."
