#!/usr/bin/env bash
# Activates release 20261018-e2ae6e5-home-psychdoc-ai-logo on the violema.com VPS.
# Usage, from the directory holding public-dist.tar.gz and SHA256SUMS: ./activate.sh root@<vps-host>
set -euo pipefail

HOST="${1:?usage: ./activate.sh root@<vps-host>}"
RELEASE=20261018-e2ae6e5-home-psychdoc-ai-logo
STAGE=/root/home-psychdoc-ai-logo-20261018
LIVE_INDEX_SHA=4da095c9884385cfc743258257b045e442f56c0f726adf995703c374fc6e4f75 # main 61ab5e0, live before this release

shasum -a 256 -c <<<"f9e1cd7e2893487c6a409fa03a843026c3f6f1143be0db6482a634fa21cb9d33  public-dist.tar.gz"
ssh "$HOST" "mkdir -p $STAGE"
scp public-dist.tar.gz SHA256SUMS "$HOST:$STAGE/"

ssh "$HOST" 'bash -s' <<REMOTE
set -euo pipefail
ROOT=/var/www/violema-science
cd "\$ROOT"
PREV=\$(readlink current)
echo "current -> \$PREV"
test "\$(sha256sum current/index.html | cut -d' ' -f1)" = "$LIVE_INDEX_SHA" || { echo "refusing: live home page is not the expected baseline"; exit 1; }
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
REMOTE

curl -fsS https://violema.com/ | shasum -a 256
echo "expected 9195aec8e48871f0afd67fc5c31d8c52792018b13a3c92c871fc67619e6f2ffd"
