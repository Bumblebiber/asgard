#!/usr/bin/env bash
# Das Althing — Telegram Service
# Start: ./start.sh
# Stop:  Ctrl+C or systemctl --user stop council-telegram

DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR"

exec node dist/index.js
