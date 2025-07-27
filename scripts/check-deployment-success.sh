#!/bin/bash

SERVER_IP="49.12.199.93"
SERVER_PASS="PromoAtlas2025!"

echo "======================================================"
echo "PromoAtlas Deployment Success Check"
echo "======================================================"

sshpass -p "$SERVER_PASS" ssh root@$SERVER_IP << 'EOF'
cd /opt/promoatlas

echo "1. Container status:"
docker-compose -f docker-compose.prod.yml ps

echo -e "\n2. Checking backend health:"
if curl -s http://localhost:1337/_health > /dev/null 2>&1; then
    echo "✅ Backend is healthy!"
    echo "Health endpoint response:"
    curl -s http://localhost:1337/_health | jq . 2>/dev/null || curl -s http://localhost:1337/_health
else
    echo "❌ Backend not responding to health check"
fi

echo -e "\n3. Testing API endpoint:"
curl -s http://localhost:1337/api/products | jq . 2>/dev/null || curl -s http://localhost:1337/api/products | head -20

echo -e "\n4. Checking admin panel:"
if curl -s -I http://localhost:1337/admin | grep -q "200\|301\|302"; then
    echo "✅ Admin panel is accessible"
else
    echo "❌ Admin panel not accessible"
fi

echo -e "\n5. Recent logs (last 20 lines, no config warnings):"
docker-compose -f docker-compose.prod.yml logs --tail=20 backend 2>&1 | grep -v "Config file not loaded"

echo -e "\n6. External access test:"
echo "Testing from external network..."
EOF

# Test from local machine
echo -e "\n7. Testing from local machine:"
echo -n "Backend API: "
curl -s -o /dev/null -w "%{http_code}" http://$SERVER_IP:1337/_health || echo "Failed"

echo -n -e "\nAdmin Panel: "
curl -s -o /dev/null -w "%{http_code}" http://$SERVER_IP:1337/admin || echo "Failed"

echo -e "\n\n======================================================"
echo "DEPLOYMENT SUMMARY"
echo "======================================================"
echo "Server IP: $SERVER_IP"
echo "Backend API: http://$SERVER_IP:1337"
echo "Admin Panel: http://$SERVER_IP:1337/admin"
echo ""
echo "SSH Access: ssh root@$SERVER_IP"
echo "Password: PromoAtlas2025!"
echo "======================================================="