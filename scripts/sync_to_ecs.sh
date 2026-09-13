#!/usr/bin/env bash
# Fail-closed scoped demo sync. Gallery module promotion belongs to release-ops.
set -euo pipefail

KEY="${SSH_KEY:-/Users/lorin/Documents/ECS服务器/eric.pem}"
HOST="${ECS_HOST:-120.55.184.234}"
USER="${ECS_USER:-root}"
DEMO_ID=""
SOURCE=""
APPLY=0

# These reviewed/frozen demos must never be placed in an rsync deletion scope.
FROZEN_IDS=(biren-ceo biren-ops-loop biren-finance biren-finance__baseline)
EXCLUDES=(
  --exclude='data/'
  --exclude='covers/'
  --exclude='.stage/'
  --exclude='.git/'
  --exclude='node_modules/'
  --exclude='.venv/'
  --exclude='venv/'
  --exclude='__pycache__/'
  --exclude='.DS_Store'
  --exclude='*.pyc'
  --exclude='*.zip'
  --exclude='*.tar.gz'
  --exclude='*.pem'
  --exclude='*.mp4'
  --exclude='*.mov'
)
PROTECT=(
  --filter='P cover.webp'
  --filter='P thumb.webp'
  --filter='P cover.png'
  --filter='P thumb.png'
)

usage() {
  cat <<'EOF'
Usage: sync_to_ecs.sh --demo-id ID --source DIR [--apply]

Default is dry-run. --apply permits a scoped rsync to /opt/demos/ID only.
Frozen IDs are refused. data/, covers/, and .stage/ are always excluded.
This script never deploys /opt/demo-gallery, changes systemd/Nginx, kills ports,
or restarts services. Gallery module promotion must be handled by release-ops.
EOF
}

while (($#)); do
  case "$1" in
    --demo-id) [[ $# -ge 2 ]] || { echo "missing value for --demo-id" >&2; exit 64; }; DEMO_ID="$2"; shift 2 ;;
    --source) [[ $# -ge 2 ]] || { echo "missing value for --source" >&2; exit 64; }; SOURCE="$2"; shift 2 ;;
    --apply) APPLY=1; shift ;;
    --help|-h) usage; exit 0 ;;
    *) echo "unknown argument: $1" >&2; usage >&2; exit 64 ;;
  esac
done

[[ -n "$DEMO_ID" && -n "$SOURCE" ]] || { usage >&2; exit 64; }
[[ "$DEMO_ID" =~ ^[a-z0-9][a-z0-9-]*$ ]] || { echo "invalid demo id" >&2; exit 64; }
for frozen in "${FROZEN_IDS[@]}"; do
  if [[ "$DEMO_ID" == "$frozen" ]]; then
    echo "refusing frozen demo id: $DEMO_ID; it cannot enter a synchronization deletion scope" >&2
    exit 64
  fi
done
[[ -d "$SOURCE" ]] || { echo "source directory not found: $SOURCE" >&2; exit 66; }
SOURCE="$(cd "$SOURCE" && pwd -P)"
[[ "$SOURCE" != "/" ]] || { echo "refusing filesystem root as source" >&2; exit 64; }

REMOTE="${USER}@${HOST}"
TARGET="/opt/demos/${DEMO_ID}"
RSYNC_SSH="ssh -i $KEY -o IdentitiesOnly=yes -o ConnectTimeout=20"
SSH=(ssh -i "$KEY" -o IdentitiesOnly=yes -o ConnectTimeout=20 "$REMOTE")

# Fail closed instead of creating a production path during a nominal dry-run.
"${SSH[@]}" "test -d '$TARGET'" || {
  echo "remote target is absent: $TARGET" >&2
  echo "Ask release-ops to create/review the target before syncing." >&2
  exit 73
}

RSYNC_FLAGS=(-az --delete-delay "${EXCLUDES[@]}" "${PROTECT[@]}" -e "$RSYNC_SSH")
if ((APPLY == 0)); then
  RSYNC_FLAGS+=(--dry-run --itemize-changes)
  echo "DRY-RUN: no remote files will be changed."
else
  echo "APPLY: scoped target only: $TARGET"
fi

rsync "${RSYNC_FLAGS[@]}" "$SOURCE/" "$REMOTE:$TARGET/"
echo "No service action was taken. Gallery module release requires release-ops."
