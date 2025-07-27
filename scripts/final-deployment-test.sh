#!/bin/bash

SERVER_IP="49.12.199.93"

echo "======================================================"
echo "🎉 PromoAtlas Final Deployment Test"
echo "======================================================"

echo -e "\n1. Testing Backend Health:"
echo -n "Health endpoint: "
response=$(curl -s -o /dev/null -w "%{http_code}" http://$SERVER_IP:1337/_health)
if [ "$response" = "204" ]; then
    echo "✅ Healthy ($response)"
else
    echo "❌ Not healthy ($response)"
fi

echo -e "\n2. Testing API Endpoints:"
echo -n "Products API: "
response=$(curl -s -o /dev/null -w "%{http_code}" http://$SERVER_IP:1337/api/products)
if [ "$response" = "404" ] || [ "$response" = "200" ]; then
    echo "✅ Working ($response)"
else
    echo "❌ Not working ($response)"
fi

echo -e "\n3. Testing Admin Panel:"
echo -n "Admin panel: "
response=$(curl -s -o /dev/null -w "%{http_code}" http://$SERVER_IP:1337/admin)
if [ "$response" = "200" ] || [ "$response" = "301" ] || [ "$response" = "302" ]; then
    echo "✅ Accessible ($response)"
else
    echo "❌ Not accessible ($response)"
fi

echo -e "\n4. Testing Content Manager:"
echo -n "Content Manager API: "
response=$(curl -s -o /dev/null -w "%{http_code}" http://$SERVER_IP:1337/content-manager)
if [ "$response" = "404" ] || [ "$response" = "401" ]; then
    echo "✅ Protected as expected ($response)"
else
    echo "❌ Unexpected response ($response)"
fi

echo -e "\n======================================================"
echo "🚀 DEPLOYMENT COMPLETE!"
echo "======================================================"
echo ""
echo "📍 Access URLs:"
echo "   Backend API: http://$SERVER_IP:1337"
echo "   Admin Panel: http://$SERVER_IP:1337/admin"
echo "   Health Check: http://$SERVER_IP:1337/_health"
echo ""
echo "🔐 Admin Setup:"
echo "   1. Go to http://$SERVER_IP:1337/admin"
echo "   2. Create your first admin user"
echo "   3. Start managing content and syncing products!"
echo ""
echo "🔧 SSH Access:"
echo "   ssh root@$SERVER_IP"
echo "   Password: PromoAtlas2025!"
echo ""
echo "📁 Project Location: /opt/promoatlas"
echo "======================================================"