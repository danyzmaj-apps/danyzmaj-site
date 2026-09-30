#!/usr/bin/env bash
# Regenerates the screens canvas: docs/screens/<id>.png and docs/screens.html.
# Serves the static site locally and drives every page state with Playwright
# (fetched through npx; nothing is added to the site). SCREENS_ONLY=<id,id>
# limits the run to those screen ids.
set -euo pipefail
cd "$(dirname "$0")/.."
PW=playwright@1.62.1
npx -y "$PW" install chromium >/dev/null 2>&1
npx -y -p "$PW" sh -c 'NODE_PATH="$(dirname "$(dirname "$(command -v playwright)")")" exec node tool/screens/capture.cjs'
