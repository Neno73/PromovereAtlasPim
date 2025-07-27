# Changelog

All notable changes to this project will be documented in this file.

## [2025-07-27] - Hash-Based Incremental Sync & Strapi 5 Compatibility

### 🚀 Added
- **Hash-Based Incremental Sync**: Implemented per-product hash comparison for efficient sync operations
  - Only processes products with changed hashes (89% efficiency achieved in testing)
  - Skip tracking with detailed efficiency metrics
  - Real-time progress reporting in admin dashboard

### 🔧 Fixed
- **Strapi 5 Compatibility**: Updated frontend to work with Strapi 5 data structure
  - Removed `.attributes` wrapper from all TypeScript interfaces
  - Updated routing to use `documentId` instead of numeric `id`
  - Fixed API client to handle new Strapi 5 response format
  - Updated ProductList and ProductDetail components for compatibility

- **Admin Dashboard**: Fixed supplier sync management
  - Corrected pagination to show all 56 suppliers (was limited to 10)
  - Added efficiency metrics display
  - Enhanced sync status tracking with detailed messages

- **CORS Configuration**: Fixed deprecated configuration warnings
  - Removed deprecated `enabled` option from CORS middleware
  - Maintained proper origin allowlist for frontend access

### 🎯 Improved
- **Sync Performance**: Dramatically improved sync efficiency
  - Before: All products processed on every sync
  - After: Only changed products processed (89% skip rate achieved)
  - Added comprehensive logging for hash comparisons

- **Error Handling**: Enhanced sync error reporting
  - Better error messages in admin notifications
  - Detailed error tracking for failed product imports
  - Improved sync status updates

### 📋 Technical Details
- **Files Modified**:
  - `backend/src/api/promidata-sync/services/promidata-sync.ts` - Core incremental sync logic
  - `frontend/src/types/index.ts` - Strapi 5 compatibility types
  - `frontend/src/pages/ProductList.tsx` - Updated routing and data handling
  - `frontend/src/pages/ProductDetail.tsx` - Fixed documentId usage
  - `frontend/src/services/api.ts` - API client Strapi 5 updates
  - `backend/src/admin/pages/supplier-sync.tsx` - Pagination and UI fixes
  - `backend/config/middlewares.ts` - CORS configuration cleanup

### 🧪 Testing
- **A360 Supplier Test**: Verified incremental sync with real data
  - 110 products available, 98 skipped (89% efficiency)
  - 12 products updated due to hash changes
  - 0 errors, proper hash tracking confirmed

### 📝 Documentation
- Updated `CLAUDE.md` with incremental sync details
- Added sync efficiency metrics and performance notes
- Documented Strapi 5 compatibility changes