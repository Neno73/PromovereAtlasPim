#!/bin/bash

# Check PromoAtlas deployment status on Hetzner server

SERVER_IP="49.12.199.93"
SERVER_PASSWORD="PromoAtlas2025!"

echo "========================================="
echo "PromoAtlas Deployment Status Check"
echo "========================================="

# Check server connectivity
echo -e "\n1. Checking server connectivity..."
ping -c 1 $SERVER_IP > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "✅ Server is reachable at $SERVER_IP"
else
    echo "❌ Cannot reach server at $SERVER_IP"
    exit 1
fi

# Create expect script for SSH automation
cat > /tmp/check_promoatlas_status.exp << 'EOF'
#!/usr/bin/expect -f
set timeout 30
set password [lindex $argv 0]
set server_ip [lindex $argv 1]

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

expect "# " {
    send "echo '========================================'\r"
}

expect "# " {
    send "echo '2. Docker Service Status:'\r"
}

expect "# " {
    send "systemctl is-active docker\r"
}

expect "# " {
    send "echo '========================================'\r"
}

expect "# " {
    send "echo '3. Project Directory:'\r"
}

expect "# " {
    send "ls -la /opt/promoatlas/ 2>/dev/null || echo 'Directory not found'\r"
}

expect "# " {
    send "echo '========================================'\r"
}

expect "# " {
    send "echo '4. Docker Containers:'\r"
}

expect "# " {
    send "cd /opt/promoatlas 2>/dev/null && docker-compose -f docker-compose.prod.yml ps || docker ps -a\r"
}

expect "# " {
    send "echo '========================================'\r"
}

expect "# " {
    send "echo '5. Environment File Check:'\r"
}

expect "# " {
    send "cd /opt/promoatlas 2>/dev/null && [ -f .env ] && echo '✅ .env file exists' || echo '❌ .env file missing'\r"
}

expect "# " {
    send "echo '========================================'\r"
}

expect "# " {
    send "echo '6. Container Logs (last 10 lines):'\r"
}

expect "# " {
    send "cd /opt/promoatlas 2>/dev/null && docker-compose -f docker-compose.prod.yml logs --tail=10 backend 2>/dev/null || echo 'No backend logs available'\r"
}

expect "# " {
    send "echo '========================================'\r"
}

expect "# " {
    send "echo '7. Health Check:'\r"
}

expect "# " {
    send "curl -s http://localhost:1337/_health || echo 'Backend not responding'\r"
}

expect "# " {
    send "echo -e '\\n========================================'\r"
}

expect "# " {
    send "exit\r"
}

expect eof
EOF

# Make expect script executable
chmod +x /tmp/check_promoatlas_status.exp

# Run the expect script
echo -e "\nConnecting to server and checking status...\n"
/tmp/check_promoatlas_status.exp "$SERVER_PASSWORD" "$SERVER_IP"

# Clean up
rm -f /tmp/check_promoatlas_status.exp

echo -e "\n========================================="
echo "Status check completed!"
echo "========================================="