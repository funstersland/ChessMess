#!/bin/sh
# Restart contract: start the app on 0.0.0.0:8080 if it is not already healthy.
set -eu
if curl -sf -o /dev/null --max-time 2 http://127.0.0.1:8080/; then
  exit 0
fi
cd /workspace
npm run dev > /tmp/chessmess-dev.log 2>&1 &
# Wait until the preview port answers (Vite can take a few seconds).
i=0
while [ "$i" -lt 40 ]; do
  if curl -sf -o /dev/null --max-time 2 http://127.0.0.1:8080/; then
    exit 0
  fi
  i=$((i + 1))
  sleep 0.25
done
exit 0
