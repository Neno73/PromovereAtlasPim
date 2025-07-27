#!/bin/bash

# Direct deployment using SSH commands
SERVER_IP="49.12.199.93"
SERVER_PASS="PromoAtlas2025!"

echo "======================================================"
echo "Direct PromoAtlas Deployment"
echo "======================================================"

# First, let's check what's currently on the server
echo "1. Checking current server state..."
sshpass -p "$SERVER_PASS" ssh root@$SERVER_IP << 'EOF'
echo "Current directory contents:"
ls -la /opt/promoatlas/ 2>/dev/null || echo "Project directory doesn't exist yet"
echo ""
echo "Docker containers:"
docker ps -a
echo ""
echo "Root directory docker-compose files:"
ls -la ~/docker-compose* 2>/dev/null || echo "No docker-compose files in root"
EOF

# Clean up and prepare
echo -e "\n2. Cleaning up old deployment..."
sshpass -p "$SERVER_PASS" ssh root@$SERVER_IP << 'EOF'
# Stop and remove containers
docker stop promoatlas-backend-prod promoatlas-nginx 2>/dev/null || true
docker rm promoatlas-backend-prod promoatlas-nginx 2>/dev/null || true

# Remove old files from root
rm -f ~/docker-compose.prod.yml ~/nginx-backend-proxy.conf 2>/dev/null || true

# Create clean project directory
rm -rf /opt/promoatlas
mkdir -p /opt/promoatlas
cd /opt/promoatlas
EOF

# Upload project files
echo -e "\n3. Uploading project files..."
echo "Creating tar archive..."
cd /home/neno/Desktop/cline-mcp-workspace/PromoAtlas
tar czf /tmp/promoatlas-deploy.tar.gz \
    backend/ \
    frontend/ \
    docker-compose.prod.yml \
    nginx-backend-proxy.conf \
    production.env \
    .gitignore \
    --exclude='node_modules' \
    --exclude='.git' \
    --exclude='dist' \
    --exclude='build'

echo "Uploading archive..."
sshpass -p "$SERVER_PASS" scp /tmp/promoatlas-deploy.tar.gz root@$SERVER_IP:/opt/promoatlas/

# Extract and set up
echo -e "\n4. Extracting and setting up..."
sshpass -p "$SERVER_PASS" ssh root@$SERVER_IP << 'EOF'
cd /opt/promoatlas
tar xzf promoatlas-deploy.tar.gz
rm promoatlas-deploy.tar.gz

# Copy production.env to .env
cp production.env .env
chmod 600 .env

echo "Files extracted:"
ls -la
EOF

# Build and start
echo -e "\n5. Building and starting containers..."
sshpass -p "$SERVER_PASS" ssh root@$SERVER_IP << 'EOF'
cd /opt/promoatlas

echo "Building containers..."
docker-compose -f docker-compose.prod.yml build

echo "Starting containers..."
docker-compose -f docker-compose.prod.yml up -d

echo "Waiting for containers to start..."
sleep 15

echo "Container status:"
docker-compose -f docker-compose.prod.yml ps

echo "Checking backend health:"
curl -s http://localhost:1337/_health || echo "Backend still starting..."

echo "Recent logs:"
docker-compose -f docker-compose.prod.yml logs --tail=20
EOF

# Cleanup
rm -f /tmp/promoatlas-deploy.tar.gz

echo -e "\n======================================================"
echo "Deployment completed!"
echo "======================================================"
echo "Server: http://$SERVER_IP"
echo "Backend: http://$SERVER_IP:1337"
echo "======================================================="