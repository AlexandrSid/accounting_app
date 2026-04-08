# Integration Tests

## Prerequisites

### Google Drive Tests
- Create private config `tests/integration/google-drive.test.config.json` from `tests/integration/google-drive.test.config.example.json`
- Fill private OAuth values: `googleClientId`, `googleClientSecret`, `googleRefreshToken`
- Fill folder IDs for both targets: `mainDriveFolderId` and `mirrorDriveFolderId` (and keep `driveFolderId` aligned with main folder)
- Never commit the private config file with real values

### Node.js & ESM
- Node.js must be installed (tests require `node --test` runner)
- All test files are converted to ESM modules (see `package.json` with `"type": "module"`)

## Run Commands

### All integration tests
```bash
node --test tests/integration/*.test.js
```

### Specific tests
```bash
# Google Drive workflows
node --test tests/integration/googleDriveCreateFileFlow.test.js tests/integration/googleDriveEditFileFlow.test.js

# Configuration contracts
node --test tests/integration/mainBootstrapContract.test.js tests/integration/userConfigContract.test.js

# Test Console (if enabled in applicationconfig.yml)
node --test tests/integration/testConsoleContract.test.js

# Launch scripts integrity
node --test tests/integration/launchScriptsContract.test.js
```

## Test Coverage

| Test | Purpose |
|------|---------|
| `googleDriveCreateFileFlow.test.js` | Create & cleanup spreadsheets in both main/mirror folders |
| `googleDriveEditFileFlow.test.js` | Edit & verify metadata updates |
| `googleDriveTestConfig.test.js` | Google Drive test config loading & validation |
| `mainBootstrapContract.test.js` | Main application bootstrap & config loading |
| `userConfigContract.test.js` | User configuration file contract validation |
| `testConsoleContract.test.js` | Test Console tab when `testConsoleEnabled: "true"` |
| `launchScriptsContract.test.js` | Launch scripts integrity check |

## Expected Behavior

- If private config is missing/invalid or OAuth is unreachable, tests are skipped with setup guidance
- If configured correctly, each flow runs in both main and mirror folders:
  - Create test spreadsheet
  - Edit file metadata (name) twice to verify repeated updates
  - Verify state after each edit by refetching file
  - Delete test file and verify cleanup

