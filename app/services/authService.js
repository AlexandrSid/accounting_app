const TOKEN_STORAGE_KEY = "operator_oauth_token";
const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/spreadsheets"
].join(" ");

function getGoogleAccounts() {
  return window.google?.accounts?.oauth2;
}

export async function requestAccessToken(clientId) {
  const googleOAuth = getGoogleAccounts();
  if (!googleOAuth) {
    throw new Error("Google Identity Services failed to load.");
  }
  if (!clientId || clientId === "REPLACE_WITH_GOOGLE_OAUTH_CLIENT_ID") {
    throw new Error("Set googleClientId in app/applicationconfig.yml.");
  }

  const tokenResponse = await new Promise((resolve, reject) => {
    const tokenClient = googleOAuth.initTokenClient({
      client_id: clientId,
      scope: GOOGLE_SCOPES,
      callback: (response) => {
        if (response.error) {
          reject(new Error(response.error));
          return;
        }
        resolve(response);
      }
    });

    tokenClient.requestAccessToken({ prompt: "consent" });
  });

  const expiresAt = Date.now() + Number(tokenResponse.expires_in || 0) * 1000;
  const tokenData = {
    accessToken: tokenResponse.access_token,
    expiresAt
  };
  localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(tokenData));
  return tokenData;
}

export function getStoredAccessToken() {
  const raw = localStorage.getItem(TOKEN_STORAGE_KEY);
  if (!raw) return null;
  try {
    const data = JSON.parse(raw);
    if (!data.accessToken || !data.expiresAt) return null;
    if (Date.now() >= data.expiresAt) return null;
    return data.accessToken;
  } catch (_error) {
    return null;
  }
}
