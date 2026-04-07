function parseScalar(rawValue) {
  const value = rawValue.trim();
  if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) {
    return value.slice(1, -1);
  }
  if (value === "true") return true;
  if (value === "false") return false;
  return value;
}

export function parseFlatYaml(yamlText) {
  const result = {};
  const lines = yamlText.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = line.indexOf(":");
    if (index === -1) continue;
    const key = line.slice(0, index).trim();
    const rawValue = line.slice(index + 1);
    result[key] = parseScalar(rawValue);
  }
  return result;
}

export function toFlatYaml(data) {
  const lines = [];
  for (const [key, value] of Object.entries(data)) {
    const normalized = String(value).replace(/"/g, '\\"');
    lines.push(`${key}: "${normalized}"`);
  }
  return `${lines.join("\n")}\n`;
}
