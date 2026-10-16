#!/usr/bin/env python3
"""Activate the violema.com not-found release: a company 404 page and a vhost that stops serving the old workspace
app (moved to agent.purpleorange.ai). Unknown paths and every old page return a real 404 with the company page; only
/api/ still reaches the backend. Mirrors the 20261016-5f22dc2-umami activation: refuses on vhost, candidate, manifest
or pointer drift, verifies every archive member against the manifest and the public allowlist, backs up first, and
restores the previous vhost and release pointer if nginx -t, the reload or the post-checks fail. Never touches PM2.
Usage: python3 activate.py <staged-dir> <release-id>"""
import hashlib
import json
import os
import subprocess
import sys
import tarfile
import time
import urllib.error
import urllib.request
from pathlib import Path

BASE = Path('/var/www/violema-science')
VHOST = Path('/etc/nginx/sites-available/violema.com')
BACKUPS = Path('/var/backups/violema-science')
EXPECTED_PREVIOUS = '/var/www/violema-science/releases/20261016-5f22dc2-umami-3'
BASELINE_SHA = 'd66778d6282a2b1d2124510fedb09d42ae580be55bb993cca605cfb11129b81c'
CANDIDATE_SHA = '82a2aab48954e2e6c2aea08c05704cc4218654ad206c4554a53f4018f4f2dc7e'
MANIFEST_SHA = 'b2e9a90026f26e74171c6e4eb786408a18cb11c70637c60d55af0529da08dc7c'
ORIGIN = 'https://violema.com'
TOP = {'index.html', '404.html', 'robots.txt', 'sitemap.xml', 'llms.txt', 'method/index.html', 'demo/index.html',
       'review/index.html', 'legal/terms/index.html', 'legal/privacy/index.html'}
EXTS = {'.css', '.js', '.mjs', '.json', '.md', '.txt', '.xml', '.png', '.jpg', '.jpeg', '.svg', '.ico', '.webp',
        '.avif', '.woff', '.woff2', '.ttf'}
# Old workspace pages and assets, plus unknown and scanner paths: each must now be the company 404 page.
GONE = ('/some-unknown-path', '/login', '/dashboard', '/blog/', '/assets/index-Bb75yB4a.js', '/brand/violema-logo.png',
        '/.env', '/stats/login', '/stats/api/websites')


def sha(data):
    return hashlib.sha256(data).hexdigest()


def run(*args):
    return subprocess.check_output(args, text=True, stderr=subprocess.STDOUT)


def write_atomic(path, data, mode):
    temp = path.with_name(path.name + '.science-next')
    with temp.open('xb') as handle:
        handle.write(data)
        handle.flush()
        os.fsync(handle.fileno())
    temp.chmod(mode)
    os.replace(temp, path)


def set_current(target):
    temp = BASE / 'current.science-next'
    temp.symlink_to(target)
    os.replace(temp, BASE / 'current')


def public(name):
    parts = name.split('/')
    if name.startswith('/') or any(p in ('', '.', '..') or p.startswith('.') for p in parts):
        return False
    return name in TOP or (parts[0] == 'company-assets' and len(parts) > 1 and Path(name).suffix.lower() in EXTS)


def validated_files(bundle, manifest):
    files = {}
    with tarfile.open(bundle, 'r:gz') as archive:
        for item in archive:
            if not item.isfile() or not public(item.name) or item.name in files or item.name not in manifest:
                raise RuntimeError('Refused archive member: ' + item.name)
            data = archive.extractfile(item).read()
            if len(data) != manifest[item.name]['size'] or sha(data) != manifest[item.name]['sha256']:
                raise RuntimeError('Hash or size mismatch: ' + item.name)
            files[item.name] = data
    if set(files) != set(manifest):
        raise RuntimeError('Bundle and manifest disagree.')
    return files


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args):
        return None


OPENER = urllib.request.build_opener(NoRedirect)


def fetch(path):
    """Status, body and headers for one GET, without following redirects or raising on 4xx/5xx."""
    request = urllib.request.Request(ORIGIN + path, headers={'User-Agent': 'violema-release-check'})
    try:
        with OPENER.open(request, timeout=10) as response:
            return response.status, response.read(), response.headers
    except urllib.error.HTTPError as error:
        return error.code, error.read(), error.headers


def checks(files):
    def same(path, name):
        status, body, _ = fetch(path)
        assert status == 200 and sha(body) == files[name]['sha256'], f'{path} is not this release ({status})'
        return body

    home = same('/', 'index.html')
    assert b'/stats/script.js' in home and b'href="/login"' not in home, 'home page tracker or old sign-in link'
    same('/index.html', 'index.html')
    same('/llms.txt', 'llms.txt')
    same('/company-assets/browser/analytics.mjs', 'company-assets/browser/analytics.mjs')
    assert b'Visit statistics' in same('/legal/privacy/', 'legal/privacy/index.html'), 'privacy statistics wording'
    for path in GONE:
        status, body, headers = fetch(path)
        assert status == 404 and sha(body) == files['404.html']['sha256'], f'{path} answered {status}, not the 404 page'
        assert headers.get('Cache-Control') == 'no-cache', f'{path} 404 is cacheable'
    status, _, _ = fetch('/stats/script.js')
    assert status == 200, 'tracker path not proxied'
    status, _, _ = fetch('/api/health')
    assert status == 200, 'backend /api/ not proxied'


def main(staged, release_id):
    staged = Path(staged)
    baseline = (staged / 'baseline-violema.conf').read_bytes()
    candidate = (staged / 'candidate-violema.conf').read_bytes()
    manifest_bytes = (staged / 'manifest.json').read_bytes()
    if sha(baseline) != BASELINE_SHA or sha(candidate) != CANDIDATE_SHA or sha(manifest_bytes) != MANIFEST_SHA:
        raise RuntimeError('Staged packet differs from the reviewed one: stop and re-review.')
    if not VHOST.is_file() or VHOST.is_symlink():
        raise RuntimeError('Unexpected vhost file type.')
    if sha(VHOST.read_bytes()) != BASELINE_SHA:
        raise RuntimeError('Vhost drift since staging: stop and re-review.')
    previous = os.readlink(BASE / 'current')
    if previous != EXPECTED_PREVIOUS:
        raise RuntimeError(f'Release pointer drift: {previous}')
    manifest = json.loads(manifest_bytes)
    files = validated_files(staged / 'public-dist.tar.gz', manifest['files'])
    release = BASE / 'releases' / release_id
    backup = BACKUPS / release_id
    if release.exists() or backup.exists():
        raise RuntimeError('Release or backup already exists; no overwrite.')

    backup.mkdir(parents=True, mode=0o700)
    (backup / 'baseline-violema.conf').write_bytes(baseline)
    (backup / 'manifest.json').write_bytes(manifest_bytes)
    mode = VHOST.stat().st_mode & 0o777
    (backup / 'state.json').write_text(json.dumps({
        'release': str(release), 'previous_current': previous, 'baseline_sha': BASELINE_SHA,
        'candidate_sha': CANDIDATE_SHA, 'vhost_mode': mode, 'revision': manifest['revision'],
    }, indent=2) + '\n')

    release.mkdir(parents=True, mode=0o755)
    for name, data in files.items():
        target = release / name
        target.parent.mkdir(parents=True, exist_ok=True, mode=0o755)
        target.write_bytes(data)
        target.chmod(0o644)
    print(f'unpacked {len(files)} files into {release}')

    def restore(reason):
        print('RESTORING:', reason)
        write_atomic(VHOST, baseline, mode)
        set_current(previous)
        print(run('nginx', '-t').strip())
        run('systemctl', 'reload', 'nginx')
        print('restored previous vhost and release; reloaded')

    try:
        write_atomic(VHOST, candidate, mode)
        print(run('nginx', '-t').strip())
        set_current(str(release))
        run('systemctl', 'reload', 'nginx')
        print('activated', release)
        # nginx reloads gracefully: for a few seconds old workers still answer with the previous vhost, so a check can
        # hit one. Retry until the new workers serve everything, then give up and restore.
        for attempt in range(1, 16):
            try:
                checks(manifest['files'])
                break
            except (AssertionError, urllib.error.URLError) as error:
                if attempt == 15:
                    raise
                print(f'check attempt {attempt} not yet: {error!r}')
                time.sleep(1)
        print('post-checks passed: company pages are this release, old pages and unknown paths are the 404 page, '
              'tracker and /api/ still proxied')
    except Exception as error:  # Any failure restores the previous state.
        restore(repr(error))
        sys.exit(1)


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
