#!/usr/bin/env bash
# Builds and starts the Finance App from .app against the Docker database.
# Production mode (next build + next start), so headers and errors match a real deploy.
set -euo pipefail
cd "$(dirname "$0")/.."
APP_REF="${APP_REF:-master}"

if [ ! -d .app ]; then
  git clone --quiet https://github.com/BRLorena/finance_app.git .app
fi
git -C .app checkout --quiet "$APP_REF"

set -a; source scripts/app.env; set +a

cd .app
npm ci --silent --no-audit --no-fund
npx prisma db push --skip-generate --accept-data-loss >/dev/null
npx prisma generate >/dev/null
npx next build --turbopack >/dev/null
exec npx next start -p "${PORT:-3100}"
