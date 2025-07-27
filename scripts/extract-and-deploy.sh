#!/bin/bash

SERVER_IP="49.12.199.93"
SERVER_PASS="PromoAtlas2025!"

echo "======================================================"
echo "Extracting and Deploying PromoAtlas"
echo "======================================================"

sshpass -p "$SERVER_PASS" ssh root@$SERVER_IP << 'EOF'
cd /opt/promoatlas

echo "1. Current directory contents:"
ls -la

# Check if we have the tar file
if [ -f "promoatlas-deploy.tar.gz" ]; then
    echo -e "\n2. Extracting deployment archive..."
    tar xzf promoatlas-deploy.tar.gz
    echo "Extraction complete"
else
    echo -e "\n2. No tar file found, checking git repository..."
    # If it's a git repo, we need the proper structure
    if [ -d ".git" ]; then
        echo "Git repository found"
        ls -la
    fi
fi

echo -e "\n3. Directory structure after extraction:"
ls -la

echo -e "\n4. Checking backend directory:"
ls -la backend/ 2>/dev/null || echo "Backend directory missing!"

echo -e "\n5. Building and starting containers..."
if [ -d "backend" ]; then
    docker-compose -f docker-compose.prod.yml build --no-cache backend
    docker-compose -f docker-compose.prod.yml up -d
    
    sleep 20
    
    echo -e "\n6. Container status:"
    docker-compose -f docker-compose.prod.yml ps
    
    echo -e "\n7. Backend logs:"
    docker-compose -f docker-compose.prod.yml logs --tail=50 backend
else
    echo "ERROR: Backend directory not found! Deployment cannot proceed."
fi
EOF

echo -e "\n======================================================"
echo "Deployment status check completed!"
echo "======================================================="