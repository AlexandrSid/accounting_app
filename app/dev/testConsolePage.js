import {
  verifyFolderAccess,
  ensureSpreadsheetByTitle,
  setupSpreadsheetSheets,
  setInitialSheetHeaders,
  appendRow,
  readRange
} from '../services/googleApiService.js';
import { rowSchemas } from './rowSchemas.js';

export function renderTestConsolePage(container, appState) {
  while (container.firstChild) {
    container.removeChild(container.firstChild);
  }

  const wrapper = document.createElement('div');
  wrapper.className = 'test-console';

  wrapper.appendChild(buildVerifyFolderSection(appState));
  wrapper.appendChild(buildEnsureSpreadsheetSection(appState));
  wrapper.appendChild(buildSetupSheetsSection(appState));
  wrapper.appendChild(buildSetHeadersSection(appState));
  wrapper.appendChild(buildAppendRowSection(appState));
  wrapper.appendChild(buildReadRangeSection(appState));

  container.appendChild(wrapper);
}

function getFolderId(choice, userConfig) {
  return choice === 'mirror' ? userConfig.mirrorFolderId : userConfig.primaryFolderId;
}

function createSection(title) {
  const section = document.createElement('section');
  const h3 = document.createElement('h3');
  h3.textContent = title;
  section.appendChild(h3);
  return section;
}

function createFolderSelect() {
  const select = document.createElement('select');
  for (const val of ['primary', 'mirror']) {
    const opt = document.createElement('option');
    opt.value = val;
    opt.textContent = val;
    select.appendChild(opt);
  }
  return select;
}

function createInput(type, placeholder) {
  const input = document.createElement('input');
  input.type = type || 'text';
  if (placeholder) input.placeholder = placeholder;
  return input;
}

function createLabel(text, control) {
  const label = document.createElement('label');
  label.textContent = text;
  label.appendChild(control);
  return label;
}

function createButton(text) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.textContent = text;
  return btn;
}

function createStackForm() {
  const div = document.createElement('div');
  div.className = 'stack-form';
  return div;
}

async function withLoading(button, pre, fn) {
  button.disabled = true;
  pre.textContent = 'Loading...';
  try {
    await fn();
  } catch (err) {
    pre.textContent = `Error: ${err.message || String(err)}`;
  } finally {
    button.disabled = false;
  }
}

function buildVerifyFolderSection(appState) {
  const section = createSection('1. Verify Folder Access');
  const form = createStackForm();

  const folderSelect = createFolderSelect();
  form.appendChild(createLabel('Folder', folderSelect));

  const button = createButton('Verify Access');
  form.appendChild(button);

  const output = document.createElement('pre');
  section.appendChild(form);
  section.appendChild(output);

  button.addEventListener('click', () => {
    withLoading(button, output, async () => {
      const folderId = getFolderId(folderSelect.value, appState.userConfig);
      await verifyFolderAccess(folderId, appState.accessToken);
      output.textContent = `Access verified. Folder ID: ${folderId}`;
    });
  });

  return section;
}

function buildEnsureSpreadsheetSection(appState) {
  const section = createSection('2. Ensure Spreadsheet by Title');
  const form = createStackForm();

  const titleInput = createInput('text', 'Spreadsheet title');
  form.appendChild(createLabel('Title', titleInput));

  const folderSelect = createFolderSelect();
  form.appendChild(createLabel('Folder', folderSelect));

  const button = createButton('Ensure Spreadsheet');
  form.appendChild(button);

  const output = document.createElement('pre');
  section.appendChild(form);
  section.appendChild(output);

  button.addEventListener('click', () => {
    withLoading(button, output, async () => {
      const title = titleInput.value.trim();
      if (!title) throw new Error('Title is required.');
      const folderId = getFolderId(folderSelect.value, appState.userConfig);
      const result = await ensureSpreadsheetByTitle(title, folderId, appState.accessToken);
      output.textContent = JSON.stringify(result, null, 2);
    });
  });

  return section;
}

function buildSetupSheetsSection(appState) {
  const section = createSection('3. Setup Sheets');
  const form = createStackForm();

  const idInput = createInput('text', 'Spreadsheet ID');
  form.appendChild(createLabel('Spreadsheet ID', idInput));

  const button = createButton('Setup Sheets');
  form.appendChild(button);

  const output = document.createElement('pre');
  section.appendChild(form);
  section.appendChild(output);

  button.addEventListener('click', () => {
    withLoading(button, output, async () => {
      const spreadsheetId = idInput.value.trim();
      if (!spreadsheetId) throw new Error('Spreadsheet ID is required.');
      await setupSpreadsheetSheets(spreadsheetId, appState.accessToken);
      output.textContent = 'Sheets setup complete (contributors, period_transactions, period_initial_balances).';
    });
  });

  return section;
}

function buildSetHeadersSection(appState) {
  const section = createSection('4. Set Initial Sheet Headers');
  const form = createStackForm();

  const idInput = createInput('text', 'Spreadsheet ID');
  form.appendChild(createLabel('Spreadsheet ID', idInput));

  const sheetNameInput = createInput('text', 'e.g. contributors');
  form.appendChild(createLabel('Sheet Name (for reference)', sheetNameInput));

  const button = createButton('Set Headers');
  form.appendChild(button);

  const output = document.createElement('pre');
  section.appendChild(form);
  section.appendChild(output);

  button.addEventListener('click', () => {
    withLoading(button, output, async () => {
      const spreadsheetId = idInput.value.trim();
      if (!spreadsheetId) throw new Error('Spreadsheet ID is required.');
      await setInitialSheetHeaders(spreadsheetId, appState.accessToken);
      output.textContent = 'Headers set for all sheets.';
    });
  });

  return section;
}

function buildAppendRowSection(appState) {
  const section = createSection('5. Append Row');
  const form = createStackForm();

  const folderSelect = createFolderSelect();
  form.appendChild(createLabel('Folder', folderSelect));

  const sheetSelect = document.createElement('select');
  for (const schema of rowSchemas) {
    const opt = document.createElement('option');
    opt.value = schema.sheetName;
    opt.textContent = schema.sheetName;
    sheetSelect.appendChild(opt);
  }
  form.appendChild(createLabel('Sheet', sheetSelect));

  const fieldsContainer = document.createElement('div');
  form.appendChild(fieldsContainer);

  function renderSchemaFields(sheetName) {
    while (fieldsContainer.firstChild) {
      fieldsContainer.removeChild(fieldsContainer.firstChild);
    }
    const schema = rowSchemas.find((s) => s.sheetName === sheetName);
    if (!schema) return;
    for (const col of schema.columns) {
      const inputType = col.type === 'number' ? 'number' : col.type === 'date' ? 'date' : 'text';
      const input = createInput(inputType, col.label);
      input.dataset.key = col.key;
      fieldsContainer.appendChild(createLabel(col.label, input));
    }
  }

  renderSchemaFields(rowSchemas[0].sheetName);

  sheetSelect.addEventListener('change', () => {
    renderSchemaFields(sheetSelect.value);
  });

  const button = createButton('Append Row');
  form.appendChild(button);

  const output = document.createElement('pre');
  section.appendChild(form);
  section.appendChild(output);

  button.addEventListener('click', () => {
    withLoading(button, output, async () => {
      const folderId = getFolderId(folderSelect.value, appState.userConfig);
      const sheetName = sheetSelect.value;
      const schema = rowSchemas.find((s) => s.sheetName === sheetName);
      const spreadsheetTitle = appState.applicationConfig.activeSpreadsheetTitle;
      const spreadsheet = await ensureSpreadsheetByTitle(spreadsheetTitle, folderId, appState.accessToken);
      const values = schema.columns.map((col) => {
        const input = fieldsContainer.querySelector(`[data-key="${col.key}"]`);
        return input ? input.value.trim() : '';
      });
      await appendRow(spreadsheet.id, sheetName, values, appState.accessToken);
      output.textContent = JSON.stringify({ sheetName, values }, null, 2);
    });
  });

  return section;
}

function buildReadRangeSection(appState) {
  const section = createSection('6. Read Range');
  const form = createStackForm();

  const idInput = createInput('text', 'Spreadsheet ID');
  form.appendChild(createLabel('Spreadsheet ID', idInput));

  const rangeInput = createInput('text', 'e.g. contributors!A1:E10');
  form.appendChild(createLabel('Range', rangeInput));

  const button = createButton('Read Range');
  form.appendChild(button);

  const output = document.createElement('pre');
  section.appendChild(form);
  section.appendChild(output);

  button.addEventListener('click', () => {
    withLoading(button, output, async () => {
      const spreadsheetId = idInput.value.trim();
      const range = rangeInput.value.trim();
      if (!spreadsheetId) throw new Error('Spreadsheet ID is required.');
      if (!range) throw new Error('Range is required.');
      const result = await readRange(spreadsheetId, range, appState.accessToken);
      output.textContent = JSON.stringify(result, null, 2);
    });
  });

  return section;
}
