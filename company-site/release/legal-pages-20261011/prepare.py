#!/usr/bin/env python3
"""Prepare a company-only legal-page packet locally; never contact production."""
import argparse
import hashlib
import json
from pathlib import Path
import re
from types import ModuleType

BASELINE_SHA = '9a39f359e917393cc8c686672b858c1f8395b6fed19054e93205093dbf444592'
HELPER_SHA = 'a5022f289923080fb7307c6989f838039147fa5ff975f92fc5a457cb4586f643'
PREPARER_SHA = '783ccfb1b722629fcac3961b5b581501cd7793addd3d49aded856132ba54d3c2'
PREVIOUS_CURRENT = '/var/www/violema-science/releases/20261010-e2784a0-map'
PREVIOUS_REVISION = 'e2784a029c15df11fd478b2a0e9c4cdaa740a65f'
LEGAL_FILES = ('legal/terms/index.html', 'legal/privacy/index.html')
MARKER = '    # END VIOLEMA SCIENCE COMPANY-ONLY OVERLAY\n'
START = '    # BEGIN VIOLEMA PUBLIC LEGAL PAGES\n'
END = '    # END VIOLEMA PUBLIC LEGAL PAGES\n'


def sha(data):
    return hashlib.sha256(data).hexdigest()


def pinned(path, expected):
    data = path.read_bytes()
    if sha(data) != expected:
        raise ValueError(f'Unexpected baseline bytes: {path.name}; capture and review drift.')
    return data


def source_module(name, source):
    # Inputs are hash-pinned audited Python, not arbitrary downloaded code.
    module = ModuleType(name)
    module.__file__ = str(Path(__file__).resolve())
    exec(compile(source, module.__file__, 'exec'), module.__dict__)
    return module


def extend_config(baseline):
    if sha(baseline) != BASELINE_SHA:
        raise ValueError('Vhost drift: expected the verified evidence-map configuration.')
    original = baseline.decode()
    if original.count(MARKER) != 1 or START in original:
        raise ValueError('Expected exactly one existing company overlay, without legal routes.')
    locations = []
    for page in ('terms', 'privacy'):
        for suffix in ('', '/', '/index.html'):
            locations.append(f'''    location = /legal/{page}{suffix} {{
        if ($request_method !~ ^(GET|HEAD)$) {{ return 405; }}
        root /var/www/violema-science/current;
        try_files /legal/{page}/index.html =404;
        add_header Cache-Control "no-cache" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header Referrer-Policy "strict-origin" always;
    }}
''')
    return original.replace(MARKER, START + ''.join(locations) + END + MARKER).encode()


def extend_helper(original):
    if sha(original) != HELPER_SHA:
        raise ValueError('Unexpected activation helper; review before adapting it.')
    source = original.decode()
    old_allowlist = "'method/index.html', 'demo/index.html', 'review/index.html'}"
    new_allowlist = "'method/index.html', 'demo/index.html', 'review/index.html',\n                         'legal/terms/index.html', 'legal/privacy/index.html'}"
    old_pointer = '    previous = os.readlink(current) if current.is_symlink() else None\n'
    new_pointer = old_pointer + f'''    if previous != {PREVIOUS_CURRENT!r}:
        raise RuntimeError('Company pointer drift; expected the verified evidence-map release.')
'''
    for old, new in ((old_allowlist, new_allowlist), (old_pointer, new_pointer)):
        if source.count(old) != 1:
            raise ValueError('Activation helper patch anchor changed.')
        source = source.replace(old, new)
    return source.encode()


def prepare(previous_packet, dist, revision, output):
    if not re.fullmatch(r'[0-9a-f]{40}', revision):
        raise ValueError('Use the exact 40-character tested source revision.')
    baseline = pinned(previous_packet / 'candidate-violema.conf', BASELINE_SHA)
    helper = pinned(previous_packet / 'server-release.py', HELPER_SHA)
    preparer = pinned(previous_packet / 'prepare.py', PREPARER_SHA)
    previous_manifest = json.loads((previous_packet / 'manifest.json').read_text())
    if previous_manifest['revision'] != PREVIOUS_REVISION:
        raise ValueError('Expected the evidence-map source manifest, not an older release.')
    for name in LEGAL_FILES:
        if not (dist / name).is_file():
            raise ValueError(f'Missing required public output: {name}')
    candidate = extend_config(baseline)
    updated_helper = extend_helper(helper)
    bundler = source_module('audited_company_bundler', preparer)
    previous_allowed = bundler.allowed
    bundler.allowed = lambda path: path in LEGAL_FILES or previous_allowed(path)
    # Deliberately call only the bundle builder. The old initial-overlay CLI
    # would recreate the wrong baseline and duplicate the existing locations.
    output.mkdir(parents=True, exist_ok=False)
    bundler.BASE = output
    bundler.prepare_bundle(dist, revision)
    (output / 'baseline-violema.conf').write_bytes(baseline)
    (output / 'candidate-violema.conf').write_bytes(candidate)
    (output / 'server-release.py').write_bytes(updated_helper)
    (output / 'config-hashes.json').write_text(json.dumps({
        'baseline': sha(baseline), 'candidate': sha(candidate),
    }, indent=2) + '\n')
    (output / 'release-baseline.json').write_text(json.dumps({
        'previous_current': PREVIOUS_CURRENT,
        'previous_revision': PREVIOUS_REVISION,
        'previous_vhost_sha256': BASELINE_SHA,
        'previous_helper_sha256': HELPER_SHA,
        'revision': revision,
        'status': 'prepared locally; not deployed',
    }, indent=2) + '\n')
    (output / 'packet-sha256.json').write_text(json.dumps({
        path.name: sha(path.read_bytes()) for path in sorted(output.iterdir()) if path.is_file()
    }, indent=2) + '\n')
    print(f'Prepared {output}; no upload, activation, nginx reload or PM2 action performed.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--previous-packet', required=True, type=Path)
    parser.add_argument('--dist', required=True, type=Path)
    parser.add_argument('--revision', required=True)
    parser.add_argument('--output', required=True, type=Path)
    args = parser.parse_args()
    prepare(args.previous_packet.resolve(), args.dist.resolve(), args.revision,
            args.output.resolve())
