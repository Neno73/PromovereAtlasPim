#!/bin/bash

# Neon Database Backup Rotation Script
# This script manages manual backup creation and rotation within the 10-branch limit

PROJECT_ID="cool-wind-39058859"
DATE=$(date +%Y%m%d)
TIME=$(date +%H%M)

echo "========================================================"
echo "Neon Backup Rotation - $(date)"
echo "========================================================"

# Function to create backup with rotation
create_backup() {
    local backup_type=$1
    local new_name="backup-${backup_type}-${DATE}"
    local old_name="backup-${backup_type}-latest"
    
    echo "Creating ${backup_type} backup..."
    
    # Delete old backup if exists
    if neon branches list --project-id $PROJECT_ID | grep -q "$old_name"; then
        echo "Deleting old backup: $old_name"
        neon branches delete --project-id $PROJECT_ID --branch-id $(neon branches list --project-id $PROJECT_ID | grep "$old_name" | awk '{print $1}') --confirm
    fi
    
    # Create new backup from production
    echo "Creating new backup: $new_name"
    neon branches create --project-id $PROJECT_ID --name "$new_name" --parent production
    
    # Rename to latest
    neon branches rename --project-id $PROJECT_ID --branch-id $(neon branches list --project-id $PROJECT_ID | grep "$new_name" | awk '{print $1}') --name "$old_name"
}

# Current branch count
echo "Current branches:"
neon branches list --project-id $PROJECT_ID

# Determine what backup to create based on time
HOUR=$(date +%H)
DAY_OF_WEEK=$(date +%u)

if [ "$HOUR" = "00" ] && [ "$DAY_OF_WEEK" = "1" ]; then
    # Monday midnight - weekly backup
    create_backup "weekly"
    echo "✅ Weekly backup created"
elif [ "$HOUR" = "00" ]; then
    # Daily midnight backup
    create_backup "daily"
    echo "✅ Daily backup created"
elif [ $(($HOUR % 6)) = "0" ]; then
    # Every 6 hours
    create_backup "6hour"
    echo "✅ 6-hour backup created"
else
    # Hourly backup
    create_backup "hourly"
    echo "✅ Hourly backup created"
fi

echo "========================================================"
echo "Final branch count:"
neon branches list --project-id $PROJECT_ID | wc -l
echo "========================================================"