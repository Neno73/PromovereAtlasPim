#!/bin/bash

# Fix production database connection
# Run this script to update the remote server

SERVER_IP="49.12.199.93"
NEW_DB_URL="postgresql://neondb_owner:npg_4soRW9nJxmVr@ep-rough-smoke-a2zgm0hg-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require"

echo "Fixing production database connection..."
echo "Server: $SERVER_IP"

# Create the update script to run on remote server
cat > /tmp/update_db.sh << 'EOF'
#!/bin/bash
cd /app
echo "Current DATABASE_URL:"
grep DATABASE_URL .env

# Backup current .env
cp .env .env.backup

# Update DATABASE_URL
sed -i 's|ep-bitter-rice-a22m6feq|ep-rough-smoke-a2zgm0hg|g' .env

echo "New DATABASE_URL:"
grep DATABASE_URL .env

# Restart containers
echo "Stopping containers..."
docker-compose down

echo "Starting containers with production config..."
docker-compose -f docker-compose.prod.yml up -d

# Wait a bit for startup
sleep 10

echo "Testing API..."
curl -s http://localhost:1337/api/products | head -100

echo "Done!"
EOF

echo "Script created. Now attempting to copy and execute on server..."

# Try different SSH methods
echo "Trying SSH with password..."
sshpass -p 'cwCsLkTjUAuvEUKWWtbr' scp -o StrictHostKeyChecking=no /tmp/update_db.sh root@$SERVER_IP:/tmp/ && \
sshpass -p 'cwCsLkTjUAuvEUKWWtbr' ssh -o StrictHostKeyChecking=no root@$SERVER_IP 'chmod +x /tmp/update_db.sh && /tmp/update_db.sh'

if [ $? -ne 0 ]; then
    echo "SSH failed. Manual steps needed:"
    echo "1. Access Hetzner console"
    echo "2. Run these commands:"
    echo ""
    cat /tmp/update_db.sh
fi