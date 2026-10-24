#!/usr/bin/env bash
# Adds the record routes to the violema.com vhost, after activate.sh has put release 20261024-14aaa95-fe4s4-record live.
# Usage, from a directory holding records.nginx.conf.snippet and SHA256SUMS: ./add-routes.sh root@<vps-host>
#
# The vhost serves an allowlist: one exact location per route, then `location / { return 404; }`. The block inserted is
# records.nginx.conf.snippet (six exact locations, the same headers as the About block), placed before
# `# END VIOLEMA SCIENCE COMPANY-ONLY OVERLAY`. The vhost is backed up first; any failure after the edit restores it.
set -euo pipefail

HOST="${1:?usage: ./add-routes.sh root@<vps-host>}"
RELEASE=20261024-14aaa95-fe4s4-record
STAGE=/root/fe4s4-record-20261024
VHOST_SHA=df1611c4437eaea600e0ca531bd9cb390a3b47c02a35ba544fd3600bdf5bcc69 # recorded after the briefing-form release
FILE_COUNT=64

shasum -a 256 -c <<<"6cd48466babd624535e2f68f438a20c70fc58e34c603e0dfd75bb0549790b771  records.nginx.conf.snippet"
ssh "$HOST" "mkdir -p $STAGE"
scp records.nginx.conf.snippet "$HOST:$STAGE/"

ssh "$HOST" 'bash -s' <<EOF
set -euo pipefail
ROOT=/var/www/violema-science
VHOST=/etc/nginx/sites-available/violema.com
BACKUP=/var/backups/violema-science/$RELEASE
test "\$(readlink "\$ROOT/current")" = "releases/$RELEASE" || { echo "refusing: current is not releases/$RELEASE; run activate.sh first"; exit 1; }
test "\$(sha256sum "\$VHOST" | cut -d' ' -f1)" = "$VHOST_SHA" || { echo "refusing: the vhost is not the recorded baseline"; exit 1; }
test "\$(grep -c '^    # END VIOLEMA SCIENCE COMPANY-ONLY OVERLAY\$' "\$VHOST")" -eq 1 || { echo "refusing: expected exactly one overlay end marker"; exit 1; }
grep -q 'location = /records/' "\$VHOST" && { echo "refusing: the vhost already has a /records/ location"; exit 1; }
test ! -e "\$BACKUP" || { echo "refusing: \$BACKUP already exists"; exit 1; }

mkdir -p "\$BACKUP"
cp -p "\$VHOST" "\$BACKUP/violema.conf"
sha256sum "\$VHOST" | tee "\$BACKUP/violema.conf.sha256"
restore() { cp -p "\$BACKUP/violema.conf" "\$VHOST"; nginx -t && systemctl reload nginx; echo "vhost restored from \$BACKUP"; }
awk -v snippet="$STAGE/records.nginx.conf.snippet" '
  /^    # END VIOLEMA SCIENCE COMPANY-ONLY OVERLAY\$/ && !done { while ((getline line < snippet) > 0) print line; done = 1 }
  { print }
' "\$BACKUP/violema.conf" > "\$VHOST.next"
test "\$(grep -c 'location = /records/' "\$VHOST.next")" -eq 6 || { rm -f "\$VHOST.next"; echo "refusing: the block was not inserted"; exit 1; }
mv -f "\$VHOST.next" "\$VHOST"
nginx -t || { restore; exit 1; }
systemctl reload nginx || { restore; exit 1; }
sha256sum "\$VHOST"
echo "record routes added to the vhost"
EOF

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
for route in /records/fe4s4-benchmark /records/fe4s4-benchmark/ /records/fe4s4-benchmark/record /records/fe4s4-benchmark/record/; do
  echo "$route: $(curl -sS -o /dev/null -w '%{http_code}' "https://violema.com$route") (expect 200)"
done
echo "POST record page: $(curl -sS -o /dev/null -w '%{http_code}' -X POST https://violema.com/records/fe4s4-benchmark/) (expect 405)"
echo "/records/ alone:  $(curl -sS -o /dev/null -w '%{http_code}' https://violema.com/records/) (expect 404)"
echo "legacy /api/health: $(curl -sS -o /dev/null -w '%{http_code}' https://violema.com/api/health) (expect 200)"
echo "POST /api/briefing {}: $(curl -sS -o /dev/null -w '%{http_code}' -X POST https://violema.com/api/briefing -H 'content-type: application/json' -d '{}') (expect 400)"
echo "unknown path:       $(curl -sS -o /dev/null -w '%{http_code}' https://violema.com/no-such-page) (expect 404)"
exit "$fail"
