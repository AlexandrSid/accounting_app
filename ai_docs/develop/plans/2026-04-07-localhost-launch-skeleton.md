# Plan: Localhost Launch Skeleton Rewrite

**Created:** 2026-04-07 16:46
**Orchestration:** orch-2026-04-07-16-46-localhost-skeleton
**Goal:** Adapt the app skeleton for localhost launch, hide `googleClientId` from setup UI, create local `userconfig.yml` from test notes safely, and add a manual Google Sheets append test page while preserving a browser-only/serverless architecture.
**Total Tasks:** 5
**Priority:** Critical

## Scope and Constraints
- Keep business logic in browser modules only; do not add backend/server logic.
- Treat credentials from `test notes.txt` as secrets and do not commit them.
- Ensure generated local config remains ignored by git.

## Inputs Reviewed
- `test notes.txt`
- `app/applicationconfig.yml`
- `app/main.js`
- `app/services/googleApiService.js`
- `app/services/fileService.js`
- `.gitignore`
- `index.html`

## Tasks Overview

1. **APP-001: Rewrite localhost launch skeleton and bootstrap flow**
   - Priority: Critical
   - Complexity: Moderate
   - Dependencies: None
   - Files/components: `index.html`, `app/main.js`, app shell/layout modules as needed.
   - Acceptance criteria:
     - App starts cleanly with localhost launch model assumptions.
     - No backend-dependent calls are introduced.
     - Existing init path remains compatible with browser OAuth and Sheets APIs.

2. **UI-001: Remove `googleClientId` input from initial wizard UI**
   - Priority: High
   - Complexity: Simple
   - Dependencies: APP-001
   - Files/components: `app/main.js`, locale message files if labels/help text must change.
   - Acceptance criteria:
     - Setup wizard no longer renders editable `googleClientId` field.
     - Effective client ID is sourced from app/local config only.
     - Validation and auth button flow still works.

3. **CFG-001: Create root `userconfig.yml` from test notes and harden ignore rules**
   - Priority: Critical
   - Complexity: Moderate
   - Dependencies: APP-001
   - Files/components: `userconfig.yml` (project root), `.gitignore`, optional config loader adjustments.
   - Acceptance criteria:
     - Root `userconfig.yml` includes non-secret operational data needed for local launch.
     - Sensitive values from `test notes.txt` are either excluded or documented for manual local entry only.
     - `.gitignore` blocks `userconfig.yml` and other local secret-bearing config variants.

4. **UI-002: Add manual Google Sheets append test page**
   - Priority: High
   - Complexity: Moderate
   - Dependencies: APP-001, UI-001, CFG-001
   - Files/components: `app/main.js` (or dedicated page/module), `app/services/googleApiService.js`, styles/locales as needed.
   - Acceptance criteria:
     - User can run a manual flow to append test rows to target sheet.
     - UI clearly shows request success/failure and returned metadata.
     - Test page uses existing browser token and Sheets API integration.

5. **TST-001: Verify serverless-only flow and secret non-leak safeguards**
   - Priority: High
   - Complexity: Simple
   - Dependencies: UI-002
   - Files/components: test checklist/manual test doc and relevant smoke checks.
   - Acceptance criteria:
     - Manual localhost run confirms no backend business logic requirement.
     - `git status`/ignore pattern check confirms local secret config is untracked.
     - Manual append test scenario is reproducible from clean clone + local config.

## Dependency Graph
`APP-001 -> UI-001`
`APP-001 -> CFG-001`
`UI-001 + CFG-001 -> UI-002 -> TST-001`

## Execution Strategy
- Sequence: APP-001 first, then UI-001/CFG-001 in parallel, then UI-002, then TST-001.
- Suggested agents: `worker` (implementation), `test-runner` (verification), `reviewer` (final sanity/security pass on secrets handling).

## Risks and Mitigations
- Risk: leaking credentials from `test notes.txt` into tracked files.
  - Mitigation: redact sensitive fields from committed config content and enforce `.gitignore` coverage.
- Risk: breaking OAuth flow when hiding `googleClientId` input.
  - Mitigation: preserve `getEffectiveClientId()` behavior via configured source and test authorize button end-to-end.
- Risk: accidental backend coupling while reshaping localhost skeleton.
  - Mitigation: limit changes to static assets and browser modules; no server API contracts.

## Progress (updated by orchestrator)
- ? APP-001: Rewrite localhost launch skeleton and bootstrap flow
- ? UI-001: Remove googleClientId input from initial wizard UI
- ? CFG-001: Create root userconfig.yml from test notes and harden ignore rules
- ? UI-002: Add manual Google Sheets append test page
- ? TST-001: Verify serverless-only flow and secret non-leak safeguards