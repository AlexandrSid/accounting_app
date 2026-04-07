import { test } from "node:test";
import assert from "node:assert/strict";

import { loadGoogleDriveTestConfig } from "./googleDriveTestConfig.js";

const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const GOOGLE_DRIVE_BASE_URL = "https://www.googleapis.com/drive/v3";
const GOOGLE_DRIVE_FILES_ENDPOINT =
  `${GOOGLE_DRIVE_BASE_URL}/files?fields=id,name,parents,mimeType`;
const INTEGRATION_COMMAND =
  "node --test tests/integration/googleDriveCreateFileFlow.test.js";
const CONFIG_EXAMPLE_PATH =
  "tests/integration/google-drive.test.config.example.json";

function buildSetupGuidance() {
  return (
    "Local setup required for this real integration test:\n" +
    `- create private config from ${CONFIG_EXAMPLE_PATH}\n` +
    "- fill Google OAuth fields (googleClientId/googleClientSecret/googleRefreshToken)\n" +
    "- provide valid target folder ids (mainDriveFolderId + mirrorDriveFolderId, or equivalent aliases)\n" +
    `- run: ${INTEGRATION_COMMAND}`
  );
}

function createSkipMessage(reason) {
  return `${reason}\n${buildSetupGuidance()}`;
}

function getFolderIdsFromConfig(config) {
  const mainFolderId =
    config.mainDriveFolderId || config.primaryFolderId || config.driveFolderId;
  const mirrorFolderId =
    config.mirrorDriveFolderId ||
    config.mirrorFolderId ||
    config.secondaryFolderId;

  if (!mainFolderId) {
    throw new Error(
      "Integration config must include a main folder id (mainDriveFolderId, primaryFolderId, or driveFolderId)."
    );
  }
  if (!mirrorFolderId) {
    throw new Error(
      "Integration config must include a mirror folder id (mirrorDriveFolderId, mirrorFolderId, or secondaryFolderId)."
    );
  }

  return {
    mainFolderId,
    mirrorFolderId
  };
}

function buildDeterministicTestFileName(folderLabel) {
  const dateStamp = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  const runTag = process.env.GDRIVE_TEST_RUN_ID || `${dateStamp}-${process.pid}`;
  return `accounting-app-api002-${runTag}-${folderLabel}`;
}

function maskSecret(value) {
  if (typeof value !== "string" || value.length === 0) return value;
  if (value.length <= 8) return "***";
  return `${value.slice(0, 2)}***${value.slice(-2)}`;
}

function sanitizeErrorMessage(errorMessage, config) {
  let sanitized = String(errorMessage || "");
  const sensitiveValues = [
    config.googleClientId,
    config.googleClientSecret,
    config.googleRefreshToken
  ].filter((value) => typeof value === "string" && value.length > 0);

  for (const value of sensitiveValues) {
    sanitized = sanitized.split(value).join(maskSecret(value));
  }

  return sanitized;
}

async function googleApiFetch(url, accessToken, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(options.headers || {})
    }
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Google API error (${response.status}): ${details}`);
  }

  if (response.status === 204) {
    return null;
  }

  return await response.json();
}

async function requestAccessToken(config) {
  let tokenResponse;
  try {
    tokenResponse = await fetch(GOOGLE_TOKEN_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams({
        client_id: config.googleClientId,
        client_secret: config.googleClientSecret,
        refresh_token: config.googleRefreshToken,
        grant_type: "refresh_token"
      })
    });
  } catch (error) {
    const message = String(error && error.message ? error.message : error);
    throw new Error(`Network error while requesting OAuth token: ${message}`);
  }

  if (!tokenResponse.ok) {
    const details = await tokenResponse.text();
    throw new Error(`OAuth token request failed (${tokenResponse.status}): ${details}`);
  }

  const tokenPayload = await tokenResponse.json();
  if (!tokenPayload.access_token) {
    throw new Error("OAuth token response does not include access_token.");
  }

  return tokenPayload.access_token;
}

function getConfigPreflight(configLoader) {
  try {
    return { config: configLoader(), skipReason: null };
  } catch (error) {
    const message = String(error && error.message ? error.message : error);
    if (message.includes("Missing private integration test config")) {
      return {
        config: null,
        skipReason:
          "Skipping integration test: private Google Drive config file is missing."
      };
    }
    if (message.includes("is missing required fields")) {
      return {
        config: null,
        skipReason:
          `Skipping integration test: config exists but required fields are missing.\n${message}`
      };
    }
    throw error;
  }
}

async function getAccessTokenPreflight(config) {
  try {
    return { accessToken: await requestAccessToken(config), skipReason: null };
  } catch (error) {
    const message = String(error && error.message ? error.message : error);
    if (message.startsWith("Network error while requesting OAuth token:")) {
      return {
        accessToken: null,
        skipReason:
          `Skipping integration test: unable to reach Google OAuth endpoint.\n${message}`
      };
    }
    throw error;
  }
}

async function createSpreadsheetInFolder(title, folderId, accessToken) {
  return await googleApiFetch(GOOGLE_DRIVE_FILES_ENDPOINT, accessToken, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      name: title,
      mimeType: "application/vnd.google-apps.spreadsheet",
      parents: [folderId]
    })
  });
}

async function deleteDriveFile(fileId, accessToken) {
  await googleApiFetch(
    `${GOOGLE_DRIVE_BASE_URL}/files/${encodeURIComponent(fileId)}`,
    accessToken,
    { method: "DELETE" }
  );
}

async function getDriveFile(fileId, accessToken) {
  return await googleApiFetch(
    `${GOOGLE_DRIVE_BASE_URL}/files/${encodeURIComponent(
      fileId
    )}?fields=id,name,parents,mimeType`,
    accessToken
  );
}

async function runCreateFileFlowInFolder({
  config,
  folderLabel,
  folderId,
  accessToken
}) {
  const testName = buildDeterministicTestFileName(folderLabel);
  let createdFileId = null;
  let primaryError = null;
  let cleanupError = null;

  try {
    const createdFile = await createSpreadsheetInFolder(
      testName,
      folderId,
      accessToken
    );
    createdFileId = createdFile.id;

    assert.ok(createdFileId, "Created file should include id.");
    assert.equal(createdFile.mimeType, "application/vnd.google-apps.spreadsheet");
    assert.ok(Array.isArray(createdFile.parents), "Created file should include parents.");
    assert.equal(createdFile.parents.length, 1, "Created file should have exactly one parent.");
    assert.equal(createdFile.parents[0], folderId);
    assert.equal(createdFile.name, testName);

    const fetchedFile = await getDriveFile(createdFileId, accessToken);
    assert.equal(fetchedFile.id, createdFileId);
    assert.equal(fetchedFile.name, testName);
    assert.equal(fetchedFile.parents[0], folderId);
  } catch (error) {
    const sanitized = sanitizeErrorMessage(error.message, config);
    primaryError = new Error(
      `Create-file flow failed for "${folderLabel}" folder: ${sanitized}`,
      { cause: error }
    );
  } finally {
    if (createdFileId) {
      try {
        await deleteDriveFile(createdFileId, accessToken);
        await assert.rejects(
          () => getDriveFile(createdFileId, accessToken),
          /Google API error \(404\)/
        );
      } catch (error) {
        const sanitized = sanitizeErrorMessage(error.message, config);
        cleanupError = new Error(
          `Cleanup failed for "${folderLabel}" folder (fileId: ${createdFileId}): ${sanitized}`,
          { cause: error }
        );
      }
    }
  }

  if (primaryError && cleanupError) {
    throw new AggregateError(
      [primaryError, cleanupError],
      `${primaryError.message}\nSecondary cleanup failure: ${cleanupError.message}`
    );
  }
  if (primaryError) {
    throw primaryError;
  }
  if (cleanupError) {
    throw cleanupError;
  }
}

test("creates and cleans up spreadsheets in main and mirror folders", async (t) => {
  const { config, skipReason: configSkipReason } = getConfigPreflight(
    loadGoogleDriveTestConfig
  );
  if (configSkipReason) {
    t.skip(createSkipMessage(configSkipReason));
    return;
  }

  const { mainFolderId, mirrorFolderId } = getFolderIdsFromConfig(config);
  const { accessToken, skipReason: accessSkipReason } =
    await getAccessTokenPreflight(config);
  if (accessSkipReason) {
    t.skip(createSkipMessage(accessSkipReason));
    return;
  }

  await t.test("main folder flow", async () => {
    await runCreateFileFlowInFolder({
      config,
      folderLabel: "main",
      folderId: mainFolderId,
      accessToken
    });
  });

  await t.test("mirror folder flow", async () => {
    await runCreateFileFlowInFolder({
      config,
      folderLabel: "mirror",
      folderId: mirrorFolderId,
      accessToken
    });
  });
});
