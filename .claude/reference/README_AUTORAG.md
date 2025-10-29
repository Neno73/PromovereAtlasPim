# AutoRAG Integration - Quick Start Guide

## What is AutoRAG?

PromoAtlas now integrates with **Cloudflare AutoRAG** to provide AI-powered semantic search for promotional products. Users can search using natural language like "cotton t-shirts for promotional campaigns" and get intelligent, context-aware results.

## 🚀 Quick Setup

### 1. Environment Variables
Add these to your `.env` file:

```bash
# Cloudflare AutoRAG
CLOUDFLARE_API_TOKEN=your_cloudflare_api_token
CLOUDFLARE_ACCOUNT_ID=your_cloudflare_account_id
AUTORAG_BASE_URL=https://api.cloudflare.com/client/v4

# Malfini AutoRAG R2 Credentials  
MALFINI_R2_ACCESS_KEY_ID=your_r2_access_key
MALFINI_R2_SECRET_ACCESS_KEY=your_r2_secret_key
R2_ENDPOINT=https://account_id.r2.cloudflarestorage.com
```

### 2. Create Service API Token
1. **Cloudflare Dashboard** → **My Profile** → **API Tokens**
2. **Create Custom Token** with permissions:
   - `AutoRAG:Edit`
   - `Vectorize:Edit`
   - `Workers R2 Storage:Edit` 
   - `Workers AI:Read`
   - `Account Settings:Read`

### 3. Configure AutoRAG Instance
1. **AI** → **AutoRAG** → **malfini-rag** → **Settings**
2. Update **Service API token** with the token from step 2
3. Ensure status shows `"paused": false`

### 4. Bulk Upload Products
```bash
curl -X POST http://localhost:1337/api/bulk-sync-a113-autorag
```

## ✅ Features

- **🔄 Real-time Sync**: Products automatically sync to AutoRAG on create/update/delete
- **📦 Bulk Upload**: Mass upload existing products with one API call  
- **🌐 Multilingual**: Supports EN/DE/NL/FR product content
- **🔍 Semantic Search**: Natural language product search capabilities
- **📊 Monitoring**: Track sync status and indexing progress

## 🧪 Test the Integration

### Test Upload
```bash
curl -X POST http://localhost:1337/api/test-autorag-sync
```

### Search Products (after indexing completes)
```bash
curl https://api.cloudflare.com/client/v4/accounts/{ACCOUNT_ID}/autorag/rags/malfini-rag/ai-search \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer {API_TOKEN}" \
  -d '{"query": "white cotton t-shirts for kids"}'
```

## 📁 Key Files

- **Service**: `src/services/autorag.ts` - Core AutoRAG integration
- **Lifecycle**: `src/api/product/content-types/product/lifecycles.ts` - Real-time sync
- **Controller**: `src/api/supplier-autorag-config/controllers/` - Bulk sync endpoints
- **Config**: `src/api/supplier-autorag-config/content-types/` - AutoRAG configuration

## 🔧 API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/bulk-sync-a113-autorag` | POST | Upload all A113 products |
| `/api/test-autorag-sync` | POST | Test upload with sample product |
| `/api/fix-autorag-config` | POST | Create/update AutoRAG config |

## 📚 Full Documentation

See `docs/AUTORAG_INTEGRATION.md` for complete technical documentation.

## 🐛 Troubleshooting

### AutoRAG Not Indexing
- Check if AutoRAG is paused (`"paused": true`)
- Verify Service API token is valid
- Wait up to 6 hours for automatic indexing

### Products Not Uploading  
- Verify R2 credentials in `.env`
- Check Strapi logs for error messages
- Test with `/api/test-autorag-sync` endpoint

### Search Returns No Results
- Confirm products are uploaded to R2 bucket
- Wait for AutoRAG indexing to complete (up to 6 hours)
- Check AutoRAG dashboard Jobs tab for indexing status