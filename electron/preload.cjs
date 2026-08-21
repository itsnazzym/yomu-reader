const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  searchGalleries: (params) => ipcRenderer.invoke("search-galleries", params),
  getGallery: (params) => ipcRenderer.invoke("get-gallery", params),
  getRandomGallery: (params) => ipcRenderer.invoke("get-random-gallery", params),
  getTags: (params) => ipcRenderer.invoke("get-tags", params),
  getDefaultSettings: () => ipcRenderer.invoke("get-default-settings"),
  selectDownloadDirectory: () => ipcRenderer.invoke("select-download-directory"),
  formatFilenamePreview: (params) => ipcRenderer.invoke("format-filename-preview", params),
  startDownload: (params) => ipcRenderer.invoke("start-download", params),
  cancelDownload: (params) => ipcRenderer.invoke("cancel-download", params),
  openFolder: (params) => ipcRenderer.invoke("open-folder", params),
  scanLocalLibrary: (params) => ipcRenderer.invoke("scan-local-library", params),
  readLocalBook: (params) => ipcRenderer.invoke("read-local-book", params),
  getDownloadedIds: (params) => ipcRenderer.invoke("get-downloaded-ids", params),
  openAuthWindow: () => ipcRenderer.invoke("open-auth-window"),
  getImageData: (params) => ipcRenderer.invoke("get-image-data", params),
  preloadGalleryImages: (params) => ipcRenderer.invoke("preload-gallery-images", params),
  saveDownloadedArchive: (params) => ipcRenderer.invoke("save-downloaded-archive", params),
  getCdnConfig: () => ipcRenderer.invoke("get-cdn-config"),
  getGalleryComments: (params) => ipcRenderer.invoke("get-gallery-comments", params),
  updateDnsSettings: (params) => ipcRenderer.invoke("update-dns-settings", params),
  startQuickShareServer: (params) => ipcRenderer.invoke("start-quick-share-server", params),
  stopQuickShareServer: () => ipcRenderer.invoke("stop-quick-share-server"),
  getQuickShareStatus: () => ipcRenderer.invoke("get-quick-share-status"),
  getLocalDownloadedFiles: (params) => ipcRenderer.invoke("get-local-downloaded-files", params),
  getSecretStatus: () => ipcRenderer.invoke("get-secret-status"),
  setSecrets: (params) => ipcRenderer.invoke("set-secrets", params),
  migrateSecrets: (params) => ipcRenderer.invoke("migrate-secrets", params),
  clearSecrets: () => ipcRenderer.invoke("clear-secrets"),
  logTerminal: (text) => ipcRenderer.invoke("log-terminal", { text }),
  onDownloadProgress: (callback) => {
    const handler = (_event, payload) => callback(payload);
    ipcRenderer.on("download-progress", handler);
    return () => ipcRenderer.removeListener("download-progress", handler);
  },
  onCookiesCaptured: (callback) => {
    const handler = (_event, cookies) => callback(cookies);
    ipcRenderer.on("cookies-captured", handler);
    return () => ipcRenderer.removeListener("cookies-captured", handler);
  },
  onSecretsUpdated: (callback) => {
    const handler = (_event, status) => callback(status);
    ipcRenderer.on("secrets-updated", handler);
    return () => ipcRenderer.removeListener("secrets-updated", handler);
  },
  onCloudflareChallengeNeeded: (callback) => {
    const handler = () => callback();
    ipcRenderer.on("cloudflare-challenge-needed", handler);
    return () => ipcRenderer.removeListener("cloudflare-challenge-needed", handler);
  },
});
