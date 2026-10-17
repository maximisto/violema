#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# VIOLEMA by Purple Orange AI — VPS Deploy Script
# Run as root (or a sudo user) on Hostinger VPS
# Usage:  sudo bash deploy.sh [--skip-deps]   (see usage() below)
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

DOMAIN="${DOMAIN:-violema.com}"
LEGACY_DOMAIN="${LEGACY_DOMAIN:-nexus.purpleorange.io}"
APP_DIR="${APP_DIR:-/var/www/nexus}"
REPO_URL="${REPO_URL:-https://github.com/maximisto/violema.git}"
BRANCH="${BRANCH:-main}"
LOG_DIR="${LOG_DIR:-/var/log/nexus}"
# NGINX_DIR moves sites-available and sites-enabled together, so an override
# can never point the guard at one file while the script relinks the live one.
NGINX_DIR="${NGINX_DIR:-/etc/nginx}"
NGINX_SITE="$NGINX_DIR/sites-available/$DOMAIN"
NGINX_ENABLED="$NGINX_DIR/sites-enabled/$DOMAIN"
SSL_CERT_PATH="/etc/letsencrypt/live/$DOMAIN/fullchain.pem"
PM2_APP_NAME="${PM2_APP_NAME:-violema-backend}"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
info()    { echo -e "${GREEN}[INFO]${NC}  $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
die()     { echo -e "${RED}[ERROR]${NC} $*" >&2; exit 1; }

# Since the company-site cutover (2026-10-16) the violema.com vhost is the live
# company site: a marked overlay serving /var/www/violema-science/current, with
# only /api/ proxied to the backend. Release packets under company-site/release/
# activate it by exact hash. The legacy templates below would replace it with
# the old app (root frontend/dist), so any vhost carrying one of these markers is
# never rewritten here. There is deliberately no override: undo the cutover with
# its own rollback packet, not with this script.
COMPANY_VHOST_MARKERS=(
  'BEGIN VIOLEMA SCIENCE COMPANY-ONLY OVERLAY'
  '/var/www/violema-science'
)

refuse_if_company_vhost() {
  local vhost marker
  for vhost in "$NGINX_SITE" "$NGINX_ENABLED"; do
    [[ -e "$vhost" ]] || continue
    [[ -r "$vhost" ]] || die "Cannot read $vhost; refusing to rewrite a vhost that cannot be inspected."
    for marker in "${COMPANY_VHOST_MARKERS[@]}"; do
      if grep -qF -- "$marker" "$vhost"; then
        die "$vhost is the live company-site vhost (found '$marker').
  This script would replace it with the legacy app config. Nothing was changed.
  To ship backend changes:  sudo bash deploy.sh --backend-only [--skip-deps]
  Company-site changes ship as release packets (company-site/release/)."
      fi
    done
  done
}

write_bootstrap_nginx_config() {
  refuse_if_company_vhost
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
  refuse_if_company_vhost
  sed \
    -e "s|__APP_DOMAIN__|$DOMAIN|g" \
    -e "s|__LEGACY_DOMAIN__|$LEGACY_DOMAIN|g" \
    -e "s|__APP_DIR__|$APP_DIR|g" \
    "$APP_DIR/deploy/nginx.conf" > "$NGINX_SITE"

  local legacy_cert="/etc/letsencrypt/live/$LEGACY_DOMAIN/fullchain.pem"
  local legacy_key="/etc/letsencrypt/live/$LEGACY_DOMAIN/privkey.pem"
  if [[ -f "$legacy_cert" && -f "$legacy_key" ]]; then
    cat >>"$NGINX_SITE" <<EOF

server {
    listen 443 ssl;
    http2 on;
    server_name $LEGACY_DOMAIN;

    ssl_certificate     $legacy_cert;
    ssl_certificate_key $legacy_key;
    include             /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam         /etc/letsencrypt/ssl-dhparams.pem;

    return 301 https://$DOMAIN\$request_uri;
}
EOF
  else
    warn "Legacy HTTPS certificate for $LEGACY_DOMAIN not found; only HTTP legacy redirects will be active."
  fi
}

# --skip-deps skips dependency INSTALLS everywhere — system packages here, and
# the npm ci / Playwright installs below (which used to run on every deploy
# regardless, observed 2026-08-04: a "skip-deps" deploy still reinstalled 440
# packages and re-ran apt via Playwright). Fresh checkouts still install: the
# npm skips only apply when node_modules already exists.
usage() {
  cat <<EOF
Usage: sudo bash deploy.sh [--skip-deps]

  --skip-deps   Skip system package installs, and npm installs whose node_modules
                is already present.
  -h, --help    Show this help.

Unknown options are rejected: an older copy of this script ignored them and ran
a full deploy.
EOF
}

SKIP_DEPS=false
for arg in "$@"; do
  case "$arg" in
    --skip-deps) SKIP_DEPS=true ;;
    -h|--help) usage; exit 0 ;;
    *) usage >&2; die "Unknown option: $arg" ;;
  esac
done

# Preflight: refuse before touching packages, the checkout or any build.
refuse_if_company_vhost

# ── 1. Dependencies ──────────────────────────────────────────────────────────
if [[ "$SKIP_DEPS" != true ]]; then
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

if [[ "$SKIP_DEPS" == true && -d node_modules ]]; then
  info "Skipping backend dependency install (--skip-deps, node_modules present)."
else
  npm ci --prefer-offline
  npx playwright install --with-deps chromium
fi
npm run build
info "Backend build complete."

# ── 4. Frontend ──────────────────────────────────────────────────────────────
info "Building frontend…"
cd "$APP_DIR/frontend"
if [[ "$SKIP_DEPS" == true && -d node_modules ]]; then
  info "Skipping frontend dependency install (--skip-deps, node_modules present)."
else
  npm ci --prefer-offline
fi
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
ln -sf "$NGINX_SITE" "$NGINX_ENABLED"

# Remove default site if still linked
rm -f "$NGINX_DIR/sites-enabled/default"
rm -f "$NGINX_DIR/sites-enabled/$LEGACY_DOMAIN"

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
