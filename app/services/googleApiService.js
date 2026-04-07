async function googleApiFetch(url, accessToken, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
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

export async function verifyFolderAccess(folderId, accessToken) {
  const query = encodeURIComponent(`'${folderId}' in parents and trashed=false`);
  await googleApiFetch(
    `https://www.googleapis.com/drive/v3/files?q=${query}&pageSize=1&fields=files(id,name)`,
    accessToken
  );
}

export async function createSpreadsheetInFolder(title, folderId, accessToken) {
  return await googleApiFetch(
    "https://www.googleapis.com/drive/v3/files?fields=id,name,parents",
    accessToken,
    {
      method: "POST",
      body: JSON.stringify({
        name: title,
        mimeType: "application/vnd.google-apps.spreadsheet",
        parents: [folderId]
      })
    }
  );
}

export async function setupSpreadsheetSheets(spreadsheetId, accessToken) {
  await googleApiFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}:batchUpdate`,
    accessToken,
    {
      method: "POST",
      body: JSON.stringify({
        requests: [
          {
            updateSheetProperties: {
              properties: { sheetId: 0, title: "contributors" },
              fields: "title"
            }
          },
          { addSheet: { properties: { title: "period_transactions" } } },
          { addSheet: { properties: { title: "period_initial_balances" } } }
        ]
      })
    }
  );
}

export async function setInitialSheetHeaders(spreadsheetId, accessToken) {
  await updateRange(spreadsheetId, "contributors!A1:F1", [
    ["id", "username", "last_name", "phone_number", "contribution_amount", "notes"]
  ], accessToken);

  await updateRange(spreadsheetId, "period_transactions!A1:I1", [
    [
      "id",
      "date",
      "amount_decimal",
      "currency",
      "contributor_id",
      "actor_name",
      "operation_type",
      "document_reference",
      "notes"
    ]
  ], accessToken);

  await updateRange(spreadsheetId, "period_initial_balances!A1:B1", [["currency", "amount_decimal"]], accessToken);
}

export async function appendRow(spreadsheetId, sheetName, values, accessToken) {
  return await googleApiFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(
      `${sheetName}!A:Z`
    )}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
    accessToken,
    {
      method: "POST",
      body: JSON.stringify({
        values: [values]
      })
    }
  );
}

export async function readRange(spreadsheetId, range, accessToken) {
  return await googleApiFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`,
    accessToken
  );
}

async function updateRange(spreadsheetId, range, values, accessToken) {
  await googleApiFetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(
      range
    )}?valueInputOption=RAW`,
    accessToken,
    {
      method: "PUT",
      body: JSON.stringify({
        range,
        majorDimension: "ROWS",
        values
      })
    }
  );
}

export async function listSpreadsheetsByTitle(title, folderId, accessToken) {
  const q = encodeURIComponent(
    `'${folderId}' in parents and name = '${title.replace(/'/g, "\\'")}' and mimeType = 'application/vnd.google-apps.spreadsheet' and trashed = false`
  );
  const url = `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)&pageSize=50`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Google API error (${response.status}): ${details}`);
  }
  const data = await response.json();
  return data.files || [];
}

export async function ensureSpreadsheetByTitle(title, folderId, accessToken) {
  const files = await listSpreadsheetsByTitle(title, folderId, accessToken);
  if (files.length === 0) {
    return await createSpreadsheetInFolder(title, folderId, accessToken);
  }
  if (files.length === 1) {
    return files[0];
  }
  throw new Error(
    `Multiple spreadsheets named "${title}" found in folder ${folderId}. Please remove duplicates manually.`
  );
}
