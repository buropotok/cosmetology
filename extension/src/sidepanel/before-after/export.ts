export function buildBeforeAfterFilename(now = new Date()) {
  const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const time = `${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`;
  return `До-После-${date}-${time}.png`;
}

export async function downloadComposedImage(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  try {
    return await chrome.downloads.download({url, filename, saveAs: true});
  } finally {
    URL.revokeObjectURL(url);
  }
}
