#!/usr/bin/env bash
# Activates release 20261026-7c98a3e-privacy-contacts on the violema.com VPS.
# Usage, from a directory holding public-dist.tar.gz and SHA256SUMS: ./activate.sh root@<vps-host>
#
# Files only: legal/privacy/index.html gains section 3, People we contact (PR maximisto/violema#45). The other 63 files
# are byte-identical to the live release 20261025-61a8178-fe4s4-reference, and no route is added, so the vhost does not
# change; it is pinned read-only.
set -euo pipefail

HOST="${1:?usage: ./activate.sh root@<vps-host>}"
RELEASE=20261026-7c98a3e-privacy-contacts
PREVIOUS=20261025-61a8178-fe4s4-reference
STAGE=/root/privacy-contacts-20261026
LIVE_INDEX_SHA=c65d9a53b5f95d40576a230b46a44a55fadad131eac43f2dbe6ed91f3fc8b8ac   # unchanged by this release
LIVE_PRIVACY_SHA=e2f462c4024e5c419ccf993ccc1c97f5a651d4aeb236fed5e117d743355717a5 # the previous release's privacy page
VHOST_SHA=dfadb9960b8a7c23865d00aca148635b0058d460a860688127b0b04737bca5c5        # not edited here
FILE_COUNT=64

shasum -a 256 -c <<<"54971c7d4d1672448747fa47062a830c338a33599d9c669db599e084092c4d87  public-dist.tar.gz"
ssh "$HOST" "mkdir -p $STAGE"
scp public-dist.tar.gz SHA256SUMS "$HOST:$STAGE/"

ssh "$HOST" 'bash -s' <<REMOTE
set -euo pipefail
ROOT=/var/www/violema-science
cd "\$ROOT"
PREV=\$(readlink current)
echo "current -> \$PREV"
test "\$PREV" = "releases/$PREVIOUS" || { echo "refusing: current is not releases/$PREVIOUS"; exit 1; }
test "\$(sha256sum current/index.html | cut -d' ' -f1)" = "$LIVE_INDEX_SHA" || { echo "refusing: live home page is not the expected baseline"; exit 1; }
test "\$(sha256sum current/legal/privacy/index.html | cut -d' ' -f1)" = "$LIVE_PRIVACY_SHA" || { echo "refusing: live privacy page is not the expected baseline"; exit 1; }
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
REMOTE

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
echo "/legal/privacy/ section 3 anchor: $(curl -sS https://violema.com/legal/privacy/ | grep -c 'id="people-we-contact"') (expect 1)"
for route in /records/fe4s4-benchmark/ /records/fe4s4-benchmark/record/; do
  echo "$route: $(curl -sS -o /dev/null -w '%{http_code}' "https://violema.com$route") (expect 200)"
done
echo "legacy /api/health: $(curl -sS -o /dev/null -w '%{http_code}' https://violema.com/api/health) (expect 200)"
echo "POST /api/briefing {}: $(curl -sS -o /dev/null -w '%{http_code}' -X POST https://violema.com/api/briefing -H 'content-type: application/json' -d '{}') (expect 400)"
echo "unknown path:       $(curl -sS -o /dev/null -w '%{http_code}' https://violema.com/no-such-page) (expect 404)"
exit "$fail"
