#!/usr/bin/env bash
set -euo pipefail

LABEL="com.etmw.bughunter.agent"
DEST="$HOME/Library/Application Support/ETMW Bug Hunter Agent"
LOG_DIR="$HOME/Library/Logs"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"
SOURCE_DIR="$(cd "$(dirname "$0")" && pwd)"

fail() {
  echo "ERROR: $1" >&2
  exit 1
}

if [[ "${1:-}" == "--uninstall" ]]; then
  launchctl bootout "gui/$(id -u)/$LABEL" >/dev/null 2>&1 || true
  rm -f "$PLIST"
  rm -rf "$DEST"
  echo "Removed the ETMW Bug Hunter agent."
  exit 0
fi

NODE_BIN="$(command -v node || true)"
NPM_BIN="$(command -v npm || true)"

if [[ -z "$NODE_BIN" || -z "$NPM_BIN" ]]; then
  fail "Node.js 20+ is required. Install it from https://nodejs.org/ and run this script again."
fi

NODE_MAJOR="$("$NODE_BIN" -p "process.versions.node.split('.')[0]")"

if [[ "$NODE_MAJOR" -lt 20 ]]; then
  fail "Node.js 20 or newer is required (found $("$NODE_BIN" -v))."
fi

echo "==> Installing the ETMW Bug Hunter agent"
mkdir -p "$DEST" "$LOG_DIR" "$HOME/Library/LaunchAgents"
rm -rf "$DEST"
mkdir -p "$DEST"
cp -R "$SOURCE_DIR"/. "$DEST"/
chmod 600 "$DEST/config.json"

echo "==> Installing dependencies"
(cd "$DEST" && "$NPM_BIN" install --omit=dev --no-audit --no-fund)

echo "==> Registering the background service"
cat > "$PLIST" <<PLISTFILE
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>$LABEL</string>
  <key>ProgramArguments</key>
  <array>
    <string>$NODE_BIN</string>
    <string>$DEST/agent.cjs</string>
  </array>
  <key>WorkingDirectory</key>
  <string>$DEST</string>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>$LOG_DIR/ETMWBugHunterAgent.log</string>
  <key>StandardErrorPath</key>
  <string>$LOG_DIR/ETMWBugHunterAgent.log</string>
</dict>
</plist>
PLISTFILE

launchctl bootout "gui/$(id -u)/$LABEL" >/dev/null 2>&1 || true
launchctl bootstrap "gui/$(id -u)" "$PLIST"
launchctl enable "gui/$(id -u)/$LABEL"

echo
echo "Installed. The agent starts now and at every login."
echo "Logs: $LOG_DIR/ETMWBugHunterAgent.log"
echo
echo "To uninstall: bash \"$DEST/install-mac.sh\" --uninstall"
