#!/usr/bin/env bash
# Build CityStride's frontend as a static site and publish it to the gh-pages
# branch, which GitHub Pages serves at https://adityaabandaru.github.io/hackathons/
#
#   API_BASE_URL=https://citystride-api.onrender.com ./deploy-pages.sh
#
# (No Actions workflow is used, so no `workflow` token scope is needed.)
set -euo pipefail
cd "$(dirname "$0")"
: "${API_BASE_URL:?set API_BASE_URL to the deployed backend, e.g. https://citystride-api.onrender.com}"
( cd CityStride/frontend \
  && npm ci --silent \
  && NEXT_OUTPUT=export NEXT_PUBLIC_BASE_PATH=/hackathons NEXT_PUBLIC_API_BASE_URL="$API_BASE_URL" npm run build \
  && touch out/.nojekyll )
tmp=$(mktemp -d)
git worktree add -q --detach "$tmp"
( cd "$tmp" \
  && git checkout -q --orphan gh-pages \
  && git rm -rfq . >/dev/null 2>&1 || true \
  && cp -R ../../"$(realpath --relative-to="$tmp" CityStride/frontend/out 2>/dev/null || echo "$PWD/CityStride/frontend/out")"/. . 2>/dev/null || cp -R "$OLDPWD/CityStride/frontend/out/." . \
  && git add -A \
  && git commit -qm "Publish CityStride ($(date -u +%Y-%m-%dT%H:%MZ), API $API_BASE_URL)" \
  && git push -qf origin gh-pages )
git worktree remove -f "$tmp"
rm -rf CityStride/frontend/out
echo "published: https://adityaabandaru.github.io/hackathons/"
