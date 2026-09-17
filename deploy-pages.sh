#!/usr/bin/env bash
# Build CityStride's frontend as a static site and publish it to the gh-pages
# branch, which GitHub Pages serves at https://adityaabandaru.github.io/hackathons/
#
#   API_BASE_URL=https://citystride-api.onrender.com ./deploy-pages.sh
#
# (No Actions workflow is used, so no `workflow` token scope is needed.)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
: "${API_BASE_URL:?set API_BASE_URL to the deployed backend, e.g. https://citystride-api.onrender.com}"
cd "$ROOT/CityStride/frontend"
npm ci --silent
NEXT_OUTPUT=export NEXT_PUBLIC_BASE_PATH=/hackathons NEXT_PUBLIC_API_BASE_URL="$API_BASE_URL" npm run build
touch out/.nojekyll
cd "$ROOT"
tmp=$(mktemp -d)
git worktree add -q --detach "$tmp"
(
  cd "$tmp"
  git checkout -q --orphan gh-pages
  git rm -rfq . >/dev/null 2>&1 || true
  cp -R "$ROOT/CityStride/frontend/out/." .
  git add -A
  git commit -qm "Publish CityStride ($(date -u +%Y-%m-%dT%H:%MZ), API $API_BASE_URL)"
  git push -qf origin gh-pages
)
git worktree remove -f "$tmp"
rm -rf "$ROOT/CityStride/frontend/out"
echo "published: https://adityaabandaru.github.io/hackathons/"
