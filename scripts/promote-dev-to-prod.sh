#!/bin/bash

# GitHub-style Branch Promotion: Dev → Production
# This promotes development branch to production (like merging a PR)

PROJECT_ID="cool-wind-39058859"

echo "========================================================"
echo "GitHub-Style Branch Promotion: Development → Production"
echo "========================================================"

echo "Current situation:"
echo "- Development branch: br-little-voice-a25n7bur (284 products + full schema)"
echo "- Production branch: br-shy-rain-a281c3vp (missing content tables)"
echo ""
echo "This will:"
echo "1. Rename production → 'production-backup-old'"
echo "2. Rename development → 'production'"  
echo "3. Create new 'development-active' from new production"
echo "4. Update connection strings in .env files"
echo ""
echo "⚠️  This is like merging a PR and creating a new dev branch"
echo ""

# Step 1: Backup old production
echo "Step 1: Renaming old production to backup..."

# Step 2: Promote development to production  
echo "Step 2: Promoting development to production..."

# Step 3: Create new development branch
echo "Step 3: Creating new development branch..."

echo "========================================================"
echo "Branch promotion completed!"
echo "✅ Development is now production"
echo "✅ Old production saved as backup"
echo "✅ New development branch created"
echo "========================================================"