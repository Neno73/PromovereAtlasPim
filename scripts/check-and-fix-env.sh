#!/bin/bash

SERVER_IP="49.12.199.93"
SERVER_PASS="PromoAtlas2025!"

echo "======================================================"
echo "Checking and Fixing Environment Variables"
echo "======================================================"

sshpass -p "$SERVER_PASS" ssh root@$SERVER_IP << 'EOF'
cd /opt/promoatlas

echo "1. Checking current .env file:"
echo "Number of lines in .env:"
wc -l .env

echo -e "\n2. Checking for JWT_SECRET in .env:"
grep -E "JWT_SECRET|jwtSecret" .env || echo "JWT_SECRET not found in .env"

echo -e "\n3. Checking container environment:"
docker-compose -f docker-compose.prod.yml exec -T backend env | grep -E "JWT|DATABASE_URL" || echo "Container not running"

echo -e "\n4. Let's check what environment variables are being passed:"
grep -A 20 "environment:" docker-compose.prod.yml

echo -e "\n5. Updating .env file with missing JWT_SECRET if needed:"
if ! grep -q "JWT_SECRET" .env; then
    echo "JWT_SECRET=4e4fbbc287cd717750dbce0966b211370a20bb4ae056ad93e101ac39cc244223" >> .env
    echo "Added JWT_SECRET to .env"
fi

echo -e "\n6. Restarting containers with updated environment:"
docker-compose -f docker-compose.prod.yml down
docker-compose -f docker-compose.prod.yml up -d

echo -e "\n7. Waiting for startup..."
sleep 30

echo -e "\n8. Checking status:"
docker-compose -f docker-compose.prod.yml ps

echo -e "\n9. Latest logs:"
docker-compose -f docker-compose.prod.yml logs --tail=30 backend

echo -e "\n10. Health check:"
curl -s http://localhost:1337/_health || echo "Not ready yet"
EOF

echo -e "\n======================================================"
echo "Environment check completed!"
echo "======================================================="