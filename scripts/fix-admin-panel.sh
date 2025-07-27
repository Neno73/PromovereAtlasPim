#!/bin/bash

SERVER_IP="49.12.199.93"
SERVER_PASS="PromoAtlas2025!"

echo "======================================================"
echo "Fixing Admin Panel Build"
echo "======================================================"

sshpass -p "$SERVER_PASS" ssh root@$SERVER_IP << 'EOF'
cd /opt/promoatlas

echo "1. Checking current admin build status:"
ls -la backend/dist/build/ 2>/dev/null || echo "No build directory in dist"

echo -e "\n2. Let's check where the admin build actually is:"
find backend/dist -name "index.html" -type f 2>/dev/null | head -5

echo -e "\n3. Checking node_modules for admin dist:"
ls -la backend/node_modules/@strapi/admin/dist/server/ 2>/dev/null | head -10

echo -e "\n4. Let's rebuild ensuring admin panel is included:"
cd backend
docker run --rm -v $(pwd):/app -w /app node:20-alpine sh -c "npm ci && npm run build"

echo -e "\n5. Rebuilding Docker image with complete build:"
cd ..
docker-compose -f docker-compose.prod.yml build backend

echo -e "\n6. Restarting backend:"
docker-compose -f docker-compose.prod.yml up -d backend

echo -e "\n7. Waiting for startup..."
sleep 30

echo -e "\n8. Final status check:"
docker-compose -f docker-compose.prod.yml ps

echo -e "\n9. Testing admin panel again:"
curl -I http://localhost:1337/admin 2>/dev/null | head -5

echo -e "\n10. Checking if Strapi is fully operational:"
curl -s http://localhost:1337 | head -20
EOF

echo -e "\n======================================================"
echo "Admin panel fix completed!"
echo "======================================================="