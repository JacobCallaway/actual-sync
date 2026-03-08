# Docker Compose Setup Guide

## Quick Start

### 1. Generate Encryption Key

```bash
# Generate a strong random key
export ACTUAL_SYNC_ENCRYPTION_KEY=$(openssl rand -base64 24)
echo $ACTUAL_SYNC_ENCRYPTION_KEY
```

### 2. Create .env File

```bash
# Copy example to .env
cp .env.example .env

# Edit .env with your encryption key
nano .env
```

**Minimum required in .env:**
```bash
ACTUAL_SYNC_ENCRYPTION_KEY=your-strong-key-here-at-least-32-chars
```

### 3. Create Config

```bash
# Start container and create config
    docker-compose run --rm actual-sync ./actual-sync config create

# This creates ./config/.config.yml (encrypted)
```

### 4. Add TrueLayer Account

```bash
docker-compose run --rm actual-sync ./actual-sync truelayer add-account

# Follow prompts to connect your bank account
```

### 5. Configure Sync Mapping

Edit `./config/.config.yml` to map TrueLayer accounts to Actual Budget accounts:

```yaml
sync:
  map:
    - name: "My Bank Account"
      truelayerAccountId: "acc_123456"
      actualAccountId: "actual_account_id_here"
      mapConfig:
        invertAmount: false
```

### 6. Test Sync

```bash
# Run sync once to test
docker-compose run --rm actual-sync ./actual-sync sync
```

### 7. Start Automated Sync

```bash
# Start both services (sync container + scheduler)
docker-compose up -d

# Check logs
docker-compose logs -f actual-sync-scheduler
```

---

## Usage

### View Logs

```bash
# Sync container logs
docker-compose logs -f actual-sync-scheduler

# Full output
docker-compose logs

# Last 100 lines
docker-compose logs --tail=100
```

### Run Sync Manually

```bash
# Execute sync manually
docker-compose exec actual-sync ./actual-sync sync

# Or run one-off container
docker-compose run --rm actual-sync ./actual-sync sync
```

### List TrueLayer Accounts

```bash
docker-compose exec actual-sync ./actual-sync truelayer list-accounts
```

### List Actual Accounts

```bash
docker-compose exec actual-sync ./actual-sync actual list-accounts
```

### Check Config (Encrypted)

```bash
docker-compose exec actual-sync cat .config.yml | head -20

# Should show base64-encoded encrypted data, not plaintext
```

### View Unencrypted Config (If Needed)

```bash
docker-compose exec actual-sync ./actual-sync actual list-accounts

# This will decrypt and display account info
```

---

## Configuration

### Environment Variables

| Variable | Required | Default | Example |
|----------|----------|---------|---------|
| `ACTUAL_SYNC_ENCRYPTION_KEY` | ✅ Yes | - | `your-strong-32-char-key` |
| `CONFIG_FILE_PATH` | ❌ No | `.config.yml` | `.config.prod.yml` |
| `TZ` | ❌ No | `UTC` | `America/New_York` |
| `ACTUAL_SYNC_DISABLE_ENCRYPTION` | ❌ No | `false` | `true` (debug only) |

### File Structure

```
actual-sync/
├── docker-compose.yml
├── .env                 ← Create from .env.example
├── .gitignore
├── Dockerfile
└── config/
    └── .config.yml     ← Auto-created on first run (encrypted)
└── cache/              ← Auto-created (Actual Budget cache)
└── logs/               ← Auto-created (optional logs)
```

---

## Scheduling

### Automatic Scheduling (Using Ofelia)

Sync runs automatically every 6 hours (0, 6, 12, 18 UTC) using the `actual-sync-scheduler` service.

**To change schedule:**

Edit `docker-compose.yml` and modify:
```yaml
ofelia.job-exec.actual-sync-sync.schedule: "@every 6h"
```

**Common schedule expressions:**
- `@hourly` - Every hour
- `@every 6h` - Every 6 hours
- `@daily` - Every day at midnight
- `0 0 * * *` - Cron format (midnight daily)
- `0 */6 * * *` - Cron format (every 6 hours)

### Manual Cron Setup (Alternative)

If you don't want to use Ofelia scheduler, comment out the `actual-sync-scheduler` service and set up cron outside Docker:

```bash
# Outside container, in host cron
0 */6 * * * docker-compose -f /path/to/docker-compose.yml exec actual-sync ./actual-sync sync
```

---

## Security Considerations

### Encryption Key

```bash
# IMPORTANT: Keep encryption key secret!

# Generate strong key once
export ACTUAL_SYNC_ENCRYPTION_KEY=$(openssl rand -base64 24)

# Store in .env (git-ignored by default)
echo "ACTUAL_SYNC_ENCRYPTION_KEY=$ACTUAL_SYNC_ENCRYPTION_KEY" >> .env

# Never commit .env to git
echo ".env" >> .gitignore
```

### File Permissions

Config file is automatically created with `0o600` (owner-only readable):

```bash
docker-compose exec actual-sync ls -la .config.yml
# Should show: -rw------- root root .config.yml
```

### Network Isolation

```bash
# Container runs on isolated network
docker network ls | grep actual-sync

# No external network exposure by default
```

### Resource Limits

```yaml
# In docker-compose.yml (default limits)
deploy:
  resources:
    limits:
      cpus: '1'
      memory: 512M
```

---

## Troubleshooting

### "Failed to decrypt credentials"

**Cause:** Encryption key changed or container migrated

**Fix:**
```bash
# Verify encryption key in .env
cat .env | grep ACTUAL_SYNC_ENCRYPTION_KEY

# If key changed, regenerate config:
rm ./config/.config.yml
docker-compose run --rm actual-sync ./actual-sync config create
```

### Config file not created

**Check volume mounts:**
```bash
docker-compose exec actual-sync ls -la ./config/

# Should exist: .config.yml (encrypted)
```

**Fix:**
```bash
docker-compose down
docker-compose up -d
docker-compose run --rm actual-sync ./actual-sync config create
```

### Sync fails with "unable to connect"

**Check Actual Budget connectivity:**
```bash
# From inside container
docker-compose exec actual-sync ping actual.myserver.com

# Check config URL
docker-compose exec actual-sync grep "url:" .config.yml
```

**Fix:**
```bash
# Update URL in config
docker-compose exec actual-sync nano .config.yml
# Change: url: localhost → url: http://actual-budget:8080
```

### Container keeps restarting

**Check logs:**
```bash
docker-compose logs --tail=50 actual-sync
```

**Common issues:**
- Invalid encryption key (check .env)
- Config file permission issues
- Out of memory (increase in docker-compose.yml)

---

## Advanced Configuration

### Multiple Encryption Keys (Different Environments)

```bash
# Development
cp .env.example .env.dev
echo "ACTUAL_SYNC_ENCRYPTION_KEY=dev-key-32-chars" >> .env.dev

# Production
cp .env.example .env.prod
echo "ACTUAL_SYNC_ENCRYPTION_KEY=prod-key-32-chars" >> .env.prod

# Use accordingly
docker-compose --env-file .env.dev up -d
```

### Custom Schedule

```yaml
# In docker-compose.yml, change scheduler line:
ofelia.job-exec.actual-sync-sync.schedule: "0 2 * * *"  # 2 AM daily
```

### Persist Logs

```yaml
# In docker-compose.yml, add to volumes:
volumes:
  - ./logs:/app/logs:rw

# Then in your app config:
# Logs will be written to ./logs/actual-sync.log
```

### Metrics/Monitoring

```bash
# Check container resource usage
docker stats actual-sync

# Check memory
docker-compose exec actual-sync free -h

# Check disk space
docker-compose exec actual-sync df -h
```

---

## Backing Up Configuration

### Backup Encrypted Config

```bash
# Backup config (encrypted, safe)
mkdir -p backups
cp ./config/.config.yml backups/.config.yml.$(date +%s)

# Backup encryption key (KEEP SEPARATE AND SECURE!)
echo "ACTUAL_SYNC_ENCRYPTION_KEY=$ACTUAL_SYNC_ENCRYPTION_KEY" > backups/encryption-key.txt
chmod 600 backups/encryption-key.txt
```

### Restore from Backup

```bash
# Restore encryption key
source backups/encryption-key.txt

# Update .env
echo "ACTUAL_SYNC_ENCRYPTION_KEY=$ACTUAL_SYNC_ENCRYPTION_KEY" >> .env

# Restore config
cp backups/.config.yml.* ./config/.config.yml

# Test
docker-compose run --rm actual-sync ./actual-sync actual list-accounts
```

---

## Stopping and Removing

### Stop Services

```bash
# Stop (containers kept)
docker-compose stop

# Stop specific service
docker-compose stop actual-sync-scheduler
```

### Remove Containers

```bash
# Remove (keeps volumes)
docker-compose down

# Remove with volumes (DELETE DATA!)
docker-compose down -v
```

### Clean Up

```bash
# Remove everything (containers, volumes, networks)
docker-compose down -v

# Remove unused images
docker image prune
```

---

## Health Monitoring

### Check Container Health

```bash
# Status
docker-compose ps

# Full output
docker-compose ps -a
```

### Manual Health Check

```bash
# Test Actual Budget connection
docker-compose run --rm actual-sync ./actual-sync actual list-accounts

# Test TrueLayer connection  
docker-compose run --rm actual-sync ./actual-sync truelayer list-accounts

# Test sync
docker-compose run --rm actual-sync ./actual-sync sync
```

### Logs Monitoring

```bash
# Follow scheduler logs in real-time
docker-compose logs -f actual-sync-scheduler

# Follow both
docker-compose logs -f

# Last sync result
docker-compose logs --tail=50 actual-sync-scheduler | grep -A 10 "completed"
```

---

## Network Configuration

### If Actual Budget is on Different Host

```yaml
# In docker-compose.yml, update actual config:
environment:
  - CONFIG_FILE_PATH=.config.yml
  
# Then edit config file:
docker-compose exec actual-sync nano .config.yml

# Change:
# url: localhost
# To:
# url: http://actual-budget.local:8080
# Or:
# url: http://192.168.1.100:8080
```

### Using Docker Network

```bash
# If Actual Budget is also in Docker:
docker-compose exec actual-sync ./actual-sync actual list-accounts

# Config should point to: http://actual-budget:8080
# (Uses Docker network DNS)
```

---

## Production Checklist

- [x] Strong encryption key generated (32+ chars)
- [x] .env file created and git-ignored
- [x] Config file created and encrypted
- [x] TrueLayer account(s) added
- [x] Sync mapping configured
- [x] Test sync successful
- [x] Scheduler running (every 6h)
- [x] Logs being captured
- [x] Backup process setup
- [x] Encryption key backed up separately
- [x] Resource limits set appropriately
- [x] Network connectivity verified

---

## Quick Reference

```bash
# Setup
cp .env.example .env
# Edit .env with encryption key
docker-compose run --rm actual-sync ./actual-sync config create
docker-compose run --rm actual-sync ./actual-sync truelayer add-account

# Edit ./config/.config.yml to add sync mapping

# Start
docker-compose up -d

# Monitor
docker-compose logs -f actual-sync-scheduler

# Manual sync
docker-compose exec actual-sync ./actual-sync sync

# Stop
docker-compose down

# Cleanup
docker-compose down -v
```

---

## Support

See main documentation:
- [USAGE_GUIDE.md](USAGE_GUIDE.md) - Complete usage guide
- [SECURITY_FIXES.md](SECURITY_FIXES.md) - Security implementation
- [SECURITY_FIXES_QUICK_START.md](SECURITY_FIXES_QUICK_START.md) - Quick reference
