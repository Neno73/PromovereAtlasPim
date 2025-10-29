# Neon Database Backup & Development Strategy

## Current Branch Structure

### Production Branch: `production` (br-shy-rain-a281c3vp)
- **Purpose**: Live production data
- **Connection**: `ep-bitter-rice-a22m6feq-pooler.eu-central-1.aws.neon.tech`
- **Usage**: Only for production deployments
- **Never modify directly** - only receive merges from development

### Development Branch: `development-active` (br-little-voice-a25n7bur)
- **Purpose**: Active development work
- **Connection**: `ep-rough-smoke-a2zgm0hg-pooler.eu-central-1.aws.neon.tech`
- **Usage**: All daily development work, testing, debugging
- **Safe environment** for schema changes and data experiments

## Backup Branches (Limited to 10 total branches)

### Simplified Backup Strategy
1. **Daily**: `backup-daily-latest` - Updated every 24 hours (keeps last 1 day)
2. **Weekly**: `backup-3day-latest` - Updated every 3 days (keeps last 3 days)

## Development Workflow

### Daily Development
1. **Always work on development branch**
   ```bash
   # Use .env.development or default .env (now points to dev branch)
   npm run develop
   ```

2. **Make changes safely**
   - Schema modifications
   - Data testing
   - Sync experiments
   - No risk to production data

3. **Test thoroughly** on development branch before production

### Production Deployment
1. **Test on development branch first**
2. **Create deployment branch** from development
3. **Deploy to production** only after testing
4. **Merge to production branch** after successful deployment

### Emergency Recovery
1. **Identify restore point** from backup branches
2. **Create new branch** from backup point
3. **Test recovery** on new branch
4. **Switch production** to recovered branch if needed

## Environment Configuration

### Local Development (.env)
```bash
# Points to development branch
DATABASE_URL=postgresql://...ep-rough-smoke-a2zgm0hg-pooler...
```

### Production Deployment (.env.production)
```bash
# Points to production branch
DATABASE_URL=postgresql://...ep-bitter-rice-a22m6feq-pooler...
```

## Backup Rotation Schedule

### Automated Backup Creation
```bash
# Run the backup rotation script (handles timing automatically)
./scripts/backup-rotation.sh

# Or manually create specific backups:
# Daily backup
neon branches create --name backup-daily-$(date +%Y%m%d) --parent production

# Weekly backup  
neon branches create --name backup-weekly-$(date +%Y%m%d) --parent production
```

**Important**: The backup branches do NOT update automatically. They are static snapshots from when they were created. Use the backup rotation script to manage them.

## Critical Rules

### ❌ NEVER DO:
- Work directly on production branch
- Delete backup branches without replacement
- Make schema changes in production
- Sync untested data to production

### ✅ ALWAYS DO:
- Work on development branch
- Test changes thoroughly
- Create backups before major changes
- Use proper environment files
- Document any manual data operations

## Recovery Procedure

### If Data Loss Occurs:
1. **Stop all operations** immediately
2. **Identify last known good backup**
3. **Create restore branch** from backup
4. **Verify data integrity** on restore branch
5. **Switch production** to restore branch
6. **Update connection strings** if needed
7. **Document incident** and improve backups

## Branch Management

### Regular Cleanup:
- Keep only latest backup of each tier
- Delete old development branches after merging
- Archive old backups monthly
- Monitor branch costs and usage

This strategy ensures we never lose data again and provides multiple recovery points at different intervals.