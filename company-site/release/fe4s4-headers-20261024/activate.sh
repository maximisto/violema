#!/usr/bin/env bash
# Activates release 20261024-de4a746-fe4s4-headers on the violema.com VPS.
# Usage, from a directory holding public-dist.tar.gz and SHA256SUMS: ./activate.sh root@<vps-host>
#
# Files only: the two unlisted record pages and their three assets change (chapter labels, heavier headings, phone fixes).
# Every other file is byte-identical to the live release, and no route is added, so the vhost does not change; it is
# pinned read-only to the hash that carries the record routes.
set -euo pipefail

HOST="${1:?usage: ./activate.sh root@<vps-host>}"
RELEASE=20261024-de4a746-fe4s4-headers
PREVIOUS=20261024-14aaa95-fe4s4-record
STAGE=/root/fe4s4-headers-20261024
LIVE_INDEX_SHA=d74c6df025f781dac2a722d0f7bbf45987d0148f6d99e897ce0f0d8bf6cef558       # unchanged by this release
LIVE_RECORDS_CSS_SHA=99ad8d72204a75d0d056013ea8e692b27d43ff29c36e78472ae62df38c3d8c6b # the previous release's records.css
VHOST_SHA=dfadb9960b8a7c23865d00aca148635b0058d460a860688127b0b04737bca5c5            # with the record routes, not edited here
FILE_COUNT=64

shasum -a 256 -c <<<"698f5066e2c6843192bc74e8f02ff77e20c5c5744bb1c0b2e80eba77eda8dae1  public-dist.tar.gz"
ssh "$HOST" "mkdir -p $STAGE"
scp public-dist.tar.gz SHA256SUMS "$HOST:$STAGE/"

ssh "$HOST" 'bash -s' <<EOF
set -euo pipefail
ROOT=/var/www/violema-science
cd "\$ROOT"
PREV=\$(readlink current)
echo "current -> \$PREV"
test "\$PREV" = "releases/$PREVIOUS" || { echo "refusing: current is not releases/$PREVIOUS"; exit 1; }
test "\$(sha256sum current/index.html | cut -d' ' -f1)" = "$LIVE_INDEX_SHA" || { echo "refusing: live home page is not the expected baseline"; exit 1; }
test "\$(sha256sum current/company-assets/records.css | cut -d' ' -f1)" = "$LIVE_RECORDS_CSS_SHA" || { echo "refusing: live records.css is not the expected baseline"; exit 1; }
test "\$(sha256sum /etc/nginx/sites-available/violema.com | cut -d' ' -f1)" = "$VHOST_SHA" || { echo "refusing: the vhost is not the recorded baseline"; exit 1; }
test ! -e "releases/$RELEASE" || { echo "refusing: releases/$RELEASE already exists"; exit 1; }

# Files first; nothing is live until the pointer moves.
mkdir "releases/$RELEASE"
tar -xzf "$STAGE/public-dist.tar.gz" --no-same-owner -C "releases/$RELEASE"
cd "releases/$RELEASE"
sha256sum -c --quiet "$STAGE/SHA256SUMS"
test "\$(find . -type f | wc -l)" -eq $FILE_COUNT
find . -type d -exec chmod 755 {} +
find . -type f -exec chmod 644 {} +
cd "\$ROOT"

ln -sfn "releases/$RELEASE" current.next
mv -T current.next current
nginx -t && systemctl reload nginx || { ln -sfn "\$PREV" current.next; mv -T current.next current; echo "reload failed: current restored to \$PREV"; exit 1; }
echo "activated $RELEASE (previous: \$PREV)"
EOF

# Every published file, fetched over the public site, must match SHA256SUMS; the 404 body is fetched through an unknown path.
fail=0
while read -r sum path; do
  case "$path" in
    index.html) url=/ ;;
    404.html) url=/no-such-page ;;
    */index.html) url="/${path%index.html}" ;;
    *) url="/$path" ;;
  esac
  got=$(curl -sS "https://violema.com$url" | shasum -a 256 | cut -d' ' -f1)
  [ "$got" = "$sum" ] || { echo "MISMATCH $url"; fail=1; }
done < SHA256SUMS
[ "$fail" = 0 ] && echo "all $FILE_COUNT live files match SHA256SUMS"
for route in /records/fe4s4-benchmark/ /records/fe4s4-benchmark/record/; do
  echo "$route: $(curl -sS -o /dev/null -w '%{http_code}' "https://violema.com$route") (expect 200)"
done
echo "legacy /api/health: $(curl -sS -o /dev/null -w '%{http_code}' https://violema.com/api/health) (expect 200)"
echo "POST /api/briefing {}: $(curl -sS -o /dev/null -w '%{http_code}' -X POST https://violema.com/api/briefing -H 'content-type: application/json' -d '{}') (expect 400)"
echo "unknown path:       $(curl -sS -o /dev/null -w '%{http_code}' https://violema.com/no-such-page) (expect 404)"
exit "$fail"
