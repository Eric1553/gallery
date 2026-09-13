#!/usr/bin/env bash
# Push gallery repo to GitHub. Requires GH_TOKEN (PAT with repo scope).
# Usage:
#   export GH_TOKEN=github_pat_xxxxxxxx
#   bash scripts/push_to_github.sh [github-username]
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

USER="${1:-}"
REPO_NAME="${GALLERY_GITHUB_REPO:-gallery}"
VISIBILITY="${GALLERY_GITHUB_VISIBILITY:-private}"

if [[ -z "${GH_TOKEN:-}" ]]; then
  echo "Set GH_TOKEN to a GitHub Personal Access Token (repo scope)." >&2
  echo "Create: GitHub → Settings → Developer settings → Fine-grained tokens" >&2
  exit 1
fi

if [[ -z "$USER" ]]; then
  USER=$(curl -s -H "Authorization: Bearer $GH_TOKEN" https://api.github.com/user | python3 -c "import sys,json; print(json.load(sys.stdin)['login'])")
fi

API="https://api.github.com"
AUTH=(-H "Authorization: Bearer $GH_TOKEN" -H "Accept: application/vnd.github+json")

# Create repo if missing
if ! curl -sf "${AUTH[@]}" "$API/repos/$USER/$REPO_NAME" >/dev/null; then
  curl -sf "${AUTH[@]}" -X POST "$API/user/repos" \
    -d "{\"name\":\"$REPO_NAME\",\"private\":$( [[ "$VISIBILITY" == private ]] && echo true || echo false ),\"description\":\"DEMO Gallery (ECS mirror)\"}" >/dev/null
  echo "Created https://github.com/$USER/$REPO_NAME"
fi

git remote remove origin 2>/dev/null || true
git remote add origin "https://$USER@github.com/$USER/$REPO_NAME.git"
git push -u origin main

echo "Done: https://github.com/$USER/$REPO_NAME"
