const fs=require("node:fs"),path=require("node:path"),crypto=require("node:crypto");
function architectureOf(name) {
  if (/universal/i.test(name)) return "universal";
  if (/arm64|aarch64/i.test(name)) return "arm64";
  if (/armeabi|armv7/i.test(name)) return "armv7";
  if (/x86_64|x64|\.exe$/i.test(name)) return "x64";
  if (/x86|ia32/i.test(name)) return "x86";
  return "unknown";
}
async function createReleaseManifest(directory,version) {
  if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error("A release version x.y.z is required");
  const files=[];
  for(const entry of fs.readdirSync(directory,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))){
    if(!entry.isFile()||!/\.(exe|apk|deb|appimage|dmg)$/i.test(entry.name)||/debug/i.test(entry.name))continue;
    const filePath=path.join(directory,entry.name),hash=crypto.createHash("sha512");
    for await(const chunk of fs.createReadStream(filePath))hash.update(chunk);
    files.push({fileName:entry.name,version,architecture:architectureOf(entry.name),sizeBytes:fs.statSync(filePath).size,sha512:hash.digest("base64")});
  }
  const manifest={version,files};
  const output=path.join(directory,"release-manifest.json");
  fs.writeFileSync(`${output}.tmp`,JSON.stringify(manifest,null,2)+"\n");fs.renameSync(`${output}.tmp`,output);
  return manifest;
}
module.exports={createReleaseManifest};
if(require.main===module)createReleaseManifest(process.argv[2]||"release",process.env.APP_VERSION||process.argv[3]||"").then(result=>console.log(`Manifest: ${result.files.length} installers`)).catch(error=>{console.error(error.message);process.exitCode=1;});
