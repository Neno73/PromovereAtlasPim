#!/bin/bash

# Fix the current deployment on Hetzner
SERVER_IP="49.12.199.93"
SERVER_PASS="PromoAtlas2025!"

echo "======================================================"
echo "Fixing PromoAtlas Deployment"
echo "======================================================"

# Upload the missing files and fix deployment
echo "1. Uploading missing configuration files..."

# Upload docker-compose.prod.yml
sshpass -p "$SERVER_PASS" scp docker-compose.prod.yml root@$SERVER_IP:/opt/promoatlas/

# Upload nginx config
sshpass -p "$SERVER_PASS" scp nginx-backend-proxy.conf root@$SERVER_IP:/opt/promoatlas/

# Upload production.env as .env
sshpass -p "$SERVER_PASS" scp production.env root@$SERVER_IP:/opt/promoatlas/.env

echo -e "\n2. Fixing deployment..."
sshpass -p "$SERVER_PASS" ssh root@$SERVER_IP << 'EOF'
cd /opt/promoatlas

echo "Current directory:"
pwd
echo ""

echo "Files present:"
ls -la
echo ""

echo "Stopping any running containers..."
docker-compose -f docker-compose.prod.yml down 2>/dev/null || true
docker stop $(docker ps -aq) 2>/dev/null || true
docker rm $(docker ps -aq) 2>/dev/null || true

echo "Building backend container..."
docker-compose -f docker-compose.prod.yml build backend

echo "Starting services..."
docker-compose -f docker-compose.prod.yml up -d

echo "Waiting for services..."
sleep 20

echo "Container status:"
docker-compose -f docker-compose.prod.yml ps

echo -e "\nChecking logs:"
docker-compose -f docker-compose.prod.yml logs --tail=30 backend

echo -e "\nHealth check:"
curl -s http://localhost:1337/_health || echo "Backend not ready"
EOF

echo -e "\n======================================================"
echo "Deployment fix completed!"
echo "Server: http://$SERVER_IP"
echo "======================================================="