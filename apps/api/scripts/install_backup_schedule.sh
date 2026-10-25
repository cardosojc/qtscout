#!/usr/bin/env bash
# Schedule backup_d1.sh weekly on this Mac (launchd), Mondays at 10:00.
#
#   apps/api/scripts/install_backup_schedule.sh            install / update
#   apps/api/scripts/install_backup_schedule.sh --remove   uninstall
#
# launchd runs a missed run when the Mac wakes. Output goes to
# ~/qtscout-backups/backup.log. Needs wrangler logged in (`npx wrangler login`).
set -euo pipefail
label="org.cardosojcs.qtscout.d1-backup"
plist="$HOME/Library/LaunchAgents/$label.plist"

if [[ "${1:-}" == "--remove" ]]; then
  launchctl bootout "gui/$(id -u)/$label" 2>/dev/null || true
  rm -f "$plist"
  echo "Removed $label"
  exit 0
fi

script="$(cd "$(dirname "$0")" && pwd)/backup_d1.sh"
logdir="$HOME/qtscout-backups"
mkdir -p "$logdir" && chmod 700 "$logdir"
# launchd starts with a bare PATH; give it the one node/npx/python3 live on now.
path="$(dirname "$(command -v npx)"):$(dirname "$(command -v python3)"):/usr/bin:/bin:/usr/sbin:/sbin"

cat > "$plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>$label</string>
  <key>ProgramArguments</key>
  <array><string>/bin/bash</string><string>$script</string></array>
  <key>EnvironmentVariables</key>
  <dict><key>PATH</key><string>$path</string></dict>
  <key>StartCalendarInterval</key>
  <dict><key>Weekday</key><integer>1</integer><key>Hour</key><integer>10</integer><key>Minute</key><integer>0</integer></dict>
  <key>StandardOutPath</key><string>$logdir/backup.log</string>
  <key>StandardErrorPath</key><string>$logdir/backup.log</string>
</dict>
</plist>
PLIST

launchctl bootout "gui/$(id -u)/$label" 2>/dev/null || true
launchctl bootstrap "gui/$(id -u)" "$plist"
echo "Installed $label: weekly, Mondays 10:00 -> $logdir"
