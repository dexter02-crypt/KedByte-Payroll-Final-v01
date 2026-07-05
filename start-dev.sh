#!/bin/bash
# Watchdog: keeps the Next.js dev server alive in the 4GB sandbox
# Restarts the server if it dies from memory pressure
cd /home/z/my-project

while true; do
  if ! pgrep -f "next-server" >/dev/null; then
    echo "[$(date '+%H:%M:%S')] Server not running. Starting..."
    pkill -f "next" 2>/dev/null
    sleep 1
    NODE_OPTIONS="--max-old-space-size=1024" nohup /home/z/my-project/node_modules/.bin/next dev -p 3000 --webpack > /home/z/my-project/dev.log 2>&1 &
    disown
    # Wait for it to be ready
    for i in $(seq 1 20); do
      sleep 2
      CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/ 2>/dev/null)
      if [ "$CODE" = "200" ]; then
        echo "[$(date '+%H:%M:%S')] Server ready (HTTP $CODE)"
        # Pre-warm the page
        curl -s -o /dev/null http://localhost:3000/ 2>/dev/null
        break
      fi
    done
  fi
  sleep 10
done
