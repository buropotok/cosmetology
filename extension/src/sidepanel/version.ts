export function extensionVersionLabel() {
  return `v${chrome.runtime.getManifest().version}`;
}
