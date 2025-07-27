#!/bin/bash

SERVER_IP="49.12.199.93"
SERVER_PASS="PromoAtlas2025!"

echo "======================================================"
echo "Checking Backend Build Status"
echo "======================================================"

sshpass -p "$SERVER_PASS" ssh root@$SERVER_IP << 'EOF'
cd /opt/promoatlas

echo "1. Checking dist directory:"
ls -la backend/dist/ 2>/dev/null || echo "No dist directory found"

echo -e "\n2. Checking config directory:"
ls -la backend/config/

echo -e "\n3. Checking if build was successful:"
ls -la backend/dist/config/ 2>/dev/null || echo "No compiled config files"

echo -e "\n4. Let's run build manually to see the error:"
cd backend
npm run build 2>&1 | tail -50

echo -e "\n5. Checking environment variables:"
docker-compose -f ../docker-compose.prod.yml exec backend env | grep -E "(DATABASE|NODE_ENV)" || echo "Container not running"

echo -e "\n6. Container logs again:"
cd ..
docker-compose -f docker-compose.prod.yml logs --tail=30 backend
EOF

echo -e "\n======================================================"
echo "Check completed!"
echo "======================================================="