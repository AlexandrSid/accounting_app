# Plan: SecurityError + Mirror Spreadsheet Bug Fixes

**Created:** 2026-04-08
**Orchestration:** orch-2026-04-08-10-00-bugfixes
**Status:** 🟢 Ready
**Goal:** Fix two bugs — (1) `showSaveFilePicker` loses user gesture causing SecurityError, (2) wizard never creates spreadsheet in mirror folder.
**Total Tasks:** 3
**Priority:** High

---

## Goal

Resolve two production bugs introduced by async await chains that drop transient user activation, and by missing mirror-folder spreadsheet initialization in the wizard submit handler.

---

## Tasks

- [ ] TASK-001: Split fileService.js save logic (⏳ Pending)
- [ ] TASK-002: Reorder wizard submit + add mirror init in main.js (⏳ Pending)
- [ ] TASK-003: Static contract tests + run (⏳ Pending)

---

## Task Details

### TASK-001 — Split fileService.js save logic
**Priority:** High  
**Complexity:** Simple  
**Dependencies:** None  
**Files affected:** `app/services/fileService.js`

**Acceptance criteria:**
- `pickUserConfigSaveHandle()` exported — calls only `showSaveFilePicker({ suggestedName: "userconfig.yml", types: [...YAML] })`, propagates `AbortError`.
- `writeYamlToFileHandle(handle, yamlContent)` exported — `createWritable` → `write` → `close`.
- `saveUserConfigFile(yamlContent)` reduced to Blob + `<a download>` fallback only; no `showSaveFilePicker` call remains inside it.

---

### TASK-002 — Reorder wizard submit + add mirror init in main.js
**Priority:** High  
**Complexity:** Moderate  
**Dependencies:** TASK-001  
**Files affected:** `app/main.js`

**Acceptance criteria (new submit handler order):**
1. After `preventDefault`, accessToken check, form-field reads:
   - If `showSaveFilePicker` available → `await pickUserConfigSaveHandle()` immediately (before any Drive API). `AbortError` → show status, `return` (do NOT call Drive).
   - Else → `saveHandle = null`.
2. `verifyFolderAccess(primaryFolderId)` and `verifyFolderAccess(mirrorFolderId)`.
3. Folder consistency check via `listSpreadsheetsByTitle`; >1 match → error + Retry, `return`.
4. For **each** of primary and mirror:
   - `listSpreadsheetsByTitle(activeSpreadsheetTitle, folderId, token)`.
   - 0 results → `createSpreadsheetInFolder` → `setupSpreadsheetSheets` → `setInitialSheetHeaders`.
   - 1 result → reuse existing id, skip setup.
5. Assemble `userConfig` with both `activeSpreadsheetId` (primary) and `mirrorSpreadsheetId` (mirror).
6. Saving: `saveHandle` present → `writeYamlToFileHandle(saveHandle, yamlContent)`; else → `saveUserConfigFile(yamlContent)`.
7. Guard `#yaml-preview`: `const el = document.getElementById("yaml-preview"); if (el) el.textContent = yamlContent;`.
8. Imports updated: `pickUserConfigSaveHandle`, `writeYamlToFileHandle` from `fileService`; `listSpreadsheetsByTitle` from `googleApiService`.

---

### TASK-003 — Static contract tests + run
**Priority:** High  
**Complexity:** Simple  
**Dependencies:** TASK-001, TASK-002  
**Files affected:** `tests/integration/` (new or updated test file)

**Acceptance criteria:**
- Test asserts `app/services/fileService.js` source contains `pickUserConfigSaveHandle` and `writeYamlToFileHandle`.
- Test asserts `app/main.js` source contains `mirrorSpreadsheetId` and evidence of `setupSpreadsheetSheets` being called for both primary and mirror (two occurrences or a loop pattern).
- `mirrorSpreadsheetId` is NOT added to required keys in `userConfigContract.test.js`.
- `node --test` run on all integration contract tests passes; results reported.

---

## Dependencies Graph

```
TASK-001
   └──→ TASK-002
              └──→ TASK-003
```

TASK-001 and TASK-002 are sequential (TASK-002 imports the new exports from TASK-001).  
TASK-003 runs after both are complete (validates source-level contracts on both files).

---

## Architecture Decisions

- File picker is called **before** any async Drive API work to preserve the transient user activation window (Chromium requires the picker be called synchronously within the event handler or in the first microtask after it).
- Mirror spreadsheet init mirrors primary logic exactly; no shared helper is strictly required but a loop over `[primaryFolderId, mirrorFolderId]` is acceptable and preferred to reduce duplication.
- `saveUserConfigFile` is kept as a download fallback so browsers without File System Access API continue to work.
- `mirrorSpreadsheetId` is written into `userConfig` for forward compatibility; existing contract tests are not broken because the key is additive.

---

## Progress (updated by orchestrator)

- ⏳ TASK-001: Split fileService.js save logic (Pending)
- ⏳ TASK-002: Reorder wizard submit + add mirror init in main.js (Pending)
- ⏳ TASK-003: Static contract tests + run (Pending)
