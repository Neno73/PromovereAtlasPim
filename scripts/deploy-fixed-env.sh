#!/bin/bash

# Deploy the correct .env.production to remote server
# This script will use multiple methods to get the correct env file to the server

SERVER_IP="49.12.199.93"
LOCAL_ENV="/home/neno/Desktop/cline-mcp-workspace/PromoAtlas/backend/.env.production"

echo "Deploying correct environment configuration..."
echo "Server: $SERVER_IP"
echo "Local env file: $LOCAL_ENV"

# Method 1: Try SCP with different keys
echo "Trying SCP with different SSH keys..."

for key in ~/.ssh/promoatlas_deploy ~/.ssh/hetzner_rsa ~/.ssh/promoatlas_ed25519; do
    if [ -f "$key" ]; then
        echo "Trying key: $key"
        scp -i "$key" -o StrictHostKeyChecking=no "$LOCAL_ENV" root@$SERVER_IP:/app/.env
        if [ $? -eq 0 ]; then
            echo "Environment file copied successfully with $key"
            
            # Now restart the containers
            ssh -i "$key" -o StrictHostKeyChecking=no root@$SERVER_IP 'cd /app && docker-compose down && docker-compose -f docker-compose.prod.yml up -d'
            
            if [ $? -eq 0 ]; then
                echo "Containers restarted successfully!"
                
                # Test the fix
                echo "Testing API..."
                sleep 10
                curl -s http://$SERVER_IP:1337/api/products | head -200
                exit 0
            fi
        fi
    fi
done

# Method 2: Try with password
echo "Trying SCP with password..."
sshpass -p 'cwCsLkTjUAuvEUKWWtbr' scp -o StrictHostKeyChecking=no "$LOCAL_ENV" root@$SERVER_IP:/app/.env
if [ $? -eq 0 ]; then
    echo "Environment file copied with password"
    sshpass -p 'cwCsLkTjUAuvEUKWWtbr' ssh -o StrictHostKeyChecking=no root@$SERVER_IP 'cd /app && docker-compose down && docker-compose -f docker-compose.prod.yml up -d'
    
    if [ $? -eq 0 ]; then
        echo "Containers restarted successfully!"
        echo "Testing API..."
        sleep 10
        curl -s http://$SERVER_IP:1337/api/products | head -200
        exit 0
    fi
fi

echo "All SSH methods failed. Manual intervention required."
echo "The correct .env file is ready at: $LOCAL_ENV"
echo "Please copy this file to the server manually through Hetzner console."