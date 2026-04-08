import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const REQUIRED_FIELDS = [
  "googleClientId",
  "googleClientSecret",
  "googleRefreshToken",
  "driveFolderId"
];

function loadGoogleDriveTestConfig(configPath) {
  const resolvedPath =
    configPath ||
    path.resolve(__dirname, "google-drive.test.config.json");

  if (!fs.existsSync(resolvedPath)) {
    throw new Error(
      `Missing private integration test config at "${resolvedPath}". ` +
        "Create it from tests/integration/google-drive.test.config.example.json."
    );
  }

  const fileContent = fs.readFileSync(resolvedPath, "utf8");
  let parsedConfig;
  try {
    parsedConfig = JSON.parse(fileContent);
  } catch (error) {
    throw new Error(
      `Invalid JSON in integration test config "${resolvedPath}": ${error.message}`
    );
  }

  const missingFields = REQUIRED_FIELDS.filter((fieldName) => {
    const value = parsedConfig[fieldName];
    return typeof value !== "string" || value.trim().length === 0;
  });

  if (missingFields.length > 0) {
    throw new Error(
      `Integration test config "${resolvedPath}" is missing required fields: ${missingFields.join(
        ", "
      )}`
    );
  }

  return parsedConfig;
}

export { loadGoogleDriveTestConfig, REQUIRED_FIELDS };
