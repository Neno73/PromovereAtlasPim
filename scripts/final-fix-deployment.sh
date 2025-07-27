#!/bin/bash

SERVER_IP="49.12.199.93"
SERVER_PASS="PromoAtlas2025!"

echo "======================================================"
echo "Final Fix for PromoAtlas Deployment"
echo "======================================================"

# Upload the fixed Dockerfile
echo "1. Uploading fixed Dockerfile..."
sshpass -p "$SERVER_PASS" scp backend/Dockerfile.fixed root@$SERVER_IP:/opt/promoatlas/backend/Dockerfile

echo -e "\n2. Rebuilding and restarting..."
sshpass -p "$SERVER_PASS" ssh root@$SERVER_IP << 'EOF'
cd /opt/promoatlas

echo "Stopping containers..."
docker-compose -f docker-compose.prod.yml down

echo "Removing old images..."
docker rmi promoatlas_backend:latest 2>/dev/null || true

echo "Building with fixed Dockerfile..."
docker-compose -f docker-compose.prod.yml build backend

echo "Starting services..."
docker-compose -f docker-compose.prod.yml up -d

echo "Waiting for startup (60 seconds)..."
sleep 60

echo "Container status:"
docker-compose -f docker-compose.prod.yml ps

echo "Backend logs:"
docker-compose -f docker-compose.prod.yml logs --tail=50 backend

echo "Health check:"
for i in {1..5}; do
    if curl -s http://localhost:1337/_health; then
        echo -e "\n✅ Backend is healthy!"
        break
    else
        echo "Waiting..."
        sleep 10
    fi
done

echo -e "\nTesting admin access:"
curl -s -I http://localhost:1337/admin | head -5
EOF

echo -e "\n======================================================"
echo "Deployment fix completed!"
echo ""
echo "Access your application at:"
echo "- Backend API: http://$SERVER_IP:1337"
echo "- Admin Panel: http://$SERVER_IP:1337/admin"
echo "======================================================="