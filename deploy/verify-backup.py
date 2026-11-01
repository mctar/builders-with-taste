#!/usr/bin/env python3
"""Restore a backup into a newly created test database; never modify the live DB."""
from pathlib import Path
import hashlib
import shutil
import subprocess
import tarfile
import tempfile
import uuid

root = Path(__file__).resolve().parents[1]
backups = sorted((root / '.runtime/backups').glob('*/database.dump'))
if not backups:
    raise SystemExit('Take a backup first with bash deploy/backup.sh')
backup = backups[-1].parent
compose = ['docker', 'compose', '-f', str(root / 'compose.yml'), '--project-directory', str(root)]

def run(args, **kwargs):
    return subprocess.run(compose + ['exec', '-T', 'db'] + args, check=True, **kwargs)

database = 'bwt_restore_' + uuid.uuid4().hex[:12]
directory = Path(tempfile.mkdtemp(prefix='restore-', dir=root / '.runtime'))
created = False
try:
    run(['createdb', '-U', 'builders', database])
    created = True
    with (backup / 'database.dump').open('rb') as stream:
        run(['pg_restore', '--no-owner', '--exit-on-error', '-U', 'builders', '-d', database], stdin=stream)
    with tarfile.open(backup / 'photos.tar.gz') as archive:
        archive.extractall(directory, filter='data')
    result = run(['psql', '-U', 'builders', '-d', database, '-Atc', 'SELECT id FROM assets'], capture_output=True, text=True)
    env = dict(line.split('=', 1) for line in (root / '.env').read_text().splitlines() if '=' in line)
    originals = Path(env['PHOTO_DIRECTORY']) / 'photos'
    assets = result.stdout.splitlines()
    for asset in assets:
        for suffix in ['.jpg', '-thumb.jpg']:
            restored = directory / 'photos' / (asset + suffix)
            original = originals / (asset + suffix)
            assert restored.exists(), 'Missing restored image'
            assert hashlib.sha256(restored.read_bytes()).digest() == hashlib.sha256(original.read_bytes()).digest(), 'Restored image differs'
    counts = run(['psql', '-U', 'builders', '-d', database, '-Atc', 'SELECT count(*) FROM participants'], capture_output=True, text=True)
    print('Verified isolated database restore:', counts.stdout.strip(), 'participants;', len(assets), 'photos with matching originals and thumbnails.')
finally:
    if created:
        run(['dropdb', '-U', 'builders', database])
    shutil.rmtree(directory)
