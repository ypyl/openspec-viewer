#!/usr/bin/env bash
# Start the OpenSpec Local Viewer dev server and open it in the browser.
# Run from the project folder: ./start.sh  (npx http-server, else python)
set -e
cd "$(dirname "$0")"

PORT=8743
URL="http://127.0.0.1:$PORT/"

echo "Starting server at $URL  (Ctrl+C to stop)"
if command -v npx >/dev/null 2>&1; then
  ( npx http-server . -p "$PORT" --cors >/dev/null 2>&1 & )
else
  ( python -m http.server "$PORT" >/dev/null 2>&1 & )
fi

for i in $(seq 1 20); do
  if curl -s -o /dev/null "$URL" 2>/dev/null; then
    break
  fi
  sleep 0.25
done

# Open the default browser (handle both Git Bash and macOS/Linux).
if command -v start >/dev/null 2>&1; then
  start "" "$URL" >/dev/null 2>&1 || cmd //c start "" "$URL" >/dev/null 2>&1
elif command -v open >/dev/null 2>&1; then
  open "$URL"
else
  xdg-open "$URL" >/dev/null 2>&1 || true
fi
