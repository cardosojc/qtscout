#!/usr/bin/env bash
#
# Claude Code Stop hook: if any "core" file changed in the working tree but
# neither CLAUDE.md nor docs/architecture.md was touched, surface a reminder
# so Claude revisits the docs before stopping. Fires at most once per session.
#
# Wired up in .claude/settings.json. Run manually with `--dry-run` to inspect
# what it would report.
set -euo pipefail

CACHE_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}/.claude/cache"
mkdir -p "$CACHE_DIR"

SESSION_ID=""
if [ "${1:-}" != "--dry-run" ] && [ ! -t 0 ]; then
  INPUT=$(cat || true)
  if [ -n "$INPUT" ] && command -v python3 >/dev/null 2>&1; then
    SESSION_ID=$(printf '%s' "$INPUT" | python3 -c 'import sys,json
try:
  print(json.load(sys.stdin).get("session_id",""))
except Exception:
  pass' || true)
  fi
fi
SESSION_ID="${SESSION_ID:-default}"
SENTINEL="$CACHE_DIR/docs-drift-reminded-$SESSION_ID"

# If we already reminded in this session, stay silent.
if [ "${1:-}" != "--dry-run" ] && [ -f "$SENTINEL" ]; then
  exit 0
fi

WATCHLIST=(
  "prisma/schema.prisma"
  "src/types/ordem-item.ts"
  "src/types/ordem-servico.ts"
  "src/lib/ordem-assembler.ts"
  "src/lib/ordem-resolver.ts"
  "src/lib/ordem-permissions.ts"
  "src/lib/pdf-generator.ts"
  "src/lib/auth-helpers.ts"
  "src/app/api/ordens-servico/generate/route.ts"
  "src/app/api/scouts/import/route.ts"
  "src/app/api/ordem-items/import-activities/route.ts"
)
DOCS=(
  "CLAUDE.md"
  "docs/architecture.md"
)

# git might not be available; fail open (no reminder).
if ! command -v git >/dev/null 2>&1; then
  exit 0
fi

CHANGED=$(git diff --name-only HEAD 2>/dev/null || true)
if [ -z "$CHANGED" ]; then
  exit 0
fi

matched=()
for f in "${WATCHLIST[@]}"; do
  if printf '%s\n' "$CHANGED" | grep -qx "$f"; then
    matched+=("$f")
  fi
done

if [ "${#matched[@]}" -eq 0 ]; then
  exit 0
fi

docs_touched=0
for f in "${DOCS[@]}"; do
  if printf '%s\n' "$CHANGED" | grep -qx "$f"; then
    docs_touched=1
    break
  fi
done

if [ "$docs_touched" -eq 1 ]; then
  exit 0
fi

# Also remind to refresh the generated category doc when the catalog or
# assembler changed.
catalog_changed=0
for f in "src/types/ordem-item.ts" "src/lib/ordem-assembler.ts"; do
  if printf '%s\n' "$CHANGED" | grep -qx "$f"; then
    catalog_changed=1
    break
  fi
done

if [ "${1:-}" = "--dry-run" ]; then
  printf 'would remind. matched:\n'
  printf '  - %s\n' "${matched[@]}"
  [ "$catalog_changed" -eq 1 ] && printf '  (catalog changed — also run npm run docs:sync)\n'
  exit 0
fi

touch "$SENTINEL"

{
  echo "Docs drift check: the following core files changed but neither"
  echo "CLAUDE.md nor docs/architecture.md was updated:"
  echo
  for f in "${matched[@]}"; do echo "  - $f"; done
  echo
  echo "Decide whether the change warrants a docs update before stopping:"
  echo "  - Schema / category shape / pipeline changes → almost always update"
  echo "  - New endpoints or component layout → consider docs/architecture.md"
  echo "  - Pure refactor / bugfix → likely no update needed"
  if [ "$catalog_changed" -eq 1 ]; then
    echo
    echo "The category catalog or assembler changed — also run \`npm run docs:sync\`"
    echo "to refresh docs/ordem-categories.md."
  fi
  echo
  echo "If no update is needed, briefly say so to dismiss this reminder."
} >&2

# Exit 2 = block stop, surface stderr to Claude as a system reminder.
exit 2
