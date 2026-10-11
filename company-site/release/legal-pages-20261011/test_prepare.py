"""Run with --previous-packet pointing to the archived evidence-map packet."""
import argparse
import importlib.util
import io
import json
import os
from pathlib import Path
import tarfile
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('legal_preparation', HERE / 'prepare.py')
prepare = importlib.util.module_from_spec(spec)
spec.loader.exec_module(prepare)


class LegalReleaseChecks(unittest.TestCase):
    def setUp(self):
        self.baseline = prepare.pinned(PREVIOUS / 'candidate-violema.conf', prepare.BASELINE_SHA)
        self.original_helper = prepare.pinned(PREVIOUS / 'server-release.py', prepare.HELPER_SHA)
        self.helper = prepare.source_module('legal_release', prepare.extend_helper(self.original_helper))

    def fixture(self, root):
        dist = root / 'dist'
        names = ('index.html', 'method/index.html', 'demo/index.html', 'review/index.html',
                 'robots.txt', 'sitemap.xml', 'llms.txt', 'company-assets/site.css',
                 'company-assets/browser/site.mjs', *prepare.LEGAL_FILES)
        for name in names:
            path = dist / name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text('public test fixture')
        return dist

    def test_config_changes_only_six_exact_legal_locations(self):
        candidate = prepare.extend_config(self.baseline).decode()
        start = candidate.index(prepare.START)
        end = candidate.index(prepare.END) + len(prepare.END)
        self.assertEqual((candidate[:start] + candidate[end:]).encode(), self.baseline)
        addition = candidate[start:end]
        self.assertEqual(addition.count('location = '), 6)
        for page in ('terms', 'privacy'):
            for suffix in ('', '/', '/index.html'):
                self.assertIn(f'location = /legal/{page}{suffix} {{', addition)
            self.assertEqual(addition.count(f'try_files /legal/{page}/index.html =404;'), 3)
        for directive in ('Cache-Control "no-cache"', 'X-Content-Type-Options "nosniff"',
                          'X-Frame-Options "SAMEORIGIN"', 'Referrer-Policy "strict-origin"',
                          'if ($request_method !~ ^(GET|HEAD)$) { return 405; }'):
            self.assertEqual(addition.count(directive), 6)
        self.assertNotIn('location = /terms', candidate)
        self.assertNotIn('location = /privacy', candidate)
        self.assertNotIn('location = /index.html', candidate)

    def test_drift_and_duplicate_overlay_are_refused(self):
        for baseline in (self.baseline + b'\n', prepare.extend_config(self.baseline)):
            with self.assertRaisesRegex(ValueError, 'drift'):
                prepare.extend_config(baseline)
        with self.assertRaisesRegex(ValueError, 'Unexpected activation helper'):
            prepare.extend_helper(self.original_helper + b'\n')

    def test_bundle_includes_both_legal_pages_and_passes_server_allowlist(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            output = root / 'packet'
            prepare.prepare(PREVIOUS, self.fixture(root), '1' * 40, output)
            manifest = json.loads((output / 'manifest.json').read_text())
            files = self.helper.validate_archive(output / 'public-dist.tar.gz', manifest)
            self.assertTrue(set(prepare.LEGAL_FILES) <= set(files))
            self.assertEqual(len(files), 11)
            with self.assertRaises(FileExistsError):
                prepare.prepare(PREVIOUS, root / 'dist', '1' * 40, output)

    def test_missing_legal_page_stops_before_creating_packet(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            dist = self.fixture(root)
            (dist / prepare.LEGAL_FILES[1]).unlink()
            with self.assertRaisesRegex(ValueError, 'Missing required'):
                prepare.prepare(PREVIOUS, dist, '1' * 40, root / 'packet')
            self.assertFalse((root / 'packet').exists())

    def test_other_legal_files_and_private_files_remain_forbidden(self):
        for name in ('legal/private.json', 'legal/terms/draft.html', 'terms/index.html',
                     'privacy/index.html', 'company-assets/.env', '../index.html'):
            with self.subTest(name=name), tempfile.TemporaryDirectory() as directory:
                bundle = Path(directory) / 'bad.tar.gz'
                with tarfile.open(bundle, 'w:gz') as archive:
                    item = tarfile.TarInfo(name)
                    item.size = 1
                    archive.addfile(item, io.BytesIO(b'x'))
                manifest = {'files': {name: {'size': 1, 'sha256': prepare.sha(b'x')}}}
                with self.assertRaises(RuntimeError):
                    self.helper.validate_archive(bundle, manifest)

    def test_activation_preserves_map_rollback_and_refuses_wrong_pointer(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            staged = root / 'packet'
            prepare.prepare(PREVIOUS, self.fixture(root), '1' * 40, staged)
            vhost = root / 'vhost.conf'
            vhost.write_bytes(self.baseline)
            public = root / 'public'
            public.mkdir()
            current = public / 'current'
            current.symlink_to('/wrong-release')
            hashes = json.loads((staged / 'config-hashes.json').read_text())
            args = SimpleNamespace(staged=staged, release_id='test-legal',
                                   candidate_sha=hashes['candidate'])
            with patch.object(self.helper, 'BASE', public), \
                 patch.object(self.helper, 'BACKUPS', root / 'backups'), \
                 patch.object(self.helper, 'VHOST', vhost), \
                 patch.object(self.helper, 'backend_pid', return_value=123), \
                 patch.object(self.helper, 'run', return_value='mocked nginx command'):
                with self.assertRaisesRegex(RuntimeError, 'Company pointer drift'):
                    self.helper.activate(args)
                self.assertEqual(vhost.read_bytes(), self.baseline)
                self.assertFalse((root / 'backups').exists())
                current.unlink()
                current.symlink_to(prepare.PREVIOUS_CURRENT)
                previous_umask = os.umask(0o077)
                try:
                    self.helper.activate(args)
                finally:
                    os.umask(previous_umask)
                self.assertEqual((public / 'releases/test-legal').stat().st_mode & 0o777, 0o755)
                self.assertTrue((current / prepare.LEGAL_FILES[0]).is_file())
                self.helper.rollback(args)
                self.assertEqual(os.readlink(current), prepare.PREVIOUS_CURRENT)
                self.assertEqual(vhost.read_bytes(), self.baseline)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--previous-packet', required=True, type=Path)
    args = parser.parse_args()
    PREVIOUS = args.previous_packet.resolve()
    unittest.main(argv=[__file__])
