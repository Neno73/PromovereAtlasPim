#!/bin/bash

SERVER_IP="49.12.199.93"
SERVER_PASS="PromoAtlas2025!"

echo "======================================================"
echo "Final Deployment Status Check"
echo "======================================================"

sshpass -p "$SERVER_PASS" ssh root@$SERVER_IP << 'EOF'
cd /opt/promoatlas

echo "1. Container status:"
docker-compose -f docker-compose.prod.yml ps

echo -e "\n2. Latest backend logs:"
docker-compose -f docker-compose.prod.yml logs --tail=20 backend | grep -v "Config file not loaded"

echo -e "\n3. Health check attempts:"
for i in {1..5}; do
    echo -n "Attempt $i: "
    if curl -s http://localhost:1337/_health > /dev/null; then
        echo "✅ Success!"
        curl -s http://localhost:1337/_health | jq . || curl -s http://localhost:1337/_health
        break
    else
        echo "❌ Not ready, waiting 10s..."
        sleep 10
    fi
done

echo -e "\n4. Port check:"
netstat -tlnp | grep 1337 || echo "Port 1337 not listening"

echo -e "\n5. Container resource usage:"
docker stats --no-stream promoatlas-backend-prod

echo -e "\n6. Environment variables check:"
docker-compose -f docker-compose.prod.yml exec -T backend env | grep -E "(DATABASE_URL|NODE_ENV)" | head -5

echo -e "\n7. External access test:"
curl -I http://49.12.199.93:1337/_health 2>/dev/null | head -5 || echo "Cannot reach from external"
EOF

echo -e "\n======================================================"
echo "Summary:"
echo "Server IP: $SERVER_IP"
echo "Backend URL: http://$SERVER_IP:1337"
echo "Admin Panel: http://$SERVER_IP:1337/admin"
echo "======================================================="