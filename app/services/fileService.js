export async function saveUserConfigFile(yamlContent) {
  if (typeof window.showSaveFilePicker === "function") {
    const handle = await window.showSaveFilePicker({
      suggestedName: "userconfig.yml",
      types: [
        {
          description: "YAML configuration",
          accept: { "application/x-yaml": [".yml"] }
        }
      ]
    });
    const writable = await handle.createWritable();
    await writable.write(yamlContent);
    await writable.close();
    return "filesystem";
  }

  const blob = new Blob([yamlContent], { type: "application/x-yaml" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "userconfig.yml";
  link.click();
  URL.revokeObjectURL(link.href);
  return "download";
}
