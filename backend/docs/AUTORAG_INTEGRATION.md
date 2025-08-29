# AutoRAG Integration Documentation

## Overview

PromoAtlas integrates with Cloudflare AutoRAG to provide AI-powered semantic search capabilities for promotional products. This integration allows users to search products using natural language queries and get intelligent, context-aware responses.

## Architecture

### Components
1. **R2 Bucket Storage**: Products are stored as JSON files in Cloudflare R2 buckets
2. **AutoRAG Service**: Transforms and uploads product data to R2 for indexing  
3. **Lifecycle Hooks**: Real-time sync of product changes to AutoRAG
4. **Bulk Sync**: Mass upload of existing products to AutoRAG
5. **Vectorize Index**: AutoRAG automatically creates vector embeddings for semantic search

### Data Flow
```
Product CRUD → Lifecycle Hooks → AutoRAG Service → R2 Bucket → AutoRAG Indexing → Vector Search
```

## Configuration

### Environment Variables

```bash
# Cloudflare AutoRAG API Access
CLOUDFLARE_API_TOKEN=your_cloudflare_api_token          # Main API token for AutoRAG calls
CLOUDFLARE_ACCOUNT_ID=your_cloudflare_account_id        # Cloudflare account ID
AUTORAG_BASE_URL=https://api.cloudflare.com/client/v4   # AutoRAG API base URL

# Malfini AutoRAG R2 Bucket Credentials
MALFINI_R2_ACCESS_KEY_ID=your_r2_access_key             # R2 access key for malfini bucket
MALFINI_R2_SECRET_ACCESS_KEY=your_r2_secret_key         # R2 secret key for malfini bucket
R2_ENDPOINT=https://account_id.r2.cloudflarestorage.com # R2 storage endpoint
```

### Service API Token Setup

AutoRAG requires a **Service API Token** to access your account resources:

1. Go to **Cloudflare Dashboard** → **My Profile** → **API Tokens**
2. Create **Custom Token** with permissions:
   - `AutoRAG:Edit`
   - `Vectorize:Edit` 
   - `Workers R2 Storage:Edit`
   - `Workers AI:Read`
   - `Account Settings:Read`
3. Configure in **AI** → **AutoRAG** → **Settings** → **Service API token**

## Supplier AutoRAG Configuration

Each supplier can have AutoRAG configuration stored in the `supplier-autorag-config` content type:

### Content Type Schema
```javascript
{
  supplier: 'relation',              // Link to supplier
  autorag_id: 'string',             // AutoRAG instance ID (e.g., 'malfini-rag')
  cloudflare_account_id: 'string',   // Cloudflare account ID
  api_endpoint: 'string',            // R2 bucket endpoint URL
  status: 'enumeration',             // 'active', 'inactive', 'error'
  sync_frequency: 'enumeration',     // 'real-time', 'daily', 'weekly', 'manual'
  company_context: 'text',           // Additional context for AI responses
  products_in_autorag: 'integer',    // Count of products in AutoRAG
  last_sync_date: 'datetime',        // Last successful sync timestamp
  last_sync_status: 'enumeration',   // 'completed', 'failed', 'running'
  last_sync_message: 'text'          // Detailed sync status message
}
```

## AutoRAG Service (`src/services/autorag.ts`)

### Key Methods

#### `uploadProduct(config, productData)`
Uploads a single product as JSON to the configured R2 bucket.

```javascript
const result = await autoragService.uploadProduct(autoragConfig, productData);
```

#### `deleteProduct(config, supplierCode, sku)`  
Deletes a product file from the R2 bucket.

#### `transformProductForAutoRAG(product)`
Transforms Strapi product data into AutoRAG-optimized format with:
- Multilingual content (EN/DE/NL/FR)
- Category hierarchy
- Product specifications
- Industry context for better AI responses

### Product JSON Format
```json
{
  "sku": "A113-1000008",
  "supplier_code": "A113", 
  "supplier_name": "Malfini",
  "name": {
    "en": "T-shirt Kids Classic white",
    "de": "T-Shirt Kinder Classic weiss"
  },
  "description": {
    "en": "100% cotton kids t-shirt...",
    "de": "100% Baumwolle Kinder T-Shirt..."
  },
  "category_hierarchy": "Textiles > T-Shirts > Kids",
  "available_sizes": ["XS", "S", "M"],
  "material": "100% cotton",
  "variant_type": "single",
  "industry_context": "Perfect for promotional campaigns, corporate gifts, and marketing events."
}
```

## Lifecycle Hooks (`src/api/product/content-types/product/lifecycles.ts`)

### Real-time Sync Events
- **afterCreate**: Uploads new products to AutoRAG
- **afterUpdate**: Updates existing products in AutoRAG  
- **afterDelete**: Removes products from AutoRAG

### Sync Conditions
- Only active products (`is_active: true`) are synced
- Supplier must have AutoRAG config with `status: 'active'`
- AutoRAG config must have `sync_frequency: 'real-time'`

## API Endpoints

### Bulk Sync Endpoint
**POST** `/api/bulk-sync-a113-autorag`

Uploads all active A113 (Malfini) products to AutoRAG in batches.

**Response:**
```json
{
  "success": true,
  "message": "Bulk sync completed: 750 products uploaded, 0 failed",
  "stats": {
    "total_products": 750,
    "uploaded": 750,
    "failed": 0,
    "success_rate": 100
  },
  "autorag_id": "malfini-rag"
}
```

### Configuration Management
**POST** `/api/fix-autorag-config` - Creates/updates AutoRAG config for A113 supplier
**POST** `/api/test-autorag-sync` - Tests AutoRAG upload with sample product

## AutoRAG Indexing Process

1. **File Upload**: Products uploaded as `{SUPPLIER_CODE}_{SKU}.json` to R2 bucket
2. **Automatic Indexing**: AutoRAG scans R2 bucket every 6 hours
3. **Vector Embedding**: Products converted to vector embeddings for semantic search
4. **Search Ready**: Products available for AI-powered search queries

### Monitoring Indexing
- **Dashboard**: Cloudflare → AI → AutoRAG → Jobs tab
- **Status Check**: Monitor `last_sync_status` in supplier config
- **File Verification**: Check R2 bucket for uploaded JSON files

## Search Integration

### AI Search API
```bash
curl https://api.cloudflare.com/client/v4/accounts/{ACCOUNT_ID}/autorag/rags/malfini-rag/ai-search \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer {API_TOKEN}" \
  -d '{"query": "cotton t-shirts for kids promotional campaign"}'
```

### MCP Integration
```javascript
// Search via MCP tools
mcp__cloudflare-autorag__ai_search({
  rag_id: 'malfini-rag',
  query: 'promotional t-shirts cotton white'
});
```

## Deployment Checklist

### Environment Setup
- [ ] Configure all required environment variables
- [ ] Create Service API Token with proper permissions  
- [ ] Set up AutoRAG instance in Cloudflare dashboard
- [ ] Configure R2 bucket permissions

### Database Setup  
- [ ] Run migrations for `supplier-autorag-config` content type
- [ ] Create AutoRAG config records for active suppliers
- [ ] Verify supplier relationships are properly linked

### Initial Sync
- [ ] Execute bulk sync for existing products
- [ ] Monitor indexing progress in AutoRAG dashboard
- [ ] Test search functionality with sample queries
- [ ] Verify real-time sync is working for new/updated products

## Troubleshooting

### Common Issues

#### AutoRAG Paused
**Symptom**: `"paused": true` in AutoRAG status
**Cause**: Invalid or expired Service API Token  
**Solution**: Create new Service API Token and update in AutoRAG settings

#### Products Not Indexing
**Symptom**: No search results despite uploaded files
**Cause**: AutoRAG indexing runs every 6 hours
**Solution**: Wait for indexing cycle or manually trigger "Sync Index"

#### Upload Failures  
**Symptom**: `failed > 0` in bulk sync response
**Cause**: Invalid R2 credentials or bucket permissions
**Solution**: Verify `MALFINI_R2_ACCESS_KEY_ID` and `MALFINI_R2_SECRET_ACCESS_KEY`

#### Lifecycle Hook Errors
**Symptom**: Products not auto-syncing on create/update
**Cause**: AutoRAG service import path or config issues
**Solution**: Check service import path and supplier AutoRAG configuration

### Debug Commands

```bash
# Verify API token
curl "https://api.cloudflare.com/client/v4/user/tokens/verify" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Test AutoRAG sync
curl -X POST http://localhost:1337/api/test-autorag-sync

# Check AutoRAG status  
curl -X GET "https://api.cloudflare.com/client/v4/accounts/ACCOUNT_ID/autorag/rags" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

## Performance Optimization

### Batch Processing
- Products processed in batches of 5 to avoid timeout issues
- 200ms delay between batches to prevent rate limiting
- Error handling for individual product failures

### File Naming Convention
Format: `{SUPPLIER_CODE}_{SKU}.json`
- Example: `A113_A113-1000008.json`
- Consistent naming enables efficient file management
- Includes supplier code for multi-tenant support

### Content Optimization
- Multilingual content for international markets
- Industry-specific context for better AI responses  
- Structured product hierarchy for category-based search
- Optimized JSON structure for fast indexing

## Future Enhancements

### Planned Features
- Multi-supplier AutoRAG support
- Advanced search filters and faceting
- Real-time search suggestions
- Analytics and search insights
- Custom embedding models for domain-specific search

### Integration Opportunities  
- Frontend search interface with AutoRAG integration
- Recommendation engine based on product vectors
- Automated product tagging using AI analysis
- Cross-lingual search capabilities
- Visual similarity search for product images