#!/bin/bash

# Simple deployment script for PromoAtlas

cat << 'DEPLOY_SCRIPT' > /tmp/deploy_commands.sh
#!/bin/bash
set -e

echo "======================================================"
echo "PromoAtlas Deployment Script"
echo "======================================================"

# Configuration
PROJECT_DIR="/opt/promoatlas"
GITHUB_REPO="https://github.com/Neno73/PromovereAtlasPim.git"

# Step 1: Stop existing containers
echo "1. Stopping existing containers..."
cd ~ && docker-compose -f docker-compose.prod.yml down 2>/dev/null || true
docker stop promoatlas-backend-prod promoatlas-nginx 2>/dev/null || true
docker rm promoatlas-backend-prod promoatlas-nginx 2>/dev/null || true

# Step 2: Create project directory
echo "2. Setting up project directory..."
mkdir -p $PROJECT_DIR
cd $PROJECT_DIR

# Step 3: Clone or update repository
echo "3. Cloning/updating repository..."
if [ -d ".git" ]; then
    echo "Repository exists, pulling latest changes..."
    git pull origin main
else
    echo "Cloning repository..."
    git clone $GITHUB_REPO .
fi

# Step 4: Check for environment file
echo "4. Checking environment configuration..."
if [ -f ".env" ]; then
    echo "✅ Environment file exists"
else
    echo "⚠️  Environment file missing - deployment will fail without it!"
    echo "   Please upload production.env as .env"
fi

# Step 5: Build containers
echo "5. Building Docker containers..."
docker-compose -f docker-compose.prod.yml build --no-cache

# Step 6: Start containers
echo "6. Starting services..."
docker-compose -f docker-compose.prod.yml up -d

# Step 7: Wait and check status
echo "7. Waiting for services to start..."
sleep 10

echo "8. Container status:"
docker-compose -f docker-compose.prod.yml ps

echo "9. Checking backend health..."
curl -s http://localhost:1337/_health || echo "Backend not ready yet"

echo ""
echo "======================================================"
echo "Deployment script completed!"
echo "======================================================"
echo ""
echo "To view logs: docker-compose -f docker-compose.prod.yml logs -f"
echo ""
DEPLOY_SCRIPT

# Upload and execute the script
echo "Uploading deployment script to server..."
sshpass -p "PromoAtlas2025!" scp /tmp/deploy_commands.sh root@49.12.199.93:/tmp/

echo "Executing deployment script..."
sshpass -p "PromoAtlas2025!" ssh root@49.12.199.93 "chmod +x /tmp/deploy_commands.sh && /tmp/deploy_commands.sh"

rm -f /tmp/deploy_commands.sh