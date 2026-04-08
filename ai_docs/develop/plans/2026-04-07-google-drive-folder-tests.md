# Plan: Google Drive Folder File Create/Edit Tests

**Created:** 2026-04-07 11:04
**Orchestration:** orch-2026-04-07-11-04-google-drive-tests
**Goal:** Add safe, realistic tests for create/edit operations in main and mirror Google Drive folders for the static browser app.
**Total Tasks:** 3
**Priority:** High

## Scope
- Cover `app/services/googleApiService.js` file creation and update flows using realistic request/response contracts.
- Validate behavior for both `main` and `mirror` folder targets through configurable test inputs.
- Keep all credentials and folder identifiers out of tracked test files.

## Tasks Overview

1. **API-001: Private test configuration and secret handling**
   - Priority: Critical
   - Complexity: Simple
   - Dependencies: None
   - Files/components affected: `test notes.txt`, `.gitignore`, test setup config (new local-only file)
   - Acceptance criteria:
     - Test strategy uses local private config (`.env.local` or untracked `test.private.json`) for operator email/password and folder IDs.
     - No secrets are hardcoded in test sources, fixtures, or committed docs.
     - Sanitized sample config is documented for contributors.

2. **API-002: Create-file tests for main and mirror folders**
   - Priority: High
   - Complexity: Moderate
   - Dependencies: API-001
   - Files/components affected: tests for `createSpreadsheetInFolder` and related request-building behavior
   - Acceptance criteria:
     - Tests verify correct Google Drive API payload (`name`, spreadsheet mimeType, `parents`) for both folder targets.
     - Tests cover success and Google API error propagation.
     - Tests run without live secrets by default (mock-first); optional live mode reads private local config only.

3. **API-003: Edit-file tests and execution guide**
   - Priority: High
   - Complexity: Moderate
   - Dependencies: API-002
   - Files/components affected: tests for edit/update behavior (`updateRange` path via public service flows), test notes/runbook
   - Acceptance criteria:
     - Tests verify edit/update request format, target ranges, and failure handling.
     - Run instructions clearly separate CI-safe mocked tests from local optional integration tests.
     - Documentation explains how to rotate or replace compromised local credentials without repository changes.

## Dependency Flow
`API-001 -> API-002 -> API-003`

## Security Requirements
- Do not commit raw operator credentials from `test notes.txt`.
- Use local-only secret source and keep it gitignored.
- Use redacted placeholders in tracked files (e.g., `GOOGLE_TEST_OPERATOR_EMAIL`).
- Prefer folder IDs (from links) over full URLs in runtime config when possible.

## Verification Plan
- Run unit tests for Google API service request construction and error handling.
- Confirm no secret-like values appear in tracked files before commit.
- Execute optional local integration checks only when private config is present.
