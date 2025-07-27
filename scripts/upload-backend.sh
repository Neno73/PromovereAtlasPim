#!/bin/bash

SERVER_IP="49.12.199.93"
SERVER_PASS="PromoAtlas2025!"

echo "======================================================"
echo "Uploading Backend Files to Server"
echo "======================================================"

# First, clean up the server directory
echo "1. Cleaning up server directory..."
sshpass -p "$SERVER_PASS" ssh root@$SERVER_IP << 'EOF'
cd /opt/promoatlas
rm -rf backend
rm -f promoatlas-deploy.tar.gz
ls -la
EOF

# Create a proper tar archive of just what we need
echo -e "\n2. Creating deployment archive..."
cd /home/neno/Desktop/cline-mcp-workspace/PromoAtlas
tar czf /tmp/backend-deploy.tar.gz backend/

echo -e "\n3. Uploading backend..."
sshpass -p "$SERVER_PASS" scp /tmp/backend-deploy.tar.gz root@$SERVER_IP:/opt/promoatlas/

echo -e "\n4. Extracting and building..."
sshpass -p "$SERVER_PASS" ssh root@$SERVER_IP << 'EOF'
cd /opt/promoatlas
tar xzf backend-deploy.tar.gz
rm backend-deploy.tar.gz

echo "Files now present:"
ls -la

echo -e "\nChecking backend structure:"
ls -la backend/

echo -e "\nChecking for Dockerfile:"
ls -la backend/Dockerfile

echo -e "\nBuilding containers..."
docker-compose -f docker-compose.prod.yml build backend

echo -e "\nStarting services..."
docker-compose -f docker-compose.prod.yml up -d

sleep 30

echo -e "\nContainer status:"
docker-compose -f docker-compose.prod.yml ps

echo -e "\nChecking logs:"
docker-compose -f docker-compose.prod.yml logs --tail=50 backend

echo -e "\nHealth check:"
curl -s http://localhost:1337/_health || echo "Backend not ready yet"
EOF

rm -f /tmp/backend-deploy.tar.gz

echo -e "\n======================================================"
echo "Backend upload completed!"
echo "======================================================="