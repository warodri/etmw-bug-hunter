# ETMW Bug Hunter — project rules

`ETMW Bug Hunter` is a read-only code watchdog at `/Volumes/MACMINI-HD/ETMW/etmw_bug_hunter`.
It reads a project folder in the background and reports issues; it never edits, formats, renames
or deletes a file it scans. That promise is the product, not a preference.

Read `README.md` first, then this file before changing any code.

## What exists today

- `CLIENT/` — Angular 21 dashboard (PrimeNG 21, MIT community edition), hash routing.
- `SERVER/` — Node.js + TypeScript + Express 5, MongoDB Atlas via the native `mongodb` driver.
- Database: **`etmw_bug_hunter`** on the Atlas cluster in `MONGODB_URI`
  (source: `/Volumes/MACMINI-HD/ETMW/MY-ENV-FILE`). Never change the database name without asking.
- Collections: `projects`, `scans`, `issues`, `settings` (singleton `_id: "settings"`).

## Ports

| Process | Port |
| --- | --- |
| Angular dev server | **4302** |
| Node API | **3032** |

`CLIENT/proxy.conf.json` forwards `/api` to `http://localhost:3032`. Do not use 4200, 4300, 4301,
3030 or 3021 — other ETMW projects occupy them.

## Dependencies — do not upgrade blindly

| Package | Pin | Reason |
| --- | --- | --- |
| `@angular/*` | 21.2.x | NgModules codebase. |
| `primeng` | 21.1.x | **PrimeNG 21 is the last MIT line.** 22+ needs a commercial licence. |
| `@primeuix/themes` | 2.0.x | Theme engine PrimeNG 21 is built against. |
| `primeicons` | 8.x | Icon font. |
| `zone.js` | 0.16.x | Required; `angular.json` lists it in `polyfills`. |

## The one rule that outranks features

**No write access to a scanned project.** The scanner may import `readFile`, `readdir`, `stat`.
It must never call `writeFile`, `mkdir`, `rename`, `unlink`, `rm`, a formatter, a package manager or
a project script. Do not add an "auto-fix" or "apply suggestion" action. If a future request asks
for one, stop and ask the owner first: it changes what the product is.

## Server layers

Keep `route → controller → service → repository`. A controller never touches Mongo; a repository
never decides a rule.

| Folder | Responsibility |
| --- | --- |
| `config/` | Environment reading only (`appConfig`) |
| `constants/` | Ports, severity order, policy text |
| `models/` | Record + response shapes and mappers |
| `repositories/` | Persistence (MongoDB) |
| `services/` | Business rules and orchestration |
| `services/scanner/` | Walker, ignore globs, language map, `detectors/` |
| `validation/` | Zod request schemas |
| `controllers/`, `routes/` | HTTP in / JSON out and URL wiring |
| `middleware/`, `errors/`, `utils/` | Cross-cutting concerns |

### Adding a static rule

1. Add a `Detector` in `services/scanner/detectors/security.detectors.ts` or
   `quality.detectors.ts` (id, label, category, severity, `languages`, `detect`).
2. Register it in `services/scanner/detectors/index.ts`.
3. Add one test in `test/detectors.test.ts`.

Detectors receive the whole file and its lines and return `Detection[]`. They must be pure and
must never throw for odd input; the analyser catches a throw but a silent rule is a bug.

## Client layers

| Folder | Responsibility |
| --- | --- |
| `LAYOUT/` | Shell and rail |
| `SCREEN/` | One file set per route |
| `COMPONENTS/<AREA>/` | Reusable feature components |
| `UI/` | Presentational pieces with no feature knowledge |
| `SERVICES/` | HTTP access + signals; `SERVICES/models/` holds the contracts |

`SERVICES/api.service.ts` is the only class that knows the API base URL. Feature services call it;
components call feature services.

`DashboardShell` is the parent route and owns the `<router-outlet>`; screens are its children.

## Behaviour that must not regress

- **Resumability.** `ScanRunner` writes `cursor` (the next file index) as it advances and
  `resumeIfRunning()` re-queues a `running` scan from that cursor at boot. A stop finishes the
  current file and marks the run `stopped`.
- **Bounded work.** Files over `BUG_HUNTER_MAX_FILE_BYTES` (512 KB default) are skipped and
  counted; the walk stops at `BUG_HUNTER_MAX_FILES` (20,000) and records the reason in `error`.
- **Ignore globs.** A bare name (`node_modules`) matches a path segment at any depth; a pattern with
  a slash matches the whole relative path. Built-ins are listed in `models/settings.model.ts`.
- **Severity floor.** `settings.minSeverity` filters what is stored, using
  `meetsSeverity`/`severityRank` from `constants/severity.ts` — never a second ordering.
- **AI is opt-in and never pulls.** `think: false` + `format: "json"` are mandatory for the qwen3
  family. `extractJson` salvages a truncated answer. No `ollama pull`/`create`/`cp`, ever.
- **Pagination.** Scans are 20 per page; issues default to 25 (5–100). The screens poll status,
  not the whole list.
- **Reads are exempt from rate limiting** because the dashboard polls every few seconds; writes
  keep the ceiling (`middleware/rate-limit.ts`).

## Traps already hit here

- **A zod `.default()` on a PATCH schema injects a value and erases stored data.**
  `updateProjectSchema` has no defaults. Keep every update schema that way.
- PrimeNG `p-select` inside a `formGroup` is fine; a form control outside a form needs
  `[ngModelOptions]="{ standalone: true }"`.
- `SettingsService.get()` merges the document over `defaults()`, so a missing field never reads as
  `undefined` in the UI.
- The generated file list is frozen at scan start (`totalFiles`) so progress is monotonic even if
  the project changes mid-run.
- In the client, a `readonly T[]` is not assignable to PrimeNG's `options: any[]`; keep option
  arrays mutable.
