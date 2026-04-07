# Plan: Test Console + Node Static Server

**Created:** 2026-04-07
**Orchestration:** orch-2026-04-07-test-console-node
**Branch:** feature/phase1-google-sheets-init
**Goal:** Replace Python server with Node, migrate to port 10800, add testConsoleEnabled flag, add Drive list/ensure helpers, harden wizard folder consistency, build unified test-console module, update all contract tests.
**Total Tasks:** 7
**Status:** 🟢 Ready

---

## Tasks Overview

- [ ] INFRA-001: Node static server + stop scripts (⏳ Pending)
- [ ] PORT-001: Global port 8080 → 10800 (⏳ Pending)
- [ ] FLAG-001: testConsoleEnabled flag + strict parse (⏳ Pending)
- [ ] DRIVE-001: listSpreadsheetsByTitle + ensureSpreadsheetByTitle (⏳ Pending)
- [ ] WIZARD-001: Wizard folder consistency check (⏳ Pending)
- [ ] CONSOLE-001: Merge manual-test → test-console module (⏳ Pending)
- [ ] TEST-001: Update all integration contract tests (⏳ Pending)

---

## Dependencies Graph

```
INFRA-001 ──→ PORT-001 ──────────────────────────────────────────→ TEST-001
FLAG-001  ──────────────────────────────────────→ CONSOLE-001 ──→ TEST-001
DRIVE-001 ──→ WIZARD-001 ──────────────────────────────────────→ TEST-001
DRIVE-001 ─────────────────────────────────────→ CONSOLE-001 ──→ TEST-001
```

Parallel safe groups:
- **Wave 1 (parallel):** INFRA-001, FLAG-001, DRIVE-001
- **Wave 2 (parallel, after deps):** PORT-001 (after INFRA-001), WIZARD-001 (after DRIVE-001), CONSOLE-001 (after FLAG-001 + DRIVE-001)
- **Wave 3 (sequential):** TEST-001 (after all above)

---

## Task Specifications

### INFRA-001 — Node static server + stop scripts
**Priority:** Critical  
**Dependencies:** None  
**Complexity:** Moderate  
**Files affected:**
- `server/server.mjs` (new) — `node:http` + `node:fs` + `node:path`, binds `127.0.0.1:10800`, serves files from project root, writes PID to `runtime/server.pid` on startup
- `server/stop.mjs` (new) — reads `runtime/server.pid`, kills process: `taskkill /PID` on Windows, `kill` on Unix
- `launch.bat` — replace Python invocation with `node server/server.mjs`; add `node -v` check with install hint if missing
- `launch.sh` — same, with `#!/usr/bin/env bash`
- `launch.command` — same, for macOS double-click
- `stop.bat` (new) — invokes `node server/stop.mjs`
- `stop.sh` (new) — invokes `node server/stop.mjs`
- `stop.command` (new) — invokes `node server/stop.mjs` (macOS)
- `.gitignore` — add `runtime/`

**Acceptance criteria:**
- `node server/server.mjs` starts, serves `index.html` at `http://127.0.0.1:10800`, writes PID to `runtime/server.pid`
- `node server/stop.mjs` terminates the server process using the PID file
- No `npm install` required (stdlib only)
- All three launch scripts call `node server/server.mjs` after checking Node is installed
- All three stop scripts call `node server/stop.mjs`
- `runtime/` is in `.gitignore`

---

### PORT-001 — Global port 8080 → 10800
**Priority:** Critical  
**Dependencies:** INFRA-001 (scripts must exist before updating them)  
**Complexity:** Simple  
**Files affected:**
- `index.html` — noscript text and any port-mentioning links
- `app/main.js` — `renderLocalhostGuard()` URL and any hardcoded 8080 references
- `launch.bat`, `launch.sh`, `launch.command` — any 8080 literals left after INFRA-001
- `stop.bat`, `stop.sh`, `stop.command` — if they reference port
- `tests/integration/launchScriptsContract.test.js` — expected port strings
- `tests/integration/mainBootstrapContract.test.js` — port assertions if present

**Acceptance criteria:**
- Zero occurrences of `8080` in the above files
- Every URL/port reference consistently reads `10800`

---

### FLAG-001 — testConsoleEnabled flag + strict parse
**Priority:** High  
**Dependencies:** None  
**Complexity:** Simple  
**Files affected:**
- `app/applicationconfig.yml` — add `testConsoleEnabled: "true"`
- `app/services/configService.js` — `loadApplicationConfig()` must set `testConsoleEnabled: parsed === "true"` (strict string equality, no coercion; any other value or missing key → `false`)

**Acceptance criteria:**
- `applicationconfig.yml` contains `testConsoleEnabled: "true"` (quoted string)
- `loadApplicationConfig()` returns `testConsoleEnabled: true` only when the parsed YAML value is exactly the string `"true"`
- Values `"True"`, `"TRUE"`, `true` (boolean), `"1"`, `""`, absent → returns `false`

---

### DRIVE-001 — listSpreadsheetsByTitle + ensureSpreadsheetByTitle
**Priority:** High  
**Dependencies:** None  
**Complexity:** Moderate  
**Files affected:**
- `app/services/googleApiService.js`

**New functions:**
```js
listSpreadsheetsByTitle(title, folderId, accessToken)
// Drive files.list: q = name='<title>' AND mimeType='application/vnd.google-apps.spreadsheet'
//   AND '<folderId>' in parents AND trashed=false
// Returns array of { id, name } objects (may be empty, 1, or many)

ensureSpreadsheetByTitle(title, folderId, accessToken)
// Calls listSpreadsheetsByTitle; if 0 results → calls createSpreadsheetInFolder
// Returns { id, name, created: bool }
// Does NOT call this if count > 1 — caller is responsible for that check
```

**Acceptance criteria:**
- `listSpreadsheetsByTitle` issues exactly one Drive API request with the correct `q` filter
- `ensureSpreadsheetByTitle` creates a new spreadsheet only when count === 0
- Neither function normalises the title (exact string as provided)

---

### WIZARD-001 — Wizard folder consistency check
**Priority:** High  
**Dependencies:** DRIVE-001  
**Complexity:** Moderate  
**Files affected:**
- `app/main.js` — wizard submit handler

**Logic (before any spreadsheet creation):**
1. Call `listSpreadsheetsByTitle(activeSpreadsheetTitle, primaryFolderId, accessToken)`
2. Call `listSpreadsheetsByTitle(activeSpreadsheetTitle, mirrorFolderId, accessToken)`
3. If either returns `length > 1`:
   - Show error UI: explain which folder(s) have duplicates, instruct user to delete/rename extras until ≤1 remain
   - Show **Retry** button: re-runs the same two checks (does NOT re-run full wizard submit)
   - Do NOT write `userconfig.yml`
   - Do NOT create/touch any spreadsheet
4. If both return `length === 0` or `length === 1` → proceed as before

**Acceptance criteria:**
- Submitting wizard with >1 matching sheet in primary or mirror shows the error with Retry
- Retry re-checks without resubmitting the full form
- No file or config is written on duplicate detection

---

### CONSOLE-001 — Merge manual-test → test-console module
**Priority:** High  
**Dependencies:** FLAG-001, DRIVE-001  
**Complexity:** Complex  
**Files affected (modified):**
- `app/main.js`:
  - Remove `renderManualTestPage` function
  - Remove `#manual-test` route from `initializePageRouting` and hashchange handler
  - Remove "Open manual test page" button (or equivalent nav entry)
  - Add `#test-console` route, guarded by `appState.applicationConfig.testConsoleEnabled === true`
  - Route renders `testConsolePage.js` module

**Files affected (new):**
- `app/dev/testConsolePage.js` — operation registry (no `eval`), renders UI for:
  - `verifyFolderAccess` — checks access to primary or mirror folder (selector: primary | mirror from userconfig)
  - `ensureSpreadsheetByTitle` — name input + primary|mirror selector → calls `googleApiService.ensureSpreadsheetByTitle`
  - `setupSpreadsheetSheets` — spreadsheetId input → calls existing service fn
  - `setInitialSheetHeaders` — spreadsheetId input → calls existing service fn
  - `appendRow` — sheetName selector (`contributors` | `period_transactions` | `period_initial_balances`) + per-schema fields rendered from `rowSchemas.js`
  - `readRange` — spreadsheetId + range input
  - Includes all forms previously in `renderManualTestPage` (three sheet append forms at minimum)
  - All folder-based operations use only `primaryFolderId` / `mirrorFolderId` from loaded userconfig (no free-text folderId input)
  - If userconfig not loaded → show "Complete wizard first" message, disable Drive operations

- `app/dev/rowSchemas.js` — exports column schema objects matching `setInitialSheetHeaders` for: `contributors`, `period_transactions`, `period_initial_balances`

**Acceptance criteria:**
- Zero references to `#manual-test`, `renderManualTestPage`, or "Open manual" button remain in `main.js`
- `#test-console` is registered only when `testConsoleEnabled === true`
- All six operations listed above are reachable from the console UI
- Row schemas in `rowSchemas.js` match headers in `setInitialSheetHeaders` exactly
- No `eval` or dynamic code generation

---

### TEST-001 — Update all integration contract tests
**Priority:** High  
**Dependencies:** INFRA-001, PORT-001, FLAG-001, WIZARD-001, CONSOLE-001  
**Complexity:** Moderate  
**Files affected:**
- `tests/integration/launchScriptsContract.test.js` — assert port `10800`; assert Node launch patterns (`server/server.mjs`, `node` invocation); assert stop scripts exist and invoke `server/stop.mjs`; no Python references expected
- `tests/integration/mainBootstrapContract.test.js` — assert `10800` in `renderLocalhostGuard`; assert `#manual-test` route is absent; assert `#test-console` route present when flag enabled
- `tests/integration/userConfigContract.test.js` — assert wizard consistency check contract: duplicate detection → no userconfig written
- Any other contract test files referencing old port or Python patterns

**New/updated assertions:**
- `testConsoleEnabled` strict flag: `"true"` (string) → `true`; any other value → `false`
- `#manual-test` absent from routing source
- `#test-console` gated on `testConsoleEnabled === true`
- `server/server.mjs` file exists; `server/stop.mjs` file exists
- `runtime/` entry present in `.gitignore`

**Acceptance criteria:**
- All existing passing tests remain passing
- New assertions cover every behavioural contract listed above
- Tests use port `10800` exclusively; zero `8080` occurrences

---

## Architecture Decisions

- **Node stdlib only** for the server — no `npm install` step keeps onboarding friction near zero; `node:http` + `node:fs` + `node:path` is sufficient for serving static files
- **PID file approach** for stop — cross-platform and works without a process manager; `runtime/` is gitignored to avoid committing ephemeral state
- **Strict string equality** for `testConsoleEnabled` — prevents accidental activation from YAML boolean coercion (`true` vs `"true"` parse differently in js-yaml)
- **No folderId free-text in test console UI** — safety boundary: users can only act on configured folders, reducing accidental Drive modifications
- **`>1` is the only inconsistency trigger** — having zero or one active-title spreadsheet per folder is both valid; avoids blocking fresh setups

---

## Implementation Notes

- `server.mjs` should use `import` syntax (ESM) — `.mjs` extension signals ESM to Node without needing `"type": "module"` in package.json
- Serving: resolve requested path against project root, default to `index.html` for `/`, serve with correct `Content-Type` based on extension
- `stop.mjs` must handle missing PID file gracefully (server already stopped)
- `ensureSpreadsheetByTitle` must NOT be called when `listSpreadsheetsByTitle` returns >1 — the wizard pre-check catches that case; test console operations on arbitrary names are user-responsibility (duplicates allowed for non-active titles)
- `rowSchemas.js` exports should be plain objects (no classes) so they can be imported in both browser and test environments
