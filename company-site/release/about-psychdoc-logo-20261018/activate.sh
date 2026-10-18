#!/usr/bin/env bash
# Activates release 20261018-61ab5e0-about-psychdoc-logo on the violema.com VPS.
# Usage, from this directory: ./activate.sh root@<vps-host>
set -euo pipefail

HOST="${1:?usage: ./activate.sh root@<vps-host>}"
RELEASE=20261018-61ab5e0-about-psychdoc-logo
STAGE=/root/about-psychdoc-logo-20261018
LIVE_ABOUT_SHA=b7f257fbe2a84f66a9a9696903418a35adb39ce41d665ade5f55f4dc8216fc37 # main c94e188, live before this release

shasum -a 256 -c <<<"921202b81821b5d2452b0db6084018668c0e9ee6ad73b00409815ac641b4cc56  public-dist.tar.gz"
ssh "$HOST" "mkdir -p $STAGE"
scp public-dist.tar.gz SHA256SUMS "$HOST:$STAGE/"

ssh "$HOST" 'bash -s' <<EOF
set -euo pipefail
ROOT=/var/www/violema-science
cd "\$ROOT"
PREV=\$(readlink current)
echo "current -> \$PREV"
test "\$(sha256sum current/about/index.html | cut -d' ' -f1)" = "$LIVE_ABOUT_SHA" || { echo "refusing: live about page is not the expected baseline"; exit 1; }
test ! -e "releases/$RELEASE" || { echo "refusing: releases/$RELEASE already exists"; exit 1; }
mkdir "releases/$RELEASE"
tar -xzf "$STAGE/public-dist.tar.gz" --no-same-owner -C "releases/$RELEASE"
cd "releases/$RELEASE"
sha256sum -c --quiet "$STAGE/SHA256SUMS"
test "\$(find . -type f | wc -l)" -eq 58
find . -type d -exec chmod 755 {} +
find . -type f -exec chmod 644 {} +
cd "\$ROOT"
ln -sfn "releases/$RELEASE" current.next
mv -T current.next current
nginx -t
systemctl reload nginx
echo "activated $RELEASE (previous: \$PREV)"
EOF

curl -fsS https://violema.com/about/ | shasum -a 256
echo "expected ad77c640d8fee07da350bef047aa59f41d06e8f58e7c73a8336ac133e3273eb6"
