import { test } from "node:test";
import assert from "node:assert/strict";

import { loadGoogleDriveTestConfig } from "./googleDriveTestConfig.js";

const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const GOOGLE_DRIVE_BASE_URL = "https://www.googleapis.com/drive/v3";
const GOOGLE_DRIVE_FILES_ENDPOINT =
  `${GOOGLE_DRIVE_BASE_URL}/files?fields=id,name,parents,mimeType`;
const GOOGLE_SHEETS_MIME_TYPE = "application/vnd.google-apps.spreadsheet";
const INTEGRATION_COMMAND =
  "node --test tests/integration/googleDriveEditFileFlow.test.js";
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

  return { mainFolderId, mirrorFolderId };
}

function buildRunTag() {
  const dateStamp = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  return process.env.GDRIVE_TEST_RUN_ID || `${dateStamp}-${process.pid}`;
}

function buildDeterministicName(flowType, folderLabel) {
  return `accounting-app-api003-${buildRunTag()}-${folderLabel}-${flowType}`;
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

  if (response.status === 204) return null;
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
    const sanitized = sanitizeErrorMessage(message, config);
    throw new Error(
      `Network error while requesting OAuth token: ${sanitized}`
    );
  }

  if (!tokenResponse.ok) {
    const details = await tokenResponse.text();
    const sanitized = sanitizeErrorMessage(details, config);
    throw new Error(
      `OAuth token request failed (${tokenResponse.status}): ${sanitized}`
    );
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

async function createSpreadsheetInFolder(fileName, folderId, accessToken) {
  return await googleApiFetch(GOOGLE_DRIVE_FILES_ENDPOINT, accessToken, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: fileName,
      mimeType: GOOGLE_SHEETS_MIME_TYPE,
      parents: [folderId]
    })
  });
}

async function updateDriveFileName(fileId, nextName, accessToken) {
  return await googleApiFetch(
    `${GOOGLE_DRIVE_BASE_URL}/files/${encodeURIComponent(
      fileId
    )}?fields=id,name,parents,mimeType`,
    accessToken,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: nextName })
    }
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

async function deleteDriveFile(fileId, accessToken) {
  await googleApiFetch(
    `${GOOGLE_DRIVE_BASE_URL}/files/${encodeURIComponent(fileId)}`,
    accessToken,
    { method: "DELETE" }
  );
}

async function runEditFileFlowInFolder({
  config,
  folderLabel,
  folderId,
  accessToken
}) {
  const initialName = buildDeterministicName("initial", folderLabel);
  const intermediateName = buildDeterministicName("intermediate", folderLabel);
  const updatedName = buildDeterministicName("updated", folderLabel);
  let createdFileId = null;
  let primaryError = null;
  let cleanupError = null;

  try {
    const createdFile = await createSpreadsheetInFolder(
      initialName,
      folderId,
      accessToken
    );
    createdFileId = createdFile.id;

    assert.ok(createdFileId, "Created file should include id.");
    assert.equal(createdFile.name, initialName);
    assert.equal(createdFile.mimeType, GOOGLE_SHEETS_MIME_TYPE);
    assert.equal(createdFile.parents[0], folderId);

    const intermediateFile = await updateDriveFileName(
      createdFileId,
      intermediateName,
      accessToken
    );
    assert.equal(intermediateFile.id, createdFileId);
    assert.equal(intermediateFile.name, intermediateName);
    assert.equal(intermediateFile.parents[0], folderId);
    assert.equal(
      intermediateFile.mimeType,
      GOOGLE_SHEETS_MIME_TYPE
    );
    assert.notEqual(
      intermediateFile.name,
      initialName,
      "First edit should change the original name."
    );

    const fetchedAfterFirstEdit = await getDriveFile(createdFileId, accessToken);
    assert.equal(fetchedAfterFirstEdit.id, createdFileId);
    assert.equal(fetchedAfterFirstEdit.name, intermediateName);
    assert.equal(fetchedAfterFirstEdit.parents[0], folderId);
    assert.equal(
      fetchedAfterFirstEdit.mimeType,
      GOOGLE_SHEETS_MIME_TYPE
    );

    const updatedFile = await updateDriveFileName(createdFileId, updatedName, accessToken);
    assert.equal(updatedFile.id, createdFileId);
    assert.equal(updatedFile.name, updatedName);
    assert.equal(updatedFile.parents[0], folderId);
    assert.equal(updatedFile.mimeType, GOOGLE_SHEETS_MIME_TYPE);
    assert.notEqual(
      updatedFile.name,
      intermediateName,
      "Second edit should replace the intermediate name."
    );

    const fetchedFile = await getDriveFile(createdFileId, accessToken);
    assert.equal(fetchedFile.id, createdFileId);
    assert.equal(fetchedFile.name, updatedName);
    assert.equal(fetchedFile.parents[0], folderId);
    assert.equal(fetchedFile.mimeType, GOOGLE_SHEETS_MIME_TYPE);
  } catch (error) {
    const sanitized = sanitizeErrorMessage(error.message, config);
    primaryError = new Error(
      `Edit-file flow failed for "${folderLabel}" folder: ${sanitized}`,
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
  if (primaryError) throw primaryError;
  if (cleanupError) throw cleanupError;
}

test("edits and cleans up spreadsheets in main and mirror folders", async (t) => {
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

  await t.test("main folder edit flow", async () => {
    await runEditFileFlowInFolder({
      config,
      folderLabel: "main",
      folderId: mainFolderId,
      accessToken
    });
  });

  await t.test("mirror folder edit flow", async () => {
    await runEditFileFlowInFolder({
      config,
      folderLabel: "mirror",
      folderId: mirrorFolderId,
      accessToken
    });
  });
});
