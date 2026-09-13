#!/usr/bin/env bash
# Mint / refresh a MaxKB admin token for demo-gallery federated search.
# Usage (on ECS): bash /opt/demo-gallery/scripts/mint_maxkb_token.sh
set -euo pipefail

OUT="${1:-/opt/demo-gallery/data/maxkb_token}"
mkdir -p "$(dirname "$OUT")"

TOKEN=$(docker exec -i maxkb /opt/py3/bin/python /opt/maxkb-app/apps/manage.py shell <<'PY'
from django.core import signing
from django.core.cache import cache
from common.constants.authentication_type import AuthenticationType
from common.constants.cache_version import Cache_Version
from users.models import User

user = User.objects.filter(username="admin").first()
if not user:
    raise SystemExit("admin user missing")
token = signing.dumps({
    "username": user.username,
    "id": str(user.id),
    "email": user.email,
    "type": AuthenticationType.SYSTEM_USER.value,
})
version, get_key = Cache_Version.TOKEN.value
cache.set(get_key(token), user, timeout=60 * 60 * 24 * 30, version=version)
print(token)
PY
)

# last non-empty line is the token
TOKEN=$(printf '%s\n' "$TOKEN" | awk 'NF{line=$0} END{print line}')
if [[ -z "$TOKEN" || "$TOKEN" != eyJ* ]]; then
  echo "failed to mint token" >&2
  exit 1
fi
printf '%s\n' "$TOKEN" >"$OUT"
chmod 600 "$OUT"
echo "wrote $OUT"
