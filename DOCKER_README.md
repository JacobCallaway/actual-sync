# Docker Compose Configuration - Complete Setup

## Files Created

✅ **docker-compose.yml** - With automatic scheduler (recommended)
✅ **docker-compose.simple.yml** - Without scheduler (for manual/cron)
✅ **.env.example** - Environment template
✅ **DOCKER_DEPLOYMENT.md** - Complete deployment guide
✅ **DOCKER_COMPOSE_GUIDE.md** - Advanced usage guide

---

## 🚀 Quick Start (5 Minutes)

### 1. Configure Environment

```bash
# Copy template
cp .env.example .env

# Add encryption key (auto-generated)
echo "ACTUAL_SYNC_ENCRYPTION_KEY=$(openssl rand -base64 24)" >> .env

# Verify
cat .env
```

### 2. Initialize Configuration

```bash
# Create config (auto-encrypted)
docker-compose run --rm actual-sync ./actual-sync config create

# Connect TrueLayer account
docker-compose run --rm actual-sync ./actual-sync truelayer add-account

# Edit sync mapping
nano ./config/.config.yml
# Add accounts to sync.map section
```

### 3. Start

```bash
# Start containers (scheduler included)
docker-compose up -d

# View logs
docker-compose logs -f actual-sync-scheduler
```

**That's it!** Sync will run automatically every 6 hours.

---

## 📋 What's Included

### docker-compose.yml (Full Setup)

```yaml
services:
  actual-sync:
    # Main sync application
    # - Builds from Dockerfile
    # - Mounts encrypted config
    # - Sets file permissions (0o600)
    # - Runs with encryption enabled
    
  actual-sync-scheduler:
    # Runs sync automatically
    # - Every 6 hours (configurable)
    # - Monitors logs
    # - Restarts on failure
```

**Features:**
- ✅ Automatic scheduling (every 6h)
- ✅ Encrypted config with key derivation
- ✅ Resource limits (1 CPU, 512MB RAM)
- ✅ Security: no-new-privileges
- ✅ Restart policy: unless-stopped
- ✅ Isolated Docker network

### docker-compose.simple.yml (Manual Only)

```yaml
services:
  actual-sync:
    # Just the sync container
    # No automatic scheduling
    # Run manually: docker-compose exec actual-sync ./actual-sync sync
```

**Features:**
- ✅ Lightweight (scheduler removed)
- ✅ For host cron or manual execution
- ✅ Same encryption and security

### .env.example

```bash
# Template for environment variables
ACTUAL_SYNC_ENCRYPTION_KEY=your-32-char-key-here
CONFIG_FILE_PATH=.config.yml
TZ=UTC
```

**Variables:**
- `ACTUAL_SYNC_ENCRYPTION_KEY` - **Required** (min 32 chars)
- `CONFIG_FILE_PATH` - Optional (default: .config.yml)
- `TZ` - Optional (default: UTC)

---

## 🎯 Which Configuration?

### Use `docker-compose.yml` If You Want:
- ✅ Automatic sync every 6 hours
- ✅ Fire-and-forget setup
- ✅ Container-based scheduling
- ✅ Easy log monitoring
- ✅ No host system dependencies

**Perfect for homelab!**

### Use `docker-compose.simple.yml` If You Want:
- ✅ Minimal overhead
- ✅ Control via host cron
- ✅ Custom scheduling
- ✅ No scheduler container

**For advanced users or specific requirements.**

---

## 📁 Directory Structure

```
actual-sync/
├── docker-compose.yml              ← Use this (with scheduler)
├── docker-compose.simple.yml       ← Alternative (without scheduler)
├── Dockerfile                      ← Build config
├── .env.example                    ← Copy to .env and configure
├── .env                            ← Git-ignored, your secrets here
├── config/
│   └── .config.yml                 ← Auto-created (encrypted)
├── cache/
│   └── ...                         ← Actual Budget cache
├── DOCKER_DEPLOYMENT.md            ← Full deployment guide
└── DOCKER_COMPOSE_GUIDE.md         ← Advanced usage
```

---

## 🔧 Common Tasks

### View Logs

```bash
# Last 50 lines
docker-compose logs --tail=50 actual-sync-scheduler

# Follow in real-time
docker-compose logs -f actual-sync-scheduler

# With timestamps
docker-compose logs -f --timestamps
```

### Run Sync Manually

```bash
docker-compose exec actual-sync ./actual-sync sync
```

### List Accounts

```bash
# TrueLayer
docker-compose exec actual-sync ./actual-sync truelayer list-accounts

# Actual Budget
docker-compose exec actual-sync ./actual-sync actual list-accounts
```

### Edit Configuration

```bash
# Directly in container
docker-compose exec actual-sync nano ./config/.config.yml

# Or locally (auto-synced)
nano ./config/.config.yml
```

### Check Container Health

```bash
# Status
docker-compose ps

# Resource usage
docker stats actual-sync

# Full logs
docker-compose logs
```

### Restart Services

```bash
# Graceful restart
docker-compose restart

# Force restart
docker-compose down && docker-compose up -d
```

---

## 🔐 Security Notes

### Encryption Key

```bash
# Generate strong key (minimum 32 characters)
openssl rand -base64 24

# Store in .env (git-ignored)
echo "ACTUAL_SYNC_ENCRYPTION_KEY=your-key" >> .env

# Never commit .env
git add .gitignore && git commit -m "Ignore .env"
```

### File Permissions

```bash
# Config auto-created with 0o600 (owner-only)
docker-compose exec actual-sync ls -la ./config/.config.yml
# Output: -rw------- root root .config.yml
```

### Network Isolation

```bash
# Container uses isolated Docker network
docker network ls | grep actual-sync

# No external ports exposed
docker-compose ps
```

---

## 🐳 For LXC/Proxmox

### Inside LXC Container

```bash
# Install Docker
apt-get update && apt-get install -y docker.io docker-compose

# Clone and setup
git clone https://github.com/andrewinci/actual-sync.git
cd actual-sync

# Follow quick start above
cp .env.example .env
echo "ACTUAL_SYNC_ENCRYPTION_KEY=$(openssl rand -base64 24)" >> .env
docker-compose run --rm actual-sync ./actual-sync config create
docker-compose up -d
```

### Persist Across Reboots

```bash
# Add to ~/.bashrc in LXC container
export ACTUAL_SYNC_ENCRYPTION_KEY="your-key-from-.env"

# Or create systemd service
# See DOCKER_DEPLOYMENT.md for systemd unit file
```

---

## 📊 Configuration Options

### Change Sync Schedule

Edit `docker-compose.yml`:

```yaml
labels:
  ofelia.job-exec.actual-sync-sync.schedule: "@every 6h"
```

**Options:**
- `@hourly` - Every hour
- `@every 6h` - Every 6 hours (default)
- `@daily` - Once daily
- `0 0 * * *` - Cron format (midnight)
- `0 */6 * * *` - Cron format (every 6h)

### Increase Resource Limits

Edit `docker-compose.yml`:

```yaml
deploy:
  resources:
    limits:
      cpus: '2'
      memory: 1G
```

### Add Custom Network

```yaml
networks:
  actual-sync-network:
    driver: bridge
```

---

## 🆘 Troubleshooting

### "Failed to decrypt credentials"

```bash
# Verify encryption key
cat .env | grep ACTUAL_SYNC_ENCRYPTION_KEY

# Regenerate config if key changed
rm ./config/.config.yml
docker-compose run --rm actual-sync ./actual-sync config create
```

### Container won't start

```bash
# Check logs
docker-compose logs actual-sync

# Common fixes:
# 1. Missing encryption key in .env
# 2. Wrong file permissions on volumes
# 3. Port conflicts
# 4. Out of memory
```

### Sync fails

```bash
# View detailed logs
docker-compose logs -f actual-sync-scheduler

# Test connectivity
docker-compose exec actual-sync \
  ./actual-sync actual list-accounts

# Check config syntax
docker-compose exec actual-sync \
  cat ./config/.config.yml | head -20
```

See **DOCKER_DEPLOYMENT.md** for more troubleshooting.

---

## 📚 Documentation

| File | Purpose |
|------|---------|
| **DOCKER_DEPLOYMENT.md** | Complete setup guide with all options |
| **DOCKER_COMPOSE_GUIDE.md** | Advanced usage and troubleshooting |
| **USAGE_GUIDE.md** | General usage (Docker + non-Docker) |
| **SECURITY_FIXES.md** | Encryption implementation details |

---

## ✅ Setup Checklist

- [ ] Copy `.env.example` to `.env`
- [ ] Generate encryption key: `openssl rand -base64 24`
- [ ] Add key to `.env`
- [ ] Run: `docker-compose run --rm actual-sync ./actual-sync config create`
- [ ] Run: `docker-compose run --rm actual-sync ./actual-sync truelayer add-account`
- [ ] Edit `./config/.config.yml` to add sync mapping
- [ ] Run: `docker-compose run --rm actual-sync ./actual-sync sync` (test)
- [ ] Run: `docker-compose up -d` (start scheduler)
- [ ] Check: `docker-compose logs -f actual-sync-scheduler`

---

## 🚀 Next Steps

1. **Quick Start:** Follow steps above (5 minutes)
2. **Full Guide:** Read [DOCKER_DEPLOYMENT.md](DOCKER_DEPLOYMENT.md) (15 minutes)
3. **Troubleshooting:** See [DOCKER_COMPOSE_GUIDE.md](DOCKER_COMPOSE_GUIDE.md) if issues
4. **Advanced:** Configure custom schedule, monitoring, backups

---

## 💡 Tips

```bash
# Alias for shorter commands
alias ds='docker-compose'
alias dse='docker-compose exec actual-sync'

# Use these:
dse ./actual-sync sync           # Much shorter!
ds logs -f actual-sync-scheduler
ds ps

# Or in shell profile (~/.bashrc)
echo "alias ds='docker-compose'" >> ~/.bashrc
source ~/.bashrc
```

---

## 🎯 Production Deployment

```bash
# 1. Generate key
export KEY=$(openssl rand -base64 32)
echo "Keep this safe: $KEY"

# 2. Setup
cp .env.example .env
echo "ACTUAL_SYNC_ENCRYPTION_KEY=$KEY" >> .env

# 3. Create config
docker-compose run --rm actual-sync ./actual-sync config create

# 4. Configure accounts
docker-compose run --rm actual-sync ./actual-sync truelayer add-account
nano ./config/.config.yml

# 5. Test
docker-compose run --rm actual-sync ./actual-sync sync

# 6. Deploy
docker-compose up -d

# 7. Monitor
docker-compose logs -f actual-sync-scheduler

# 8. Backup
mkdir backups
cp ./config/.config.yml backups/config-$(date +%s).yml
echo "ACTUAL_SYNC_ENCRYPTION_KEY=$KEY" > backups/key.txt
chmod 600 backups/key.txt
```

---

**Ready to deploy!** Start with the 5-minute quick start above, or see [DOCKER_DEPLOYMENT.md](DOCKER_DEPLOYMENT.md) for detailed instructions.
