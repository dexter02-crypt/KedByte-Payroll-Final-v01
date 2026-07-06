#!/bin/bash
cd /home/z/my-project
if ! pgrep -f "next-server" >/dev/null 2>&1; then
  pkill -f "next" 2>/dev/null
  sleep 1
  setsid bash -c 'exec /home/z/my-project/node_modules/.bin/next start -p 3000' </dev/null >>/home/z/my-project/dev.log 2>&1 &
  disown
fi
