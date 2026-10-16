"""Run with the archived mobile-hero --previous-packet and original --bundle-preparer."""
import argparse
import importlib.util
import io
import json
import os
from pathlib import Path
import subprocess
import sys
import tarfile
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('legal_preparation', HERE / 'prepare.py')
prepare = importlib.util.module_from_spec(spec)
spec.loader.exec_module(prepare)


class MobileCaptionReleaseChecks(unittest.TestCase):
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

    def test_config_preserves_all_bytes_and_existing_six_exact_legal_locations(self):
        self.assertEqual(prepare.preserve_config(self.baseline), self.baseline)
        candidate = self.baseline.decode()
        start = candidate.index(prepare.START)
        end = candidate.index(prepare.END) + len(prepare.END)
        legal_block = candidate[start:end]
        self.assertEqual(candidate.count(prepare.OVERLAY_START), 1)
        self.assertEqual(candidate.count(prepare.MARKER), 1)
        self.assertEqual(candidate.count(prepare.START), 1)
        self.assertEqual(candidate.count(prepare.END), 1)
        self.assertEqual(legal_block.count('location = '), 6)
        for page in ('terms', 'privacy'):
            for suffix in ('', '/', '/index.html'):
                self.assertEqual(candidate.count(f'location = /legal/{page}{suffix} {{'), 1)
            self.assertEqual(legal_block.count(f'try_files /legal/{page}/index.html =404;'), 3)
        for directive in ('Cache-Control "no-cache"', 'X-Content-Type-Options "nosniff"',
                          'X-Frame-Options "SAMEORIGIN"', 'Referrer-Policy "strict-origin"',
                          'if ($request_method !~ ^(GET|HEAD)$) { return 405; }'):
            self.assertEqual(legal_block.count(directive), 6)
        self.assertNotIn('location = /terms', candidate)
        self.assertNotIn('location = /privacy', candidate)
        self.assertNotIn('location = /index.html', candidate)

    def test_drift_and_duplicate_overlay_are_refused(self):
        for baseline in (self.baseline + b'\n', self.baseline + prepare.OVERLAY_START.encode()):
            with self.assertRaisesRegex(ValueError, 'drift'):
                prepare.preserve_config(baseline)
        with self.assertRaisesRegex(ValueError, 'Unexpected activation helper'):
            prepare.extend_helper(self.original_helper + b'\n')

    def test_helper_changes_only_predecessor_pointer_and_diagnostic(self):
        expected = self.original_helper.decode().replace(
            "if previous != '/var/www/violema-science/releases/20261015-0f43c93-mobile-hero':",
            "if previous != '/var/www/violema-science/releases/20261015-84de034-mobile-caption':",
        ).replace('expected the verified mobile-hero release.', 'expected the verified mobile-caption release.')
        self.assertEqual(prepare.extend_helper(self.original_helper), expected.encode())

    def test_all_pinned_inputs_refuse_drift_before_packet_creation(self):
        dependencies = ('candidate-violema.conf', 'server-release.py', 'manifest.json', 'prepare.py')
        for changed in dependencies:
            with self.subTest(changed=changed), tempfile.TemporaryDirectory() as directory:
                root = Path(directory)
                previous = root / 'previous'
                previous.mkdir()
                for name in dependencies:
                    source = BUNDLE_PREPARER if name == 'prepare.py' else PREVIOUS / name
                    data = source.read_bytes()
                    (previous / name).write_bytes(data + b'\n' if name == changed else data)
                output = root / 'packet'
                with self.assertRaisesRegex(ValueError, 'Unexpected baseline bytes'):
                    prepare.prepare(previous, self.fixture(root), '1' * 40, output,
                                    previous / 'prepare.py')
                self.assertFalse(output.exists())

    def test_bundle_includes_both_legal_pages_and_passes_server_allowlist(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            output = root / 'packet'
            prepare.prepare(PREVIOUS, self.fixture(root), '1' * 40, output, BUNDLE_PREPARER)
            manifest = json.loads((output / 'manifest.json').read_text())
            files = self.helper.validate_archive(output / 'public-dist.tar.gz', manifest)
            self.assertTrue(set(prepare.LEGAL_FILES) <= set(files))
            self.assertEqual(len(files), 11)
            self.assertEqual((output / 'baseline-violema.conf').read_bytes(), self.baseline)
            self.assertEqual((output / 'candidate-violema.conf').read_bytes(), self.baseline)
            hashes = json.loads((output / 'packet-sha256.json').read_text())
            self.assertEqual(set(hashes), {path.name for path in output.iterdir()} - {'packet-sha256.json'})
            for name, expected in hashes.items():
                self.assertEqual(prepare.sha((output / name).read_bytes()), expected)
            with self.assertRaises(FileExistsError):
                prepare.prepare(PREVIOUS, root / 'dist', '1' * 40, output, BUNDLE_PREPARER)

    def test_missing_legal_page_stops_before_creating_packet(self):
        for missing in prepare.LEGAL_FILES:
            with self.subTest(missing=missing), tempfile.TemporaryDirectory() as directory:
                root = Path(directory)
                dist = self.fixture(root)
                (dist / missing).unlink()
                with self.assertRaisesRegex(ValueError, 'Missing required'):
                    prepare.prepare(PREVIOUS, dist, '1' * 40, root / 'packet', BUNDLE_PREPARER)
                self.assertFalse((root / 'packet').exists())

    def test_bundle_preparer_is_required_by_cli(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            command = [sys.executable, '-B', str(HERE / 'prepare.py'),
                       '--previous-packet', str(PREVIOUS), '--dist', str(self.fixture(root)),
                       '--revision', '1' * 40, '--output', str(root / 'packet')]
            missing = subprocess.run(command, capture_output=True, text=True)
            self.assertEqual(missing.returncode, 2)
            self.assertIn('--bundle-preparer', missing.stderr)
            self.assertFalse((root / 'packet').exists())
            complete = subprocess.run(command + ['--bundle-preparer', str(BUNDLE_PREPARER)],
                                      capture_output=True, text=True)
            self.assertEqual(complete.returncode, 0, complete.stderr)
            self.assertTrue((root / 'packet/manifest.json').is_file())

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

    def test_activation_preserves_mobile_hero_rollback_and_refuses_wrong_pointer(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            staged = root / 'packet'
            prepare.prepare(PREVIOUS, self.fixture(root), '1' * 40, staged, BUNDLE_PREPARER)
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
                 patch.object(self.helper, 'run', return_value='mocked nginx command') as run:
                with self.assertRaisesRegex(RuntimeError, 'Company pointer drift'):
                    self.helper.activate(args)
                self.assertEqual(vhost.read_bytes(), self.baseline)
                self.assertEqual(os.readlink(current), '/wrong-release')
                self.assertFalse((root / 'backups').exists())
                self.assertFalse((public / 'releases').exists())
                run.assert_called_once_with('nginx', '-t')
                current.unlink()
                current.symlink_to(prepare.PREVIOUS_CURRENT)
                previous_umask = os.umask(0o077)
                try:
                    self.helper.activate(args)
                finally:
                    os.umask(previous_umask)
                self.assertEqual((public / 'releases/test-legal').stat().st_mode & 0o777, 0o755)
                for path in (public / 'releases/test-legal').rglob('*'):
                    self.assertEqual(path.stat().st_mode & 0o777, 0o755 if path.is_dir() else 0o644)
                self.assertTrue((current / prepare.LEGAL_FILES[0]).is_file())
                self.assertEqual(vhost.read_bytes(), self.baseline)
                self.helper.rollback(args)
                self.assertEqual(os.readlink(current), prepare.PREVIOUS_CURRENT)
                self.assertEqual(vhost.read_bytes(), self.baseline)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--previous-packet', required=True, type=Path)
    parser.add_argument('--bundle-preparer', required=True, type=Path)
    args = parser.parse_args()
    PREVIOUS = args.previous_packet.resolve()
    BUNDLE_PREPARER = args.bundle_preparer.resolve()
    unittest.main(argv=[__file__])
