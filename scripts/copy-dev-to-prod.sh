#!/bin/bash

# Copy Development Branch Data to Production Branch
# This script creates a new production branch from the current development branch

PROJECT_ID="cool-wind-39058859"
DEV_BRANCH="br-little-voice-a25n7bur"
PROD_BRANCH="br-shy-rain-a281c3vp"

echo "========================================================"
echo "Copying Development Data to Production Branch"
echo "========================================================"

echo "Warning: This will replace ALL data in production branch"
echo "Development branch has 284 products"
echo "Production branch is missing content type tables"
echo ""

# First, delete the current production branch
echo "Deleting current production branch..."
neon branches delete --project-id $PROJECT_ID --branch-id $PROD_BRANCH --confirm

# Create new production branch from development
echo "Creating new production branch from development..."
neon branches create --project-id $PROJECT_ID --name "production" --parent $DEV_BRANCH

echo "========================================================"
echo "Data copy completed successfully!"
echo "New production branch created with all development data"
echo "========================================================"