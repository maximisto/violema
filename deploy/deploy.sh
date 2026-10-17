#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# VIOLEMA by Purple Orange AI — VPS Deploy Script
# Run as root (or a sudo user) on Hostinger VPS
# Usage:  sudo bash deploy.sh [--backend-only] [--skip-deps]   (see usage())
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
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:3001/api/health}"
HEALTH_ATTEMPTS="${HEALTH_ATTEMPTS:-15}"   # x interval = how long a restart may take
HEALTH_INTERVAL_SECONDS="${HEALTH_INTERVAL_SECONDS:-2}"

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
# packages and re-ran apt via Playwright). Fresh checkouts still install, and
# so does a changed lockfile: an npm skip needs node_modules AND a stamp proving
# it was installed from the current package-lock.json. Without that, a
# lockfile-only security fix deployed with --skip-deps would never install.
usage() {
  cat <<EOF
Usage: sudo bash deploy.sh [--backend-only] [--skip-deps]

  --backend-only  Redeploy the Express backend only: git sync, backend install
                  and build, pm2 restart, health check. Never touches system
                  packages, the frontend, nginx or certificates. This is the
                  only mode that runs while violema.com is the company site.
  --skip-deps     Skip system package installs, and npm installs whose node_modules
                  was installed from the current package-lock.json.
  -h, --help      Show this help.

Unknown options are rejected: an older copy of this script ignored them and ran
a full deploy.
EOF
}

SKIP_DEPS=false
BACKEND_ONLY=false
for arg in "$@"; do
  case "$arg" in
    --skip-deps) SKIP_DEPS=true ;;
    --backend-only) BACKEND_ONLY=true ;;
    -h|--help) usage; exit 0 ;;
    *) usage >&2; die "Unknown option: $arg" ;;
  esac
done

# Preflight: refuse before touching packages, the checkout or any build.
# --backend-only never writes nginx, so it is the one mode allowed past this.
if [[ "$BACKEND_ONLY" != true ]]; then
  refuse_if_company_vhost
fi

# Written into node_modules only after every install step succeeded. `npm ci`
# deletes node_modules first, so a failed or partial install leaves no stamp.
DEPS_STAMP="node_modules/.violema-deploy-lock.sha256"

# Prints nothing (never a partial value) when package-lock.json is missing or
# unreadable; callers treat an empty hash as "install".
lockfile_sha() {
  [[ -r package-lock.json ]] || return 0
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum package-lock.json | cut -d' ' -f1
  else
    shasum -a 256 package-lock.json | cut -d' ' -f1
  fi
}

# A pure check, run from the package directory: 0 = install, 1 = skip. The
# install itself stays at top level, because bash ignores `set -e` inside a
# function called as an `if` condition and a failed npm ci would carry on.
deps_install_needed() {
  local label="$1"
  local current
  [[ "$SKIP_DEPS" == true && -d node_modules ]] || return 0
  if [[ ! -f "$DEPS_STAMP" ]]; then
    info "Installing $label dependencies despite --skip-deps: no install stamp yet, so node_modules is not trusted."
    return 0
  fi
  current="$(lockfile_sha)"
  if [[ -n "$current" && "$(cat "$DEPS_STAMP")" == "$current" ]]; then
    info "Skipping $label dependency install (--skip-deps, lockfile unchanged)."
    return 1
  fi
  info "Installing $label dependencies despite --skip-deps: package-lock.json changed since the last install."
  return 0
}

# Hash first, then write: a redirect would truncate the stamp before hashing.
write_deps_stamp() {
  local sha
  sha="$(lockfile_sha)"
  [[ -n "$sha" ]] || die "Could not hash $PWD/package-lock.json; refusing to stamp node_modules."
  printf '%s\n' "$sha" > "$DEPS_STAMP"
}

restart_backend_only() {
  # A missing process fails here instead of starting a second backend in
  # another user's PM2 daemon (startOrReload alone would start one).
  pm2 describe "$PM2_APP_NAME" >/dev/null 2>&1 \
    || die "PM2 has no process named $PM2_APP_NAME for this user (pm2 status). Run with the same sudo as the original deploy."
  info "Reloading $PM2_APP_NAME from deploy/ecosystem.config.cjs…"
  # Reloading from the ecosystem file applies its env block (NODE_ENV, PORT);
  # the backend re-reads backend/.env on every start. A reload is not relied on
  # to apply changes to script, cwd, instances or the memory limit: after
  # changing those, do a one-off delete + start (see DEPLOY.md).
  PM2_APP_NAME="$PM2_APP_NAME" APP_BACKEND_CWD="$APP_DIR/backend" \
    pm2 startOrReload "$APP_DIR/deploy/ecosystem.config.cjs" --only "$PM2_APP_NAME" --update-env \
    || die "pm2 could not reload $PM2_APP_NAME. Check: pm2 logs $PM2_APP_NAME"
  pm2 save
}

wait_for_backend_health() {
  local attempt
  for (( attempt = 1; attempt <= HEALTH_ATTEMPTS; attempt++ )); do
    if curl -fsS --max-time 5 -o /dev/null "$HEALTH_URL"; then
      info "Backend healthy at $HEALTH_URL."
      return 0
    fi
    sleep "$HEALTH_INTERVAL_SECONDS"
  done
  die "Backend did not answer $HEALTH_URL after restart. Check: pm2 logs $PM2_APP_NAME"
}

# ── 1. Dependencies ──────────────────────────────────────────────────────────
if [[ "$SKIP_DEPS" != true && "$BACKEND_ONLY" != true ]]; then
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

if deps_install_needed backend; then
  npm ci --prefer-offline
  # --with-deps runs apt-get; the other modes promise not to touch system packages.
  if [[ "$SKIP_DEPS" == true || "$BACKEND_ONLY" == true ]]; then
    npx playwright install chromium
  else
    npx playwright install --with-deps chromium
  fi
  write_deps_stamp
fi
npm run build
info "Backend build complete."

if [[ "$BACKEND_ONLY" == true ]]; then
  mkdir -p "$LOG_DIR"
  restart_backend_only
  wait_for_backend_health
  echo ""
  echo -e "${GREEN}✓ VIOLEMA backend redeployed at $(git -C "$APP_DIR" rev-parse --short HEAD)${NC}"
  echo "  nginx, the frontend and the company site were not touched."
  exit 0
fi

# ── 4. Frontend ──────────────────────────────────────────────────────────────
info "Building frontend…"
cd "$APP_DIR/frontend"
if deps_install_needed frontend; then
  npm ci --prefer-offline
  write_deps_stamp
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
