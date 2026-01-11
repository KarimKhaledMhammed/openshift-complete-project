#!/bin/bash
set -e

REGISTRY="default-route-openshift-image-registry.apps-crc.testing"
PROJECT="bookstore-project"

echo "🚀 Pushing images to OpenShift Registry ($REGISTRY)..."

# Login (just in case)
podman login -u developer -p $(oc whoami -t) $REGISTRY --tls-verify=false

push_image() {
    LOCAL_NAME=$1
    REMOTE_NAME="$REGISTRY/$PROJECT/$1"
    
    echo "📦 Pushing $LOCAL_NAME..."
    podman tag "localhost/$LOCAL_NAME" "$REMOTE_NAME"
    podman push "$REMOTE_NAME" --tls-verify=false
}

push_image "bookstore-backend:v1.0"
push_image "bookstore-frontend:v1.0"
push_image "bookstore-database:v1.0"

echo "✅ All images pushed to OpenShift!"
