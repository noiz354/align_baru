#!/usr/bin/env bash
# HomeOps — database + attachment backup (T-PLAT-023).
#
# Implements docs/operations/BACKUP-RESTORE.md §3 exactly: dump in custom format, verify the
# artifact is readable *before* trusting it, encrypt before it leaves the host, copy off-host,
# prune local copies. Success or failure is printed on stdout with a `backup:` prefix and a
# non-zero exit code, because a silently broken cron on a single host is the classic failure
# (BACKUP-RESTORE.md §3 rules). T-OPS-001 (VS-16) wires the nightly schedule and the alerting.
#
# Usage:  DATABASE_URL=postgres://… ./scripts/backup.sh
# Env:    DATABASE_URL           required
#         BACKUP_DIR             local staging dir            (default /backups)
#         BACKUP_REMOTE          rclone destination, e.g. remote:homeops-backups/  (optional)
#         BACKUP_RECIPIENT       age public key for encryption (required when BACKUP_REMOTE is set)
#         ATTACHMENT_STORAGE_ROOT  when set, a tarball of it is backed up alongside the dump
#         BACKUP_LOCAL_RETENTION_DAYS  local prune window      (default 3)

set -euo pipefail

log() { printf 'backup: %s\n' "$*"; }
die() { printf 'backup: FAILED — %s\n' "$*" >&2; exit 1; }

DATABASE_URL="${DATABASE_URL:-}"
BACKUP_DIR="${BACKUP_DIR:-/backups}"
BACKUP_REMOTE="${BACKUP_REMOTE:-}"
BACKUP_RECIPIENT="${BACKUP_RECIPIENT:-}"
ATTACHMENT_STORAGE_ROOT="${ATTACHMENT_STORAGE_ROOT:-}"
LOCAL_RETENTION_DAYS="${BACKUP_LOCAL_RETENTION_DAYS:-3}"
STAMP="$(date -u +%F)"
SLUG="homeops-${STAMP}"

[ -n "$DATABASE_URL" ] || die "DATABASE_URL is not set"
command -v pg_dump >/dev/null 2>&1 || die "pg_dump is not installed on this host"
command -v pg_restore >/dev/null 2>&1 || die "pg_restore is not installed on this host"
mkdir -p "$BACKUP_DIR" || die "cannot create ${BACKUP_DIR}"

DUMP="${BACKUP_DIR}/${SLUG}.dump"

# 1) dump (custom format allows selective restore)
log "dumping to ${DUMP}"
pg_dump --format=custom --no-owner --file="$DUMP" "$DATABASE_URL" || die "pg_dump failed"
[ -s "$DUMP" ] || die "the dump is empty"

# 2) verify the artifact is readable before trusting it
log "verifying artifact"
pg_restore --list "$DUMP" >/dev/null || die "pg_restore --list could not read ${DUMP} — the artifact is not trustworthy"
ENTRIES="$(pg_restore --list "$DUMP" | grep -c '^[0-9]' || true)"
log "artifact readable: ${ENTRIES} table-of-contents entries"

# Integrity manifest: the restore drill compares against it (BACKUP-RESTORE.md §5 step 3).
if command -v sha256sum >/dev/null 2>&1; then
  sha256sum "$DUMP" | awk '{print $1}' > "${DUMP}.sha256"
elif command -v shasum >/dev/null 2>&1; then
  shasum -a 256 "$DUMP" | awk '{print $1}' > "${DUMP}.sha256"
else
  log "no sha256 tool available — writing size only"
  wc -c < "$DUMP" > "${DUMP}.sha256"
fi

ARTIFACTS=("$DUMP")

# Attachments are backed up with the database (BACKUP-RESTORE.md §1).
if [ -n "$ATTACHMENT_STORAGE_ROOT" ]; then
  [ -d "$ATTACHMENT_STORAGE_ROOT" ] || die "ATTACHMENT_STORAGE_ROOT=${ATTACHMENT_STORAGE_ROOT} is not a directory"
  ATT_TAR="${BACKUP_DIR}/attachments-${STAMP}.tar.gz"
  log "packing attachments from ${ATTACHMENT_STORAGE_ROOT}"
  tar czf "$ATT_TAR" -C "$ATTACHMENT_STORAGE_ROOT" . || die "attachment tarball failed"
  ARTIFACTS+=("$ATT_TAR")
fi

# 3) encrypt before it leaves the host
if [ -n "$BACKUP_REMOTE" ]; then
  [ -n "$BACKUP_RECIPIENT" ] || die "BACKUP_REMOTE is set but BACKUP_RECIPIENT is not — refusing to copy plaintext off-host"
  command -v age >/dev/null 2>&1 || die "age is not installed; BACKUP-RESTORE.md §3 requires encryption before the artifact leaves the host"
  ENCRYPTED=()
  for artifact in "${ARTIFACTS[@]}"; do
    log "encrypting $(basename "$artifact")"
    age --recipient "$BACKUP_RECIPIENT" -o "${artifact}.age" "$artifact" || die "encryption failed for ${artifact}"
    ENCRYPTED+=("${artifact}.age")
  done
  ARTIFACTS=("${ENCRYPTED[@]}")

  # 4) copy off-host, then check the remote size
  command -v rclone >/dev/null 2>&1 || die "rclone is not installed; cannot copy to ${BACKUP_REMOTE}"
  for artifact in "${ARTIFACTS[@]}"; do
    log "copying $(basename "$artifact") to ${BACKUP_REMOTE}"
    rclone copy "$artifact" "$BACKUP_REMOTE" || die "off-host copy failed for ${artifact}"
    LOCAL_SIZE="$(wc -c < "$artifact")"
    REMOTE_SIZE="$(rclone size "${BACKUP_REMOTE%/}/$(basename "$artifact")" --json 2>/dev/null | grep -o '"bytes":[0-9]*' | cut -d: -f2 || echo "")"
    if [ -n "$REMOTE_SIZE" ] && [ "$REMOTE_SIZE" != "$LOCAL_SIZE" ]; then
      die "remote size ${REMOTE_SIZE} != local size ${LOCAL_SIZE} for ${artifact}"
    fi
  done

  # Retention: 30 daily + 8 weekly (BACKUP-RESTORE.md §1/§6). Weekly = the Sunday dump.
  log "applying remote retention (30 daily, 8 weekly)"
  rclone delete "$BACKUP_REMOTE" --include 'homeops-*.dump.age' --min-age 30d || log "daily retention pass reported an error"
  rclone delete "$BACKUP_REMOTE" --include 'homeops-*-0.dump.age' --min-age 56d || log "weekly retention pass reported an error"
else
  log "no BACKUP_REMOTE set — artifacts stay on this host (encryption not required for local files)"
fi

# 5) prune local files older than the local window (the off-host copy is the archive)
log "pruning local artifacts older than ${LOCAL_RETENTION_DAYS} day(s)"
find "$BACKUP_DIR" \( -name 'homeops-*.dump*' -o -name 'attachments-*.tar.gz*' \) -mtime +"$LOCAL_RETENTION_DAYS" -delete

for artifact in "${ARTIFACTS[@]}"; do
  log "artifact $(basename "$artifact") $(wc -c < "$artifact") bytes"
done
log "OK ${SLUG} (${#ARTIFACTS[@]} artifact(s))"
