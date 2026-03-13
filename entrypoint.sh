#!/bin/sh
set -e
echo "========================================="
echo "  Paperclip Entrypoint"
echo "========================================="

CONFIG_DIR="/paperclip/instances/default"
CONFIG_FILE="$CONFIG_DIR/config.json"
mkdir -p "$CONFIG_DIR"

# Create minimal config.json if missing (required by CLI commands)
if [ ! -f "$CONFIG_FILE" ]; then
  echo "Creating instance config at $CONFIG_FILE..."
  node -e "
const fs = require('fs');
const config = {
  '\$meta': { version: 1, updatedAt: new Date().toISOString(), source: 'onboard' },
  database: {
    mode: 'postgres',
    connectionString: process.env.DATABASE_URL || '',
    backup: { enabled: true, intervalMinutes: 60, retentionDays: 30, dir: '/paperclip/instances/default/data/backups' }
  },
  logging: { mode: 'file', logDir: '/paperclip/instances/default/logs' },
  server: {
    deploymentMode: 'authenticated',
    exposure: 'private',
    host: '0.0.0.0',
    port: 10000,
    allowedHostnames: ['autonomous-adam.onrender.com'],
    serveUi: true
  },
  auth: { baseUrlMode: 'auto', disableSignUp: false }
};
fs.writeFileSync('$CONFIG_FILE', JSON.stringify(config, null, 2));
console.log('Config written successfully.');
"
else
  echo "Config already exists at $CONFIG_FILE"
fi

# Bootstrap first admin invite (safe to re-run — skips if admin already exists)
echo "Running bootstrap-ceo..."
cd /app
pnpm paperclipai auth bootstrap-ceo \
  --base-url "https://autonomous-adam.onrender.com" \
  2>&1 || echo "[bootstrap-ceo] Admin already exists or error — continuing."

echo "========================================="
echo "  Starting Paperclip server..."
echo "========================================="
exec node --import ./server/node_modules/tsx/dist/loader.mjs server/dist/index.js
