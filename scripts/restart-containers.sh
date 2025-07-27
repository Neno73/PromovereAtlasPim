#!/bin/bash

# Restart PromoAtlas containers after environment update

SERVER_IP="49.12.199.93"
SERVER_PASSWORD="PromoAtlas2025!"
PROJECT_DIR="/opt/promoatlas"

echo "======================================================"
echo "Restarting PromoAtlas Containers"
echo "======================================================"

# Create expect script for restarting containers
cat > /tmp/restart_containers.exp << 'EOF'
#!/usr/bin/expect -f
set timeout 120
set password [lindex $argv 0]
set server_ip [lindex $argv 1]
set project_dir [lindex $argv 2]

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

expect "# "
send "cd $project_dir\r"
expect "# "

send "echo 'Stopping containers...'\r"
expect "# "
send "docker-compose -f docker-compose.prod.yml down\r"
expect "# "

send "echo 'Starting containers with new configuration...'\r"
expect "# "
send "docker-compose -f docker-compose.prod.yml up -d\r"
expect "# "

send "echo 'Waiting for containers to start...'\r"
expect "# "
send "sleep 10\r"
expect "# "

send "echo 'Container status:'\r"
expect "# "
send "docker-compose -f docker-compose.prod.yml ps\r"
expect "# "

send "echo 'Checking backend health...'\r"
expect "# "
send "curl -s http://localhost:1337/_health || echo 'Backend not ready yet'\r"
expect "# "

send "echo 'Recent logs:'\r"
expect "# "
send "docker-compose -f docker-compose.prod.yml logs --tail=30 backend\r"
expect "# "

send "exit\r"
expect eof
EOF

# Make expect script executable
chmod +x /tmp/restart_containers.exp

# Run the restart
echo "Restarting containers on $SERVER_IP..."
/tmp/restart_containers.exp "$SERVER_PASSWORD" "$SERVER_IP" "$PROJECT_DIR"

# Clean up
rm -f /tmp/restart_containers.exp

echo -e "\n======================================================"
echo "Container restart completed!"
echo "======================================================="