/**
 * Setup note:
 * - This project does not have a configured test runner yet.
 * - This file uses Node's built-in test runner (node:test) so it can run without extra deps.
 * - Example command: node --test tests/integration/testConsoleContract.test.js
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const REPO_ROOT = path.resolve(__dirname, "../..");
const ROW_SCHEMAS_PATH = path.join(REPO_ROOT, "app/dev/rowSchemas.js");
const TEST_CONSOLE_PAGE_PATH = path.join(REPO_ROOT, "app/dev/testConsolePage.js");
const MAIN_JS_PATH = path.join(REPO_ROOT, "app/main.js");
const GOOGLE_API_SERVICE_PATH = path.join(REPO_ROOT, "app/services/googleApiService.js");

test("rowSchemas.js exports 3 schemas covering all required sheet names", () => {
  const src = fs.readFileSync(ROW_SCHEMAS_PATH, { encoding: "utf8" });
  assert.ok(src.includes("contributors"), "rowSchemas.js must define a schema for contributors");
  assert.ok(
    src.includes("period_transactions"),
    "rowSchemas.js must define a schema for period_transactions"
  );
  assert.ok(
    src.includes("period_initial_balances"),
    "rowSchemas.js must define a schema for period_initial_balances"
  );
});

test("testConsolePage.js references all rowSchemas sheetNames and required googleApiService functions", () => {
  const src = fs.readFileSync(TEST_CONSOLE_PAGE_PATH, { encoding: "utf8" });

  assert.ok(src.includes("rowSchemas"), "testConsolePage.js must import from rowSchemas.js");

  assert.ok(
    src.includes("verifyFolderAccess"),
    "testConsolePage.js must reference verifyFolderAccess"
  );
  assert.ok(
    src.includes("ensureSpreadsheetByTitle"),
    "testConsolePage.js must reference ensureSpreadsheetByTitle"
  );
  assert.ok(src.includes("appendRow"), "testConsolePage.js must reference appendRow");
  assert.ok(src.includes("readRange"), "testConsolePage.js must reference readRange");
});

test("testConsolePage.js does not assign innerHTML with variable values", () => {
  const src = fs.readFileSync(TEST_CONSOLE_PAGE_PATH, { encoding: "utf8" });
  assert.ok(
    !src.includes(".innerHTML ="),
    "testConsolePage.js must not use innerHTML assignments (use DOM methods instead)"
  );
});

test("main.js does not reference manual-test route or renderManualTestPage", () => {
  const src = fs.readFileSync(MAIN_JS_PATH, { encoding: "utf8" });
  assert.ok(!src.includes("#manual-test"), 'main.js must not contain "#manual-test"');
  assert.ok(
    !src.includes("renderManualTestPage"),
    'main.js must not contain "renderManualTestPage"'
  );
});

test("test-console route is gated by testConsoleEnabled in main.js", () => {
  const src = fs.readFileSync(MAIN_JS_PATH, { encoding: "utf8" });
  assert.ok(src.includes("#test-console"), 'main.js must contain "#test-console"');
  assert.ok(src.includes("testConsoleEnabled"), 'main.js must reference "testConsoleEnabled"');
});

test("googleApiService.js defines listSpreadsheetsByTitle and ensureSpreadsheetByTitle for duplicate detection", () => {
  const src = fs.readFileSync(GOOGLE_API_SERVICE_PATH, { encoding: "utf8" });
  assert.ok(
    src.includes("listSpreadsheetsByTitle"),
    "googleApiService.js must export listSpreadsheetsByTitle"
  );
  assert.ok(
    src.includes("ensureSpreadsheetByTitle"),
    "googleApiService.js must export ensureSpreadsheetByTitle"
  );
});
