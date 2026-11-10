function createWindowSecurity({ getMainWindow, getQuickShareUrl, openExternal }) {
function assertMainWindowSender(event) {
  const mainWindow = getMainWindow();
  if (
    !mainWindow ||
    mainWindow.isDestroyed() ||
    event.sender !== mainWindow.webContents ||
    event.senderFrame !== mainWindow.webContents.mainFrame
  ) {
    throw new Error("IPC request rejected");
  }
}

function isSafeExternalUrl(rawUrl) {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol === "https:") return true;
    const quickShareUrl = getQuickShareUrl();
    return !!quickShareUrl && parsed.href.startsWith(quickShareUrl);
  } catch {
    return false;
  }
}

function secureMainWindowNavigation(window, appUrl) {
  const allowedUrl = new URL(appUrl);
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (isSafeExternalUrl(url)) {
      void openExternal(url);
    }
    return { action: "deny" };
  });
  window.webContents.on("will-navigate", (event, url) => {
    let allowed = false;
    try {
      const parsed = new URL(url);
      allowed = allowedUrl.protocol === "file:"
        ? parsed.protocol === "file:" && parsed.pathname === allowedUrl.pathname
        : parsed.origin === allowedUrl.origin;
    } catch {}
    if (!allowed) {
      event.preventDefault();
      if (isSafeExternalUrl(url)) {
        void openExternal(url);
      }
    }
  });
}

function secureNhentaiWindowNavigation(window, openExternalLinks = false) {
  const isTrustedNhentaiUrl = (rawUrl) => {
    try {
      const parsed = new URL(rawUrl);
      return parsed.protocol === "https:" &&
        (parsed.hostname === "nhentai.net" || parsed.hostname.endsWith(".nhentai.net"));
    } catch {
      return false;
    }
  };

  window.webContents.setWindowOpenHandler(({ url }) => {
    if (openExternalLinks && isSafeExternalUrl(url) && !isTrustedNhentaiUrl(url)) {
      void openExternal(url);
    }
    return { action: "deny" };
  });
  window.webContents.on("will-navigate", (event, url) => {
    if (!isTrustedNhentaiUrl(url)) {
      event.preventDefault();
      if (openExternalLinks && isSafeExternalUrl(url)) {
        void openExternal(url);
      }
    }
  });
}

return { assertMainWindowSender, isSafeExternalUrl, secureMainWindowNavigation, secureNhentaiWindowNavigation };
}
module.exports = { createWindowSecurity };
