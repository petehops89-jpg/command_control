#!/bin/sh
# Start both the Express server and the agent response daemon
node server.js &
node agent-daemon.js &
wait
