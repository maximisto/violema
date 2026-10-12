#!/usr/bin/env python3
"""Prepare a company-only legal-page packet locally; never contact production."""
import argparse
import hashlib
import json
from pathlib import Path
import re
from types import ModuleType

BASELINE_SHA = '71f4245751dd468a810c026d0300f68c45a9cd7f53412c9976dc9aba085fbd5d'
HELPER_SHA = 'a252fb4dede3de991a4b0769170de49a37cd2e688e18eb290069fb33a6bb2f82'
MANIFEST_SHA = 'b4e6811d874e08f45ca3a48d14fa3583b3e4de535950ecaaf46c5727219de84e'
PREPARER_SHA = '783ccfb1b722629fcac3961b5b581501cd7793addd3d49aded856132ba54d3c2'
PREVIOUS_CURRENT = '/var/www/violema-science/releases/20261011-87bac30-method'
PREVIOUS_REVISION = '87bac30f800e7c94624140e002c8859c0be45729'
LEGAL_FILES = ('legal/terms/index.html', 'legal/privacy/index.html')
OVERLAY_START = '    # BEGIN VIOLEMA SCIENCE COMPANY-ONLY OVERLAY\n'
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


def preserve_config(baseline):
    if sha(baseline) != BASELINE_SHA:
        raise ValueError('Vhost drift: expected the verified method configuration.')
    original = baseline.decode()
    if any(original.count(marker) != 1 for marker in (OVERLAY_START, MARKER, START, END)):
        raise ValueError('Expected exactly one company overlay and existing legal route block.')
    if not (original.index(OVERLAY_START) < original.index(START) <
            original.index(END) < original.index(MARKER)):
        raise ValueError('Existing legal routes must remain inside the company overlay.')
    legal_block = original[original.index(START):original.index(END)]
    if legal_block.count('location = ') != 6:
        raise ValueError('Expected the six existing exact legal locations.')
    for page in ('terms', 'privacy'):
        for suffix in ('', '/', '/index.html'):
            if original.count(f'location = /legal/{page}{suffix} {{') != 1:
                raise ValueError('Expected each existing exact legal location once.')
        if legal_block.count(f'try_files /legal/{page}/index.html =404;') != 3:
            raise ValueError('Unexpected existing legal page mapping.')
    return baseline


def extend_helper(original):
    if sha(original) != HELPER_SHA:
        raise ValueError('Unexpected activation helper; review before adapting it.')
    source = original.decode()
    old_pointer = '''    if previous != '/var/www/violema-science/releases/20261011-2ef63f7-legal':
        raise RuntimeError('Company pointer drift; expected the verified legal release.')
'''
    new_pointer = f'''    if previous != {PREVIOUS_CURRENT!r}:
        raise RuntimeError('Company pointer drift; expected the verified method release.')
'''
    if source.count(old_pointer) != 1:
        raise ValueError('Activation helper predecessor guard changed.')
    return source.replace(old_pointer, new_pointer).encode()


def prepare(previous_packet, dist, revision, output, bundle_preparer):
    if not re.fullmatch(r'[0-9a-f]{40}', revision):
        raise ValueError('Use the exact 40-character tested source revision.')
    baseline = pinned(previous_packet / 'candidate-violema.conf', BASELINE_SHA)
    helper = pinned(previous_packet / 'server-release.py', HELPER_SHA)
    preparer = pinned(bundle_preparer, PREPARER_SHA)
    previous_manifest = json.loads(pinned(previous_packet / 'manifest.json', MANIFEST_SHA))
    if previous_manifest['revision'] != PREVIOUS_REVISION:
        raise ValueError('Expected the method source manifest, not an older release.')
    for name in LEGAL_FILES:
        if not (dist / name).is_file():
            raise ValueError(f'Missing required public output: {name}')
    candidate = preserve_config(baseline)
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
        'previous_manifest_sha256': MANIFEST_SHA,
        'bundle_preparer_sha256': PREPARER_SHA,
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
    parser.add_argument('--bundle-preparer', required=True, type=Path)
    parser.add_argument('--dist', required=True, type=Path)
    parser.add_argument('--revision', required=True)
    parser.add_argument('--output', required=True, type=Path)
    args = parser.parse_args()
    prepare(args.previous_packet.resolve(), args.dist.resolve(), args.revision,
            args.output.resolve(), args.bundle_preparer.resolve())
