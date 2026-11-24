# ETMW Bug Hunter desktop agent

This folder is the source of the download that the dashboard builds. The ZIP contains:

- `agent.cjs` — the background process
- `config.json` — the server URL, agent id and token for the account that downloaded it
- `dist/` — the same detector code the server runs
- `install-mac.sh` / `install-windows.ps1`
- `README.txt` (this file)

## Requirements

- Node.js 20 or newer on the computer that holds the code.
- Outbound HTTPS/WSS access to the Bug Hunter server.

The installers check Node and print the download link if it is missing.

## Install on macOS

1. Unzip the download.
2. Open Terminal in that folder.
3. Run `bash install-mac.sh`.
4. The agent starts immediately and at every login via a LaunchAgent.
5. Logs: `~/Library/Logs/ETMWBugHunterAgent.log`.

## Install on Windows

1. Unzip the download.
2. Right-click `install-windows.ps1` → **Run with PowerShell**.
3. The agent starts immediately and at every login via a scheduled task (or the Startup folder
   if the task cannot be created).
4. Logs: `%LOCALAPPDATA%\ETMW\BugHunterAgent\agent.log`.

## What it can do

- Connect to the server over WebSocket using its own token.
- Receive `scan.start` / `scan.stop` for projects registered to the same account.
- Read files in the requested folder, run the static rules, and send only findings.
- Reconnect with backoff if the network drops.

## What it cannot do

There is no message in the protocol that writes, deletes, renames, patches or formats a file. The
agent imports `readdir`, `stat` and `readFile` only. It never runs a project command or package
manager. This is the product promise, and it is enforced by the protocol, not by convention.

## Uninstall

- macOS: `launchctl bootout gui/$(id -u)/com.etmw.bughunter.agent` and delete
  `~/Library/LaunchAgents/com.etmw.bughunter.agent.plist` plus
  `~/Library/Application Support/ETMW Bug Hunter Agent`.
- Windows: `Unregister-ScheduledTask -TaskName ETMWBugHunterAgent -Confirm:$false` and delete
  `%LOCALAPPDATA%\ETMW\BugHunterAgent`.

Re-downloading from the dashboard reissues the same token for the account and platform.
