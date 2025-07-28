#!/bin/bash

# Script to update remote database connection via API call or alternative method
# Since SSH is failing, we'll use a different approach

echo "Updating remote database connection..."

# New development branch connection string
NEW_DB_URL="postgresql://neondb_owner:npg_4soRW9nJxmVr@ep-rough-smoke-a2zgm0hg-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require"

echo "Target server: 49.12.199.93"
echo "New database URL: $NEW_DB_URL"

# Test if the API is accessible
echo "Testing API accessibility..."
curl -s -o /dev/null -w "%{http_code}" http://49.12.199.93:1337/api/products

echo ""
echo "SSH access is currently failing. Options:"
echo "1. Use Hetzner Console to manually update /app/.env"
echo "2. Rebuild container with correct environment"
echo "3. Use recovery mode to fix SSH access"