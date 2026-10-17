# October 16 about-and-interactive release: staged

Adds `/about/` (`about/index.html` + `/company-assets/max-markovtsev.jpg`), adds `Home` (`href="/"`) as the first link in header, mobile menu, and footer navigation across all pages, upgrades `/method/` with the interactive 6-Station Protocol Inspector (`div.protocol-inspector[data-tabs]`), 8-step diagram pill navigation + Prev/Next controls, and interactive trace source highlighting, and extends `deploy/scientific-site/routing.mjs` with `/about`, `/about/`, and `/about/index.html`.

## Pins

| What | Value |
| --- | --- |
| Release candidate | `20261016-about-interactive` |
| Previous release | `20261016-f666490-hero-briefing` |
| `index.html` SHA-256 | `545ac53350bf6678a81f2c9351d3d2e5ef09cc73e8421f1f26815f8c4422be53` |
| `about/index.html` SHA-256 | `aba0bc5f2b93e270cada93888372eb302c7580eee14dbc934512841f5974f94a` |
| `method/index.html` SHA-256 | `d808d69135fb8e15f0b5f2cb83f17199319105919ff22d14aa3db74d443fcdad` |
| `404.html` SHA-256 | `0d92084c0989cbea03f6d05a0ad0531393531696bcf7f0c9219ce9a13c78a3ea` |
| Files | 55, each hash in `SHA256SUMS` beside this file |
| Staged archive | `/tmp/about-20261016/public-dist.tar.gz` (built with `COPYFILE_DISABLE=1 tar --no-xattrs`) |

## Required vhost addition on activation

Because `/etc/nginx/sites-available/violema.com` uses explicit location allowlists before `location / { return 404; }`, add `/about`, `/about/`, and `/about/index.html` alongside `/review` inside the company overlay (matching `deploy/scientific-site/cutover.nginx.conf.template`):

```nginx
    location = /about {
        if ($request_method !~ ^(GET|HEAD)$) { return 405; }
        root /var/www/violema-science/current;
        try_files /about/index.html =404;
        add_header Cache-Control "no-cache" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header Referrer-Policy "strict-origin" always;
    }
    location = /about/ {
        if ($request_method !~ ^(GET|HEAD)$) { return 405; }
        root /var/www/violema-science/current;
        try_files /about/index.html =404;
        add_header Cache-Control "no-cache" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header Referrer-Policy "strict-origin" always;
    }
    location = /about/index.html {
        if ($request_method !~ ^(GET|HEAD)$) { return 405; }
        root /var/www/violema-science/current;
        try_files /about/index.html =404;
        add_header Cache-Control "no-cache" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header Referrer-Policy "strict-origin" always;
    }
```

## Rollback

Point `/var/www/violema-science/current` back at `releases/20261016-f666490-hero-briefing` (sibling symlink, then rename over `current`), restore the previous vhost if edited, run `nginx -t`, then reload nginx.
