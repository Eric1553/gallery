#!/usr/bin/env bash
# 江原原型 → Gallery：升版 + 同步静态 + 双写 catalog（含 runtime）+ restart
# 用法：
#   bash scripts/push_gallery.sh              # 升版并推送
#   bash scripts/push_gallery.sh --no-bump    # 不改版本号，只推文件
#   bash scripts/push_gallery.sh --recapture  # 额外重截封面
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd -P)"
KEY="${SSH_KEY:-/Users/lorin/Documents/ECS服务器/eric.pem}"
HOST="${ECS_HOST:-120.55.184.234}"
REMOTE="root@${HOST}"
DEMO_ID="jiangyuan-rd-pm"
CATALOG="/Users/lorin/Documents/ECS服务器/dev/demo-gallery/catalog.json"
SYNC="/Users/lorin/Documents/ECS服务器/dev/demo-gallery/scripts/sync_to_ecs.sh"
SSH=(ssh -i "$KEY" -o IdentitiesOnly=yes -o ConnectTimeout=20 "$REMOTE")
SCP=(scp -i "$KEY" -o IdentitiesOnly=yes)

BUMP=1
RECAPTURE=0
for arg in "$@"; do
  case "$arg" in
    --no-bump) BUMP=0 ;;
    --recapture) RECAPTURE=1 ;;
    --help|-h)
      sed -n '2,7p' "$0"
      exit 0
      ;;
  esac
done

[[ -f "$KEY" ]] || { echo "missing SSH key: $KEY" >&2; exit 66; }
[[ -f "$CATALOG" ]] || { echo "missing catalog: $CATALOG" >&2; exit 66; }

NEW_VER=""
if [[ "$BUMP" -eq 1 ]]; then
  NEW_VER="$(python3 - <<PY
import json
from pathlib import Path
p = Path("$CATALOG")
c = json.loads(p.read_text())
d = next(x for x in c["demos"] if x["id"] == "$DEMO_ID")
cur = int(d.get("version") or 0)
# also parse vN from version_label
lab = str(d.get("version_label") or "")
if not cur and lab.startswith("v") and lab[1:].isdigit():
    cur = int(lab[1:])
nxt = max(cur, 0) + 1
d["version"] = nxt
d["version_label"] = f"v{nxt}"
d["featured"] = True
d["audience"] = "client"
p.write_text(json.dumps(c, ensure_ascii=False, indent=2) + "\n")
print(nxt)
PY
)"
  echo "==> bumped catalog version → v${NEW_VER}"
else
  NEW_VER="$(python3 - <<PY
import json
from pathlib import Path
d = next(x for x in json.loads(Path("$CATALOG").read_text())["demos"] if x["id"] == "$DEMO_ID")
print(d.get("version") or d.get("version_label") or "?")
PY
)"
  echo "==> keep version ${NEW_VER}"
fi

echo "==> sync static → /opt/demos/${DEMO_ID}/"
bash "$SYNC" --demo-id "$DEMO_ID" --source "$ROOT" --apply

echo "==> sync catalog → /opt/demo-gallery + runtime current"
"${SCP[@]}" "$CATALOG" "$REMOTE:/opt/demo-gallery/catalog.json"
"${SCP[@]}" "$CATALOG" "$REMOTE:/opt/demo-runtime/demo-gallery/current/catalog.json"

if [[ "$RECAPTURE" -eq 1 ]]; then
  echo "==> recapture covers"
  "${SSH[@]}" "cd /opt/demo-gallery && python3 scripts/capture_covers.py --base 'http://${HOST}' --only ${DEMO_ID} --upload" \
    || "${SSH[@]}" "cd /opt/demo-runtime/demo-gallery/current && python3 scripts/capture_covers.py --base 'http://${HOST}' --only ${DEMO_ID} --upload" \
    || echo "WARN: cover capture skipped/failed" >&2
fi

echo "==> restart demo-gallery"
"${SSH[@]}" "systemctl restart demo-gallery && sleep 1 && systemctl is-active demo-gallery"

echo "==> verify"
curl -s -o /dev/null -w "demo %{http_code}\n" "http://${HOST}/demos/${DEMO_ID}/"
COOKIE_JAR="$(mktemp)"
if [[ -n "${GALLERY_PASSWORD:-}" ]]; then
  LOGIN_JSON="$(python3 -c 'import json,os; print(json.dumps({"password": os.environ["GALLERY_PASSWORD"]}))')"
  curl -s -c "$COOKIE_JAR" -b "$COOKIE_JAR" -H 'Content-Type: application/json' \
    -d "$LOGIN_JSON" "http://${HOST}/api/auth/login" >/dev/null || true
else
  echo "WARN: GALLERY_PASSWORD unset; skip catalog verify login" >&2
fi
curl -s -b "$COOKIE_JAR" "http://${HOST}/api/catalog.json" \
  | python3 -c "import json,sys; d=next(x for x in json.load(sys.stdin)['demos'] if x['id']=='jiangyuan-rd-pm'); print('catalog', d.get('version_label'), 'featured=', d.get('featured'))"
rm -f "$COOKIE_JAR"

HB="/Users/lorin/Documents/ECS服务器/data/_agent_heartbeat/gallery-jiangyuan-rd-pm.md"
mkdir -p "$(dirname "$HB")"
cat > "$HB" <<EOF
# gallery-jiangyuan-rd-pm
ts: $(date '+%Y-%m-%dT%H:%M:%S%z')
step: push_gallery
version: v${NEW_VER}
files_touched: /opt/demos/${DEMO_ID}/, catalog (gallery+runtime)
next: none
blocked: no
status: done
EOF

echo "==> done  http://${HOST}/demos/${DEMO_ID}/  (v${NEW_VER})"
