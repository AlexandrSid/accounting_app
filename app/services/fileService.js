/** @returns {Promise<FileSystemFileHandle>} */
export async function pickUserConfigSaveHandle() {
  return window.showSaveFilePicker({
    suggestedName: "userconfig.yml",
    types: [
      {
        description: "YAML configuration",
        accept: { "application/x-yaml": [".yml"] }
      }
    ]
  });
}

/** @param {FileSystemFileHandle} handle @param {string} yamlContent */
export async function writeYamlToFileHandle(handle, yamlContent) {
  const writable = await handle.createWritable();
  await writable.write(yamlContent);
  await writable.close();
}

/** @param {string} yamlContent @returns {"download"} */
export function saveUserConfigFile(yamlContent) {
  const blob = new Blob([yamlContent], { type: "application/x-yaml" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "userconfig.yml";
  link.click();
  URL.revokeObjectURL(link.href);
  return "download";
}
