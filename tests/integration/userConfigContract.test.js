/**
 * Setup note:
 * - This project does not have a configured test runner yet.
 * - This file uses Node's built-in test runner (node:test) so it can run without extra deps.
 * - Example command: node --test tests/integration/userConfigContract.test.js
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const REPO_ROOT = path.resolve(__dirname, "../..");
const USER_CONFIG_PATH = path.join(REPO_ROOT, "userconfig.yml");
const GITIGNORE_PATH = path.join(REPO_ROOT, ".gitignore");
const YAML_UTILS_MODULE_PATH = pathToFileURL(
  path.join(REPO_ROOT, "app/utils/yaml.js")
).href;

async function parseUserConfig() {
  const yamlUtils = await import(YAML_UTILS_MODULE_PATH);
  const fileContent = fs.readFileSync(USER_CONFIG_PATH, "utf8");
  return yamlUtils.parseFlatYaml(fileContent);
}

test("userconfig.yml stays compatible with parseFlatYaml contract", async () => {
  const parsed = await parseUserConfig();
  const requiredKeys = ["operatorEmail", "primaryFolderUrl", "mirrorFolderUrl"];
  const sensitiveKeyNamePattern =
    /(password|passcode|passwd|token|secret|api[-_]?key|credential|private[-_]?key|auth)/i;

  assert.equal(typeof parsed, "object");
  assert.equal(parsed === null, false);

  const presentKeys = Object.keys(parsed);
  for (const key of requiredKeys) {
    assert.ok(
      presentKeys.includes(key),
      `userconfig.yml must contain required key: ${key}`
    );
  }

  for (const key of requiredKeys) {
    assert.equal(typeof parsed[key], "string");
    assert.notEqual(parsed[key].trim(), "");
  }

  assert.match(parsed.operatorEmail, /^[^\s@]+@[^\s@]+\.[^\s@]+$/);
  assert.match(parsed.primaryFolderUrl, /^https:\/\/drive\.google\.com\/drive\/folders\//);
  assert.match(parsed.mirrorFolderUrl, /^https:\/\/drive\.google\.com\/drive\/folders\//);
  assert.equal(
    Object.keys(parsed).some((key) => sensitiveKeyNamePattern.test(key)),
    false,
    "userconfig.yml must not include password/token/secret-like fields"
  );
});

test("userconfig.yml remains intentionally local and untracked by git", () => {
  const gitignore = fs.readFileSync(GITIGNORE_PATH, "utf8");
  const ignoreLines = gitignore
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  assert.ok(ignoreLines.includes("userconfig.yml"));
  assert.equal(ignoreLines.includes("!userconfig.yml"), false);
});

test("applicationconfig.yml declares testConsoleEnabled as string true", () => {
  const APP_CONFIG_PATH = path.join(REPO_ROOT, "app/applicationconfig.yml");
  const source = fs.readFileSync(APP_CONFIG_PATH, { encoding: "utf8" });
  assert.ok(
    source.includes('testConsoleEnabled: "true"'),
    'applicationconfig.yml must contain testConsoleEnabled: "true"'
  );
});

test("configService.js parses testConsoleEnabled with strict string comparison", () => {
  const CONFIG_SERVICE_PATH = path.join(REPO_ROOT, "app/services/configService.js");
  const source = fs.readFileSync(CONFIG_SERVICE_PATH, { encoding: "utf8" });
  assert.ok(
    source.includes('=== "true"'),
    'configService.js must use strict string comparison === "true" to parse testConsoleEnabled'
  );
});

test("runtime/ directory is excluded by .gitignore", () => {
  const gitignore = fs.readFileSync(GITIGNORE_PATH, { encoding: "utf8" });
  assert.ok(gitignore.includes("runtime/"), ".gitignore must include runtime/ to keep PID files local");
});
