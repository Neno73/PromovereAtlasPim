#!/bin/bash

SERVER_IP="49.12.199.93"
SERVER_PASS="PromoAtlas2025!"

echo "======================================================"
echo "Fixing Strapi 5 Admin Panel Path Issue"
echo "======================================================"

sshpass -p "$SERVER_PASS" ssh root@$SERVER_IP << 'EOF'
cd /opt/promoatlas

echo "1. Current admin build location:"
ls -la backend/dist/build/ | head -10

echo -e "\n2. Where Strapi is looking for admin files:"
find backend/node_modules/@strapi/admin -name "index.html" 2>/dev/null | head -5

echo -e "\n3. Creating symlink to fix admin path:"
mkdir -p backend/node_modules/@strapi/admin/dist/server/server/
ln -sf /app/dist/build backend/node_modules/@strapi/admin/dist/server/server/build

echo -e "\n4. Verifying symlink:"
ls -la backend/node_modules/@strapi/admin/dist/server/server/

echo -e "\n5. Rebuilding Docker image with fix:"
docker-compose -f docker-compose.prod.yml build backend

echo -e "\n6. Restarting backend:"
docker-compose -f docker-compose.prod.yml up -d backend

echo -e "\n7. Waiting for startup (45 seconds)..."
sleep 45

echo -e "\n8. Testing admin panel:"
curl -I http://localhost:1337/admin 2>/dev/null | head -5

echo -e "\n9. Final container status:"
docker-compose -f docker-compose.prod.yml ps
EOF

echo -e "\n======================================================"
echo "Admin path fix completed!"
echo "Testing from external:"
curl -I http://$SERVER_IP:1337/admin 2>/dev/null | head -3
echo "======================================================"