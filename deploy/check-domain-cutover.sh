#!/usr/bin/env bash
set -euo pipefail

DOMAIN="${1:-violema.com}"
WWW_DOMAIN="www.${DOMAIN}"
EXPECTED_SERVER="${EXPECTED_SERVER:-nginx}"
EXPECTED_IP="${EXPECTED_IP:-}"

section() {
  printf '\n== %s ==\n' "$1"
}

check_url() {
  local url="$1"
  printf '\n$ %s\n' "curl -I -s ${url}"
  curl -I -s "${url}" || true
}

section "DNS"
printf '$ dig +short %s A\n' "$DOMAIN"
dig +short "$DOMAIN" A || true
printf '\n$ dig +short %s A\n' "$WWW_DOMAIN"
dig +short "$WWW_DOMAIN" A || true
printf '\n$ dig +short %s NS\n' "$DOMAIN"
dig +short "$DOMAIN" NS || true

if [[ -n "${EXPECTED_IP}" ]]; then
  section "Expected IP Check"
  actual_ip="$(dig +short "$DOMAIN" A | head -n1 || true)"
  if [[ "${actual_ip}" == "${EXPECTED_IP}" ]]; then
    echo "OK: ${DOMAIN} resolves to ${EXPECTED_IP}"
  else
    echo "WARN: ${DOMAIN} resolves to ${actual_ip:-<none>} instead of ${EXPECTED_IP}"
  fi
fi

section "HTTP"
check_url "http://${DOMAIN}"
check_url "http://${WWW_DOMAIN}"

section "HTTPS"
check_url "https://${DOMAIN}"
check_url "https://${WWW_DOMAIN}"

section "ACME path"
check_url "http://${DOMAIN}/.well-known/acme-challenge/test"

section "App health"
printf '\n$ %s\n' "curl -s https://${DOMAIN}/api/health"
curl -s "https://${DOMAIN}/api/health" || true

section "Expected Server Header"
server_header="$(curl -I -s "https://${DOMAIN}" 2>/dev/null | tr -d '\r' | awk -F': ' 'tolower($1)=="server"{print $2; exit}' || true)"
if [[ -z "${server_header}" ]]; then
  echo "WARN: no server header returned"
elif [[ "${server_header}" == *"${EXPECTED_SERVER}"* ]]; then
  echo "OK: server header contains ${EXPECTED_SERVER}: ${server_header}"
else
  echo "WARN: server header is ${server_header}, expected to contain ${EXPECTED_SERVER}"
fi
