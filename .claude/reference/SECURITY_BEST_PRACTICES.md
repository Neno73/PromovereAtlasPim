# Security Best Practices for PromoAtlas

## NEVER Commit These Files
1. **ANY .env files** (development, production, local)
2. **ANY files with credentials** (even documentation)
3. **SSH keys or certificates**
4. **Security audit reports**
5. **Deployment configuration with IPs/secrets**

## How to Handle Secrets

### 1. Use Environment Variables
```bash
# On server, use environment variables
export DATABASE_URL="your-connection-string"
export API_KEY="your-api-key"
```

### 2. Use .env.example
Create a `.env.example` with dummy values:
```
DATABASE_URL=postgresql://username:password@host:port/database
API_KEY=your-api-key-here
```

### 3. Use Secret Management Tools
- **GitHub Secrets** for CI/CD
- **Hetzner Cloud Config** for server env vars
- **Docker Secrets** for containers
- **HashiCorp Vault** for enterprise

### 4. Pre-commit Checks
Add git hooks to prevent secret commits:
```bash
# .git/hooks/pre-commit
#!/bin/sh
if git diff --cached --name-only | grep -E "\.env|KEYS|SECRET|CREDENTIAL"; then
    echo "ERROR: Attempting to commit sensitive files!"
    exit 1
fi
```

### 5. Use git-secrets
Install and use git-secrets tool:
```bash
brew install git-secrets
git secrets --install
git secrets --register-aws
```

## If Secrets Are Exposed

1. **Immediately rotate ALL credentials**
2. **Remove from git history** (use BFG Repo-Cleaner)
3. **Enable 2FA on all accounts**
4. **Audit access logs**
5. **Notify affected services**

## Repository Setup Checklist

- [ ] .gitignore includes all sensitive patterns
- [ ] .env.example exists with dummy values
- [ ] README mentions environment setup
- [ ] Pre-commit hooks installed
- [ ] Team trained on security practices