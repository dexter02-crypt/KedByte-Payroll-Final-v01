#!/bin/bash
# Kedbyte Payroll — Server launcher for 4GB sandbox
# Builds (if needed) then starts the production server with full detachment
cd /home/z/my-project

pkill -f "next start" 2>/dev/null
pkill -f "next-server" 2>/dev/null
sleep 2

# Build if .next doesn't exist or is incomplete
if [ ! -f ".next/BUILD_ID" ]; then
  echo "Building production bundle (first run)..."
  NODE_OPTIONS="--max-old-space-size=2560" /home/z/my-project/node_modules/.bin/next build --webpack 2>&1 | tail -5
fi

# Start with all FDs redirected, new session, no controlling terminal
setsid bash -c 'exec /home/z/my-project/node_modules/.bin/next start -p 3000' \
  </dev/null \
  >/home/z/my-project/dev.log \
  2>&1 &

SERVER_PID=$!
disown $SERVER_PID 2>/dev/null

# Wait for ready
for i in $(seq 1 15); do
  sleep 2
  CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/ 2>/dev/null)
  if [ "$CODE" = "200" ]; then
    echo "Server ready (PID $SERVER_PID, HTTP $CODE)"
    exit 0
  fi
done
echo "Server failed to start"
exit 1
