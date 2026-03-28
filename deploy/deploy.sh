#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Nexus by Purple Orange AI — VPS Deploy Script
# Run as root (or a sudo user) on Hostinger VPS
# Usage:  sudo bash deploy.sh [--skip-deps]
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

DOMAIN="nexus.purpleorange.io"
APP_DIR="/var/www/nexus"
REPO_URL="https://github.com/maximisto/test-repo.git"
BRANCH="claude/build-ai-assistant-platform-BsdRr"
LOG_DIR="/var/log/nexus"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
info()    { echo -e "${GREEN}[INFO]${NC}  $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
die()     { echo -e "${RED}[ERROR]${NC} $*" >&2; exit 1; }

# ── 1. Dependencies ──────────────────────────────────────────────────────────
if [[ "${1:-}" != "--skip-deps" ]]; then
  info "Updating system packages…"
  apt-get update -qq && apt-get upgrade -y -qq

  info "Installing Node.js 20 LTS…"
  if ! command -v node &>/dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
  fi
  node --version

  info "Installing nginx, certbot, git…"
  apt-get install -y nginx certbot python3-certbot-nginx git

  info "Installing PM2 globally…"
  npm install -g pm2 || warn "PM2 may already be installed"
fi

# ── 2. Clone / update repo ───────────────────────────────────────────────────
if [[ -d "$APP_DIR/.git" ]]; then
  info "Pulling latest changes…"
  git -C "$APP_DIR" fetch origin "$BRANCH"
  git -C "$APP_DIR" checkout "$BRANCH"
  git -C "$APP_DIR" reset --hard "origin/$BRANCH"
else
  info "Cloning repository…"
  git clone --branch "$BRANCH" --depth 1 "$REPO_URL" "$APP_DIR"
fi

# ── 3. Backend ───────────────────────────────────────────────────────────────
info "Building backend…"
cd "$APP_DIR/backend"

if [[ ! -f ".env" ]]; then
  die "Missing $APP_DIR/backend/.env — please create it with:\n  ANTHROPIC_API_KEY=sk-ant-..."
fi

npm ci --prefer-offline
npm run build
info "Backend build complete."

# ── 4. Frontend ──────────────────────────────────────────────────────────────
info "Building frontend…"
cd "$APP_DIR/frontend"
npm ci --prefer-offline
npm run build
info "Frontend build complete ($(du -sh dist | cut -f1) in dist/)."

# ── 5. Log dir ───────────────────────────────────────────────────────────────
mkdir -p "$LOG_DIR"
chown -R www-data:www-data "$APP_DIR/frontend/dist" 2>/dev/null || true

# ── 6. nginx ─────────────────────────────────────────────────────────────────
info "Configuring nginx…"
cp "$APP_DIR/deploy/nginx.conf" "/etc/nginx/sites-available/$DOMAIN"
ln -sf "/etc/nginx/sites-available/$DOMAIN" "/etc/nginx/sites-enabled/$DOMAIN"

# Remove default site if still linked
rm -f /etc/nginx/sites-enabled/default

nginx -t || die "nginx config test failed — check /etc/nginx/sites-available/$DOMAIN"
systemctl reload nginx

# ── 7. SSL with Let's Encrypt ────────────────────────────────────────────────
if [[ ! -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]]; then
  info "Obtaining SSL certificate for $DOMAIN…"
  # Temporarily serve HTTP so certbot can complete the ACME challenge.
  # The nginx.conf above redirects 80→443 which blocks certbot's HTTP challenge,
  # so we use --nginx mode which temporarily edits the config.
  certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos \
    --redirect --email "admin@purpleorange.io" || \
  warn "Certbot failed. Run manually: certbot --nginx -d $DOMAIN"
else
  info "SSL certificate already exists, renewing if needed…"
  certbot renew --quiet
fi

# ── 8. PM2 ───────────────────────────────────────────────────────────────────
info "Starting / restarting backend with PM2…"
cd "$APP_DIR"
pm2 delete nexus-backend 2>/dev/null || true
pm2 start deploy/ecosystem.config.cjs
pm2 save
pm2 startup | tail -1 | bash 2>/dev/null || warn "Run 'pm2 startup' manually to enable auto-restart on reboot."

# ── 9. Final reload ──────────────────────────────────────────────────────────
systemctl reload nginx

echo ""
echo -e "${GREEN}✓ Nexus deployed successfully!${NC}"
echo -e "  → https://$DOMAIN"
echo ""
echo "Useful commands:"
echo "  pm2 logs nexus-backend        # live backend logs"
echo "  pm2 status                    # process status"
echo "  sudo systemctl status nginx   # nginx status"
echo "  sudo certbot renew --dry-run  # test SSL auto-renewal"
