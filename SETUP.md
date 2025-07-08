# PromoAtlas PIM - Setup Guide

This guide will help you set up the PromoAtlas PIM system from scratch.

## Prerequisites

Before starting, ensure you have:

- **Node.js 20.19.3+** installed
- **Git** installed
- **PostgreSQL database** (Neon recommended)
- **Cloudflare R2 bucket** created
- **Promidata API access** (if syncing)

## Step 1: Clone and Install

```bash
# Clone the repository
git clone https://github.com/Neno73/PromovereAtlasPim.git
cd PromovereAtlasPim

# Navigate to backend and install dependencies
cd backend
npm install
```

## Step 2: Database Setup (Neon)

1. **Create Neon Account**: Go to [neon.tech](https://neon.tech)
2. **Create New Project**: Name it "Promovere PIM"
3. **Get Connection String**: Copy the PostgreSQL connection string
4. **Note the format**: `postgresql://user:password@host/database?sslmode=require`

## Step 3: Cloudflare R2 Setup

1. **Create R2 Bucket**:
   - Go to Cloudflare Dashboard → R2
   - Create bucket named `promo-atlas-images`

2. **Generate API Token**:
   - Go to R2 → API Tokens
   - Create token with "Object Storage:Edit" permissions
   - Note down: Access Key ID, Secret Access Key, Endpoint

## Step 4: Environment Configuration

Create `.env` file in the `backend` directory:

```env
# Server Configuration
HOST=0.0.0.0
PORT=1337
NODE_ENV=development

# Database (Replace with your Neon connection string)
DATABASE_CLIENT=postgres
DATABASE_URL=postgresql://your-user:your-password@your-host/your-database?sslmode=require

# Security Keys (Generate new ones for production)
APP_KEYS=generate-random-keys-here
API_TOKEN_SALT=generate-random-salt-here
ADMIN_JWT_SECRET=generate-random-secret-here
TRANSFER_TOKEN_SALT=generate-random-salt-here
JWT_SECRET=generate-random-secret-here

# Cloudflare R2 (Replace with your R2 credentials)
R2_ACCESS_KEY_ID=your-r2-access-key
R2_SECRET_ACCESS_KEY=your-r2-secret-key
R2_BUCKET_NAME=promo-atlas-images
R2_PUBLIC_URL=https://your-bucket.r2.cloudflarestorage.com
R2_ENDPOINT=https://your-account.r2.cloudflarestorage.com

# Promidata API (Optional for sync)
PROMIDATA_BASE_URL=https://promi-dl.de/Profiles/Live/your-profile-id
```

### Generate Security Keys

Use this Node.js script to generate secure keys:

```javascript
const crypto = require('crypto');

console.log('APP_KEYS:', [
  crypto.randomBytes(32).toString('hex'),
  crypto.randomBytes(32).toString('hex')
].join(','));

console.log('API_TOKEN_SALT:', crypto.randomBytes(32).toString('hex'));
console.log('ADMIN_JWT_SECRET:', crypto.randomBytes(32).toString('hex'));
console.log('TRANSFER_TOKEN_SALT:', crypto.randomBytes(32).toString('hex'));
console.log('JWT_SECRET:', crypto.randomBytes(32).toString('hex'));
```

## Step 5: First Run

```bash
# Start the development server
npm run develop
```

**Expected Output**:
```
Project information
┌────────────────────┬──────────────────────────────────────────────────┐
│ Time               │ [Current Time]                                   │
│ Launched in        │ ~17000 ms                                        │
│ Environment        │ development                                      │
│ Process PID        │ [PID]                                           │
│ Version            │ 5.17.0 (node v20.19.3)                         │
│ Edition            │ Community                                        │
│ Database           │ postgres                                         │
│ Database name      │ [your-database]                                  │
│ Database schema    │ public                                           │
└────────────────────┴──────────────────────────────────────────────────┘

Actions available

Create your first administrator 💻 by going to the administration panel at:
┌─────────────────────────────┐
│ http://localhost:1337/admin │
└─────────────────────────────┘
```

## Step 6: Admin User Setup

1. **Open Admin Panel**: Go to `http://localhost:1337/admin`
2. **Create Admin User**: Fill in the registration form
3. **Login**: Use your credentials to access the admin panel

## Step 7: Verify Installation

### Check Database Tables
The following tables should be created automatically:
- `products`
- `suppliers` (56 suppliers pre-loaded)
- `categories`
- `sync_configurations`
- `components_product_dimensions`
- `components_product_price_tiers`

### Check Admin Interface
Navigate through these sections:
- **Content Manager** → **Product** (should be empty initially)
- **Content Manager** → **Supplier** (should show 56 suppliers)
- **Content Manager** → **Category** (should be empty initially)
- **Content Manager** → **Sync Configuration** (should be empty initially)

### Test R2 Connection (Optional)
```bash
# Test R2 storage
node test-r2-upload-only.js
```

## Step 8: Next Steps

After successful setup, you can:

1. **Configure Suppliers**: Enable/disable specific suppliers for sync
2. **Import Categories**: Set up product categorization
3. **Configure Sync**: Set up Promidata synchronization
4. **Import Products**: Begin product catalog import

## Troubleshooting

### Database Connection Issues
- Verify DATABASE_URL format
- Check Neon project is running
- Ensure SSL mode is enabled

### R2 Storage Issues
- Verify bucket exists and is accessible
- Check API token permissions include "Object Storage:Edit"
- Ensure endpoint URL matches your Cloudflare account

### Admin Panel Not Loading
- Check if port 1337 is available
- Verify all environment variables are set
- Check console for JavaScript errors

### Suppliers Not Loading
- Check database connection
- Verify bootstrap process completed
- Look for "Suppliers bootstrap completed" in server logs

## Production Deployment

For production deployment:

1. **Set Environment**: `NODE_ENV=production`
2. **Build Application**: `npm run build`
3. **Use Production Database**: Update DATABASE_URL
4. **Set Strong Security Keys**: Generate new random keys
5. **Configure HTTPS**: Set up SSL certificates
6. **Set up Monitoring**: Monitor logs and performance

## Support

If you encounter issues:
- Check the troubleshooting section
- Review server logs for error messages
- Verify all environment variables are correctly set
- Ensure all prerequisites are met

---

**Setup complete! Your PromoAtlas PIM system is ready for use.**
