"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..", "..");

test("le preload expose le téléchargement natif sans accepter une archive base64 complète", () => {
  let api;
  require("node:vm").runInNewContext(fs.readFileSync(path.join(root, "electron/preload.cjs"), "utf8"), {
    require: () => ({ contextBridge: { exposeInMainWorld: (_name, value) => { api = value; } }, ipcRenderer: {} }),
  });
  assert.equal(typeof api.startDownload, "function");
  assert.equal(api.saveDownloadedArchive, undefined);
});

test("la sécurité de fenêtre isole les IPC et refuse les navigations vers un fichier externe", () => {
  let factory;
  try { factory=require("./windowSecurity.cjs").createWindowSecurity; } catch {}
  assert.equal(typeof factory,"function");
  const opened=[];const events={};
  const main={isDestroyed:()=>false,webContents:{mainFrame:{},setWindowOpenHandler:fn=>{events.open=fn;},on:(name,fn)=>{events[name]=fn;}}};
  const policy=factory({getMainWindow:()=>main,getQuickShareUrl:()=>"http://127.0.0.1:45678/fixture/",openExternal:url=>opened.push(url)});
  policy.assertMainWindowSender({sender:main.webContents,senderFrame:main.webContents.mainFrame});
  assert.throws(()=>policy.assertMainWindowSender({sender:main.webContents,senderFrame:{}}));
  policy.secureMainWindowNavigation(main,"file:///app/index.html");
  assert.equal(events.open({url:"file:///private.txt"}).action,"deny");
  let prevented=false;events["will-navigate"]({preventDefault(){prevented=true;}},"https://example.test/");
  assert.equal(prevented,true);assert.deepEqual(opened,["https://example.test/"]);
});

test("le renderer Electron n'écrit plus cookies/api_key dans localStorage", () => {
  const src = fs.readFileSync(path.join(root, "src", "stores", "settingsStore.ts"), "utf8");
  assert.match(src, /function persistPublicSettings/);
  assert.match(src, /isElectron\(\)\s*\n?\s*\? publicSettings/);
  assert.match(src, /migrateSecrets/);
  assert.match(src, /hasSecureCookies/);
  assert.match(src, /persistPublicSettings\(updated\)/);
});

test("le processus principal capture les cookies dans le coffre, pas en clair vers le renderer", () => {
  const src = fs.readFileSync(path.join(root, "electron", "main.cjs"), "utf8");
  assert.match(src, /getSecretVault\(\)\.save\(\{ cookies: cookieStr \}\)/);
  assert.match(src, /send\("cookies-captured", ""\)/);
  assert.doesNotMatch(src, /send\("cookies-captured", cookieStr\)/);
});
