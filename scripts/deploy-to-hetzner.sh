#!/bin/bash

# PromoAtlas Deployment Script for Hetzner Cloud
# This script handles the complete deployment process

set -e  # Exit on error

# Configuration
SERVER_IP="49.12.199.93"
SERVER_PASSWORD="PromoAtlas2025!"
PROJECT_NAME="promoatlas"
PROJECT_DIR="/opt/$PROJECT_NAME"
GITHUB_REPO="https://github.com/Neno73/PromovereAtlasPim.git"

echo "======================================================"
echo "PromoAtlas Deployment to Hetzner Cloud"
echo "======================================================"

# Create expect script for deployment
cat > /tmp/deploy_promoatlas.exp << 'EOF'
#!/usr/bin/expect -f
set timeout 300
set password [lindex $argv 0]
set server_ip [lindex $argv 1]
set github_repo [lindex $argv 2]
set project_dir [lindex $argv 3]

spawn ssh -o StrictHostKeyChecking=no root@$server_ip

expect {
    "password:" {
        send "$password\r"
    }
    timeout {
        puts "ERROR: Connection timeout"
        exit 1
    }
}

# Wait for prompt
expect "# "

# Step 1: Stop existing containers
send "echo '1. Stopping existing containers...'\r"
expect "# "
send "cd ~ && docker-compose -f docker-compose.prod.yml down 2>/dev/null || true\r"
expect "# "
send "docker stop promoatlas-backend-prod promoatlas-nginx 2>/dev/null || true\r"
expect "# "
send "docker rm promoatlas-backend-prod promoatlas-nginx 2>/dev/null || true\r"
expect "# "

# Step 2: Create project directory
send "echo '2. Setting up project directory...'\r"
expect "# "
send "mkdir -p $project_dir\r"
expect "# "
send "cd $project_dir\r"
expect "# "

# Step 3: Clone or update repository
send "echo '3. Cloning/updating repository...'\r"
expect "# "
send "if [ -d '.git' ]; then git pull origin main; else git clone $github_repo .; fi\r"
expect "# "

# Step 4: Copy production environment file
send "echo '4. Setting up environment configuration...'\r"
expect "# "
send "echo 'Please upload the production.env file as .env'\r"
expect "# "

# Step 5: Create temporary .env file (will be replaced)
send "cat > .env << 'ENVEOF'\r"
expect "> "
send "# Temporary env file - replace with actual production.env\r"
expect "> "
send "NODE_ENV=production\r"
expect "> "
send "HOST=0.0.0.0\r"
expect "> "
send "PORT=1337\r"
expect "> "
send "ENVEOF\r"
expect "# "

# Step 6: Build and start containers
send "echo '5. Building and starting containers...'\r"
expect "# "
send "docker-compose -f docker-compose.prod.yml build --no-cache\r"
expect "# " 300

send "echo '6. Starting services...'\r"
expect "# "
send "docker-compose -f docker-compose.prod.yml up -d\r"
expect "# " 60

# Step 7: Check container status
send "echo '7. Checking container status...'\r"
expect "# "
send "sleep 5\r"
expect "# "
send "docker-compose -f docker-compose.prod.yml ps\r"
expect "# "

# Step 8: Show logs
send "echo '8. Recent logs:'\r"
expect "# "
send "docker-compose -f docker-compose.prod.yml logs --tail=20\r"
expect "# "

send "echo 'Deployment script completed!'\r"
expect "# "

send "exit\r"
expect eof
EOF

# Make expect script executable
chmod +x /tmp/deploy_promoatlas.exp

# Run the deployment
echo -e "\nStarting deployment to $SERVER_IP...\n"
/tmp/deploy_promoatlas.exp "$SERVER_PASSWORD" "$SERVER_IP" "$GITHUB_REPO" "$PROJECT_DIR"

# Clean up
rm -f /tmp/deploy_promoatlas.exp

echo -e "\n======================================================"
echo "IMPORTANT: Next Steps"
echo "======================================================"
echo "1. The deployment script has been executed."
echo "2. You need to upload the production.env file to the server as .env"
echo "3. Use the upload-env.sh script to upload the environment file"
echo "4. Then restart the containers with restart-containers.sh"
echo "======================================================="