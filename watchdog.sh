#!/bin/bash
# Kedbyte Payroll — persistent server watchdog for 4GB sandbox
# Keeps the production server alive; restarts if OOM-killed
cd /home/z/my-project

while true; do
  if ! pgrep -f "next-server" >/dev/null 2>&1; then
    echo "[$(date '+%H:%M:%S')] Server down — starting..."
    pkill -f "next" 2>/dev/null
    sleep 1
    # Build if needed
    if [ ! -f ".next/BUILD_ID" ]; then
      NODE_OPTIONS="--max-old-space-size=2048" /home/z/my-project/node_modules/.bin/next build --webpack >> /home/z/my-project/dev.log 2>&1
    fi
    setsid bash -c 'exec /home/z/my-project/node_modules/.bin/next start -p 3000' </dev/null >>/home/z/my-project/dev.log 2>&1 &
    disown
    # Wait for ready
    for i in $(seq 1 15); do
      sleep 2
      CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/ 2>/dev/null)
      if [ "$CODE" = "200" ]; then
        echo "[$(date '+%H:%M:%S')] Server ready (HTTP $CODE)"
        break
      fi
    done
  fi
  sleep 5
done
