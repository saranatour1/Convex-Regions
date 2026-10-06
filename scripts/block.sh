#!/bin/sh
# Block (or unblock) a user in every region by handle (users.handle, from the dashboard).
# Usage: pnpm run block <handle> [unblock] [reason]
set -e
handle="$1"; action="${2:-block}"; reason="${3:-}"
[ -n "$handle" ] || { echo "usage: pnpm run block <handle> [unblock] [reason]"; exit 1; }
for r in us eu au ca; do
  printf "dev/%s: " "$r"
  npx convex run --deployment "dev/$r" "admin:$action" "{\"handle\":\"$handle\",\"reason\":\"$reason\"}"
done
