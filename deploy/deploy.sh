#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# VIOLEMA by Purple Orange AI — VPS Deploy Script
# Run as root (or a sudo user) on Hostinger VPS
# Usage:  sudo bash deploy.sh [--skip-deps]
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

DOMAIN="${DOMAIN:-violema.com}"
LEGACY_DOMAIN="${LEGACY_DOMAIN:-nexus.purpleorange.io}"
APP_DIR="${APP_DIR:-/var/www/nexus}"
REPO_URL="https://github.com/maximisto/test-repo.git"
BRANCH="claude/build-ai-assistant-platform-BsdRr"
LOG_DIR="${LOG_DIR:-/var/log/nexus}"
NGINX_SITE="/etc/nginx/sites-available/$DOMAIN"
SSL_CERT_PATH="/etc/letsencrypt/live/$DOMAIN/fullchain.pem"
PM2_APP_NAME="${PM2_APP_NAME:-violema-backend}"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
info()    { echo -e "${GREEN}[INFO]${NC}  $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
die()     { echo -e "${RED}[ERROR]${NC} $*" >&2; exit 1; }

write_bootstrap_nginx_config() {
  cat >"$NGINX_SITE" <<EOF
server {
    listen 80;
    server_name $DOMAIN www.$DOMAIN;

    root $APP_DIR/frontend/dist;
    index index.html;

    location /api/ {
        proxy_pass         http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header   Host              \$host;
        proxy_set_header   X-Real-IP         \$remote_addr;
        proxy_set_header   X-Forwarded-For   \$proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto \$scheme;
        proxy_set_header   Connection        '';
        proxy_buffering    off;
        proxy_cache        off;
        chunked_transfer_encoding on;
        proxy_read_timeout 300s;
        proxy_send_timeout 300s;
    }

    location / {
        try_files \$uri \$uri/ /index.html;
    }
}
EOF
}

render_production_nginx_config() {
  sed \
    -e "s|__APP_DOMAIN__|$DOMAIN|g" \
    -e "s|__LEGACY_DOMAIN__|$LEGACY_DOMAIN|g" \
    -e "s|__APP_DIR__|$APP_DIR|g" \
    "$APP_DIR/deploy/nginx.conf" > "$NGINX_SITE"
}

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
npx playwright install --with-deps chromium
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
if [[ -f "$SSL_CERT_PATH" ]]; then
  render_production_nginx_config
else
  info "No SSL certificate found yet, writing bootstrap HTTP-only nginx config…"
  write_bootstrap_nginx_config
fi
ln -sf "$NGINX_SITE" "/etc/nginx/sites-enabled/$DOMAIN"

# Remove default site if still linked
rm -f /etc/nginx/sites-enabled/default

nginx -t || die "nginx config test failed — check $NGINX_SITE"
systemctl reload nginx

# ── 7. SSL with Let's Encrypt ────────────────────────────────────────────────
if [[ ! -f "$SSL_CERT_PATH" ]]; then
  info "Obtaining SSL certificate for $DOMAIN and www.$DOMAIN…"
  certbot --nginx -d "$DOMAIN" -d "www.$DOMAIN" --non-interactive --agree-tos \
    --redirect --email "admin@purpleorange.io" || \
  warn "Certbot failed. Run manually: certbot --nginx -d $DOMAIN -d www.$DOMAIN"

  if [[ -f "$SSL_CERT_PATH" ]]; then
    info "SSL certificate issued, switching nginx to the production HTTPS config…"
    render_production_nginx_config
    nginx -t || die "nginx config test failed after SSL issuance — check $NGINX_SITE"
    systemctl reload nginx
  fi
else
  info "SSL certificate already exists, renewing if needed…"
  certbot renew --quiet
fi

# ── 8. PM2 ───────────────────────────────────────────────────────────────────
info "Starting / restarting backend with PM2…"
cd "$APP_DIR"
pm2 delete nexus-backend 2>/dev/null || true
pm2 delete "$PM2_APP_NAME" 2>/dev/null || true
PM2_APP_NAME="$PM2_APP_NAME" APP_BACKEND_CWD="$APP_DIR/backend" pm2 start deploy/ecosystem.config.cjs
pm2 save
pm2 startup | tail -1 | bash 2>/dev/null || warn "Run 'pm2 startup' manually to enable auto-restart on reboot."

# ── 9. Final reload ──────────────────────────────────────────────────────────
systemctl reload nginx

echo ""
echo -e "${GREEN}✓ VIOLEMA deployed successfully!${NC}"
echo -e "  → https://$DOMAIN"
echo ""
echo "Useful commands:"
echo "  pm2 logs $PM2_APP_NAME        # live backend logs"
echo "  pm2 status                    # process status"
echo "  sudo systemctl status nginx   # nginx status"
echo "  sudo certbot renew --dry-run  # test SSL auto-renewal"
