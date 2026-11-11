#!/usr/bin/env bash
# Activates release 20261021-eeb14bb-briefing-form on the violema.com VPS.
# Usage, from a directory holding public-dist.tar.gz, SHA256SUMS and
# briefing-api.nginx.conf.snippet: ./activate.sh root@<vps-host>
#
# This release changes the vhost as well as the files: the homepage briefing form posts to
# /api/briefing on violema.com, and nginx must hand that one path to the PsychDoc.AI app on
# 127.0.0.1:3102 instead of the legacy backend. The block inserted is
# deploy/scientific-site/briefing-api.nginx.conf.snippet, placed before `location ^~ /api/`.
# The vhost is backed up first; any failure after the edit restores it and reloads nginx.
set -euo pipefail

HOST="${1:?usage: ./activate.sh root@<vps-host>}"
RELEASE=20261021-eeb14bb-briefing-form
STAGE=/root/briefing-form-20261021
LIVE_INDEX_SHA=9195aec8e48871f0afd67fc5c31d8c52792018b13a3c92c871fc67619e6f2ffd # main e2ae6e5, live before this release
FILE_COUNT=59

shasum -a 256 -c <<<"9e58d707ed6c0bcd67a283afee4d91e35d6a8a69f063509f601b1586adf50168  public-dist.tar.gz"
ssh "$HOST" "mkdir -p $STAGE"
scp public-dist.tar.gz SHA256SUMS briefing-api.nginx.conf.snippet "$HOST:$STAGE/"

ssh "$HOST" 'bash -s' <<EOF
set -euo pipefail
ROOT=/var/www/violema-science
VHOST=/etc/nginx/sites-available/violema.com
BACKUP=/var/backups/violema-science/$RELEASE
cd "\$ROOT"
PREV=\$(readlink current)
echo "current -> \$PREV"
test "\$(sha256sum current/index.html | cut -d' ' -f1)" = "$LIVE_INDEX_SHA" || { echo "refusing: live home page is not the expected baseline"; exit 1; }
test ! -e "releases/$RELEASE" || { echo "refusing: releases/$RELEASE already exists"; exit 1; }
grep -q 'location = /api/briefing' "\$VHOST" && { echo "refusing: the vhost already has a /api/briefing location"; exit 1; }
test "\$(grep -cE '^[[:space:]]*location \^~ /api/ \{' "\$VHOST")" -eq 1 || { echo "refusing: expected exactly one 'location ^~ /api/' block in the vhost"; exit 1; }

# Files first; nothing is live until the pointer moves.
mkdir "releases/$RELEASE"
tar -xzf "$STAGE/public-dist.tar.gz" --no-same-owner -C "releases/$RELEASE"
cd "releases/$RELEASE"
sha256sum -c --quiet "$STAGE/SHA256SUMS"
test "\$(find . -type f | wc -l)" -eq $FILE_COUNT
find . -type d -exec chmod 755 {} +
find . -type f -exec chmod 644 {} +
cd "\$ROOT"

# Vhost: back up, insert the block before the legacy /api/ prefix, test; restore on any failure.
mkdir -p "\$BACKUP"
cp -p "\$VHOST" "\$BACKUP/violema.conf"
sha256sum "\$VHOST" | tee "\$BACKUP/violema.conf.sha256"
restore() { cp -p "\$BACKUP/violema.conf" "\$VHOST"; nginx -t && systemctl reload nginx; echo "vhost restored from \$BACKUP"; }
awk -v snippet="$STAGE/briefing-api.nginx.conf.snippet" '
  /^[[:space:]]*location \^~ \/api\/ \{/ && !done { while ((getline line < snippet) > 0) print line; print ""; done = 1 }
  { print }
' "\$BACKUP/violema.conf" > "\$VHOST.next"
grep -q 'location = /api/briefing' "\$VHOST.next" || { rm -f "\$VHOST.next"; echo "refusing: the block was not inserted"; exit 1; }
mv -f "\$VHOST.next" "\$VHOST"
nginx -t || { restore; exit 1; }

ln -sfn "releases/$RELEASE" current.next
mv -T current.next current
systemctl reload nginx || { ln -sfn "\$PREV" current.next; mv -T current.next current; restore; exit 1; }
sha256sum "\$VHOST"
echo "activated $RELEASE (previous: \$PREV)"
EOF

echo "home:        $(curl -fsS https://violema.com/ | shasum -a 256 | cut -d' ' -f1)"
echo "expected     d74c6df025f781dac2a722d0f7bbf45987d0148f6d99e897ce0f0d8bf6cef558"
echo "form module: $(curl -fsS -o /dev/null -w '%{http_code}' https://violema.com/company-assets/browser/briefing.mjs) (expect 200)"
echo "POST /api/briefing {} (expect 400 and the field-error line):"
curl -sS -w ' [%{http_code}]\n' -X POST https://violema.com/api/briefing -H 'content-type: application/json' -d '{}'
echo "POST /api/briefing as text (expect 415: the handler refuses non-JSON):"
curl -sS -o /dev/null -w '[%{http_code}]\n' -X POST https://violema.com/api/briefing -H 'content-type: text/plain' -d 'x'
echo "legacy /api/health: $(curl -sS -o /dev/null -w '%{http_code}' https://violema.com/api/health) (expect 200)"
echo "unknown path:       $(curl -sS -o /dev/null -w '%{http_code}' https://violema.com/no-such-page) (expect 404)"
