#!/bin/bash

# Upload production environment file to Hetzner server

SERVER_IP="49.12.199.93"
SERVER_PASSWORD="PromoAtlas2025!"
PROJECT_DIR="/opt/promoatlas"
LOCAL_ENV_FILE="production.env"

echo "======================================================"
echo "Uploading Environment Configuration"
echo "======================================================"

# Check if production.env exists
if [ ! -f "$LOCAL_ENV_FILE" ]; then
    echo "ERROR: $LOCAL_ENV_FILE not found!"
    exit 1
fi

# Create expect script for uploading env file
cat > /tmp/upload_env.exp << 'EOF'
#!/usr/bin/expect -f
set timeout 60
set password [lindex $argv 0]
set server_ip [lindex $argv 1]
set project_dir [lindex $argv 2]

# First, upload the file using scp
spawn scp production.env root@$server_ip:$project_dir/.env

expect {
    "password:" {
        send "$password\r"
    }
    "Are you sure you want to continue connecting" {
        send "yes\r"
        exp_continue
    }
    timeout {
        puts "ERROR: SCP timeout"
        exit 1
    }
}

expect {
    "100%" {
        puts "\n✅ Environment file uploaded successfully"
    }
    timeout {
        puts "\n❌ Failed to upload environment file"
        exit 1
    }
}

# Now verify the upload
spawn ssh -o StrictHostKeyChecking=no root@$server_ip

expect {
    "password:" {
        send "$password\r"
    }
    timeout {
        puts "ERROR: SSH timeout"
        exit 1
    }
}

expect "# "
send "cd $project_dir\r"
expect "# "

send "echo 'Verifying environment file...'\r"
expect "# "

send "if [ -f .env ]; then echo '✅ .env file exists'; wc -l .env; else echo '❌ .env file not found'; fi\r"
expect "# "

send "echo 'Setting proper permissions...'\r"
expect "# "

send "chmod 600 .env\r"
expect "# "

send "echo 'Environment file setup complete!'\r"
expect "# "

send "exit\r"
expect eof
EOF

# Make expect script executable
chmod +x /tmp/upload_env.exp

# Run the upload
echo "Uploading $LOCAL_ENV_FILE to $SERVER_IP:$PROJECT_DIR/.env"
/tmp/upload_env.exp "$SERVER_PASSWORD" "$SERVER_IP" "$PROJECT_DIR"

# Clean up
rm -f /tmp/upload_env.exp

echo -e "\n======================================================"
echo "Environment file upload completed!"
echo "======================================================="