#!/usr/bin/env bash
# Export the production D1 database to a dated SQL file outside the repo.
#
#   apps/api/scripts/backup_d1.sh [DIR]     (default: ~/qtscout-backups)
#
# D1 Time Travel already restores any minute of the last 30 days; this is the
# off-platform copy. The file holds personal data: keep DIR private.
#
# D1 can't export a database with a virtual (FTS5) table, so the regular tables
# are exported by name. The search index (meeting_search) is derived data: after
# a restore, re-saving each meeting (or scripts/pg_to_d1.py's logic) rebuilds it.
set -euo pipefail
dir="${1:-$HOME/qtscout-backups}"
mkdir -p "$dir"
chmod 700 "$dir"
out="$dir/qtscout-$(date -u +%Y%m%dT%H%M%SZ).sql"
cd "$(dirname "$0")/.."
tables=$(npx wrangler d1 execute qtscout --remote --json --command \
  "SELECT name FROM sqlite_master WHERE type = 'table' AND sql NOT LIKE 'CREATE VIRTUAL%'
   AND name NOT LIKE 'meeting_search%' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%'
   AND name <> 'd1_migrations'" \
  | python3 -c 'import sys, json; print(" ".join(r["name"] for r in json.load(sys.stdin)[0]["results"]))')
args=()
for t in $tables; do args+=(--table "$t"); done
npx wrangler d1 export qtscout --remote --output "$out" "${args[@]}"
chmod 600 "$out"
echo "Saved $out"
