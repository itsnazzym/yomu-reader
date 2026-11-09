const fs = require('fs');
const path = require('path');

async function uploadToGofile(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Fichier introuvable: ${filePath}`);
  }

  console.log(`📡 Résolution du serveur Gofile...`);
  const serverRes = await fetch('https://api.gofile.io/servers');
  if (!serverRes.ok) {
    throw new Error(`Erreur récupération serveur Gofile: HTTP ${serverRes.status}`);
  }
  const serverData = await serverRes.json();
  if (serverData.status !== 'ok' || !serverData.data?.servers?.length) {
    throw new Error(`Réponse serveur Gofile inattendue: ${JSON.stringify(serverData)}`);
  }

  const serverName = serverData.data.servers[0].name;
  const uploadUrl = `https://${serverName}.gofile.io/contents/uploadfile`;
  console.log(`🚀 Téléversement vers ${uploadUrl}...`);

  const fileBytes = fs.readFileSync(filePath);
  const fileName = path.basename(filePath);

  const formData = new FormData();
  const blob = new Blob([fileBytes], { type: 'application/vnd.android.package-archive' });
  formData.append('file', blob, fileName);

  const uploadRes = await fetch(uploadUrl, {
    method: 'POST',
    body: formData,
  });

  if (!uploadRes.ok) {
    throw new Error(`Échec upload Gofile: HTTP ${uploadRes.status}`);
  }

  const result = await uploadRes.json();
  if (result.status !== 'ok') {
    throw new Error(`Gofile a renvoyé une erreur: ${JSON.stringify(result)}`);
  }

  console.log(`✅ Upload réussi!`);
  console.log(`📄 Page de téléchargement : ${result.data.downloadPage}`);
  console.log(`🔑 Code : ${result.data.code}`);
  console.log(`📁 Fichier : ${result.data.fileName}`);
  return result.data;
}

if (require.main === module) {
  const target = process.argv[2];
  if (!target) {
    console.error('Usage: node gofile-upload.js <path-to-file>');
    process.exit(1);
  }
  uploadToGofile(target)
    .then((data) => {
      fs.writeFileSync('mobile/gofile-result.json', JSON.stringify(data, null, 2), 'utf8');
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = { uploadToGofile };
