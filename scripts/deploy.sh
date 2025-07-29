#!/bin/bash

# PromoAtlas Deployment Script
# This script handles the complete deployment process to a remote server.
#
# Usage:
# ./scripts/deploy.sh user@server:/path/to/project
#
# Example:
# ./scripts/deploy.sh root@123.45.67.89:/opt/promoatlas

set -e # Exit on error

# --- Configuration ---
REMOTE_TARGET=$1
REMOTE_USER=$(echo $REMOTE_TARGET | cut -d'@' -f1)
REMOTE_HOST=$(echo $REMOTE_TARGET | cut -d'@' -f2 | cut -d':' -f1)
REMOTE_DIR=$(echo $REMOTE_TARGET | cut -d':' -f2)

if [ -z "$REMOTE_TARGET" ] || [ -z "$REMOTE_USER" ] || [ -z "$REMOTE_HOST" ] || [ -z "$REMOTE_DIR" ]; then
  echo "Usage: $0 user@host:/path/to/project"
  exit 1
fi

echo "======================================================"
echo "PromoAtlas Deployment"
echo "======================================================"
echo "Target: $REMOTE_HOST"
echo "User: $REMOTE_USER"
echo "Directory: $REMOTE_DIR"
echo "======================================================"

# --- Local Preparation ---
echo "1. Creating deployment package..."
# Create a tarball of the necessary files for deployment
# Exclude node_modules, .git, and other unnecessary files
tar czf /tmp/promoatlas-deploy.tar.gz \
    backend/ \
    frontend/ \
    docker-compose.prod.yml \
    nginx-backend-proxy.conf \
    .gitignore \
    --exclude='node_modules' \
    --exclude='.git' \
    --exclude='dist' \
    --exclude='build'

echo "Package created at /tmp/promoatlas-deploy.tar.gz"

# --- Remote Deployment ---
echo -e "\n2. Connecting to remote server..."
ssh $REMOTE_USER@$REMOTE_HOST << EOF
  set -e # Exit on error within the remote script

  echo "--- Remote: Preparing deployment directory ---"
  mkdir -p $REMOTE_DIR
  cd $REMOTE_DIR

  echo "--- Remote: Stopping existing services ---"
  # Stop and remove any running containers to ensure a clean start
  docker-compose -f docker-compose.prod.yml down --remove-orphans 2>/dev/null || true
EOF

echo -e "\n3. Uploading deployment package..."
scp /tmp/promoatlas-deploy.tar.gz $REMOTE_USER@$REMOTE_HOST:$REMOTE_DIR/

echo -e "\n4. Deploying on remote server..."
ssh $REMOTE_USER@$REMOTE_HOST << EOF
  set -e # Exit on error within the remote script

  cd $REMOTE_DIR

  echo "--- Remote: Extracting package ---"
  tar xzf promoatlas-deploy.tar.gz
  rm promoatlas-deploy.tar.gz

  echo "--- Remote: Setting up environment ---"
  if [ ! -f ".env" ]; then
    echo "WARNING: .env file not found on the server."
    echo "Please create a .env file with the production environment variables."
  fi

  echo "--- Remote: Building and starting services ---"
  docker-compose -f docker-compose.prod.yml build --no-cache
  docker-compose -f docker-compose.prod.yml up -d

  echo "--- Remote: Deployment complete ---"
  docker-compose -f docker-compose.prod.yml ps
EOF

# --- Cleanup ---
echo -e "\n5. Cleaning up local package..."
rm /tmp/promoatlas-deploy.tar.gz

echo -e "\n======================================================"
echo "Deployment to $REMOTE_HOST completed successfully!"
echo "======================================================"
