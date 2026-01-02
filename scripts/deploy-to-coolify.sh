#!/bin/bash
# ============================================
# PromoAtlas PIM - Coolify Deployment Script
# ============================================
#
# This script automates deployment to Coolify environments
#
# Usage:
#   ./scripts/deploy-to-coolify.sh staging
#   ./scripts/deploy-to-coolify.sh production
#
# Prerequisites:
#   - Coolify CLI installed: npm install -g coolify-cli
#   - Logged in to Coolify: coolify login
#   - Environment variables configured below
# ============================================

set -e  # Exit on error
set -o pipefail  # Exit on pipe failure

# ============================================
# Configuration
# ============================================

# Coolify Application UUIDs (get from Coolify dashboard)
STAGING_APP_UUID="${COOLIFY_STAGING_APP_UUID:-}"
PRODUCTION_APP_UUID="${COOLIFY_PRODUCTION_APP_UUID:-}"

# Health check URLs
STAGING_HEALTH_URL="${STAGING_HEALTH_URL:-https://staging.promoatlas.com/_health}"
PRODUCTION_HEALTH_URL="${PRODUCTION_HEALTH_URL:-https://api.promoatlas.com/_health}"

# Timeouts (seconds)
DEPLOY_TIMEOUT=600  # 10 minutes
HEALTH_CHECK_RETRIES=10
HEALTH_CHECK_INTERVAL=10

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ============================================
# Functions
# ============================================

log_info() {
  echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
  echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
  echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
  echo -e "${RED}❌ $1${NC}"
}

check_dependencies() {
  log_info "Checking dependencies..."

  # Check if coolify CLI is installed
  if ! command -v coolify &> /dev/null; then
    log_error "Coolify CLI not found!"
    echo "Install with: npm install -g coolify-cli"
    exit 1
  fi

  # Check if curl is installed
  if ! command -v curl &> /dev/null; then
    log_error "curl not found!"
    echo "Install curl to continue"
    exit 1
  fi

  log_success "All dependencies found"
}

validate_environment() {
  local ENV=$1

  if [ "$ENV" != "staging" ] && [ "$ENV" != "production" ]; then
    log_error "Invalid environment: $ENV"
    echo "Usage: $0 {staging|production}"
    exit 1
  fi

  # Check if APP_UUID is set
  if [ "$ENV" == "staging" ] && [ -z "$STAGING_APP_UUID" ]; then
    log_error "STAGING_APP_UUID not set!"
    echo "Set it in this script or as environment variable"
    exit 1
  fi

  if [ "$ENV" == "production" ] && [ -z "$PRODUCTION_APP_UUID" ]; then
    log_error "PRODUCTION_APP_UUID not set!"
    echo "Set it in this script or as environment variable"
    exit 1
  fi
}

check_git_status() {
  log_info "Checking git status..."

  # Check if there are uncommitted changes
  if [ -n "$(git status --porcelain)" ]; then
    log_warning "You have uncommitted changes!"
    echo "Uncommitted changes:"
    git status --short
    read -p "Continue anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
      log_info "Deployment cancelled"
      exit 0
    fi
  fi

  log_success "Git status clean (or ignored)"
}

deploy_application() {
  local ENV=$1
  local APP_UUID=$2

  log_info "Deploying PromoAtlas to $ENV..."

  # Trigger deployment
  if ! coolify app deploy "$APP_UUID"; then
    log_error "Deployment failed!"
    exit 1
  fi

  log_success "Deployment triggered successfully"
}

wait_for_deployment() {
  local ENV=$1
  local APP_UUID=$2

  log_info "Waiting for deployment to complete..."

  local ELAPSED=0
  local INTERVAL=5

  while [ $ELAPSED -lt $DEPLOY_TIMEOUT ]; do
    # Check deployment status
    STATUS=$(coolify app get "$APP_UUID" 2>/dev/null | grep -i "status" | head -1 || echo "unknown")

    if echo "$STATUS" | grep -iq "running"; then
      log_success "Deployment completed"
      return 0
    fi

    if echo "$STATUS" | grep -iq "failed"; then
      log_error "Deployment failed!"
      return 1
    fi

    # Show progress
    echo -ne "\r⏳ Waiting... ${ELAPSED}s / ${DEPLOY_TIMEOUT}s"

    sleep $INTERVAL
    ELAPSED=$((ELAPSED + INTERVAL))
  done

  echo  # New line after progress
  log_error "Deployment timeout!"
  return 1
}

check_health() {
  local ENV=$1
  local HEALTH_URL=$2

  log_info "Checking application health..."

  local RETRY=0
  while [ $RETRY -lt $HEALTH_CHECK_RETRIES ]; do
    # Try health check
    if curl -f -s -o /dev/null -w "%{http_code}" "$HEALTH_URL" | grep -q "200"; then
      log_success "Health check passed!"
      echo "URL: $HEALTH_URL"
      return 0
    fi

    RETRY=$((RETRY + 1))
    if [ $RETRY -lt $HEALTH_CHECK_RETRIES ]; then
      log_warning "Health check failed (attempt $RETRY/$HEALTH_CHECK_RETRIES), retrying..."
      sleep $HEALTH_CHECK_INTERVAL
    fi
  done

  log_error "Health check failed after $HEALTH_CHECK_RETRIES attempts!"
  return 1
}

show_logs() {
  local APP_UUID=$1

  log_info "Fetching recent logs..."

  echo ""
  echo "=== Strapi Logs ==="
  coolify app logs "$APP_UUID" --service strapi --tail 20 || log_warning "Could not fetch Strapi logs"

  echo ""
  echo "=== Worker Logs ==="
  coolify app logs "$APP_UUID" --service workers --tail 20 || log_warning "Could not fetch Worker logs"
}

prompt_production_confirmation() {
  log_warning "You are about to deploy to PRODUCTION!"
  echo ""
  echo "Current branch: $(git branch --show-current)"
  echo "Last commit: $(git log -1 --oneline)"
  echo ""
  read -p "Are you absolutely sure? Type 'DEPLOY' to confirm: " CONFIRM

  if [ "$CONFIRM" != "DEPLOY" ]; then
    log_info "Production deployment cancelled"
    exit 0
  fi
}

# ============================================
# Main Deployment Function
# ============================================

deploy() {
  local ENV=$1

  echo ""
  echo "========================================"
  echo "  PromoAtlas Coolify Deployment"
  echo "  Environment: $ENV"
  echo "========================================"
  echo ""

  # Set environment-specific variables
  if [ "$ENV" == "staging" ]; then
    APP_UUID="$STAGING_APP_UUID"
    HEALTH_URL="$STAGING_HEALTH_URL"
  else
    APP_UUID="$PRODUCTION_APP_UUID"
    HEALTH_URL="$PRODUCTION_HEALTH_URL"

    # Extra confirmation for production
    prompt_production_confirmation
  fi

  # Run pre-deployment checks
  check_dependencies
  validate_environment "$ENV"
  check_git_status

  # Deploy
  deploy_application "$ENV" "$APP_UUID"

  # Wait for deployment
  if ! wait_for_deployment "$ENV" "$APP_UUID"; then
    log_error "Deployment failed or timed out!"
    show_logs "$APP_UUID"
    exit 1
  fi

  # Health check
  if ! check_health "$ENV" "$HEALTH_URL"; then
    log_error "Health check failed!"
    show_logs "$APP_UUID"
    exit 1
  fi

  # Success!
  echo ""
  echo "========================================"
  log_success "Deployment to $ENV completed successfully! 🎉"
  echo "========================================"
  echo ""
  echo "Next steps:"
  echo "  - View logs: coolify app logs $APP_UUID --follow"
  echo "  - Check health: curl $HEALTH_URL"
  echo "  - Open dashboard: $HEALTH_URL"
  echo ""
}

# ============================================
# Script Entry Point
# ============================================

# Check if environment argument provided
if [ $# -eq 0 ]; then
  log_error "No environment specified!"
  echo "Usage: $0 {staging|production}"
  exit 1
fi

# Deploy
deploy "$1"
