/**
 * Setup note:
 * - This project does not have a configured test runner yet.
 * - This file uses Node's built-in test runner (node:test) so it can run without extra deps.
 * - Example command: node --test tests/integration/mainBootstrapContract.test.js
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const MAIN_JS_PATH = path.resolve(__dirname, "../../app/main.js");
const MAIN_CSS_PATH = path.resolve(__dirname, "../../app/styles/main.css");
const FILE_SERVICE_JS_PATH = path.resolve(__dirname, "../../app/services/fileService.js");

function readMainSource() {
  return fs.readFileSync(MAIN_JS_PATH, "utf8");
}

function readMainStyles() {
  return fs.readFileSync(MAIN_CSS_PATH, "utf8");
}

function readFileServiceSource() {
  return fs.readFileSync(FILE_SERVICE_JS_PATH, "utf8");
}

test("boot guards file protocol and renders localhost guidance", () => {
  const source = readMainSource();

  assert.ok(source.includes('window.location.protocol === "file:"'));
  assert.ok(source.includes("renderLocalhostGuard();"));
  assert.ok(source.includes("http://localhost"));
  assert.ok(source.includes("file://"));
  // renderLocalhostGuard must reference the concrete launch scripts and port
  assert.ok(source.includes("launch.bat"));
  assert.ok(source.includes("launch.command"));
  assert.ok(source.includes("launch.sh"));
  assert.ok(source.includes("10800"));
});

test("wizard no longer asks for googleClientId manually", () => {
  const source = readMainSource();

  assert.doesNotMatch(source, /name="googleClientId"/);
  assert.doesNotMatch(source, /formData\.get\("googleClientId"\)/);
  assert.match(source, /id="authorize-btn"/);
});

test("auth flow uses config-only clientId through getEffectiveClientId", () => {
  const source = readMainSource();

  assert.match(source, /const tokenData = await requestAccessToken\(getEffectiveClientId\(\)\);/);
  assert.match(source, /id="business-authorize-btn"/);
  assert.match(source, /console\.error\("Business re-authorization failed:", error\);/);
  assert.match(source, /const googleClientId = getEffectiveClientId\(\);/);
  assert.match(source, /const configured = String\(appState\.applicationConfig\?\.googleClientId \|\| ""\)\.trim\(\);/);
  assert.match(source, /throw new Error\("Set googleClientId in app\/applicationconfig\.yml\."\);/);
  assert.match(source, /googleClientId,/);
});

test("error UX uses safe user text and keeps technical details in console", () => {
  const source = readMainSource();

  assert.ok(source.includes("Unable to initialize the app. Check console for details."));
  assert.ok(source.includes("Authorization failed. Please try again and check console for details."));
  assert.ok(source.includes("Setup failed. Please verify inputs and check console for details."));
  assert.ok(source.includes("toTechnicalErrorMessage(error)"));
  assert.ok(source.includes('if (error instanceof Error) return error.message;'));
  assert.ok(source.includes('if (typeof error === "string") return error;'));
  assert.ok(source.includes("console.error("));
});

test("manual-test page route and renderManualTestPage are fully removed", () => {
  const source = readMainSource();

  assert.ok(!source.includes("#manual-test"), 'main.js must not contain "#manual-test"');
  assert.ok(!source.includes("renderManualTestPage"), 'main.js must not contain "renderManualTestPage"');
});

test("test-console route is present and gated by testConsoleEnabled", () => {
  const source = readMainSource();

  assert.ok(source.includes("#test-console"), 'main.js must contain "#test-console"');
  assert.ok(source.includes("testConsoleEnabled"), 'main.js must reference "testConsoleEnabled"');
});

test("main.js imports renderTestConsolePage from ./dev/testConsolePage", () => {
  const source = readMainSource();

  assert.ok(
    source.includes("./dev/testConsolePage"),
    'main.js must import from "./dev/testConsolePage"'
  );
});

test("app/dev/testConsolePage.js exists", () => {
  const devPagePath = path.resolve(__dirname, "../../app/dev/testConsolePage.js");
  assert.ok(fs.existsSync(devPagePath), "app/dev/testConsolePage.js must exist");
});

test("app/dev/rowSchemas.js exists", () => {
  const rowSchemasPath = path.resolve(__dirname, "../../app/dev/rowSchemas.js");
  assert.ok(fs.existsSync(rowSchemasPath), "app/dev/rowSchemas.js must exist");
});

test("stack-form CSS class is defined in main.css", () => {
  const styles = readMainStyles();

  assert.match(styles, /\.stack-form\s*\{/);
  assert.match(styles, /display:\s*grid;/);
});

test("fileService exports pickUserConfigSaveHandle and writeYamlToFileHandle", () => {
  const source = readFileServiceSource();

  assert.ok(
    source.includes("pickUserConfigSaveHandle"),
    "fileService.js must export pickUserConfigSaveHandle"
  );
  assert.ok(
    source.includes("writeYamlToFileHandle"),
    "fileService.js must export writeYamlToFileHandle"
  );
});

test("main.js imports pickUserConfigSaveHandle and writeYamlToFileHandle from fileService", () => {
  const source = readMainSource();

  assert.ok(
    source.includes("pickUserConfigSaveHandle"),
    'main.js must import pickUserConfigSaveHandle from fileService'
  );
  assert.ok(
    source.includes("writeYamlToFileHandle"),
    'main.js must import writeYamlToFileHandle from fileService'
  );
  assert.ok(
    source.includes("./services/fileService"),
    'main.js must import from ./services/fileService'
  );
});

test("main.js wizard setup tracks mirrorSpreadsheetId and calls setupSpreadsheetSheets for both folders", () => {
  const source = readMainSource();

  assert.ok(
    source.includes("mirrorSpreadsheetId"),
    'main.js must contain mirrorSpreadsheetId'
  );
  assert.ok(
    (source.match(/setupSpreadsheetSheets/g) || []).length >= 2,
    'main.js must call setupSpreadsheetSheets at least twice (primary and mirror branches)'
  );
});
