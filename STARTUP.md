# PromoAtlas Startup Guide

## Quick Start Commands

### 1. Clean Environment (if needed)
```bash
# Kill any conflicting processes
pkill -f "strapi|vite"

# Remove Docker artifacts if they're causing issues
docker ps -a  # Check for old containers
docker rm <container_id>  # Remove if needed
```

### 2. Start Backend (Strapi)
```bash
cd /home/neno/Desktop/cline-mcp-workspace/PromoAtlas/backend
npm run develop
```

### 3. Start Frontend (React/Vite)
```bash
cd /home/neno/Desktop/cline-mcp-workspace/PromoAtlas/frontend
npm run dev
```

## Service URLs
- **Backend (Strapi)**: http://localhost:1337
- **Frontend (React)**: http://localhost:3001

## Database Connection
- **Neon Project**: "Promovere PIM" (cool-wind-39058859)
- **Active Branch**: br-patient-paper-a2148via (284 products)
- **Backup Branch**: br-lingering-surf-a2mu9l4o (284 products) 
- **Database**: PostgreSQL with 46 tables
- **Connection**: Configured in backend/.env

## Current Database Status
- **Products**: 284 (fully populated with Promidata sync)
- **Suppliers**: Active suppliers loaded
- **Categories**: Available with hierarchy
- **Frontend**: Connected and displaying products

## Troubleshooting

### Port Conflicts
```bash
# Check what's using port 1337
lsof -i :1337

# Kill process if needed
kill <PID>
```

### Docker Interference
After Docker deployment attempts, clean up:
```bash
docker ps -a
docker rm <old_containers>
```

### Environment Files
- Backend: `.env` exists with all required credentials
- Frontend: No `.env` needed for development

## Next Steps
1. Bootstrap suppliers via Strapi admin
2. Run Promidata sync to populate products
3. Verify frontend displays products correctly

## Notes
- Always start from project root directory
- Backend takes ~10-15 seconds to fully start
- Frontend starts quickly (~2-3 seconds)
- Database is empty and needs initial sync to populate 200+ products