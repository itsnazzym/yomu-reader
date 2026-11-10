import test from "node:test";
import assert from "node:assert/strict";
import { enqueueGalleries, getDownloadQueueSnapshot as getQueueState, initDownloadQueue, queueKeyOf, removeQueueItem, resumeQueueItem } from "../lib/downloadQueueStore";
import { updateDownloadSettings } from "../lib/downloadSettingsStore";
import { __network, __onTransfer, transfers, __failSaf } from "./mockQueueRuntime";
import { getSource } from "../lib/sources/registry";

async function until(check: () => boolean) {
  for (let i=0;i<200;i++) { if (check()) return; await new Promise(resolve=>setTimeout(resolve,5)); }
  assert.fail("queue did not reach expected state");
}

test("perdre le Wi-Fi suspend le transfert avant la page suivante", async () => {
  await initDownloadQueue();
  await updateDownloadSettings({ wifiOnly: true });
  __network("wifi");
  const before = transfers.length;
  __onTransfer(() => __network("cellular"));
  enqueueGalleries([{ id: 123, title: "Fixture" }]);
  await until(() => getQueueState().items.some(i => i.id===123 && i.status!=="queued" && i.status!=="downloading"));
  const item = getQueueState().items.find(i=>i.id===123)!;
  assert.equal(item.status,"paused");
  assert.equal(transfers.length-before,1);
  __onTransfer(()=>{});
  removeQueueItem(queueKeyOf(item));
});

test("une copie externe échouée reste visible et se relance sans retélécharger", async () => {
  __network("wifi"); __failSaf(true);
  await updateDownloadSettings({ wifiOnly:false,mode:"saf",safDirectoryUri:"content://folder" });
  enqueueGalleries([{ id: 124, title: "Fixture" }]);
  await until(()=> getQueueState().items.some(i=>i.id===124 && ["completed","error","export_error"].includes(i.status)));
  const item = getQueueState().items.find(i=>i.id===124)!;
  assert.equal(item.status,"export_error");
  assert.ok(item.localId);
  const before=transfers.length;
  __failSaf(false); resumeQueueItem(queueKeyOf(item));
  await until(()=>getQueueState().items.find(i=>i.id===124)?.status==="completed");
  assert.equal(transfers.length,before);
});

test("une reconnexion Wi-Fi immédiate ne reste pas bloquée par l'ancien worker annulé",async()=>{
  await updateDownloadSettings({wifiOnly:true,mode:"app"});__network("wifi");let first=true;
  __onTransfer(()=>{if(first){first=false;__network("cellular");__network("wifi");}});
  try{enqueueGalleries([{id:126,title:"Fixture"}]);await until(()=>getQueueState().items.find(i=>i.id===126)?.status==="completed");}
  finally{__onTransfer(()=>{});}
});

test("deux identifiants E-Hentai complets ne partagent pas un dossier local",async()=>{
  await updateDownloadSettings({wifiOnly:false,mode:"app"});const source=getSource("ehentai"),original=source.getGallery;
  source.getGallery=async nativeId=>({nativeId,globalId:`ehentai:${nativeId}`,title:"Same title",coverUrl:"",numPages:1,tags:[],pageUrls:[{url:`https://example.test/${nativeId}.jpg`}]});
  try{
    enqueueGalleries([{id:125,title:"Same title",src:"ehentai",nativeId:"125_abcdef"},{id:125,title:"Same title",src:"ehentai",nativeId:"125_fedcba"}]);
    await until(()=>getQueueState().items.filter(i=>i.id===125&&i.status==="completed").length===2);
    const ids=getQueueState().items.filter(i=>i.id===125).map(i=>i.localId);assert.equal(new Set(ids).size,2);
  }finally{source.getGallery=original;}
});
