#!/usr/bin/env bash
# dev.sh — starts the backend + ngrok tunnel, then updates mobile/.env
# Usage: bash scripts/dev.sh

set -e

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MOBILE_ENV="$REPO_ROOT/mobile/.env"
BACKEND_DIR="$REPO_ROOT/backend"
PORT=8000

# ── 1. Start backend ──────────────────────────────────────────────────────────
echo "Starting backend..."
cd "$BACKEND_DIR"
source .venv/bin/activate
uvicorn app.main:app --reload --host 0.0.0.0 --port $PORT &
BACKEND_PID=$!

# ── 2. Start ngrok ────────────────────────────────────────────────────────────
echo "Starting ngrok tunnel on port $PORT..."
ngrok http $PORT --log=stdout > /tmp/ngrok.log 2>&1 &
NGROK_PID=$!

# ── 3. Wait for ngrok to be ready ─────────────────────────────────────────────
echo "Waiting for ngrok..."
for i in $(seq 1 15); do
  URL=$(curl -s http://localhost:4040/api/tunnels 2>/dev/null \
        | grep -o '"public_url":"https://[^"]*"' \
        | head -1 \
        | cut -d'"' -f4)
  if [ -n "$URL" ]; then
    break
  fi
  sleep 1
done

if [ -z "$URL" ]; then
  echo "ERROR: ngrok did not start in time. Check /tmp/ngrok.log"
  kill $BACKEND_PID $NGROK_PID 2>/dev/null
  exit 1
fi

# ── 4. Update mobile/.env and app.json ───────────────────────────────────────
if grep -q "EXPO_PUBLIC_API_BASE_URL" "$MOBILE_ENV" 2>/dev/null; then
  sed -i "s|EXPO_PUBLIC_API_BASE_URL=.*|EXPO_PUBLIC_API_BASE_URL=$URL|" "$MOBILE_ENV"
else
  echo "EXPO_PUBLIC_API_BASE_URL=$URL" >> "$MOBILE_ENV"
fi

# Update app.json extra.API_BASE_URL (read by Constants.expoConfig.extra)
APP_JSON="$REPO_ROOT/mobile/app.json"
python3 -c "
import json, sys
with open('$APP_JSON') as f:
    d = json.load(f)
d['expo']['extra']['API_BASE_URL'] = '$URL'
with open('$APP_JSON', 'w') as f:
    json.dump(d, f, indent=2)
print('app.json updated')
"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Backend : http://localhost:$PORT"
echo "  Tunnel  : $URL"
echo "  mobile/.env updated automatically"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Now run in a separate terminal:"
echo "  cd mobile && npx expo start --clear"
echo ""
echo "Press Ctrl+C to stop everything."

# ── 5. Keep running until Ctrl+C ─────────────────────────────────────────────
trap "echo 'Shutting down...'; kill $BACKEND_PID $NGROK_PID 2>/dev/null" EXIT INT TERM
wait $BACKEND_PID
