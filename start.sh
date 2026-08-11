#!/bin/sh
node server.js &
node agent-daemon.js &
wait
