const FALLBACK_LOCALE = "en";

export async function loadLocaleMessages(locale) {
  const target = locale || FALLBACK_LOCALE;
  try {
    const response = await fetch(`./app/locales/${target}.json`, { cache: "no-store" });
    if (!response.ok) throw new Error("Locale not found");
    return await response.json();
  } catch (_error) {
    const response = await fetch(`./app/locales/${FALLBACK_LOCALE}.json`, { cache: "no-store" });
    return await response.json();
  }
}
