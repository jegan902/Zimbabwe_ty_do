#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."

echo "==> Starting Postgres + Redis (docker compose)..."
docker compose up -d

echo "==> Waiting for Postgres..."
for i in $(seq 1 30); do
  if docker compose exec -T postgres pg_isready -U marketplace >/dev/null 2>&1; then
    echo "Postgres is ready."
    break
  fi
  sleep 1
done

docker compose ps
docker compose exec -T postgres pg_isready -U marketplace

echo "==> Prisma migrate + seed (mirrors Quang Vinh catalog)..."
npm run db:setup

echo ""
echo "SETUP_COMPLETE — run: npm run dev"
echo "Re-sync catalog later with: npm run db:sync"
echo "Press Enter to close..."
read -r _
