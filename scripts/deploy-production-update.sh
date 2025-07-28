#!/bin/bash

# Deploy Production Database Update to Hetzner
# After promoting development branch to production, restart remote container

SERVER="49.12.199.93"
USER="root"

echo "========================================================"
echo "Deploying Production Database Update"
echo "========================================================"

echo "✅ Branch promotion completed:"
echo "   - Production now uses: ep-rough-smoke-a2zgm0hg-pooler (284 products)"
echo "   - Old production backed up"
echo "   - .env.production updated"
echo ""

echo "🔄 Restarting remote container to pick up new database..."

# Copy updated environment file to server
echo "Copying updated .env.production to server..."
scp ../backend/.env.production $USER@$SERVER:/app/.env

# Restart the Docker container
echo "Restarting Docker container..."
ssh $USER@$SERVER "cd /app && docker-compose down && docker-compose -f docker-compose.prod.yml up -d"

echo ""
echo "✅ Deployment complete!"
echo "Remote Strapi should now show 284 products"
echo "Check: http://49.12.199.93:1337/api/products"
echo "========================================================"