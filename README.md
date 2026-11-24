# ETMW Bug Hunter

**A read-only code watchdog.** Point it at a project folder; a background process walks the files,
runs its static rules, optionally asks an Ollama model to review a few large files, and stores a
report. It never edits, formats, renames or deletes anything in the project.

The dashboard is a small Angular app. The analysis runs either on the server (for a folder on that
server) or in a **desktop agent** on the computer that holds the code. The agent asks for work,
reads the files locally, and sends only findings back.

## The one rule that outranks features

There is **no write path** to a scanned project. The scanner imports `readFile`, `readdir` and
`stat`; the desktop protocol has no message that writes, deletes, renames or patches a file. There
is no "auto-fix" and no "apply suggestion". If you need one, fork the project and change the
contract deliberately — do not add it quietly to this one.

## Screens

- **Dashboard** — projects, open issues, critical/high counts, the worst open severity per project,
  and the last finished scan.
- **Projects** — register a folder on the server or on a paired desktop, add ignore patterns, edit,
  delete, or scan now.
- **Scans** — start "Scan all enabled", watch progress, stop after the current file, and browse the
  run history.
- **Issues** — the report, filtered by project, severity, status and text, with the exact
  `file:line`, the rule, the message and the offending source line. You can ignore or reopen an
  issue; that changes the report, never the code.
- **Settings** — the severity floor, the global ignore list, and the optional Ollama deep review.
- **Download agent** — Windows and macOS package links with the account token already inside.

## Architecture

```
Browser (Angular)
  │  HTTPS, HttpOnly session cookie
  ▼
Reverse proxy
  ├── /apps/bug-hunter/          static Angular build
  ├── /apps/bug-hunter/api/*     Express 5 API
  └── /apps/bug-hunter/agent     WebSocket upgrade (when supported)
  ▼
Node server
  ├── email-OTP auth + arithmetic challenge
  ├── projects, scans, issues, settings (MongoDB)
  ├── static scanner + optional Ollama review
  └── agent hub (WebSocket, or HTTPS polling fallback)
  ▲
  │  outbound WebSocket or HTTPS
  ▼
Desktop agent (Node.js 20+, macOS / Windows)
  ├── receives scan.start / scan.stop
  ├── reads the folder locally
  ├── runs the same compiled detectors
  └── sends progress and findings only
```

The agent never receives a write command, and the server never opens a file on the agent's machine.
The WebSocket is tried first. If the reverse proxy cannot upgrade the connection, the agent falls
back to short HTTPS polling automatically; the protocol and the read-only guarantees are the same.

## Repository layout

```
CLIENT/
  src/app/            Angular 21 (NgModules), PrimeNG 21 (MIT)
  DESKTOP/
    agent/            Node.js desktop agent (agent.cjs, package.json)
    installers/       install-mac.sh, install-windows.ps1
SERVER/
  src/
    config/           environment reading
    constants/        ports, severity order, policy text
    controllers/      HTTP in / JSON out
    middleware/       CORS, session, rate limit, error handler
    models/           record shapes and mappers
    repositories/     MongoDB persistence
    routes/           URL → controller
    services/         auth, email, agent hub, scanner, settings, scan runner
    services/scanner/ walker, ignore globs, language map, detectors/
    validation/       zod schemas
  test/               detector, glob and JSON tests
```

Deployment scripts are intentionally **not** part of this repository: the owner keeps them private
because they contain server credentials. `.env`, `.env.deploy` and the `scripts/` folder are
git-ignored.

## Requirements

- Node.js **20 or newer** for the server and the desktop agent.
- A MongoDB deployment (Atlas or local).
- SMTP credentials for login codes in production.
- A reverse proxy for HTTPS in production.

## Run it locally

### 1. API

```bash
cd SERVER
npm install
cp .env.example .env
# Fill MONGODB_URI, JWT_SECRET and (for real emails) the SMTP_* values.
npm run build
npm run dev            # tsx watch, http://127.0.0.1:3032
```

`npm start` runs the compiled server. Health check: `curl http://127.0.0.1:3032/api/health`.

### 2. Dashboard

```bash
cd CLIENT
npm install
npm start              # http://localhost:4302/#/dashboard
```

`CLIENT/proxy.conf.json` forwards `/api` to `127.0.0.1:3032`. The production build uses
`--base-href /apps/bug-hunter/` and resolves the API against that base, so it also works when the
app is served from a subpath.

## Authentication

There are no passwords.

1. The login form asks for an email and a small arithmetic question.
2. `POST /api/auth/request-code` checks the answer, rate-limits the request, generates a
   6-character code, hashes it, stores it with a 10-minute expiry, and emails it.
3. `POST /api/auth/verify-code` checks the hash and creates a 30-day HttpOnly session cookie.

Relevant environment:

| Variable | Purpose |
| --- | --- |
| `JWT_SECRET` | Signs dashboard sessions. Required in production. |
| `AUTH_SESSION_DAYS` | Session lifetime (default 30). |
| `AUTH_ALLOWED_EMAILS` | Optional comma-separated allowlist. Empty means any valid email. |
| `OWNER_EMAIL` | When set, this account adopts data created before accounts existed. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USERNAME`, `SMTP_PASSWORD` | Login-code delivery. |
| `EMAIL_FROM_NAME`, `EMAIL_FROM_ADDRESS` | Sender shown in the email. |

The first account created adopts legacy `projects`, `scans` and `issues` documents that have no
`ownerId`. Set `OWNER_EMAIL` if the instance already has data and must be claimed by a specific
address.

## Desktop agent

The header has a **Get the agent** menu with `Windows agent` and `Mac agent`. Those routes are
`#/download-windows` and `#/download-mac`; the actual download is
`GET /api/agents/download/:platform` and requires a signed-in session.

The ZIP contains a `config.json` with the server URL, API URL, agent id and a token derived from
the account. Treat the ZIP like a key: anyone who has it can pair an agent to that account.

1. Install Node.js 20+ from <https://nodejs.org/>.
2. Unzip the download.
3. macOS: `bash install-mac.sh` (a LaunchAgent starts it now and at every login).
   Windows: right-click `install-windows.ps1` → **Run with PowerShell** (a logon scheduled task,
   with a Startup-folder fallback).
4. Add a project, choose **Desktop agent**, and pick the paired computer.

The agent tries WebSocket first. If the reverse proxy cannot upgrade the connection, it switches to
`POST /api/agent/poll` and `POST /api/agent/report` over HTTPS. Both paths carry the agent's own
bearer token; the dashboard cookie is never used by the agent.

Agent limits and safety:

- Files over `BUG_HUNTER_MAX_FILE_BYTES` are skipped and counted.
- The walk stops at `BUG_HUNTER_MAX_FILES` and records why.
- A dropped agent does not silently leave a scan running forever; the server fails the run after a
  grace period unless the agent reconnects or polls.
- The agent only imports `readdir`, `stat` and `readFile` from the project. It may write its own
  log and install files, never the code it scans.

## API

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| GET | `/api/health` | public | Liveness |
| GET | `/api/policy` | public | The read-only promise, machine-readable |
| GET | `/api/auth/challenge` | public | A fresh arithmetic question |
| POST | `/api/auth/request-code` | public | Email a login code |
| POST | `/api/auth/verify-code` | public | Create the session cookie |
| POST | `/api/auth/logout` | public | Clear the cookie |
| GET | `/api/auth/me` | session | Current account |
| GET | `/api/summary` | session | Dashboard in one response |
| GET/POST | `/api/projects` | session | List / create |
| GET/PATCH/DELETE | `/api/projects/:id` | session | Read / update / remove |
| GET | `/api/scans`, `/api/scans/status` | session | History / polling |
| POST | `/api/scans/start`, `/api/scans/stop` | session | Control |
| GET | `/api/issues` | session | Paged report |
| PATCH | `/api/issues/:id` | session | Triage only |
| GET/PUT | `/api/settings` | session | Read / save |
| GET | `/api/settings/models` | session | Proxy the Ollama model list |
| GET | `/api/agents` | session | Paired desktops |
| GET | `/api/agents/download/:platform` | session | Token-bound ZIP |
| POST | `/api/agent/poll` | agent token | HTTPS fallback: fetch work |
| POST | `/api/agent/report` | agent token | HTTPS fallback: send results |

Errors are always `{ success: false, message }` with a meaningful status.

## Configuration reference

See `SERVER/.env.example` for the complete list. The most important values:

| Variable | Default | Notes |
| --- | --- | --- |
| `PORT` / `HOST` | `3032` / `127.0.0.1` | Bind the API to loopback behind a proxy. |
| `MONGODB_URI` / `MONGODB_DATABASE` | — / `etmw_bug_hunter` | Database connection. |
| `JWT_SECRET` | — | Required. Generate 32 random bytes as hex. |
| `BUG_HUNTER_AGENT_SECRET` | `JWT_SECRET` | Rotating it revokes every installed agent. |
| `BUG_HUNTER_MAX_FILE_BYTES` | `524288` | Files larger than this are skipped. |
| `BUG_HUNTER_MAX_FILES` | `20000` | Walk ceiling. |
| `BUG_HUNTER_OLLAMA_URL` | shared tunnel | Shown in Settings; models are never pulled. |
| `BUG_HUNTER_PUBLIC_URL` | hosted demo | Used in installer text and the API URL. |
| `BUG_HUNTER_AGENT_WS_URL` | derived | WebSocket endpoint. |
| `BUG_HUNTER_AGENT_API_URL` | derived | HTTPS fallback base. |
| `BUG_HUNTER_AGENT_DIR` | `../CLIENT/DESKTOP` | Agent source and installers to zip. |
| `TRUST_PROXY_HOPS` | `0` | Set to `1` behind one reverse proxy. |

## Tests

```bash
cd SERVER
npm test               # detector, glob and JSON-salvage tests; no database needed
```

Useful build checks:

```bash
cd SERVER && npm run build
cd CLIENT && npm run build -- --base-href /apps/bug-hunter/ --output-path dist-deploy
```

## Security notes

- Reads are exempt from the global rate limit because the dashboard polls; writes keep the ceiling.
  Agent transport paths are exempt and authenticated by the derived token.
- The login flow has a server-side arithmetic challenge plus per-email and per-IP rate limits.
- Session cookies are `HttpOnly`, `SameSite=Lax` and `Secure` in production.
- Agent tokens are HMAC-derived from the agent id, owner id and a server secret. They are not stored
  in plaintext.
- The agent ZIP contains a live token. Do not commit a downloaded ZIP or `config.json`.
- The AI pass is opt-in, uses `think: false` and `format: "json"`, and never pulls, creates or
  copies a model.

## License

This project is **source-available, free for noncommercial use** under the
[PolyForm Noncommercial License 1.0.0](https://polyformproject.org/licenses/noncommercial/1.0.0).
It is **not** OSI open source, because commercial use is not granted. Commercial use requires a
separate written licence from the copyright holder. See `LICENSE`.

## Contributing

- Keep the read-only contract: no write, delete, rename, patch or formatter call on a scanned path.
- Keep the server layering: `route → controller → service → repository`.
- Add a static rule as a `Detector`, register it in `services/scanner/detectors/index.ts`, and add
  one test in `SERVER/test/detectors.test.ts`.
- Never commit `.env`, `.env.deploy`, deployment scripts, downloaded agent ZIPs or
  `CLIENT/DESKTOP/agent/config.json`.

The product rules for maintainers and AI assistants are in `AGENTS.md`.
