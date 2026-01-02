#!/bin/bash
# Monitor Coolify deployment status

COOLIFY_URL="https://servers.sols.mk"
COOLIFY_TOKEN="1|f9CGsPrnVXKRKelwRzPukIJKCoeBFaREjAJbvQFT57aed3bb"
APP_UUID="hcww0ks0gc08s4c80oggc00s"
PUBLIC_URL="http://fwkk4wkkw44wskgosc4og8cw.46.62.239.73.sslip.io"

echo "========================================"
echo "Coolify Deployment Monitor"
echo "========================================"
echo ""

# Check application status
echo "1. Checking application status..."
APP_STATUS=$(curl -s -H "Authorization: Bearer $COOLIFY_TOKEN" \
  "$COOLIFY_URL/api/v1/applications" | \
  grep -A 5 "\"uuid\":\"$APP_UUID\"" | \
  grep "\"status\"" | \
  sed 's/.*"status":"\([^"]*\)".*/\1/')

if [ -n "$APP_STATUS" ]; then
    echo "   Application status: $APP_STATUS"
else
    echo "   ⚠️  Could not fetch application status"
fi
echo ""

# Check public URL
echo "2. Testing public URL..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$PUBLIC_URL/_health" 2>/dev/null || echo "000")

if [ "$HTTP_CODE" = "200" ]; then
    echo "   ✅ Public URL is accessible (HTTP $HTTP_CODE)"
    curl -s "$PUBLIC_URL/_health" | python3 -m json.tool 2>/dev/null || echo ""
elif [ "$HTTP_CODE" = "404" ]; then
    echo "   ❌ Public URL returns 404 (reverse proxy not routing)"
elif [ "$HTTP_CODE" = "000" ]; then
    echo "   ❌ Public URL unreachable (network error)"
else
    echo "   ⚠️  Public URL returns HTTP $HTTP_CODE"
fi
echo ""

# Check Coolify version
echo "3. Coolify version..."
COOLIFY_VERSION=$(curl -s -H "Authorization: Bearer $COOLIFY_TOKEN" "$COOLIFY_URL/api/v1/version")
echo "   Version: $COOLIFY_VERSION"
echo ""

echo "========================================"
echo "Dashboard URL: $COOLIFY_URL"
echo "Application UUID: $APP_UUID"
echo "Public URL: $PUBLIC_URL"
echo "========================================"
echo ""
echo "Next steps:"
echo "1. Open Coolify dashboard: $COOLIFY_URL"
echo "2. Navigate to your application (develop branch)"
echo "3. Check 'Deployments' tab for build logs"
echo "4. Check 'Logs' tab for runtime logs"
echo "5. Verify Traefik proxy is running in Server settings"
