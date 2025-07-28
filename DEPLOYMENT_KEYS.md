# PromoAtlas Deployment Keys & Secrets

## SSH Keys for Server Access

### Current Active SSH Key (2025-07-27)
**Private Key**: `~/.ssh/promoatlas_ed25519_new`
**Public Key**: `ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIBIDcbCBiBYfBw0PrqaKP4i8m93KJjMrbqa+e8Twuu3J promoatlas-hetzner-2025`
**Hetzner Key Name**: `promoatlas-hetzner-2025`
**Fingerprint**: `ca:61:81:8c:dd:d0:46:75:55:3c:11:7e:16:d4:a3:bd`

### SSH Connection
```bash
ssh -i ~/.ssh/promoatlas_ed25519_new root@49.12.199.93
```

## Server Details
**IP**: 49.12.199.93
**Hetzner Server ID**: 105308497
**Name**: promoatlas-prod

## Database Information
**Project**: Promovere PIM (cool-wind-39058859)
**Development Branch**: br-little-voice-a25n7bur (284 products)
**Production Branch**: br-shy-rain-a281c3vp (empty - needs data promotion)

## Security Alerts
- [x] Database token exposed on GitHub (needs rotation)
- [x] SSH access secured with new key

## Application Paths on Server
- App Directory: `/opt/promoatlas/`
- Environment Files: `/opt/promoatlas/.env` and `/opt/promoatlas/backend/.env`
- Docker Compose: `/opt/promoatlas/docker-compose.prod.yml`