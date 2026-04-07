import { requestAccessToken, getStoredAccessToken } from "./services/authService.js";
import { extractFolderId, loadApplicationConfig, loadUserConfigIfExists } from "./services/configService.js";
import { saveUserConfigFile } from "./services/fileService.js";
import {
  appendRow,
  createSpreadsheetInFolder,
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

    const formData = new FormData(form);
    const primaryFolderUrl = String(formData.get("primaryFolderUrl") || "").trim();
    const mirrorFolderUrl = String(formData.get("mirrorFolderUrl") || "").trim();
    const operatorEmail = String(formData.get("operatorEmail") || "").trim();
    const googleClientId = getEffectiveClientId();

    try {
      setStatus("Verifying folder access...");
      const primaryFolderId = extractFolderId(primaryFolderUrl);
      const mirrorFolderId = extractFolderId(mirrorFolderUrl);
      await verifyFolderAccess(primaryFolderId, appState.accessToken);
      await verifyFolderAccess(mirrorFolderId, appState.accessToken);

      setStatus("Creating spreadsheet and sheets...");
      const spreadsheet = await createSpreadsheetInFolder(
        appState.applicationConfig.activeSpreadsheetTitle,
        primaryFolderId,
        appState.accessToken
      );
      await setupSpreadsheetSheets(spreadsheet.id, appState.accessToken);
      await setInitialSheetHeaders(spreadsheet.id, appState.accessToken);

      const userConfig = {
        primaryFolderUrl,
        mirrorFolderUrl,
        primaryFolderId,
        mirrorFolderId,
        operatorEmail,
        googleClientId,
        activeSpreadsheetId: spreadsheet.id,
        activeSpreadsheetTitle: appState.applicationConfig.activeSpreadsheetTitle,
        locale: appState.locale,
        createdAtUtc: new Date().toISOString()
      };

      const yamlContent = toFlatYaml(userConfig);
      document.getElementById("yaml-preview").textContent = yamlContent;
      const saveMethod = await saveUserConfigFile(yamlContent);
      if (saveMethod === "filesystem") {
        setStatus(t("saveSuccessFs"));
      } else {
        setStatus(t("saveFallbackDownload"));
      }

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
