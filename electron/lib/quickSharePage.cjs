function generateMobileWebClientHtml(ip, port) {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>nHentai Quick Share - Transfert PC vers Android</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background-color: #0c0c12;
      color: #e2e8f0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      padding-bottom: 60px;
      -webkit-tap-highlight-color: transparent;
    }
    header {
      position: sticky;
      top: 0;
      z-index: 100;
      background: rgba(18, 18, 28, 0.92);
      backdrop-filter: blur(12px);
      border-bottom: 1px solid #27273a;
      padding: 12px 16px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .logo-badge {
      width: 36px;
      height: 36px;
      border-radius: 10px;
      background: linear-gradient(135deg, #ed2553, #f43f5e);
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 900;
      font-size: 18px;
      color: #fff;
      box-shadow: 0 4px 12px rgba(237, 37, 83, 0.4);
    }
    .brand-text h1 {
      font-size: 15px;
      font-weight: 800;
      color: #ffffff;
      letter-spacing: -0.2px;
    }
    .brand-text p {
      font-size: 11px;
      color: #10b981;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .brand-text p::before {
      content: "";
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #10b981;
      display: inline-block;
      box-shadow: 0 0 6px #10b981;
    }
    .search-bar {
      padding: 12px 16px;
      background: #12121c;
      border-bottom: 1px solid #202030;
      display: flex;
      gap: 8px;
    }
    .search-input {
      flex: 1;
      background: #1a1a28;
      border: 1px solid #2d2d42;
      border-radius: 12px;
      padding: 10px 14px;
      color: #fff;
      font-size: 13px;
      outline: none;
    }
    .search-input:focus {
      border-color: #ed2553;
    }
    .batch-btn {
      background: linear-gradient(135deg, #ed2553, #e11d48);
      color: #fff;
      border: none;
      border-radius: 12px;
      padding: 10px 14px;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 6px;
      white-space: nowrap;
      box-shadow: 0 4px 12px rgba(237, 37, 83, 0.3);
    }
    .stats-bar {
      padding: 8px 16px;
      font-size: 11px;
      color: #94a3b8;
      display: flex;
      justify-content: space-between;
      border-bottom: 1px solid #1c1c2b;
    }
    .cards-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
      gap: 12px;
      padding: 14px 16px;
    }
    @media (min-width: 600px) {
      .cards-grid {
        grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
        gap: 16px;
        padding: 20px;
      }
    }
    .card {
      background: #161622;
      border: 1px solid #242436;
      border-radius: 14px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      box-shadow: 0 4px 10px rgba(0,0,0,0.3);
      transition: transform 0.15s ease, border-color 0.15s ease;
    }
    .card:active {
      transform: scale(0.98);
      border-color: #ed2553;
    }
    .cover-wrap {
      aspect-ratio: 3/4.2;
      background: #202030;
      position: relative;
      overflow: hidden;
    }
    .cover-img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }
    .badge-pages {
      position: absolute;
      bottom: 6px;
      right: 6px;
      background: rgba(0, 0, 0, 0.8);
      color: #e2e8f0;
      font-size: 10px;
      font-weight: 700;
      padding: 2px 6px;
      border-radius: 6px;
      font-family: monospace;
    }
    .badge-id {
      position: absolute;
      top: 6px;
      left: 6px;
      background: rgba(237, 37, 83, 0.85);
      color: #ffffff;
      font-size: 9px;
      font-weight: 800;
      padding: 2px 6px;
      border-radius: 6px;
      font-family: monospace;
    }
    .card-body {
      padding: 10px;
      display: flex;
      flex-direction: column;
      flex: 1;
      justify-content: space-between;
      gap: 8px;
    }
    .card-title {
      font-size: 12px;
      font-weight: 700;
      color: #f1f5f9;
      line-height: 1.35;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    .card-artist {
      font-size: 10px;
      color: #a855f7;
      font-weight: 600;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .card-meta {
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 10px;
      color: #94a3b8;
      font-mono;
    }
    .btn-download {
      background: #ed2553;
      color: #fff;
      text-decoration: none;
      font-size: 11px;
      font-weight: 700;
      padding: 8px 10px;
      border-radius: 8px;
      text-align: center;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 5px;
      transition: background 0.15s;
    }
    .btn-download:active {
      background: #f43f5e;
    }
    .btn-stream {
      background: #252538;
      color: #38bdf8;
      border: 1px solid #33334d;
      font-size: 11px;
      font-weight: 700;
      padding: 6px 10px;
      border-radius: 8px;
      text-align: center;
      cursor: pointer;
    }
    .empty-state {
      text-align: center;
      padding: 60px 20px;
      color: #94a3b8;
    }
    /* Fullscreen Streaming Reader Modal */
    #readerModal {
      position: fixed;
      inset: 0;
      z-index: 1000;
      background: #08080c;
      display: none;
      flex-direction: column;
    }
    #readerHeader {
      padding: 10px 14px;
      background: rgba(15, 15, 23, 0.95);
      border-bottom: 1px solid #28283a;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    #readerTitle {
      font-size: 12px;
      font-weight: 700;
      color: #fff;
      max-width: 75%;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    #readerClose {
      background: #222232;
      color: #cbd5e1;
      border: none;
      border-radius: 8px;
      padding: 6px 12px;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
    }
    #readerContent {
      flex: 1;
      overflow-y: auto;
      overflow-x: hidden;
      padding: 10px 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
    }
    .reader-page-img {
      max-width: 100%;
      height: auto;
      display: block;
      background: #12121c;
      border-radius: 4px;
    }
  </style>
</head>
<body>
  <header>
    <div class="brand">
      <div class="logo-badge">⚡</div>
      <div class="brand-text">
        <h1>nHentai Quick Share</h1>
        <p>Wi-Fi Gigabit Local (${ip})</p>
      </div>
    </div>
    <button class="batch-btn" onclick="downloadAllZip()">
      📦 Tout Télécharger
    </button>
  </header>

  <div class="search-bar">
    <input
      type="text"
      id="searchInput"
      class="search-input"
      placeholder="Rechercher par titre, artiste, #ID..."
      oninput="filterCards()"
    />
  </div>

  <div class="stats-bar">
    <span id="filesCount">Chargement des mangas...</span>
    <span id="totalSize"></span>
  </div>

  <div id="cardsGrid" class="cards-grid"></div>
  <div id="emptyState" class="empty-state" style="display: none;">
    <h3>Aucun manga téléchargé trouvé sur le PC</h3>
    <p style="font-size: 12px; margin-top: 6px;">Téléchargez des mangas sur l'application PC puis actualisez cette page.</p>
  </div>

  <!-- In-Browser Streaming Reader Modal -->
  <div id="readerModal">
    <div id="readerHeader">
      <div id="readerTitle">Lecture en streaming</div>
      <button id="readerClose" onclick="closeReader()">Fermer ✕</button>
    </div>
    <div id="readerContent"></div>
  </div>

  <script>
    let allFiles = [];

    async function loadFiles() {
      try {
        const res = await fetch('api/files');
        allFiles = await res.json();
        renderCards(allFiles);
      } catch (e) {
        document.getElementById('filesCount').innerText = 'Erreur de connexion avec le PC';
      }
    }

    function renderCards(files) {
      const grid = document.getElementById('cardsGrid');
      const empty = document.getElementById('emptyState');
      grid.innerHTML = '';

      if (!files || files.length === 0) {
        grid.style.display = 'none';
        empty.style.display = 'block';
        document.getElementById('filesCount').innerText = '0 manga disponible';
        document.getElementById('totalSize').innerText = '0 MB';
        return;
      }

      grid.style.display = 'grid';
      empty.style.display = 'none';

      let totalBytes = 0;
      files.forEach(f => { totalBytes += (f.size || 0); });
      document.getElementById('filesCount').innerText = files.length + ' manga' + (files.length > 1 ? 's' : '') + ' prêt' + (files.length > 1 ? 's' : '');
      document.getElementById('totalSize').innerText = (totalBytes / (1024 * 1024)).toFixed(1) + ' MB total';

      files.forEach(f => {
        const encName = encodeURIComponent(f.filename);
        const card = document.createElement('div');
        card.className = 'card';

        const coverWrap = document.createElement('div');
        coverWrap.className = 'cover-wrap';
        const cover = document.createElement('img');
        cover.className = 'cover-img';
        cover.src = 'api/cover/' + encName;
        cover.loading = 'lazy';
        cover.alt = String(f.title || '');
        coverWrap.appendChild(cover);
        if (f.id) {
          const idBadge = document.createElement('div');
          idBadge.className = 'badge-id';
          idBadge.textContent = '#d' + String(f.id);
          coverWrap.appendChild(idBadge);
        }
        const pagesBadge = document.createElement('div');
        pagesBadge.className = 'badge-pages';
        pagesBadge.textContent = String(f.pagesCount || 0) + 'p';
        coverWrap.appendChild(pagesBadge);

        const body = document.createElement('div');
        body.className = 'card-body';
        const metadata = document.createElement('div');
        const title = document.createElement('div');
        title.className = 'card-title';
        title.textContent = String(f.title || '');
        title.title = String(f.title || '');
        metadata.appendChild(title);
        if (f.artist) {
          const artist = document.createElement('div');
          artist.className = 'card-artist';
          artist.textContent = '🎨 ' + String(f.artist);
          metadata.appendChild(artist);
        }

        const meta = document.createElement('div');
        meta.className = 'card-meta';
        const format = String(f.format || '').toUpperCase();
        const formatLabel = document.createElement('span');
        formatLabel.textContent = format;
        const sizeLabel = document.createElement('span');
        sizeLabel.textContent = String(f.sizeFormatted || '');
        meta.append(formatLabel, sizeLabel);

        const actions = document.createElement('div');
        actions.style.cssText = 'display:flex;gap:6px;flex-direction:column';
        const download = document.createElement('a');
        download.className = 'btn-download';
        download.href = 'api/download/' + encName;
        download.download = String(f.filename || '');
        download.textContent = '📥 Télécharger (' + format + ')';
        const stream = document.createElement('button');
        stream.className = 'btn-stream';
        stream.type = 'button';
        stream.textContent = '📖 Lire en direct';
        stream.addEventListener('click', () => openReader(encName, String(f.title || '')));
        actions.append(download, stream);

        body.append(metadata, meta, actions);
        card.append(coverWrap, body);
        grid.appendChild(card);
      });
    }

    function filterCards() {
      const q = document.getElementById('searchInput').value.toLowerCase().trim();
      if (!q) {
        renderCards(allFiles);
        return;
      }
      const filtered = allFiles.filter(f => 
        (f.title && f.title.toLowerCase().includes(q)) ||
        (f.artist && f.artist.toLowerCase().includes(q)) ||
        (f.id && String(f.id).includes(q)) ||
        (f.filename && f.filename.toLowerCase().includes(q))
      );
      renderCards(filtered);
    }

    function downloadAllZip() {
      window.location.href = 'api/batch-zip';
    }

    async function openReader(encFilename, title) {
      const modal = document.getElementById('readerModal');
      const content = document.getElementById('readerContent');
      document.getElementById('readerTitle').innerText = title;
      content.innerHTML = '<div style="padding: 40px; color: #94a3b8; text-align: center;">Chargement des planches HD...</div>';
      modal.style.display = 'flex';

      try {
        const res = await fetch('api/manifest/' + encFilename);
        const manifest = await res.json();
        content.innerHTML = '';
        manifest.pages.forEach((p, idx) => {
          const img = document.createElement('img');
          img.className = 'reader-page-img';
          img.loading = idx < 3 ? 'eager' : 'lazy';
          img.src = 'api/page/' + encFilename + '/' + idx;
          img.alt = 'Page ' + (idx + 1);
          content.appendChild(img);
        });
      } catch (e) {
        content.innerHTML = '<div style="padding: 40px; color: #f43f5e; text-align: center;">Erreur de lecture de l\\'archive</div>';
      }
    }

    function closeReader() {
      document.getElementById('readerModal').style.display = 'none';
      document.getElementById('readerContent').innerHTML = '';
    }

    loadFiles();
  </script>
</body>
</html>`;
}

module.exports = { generateMobileWebClientHtml };
