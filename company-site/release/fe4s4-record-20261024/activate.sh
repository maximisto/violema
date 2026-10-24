#!/usr/bin/env bash
# Activates release 20261024-14aaa95-fe4s4-record on the violema.com VPS.
# Usage, from a directory holding public-dist.tar.gz and SHA256SUMS: ./activate.sh root@<vps-host>
#
# Files only: two unlisted record pages and their three assets are added, and site.mjs gains the line that loads the
# record instruments. Every other file is byte-identical to the live release, so the live home page cannot tell the two
# releases apart; the guards pin the `current` symlink and the live site.mjs instead. The vhost does not change.
set -euo pipefail

HOST="${1:?usage: ./activate.sh root@<vps-host>}"
RELEASE=20261024-14aaa95-fe4s4-record
PREVIOUS=20261021-eeb14bb-briefing-form
STAGE=/root/fe4s4-record-20261024
LIVE_INDEX_SHA=d74c6df025f781dac2a722d0f7bbf45987d0148f6d99e897ce0f0d8bf6cef558    # unchanged by this release
LIVE_SITE_MJS_SHA=6ba2326a0a23a79e2947c9d91a75914c03fd0d82dc0e685d4a3b7f365acc8c2d # the previous release's site.mjs
FILE_COUNT=64

shasum -a 256 -c <<<"e949d335514942a7a37741be85d5631f346fda465894d51e813ad027ada07b5c  public-dist.tar.gz"
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
test "\$(sha256sum current/company-assets/browser/site.mjs | cut -d' ' -f1)" = "$LIVE_SITE_MJS_SHA" || { echo "refusing: live site.mjs is not the expected baseline"; exit 1; }
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
echo "record page:  $(curl -sS -o /dev/null -w '%{http_code}' https://violema.com/records/fe4s4-benchmark/) (expect 200)"
echo "full record:  $(curl -sS -o /dev/null -w '%{http_code}' https://violema.com/records/fe4s4-benchmark/record/) (expect 200)"
echo "legacy /api/health: $(curl -sS -o /dev/null -w '%{http_code}' https://violema.com/api/health) (expect 200)"
echo "unknown path:       $(curl -sS -o /dev/null -w '%{http_code}' https://violema.com/no-such-page) (expect 404)"
exit "$fail"
