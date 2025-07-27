#!/bin/bash

SERVER_IP="49.12.199.93"
SERVER_PASS="PromoAtlas2025!"

echo "======================================================"
echo "Final JWT Configuration Fix"
echo "======================================================"

echo "1. Uploading fixed docker-compose.prod.yml..."
sshpass -p "$SERVER_PASS" scp docker-compose.prod.yml.fixed root@$SERVER_IP:/opt/promoatlas/docker-compose.prod.yml

echo -e "\n2. Uploading plugins.js configuration..."
sshpass -p "$SERVER_PASS" scp backend/config/plugins.js root@$SERVER_IP:/opt/promoatlas/backend/config/

echo -e "\n3. Rebuilding and restarting with JWT configuration..."
sshpass -p "$SERVER_PASS" ssh root@$SERVER_IP << 'EOF'
cd /opt/promoatlas

echo "Stopping containers..."
docker-compose -f docker-compose.prod.yml down

echo "Rebuilding backend with new plugins config..."
docker-compose -f docker-compose.prod.yml build backend

echo "Starting services..."
docker-compose -f docker-compose.prod.yml up -d

echo "Waiting for startup (60 seconds)..."
sleep 60

echo "Container status:"
docker-compose -f docker-compose.prod.yml ps

echo -e "\nChecking if JWT_SECRET is passed to container:"
docker-compose -f docker-compose.prod.yml exec -T backend env | grep JWT || echo "No JWT vars found"

echo -e "\nBackend logs (filtered):"
docker-compose -f docker-compose.prod.yml logs --tail=50 backend | grep -v "Config file not loaded" | tail -30

echo -e "\nHealth check attempts:"
for i in {1..10}; do
    echo -n "Attempt $i: "
    if curl -s http://localhost:1337/_health > /dev/null 2>&1; then
        echo "✅ Backend is healthy!"
        curl -s http://localhost:1337/_health
        break
    else
        echo "Waiting 5s..."
        sleep 5
    fi
done

echo -e "\nFinal status check:"
curl -I http://localhost:1337 2>/dev/null | head -10
EOF

echo -e "\n======================================================"
echo "JWT fix completed!"
echo ""
echo "Access your application at:"
echo "- Backend API: http://$SERVER_IP:1337"
echo "- Admin Panel: http://$SERVER_IP:1337/admin"
echo "======================================================="