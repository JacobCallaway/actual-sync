# Docker Deployment Guide

## Overview

Two Docker Compose configurations are provided:

1. **docker-compose.yml** - With automatic scheduling (recommended)
2. **docker-compose.simple.yml** - Manual only (for host cron)

---

## Option 1: With Automatic Scheduling (Recommended)

Perfect for homelab - runs sync automatically every 6 hours.

### Quick Start

```bash
# 1. Copy environment template
cp .env.example .env

# 2. Generate and add encryption key to .env
echo "ACTUAL_SYNC_ENCRYPTION_KEY=$(openssl rand -base64 24)" >> .env

# 3. Create config
docker-compose run --rm actual-sync ./actual-sync config create

# 4. Add TrueLayer account
docker-compose run --rm actual-sync ./actual-sync truelayer add-account

# 5. Configure sync mapping
# Edit ./config/.config.yml and add accounts to sync.map

# 6. Start (scheduler will run sync every 6h)
docker-compose up -d

# 7. Monitor logs
docker-compose logs -f actual-sync-scheduler
```

### What's Running

```
actual-sync container
    ↓ [stays running]
    
actual-sync-scheduler container
    ↓ [runs every 6 hours]
    
executes: ./actual-sync sync
```

### Change Sync Schedule

Edit `docker-compose.yml`:

```yaml
ofelia.job-exec.actual-sync-sync.schedule: "@every 6h"
```

**Common options:**
- `@hourly` - Every hour
- `@every 6h` - Every 6 hours (default)
- `@daily` - Every day at midnight
- `0 */6 * * *` - Cron: every 6 hours

---

## Option 2: Without Scheduler (Manual)

For scheduling via host cron or manual execution.

### Quick Start

```bash
# 1. Copy and configure .env
cp .env.example .env
# Add encryption key

# 2. Create config
docker-compose -f docker-compose.simple.yml run --rm actual-sync ./actual-sync config create

# 3. Add accounts and configure
docker-compose -f docker-compose.simple.yml run --rm actual-sync ./actual-sync truelayer add-account
# Edit ./config/.config.yml

# 4. Start container (runs in background)
docker-compose -f docker-compose.simple.yml up -d

# 5. Run sync manually
docker-compose -f docker-compose.simple.yml exec actual-sync ./actual-sync sync
```

### Schedule with Host Cron

Add to `/etc/crontab`:

```bash
# Run sync every 6 hours
0 */6 * * * cd /path/to/actual-sync && docker-compose -f docker-compose.simple.yml exec actual-sync ./actual-sync sync

# Or with environment:
0 */6 * * * export ACTUAL_SYNC_ENCRYPTION_KEY=xxx && cd /path/to/actual-sync && docker-compose -f docker-compose.simple.yml exec actual-sync ./actual-sync sync
```

---

## Setup Instructions (Both Options)

### 1. Prepare Environment

```bash
cd /path/to/actual-sync

# Copy environment template
cp .env.example .env

# Generate strong encryption key
ENCRYPTION_KEY=$(openssl rand -base64 24)
echo "ACTUAL_SYNC_ENCRYPTION_KEY=$ENCRYPTION_KEY" >> .env

# Verify .env
cat .env
```

### 2. Create Initial Configuration

```bash
# Choose your docker-compose version:

# Option A: With scheduler (recommended)
docker-compose run --rm actual-sync ./actual-sync config create

# Option B: Without scheduler
docker-compose -f docker-compose.simple.yml run --rm actual-sync ./actual-sync config create
```

This creates `./config/.config.yml` (encrypted).

### 3. Connect TrueLayer Account

```bash
# Option A
docker-compose run --rm actual-sync ./actual-sync truelayer add-account

# Option B
docker-compose -f docker-compose.simple.yml run --rm actual-sync ./actual-sync truelayer add-account
```

Follow the prompts to authorize your bank account with TrueLayer.

### 4. Configure Sync Mapping

Edit `./config/.config.yml`:

```yaml
sync:
  map:
    - name: "My Bank Account"                    # Friendly name
      truelayerAccountId: "account_id_here"      # From TrueLayer
      actualAccountId: "actual_account_id_here"  # From Actual Budget
      mapConfig:
        invertAmount: false                       # Reverse sign if needed
```

Get IDs:

```bash
# Get TrueLayer account IDs
# Option A
docker-compose run --rm actual-sync ./actual-sync truelayer list-accounts

# Option B
docker-compose -f docker-compose.simple.yml run --rm actual-sync ./actual-sync truelayer list-accounts

# Get Actual Budget account IDs
# Option A
docker-compose run --rm actual-sync ./actual-sync actual list-accounts

# Option B
docker-compose -f docker-compose.simple.yml run --rm actual-sync ./actual-sync actual list-accounts
```

### 5. Test Sync

```bash
# Option A
docker-compose run --rm actual-sync ./actual-sync sync

# Option B
docker-compose -f docker-compose.simple.yml run --rm actual-sync ./actual-sync sync
```

### 6. Start Automated Sync

**Option A (Recommended):**
```bash
# Start both containers
docker-compose up -d

# View logs
docker-compose logs -f actual-sync-scheduler

# Check it's scheduled
docker-compose ps
```

**Option B:**
```bash
# Start container (manual only)
docker-compose -f docker-compose.simple.yml up -d

# Run manually when needed
docker-compose -f docker-compose.simple.yml exec actual-sync ./actual-sync sync
```

---

## Daily Operations

### Check Status

```bash
# Option A: With scheduler
docker-compose ps
docker-compose logs --tail=20 actual-sync-scheduler

# Option B: Manual
docker-compose -f docker-compose.simple.yml ps
docker-compose -f docker-compose.simple.yml logs --tail=20 actual-sync
```

### Run Sync Manually

```bash
# Option A
docker-compose exec actual-sync ./actual-sync sync

# Option B
docker-compose -f docker-compose.simple.yml exec actual-sync ./actual-sync sync
```

### View Logs

```bash
# Option A - Follow scheduler
docker-compose logs -f actual-sync-scheduler

# Option A - Last 50 lines
docker-compose logs --tail=50 actual-sync-scheduler

# Option B - Follow container
docker-compose -f docker-compose.simple.yml logs -f actual-sync

# Full output with timestamps
docker-compose logs -f --timestamps
```

### Verify Config (Encrypted)

```bash
# Option A
docker-compose exec actual-sync ls -la ./config/

# Option B
docker-compose -f docker-compose.simple.yml exec actual-sync ls -la ./config/

# Should show encrypted file:
# -rw------- root root .config.yml
```

### Update Configuration

```bash
# Option A
docker-compose exec actual-sync nano ./config/.config.yml

# Option B
docker-compose -f docker-compose.simple.yml exec actual-sync nano ./config/.config.yml

# Or edit locally (config is synced)
nano ./config/.config.yml

# Reload (with scheduler)
docker-compose exec actual-sync-scheduler kill -1 1
```

---

## Troubleshooting

### Container Won't Start

```bash
# Check logs
docker-compose logs actual-sync

# Common issues:
# 1. Encryption key missing or wrong
# 2. Volume mount permissions
# 3. Port conflicts
# 4. Out of memory
```

### "Failed to decrypt credentials"

```bash
# Verify encryption key
cat .env | grep ACTUAL_SYNC_ENCRYPTION_KEY

# If key changed:
rm ./config/.config.yml
docker-compose run --rm actual-sync ./actual-sync config create
```

### Sync Fails

```bash
# View detailed logs
docker-compose logs -f actual-sync-scheduler

# Test connectivity to Actual Budget
docker-compose exec actual-sync ping actual-budget.local

# Check config syntax
docker-compose exec actual-sync ./actual-sync actual list-accounts
```

### Out of Memory

```bash
# Check usage
docker stats actual-sync

# Increase in docker-compose.yml:
deploy:
  resources:
    limits:
      memory: 1G  # Increase from 512M
```

---

## LXC/Proxmox Specific

### In LXC Container

```bash
# 1. Install Docker in LXC
apt-get update
apt-get install -y docker.io docker-compose

# 2. Start Docker daemon
systemctl start docker
systemctl enable docker

# 3. Clone repo
git clone https://github.com/andrewinci/actual-sync.git
cd actual-sync

# 4. Follow setup above
cp .env.example .env
echo "ACTUAL_SYNC_ENCRYPTION_KEY=$(openssl rand -base64 24)" >> .env
docker-compose run --rm actual-sync ./actual-sync config create
```

### For Unprivileged Container

```bash
# Inside unprivileged LXC, Docker needs special config
# Edit docker daemon.json:
nano /etc/docker/daemon.json

# Add:
{
  "userns-remap": "default",
  "live-restore": true
}

# Restart
systemctl restart docker
```

### Persisting Across Reboots

```bash
# In LXC container startup script
export ACTUAL_SYNC_ENCRYPTION_KEY=your-key-here
cd /path/to/actual-sync
docker-compose up -d
```

Or in systemd:

```ini
# /etc/systemd/system/actual-sync.service
[Unit]
Description=Actual Sync Docker Compose
After=docker.service
Requires=docker.service

[Service]
Type=simple
WorkingDirectory=/path/to/actual-sync
Environment="ACTUAL_SYNC_ENCRYPTION_KEY=your-key-here"
ExecStart=/usr/bin/docker-compose up
ExecStop=/usr/bin/docker-compose down
Restart=always

[Install]
WantedBy=multi-user.target
```

---

## Backing Up

### Backup Configuration

```bash
# Backup encrypted config
mkdir -p backups
cp ./config/.config.yml backups/.config.yml.$(date +%s)

# Backup encryption key (KEEP SECURE!)
echo "ACTUAL_SYNC_ENCRYPTION_KEY=$ACTUAL_SYNC_ENCRYPTION_KEY" > backups/key.txt
chmod 600 backups/key.txt
```

### Restore Configuration

```bash
# Restore key
source backups/key.txt

# Update .env
echo "ACTUAL_SYNC_ENCRYPTION_KEY=$ACTUAL_SYNC_ENCRYPTION_KEY" >> .env

# Restore config
cp backups/.config.yml.* ./config/.config.yml

# Test
docker-compose run --rm actual-sync ./actual-sync actual list-accounts
```

---

## Monitoring

### Check Container Resources

```bash
# Real-time stats
docker stats actual-sync

# Memory usage
docker-compose exec actual-sync free -h

# Disk usage
docker-compose exec actual-sync df -h /app
```

### View Last Sync

```bash
# Show last 100 lines
docker-compose logs --tail=100 actual-sync-scheduler

# With timestamps
docker-compose logs --tail=100 --timestamps actual-sync-scheduler

# Since specific time
docker-compose logs --since 1h actual-sync-scheduler
```

### Set Up External Monitoring

```bash
# Send to external service (optional)
# Configure ntfy in config to send notifications on sync
docker-compose exec actual-sync nano ./config/.config.yml

# Add ntfy section:
# ntfy:
#   url: https://ntfy.sh
#   topic: actual-sync-notifications
#   priority: high
```

---

## Security Best Practices

### Environment Variables

```bash
# .env should NEVER be committed to git
echo ".env" >> .gitignore
git add .gitignore
git commit -m "Ignore .env file"
```

### Encryption Key

```bash
# Generate strong key
openssl rand -base64 32

# Store securely (not in code)
# Options:
# 1. In .env (git-ignored)
# 2. In environment variable
# 3. In secrets management system
# 4. In Proxmox/LXC environment
```

### File Permissions

```bash
# Config file auto-created with correct permissions
docker-compose exec actual-sync ls -la ./config/.config.yml
# Should show: -rw------- root root .config.yml

# If not, fix manually
chmod 600 ./config/.config.yml
```

### Network Security

```bash
# Container runs on isolated Docker network
docker network inspect actual-sync-network

# No external ports exposed by default
# Only the container can access config
```

---

## Cleanup

### Stop Containers

```bash
# Graceful stop
docker-compose stop

# Force stop
docker-compose kill
```

### Remove Containers

```bash
# Keep volumes
docker-compose down

# Remove everything (DELETE DATA!)
docker-compose down -v
```

### Clean Up Images

```bash
# Remove unused images
docker image prune

# Remove specific image
docker rmi actual-sync:latest
```

---

## Quick Reference

```bash
# One-time setup
cp .env.example .env
echo "ACTUAL_SYNC_ENCRYPTION_KEY=$(openssl rand -base64 24)" >> .env
docker-compose run --rm actual-sync ./actual-sync config create
docker-compose run --rm actual-sync ./actual-sync truelayer add-account

# Edit sync mapping
nano ./config/.config.yml

# Start
docker-compose up -d

# Monitor
docker-compose logs -f actual-sync-scheduler

# Manual sync
docker-compose exec actual-sync ./actual-sync sync

# View accounts
docker-compose exec actual-sync ./actual-sync truelayer list-accounts

# Stop
docker-compose down
```

---

## Support

- **Docker Help:** [DOCKER_COMPOSE_GUIDE.md](DOCKER_COMPOSE_GUIDE.md)
- **Setup Help:** [USAGE_GUIDE.md](USAGE_GUIDE.md)
- **Security:** [SECURITY_FIXES.md](SECURITY_FIXES.md)
