# October 16 about-and-interactive release: staged

Adds `/about/` (`about/index.html` + `/company-assets/max-markovtsev.jpg`), adds `Home` (`href="/"`) as the first link in header, mobile menu, and footer navigation across all pages, upgrades `/method/` with the interactive 6-Station Protocol Inspector (`div.protocol-inspector[data-tabs]`), 8-step diagram pill navigation + Prev/Next controls, and interactive trace source highlighting, and extends `deploy/scientific-site/routing.mjs` with `/about`, `/about/`, and `/about/index.html`.

## Pins

| What | Value |
| --- | --- |
| Release candidate | `20261016-about-interactive` |
| Previous release | `20261016-b71f387-hero-cta` |
| `index.html` SHA-256 | `502e63af9b9da0c093e382e3561124d9b77994d6ec2d7e2644e0c6804932abe1` |
| `about/index.html` SHA-256 | `e64bca668a84bfccb16a50f62e8ec2a2bd996feee461a4f7f6bd102cab3b5cad` |
| `method/index.html` SHA-256 | `549aa45dc9252a7d815857ca72f7ded34fe24ac6df897a7f0ef864c1c139b6a2` |
| `404.html` SHA-256 | `5c43539d9352b30f7bec77c168d0661b06ddc23c3597b3180177129bd5c870f1` |
| `public-dist.tar.gz` SHA-256 | `6a3993b3fb8ebc92c640a8e12d7b3b74cc97c4d5fac4825dc8bb9e8172fde466` |
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

Point `/var/www/violema-science/current` back at `releases/20261016-b71f387-hero-cta` (sibling symlink, then rename over `current`), restore the previous vhost if edited, run `nginx -t`, then reload nginx.
