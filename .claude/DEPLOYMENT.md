# Deployment Guide

*Last updated: 2025-11-09 23:00*

Complete deployment guide for PromoAtlas PIM using Coolify.

## Current Deployment Status ✅

**Live Staging Environment** (as of 2025-11-09):
- ✅ URL: https://strapistaging.solslab.dev
- ✅ Server: Coolify localhost (46.62.239.73)
- ✅ SSL: Let's Encrypt (automatic)
- ✅ DNS: Cloudflare wildcard (*.solslab.dev)
- ✅ Container: Running and healthy
- ✅ Routing: Traefik reverse proxy

---

## Domain Setup

### solslab.dev (Dedicated Coolify Domain)

**Purpose**: All Coolify-managed services use subdomains of solslab.dev

**Cloudflare DNS Configuration**:
```
┌──────┬─────────────┬────────────────┬─────────────┬──────────────────────┐
│ Type │ Name        │ Content        │ Proxy       │ Purpose              │
├──────┼─────────────┼────────────────┼─────────────┼──────────────────────┤
│ A    │ *           │ 46.62.239.73   │ DNS only ☁️ │ Wildcard for all     │
│ A    │ @           │ 46.62.239.73   │ DNS only ☁️ │ Root domain          │
└──────┴─────────────┴────────────────┴─────────────┴──────────────────────┘
```

**Key Points**:
- ✅ Wildcard DNS means ANY subdomain automatically resolves to Coolify server
- ✅ No manual DNS records needed for new services
- ✅ Proxy status MUST be OFF (grey cloud) for Let's Encrypt to work
- ✅ Traefik handles SSL certificates automatically

**Current Subdomains**:
- `strapistaging.solslab.dev` → Strapi staging backend
- Future: `api.solslab.dev`, `db.solslab.dev`, etc.

---

### sols.mk (Mixed Usage Domain)

**Purpose**: Services on multiple servers (not just Coolify)

**DNS Configuration**: Individual A records for each service
- `servers.sols.mk` → Coolify admin panel
- `pgadmin.sols.mk` → PostgreSQL admin (Promovere server)
- `search.sols.mk` → Meilisearch service

---

## Coolify Server Setup

### Server Configuration

**Localhost Server** (46.62.239.73):
- **Server Type**: Coolify host server
- **Proxy**: Traefik (automatic reverse proxy)
- **Networks**: `coolify` network for all services
- **Wildcard Domain**: REMOVED (prevents routing conflicts)

**Important**: Do NOT set "Wildcard Domain" in Coolify server settings if you're using explicit Traefik labels in docker-compose files.

---

### Traefik Proxy Configuration

**How Routing Works**:
```
1. User requests: https://strapistaging.solslab.dev
   ↓
2. Cloudflare DNS: Resolves to 46.62.239.73
   ↓
3. Traefik (on port 80/443): Reads Host header
   ↓
4. Matches Traefik label: Host(`strapistaging.solslab.dev`)
   ↓
5. Routes to container: promoatlas-backend:1337
   ↓
6. Strapi responds
```

**Traefik Labels** (in docker-compose.coolify.yml):
```yaml
labels:
  - "traefik.enable=true"
  # HTTP router (redirects to HTTPS)
  - "traefik.http.routers.strapi-http.rule=Host(`strapistaging.solslab.dev`)"
  - "traefik.http.routers.strapi-http.entrypoints=http"
  - "traefik.http.routers.strapi-http.middlewares=redirect-to-https"
  # HTTPS router with Let's Encrypt
  - "traefik.http.routers.strapi-https.rule=Host(`strapistaging.solslab.dev`)"
  - "traefik.http.routers.strapi-https.entrypoints=https"
  - "traefik.http.routers.strapi-https.tls=true"
  - "traefik.http.routers.strapi-https.tls.certresolver=letsencrypt"
  # Service configuration
  - "traefik.http.services.strapi.loadbalancer.server.port=1337"
  # Middleware for HTTPS redirect
  - "traefik.http.middlewares.redirect-to-https.redirectscheme.scheme=https"
```

---

## Deployment Workflow

### Initial Setup (One-Time)

1. **Set up Cloudflare DNS**:
   - Add wildcard A record: `*` → `46.62.239.73` (Proxy OFF)
   - Add root A record: `@` → `46.62.239.73` (Proxy OFF)

2. **Configure Coolify Server**:
   - Remove wildcard domain from server settings (if set)
   - Ensure Traefik proxy is running

3. **Create Application in Coolify**:
   - Project: PromovereAtlasPim
   - Environment: staging
   - Build Pack: Docker Compose
   - Docker Compose File: `docker-compose.coolify.yml`
   - Base Directory: `.` (root)
   - Branch: `develop`

4. **Configure Environment Variables**:
   - Add all required env vars in Coolify UI (Environment Variables section)
   - Variables are stored in Coolify's database (encrypted)
   - Never committed to GitHub

5. **Leave Domains Field EMPTY**:
   - In Configuration → General → Domains for strapi
   - Keep it blank (routing handled by Traefik labels in compose file)

---

### Deployment Process

**Every deployment follows this flow**:

1. **Make Changes Locally**:
   ```bash
   # Edit code/config
   git add .
   git commit -m "Your changes"
   git push origin develop
   ```

2. **Trigger Deployment in Coolify**:
   - Click "Redeploy" button in Coolify UI
   - Or configure webhook for auto-deploy on push

3. **Coolify Deployment Steps**:
   ```
   1. Pull latest code from GitHub (branch: develop)
   2. Read docker-compose.coolify.yml
   3. Inject environment variables from Coolify database
   4. Build Docker image (if needed)
   5. Generate runtime docker-compose with all labels
   6. Stop old container
   7. Start new container
   8. Health check (90s timeout)
   9. Traefik auto-configures routing
   10. Let's Encrypt requests SSL certificate (if needed)
   11. Service goes live
   ```

4. **Monitor Deployment**:
   - Watch logs in Coolify UI (Logs tab)
   - Check container status (should be "Running (healthy)")
   - Verify access: https://strapistaging.solslab.dev

---

### Adding New Services to solslab.dev

**Steps** (Easy - No DNS changes needed!):

1. **Add service to docker-compose.coolify.yml**:
   ```yaml
   services:
     myservice:
       image: myimage:latest
       labels:
         - "coolify.managed=true"
         - "traefik.enable=true"
         - "traefik.http.routers.myservice-https.rule=Host(`myservice.solslab.dev`)"
         - "traefik.http.routers.myservice-https.entrypoints=https"
         - "traefik.http.routers.myservice-https.tls=true"
         - "traefik.http.routers.myservice-https.tls.certresolver=letsencrypt"
         - "traefik.http.services.myservice.loadbalancer.server.port=8080"
       networks:
         - promoatlas
   ```

2. **Commit and push**:
   ```bash
   git add docker-compose.coolify.yml
   git commit -m "Add myservice to deployment"
   git push origin develop
   ```

3. **Redeploy in Coolify**: Click "Redeploy"

4. **Done!** Access at: https://myservice.solslab.dev
   - DNS already works (wildcard)
   - SSL auto-configured
   - Traefik handles routing

---

## Troubleshooting Deployment

### Issue: Domain Shows Coolify Dashboard

**Symptoms**: Accessing your domain redirects to Coolify admin panel

**Cause**: Wildcard domain set in server settings OR missing Traefik labels

**Fix**:
1. Go to Coolify → Servers → localhost → Settings
2. Remove "Wildcard Domain" (leave empty)
3. Ensure Traefik labels are in docker-compose.coolify.yml
4. Clear "Domains" field in application settings
5. Redeploy

---

### Issue: Malformed URLs in Coolify UI

**Symptoms**: URLs show `-:// https://domain.com` or broken prefixes

**Cause**: Caddy labels conflicting with Traefik labels

**Fix**:
1. Remove all Caddy labels from docker-compose.coolify.yml
2. Use only Traefik labels
3. Commit and redeploy
4. Coolify should generate clean compose

---

## Deployment Best Practices

### DO:
✅ Use explicit Traefik labels in docker-compose.coolify.yml
✅ Leave "Domains" field empty in Coolify UI
✅ Keep Cloudflare proxy OFF for Coolify domains
✅ Store environment variables in Coolify UI (never in code)
✅ Use wildcard DNS for dedicated Coolify domains
✅ Commit infrastructure changes to GitHub

### DON'T:
❌ Set wildcard domain in Coolify server settings
❌ Use Coolify's "Domains" field when you have Traefik labels
❌ Enable Cloudflare proxy (orange cloud) for Coolify domains
❌ Commit .env files or secrets to GitHub
❌ Mix Caddy and Traefik labels

---

*Keep this document updated when making deployment changes or adding new services.*
