#!/usr/bin/env sh
set -eu

file=/var/cache/movemap-backup/last-success
interval="${BACKUP_INTERVAL_SECONDS:-86400}"
test -s "$file"
last="$(cat "$file")"
now="$(date +%s)"
max_age=$((interval * 2 + 3600))
test $((now - last)) -lt "$max_age"
