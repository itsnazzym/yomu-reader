import React, { useState, useEffect } from "react";
import { DownloadFormat } from "../../types";
import { useSettingsStore } from "../../stores/settingsStore";
import {
  selectDownloadDirectory,
  formatFilenamePreview,
  openAuthWindow,
  onCookiesCaptured,
} from "../../utils/ipc";
import { Icon } from "../common/Icon";

export const SettingsView: React.FC = () => {
  const {
    settings,
    updateSettings,
    addBlacklistedTag,
    removeBlacklistedTag,
  } = useSettingsStore();

  const [namingPattern, setNamingPattern] = useState(settings.naming_pattern);
  const [previewName, setPreviewName] = useState("");
  const [newBlacklistTag, setNewBlacklistTag] = useState("");
  const [cookieInput, setCookieInput] = useState(settings.cookies || "");
  const [apiKeyInput, setApiKeyInput] = useState(settings.api_key || "");
  const [isSavedNotice, setIsSavedNotice] = useState(false);

  const sampleGallery = {
    id: 482910,
    media_id: "2749102",
    title: {
      pretty: "Koyoi no Mahou",
      english: "[Matsumoto] Koyoi no Mahou [English]",
      japanese: "[松本] 今宵の魔法",
    },
    images: {
      cover: { t: "j" as const, w: 350, h: 500 },
      thumbnail: { t: "j" as const, w: 250, h: 350 },
      pages: Array.from({ length: 24 }, () => ({ t: "j" as const, w: 1200, h: 1800 })),
    },
    num_pages: 24,
    num_favorites: 3500,
    upload_date: 1700000000,
    tags: [
      { id: 1, type: "artist" as const, name: "matsumoto", url: "", count: 50 },
      { id: 2, type: "language" as const, name: "english", url: "", count: 100000 },
      { id: 3, type: "category" as const, name: "doujinshi", url: "", count: 200000 },
      { id: 4, type: "parody" as const, name: "original", url: "", count: 150000 },
      { id: 5, type: "character" as const, name: "rem", url: "", count: 8000 },
      { id: 6, type: "group" as const, name: "studio matsu", url: "", count: 12000 },
    ],
  };

  useEffect(() => {
    formatFilenamePreview(namingPattern, sampleGallery).then((res) => {
      setPreviewName(`${res}.${settings.default_format || "cbz"}`);
    });
  }, [namingPattern, settings.default_format]);

  useEffect(() => {
    const unlisten = onCookiesCaptured((cookies: string) => {
      setCookieInput(cookies);
      updateSettings({ cookies });
      triggerSaved();
    });
    return () => unlisten();
  }, []);

  const triggerSaved = () => {
    setIsSavedNotice(true);
    setTimeout(() => setIsSavedNotice(false), 2000);
  };

  const handlePickDirectory = async () => {
    const picked = await selectDownloadDirectory();
    if (picked) {
      updateSettings({ download_directory: picked });
      triggerSaved();
    }
  };

  const handleInsertToken = (token: string) => {
    const updated = `${namingPattern} ${token}`.trim();
    setNamingPattern(updated);
    updateSettings({ naming_pattern: updated });
    triggerSaved();
  };

  const handleResetPattern = () => {
    const defaultPattern = "[{id}] [{artist}] {title} ({language})";
    setNamingPattern(defaultPattern);
    updateSettings({ naming_pattern: defaultPattern });
    triggerSaved();
  };

  const handleAddBlacklist = () => {
    if (newBlacklistTag.trim()) {
      addBlacklistedTag(newBlacklistTag);
      setNewBlacklistTag("");
      triggerSaved();
    }
  };

  const tokenOptions = [
    { token: "{id}", label: "ID (ex: 482910)" },
    { token: "{artist}", label: "Artiste (ex: Matsumoto)" },
    { token: "{title}", label: "Titre (ex: Koyoi no Mahou)" },
    { token: "{language}", label: "Langue (ex: english)" },
    { token: "{pages}", label: "Pages (ex: 24)" },
    { token: "{group}", label: "Groupe (ex: Studio Matsu)" },
    { token: "{parody}", label: "Parodie (ex: Original)" },
    { token: "{character}", label: "Personnage (ex: Rem)" },
    { token: "{category}", label: "Catégorie (ex: Doujinshi)" },
  ];

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-8 select-none">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-[#ed2553]/15 text-[#ed2553] border border-[#ed2553]/30">
            <Icon name="settings" size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Paramètres de l'Application</h1>
            <p className="text-xs text-gray-400">
              Personnalisez les dossiers de sortie, les modèles de nommage de fichiers et votre session nHentai.
            </p>
          </div>
        </div>

        {isSavedNotice && (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 text-xs font-semibold animate-in fade-in duration-200">
            <Icon name="check" size={16} />
            <span>Enregistré !</span>
          </div>
        )}
      </div>

      <div className="space-y-6">
        {/* Section 1: Download Folder */}
        <div className="bg-[#15151e] border border-[#262636] rounded-2xl p-6 space-y-3 shadow-lg">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold uppercase tracking-wider text-gray-300 flex items-center gap-2">
              <Icon name="folder_open" size={18} className="text-amber-400" />
              <span>Dossier de Téléchargement par Défaut</span>
            </label>
          </div>

          <div className="flex items-center gap-3">
            <input
              type="text"
              value={settings.download_directory}
              onChange={(e) => {
                updateSettings({ download_directory: e.target.value });
                triggerSaved();
              }}
              className="flex-1 bg-[#0d0d12] border border-[#2b2b3b] focus:border-[#ed2553] text-xs text-gray-200 px-3.5 py-2.5 rounded-xl outline-none font-mono"
            />
            <button
              onClick={handlePickDirectory}
              className="px-4 py-2.5 rounded-xl bg-[#222230] hover:bg-[#2d2d40] text-gray-200 text-xs font-semibold border border-[#343446] transition-colors cursor-pointer"
            >
              Parcourir...
            </button>
          </div>
        </div>

        {/* Section 2: Filename Template */}
        <div className="bg-[#15151e] border border-[#262636] rounded-2xl p-6 space-y-4 shadow-lg">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold uppercase tracking-wider text-gray-300 flex items-center gap-2">
              <Icon name="code" size={18} className="text-cyan-400" />
              <span>Modèle de Nom de Fichier Personnalisé</span>
            </label>
            <button
              onClick={handleResetPattern}
              className="flex items-center gap-1 text-[11px] text-gray-400 hover:text-gray-200 cursor-pointer"
            >
              <Icon name="restart_alt" size={15} />
              <span>Réinitialiser</span>
            </button>
          </div>

          <input
            type="text"
            value={namingPattern}
            onChange={(e) => {
              setNamingPattern(e.target.value);
              updateSettings({ naming_pattern: e.target.value });
              triggerSaved();
            }}
            className="w-full bg-[#0d0d12] border border-[#2b2b3b] focus:border-[#ed2553] text-xs text-gray-200 px-3.5 py-2.5 rounded-xl outline-none font-mono"
          />

          {/* Tokens chips to click */}
          <div className="space-y-1.5">
            <span className="text-[11px] text-gray-500 font-medium">Insérer une balise :</span>
            <div className="flex flex-wrap gap-1.5">
              {tokenOptions.map((tok) => (
                <button
                  key={tok.token}
                  onClick={() => handleInsertToken(tok.token)}
                  className="px-2.5 py-1 rounded-lg bg-[#1c1c28] hover:bg-[#282838] text-gray-300 hover:text-[#ed2553] text-xs font-mono border border-[#2c2c3e] transition-colors cursor-pointer"
                  title={tok.label}
                >
                  +{tok.token}
                </button>
              ))}
            </div>
          </div>

          {/* Live Preview Box */}
          <div className="p-3.5 bg-[#0e0e14] border border-[#242432] rounded-xl flex items-center gap-3">
            <Icon name="auto_awesome" size={18} className="text-[#ed2553] shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-[10px] text-gray-500 uppercase font-semibold">Exemple généré en direct :</div>
              <div className="text-xs text-emerald-400 font-mono truncate">{previewName}</div>
            </div>
          </div>
        </div>

        {/* Section 3: Default Format & Concurrency */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {/* Format */}
          <div className="bg-[#15151e] border border-[#262636] rounded-2xl p-6 space-y-3 shadow-lg">
            <label className="text-xs font-bold uppercase tracking-wider text-gray-300">
              Format d'Export par Défaut
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(["cbz", "zip", "folder"] as DownloadFormat[]).map((fmt) => (
                <button
                  key={fmt}
                  onClick={() => {
                    updateSettings({ default_format: fmt });
                    triggerSaved();
                  }}
                  className={`py-2 rounded-xl text-xs font-bold uppercase transition-all border cursor-pointer ${
                    settings.default_format === fmt
                      ? "bg-[#ed2553] text-white border-transparent shadow-md shadow-[#ed2553]/20"
                      : "bg-[#191924] text-gray-400 border-[#2b2b3d] hover:text-white"
                  }`}
                >
                  {fmt}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-gray-500">
              Le format <strong>CBZ</strong> intègre automatiquement les métadonnées pour Komga, Kavita et Mihon.
            </p>
          </div>

          {/* Max Concurrent Downloads */}
          <div className="bg-[#15151e] border border-[#262636] rounded-2xl p-6 space-y-3 shadow-lg">
            <label className="text-xs font-bold uppercase tracking-wider text-gray-300">
              Téléchargements Simultanés
            </label>
            <div className="flex items-center gap-2">
              {[1, 2, 3, 4, 5].map((num) => (
                <button
                  key={num}
                  onClick={() => {
                    updateSettings({ concurrent_downloads: num });
                    triggerSaved();
                  }}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all border cursor-pointer ${
                    (settings.concurrent_downloads || 2) === num
                      ? "bg-[#ed2553] text-white border-transparent shadow-md shadow-[#ed2553]/20"
                      : "bg-[#191924] text-gray-400 border-[#2b2b3d] hover:text-white"
                  }`}
                >
                  {num}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-gray-500">
              2 à 3 simultanés recommandés pour éviter les limitations de débit par IP.
            </p>
          </div>
        </div>

        {/* Section 4: Global Tag Blacklist */}
        <div className="bg-[#15151e] border border-[#262636] rounded-2xl p-6 space-y-4 shadow-lg">
          <label className="text-xs font-bold uppercase tracking-wider text-gray-300 flex items-center gap-2">
            <Icon name="shield" size={18} className="text-red-400" />
            <span>Blacklist Globale de Tags (Toujours Exclus)</span>
          </label>

          <div className="flex items-center gap-2">
            <input
              type="text"
              value={newBlacklistTag}
              onChange={(e) => setNewBlacklistTag(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAddBlacklist();
              }}
              placeholder="Tag à bannir de toutes les recherches (ex: 'guro', 'scat')..."
              className="flex-1 bg-[#0d0d12] border border-[#2b2b3b] focus:border-red-500 text-xs text-gray-200 px-3.5 py-2.5 rounded-xl outline-none"
            />
            <button
              onClick={handleAddBlacklist}
              className="px-4 py-2.5 rounded-xl bg-red-950/40 hover:bg-red-900/50 text-red-300 border border-red-500/40 text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              <Icon name="add" size={16} />
              <span>Bannir</span>
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            {settings.blacklisted_tags?.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-red-950/40 text-red-300 border border-red-500/30"
              >
                <span>{tag}</span>
                <button
                  onClick={() => {
                    removeBlacklistedTag(tag);
                    triggerSaved();
                  }}
                  className="hover:text-white font-bold ml-1 cursor-pointer"
                >
                  <Icon name="close" size={14} />
                </button>
              </span>
            ))}
          </div>
        </div>

        {/* Section 5: Cloudflare & Cookies Session */}
        <div className="bg-[#15151e] border border-[#262636] rounded-2xl p-6 space-y-4 shadow-lg">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold uppercase tracking-wider text-gray-300 flex items-center gap-2">
              <Icon name="vpn_key" size={18} className="text-[#ed2553]" />
              <span>Session nHentai & Contournement Cloudflare</span>
            </label>
            <button
              onClick={() => openAuthWindow()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#ed2553] hover:bg-[#ff3b69] text-white text-xs font-bold shadow-md shadow-[#ed2553]/20 transition-all cursor-pointer"
            >
              <Icon name="open_in_new" size={15} />
              <span>Ouvrir Fenêtre de Connexion</span>
            </button>
          </div>

          <p className="text-xs text-gray-400">
            La fenêtre de connexion permet de vous connecter à votre compte et de résoudre le Turnstile Cloudflare automatiquement. Vos cookies de session seront automatiquement capturés.
          </p>

          <div>
            <textarea
              rows={2}
              value={cookieInput}
              onChange={(e) => {
                setCookieInput(e.target.value);
                updateSettings({ cookies: e.target.value });
                triggerSaved();
              }}
              placeholder="Cookies de session (ex: sessionid=...; cf_clearance=...; csrftoken=...)"
              className="w-full bg-[#0d0d12] border border-[#2b2b3b] focus:border-[#ed2553] text-xs text-gray-300 p-3 rounded-xl outline-none font-mono resize-none"
            />
          </div>
        </div>

        {/* Section 6: API Key & Custom Authentication */}
        <div className="bg-[#15151e] border border-[#262636] rounded-2xl p-6 space-y-4 shadow-lg">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold uppercase tracking-wider text-gray-300 flex items-center gap-2">
              <Icon name="key" size={18} className="text-cyan-400" />
              <span>Clé API / Token d'Accès nHentai (Optionnel)</span>
            </label>
          </div>

          <p className="text-xs text-gray-400">
            Si vous possédez une clé API, un token personnel ou une clé de proxy/miroir nHentai, collez-le ici. Il sera injecté automatiquement dans les en-têtes d'autorisation (<code>Authorization: Bearer</code> et <code>X-API-Key</code>).
          </p>

          <input
            type="password"
            value={apiKeyInput}
            onChange={(e) => {
              setApiKeyInput(e.target.value);
              updateSettings({ api_key: e.target.value });
              triggerSaved();
            }}
            placeholder="Ex: nh_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
            className="w-full bg-[#0d0d12] border border-[#2b2b3b] focus:border-cyan-500 text-xs text-cyan-300 px-3.5 py-2.5 rounded-xl outline-none font-mono"
          />
        </div>
      </div>
    </div>
  );
};
