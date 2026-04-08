/**
 * Setup note:
 * - This project does not have a configured test runner yet.
 * - This file uses Node's built-in test runner (node:test) so it can run without extra deps.
 * - Example command: node --test tests/integration/launchScriptsContract.test.js
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const REPO_ROOT = path.resolve(__dirname, "../..");
const LAUNCH_BAT_PATH = path.join(REPO_ROOT, "launch.bat");
const LAUNCH_SH_PATH = path.join(REPO_ROOT, "launch.sh");
const LAUNCH_COMMAND_PATH = path.join(REPO_ROOT, "launch.command");
const STOP_BAT_PATH = path.join(REPO_ROOT, "stop.bat");
const STOP_SH_PATH = path.join(REPO_ROOT, "stop.sh");
const STOP_COMMAND_PATH = path.join(REPO_ROOT, "stop.command");
const SERVER_MJS_PATH = path.join(REPO_ROOT, "server/server.mjs");
const STOP_MJS_PATH = path.join(REPO_ROOT, "server/stop.mjs");
const MAIN_JS_PATH = path.join(REPO_ROOT, "app/main.js");
const INDEX_HTML_PATH = path.join(REPO_ROOT, "index.html");
const GITIGNORE_PATH = path.join(REPO_ROOT, ".gitignore");

// ---------------------------------------------------------------------------
// launch.bat
// ---------------------------------------------------------------------------

test("launch.bat exists", () => {
  assert.ok(fs.existsSync(LAUNCH_BAT_PATH), "launch.bat must exist at repo root");
});

test("launch.bat uses port 10800", () => {
  const src = fs.readFileSync(LAUNCH_BAT_PATH, { encoding: "utf8" });
  assert.ok(src.includes("10800"), "launch.bat must reference port 10800");
});

test("launch.bat invokes node server/server.mjs", () => {
  const src = fs.readFileSync(LAUNCH_BAT_PATH, { encoding: "utf8" });
  assert.ok(src.includes("node server/server.mjs"), "launch.bat must start the Node.js server");
});

test("launch.bat opens browser at http://127.0.0.1:10800", () => {
  const src = fs.readFileSync(LAUNCH_BAT_PATH, { encoding: "utf8" });
  assert.ok(
    src.includes("http://127.0.0.1:10800"),
    "launch.bat must open the browser at http://127.0.0.1:10800"
  );
});

// ---------------------------------------------------------------------------
// launch.sh
// ---------------------------------------------------------------------------

test("launch.sh exists", () => {
  assert.ok(fs.existsSync(LAUNCH_SH_PATH), "launch.sh must exist at repo root");
});

test("launch.sh uses port 10800", () => {
  const src = fs.readFileSync(LAUNCH_SH_PATH, { encoding: "utf8" });
  assert.ok(src.includes("10800"), "launch.sh must reference port 10800");
});

test("launch.sh invokes node server/server.mjs", () => {
  const src = fs.readFileSync(LAUNCH_SH_PATH, { encoding: "utf8" });
  assert.ok(src.includes("node server/server.mjs"), "launch.sh must start the Node.js server");
});

test("launch.sh opens browser with xdg-open or open", () => {
  const src = fs.readFileSync(LAUNCH_SH_PATH, { encoding: "utf8" });
  assert.ok(
    src.includes("xdg-open") || src.includes("open "),
    "launch.sh must use xdg-open or open to open the browser"
  );
});

test("launch.sh cds to its own directory so it works from any working directory", () => {
  const src = fs.readFileSync(LAUNCH_SH_PATH, { encoding: "utf8" });
  assert.ok(src.includes('cd "$(dirname "$0")"'), 'launch.sh must cd to its own directory');
});

// ---------------------------------------------------------------------------
// launch.command  (macOS double-click script)
// ---------------------------------------------------------------------------

test("launch.command exists", () => {
  assert.ok(fs.existsSync(LAUNCH_COMMAND_PATH), "launch.command must exist at repo root");
});

test("launch.command uses port 10800", () => {
  const src = fs.readFileSync(LAUNCH_COMMAND_PATH, { encoding: "utf8" });
  assert.ok(src.includes("10800"), "launch.command must reference port 10800");
});

test("launch.command invokes node server/server.mjs", () => {
  const src = fs.readFileSync(LAUNCH_COMMAND_PATH, { encoding: "utf8" });
  assert.ok(src.includes("node server/server.mjs"), "launch.command must start the Node.js server");
});

test("launch.command opens browser with macOS open command", () => {
  const src = fs.readFileSync(LAUNCH_COMMAND_PATH, { encoding: "utf8" });
  assert.ok(src.includes("open "), "launch.command must use `open` (macOS) to open the browser");
});

test("launch.command cds to its own directory so it works when double-clicked", () => {
  const src = fs.readFileSync(LAUNCH_COMMAND_PATH, { encoding: "utf8" });
  assert.ok(src.includes('cd "$(dirname "$0")"'), 'launch.command must cd to its own directory');
});

// ---------------------------------------------------------------------------
// stop scripts
// ---------------------------------------------------------------------------

test("stop.bat exists and invokes node server/stop.mjs", () => {
  assert.ok(fs.existsSync(STOP_BAT_PATH), "stop.bat must exist at repo root");
  const src = fs.readFileSync(STOP_BAT_PATH, { encoding: "utf8" });
  assert.ok(src.includes("node server/stop.mjs"), "stop.bat must invoke node server/stop.mjs");
});

test("stop.sh exists and invokes node server/stop.mjs", () => {
  assert.ok(fs.existsSync(STOP_SH_PATH), "stop.sh must exist at repo root");
  const src = fs.readFileSync(STOP_SH_PATH, { encoding: "utf8" });
  assert.ok(src.includes("node server/stop.mjs"), "stop.sh must invoke node server/stop.mjs");
});

test("stop.command exists and invokes node server/stop.mjs", () => {
  assert.ok(fs.existsSync(STOP_COMMAND_PATH), "stop.command must exist at repo root");
  const src = fs.readFileSync(STOP_COMMAND_PATH, { encoding: "utf8" });
  assert.ok(src.includes("node server/stop.mjs"), "stop.command must invoke node server/stop.mjs");
});

// ---------------------------------------------------------------------------
// server/server.mjs
// ---------------------------------------------------------------------------

test("server/server.mjs exists", () => {
  assert.ok(fs.existsSync(SERVER_MJS_PATH), "server/server.mjs must exist");
});

test("server/server.mjs binds to 127.0.0.1 (not 0.0.0.0)", () => {
  const src = fs.readFileSync(SERVER_MJS_PATH, { encoding: "utf8" });
  assert.ok(src.includes("127.0.0.1"), "server/server.mjs must bind to 127.0.0.1");
  assert.ok(!src.includes("0.0.0.0"), "server/server.mjs must not bind to 0.0.0.0");
});

test("server/server.mjs mentions port 10800", () => {
  const src = fs.readFileSync(SERVER_MJS_PATH, { encoding: "utf8" });
  assert.ok(src.includes("10800"), "server/server.mjs must reference port 10800");
});

// ---------------------------------------------------------------------------
// server/stop.mjs
// ---------------------------------------------------------------------------

test("server/stop.mjs exists", () => {
  assert.ok(fs.existsSync(STOP_MJS_PATH), "server/stop.mjs must exist");
});

// ---------------------------------------------------------------------------
// .gitignore
// ---------------------------------------------------------------------------

test(".gitignore contains runtime/", () => {
  const src = fs.readFileSync(GITIGNORE_PATH, { encoding: "utf8" });
  assert.ok(src.includes("runtime/"), ".gitignore must include the runtime/ directory");
});

// ---------------------------------------------------------------------------
// renderLocalhostGuard() in app/main.js
// ---------------------------------------------------------------------------

test("renderLocalhostGuard references all three launch script names", () => {
  const src = fs.readFileSync(MAIN_JS_PATH, { encoding: "utf8" });
  const guardStart = src.indexOf("function renderLocalhostGuard");
  assert.ok(guardStart !== -1, "renderLocalhostGuard function must exist in main.js");

  const guardBody = src.slice(guardStart, guardStart + 2000);
  assert.ok(guardBody.includes("launch.bat"), "renderLocalhostGuard must mention launch.bat");
  assert.ok(guardBody.includes("launch.command"), "renderLocalhostGuard must mention launch.command");
  assert.ok(guardBody.includes("launch.sh"), "renderLocalhostGuard must mention launch.sh");
});

test("renderLocalhostGuard shows localhost:10800 URL", () => {
  const src = fs.readFileSync(MAIN_JS_PATH, { encoding: "utf8" });
  const guardStart = src.indexOf("function renderLocalhostGuard");
  const guardBody = src.slice(guardStart, guardStart + 2000);
  assert.ok(
    guardBody.includes("http://localhost:10800"),
    "renderLocalhostGuard must display http://localhost:10800"
  );
});

test("renderLocalhostGuard includes a nodejs.org link for users without Node.js", () => {
  const src = fs.readFileSync(MAIN_JS_PATH, { encoding: "utf8" });
  const guardStart = src.indexOf("function renderLocalhostGuard");
  const guardBody = src.slice(guardStart, guardStart + 2000);
  assert.ok(
    guardBody.includes("https://nodejs.org/"),
    "renderLocalhostGuard must link to nodejs.org"
  );
});

// ---------------------------------------------------------------------------
// index.html — noscript block
// ---------------------------------------------------------------------------

test("index.html noscript block mentions all three launch scripts", () => {
  const src = fs.readFileSync(INDEX_HTML_PATH, { encoding: "utf8" });
  const noscriptStart = src.indexOf("<noscript>");
  const noscriptEnd = src.indexOf("</noscript>", noscriptStart);
  assert.ok(noscriptStart !== -1, "index.html must contain a <noscript> block");
  assert.ok(noscriptEnd !== -1, "index.html <noscript> block must be closed");

  const block = src.slice(noscriptStart, noscriptEnd);
  assert.ok(block.includes("launch.bat"), "noscript block must mention launch.bat");
  assert.ok(block.includes("launch.command"), "noscript block must mention launch.command");
  assert.ok(block.includes("launch.sh"), "noscript block must mention launch.sh");
});

test("index.html noscript block contains localhost:10800 URL", () => {
  const src = fs.readFileSync(INDEX_HTML_PATH, { encoding: "utf8" });
  const noscriptStart = src.indexOf("<noscript>");
  const noscriptEnd = src.indexOf("</noscript>", noscriptStart);
  const block = src.slice(noscriptStart, noscriptEnd);
  assert.ok(
    block.includes("localhost:10800"),
    "noscript block must include localhost:10800"
  );
});

// ---------------------------------------------------------------------------
// index.html — default static shell inside #app
// ---------------------------------------------------------------------------

test("index.html static shell mentions launch scripts and localhost port", () => {
  const src = fs.readFileSync(INDEX_HTML_PATH, { encoding: "utf8" });
  const mainStart = src.indexOf('<main id="app">');
  const mainEnd = src.indexOf("</main>", mainStart);
  assert.ok(mainStart !== -1, 'index.html must contain <main id="app">');
  assert.ok(mainEnd !== -1, "index.html <main> must be closed");

  const mainBlock = src.slice(mainStart, mainEnd);
  assert.ok(mainBlock.includes("launch.bat"));
  assert.ok(mainBlock.includes("launch.command"));
  assert.ok(mainBlock.includes("launch.sh"));
  assert.ok(mainBlock.includes("localhost:10800"));
  assert.ok(mainBlock.includes("nodejs.org"));
});

test("index.html static shell documents folder prep and OAuth Test users", () => {
  const src = fs.readFileSync(INDEX_HTML_PATH, { encoding: "utf8" });
  assert.ok(src.includes("primary"));
  assert.ok(src.includes("mirror"));
  assert.ok(src.includes("Editor"));
  assert.ok(src.includes("operator"));
  assert.ok(src.includes("Test users"));
});

test("index.html does not inject preload-notice or Loading MutationObserver bridge", () => {
  const src = fs.readFileSync(INDEX_HTML_PATH, { encoding: "utf8" });
  assert.equal(src.includes("preload-notice"), false);
  assert.equal(src.includes("MutationObserver"), false);
});
