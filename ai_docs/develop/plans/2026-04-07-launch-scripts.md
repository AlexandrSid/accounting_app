# Plan: Cross-Platform Launch Scripts & HTML Fallback

**Created:** 2026-04-07
**Orchestration:** orch-2026-04-07-17-00-launch-scripts
**Goal:** Add cross-platform server launch scripts and a static launch-instructions fallback in index.html so users can start the app without knowing CLI commands, and the page self-explains when opened via file://.
**Total Tasks:** 3
**Priority:** High

## Scope and Constraints
- App is serverless static HTML/JS/CSS — scripts only start a minimal static file server.
- Prefer `python -m http.server` (universally available on macOS/Linux; commonly available on Windows).
- Windows fallback: detect `python`; if absent, print manual guidance and pause.
- index.html must stay minimal; no layout changes that could affect the JS boot flow.
- `renderLocalhostGuard()` in `app/main.js` already handles the `file://` detection at runtime; enhance it rather than duplicating logic.
- Do not commit secrets or break any existing test infrastructure.

## Tasks Overview

1. **LAUNCH-001: Create cross-platform launch scripts**
   - Priority: High
   - Complexity: Simple
   - Dependencies: None
   - Files: `launch.bat` (Windows), `launch.command` (macOS double-click), `launch.sh` (Linux/generic)
   - Acceptance criteria:
     - Running each script starts `python -m http.server <port>` in the project root.
     - Default port is **8080**; scripts handle port-already-in-use with a clear message.
     - Browser opens automatically after server starts (`start` / `open` / `xdg-open`).
     - If Python is not found, script prints a short manual-server fallback message and exits gracefully (no unhandled crash/hang).
     - `launch.command` is made executable (chmod +x) via a post-note; `launch.sh` requires manual chmod or is called via `bash launch.sh`.
     - Scripts live in the project root (same level as `index.html`).

2. **LAUNCH-002: Enrich `renderLocalhostGuard()` in `app/main.js` to reference launch scripts**
   - Priority: High
   - Complexity: Simple
   - Dependencies: LAUNCH-001
   - Files: `app/main.js`
   - Acceptance criteria:
     - The guard card now names the concrete scripts: `launch.bat` (Windows), `launch.command` (macOS), `launch.sh` (Linux).
     - Includes the resulting URL (`http://localhost:8080`) so users know what to expect.
     - Keeps HTML structure unchanged (same `.card` wrapper, no new CSS classes required).
     - No logic changes — only the inner HTML of the guard card is updated.
     - Existing `escapeHtml` / `boot()` flow is untouched.

3. **LAUNCH-003: Add noscript + pre-JS inline fallback in `index.html`**
   - Priority: Medium
   - Complexity: Simple
   - Dependencies: None (parallel with LAUNCH-001)
   - Files: `index.html`
   - Acceptance criteria:
     - A `<noscript>` block is added inside `<body>` with plain-text or minimal HTML instructions: explains file:// limitation, names the launch scripts, gives the localhost URL.
     - Optionally, a `<div id="preload-notice">` is added right after `<main id="app">` and immediately removed by a small inline `<script>` so it only shows during the tiny JS-parse window (acceptable to omit if it adds complexity without user-visible benefit — worker's call).
     - index.html remains ≤30 lines; no external stylesheets or scripts added.
     - Does not interfere with the `type="module"` main.js boot or Google Identity script loading.

## Dependency Graph
```
LAUNCH-001 ──► LAUNCH-002
LAUNCH-001 (independent) ║
LAUNCH-003 (independent) ║  ← can run in parallel with LAUNCH-001
```

## Execution Strategy
- LAUNCH-001 and LAUNCH-003 are fully independent and can run in parallel.
- LAUNCH-002 depends on LAUNCH-001 (script names must be known).
- Suggested agents: `worker` for all three tasks; `reviewer` for a final pass on script safety (no arbitrary code exec, no path traversal in server root).

## Architecture Decisions
- Port 8080 chosen: avoids macOS AirPlay conflict on 5000 and common dev-server conflicts on 3000/3001.
- Python `http.server` used as lowest-common-denominator; no Node.js, no package install required.
- `launch.command` extension enables macOS Finder double-click without Terminal open.
- Browser auto-open is best-effort: if `xdg-open` / `open` / `start` fails, script still starts the server and prints the URL.

## Risks and Mitigations
- Risk: Port 8080 already occupied on user machine.
  - Mitigation: Script detects occupied port (via a short `netstat`/`lsof` check or tries next port) or simply informs the user with the alternate manual command.
- Risk: Python 2 vs Python 3 discrepancy (`python` vs `python3`).
  - Mitigation: Scripts try `python3` first, then fall back to `python`, and check that http.server module is available.
- Risk: launch.command not executable after git clone.
  - Mitigation: Document in README and in the file header that `chmod +x launch.command` is needed; alternatively provide a `make launch-mac` helper.

## Progress (updated by orchestrator)
- ⏳ LAUNCH-001: Create cross-platform launch scripts (Pending)
- ⏳ LAUNCH-002: Enrich renderLocalhostGuard() to reference scripts (Pending)
- ⏳ LAUNCH-003: Add noscript + pre-JS inline fallback in index.html (Pending)
