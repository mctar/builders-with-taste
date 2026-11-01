#!/usr/bin/env bash
set -euo pipefail
umask 077
cd "$(dirname "$0")/.."
backup_dir="${BACKUP_DIRECTORY:-$PWD/.runtime/backups}/$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$backup_dir"
# Pause app writes briefly so database references and photo files match.
docker compose stop api
trap 'docker compose start api >/dev/null' EXIT
docker compose exec -T db pg_dump -U builders -d builders -Fc > "$backup_dir/database.dump"
docker compose run --rm --no-deps -T --entrypoint tar api -C /data -czf - photos > "$backup_dir/photos.tar.gz"
printf 'Backup saved to %s\n' "$backup_dir"
