import { requestAccessToken, getStoredAccessToken } from "./services/authService.js";
import { extractFolderId, loadApplicationConfig, loadUserConfigIfExists } from "./services/configService.js";
import { pickUserConfigSaveHandle, saveUserConfigFile, writeYamlToFileHandle } from "./services/fileService.js";
import {
  appendRow,
  createSpreadsheetInFolder,
  listSpreadsheetsByTitle,
  readRange,
  setInitialSheetHeaders,
  setupSpreadsheetSheets,
  verifyFolderAccess
} from "./services/googleApiService.js";
import { loadLocaleMessages } from "./services/localeService.js";
import { toFlatYaml } from "./utils/yaml.js";
import { renderTestConsolePage } from "./dev/testConsolePage.js";

const appRoot = document.getElementById("app");
const appState = {
  applicationConfig: null,
  locale: "en",
  messages: {},
  accessToken: null,
  userConfig: null,
  currentPage: "workspace"
};
const GOOGLE_CLIENT_ID_PLACEHOLDER = "REPLACE_WITH_GOOGLE_OAUTH_CLIENT_ID";
const BOOT_LOADING_MESSAGE = "Loading application configuration…";

boot().catch((error) => {
  const technicalMessage = toTechnicalErrorMessage(error);
  console.error("Bootstrap failed:", error);
  appRoot.innerHTML = `<section class="card"><h1>Initialization error</h1><p>${escapeHtml("Unable to initialize the app. Check console for details.")}</p></section>`;
  console.error("Bootstrap failure details:", technicalMessage);
});

async function boot() {
  if (window.location.protocol === "file:") {
    renderLocalhostGuard();
    return;
  }

  appRoot.innerHTML = `<section class="card"><p class="status" id="boot-status">${BOOT_LOADING_MESSAGE}</p></section>`;

  appState.applicationConfig = await loadApplicationConfig();
  appState.locale = appState.applicationConfig.defaultLocale;
  appState.messages = await loadLocaleMessages(appState.locale);
  appState.accessToken = getStoredAccessToken();
  appState.userConfig = await loadUserConfigIfExists();

  if (appState.userConfig) {
    initializePageRouting();
    renderActivePage();
    return;
  }

  renderWizard();
}

function resolveHashPage() {
  if (
    window.location.hash === "#test-console" &&
    appState.applicationConfig.testConsoleEnabled === true
  ) {
    return "test-console";
  }
  return "workspace";
}

function initializePageRouting() {
  appState.currentPage = resolveHashPage();
  window.addEventListener("hashchange", () => {
    const nextPage = resolveHashPage();
    if (nextPage !== appState.currentPage) {
      appState.currentPage = nextPage;
      renderActivePage();
    }
  });
}

function renderActivePage() {
  if (appState.currentPage === "test-console") {
    renderTestConsolePage(appRoot, appState);
    return;
  }
  renderBusinessPlaceholder();
}

function renderWizard() {
  appRoot.innerHTML = `
    <section class="card">
      <h1>${t("wizardTitle")}</h1>
      <p>${t("wizardDescription")}</p>
      <form id="setup-form">
        <label>${t("languageLabel")}
          <select name="locale">
            <option value="en"${appState.locale === "en" ? " selected" : ""}>English</option>
            <option value="rus"${appState.locale === "rus" ? " selected" : ""}>Russian</option>
          </select>
        </label>
        <label>${t("primaryFolderUrl")}
          <input name="primaryFolderUrl" type="url" required placeholder="https://drive.google.com/drive/folders/..." />
        </label>
        <label>${t("mirrorFolderUrl")}
          <input name="mirrorFolderUrl" type="url" required placeholder="https://drive.google.com/drive/folders/..." />
        </label>
        <label>${t("operatorEmail")}
          <input name="operatorEmail" type="email" required placeholder="operator@example.com" />
        </label>
        <div class="actions">
          <button type="button" id="authorize-btn">${t("authorizeGoogle")}</button>
          <button type="submit">${t("initialize")}</button>
        </div>
      </form>
      <p class="status" id="status">${t("configMissing")}</p>
      <details>
        <summary>Manual userconfig.yml content</summary>
        <pre id="yaml-preview"></pre>
      </details>
    </section>
  `;

  const form = document.getElementById("setup-form");
  const authorizeButton = document.getElementById("authorize-btn");
  const localeSelect = form.elements.namedItem("locale");

  localeSelect.addEventListener("change", async (event) => {
    appState.locale = event.target.value;
    appState.messages = await loadLocaleMessages(appState.locale);
    renderWizard();
  });

  authorizeButton.addEventListener("click", async () => {
    setStatus("Authorizing...");
    try {
      const tokenData = await requestAccessToken(getEffectiveClientId());
      appState.accessToken = tokenData.accessToken;
      setStatus(t("authorizationOk"));
    } catch (error) {
      console.error("Authorization failed:", error);
      setStatus("Authorization failed. Please try again and check console for details.", true);
    }
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!appState.accessToken) {
      setStatus(t("authorizationRequired"), true);
      return;
    }

    try {
      // Step 1 — pick save location before any Drive calls
      let saveHandle = null;
      if (typeof window.showSaveFilePicker === "function") {
        try {
          saveHandle = await pickUserConfigSaveHandle();
        } catch (err) {
          if (err.name === "AbortError") {
            setStatus("File save cancelled. Please try again and choose a save location.", true);
            return;
          }
          throw err;
        }
      }

      // Step 2 — parse form + verify folders
      const formData = new FormData(form);
      const primaryFolderUrl = String(formData.get("primaryFolderUrl") || "").trim();
      const mirrorFolderUrl = String(formData.get("mirrorFolderUrl") || "").trim();
      const operatorEmail = String(formData.get("operatorEmail") || "").trim();
      const googleClientId = getEffectiveClientId();
      const token = appState.accessToken;

      setStatus("Verifying folder access...");
      const primaryFolderId = extractFolderId(primaryFolderUrl);
      const mirrorFolderId = extractFolderId(mirrorFolderUrl);
      await verifyFolderAccess(primaryFolderId, token);
      await verifyFolderAccess(mirrorFolderId, token);

      // Step 3 — folder consistency check
      const activeSpreadsheetTitle = appState.applicationConfig.activeSpreadsheetTitle;
      const [primaryMatches, mirrorMatches] = await Promise.all([
        listSpreadsheetsByTitle(activeSpreadsheetTitle, primaryFolderId, token),
        listSpreadsheetsByTitle(activeSpreadsheetTitle, mirrorFolderId, token)
      ]);

      if (primaryMatches.length > 1 || mirrorMatches.length > 1) {
        renderFolderInconsistencyError();
        return;
      }

      // Step 4 — ensure spreadsheet in PRIMARY and MIRROR
      setStatus("Creating spreadsheet and sheets...");

      let activeSpreadsheetId;
      if (primaryMatches.length === 0) {
        const spreadsheet = await createSpreadsheetInFolder(activeSpreadsheetTitle, primaryFolderId, token);
        await setupSpreadsheetSheets(spreadsheet.id, token);
        await setInitialSheetHeaders(spreadsheet.id, token);
        activeSpreadsheetId = spreadsheet.id;
      } else {
        activeSpreadsheetId = primaryMatches[0].id;
      }

      let mirrorSpreadsheetId;
      if (mirrorMatches.length === 0) {
        const mirrorSpreadsheet = await createSpreadsheetInFolder(activeSpreadsheetTitle, mirrorFolderId, token);
        await setupSpreadsheetSheets(mirrorSpreadsheet.id, token);
        await setInitialSheetHeaders(mirrorSpreadsheet.id, token);
        mirrorSpreadsheetId = mirrorSpreadsheet.id;
      } else {
        mirrorSpreadsheetId = mirrorMatches[0].id;
      }

      // Step 5 — build userConfig
      const userConfig = {
        primaryFolderUrl,
        mirrorFolderUrl,
        primaryFolderId,
        mirrorFolderId,
        operatorEmail,
        googleClientId,
        activeSpreadsheetId,
        mirrorSpreadsheetId,
        activeSpreadsheetTitle: appState.applicationConfig.activeSpreadsheetTitle,
        locale: appState.locale,
        createdAtUtc: new Date().toISOString()
      };

      // Step 6 — write YAML
      const yamlContent = toFlatYaml(userConfig);
      const el = document.getElementById("yaml-preview");
      if (el) el.textContent = yamlContent;

      if (saveHandle) {
        await writeYamlToFileHandle(saveHandle, yamlContent);
        setStatus(t("saveSuccessFs"));
      } else {
        saveUserConfigFile(yamlContent);
        setStatus(t("saveFallbackDownload"));
      }

      // Step 7 — finish
      appState.userConfig = userConfig;
      renderBusinessPlaceholder();
    } catch (error) {
      console.error("Initialization wizard failed:", error);
      setStatus("Setup failed. Please verify inputs and check console for details.", true);
    }
  });
}

function renderBusinessPlaceholder() {
  const testConsoleEnabled = appState.applicationConfig.testConsoleEnabled === true;

  appRoot.innerHTML = `
    <section class="card">
      <h1>Business workspace (MVP)</h1>
      <p>${t("configExists")}</p>
      <p class="status" id="business-status">Google access may be required to use actions below.</p>
      <div class="actions">
        ${testConsoleEnabled ? '<a href="#test-console" class="nav-link">Test Console</a>' : ''}
        <button id="business-authorize-btn">Authorize Google access</button>
        <button id="read-contributors-btn">Read contributors rows</button>
        <button id="append-demo-transaction-btn">Append demo transaction row</button>
      </div>
      <pre id="output"></pre>
    </section>
  `;

  const output = document.getElementById("output");
  const status = document.getElementById("business-status");
  const authorizeButton = document.getElementById("business-authorize-btn");
  const readButton = document.getElementById("read-contributors-btn");
  const appendButton = document.getElementById("append-demo-transaction-btn");

  authorizeButton.addEventListener("click", async () => {
    if (status) {
      status.textContent = "Authorizing...";
      status.className = "status";
    }

    try {
      const tokenData = await requestAccessToken(getEffectiveClientId());
      appState.accessToken = tokenData.accessToken;
      if (status) {
        status.textContent = t("authorizationOk");
        status.className = "status";
      }
    } catch (error) {
      console.error("Business re-authorization failed:", error);
      if (status) {
        status.textContent = "Authorization failed. Please try again and check console for details.";
        status.className = "status error";
      }
    }
  });

  readButton.addEventListener("click", async () => {
    try {
      const token = appState.accessToken || getStoredAccessToken();
      if (!token) throw new Error("Authorize Google first.");
      const spreadsheetId = appState.userConfig.activeSpreadsheetId;
      const data = await readRange(spreadsheetId, "contributors!A1:F200", token);
      output.textContent = JSON.stringify(data.values || [], null, 2);
    } catch (error) {
      console.error("Read contributors failed:", error);
      output.textContent = "Unable to read contributors right now. Check console for details.";
    }
  });

  appendButton.addEventListener("click", async () => {
    try {
      const token = appState.accessToken || getStoredAccessToken();
      if (!token) throw new Error("Authorize Google first.");
      const spreadsheetId = appState.userConfig.activeSpreadsheetId;
      const now = new Date().toISOString();
      await appendRow(
        spreadsheetId,
        "period_transactions",
        [
          `demo-${Date.now()}`,
          now,
          "0.00",
          appState.applicationConfig.usedCurrencies[0] || "EUR",
          "",
          "Demo Actor",
          "donation",
          "",
          "Demo row added by MVP button"
        ],
        token
      );
      output.textContent = "Demo transaction row appended.";
    } catch (error) {
      console.error("Append demo transaction failed:", error);
      output.textContent = "Unable to append demo transaction right now. Check console for details.";
    }
  });
}

function renderFolderInconsistencyError() {
  const heading = t("wizard.folderInconsistency.heading");
  const message = t("wizard.folderInconsistency.message").replace(
    "{title}",
    appState.applicationConfig.activeSpreadsheetTitle
  );
  const retryLabel = t("wizard.folderInconsistency.retry");

  appRoot.innerHTML = `
    <section class="card">
      <h1>${escapeHtml(heading)}</h1>
      <p>${escapeHtml(message)}</p>
      <div class="actions">
        <button id="retry-wizard-btn">${escapeHtml(retryLabel)}</button>
      </div>
    </section>
  `;

  document.getElementById("retry-wizard-btn").addEventListener("click", () => {
    renderWizard();
  });
}

function setStatus(message, isError = false) {
  const status = document.getElementById("status");
  if (!status) return;
  status.textContent = message;
  status.className = isError ? "status error" : "status";
}

function t(key) {
  return appState.messages[key] || key;
}

function getEffectiveClientId() {
  const configured = String(appState.applicationConfig?.googleClientId || "").trim();
  if (configured && configured !== GOOGLE_CLIENT_ID_PLACEHOLDER) return configured;
  throw new Error("Set googleClientId in app/applicationconfig.yml.");
}

function renderLocalhostGuard() {
  appRoot.innerHTML = `
    <section class="card">
      <h1>Launch via localhost required</h1>
      <p>
        This app uses browser APIs that are blocked on <code>file://</code> for security reasons —
        it must be served over <code>http://localhost</code>.
      </p>

      <h2>How to launch</h2>
      <p>Use the launch script for your platform — it starts a local Node.js server and opens the app automatically:</p>
      <ul>
        <li><strong>Windows</strong> — double-click <code>launch.bat</code></li>
        <li><strong>macOS</strong> — double-click <code>launch.command</code></li>
        <li>
          <strong>Linux</strong> — run in a terminal:
          <br><code>chmod +x launch.sh</code> &nbsp;(once, to make it executable)
          <br><code>./launch.sh</code>
        </li>
      </ul>

      <p>The app will open at: <code>http://localhost:10800</code></p>

      <h2>Node.js not installed?</h2>
      <p>
        The launch scripts require Node.js. If it is not installed on your machine,
        download it from <a href="https://nodejs.org/" target="_blank" rel="noopener noreferrer">nodejs.org</a>.
      </p>
    </section>
  `;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
}

function toTechnicalErrorMessage(error) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}
