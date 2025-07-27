#!/bin/bash

# Build and push Docker images to DockerHub
# Usage: ./scripts/build-and-push.sh [tag] [registry]

set -e

# Configuration
TAG=${1:-latest}
REGISTRY=${2:-""}
PROJECT_NAME="promoatlas"

# Add registry prefix if provided
if [ -n "$REGISTRY" ]; then
    IMAGE_PREFIX="$REGISTRY/$PROJECT_NAME"
else
    IMAGE_PREFIX="$PROJECT_NAME"
fi

echo "🚀 Building and pushing PromoAtlas Docker images..."
echo "Tag: $TAG"
echo "Registry: ${REGISTRY:-"DockerHub"}"
echo "----------------------------------------"

# Build backend image
echo "📦 Building backend image..."
docker build -t "${IMAGE_PREFIX}-backend:${TAG}" \
             -t "${IMAGE_PREFIX}-backend:latest" \
             --target production \
             ./backend

# Build frontend image
echo "📦 Building frontend image..."
docker build -t "${IMAGE_PREFIX}-frontend:${TAG}" \
             -t "${IMAGE_PREFIX}-frontend:latest" \
             --target production \
             ./frontend

# Push images
if [ -n "$REGISTRY" ]; then
    echo "🌍 Pushing backend image to registry..."
    docker push "${IMAGE_PREFIX}-backend:${TAG}"
    docker push "${IMAGE_PREFIX}-backend:latest"
    
    echo "🌍 Pushing frontend image to registry..."
    docker push "${IMAGE_PREFIX}-frontend:${TAG}"
    docker push "${IMAGE_PREFIX}-frontend:latest"
else
    echo "💡 To push to a registry, run:"
    echo "   docker login"
    echo "   ./scripts/build-and-push.sh $TAG your-dockerhub-username"
fi

echo "✅ Build completed successfully!"
echo "Backend image: ${IMAGE_PREFIX}-backend:${TAG}"
echo "Frontend image: ${IMAGE_PREFIX}-frontend:${TAG}"