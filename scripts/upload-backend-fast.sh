#!/bin/bash

SERVER_IP="49.12.199.93"
SERVER_PASS="PromoAtlas2025!"

echo "======================================================"
echo "Fast Backend Upload (without node_modules)"
echo "======================================================"

# Create archive without node_modules
echo "1. Creating optimized archive..."
cd /home/neno/Desktop/cline-mcp-workspace/PromoAtlas
tar czf /tmp/backend-fast.tar.gz \
    --exclude='backend/node_modules' \
    --exclude='backend/dist' \
    --exclude='backend/.tmp' \
    --exclude='backend/.cache' \
    backend/

# Check size
echo "Archive size: $(du -h /tmp/backend-fast.tar.gz | cut -f1)"

echo -e "\n2. Uploading backend (without node_modules)..."
sshpass -p "$SERVER_PASS" scp /tmp/backend-fast.tar.gz root@$SERVER_IP:/opt/promoatlas/

echo -e "\n3. Extracting and building on server..."
sshpass -p "$SERVER_PASS" ssh root@$SERVER_IP << 'EOF'
cd /opt/promoatlas
tar xzf backend-fast.tar.gz
rm backend-fast.tar.gz

echo "Backend extracted successfully"
ls -la backend/

echo -e "\nBuilding Docker image (npm install will happen inside container)..."
docker-compose -f docker-compose.prod.yml build backend --no-cache

echo -e "\nStarting services..."
docker-compose -f docker-compose.prod.yml up -d

echo -e "\nWaiting for startup..."
sleep 30

echo -e "\nContainer status:"
docker-compose -f docker-compose.prod.yml ps

echo -e "\nBackend logs:"
docker-compose -f docker-compose.prod.yml logs --tail=50 backend
EOF

rm -f /tmp/backend-fast.tar.gz

echo -e "\n======================================================"
echo "Fast deployment completed!"
echo "======================================================="