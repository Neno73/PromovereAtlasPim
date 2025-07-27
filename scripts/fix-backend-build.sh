#!/bin/bash

SERVER_IP="49.12.199.93"
SERVER_PASS="PromoAtlas2025!"

echo "======================================================"
echo "Fixing Backend Build Issues"
echo "======================================================"

# First, let's check if we need to upload the src directory
echo "1. Checking if src directory exists on server..."
sshpass -p "$SERVER_PASS" ssh root@$SERVER_IP "ls -la /opt/promoatlas/backend/src/ | head -5"

# Let's rebuild with a modified approach
echo -e "\n2. Rebuilding backend with fixed configuration..."
sshpass -p "$SERVER_PASS" ssh root@$SERVER_IP << 'EOF'
cd /opt/promoatlas

echo "Stopping containers..."
docker-compose -f docker-compose.prod.yml down

echo "Creating a temporary build script..."
cat > backend/build-fix.sh << 'BUILDSCRIPT'
#!/bin/sh
# This script compiles TypeScript configs to JavaScript for production

echo "Installing dependencies..."
npm ci

echo "Building Strapi..."
npm run build

echo "Checking build output..."
ls -la dist/
ls -la dist/config/
BUILDSCRIPT

chmod +x backend/build-fix.sh

echo "Running build inside a temporary container..."
docker run --rm -v $(pwd)/backend:/app -w /app node:20-alpine sh -c "./build-fix.sh"

echo "Checking if build succeeded..."
ls -la backend/dist/config/ || echo "Build failed"

echo "Rebuilding Docker image..."
docker-compose -f docker-compose.prod.yml build backend

echo "Starting services..."
docker-compose -f docker-compose.prod.yml up -d

echo "Waiting for startup..."
sleep 30

echo "Container status:"
docker-compose -f docker-compose.prod.yml ps

echo "Backend logs:"
docker-compose -f docker-compose.prod.yml logs --tail=50 backend

echo "Health check:"
curl -s http://localhost:1337/_health || echo "Backend not ready"
EOF

echo -e "\n======================================================"
echo "Fix attempt completed!"
echo "======================================================="