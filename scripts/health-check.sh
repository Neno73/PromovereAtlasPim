#!/bin/bash
# ============================================
# PromoAtlas PIM - Health Check Script
# ============================================
#
# This script performs comprehensive health checks on deployed PromoAtlas instances
#
# Usage:
#   ./scripts/health-check.sh staging
#   ./scripts/health-check.sh production
#   ./scripts/health-check.sh https://custom-url.com
#
# Prerequisites:
#   - curl installed
#   - jq installed (optional, for JSON parsing)
# ============================================

set -e

# ============================================
# Configuration
# ============================================

# Default health check URLs
STAGING_URL="${STAGING_URL:-https://staging.promoatlas.com}"
PRODUCTION_URL="${PRODUCTION_URL:-https://api.promoatlas.com}"

# Timeout for requests (seconds)
REQUEST_TIMEOUT=10

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

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

check_dependency() {
  local CMD=$1
  if ! command -v "$CMD" &> /dev/null; then
    log_warning "$CMD not found (optional)"
    return 1
  fi
  return 0
}

# Parse JSON response (if jq available)
parse_json() {
  local JSON=$1
  local KEY=$2

  if check_dependency jq; then
    echo "$JSON" | jq -r ".$KEY"
  else
    echo "$JSON" | grep -o "\"$KEY\":\"[^\"]*\"" | cut -d'"' -f4
  fi
}

# Check HTTP endpoint
check_endpoint() {
  local URL=$1
  local ENDPOINT=$2
  local EXPECTED_STATUS=${3:-200}

  local FULL_URL="$URL$ENDPOINT"

  log_info "Checking: $FULL_URL"

  # Make request
  local RESPONSE=$(curl -s -w "\n%{http_code}" --max-time "$REQUEST_TIMEOUT" "$FULL_URL" 2>/dev/null || echo -e "\n000")
  local BODY=$(echo "$RESPONSE" | head -n -1)
  local STATUS=$(echo "$RESPONSE" | tail -n 1)

  # Check status code
  if [ "$STATUS" == "$EXPECTED_STATUS" ]; then
    log_success "Status: $STATUS (OK)"
    return 0
  else
    log_error "Status: $STATUS (Expected: $EXPECTED_STATUS)"
    return 1
  fi
}

# Check health endpoint
check_health_endpoint() {
  local URL=$1

  local FULL_URL="$URL/_health"

  log_info "Checking health endpoint..."

  # Make request
  local RESPONSE=$(curl -s --max-time "$REQUEST_TIMEOUT" "$FULL_URL" 2>/dev/null || echo "")

  if [ -z "$RESPONSE" ]; then
    log_error "No response from health endpoint"
    return 1
  fi

  # Parse status
  local STATUS=$(parse_json "$RESPONSE" "status")

  if [ "$STATUS" == "ok" ]; then
    log_success "Health status: $STATUS"

    # Parse timestamp if available
    local TIMESTAMP=$(parse_json "$RESPONSE" "timestamp")
    if [ -n "$TIMESTAMP" ] && [ "$TIMESTAMP" != "null" ]; then
      echo "  Last updated: $TIMESTAMP"
    fi

    return 0
  else
    log_error "Health status: $STATUS"
    return 1
  fi
}

# Check API endpoint
check_api_endpoint() {
  local URL=$1

  log_info "Checking API endpoint..."

  # Try to fetch products (should be publicly accessible)
  if check_endpoint "$URL" "/api/products?pagination[pageSize]=1" 200; then
    log_success "API endpoint accessible"
    return 0
  else
    log_error "API endpoint not accessible"
    return 1
  fi
}

# Check response time
check_response_time() {
  local URL=$1

  local FULL_URL="$URL/_health"

  log_info "Checking response time..."

  # Measure response time
  local START=$(date +%s%N)
  curl -s -o /dev/null --max-time "$REQUEST_TIMEOUT" "$FULL_URL" 2>/dev/null || true
  local END=$(date +%s%N)

  local ELAPSED_MS=$(( (END - START) / 1000000 ))

  if [ $ELAPSED_MS -lt 500 ]; then
    log_success "Response time: ${ELAPSED_MS}ms (Excellent)"
  elif [ $ELAPSED_MS -lt 1000 ]; then
    log_success "Response time: ${ELAPSED_MS}ms (Good)"
  elif [ $ELAPSED_MS -lt 2000 ]; then
    log_warning "Response time: ${ELAPSED_MS}ms (Slow)"
  else
    log_error "Response time: ${ELAPSED_MS}ms (Very Slow)"
  fi
}

# Check SSL certificate
check_ssl() {
  local URL=$1

  # Extract hostname
  local HOSTNAME=$(echo "$URL" | sed -e 's|^[^/]*//||' -e 's|/.*$||')

  log_info "Checking SSL certificate for $HOSTNAME..."

  # Get certificate info
  local CERT_INFO=$(echo | openssl s_client -servername "$HOSTNAME" -connect "$HOSTNAME:443" 2>/dev/null | openssl x509 -noout -dates 2>/dev/null || echo "")

  if [ -z "$CERT_INFO" ]; then
    log_warning "Could not fetch SSL certificate (might be HTTP only)"
    return 1
  fi

  # Parse expiry date
  local EXPIRY=$(echo "$CERT_INFO" | grep "notAfter" | cut -d= -f2)

  if [ -n "$EXPIRY" ]; then
    log_success "SSL certificate valid"
    echo "  Expires: $EXPIRY"
    return 0
  else
    log_warning "Could not parse SSL expiry"
    return 1
  fi
}

# Comprehensive health check
run_health_check() {
  local URL=$1
  local ENV_NAME=$2

  echo ""
  echo "========================================"
  echo "  PromoAtlas Health Check"
  echo "  Environment: $ENV_NAME"
  echo "  URL: $URL"
  echo "========================================"
  echo ""

  local CHECKS_PASSED=0
  local CHECKS_TOTAL=5

  # 1. Health endpoint
  if check_health_endpoint "$URL"; then
    ((CHECKS_PASSED++))
  fi
  echo ""

  # 2. API endpoint
  if check_api_endpoint "$URL"; then
    ((CHECKS_PASSED++))
  fi
  echo ""

  # 3. Response time
  check_response_time "$URL"
  ((CHECKS_PASSED++))  # Always count as passed (just informational)
  echo ""

  # 4. SSL certificate (if HTTPS)
  if [[ "$URL" == https://* ]]; then
    if check_ssl "$URL"; then
      ((CHECKS_PASSED++))
    fi
  else
    log_warning "Skipping SSL check (HTTP URL)"
  fi
  echo ""

  # Summary
  echo "========================================"
  echo "  Health Check Summary"
  echo "========================================"
  echo ""
  echo "  Checks passed: $CHECKS_PASSED / $CHECKS_TOTAL"

  if [ $CHECKS_PASSED -eq $CHECKS_TOTAL ]; then
    log_success "All checks passed! 🎉"
    return 0
  elif [ $CHECKS_PASSED -ge 3 ]; then
    log_warning "Some checks failed, but system is mostly operational"
    return 1
  else
    log_error "Multiple checks failed! System may not be operational"
    return 1
  fi
}

# ============================================
# Script Entry Point
# ============================================

# Parse arguments
if [ $# -eq 0 ]; then
  log_error "No environment or URL specified!"
  echo "Usage: $0 {staging|production|URL}"
  echo ""
  echo "Examples:"
  echo "  $0 staging"
  echo "  $0 production"
  echo "  $0 https://my-custom-url.com"
  exit 1
fi

# Determine URL
case "$1" in
  staging)
    URL="$STAGING_URL"
    ENV_NAME="Staging"
    ;;
  production)
    URL="$PRODUCTION_URL"
    ENV_NAME="Production"
    ;;
  http://*|https://*)
    URL="$1"
    ENV_NAME="Custom"
    ;;
  *)
    log_error "Invalid argument: $1"
    echo "Usage: $0 {staging|production|URL}"
    exit 1
    ;;
esac

# Run health check
run_health_check "$URL" "$ENV_NAME"
EXIT_CODE=$?

echo ""
exit $EXIT_CODE
