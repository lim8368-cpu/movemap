#!/usr/bin/env bash
set -Eeuo pipefail

required=(
  DATABASE_URL
  SUPABASE_S3_ENDPOINT
  SUPABASE_S3_ACCESS_KEY_ID
  SUPABASE_S3_SECRET_ACCESS_KEY
  SUPABASE_STORAGE_BUCKET
  RESTIC_REPOSITORY
  RESTIC_PASSWORD
  AWS_ACCESS_KEY_ID
  AWS_SECRET_ACCESS_KEY
)

for name in "${required[@]}"; do
  if [[ -z "${!name:-}" ]]; then
    echo "Missing required backup variable: ${name}" >&2
    exit 1
  fi
done

interval="${BACKUP_INTERVAL_SECONDS:-86400}"
staging_root="/tmp/movemap-backup"
last_success="/var/cache/movemap-backup/last-success"

run_backup() {
  local timestamp staging
  timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
  staging="${staging_root}/${timestamp}"
  mkdir -p "${staging}/storage"

  echo "[backup] exporting PostgreSQL"
  pg_dump --format=custom --no-owner --no-acl --file "${staging}/database.dump" "${DATABASE_URL}"

  echo "[backup] copying Supabase private storage"
  rclone sync \
    --s3-provider Other \
    --s3-endpoint "${SUPABASE_S3_ENDPOINT}" \
    --s3-region "${SUPABASE_S3_REGION:-us-east-1}" \
    --s3-access-key-id "${SUPABASE_S3_ACCESS_KEY_ID}" \
    --s3-secret-access-key "${SUPABASE_S3_SECRET_ACCESS_KEY}" \
    ":s3:${SUPABASE_STORAGE_BUCKET}" "${staging}/storage"

  echo "[backup] encrypting and uploading with restic"
  restic snapshots >/dev/null 2>&1 || restic init
  restic backup "${staging}" --tag movemap --host "${HOSTNAME:-movemap-vps}"
  restic forget \
    --keep-daily "${BACKUP_KEEP_DAILY:-7}" \
    --keep-weekly "${BACKUP_KEEP_WEEKLY:-4}" \
    --keep-monthly "${BACKUP_KEEP_MONTHLY:-6}" \
    --prune

  date +%s > "${last_success}"
  rm -rf "${staging}"
  echo "[backup] completed ${timestamp}"
}

trap 'rm -rf "${staging_root}"/*' EXIT
mkdir -p "${staging_root}"

while true; do
  if ! run_backup; then
    echo "[backup] failed; retrying in one hour" >&2
    sleep 3600
    continue
  fi
  sleep "${interval}"
done
