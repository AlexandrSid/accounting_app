#!/bin/sh
cd "$(dirname "$0")"
node server/server.mjs &
sleep 1
open http://127.0.0.1:10800
wait
