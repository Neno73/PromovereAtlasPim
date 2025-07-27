# PromoAtlas Deployment Guide

This guide covers deploying PromoAtlas to production with Docker containers.

## 🏗️ Architecture Overview

- **Frontend**: React app → Cloudflare Pages (static hosting)
- **Backend**: Strapi 5 → VPS with Docker (containerized API)
- **Database**: Neon PostgreSQL (managed)
- **Storage**: Cloudflare R2 (images)

## 📦 Docker Setup

### Local Development

```bash
# Clone repository
git clone https://github.com/Neno73/PromovereAtlasPim.git
cd PromoAtlas

# Copy environment variables
cp .env.example .env
# Edit .env with your actual values

# Start development environment
docker-compose up -d

# Access applications
# Frontend: http://localhost:3000
# Backend: http://localhost:1337
# PostgreSQL: localhost:5432
```

### Production Build

```bash
# Build production images
./scripts/build-and-push.sh v1.0.0 your-dockerhub-username

# Or build locally
docker build -t promoatlas-backend --target production ./backend
docker build -t promoatlas-frontend --target production ./frontend
```

## 🌐 Deployment Options

### Option 1: Frontend on Cloudflare Pages + Backend on VPS

**Recommended for production**

#### Frontend (Cloudflare Pages)
1. Connect your GitHub repository to Cloudflare Pages
2. Set build configuration:
   ```
   Build command: cd frontend && npm run build
   Build output directory: frontend/dist
   Root directory: /
   ```
3. Environment variables:
   ```
   VITE_API_URL=https://your-backend-domain.com
   ```

#### Backend (VPS with Docker)
1. Rent a VPS (DigitalOcean, Linode, Hetzner, etc.)
2. Install Docker and Docker Compose
3. Deploy:
   ```bash
   # On your VPS
   git clone https://github.com/Neno73/PromovereAtlasPim.git
   cd PromoAtlas
   
   # Configure environment
   cp .env.example .env
   nano .env  # Add production values
   
   # Deploy production stack
   docker-compose -f docker-compose.prod.yml up -d
   ```

### Option 2: Full Docker on VPS

Deploy both frontend and backend on same VPS:

```bash
# Production deployment
docker-compose -f docker-compose.prod.yml up -d

# With custom domain and SSL
# Configure nginx proxy and Let's Encrypt
```

## 🔧 Environment Configuration

### Required Environment Variables

```env
# Database (Neon PostgreSQL)
DATABASE_URL=postgresql://user:pass@host:port/db

# Cloudflare R2 Storage
R2_ACCESS_KEY_ID=your_access_key
R2_SECRET_ACCESS_KEY=your_secret_key
R2_BUCKET_NAME=promo-atlas-images
R2_PUBLIC_URL=https://your-bucket.r2.cloudflarestorage.com
R2_ENDPOINT=https://your-account.r2.cloudflarestorage.com

# Strapi Security (generate new for production)
APP_KEYS=key1,key2,key3,key4
ADMIN_JWT_SECRET=your-jwt-secret
API_TOKEN_SALT=your-token-salt
```

### Generate Strapi Secrets

```bash
# Generate secure keys for production
node -e "console.log(require('crypto').randomBytes(64).toString('base64'))"
```

## 🚀 VPS Deployment Steps

### 1. Server Setup

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Logout and login again for group changes
```

### 2. Deploy Application

```bash
# Clone repository
git clone https://github.com/Neno73/PromovereAtlasPim.git
cd PromoAtlas

# Configure environment
cp .env.example .env
nano .env  # Add your production values

# Start production services
docker-compose -f docker-compose.prod.yml up -d

# Check status
docker-compose -f docker-compose.prod.yml logs -f
```

### 3. Domain & SSL Setup

#### Using Nginx Proxy Manager (Recommended)

```bash
# Add to docker-compose.prod.yml
version: '3.8'
services:
  nginx-proxy-manager:
    image: 'jc21/nginx-proxy-manager:latest'
    restart: unless-stopped
    ports:
      - '80:80'
      - '81:81'
      - '443:443'
    volumes:
      - ./data:/data
      - ./letsencrypt:/etc/letsencrypt
```

#### Manual Nginx + Certbot

```bash
# Install Nginx and Certbot
sudo apt install nginx certbot python3-certbot-nginx

# Configure domain
sudo nano /etc/nginx/sites-available/promoatlas
sudo ln -s /etc/nginx/sites-available/promoatlas /etc/nginx/sites-enabled/

# Get SSL certificate
sudo certbot --nginx -d your-domain.com
```

## 📊 Monitoring & Maintenance

### Health Checks

```bash
# Check container status
docker-compose -f docker-compose.prod.yml ps

# View logs
docker-compose -f docker-compose.prod.yml logs backend
docker-compose -f docker-compose.prod.yml logs frontend

# Health endpoints
curl http://your-domain.com/health  # Frontend
curl http://your-domain.com:1337/_health  # Backend
```

### Updates

```bash
# Pull latest code
git pull origin main

# Rebuild and restart
docker-compose -f docker-compose.prod.yml pull
docker-compose -f docker-compose.prod.yml up -d --force-recreate
```

### Backups

```bash
# Database backup (if using local PostgreSQL)
docker-compose -f docker-compose.prod.yml exec postgres pg_dump -U strapi promoatlas > backup.sql

# Environment backup
cp .env .env.backup
```

## 🔍 Troubleshooting

### Common Issues

1. **Container won't start**
   ```bash
   docker-compose -f docker-compose.prod.yml logs backend
   ```

2. **Database connection errors**
   - Check DATABASE_URL format
   - Verify Neon database is accessible
   - Check firewall rules

3. **Image upload failures**
   - Verify R2 credentials
   - Check R2 bucket permissions
   - Validate R2_PUBLIC_URL

4. **Frontend can't reach backend**
   - Check VITE_API_URL in frontend build
   - Verify CORS configuration in backend
   - Check domain/port accessibility

### Performance Tuning

```bash
# Optimize Docker for production
echo '{"log-driver":"json-file","log-opts":{"max-size":"10m","max-file":"3"}}' | sudo tee /etc/docker/daemon.json
sudo systemctl restart docker
```

## 🎯 Quick Start Commands

```bash
# Development
docker-compose up -d

# Production
docker-compose -f docker-compose.prod.yml up -d

# Build and push to registry
./scripts/build-and-push.sh v1.0.0 your-dockerhub-username

# Update production
git pull && docker-compose -f docker-compose.prod.yml up -d --force-recreate
```

## 🎯 Current Deployment - Hetzner VPS

**LIVE SERVER DETAILS (Created 2025-07-27):**
- **Server ID:** 105308497
- **Name:** promoatlas-prod
- **Type:** cpx21 (3 vCPUs, 8GB RAM, 80GB SSD)
- **Location:** nbg1-dc3 (Nuremberg)
- **Public IP:** 49.12.199.93
- **IPv6:** 2a01:4f8:1c1c:bd8c::/64

**Access:**
```bash
ssh root@49.12.199.93
# Password: cwCsLkTjUAuvEUKWWtbr
```

**Status:** ✅ RUNNING (Docker CE pre-installed)

## 📋 Production Checklist

- [x] Hetzner VPS created and running
- [x] Docker pre-installed
- [ ] Environment variables configured
- [ ] Database connection tested
- [ ] R2 storage configured and tested
- [ ] Domain name pointed to server
- [ ] SSL certificate installed
- [ ] Firewall configured (ports 80, 443, 22)
- [ ] Monitoring setup
- [ ] Backup strategy in place
- [ ] Admin user created in Strapi
- [ ] Promidata sync tested