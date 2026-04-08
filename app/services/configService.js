import { parseFlatYaml } from "../utils/yaml.js";

const USER_CONFIG_PATH = "./userconfig.yml";
const APP_CONFIG_PATH = "./app/applicationconfig.yml";

export async function loadApplicationConfig() {
  const response = await fetch(APP_CONFIG_PATH, { cache: "no-store" });
  if (!response.ok) {
    throw new Error("applicationconfig.yml is missing.");
  }

  const parsed = parseFlatYaml(await response.text());
  return {
    financialYearStart: parsed.financialYearStart || "04-01",
    defaultLocale: parsed.defaultLocale || "en",
    availableCurrencies: (parsed.availableCurrencies || "EUR")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
    usedCurrencies: (parsed.usedCurrencies || "EUR")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
    activeSpreadsheetTitle: parsed.activeSpreadsheetTitle || "active_period_operations",
    googleClientId: parsed.googleClientId || "",
    testConsoleEnabled: parsed.testConsoleEnabled === "true"
  };
}

export async function loadUserConfigIfExists() {
  try {
    const response = await fetch(USER_CONFIG_PATH, { cache: "no-store" });
    if (!response.ok) return null;
    return parseFlatYaml(await response.text());
  } catch (_error) {
    return null;
  }
}

export function extractFolderId(folderUrl) {
  const match = folderUrl.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  if (!match) throw new Error("Cannot extract folder ID from URL.");
  return match[1];
}
