/**
 * Setup note:
 * - This project does not have a configured test runner yet.
 * - This file uses Node's built-in test runner (node:test) so it can run without extra deps.
 * - Example command (when you want to execute it): node --test tests/integration/googleDriveTestConfig.test.js
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

import {
  loadGoogleDriveTestConfig,
  REQUIRED_FIELDS
} from "./googleDriveTestConfig.js";

function createTempConfigPath() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "google-drive-config-test-"));
  return {
    dir,
    filePath: path.join(dir, "google-drive.test.config.json")
  };
}

function cleanupDir(dirPath) {
  fs.rmSync(dirPath, { recursive: true, force: true });
}

test("uses default config path when no argument is provided", () => {
  const expectedPath = path.resolve(
    __dirname,
    "google-drive.test.config.json"
  );
  const originalExistsSync = fs.existsSync;
  const originalReadFileSync = fs.readFileSync;

  try {
    fs.existsSync = (inputPath) => inputPath === expectedPath;
    fs.readFileSync = (inputPath, encoding) => {
      assert.equal(inputPath, expectedPath);
      assert.equal(encoding, "utf8");
      return JSON.stringify({
        googleClientId: "test-client-id",
        googleClientSecret: "test-client-secret",
        googleRefreshToken: "test-refresh-token",
        driveFolderId: "test-folder-id"
      });
    };

    const result = loadGoogleDriveTestConfig();
    assert.equal(result.driveFolderId, "test-folder-id");
  } finally {
    fs.existsSync = originalExistsSync;
    fs.readFileSync = originalReadFileSync;
  }
});

test("throws when config file is missing", () => {
  const { dir, filePath } = createTempConfigPath();

  try {
    assert.throws(
      () => loadGoogleDriveTestConfig(filePath),
      /Missing private integration test config/
    );
  } finally {
    cleanupDir(dir);
  }
});

test("throws when config file contains invalid JSON", () => {
  const { dir, filePath } = createTempConfigPath();

  try {
    fs.writeFileSync(filePath, "{ invalidJson: true ", "utf8");

    assert.throws(
      () => loadGoogleDriveTestConfig(filePath),
      /Invalid JSON in integration test config/
    );
  } finally {
    cleanupDir(dir);
  }
});

test("throws when required fields are missing or blank", () => {
  const { dir, filePath } = createTempConfigPath();

  try {
    const configMissingFields = {
      googleClientId: "client-id",
      googleClientSecret: "   ",
      googleRefreshToken: "",
      testSpreadsheetTitle: "Safe test title"
    };
    fs.writeFileSync(filePath, JSON.stringify(configMissingFields), "utf8");

    assert.throws(() => loadGoogleDriveTestConfig(filePath), (error) => {
      assert.match(
        error.message,
        /is missing required fields: googleClientSecret, googleRefreshToken, driveFolderId/
      );
      return true;
    });
  } finally {
    cleanupDir(dir);
  }
});

test("loads and returns config when all required fields are valid", () => {
  const { dir, filePath } = createTempConfigPath();

  try {
    const validConfig = {
      googleClientId: "test-client-id.apps.googleusercontent.com",
      googleClientSecret: "test-client-secret",
      googleRefreshToken: "test-refresh-token",
      driveFolderId: "test-drive-folder-id",
      testSpreadsheetTitle: "Integration test sheet title"
    };
    fs.writeFileSync(filePath, JSON.stringify(validConfig), "utf8");

    const result = loadGoogleDriveTestConfig(filePath);

    assert.deepEqual(result, validConfig);
    assert.equal(REQUIRED_FIELDS.length, 4);
  } finally {
    cleanupDir(dir);
  }
});
