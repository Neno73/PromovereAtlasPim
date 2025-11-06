# Domain Setup Guide

*Last updated: 2025-11-06*

Guide for configuring custom domains for PromoAtlas PIM on Coolify.

---

## Domain Structure

**Base Domain**: `solslab.dev` (managed in Cloudflare)

**Subdomains**:
- **Staging**: `strapistaging.solslab.dev` (develop branch)
- **Production**: `strapi.solslab.dev` (main branch)
- **Coolify Dashboard**: `servers.sols.mk` (separate, stays as-is)

---

## Step 1: Cloudflare DNS Configuration

### DNS Records to Add

Go to Cloudflare dashboard → **DNS** → **Records**:

| Type | Name | Content | Proxy Status | TTL |
|------|------|---------|--------------|-----|
| **A** | `strapistaging` | `46.62.239.73` | 🔴 DNS only (gray cloud) | Auto |
| **A** | `strapi` | `46.62.239.73` | 🔴 DNS only (gray cloud) | Auto |

### Important: Disable Cloudflare Proxy

**Why?**
- Traefik (Coolify's reverse proxy) needs direct access for Let's Encrypt SSL
- Cloudflare proxy (orange cloud) interferes with certificate provisioning
- Once SSL is set up, you can optionally re-enable proxy

**How to disable:**
1. Click the **orange cloud** icon next to each record
2. It should turn **gray** (DNS only)
3. Save changes

### DNS Propagation

- **Time**: 1-5 minutes (Cloudflare is fast)
- **Verify**: `dig strapistaging.solslab.dev` should return `46.62.239.73`

---

## Step 2: Update Coolify Application Domain

### Via Coolify Dashboard (Recommended)

1. **Open Coolify**: https://servers.sols.mk

2. **Navigate to Staging Application**:
   - Applications → Find develop branch app
   - Or search: `neno73/-promovere-atlas-pim:main-xs0sgg4skk8kw4c8kkwc004c`

3. **Update Domain**:
   - Go to **"General"** tab
   - Scroll to **"Domains"** section
   - Find **strapi** service entry
   - Change domain:
     - From: `http://fwkk4wkkw44wskgosc4og8cw.46.62.239.73.sslip.io`
     - To: `https://strapistaging.solslab.dev`
   - ✅ **Use HTTPS** (Traefik auto-provisions SSL)
   - Click **"Save"**

4. **Redeploy**:
   - Click **"Deploy"** button
   - Monitor build logs
   - Wait for "Deployment successful" (~2-5 min)

5. **Verify SSL Certificate**:
   - After deployment completes
   - Visit: https://strapistaging.solslab.dev/_health
   - Check browser shows 🔒 (valid SSL)
   - Response: `{"status":"ok","timestamp":"..."}` ✅

### Via API (Alternative)

```bash
curl -X PATCH \
  -H "Authorization: Bearer YOUR_COOLIFY_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "domains": {
      "strapi": {
        "domain": "https://strapistaging.solslab.dev"
      }
    }
  }' \
  "https://servers.sols.mk/api/v1/applications/hcww0ks0gc08s4c80oggc00s"
```

---

## Step 3: Configure Production Domain

**When ready to deploy to production:**

1. Create **production** application in Coolify (main branch)
2. Set domain to: `https://strapi.solslab.dev`
3. Use separate environment variables (different database, R2 bucket, secrets)
4. Follow same DNS + Coolify setup as staging

---

## Troubleshooting

### Issue: SSL Certificate Not Provisioning

**Symptoms:**
- Browser shows "Not Secure"
- Traefik logs show Let's Encrypt errors

**Solution:**
```bash
# 1. Verify DNS resolves to correct IP
dig strapistaging.solslab.dev
# Should return: 46.62.239.73

# 2. Verify port 80 and 443 are accessible
curl -I http://strapistaging.solslab.dev
# Should not timeout

# 3. Check Cloudflare proxy is disabled (gray cloud)
# 4. Redeploy application in Coolify
# 5. Check Traefik logs in Coolify dashboard
```

### Issue: Domain Not Accessible (404)

**Symptoms:**
- DNS resolves correctly
- Port 80/443 accessible
- Still returns 404

**Solution:**
```bash
# 1. Verify Traefik proxy is running
# Coolify dashboard → Servers → localhost → Proxy → Should be "Running"

# 2. Check container is on 'coolify' network
docker inspect promoatlas-backend --format '{{range $net, $conf := .NetworkSettings.Networks}}{{$net}}{{end}}'
# Should output: coolify

# 3. Verify domain is set in Coolify
# Dashboard → Application → General → Domains

# 4. Check Traefik routing
# Dashboard → Servers → Proxy → Logs
# Look for route creation logs
```

### Issue: Cloudflare Proxy Interference

**Symptoms:**
- SSL provisioning fails with "DNS challenge failed"
- Works with proxy disabled, fails with proxy enabled

**Solution:**
- Keep Cloudflare proxy **disabled** (gray cloud) for SSL provisioning
- After SSL is working, you can optionally enable proxy
- If enabling proxy, set SSL mode to "Full (strict)" in Cloudflare SSL/TLS settings

---

## Environment-Specific Domains

### Development (Local)
```
http://localhost:1337
```

### Staging (Coolify - develop branch)
```
https://strapistaging.solslab.dev
```

### Production (Coolify - main branch)
```
https://strapi.solslab.dev
```

### Coolify Dashboard (Unchanged)
```
https://servers.sols.mk
```

---

## SSL Certificate Management

### Automatic (Let's Encrypt via Traefik)

Coolify/Traefik automatically:
- Provisions SSL certificates via Let's Encrypt
- Renews certificates before expiry (90 days)
- Handles HTTP → HTTPS redirect

**Certificate Location** (on server):
```
/var/lib/docker/volumes/coolify-traefik-letsencrypt/_data/
```

**Certificate Renewal**:
- Automatic (no manual action needed)
- Traefik checks every 24 hours
- Renews at 30 days before expiry

### Manual Certificate Check

```bash
# Check certificate expiry
echo | openssl s_client -servername strapistaging.solslab.dev -connect 46.62.239.73:443 2>/dev/null | openssl x509 -noout -dates

# Expected output:
# notBefore=Nov  6 00:00:00 2025 GMT
# notAfter=Feb  4 23:59:59 2026 GMT
```

---

## Frontend Configuration

Update frontend environment variables to use custom domain:

**Frontend `.env` (if using separate frontend):**
```bash
VITE_API_URL=https://strapistaging.solslab.dev/api  # Staging
# or
VITE_API_URL=https://strapi.solslab.dev/api  # Production
```

**CORS Configuration** (backend `config/middlewares.ts`):
```typescript
export default [
  'strapi::errors',
  {
    name: 'strapi::security',
    config: {
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          'connect-src': ["'self'", 'https:', 'https://strapistaging.solslab.dev'],
          'img-src': ["'self'", 'data:', 'blob:', 'https://pub-*.r2.dev'],
          'media-src': ["'self'", 'data:', 'blob:', 'https://pub-*.r2.dev'],
        },
      },
    },
  },
  {
    name: 'strapi::cors',
    config: {
      origin: [
        'http://localhost:3000',
        'https://strapistaging.solslab.dev',
        'https://strapi.solslab.dev',
      ],
    },
  },
  // ... other middlewares
];
```

---

## Monitoring & Verification

### Health Check
```bash
curl https://strapistaging.solslab.dev/_health
```

**Expected Response:**
```json
{
  "status": "ok",
  "timestamp": "2025-11-06T22:30:00.000Z",
  "uptime": 1234,
  "environment": "production"
}
```

### API Test
```bash
curl https://strapistaging.solslab.dev/api/products?pagination[pageSize]=1
```

**Expected Response:**
```json
{
  "data": [...],
  "meta": {
    "pagination": {
      "page": 1,
      "pageSize": 1,
      "total": 123
    }
  }
}
```

---

## Quick Reference

### DNS Configuration
```
strapistaging.solslab.dev → A → 46.62.239.73 (Proxy: OFF)
strapi.solslab.dev → A → 46.62.239.73 (Proxy: OFF)
```

### Coolify Domains
```
Staging:    https://strapistaging.solslab.dev
Production: https://strapi.solslab.dev
```

### Verification Commands
```bash
# DNS
dig strapistaging.solslab.dev

# SSL
curl -I https://strapistaging.solslab.dev

# Health
curl https://strapistaging.solslab.dev/_health

# Monitor
./scripts/monitor-coolify-deployment.sh
```

---

*Keep this document updated when adding new domains or changing DNS configuration.*
