#!/usr/bin/env python3
"""Derive candidate-violema.conf from the pinned live vhost. Two exact edits, each asserted to match once:
1. A marked NOT FOUND block inside the company overlay: error_page 404 -> the company 404.html, plus /index.html as
   the company home (routing.mjs lists it as a company route; today it serves the legacy SPA shell).
2. The legacy SPA block (its root, static-asset regex and catch-all) becomes `location / { return 404; }`. The old app
   moved to agent.purpleorange.ai; only /api/ still proxies to the backend for OAuth callbacks and webhooks.
"""
import hashlib
import sys
from pathlib import Path

BASELINE_SHA = 'd66778d6282a2b1d2124510fedb09d42ae580be55bb993cca605cfb11129b81c'

HEADERS = '''        add_header Cache-Control "no-cache" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header Referrer-Policy "strict-origin" always;
'''

LEGAL_END = '    # END VIOLEMA PUBLIC LEGAL PAGES\n'
NOT_FOUND = LEGAL_END + '''    # BEGIN VIOLEMA NOT FOUND
    # Any 404 in this server shows the company page with a real 404 status. Proxied /api/ errors pass through
    # untouched (proxy_intercept_errors stays off).
    error_page 404 /404.html;
    location = /404.html {
        internal;
        root /var/www/violema-science/current;
''' + HEADERS + '''    }
    location = /index.html {
        if ($request_method !~ ^(GET|HEAD)$) { return 405; }
        root /var/www/violema-science/current;
        try_files /index.html =404;
''' + HEADERS + '''    }
    # END VIOLEMA NOT FOUND
'''

LEGACY_SPA = '''    # --- Serve React SPA (frontend dist) ---
    root /var/www/nexus/frontend/dist;
    index index.html;

    # Cache static assets aggressively (hashed filenames)
    location ~* \\.(js|css|woff2?|ttf|eot|svg|ico|png|jpg|gif|webp)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        try_files $uri =404;
    }

    # SPA fallback — all non-API routes → index.html
    location / {
        try_files $uri $uri/ /index.html;
    }
'''
NO_LEGACY = '''    # The old workspace app moved to agent.purpleorange.ai: violema.com serves none of its pages or assets.
    # Only /api/ below still reaches the backend (OAuth callbacks, Stripe and Postmark webhooks).
    location / {
        return 404;
    }
'''


def replace_once(text, old, new):
    if text.count(old) != 1:
        raise SystemExit(f'expected exactly one match for: {old.splitlines()[0]!r}')
    return text.replace(old, new)


def main(baseline_path, candidate_path):
    baseline = Path(baseline_path).read_bytes()
    if hashlib.sha256(baseline).hexdigest() != BASELINE_SHA:
        raise SystemExit('baseline drift: re-read the live vhost and re-review')
    text = baseline.decode()
    text = replace_once(text, LEGAL_END, NOT_FOUND)
    text = replace_once(text, LEGACY_SPA, NO_LEGACY)
    Path(candidate_path).write_text(text)
    print(hashlib.sha256(text.encode()).hexdigest(), candidate_path)


if __name__ == '__main__':
    main(*sys.argv[1:3])
