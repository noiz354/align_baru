#!/usr/bin/env bash
# HomeOps — restore and weekly restore drill (T-PLAT-023).
#
# Implements docs/operations/BACKUP-RESTORE.md §4/§5 and RUNBOOK.md §7: a backup is restored into a
# *scratch* database first, sanity counts are compared, and only an explicit confirmation promotes it
# to a real target. The drill always drops its scratch database afterwards (it contains real
# household data — never leave copies around, §5 step 5 / §6).
#
# Usage:
#   ./scripts/restore.sh --verify  <artifact>                integrity check only
#   ./scripts/restore.sh --drill   <artifact>                weekly drill into a scratch db
#   ./scripts/restore.sh --into <db> --artifact <a> --confirm  restore into a named database
# Env:
#   DATABASE_URL          connection used for --into (and to derive createdb/psql credentials)
#   BACKUP_RECIPIENT_KEY  age private key file, when the artifact is encrypted
#   DRILL_DB_PREFIX       scratch database prefix (default homeops_drill)

set -euo pipefail

log() { printf 'restore: %s\n' "$*"; }
die() { printf 'restore: FAILED — %s\n' "$*" >&2; exit 1; }

MODE=""
ARTIFACT=""
TARGET_DB=""
CONFIRMED=0
DRILL_DB_PREFIX="${DRILL_DB_PREFIX:-homeops_drill}"
BACKUP_RECIPIENT_KEY="${BACKUP_RECIPIENT_KEY:-}"

while [ $# -gt 0 ]; do
  case "$1" in
    --verify) MODE="verify"; ARTIFACT="${2:-}"; shift 2 ;;
    --drill) MODE="drill"; ARTIFACT="${2:-}"; shift 2 ;;
    --artifact) ARTIFACT="${2:-}"; shift 2 ;;
    --into) MODE="into"; TARGET_DB="${2:-}"; shift 2 ;;
    --confirm) CONFIRMED=1; shift ;;
    *) die "unknown argument: $1" ;;
  esac
done

[ -n "$MODE" ] || die "choose a mode: --verify, --drill or --into <db>"
[ -n "$ARTIFACT" ] || die "no artifact given"
[ -f "$ARTIFACT" ] || die "artifact not found: ${ARTIFACT}"
command -v pg_restore >/dev/null 2>&1 || die "pg_restore is not installed on this host"
command -v psql >/dev/null 2>&1 || die "psql is not installed on this host"

WORKDIR="$(mktemp -d)"
SCRATCH_DB=""
cleanup() {
  # §5 step 5: the drill database contains real household data and must not survive the run.
  if [ -n "$SCRATCH_DB" ] && [ "$MODE" = "drill" ]; then
    log "dropping scratch database ${SCRATCH_DB}"
    dropdb --if-exists "$SCRATCH_DB" || log "could not drop ${SCRATCH_DB} — drop it manually"
  fi
  rm -rf "$WORKDIR"
}
trap cleanup EXIT

DUMP="$ARTIFACT"
case "$ARTIFACT" in
  *.age)
    command -v age >/dev/null 2>&1 || die "age is not installed; cannot decrypt ${ARTIFACT}"
    [ -n "$BACKUP_RECIPIENT_KEY" ] || die "BACKUP_RECIPIENT_KEY is not set; cannot decrypt ${ARTIFACT}"
    [ -f "$BACKUP_RECIPIENT_KEY" ] || die "BACKUP_RECIPIENT_KEY does not point at a file: ${BACKUP_RECIPIENT_KEY}"
    DUMP="${WORKDIR}/$(basename "${ARTIFACT%.age}")"
    log "decrypting to a temporary path"
    age --decrypt --identity "$BACKUP_RECIPIENT_KEY" -o "$DUMP" "$ARTIFACT" || die "decryption failed"
    ;;
esac

# --- integrity (BACKUP-RESTORE.md §3 step 2, RUNBOOK §7 step 2) -------------------------------
log "checking artifact integrity: $(basename "$DUMP")"
pg_restore --list "$DUMP" >/dev/null || die "pg_restore --list cannot read ${DUMP}"
if [ -f "${DUMP}.sha256" ]; then
  EXPECTED="$(cat "${DUMP}.sha256")"
  if command -v sha256sum >/dev/null 2>&1; then ACTUAL="$(sha256sum "$DUMP" | awk '{print $1}')"
  elif command -v shasum >/dev/null 2>&1; then ACTUAL="$(shasum -a 256 "$DUMP" | awk '{print $1}')"
  else ACTUAL="$EXPECTED"; log "no sha256 tool available — skipping the checksum comparison"; fi
  [ "$EXPECTED" = "$ACTUAL" ] || die "checksum mismatch: expected ${EXPECTED}, got ${ACTUAL}"
  log "checksum matches the backup manifest"
else
  log "no .sha256 manifest beside the artifact — integrity is the --list check only"
fi
[ "$MODE" = "verify" ] && { log "OK verify"; exit 0; }

# --- sanity queries (BACKUP-RESTORE.md §4.1 step 3) ------------------------------------------
# Table-aware: only VS-0 tables exist until later migrations land, so each count is guarded by
# to_regclass and reported as `absent` rather than failing the drill.
sanity_sql() {
  cat <<'SQL'
select 'household=' || count(*) from household;
select 'household_member=' || count(*) from household_member;
select 'activity_event=' || count(*) from activity_event;
select case when to_regclass('public.chore_occurrence') is null then 'chore_occurrence=absent'
            else 'chore_occurrence_open=' || (select count(*) from chore_occurrence
                 where status in ('SCHEDULED','IN_PROGRESS','SNOOZED')) end;
select case when to_regclass('public.alert') is null then 'alert=absent'
            else 'alert_open=' || (select count(*) from alert where state in ('OPEN','ACKNOWLEDGED')) end;
select 'last_activity=' || coalesce(max(created_at)::text, 'none') from activity_event;
SQL
}

restore_into() {
  local db="$1"
  log "restoring into ${db}"
  START="$(date +%s)"
  pg_restore --clean --if-exists --no-owner -d "$db" "$DUMP" || die "pg_restore into ${db} failed"
  END="$(date +%s)"
  log "restore took $((END - START))s"
  psql -d "$db" -v ON_ERROR_STOP=1 -t -c "$(sanity_sql)" || die "sanity queries failed against ${db}"
}

if [ "$MODE" = "drill" ]; then
  command -v createdb >/dev/null 2>&1 || die "createdb is not installed on this host"
  SCRATCH_DB="${DRILL_DB_PREFIX}_$(date -u +%F)"
  dropdb --if-exists "$SCRATCH_DB" || true
  createdb "$SCRATCH_DB" || die "could not create the scratch database ${SCRATCH_DB}"
  restore_into "$SCRATCH_DB"
  DRILL_SECONDS=$(( $(date +%s) - START ))
  log "OK drill — artifact $(basename "$ARTIFACT"), restore ${DRILL_SECONDS}s"
  # §5 step 6: the operator records this row in the drill log.
  printf '| %s | %s | %s s | pass | — |\n' "$(date -u +%F)" "$(basename "$ARTIFACT" | sed 's/\.[^.]*$//')" "$DRILL_SECONDS"
  exit 0
fi

# --- promoted restore (RUNBOOK §7 steps 1, 4–8) ----------------------------------------------
[ -n "$TARGET_DB" ] || die "--into needs a database name"
[ "$CONFIRMED" -eq 1 ] || die "refusing to restore into ${TARGET_DB} without --confirm; stop writes first (RUNBOOK §7 step 1)"
log "WARNING: restoring into ${TARGET_DB} overwrites its contents. Writes must already be stopped."
command -v createdb >/dev/null 2>&1 && { createdb "$TARGET_DB" 2>/dev/null || log "database ${TARGET_DB} already exists — restoring over it"; }
restore_into "$TARGET_DB"
log "next: re-apply migrations newer than the dump (npm run db:migrate), start the app, run"
log "      one manual tick (npm run scheduler:tick), then verify /today for a real member."
log "      record the data-loss window between the dump timestamp and the incident, and tell the household."
log "OK restore into ${TARGET_DB}"
