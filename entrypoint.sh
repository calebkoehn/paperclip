#!/bin/sh
set -e

echo "========================================="
echo "  Paperclip Entrypoint"
echo "========================================="

echo "Running bootstrap-ceo (safe to re-run — skips if admin exists)..."
cd /app
pnpm paperclipai auth bootstrap-ceo 2>&1 || echo "[bootstrap-ceo] Admin already exists or skipped — continuing."

echo "========================================="
echo "  Starting Paperclip server..."
echo "========================================="

exec node --import ./server/node_modules/tsx/dist/loader.mjs server/dist/index.js
