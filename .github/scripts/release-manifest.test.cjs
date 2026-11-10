const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),os=require("node:os"),vm=require("node:vm");
const root=path.resolve(__dirname,"../..");
test("le site conserve les deux APK et choisit la version la plus récente de chaque architecture",()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),"yomu-release-test-"));
  try {
    fs.mkdirSync(path.join(dir,"web"));fs.mkdirSync(path.join(dir,"release"));
    for(const name of ["YomuReader-2.0.7-arm64-v8a.apk","YomuReader-2.0.8-arm64-v8a.apk","YomuReader-2.0.8-universal.apk"])fs.writeFileSync(path.join(dir,"release",name),"fixture");
    const bundle=require("esbuild").buildSync({entryPoints:[path.join(root,"web/src/lib/releases.ts")],bundle:true,platform:"node",format:"cjs",write:false});
    const context={module:{exports:{}},require,process:{cwd:()=>path.join(dir,"web")}};
    vm.runInNewContext(bundle.outputFiles[0].text,context);const files=context.module.exports.getReleaseFiles();
    assert.equal(files.length,2);assert.ok(files.some(f=>f.fileName==="YomuReader-2.0.8-arm64-v8a.apk"));assert.ok(files.some(f=>f.fileName==="YomuReader-2.0.8-universal.apk"));
  } finally {fs.rmSync(dir,{recursive:true,force:true});}
});
test("le manifeste calcule les empreintes des installateurs et décrit leur architecture",async()=>{
  let create;try{create=require("./create-release-manifest.cjs").createReleaseManifest;}catch{}
  assert.equal(typeof create,"function");const dir=fs.mkdtempSync(path.join(os.tmpdir(),"yomu-manifest-test-"));
  try {fs.writeFileSync(path.join(dir,"YomuReader-arm64-v8a-release.apk"),"fixture");fs.writeFileSync(path.join(dir,"YomuReader-x86.exe"),"fixture");const manifest=await create(dir,"2.0.8");assert.equal(manifest.files[0].architecture,"arm64");assert.equal(manifest.files[0].sizeBytes,7);assert.equal(Buffer.from(manifest.files[0].sha512,"base64").length,64);assert.equal(manifest.files.find(f=>f.fileName.endsWith(".exe")).architecture,"x86");assert.equal(JSON.parse(fs.readFileSync(path.join(dir,"release-manifest.json"),"utf8")).version,"2.0.8");}
  finally {fs.rmSync(dir,{recursive:true,force:true});}
});
