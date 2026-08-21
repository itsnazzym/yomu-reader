import React, { useState, useEffect } from "react";
import { Icon } from "../common/Icon";
import { QRCodeSvg } from "../common/QRCodeSvg";
import {
  getQuickShareStatus,
  startQuickShareServer,
  stopQuickShareServer,
  getLocalDownloadedFiles,
} from "../../utils/ipc";

interface QuickShareHubModalProps {
  onClose: () => void;
  initialDirectory?: string;
}

interface FileItem {
  id?: number;
  filename: string;
  title: string;
  artist?: string;
  size: number;
  sizeFormatted: string;
  pagesCount: number;
  format: string;
  mtime: number;
}

export const QuickShareHubModal: React.FC<QuickShareHubModalProps> = ({
  onClose,
  initialDirectory,
}) => {
  const [activeTab, setActiveTab] = useState<"qr" | "files" | "guide">("qr");
  const [serverStatus, setServerStatus] = useState<{
    active: boolean;
    port: number;
    ip: string;
    url: string;
    filesCount: number;
    activeTransfers: number;
    uptime: number;
  }>({
    active: false,
    port: 45678,
    ip: "127.0.0.1",
    url: "http://127.0.0.1:45678/",
    filesCount: 0,
    activeTransfers: 0,
    uptime: 0,
  });

  const [files, setFiles] = useState<FileItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [serverError, setServerError] = useState("");
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const refreshStatusAndFiles = async () => {
    try {
      const status = await getQuickShareStatus();
      setServerStatus(status);
      const fileList = await getLocalDownloadedFiles(initialDirectory);
      setFiles(fileList);
    } catch (e) {
      console.warn("Failed to get quick share status:", e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshStatusAndFiles();
    const interval = setInterval(refreshStatusAndFiles, 3000);
    return () => clearInterval(interval);
  }, [initialDirectory]);

  const handleToggleServer = async () => {
    setServerError("");
    try {
      if (serverStatus.active) {
        await stopQuickShareServer();
      } else {
        await startQuickShareServer(serverStatus.port || 45678, initialDirectory);
      }
      await refreshStatusAndFiles();
    } catch (error) {
      setServerError(
        error instanceof Error ? error.message : "Impossible de démarrer Quick Share."
      );
    }
  };

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(serverStatus.url);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    } catch {}
  };

  const filteredFiles = files.filter(
    (f) =>
      f.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (f.artist && f.artist.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (f.id && String(f.id).includes(searchQuery)) ||
      f.filename.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalBytes = files.reduce((acc, f) => acc + (f.size || 0), 0);
  const totalMbFormatted = (totalBytes / (1024 * 1024)).toFixed(1);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-[#13131c] border border-[#262638] rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl shadow-black/80 flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 border-b border-[#232334] bg-linear-to-r from-[#181826] to-[#141420] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-linear-to-br from-[#ed2553] to-[#f43f5e] text-white flex items-center justify-center shadow-lg shadow-[#ed2553]/30">
              <Icon name="wifi_tethering" size={22} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white">
                  Quick Share Wi-Fi Gigabit
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  PC ➔ Android / iOS
                </span>
              </div>
              <p className="text-xs text-gray-400">
                Transférez tous vos mangas CBZ/ZIP à pleine vitesse locale (50-100 Mo/s)
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-gray-400 hover:text-white bg-[#202030] hover:bg-[#2c2c40] transition-colors cursor-pointer"
          >
            <Icon name="close" size={18} />
          </button>
        </div>

        {/* Server Status Bar */}
        <div className="px-5 py-3 bg-[#181826] border-b border-[#222232] flex items-center justify-between flex-wrap gap-2 text-xs">
          <div className="flex items-center gap-2.5">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                serverStatus.active
                  ? "bg-emerald-500 shadow-sm shadow-emerald-500 animate-pulse"
                  : "bg-amber-500"
              }`}
            />
            <span className="font-semibold text-gray-200">
              {serverStatus.active
                ? `Serveur Actif sur http://${serverStatus.ip}:${serverStatus.port}`
                : "Serveur Wi-Fi arrêté"}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleToggleServer}
              className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-all cursor-pointer ${
                serverStatus.active
                  ? "bg-[#252535] hover:bg-[#303045] text-gray-300"
                  : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/30"
              }`}
            >
              {serverStatus.active ? "Arrêter" : "Démarrer Serveur"}
            </button>

            <button
              onClick={handleCopyUrl}
              className={`px-3 py-1.5 rounded-lg font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer ${
                copiedUrl
                  ? "bg-emerald-600 text-white"
                  : "bg-[#ed2553] hover:bg-[#f43f5e] text-white shadow-md shadow-[#ed2553]/20"
              }`}
            >
              <Icon name={copiedUrl ? "check" : "content_copy"} size={14} />
              <span>{copiedUrl ? "IP Copiée !" : "Copier Lien"}</span>
            </button>
          </div>
        </div>
        {serverError && (
          <div className="px-5 py-2 bg-red-500/10 border-b border-red-500/20 text-xs text-red-300">
            {serverError}
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="px-5 pt-3 border-b border-[#202030] flex gap-2">
          <button
            onClick={() => setActiveTab("qr")}
            className={`pb-3 px-3 text-xs font-bold transition-all border-b-2 flex items-center gap-2 cursor-pointer ${
              activeTab === "qr"
                ? "border-[#ed2553] text-white"
                : "border-transparent text-gray-400 hover:text-gray-200"
            }`}
          >
            <Icon name="qr_code_2" size={16} />
            <span>📱 Scanner QR Code (Téléphone)</span>
          </button>

          <button
            onClick={() => setActiveTab("files")}
            className={`pb-3 px-3 text-xs font-bold transition-all border-b-2 flex items-center gap-2 cursor-pointer ${
              activeTab === "files"
                ? "border-[#ed2553] text-white"
                : "border-transparent text-gray-400 hover:text-gray-200"
            }`}
          >
            <Icon name="folder_zip" size={16} />
            <span>📦 Fichiers prêts ({files.length})</span>
          </button>

          <button
            onClick={() => setActiveTab("guide")}
            className={`pb-3 px-3 text-xs font-bold transition-all border-b-2 flex items-center gap-2 cursor-pointer ${
              activeTab === "guide"
                ? "border-[#ed2553] text-white"
                : "border-transparent text-gray-400 hover:text-gray-200"
            }`}
          >
            <Icon name="help_outline" size={16} />
            <span>💡 Comment ça marche ?</span>
          </button>
        </div>

        {/* Content Area */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          {activeTab === "qr" && (
            <div className="flex flex-col md:flex-row items-center gap-6 justify-center py-2 animate-in fade-in duration-150">
              {/* QR Code Container */}
              <div className="p-4 bg-white rounded-3xl shadow-xl shadow-black/50 shrink-0">
                {serverStatus.active && serverStatus.url ? (
                  <QRCodeSvg
                    value={serverStatus.url}
                    size={200}
                    fgColor="#0c0c12"
                    bgColor="#ffffff"
                  />
                ) : (
                  <div className="w-[200px] h-[200px] flex items-center justify-center text-center text-xs font-bold text-gray-500 px-5">
                    Démarrez le serveur pour générer un QR code sécurisé.
                  </div>
                )}
              </div>

              {/* Instructions Side */}
              <div className="space-y-3.5 flex-1 max-w-sm">
                <div className="flex items-start gap-3 p-3 rounded-2xl bg-[#1a1a28] border border-[#29293e]">
                  <div className="w-7 h-7 rounded-xl bg-[#ed2553]/20 text-[#ed2553] font-black flex items-center justify-center text-xs shrink-0 mt-0.5">
                    1
                  </div>
                  <div className="text-xs text-gray-300">
                    <span className="font-bold text-white block">
                      Même réseau Wi-Fi
                    </span>
                    Connectez votre smartphone Android / iPhone au même réseau Wi-Fi que ce PC.
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-2xl bg-[#1a1a28] border border-[#29293e]">
                  <div className="w-7 h-7 rounded-xl bg-cyan-500/20 text-cyan-400 font-black flex items-center justify-center text-xs shrink-0 mt-0.5">
                    2
                  </div>
                  <div className="text-xs text-gray-300">
                    <span className="font-bold text-white block">
                      Scannez le QR Code
                    </span>
                    Ouvrez l'appareil photo de votre téléphone et scannez le code ci-contre.
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-2xl bg-[#1a1a28] border border-[#29293e]">
                  <div className="w-7 h-7 rounded-xl bg-emerald-500/20 text-emerald-400 font-black flex items-center justify-center text-xs shrink-0 mt-0.5">
                    3
                  </div>
                  <div className="text-xs text-gray-300">
                    <span className="font-bold text-white block">
                      Téléchargement Instantané
                    </span>
                    Téléchargez vos mangas CBZ directement dans vos fichiers Android ou lisez-les en direct !
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "files" && (
            <div className="space-y-3 animate-in fade-in duration-150">
              {/* Search & Batch Download Bar */}
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Filtrer par titre, artiste ou ID..."
                    className="w-full bg-[#181826] border border-[#2b2b3e] rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-[#ed2553]"
                  />
                  <div className="absolute left-3 top-2.5 text-gray-500">
                    <Icon name="search" size={15} />
                  </div>
                </div>

                <a
                  href={`${serverStatus.url}api/batch-zip`}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3.5 py-2 rounded-xl bg-linear-to-r from-[#ed2553] to-[#e11d48] hover:from-[#f43f5e] hover:to-[#ed2553] text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-[#ed2553]/25 shrink-0"
                >
                  <Icon name="archive" size={15} />
                  <span>Tout Télécharger ({totalMbFormatted} MB)</span>
                </a>
              </div>

              {/* Files List */}
              {isLoading ? (
                <div className="text-center py-12 text-gray-400 text-xs flex items-center justify-center gap-2">
                  <Icon name="refresh" size={16} className="animate-spin text-[#ed2553]" />
                  <span>Scan des mangas en cours...</span>
                </div>
              ) : filteredFiles.length === 0 ? (
                <div className="text-center py-12 text-gray-400 text-xs">
                  Aucun manga trouvé dans votre dossier de téléchargement.
                </div>
              ) : (
                <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
                  {filteredFiles.map((file) => (
                    <div
                      key={file.filename}
                      className="p-2.5 rounded-2xl bg-[#171724] border border-[#262638] flex items-center justify-between gap-3 hover:border-[#ed2553]/40 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="w-10 h-13 rounded-lg overflow-hidden bg-[#202030] shrink-0 border border-white/5 relative">
                          <img
                            src={`${serverStatus.url}api/cover/${encodeURIComponent(file.filename)}`}
                            alt={file.title}
                            className="w-full h-full object-cover"
                            loading="lazy"
                            onError={(e) => {
                              (e.target as HTMLElement).style.display = "none";
                            }}
                          />
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-bold text-gray-200 truncate">
                            {file.title}
                          </div>
                          <div className="flex items-center gap-2 text-[10px] text-gray-400 mt-0.5 font-mono">
                            {file.id && (
                              <span className="text-[#ed2553] font-bold">
                                #d{file.id}
                              </span>
                            )}
                            {file.artist && (
                              <span className="text-purple-400 truncate max-w-[120px]">
                                🎨 {file.artist}
                              </span>
                            )}
                            <span>•</span>
                            <span>{file.pagesCount}p</span>
                            <span>•</span>
                            <span className="uppercase text-gray-300 font-bold">
                              {file.format}
                            </span>
                            <span>•</span>
                            <span>{file.sizeFormatted}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <a
                          href={`${serverStatus.url}api/download/${encodeURIComponent(file.filename)}`}
                          download={file.filename}
                          className="px-3 py-1.5 rounded-lg bg-[#252538] hover:bg-[#303048] text-cyan-400 hover:text-cyan-300 text-xs font-bold flex items-center gap-1 transition-colors"
                          title="Télécharger directement ce fichier"
                        >
                          <Icon name="download" size={14} />
                          <span>Télécharger</span>
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === "guide" && (
            <div className="space-y-3.5 text-xs text-gray-300 animate-in fade-in duration-150 leading-relaxed">
              <div className="p-4 rounded-2xl bg-[#181826] border border-[#28283c] space-y-2">
                <div className="font-bold text-white text-sm flex items-center gap-2">
                  <Icon name="bolt" size={18} className="text-amber-400" />
                  Transfert Local Ultra-Rapide et 100% Gratuit
                </div>
                <p>
                  Ce système utilise la connexion **Wi-Fi locale directe (Gigabit)** de votre box internet. Vos fichiers ne transitent par aucun serveur cloud ou service payant. Le débit atteint généralement **50 à 100 Mo/s**, permettant de transférer 20 mangas complets en quelques secondes.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="p-3.5 rounded-2xl bg-[#181826] border border-[#28283c] space-y-1">
                  <div className="font-bold text-cyan-400 flex items-center gap-1.5">
                    <Icon name="android" size={16} />
                    Sur Android
                  </div>
                  <p className="text-[11px] text-gray-400">
                    Les fichiers <code className="text-white">.cbz</code> sont enregistrés dans votre dossier <code className="text-white">Téléchargements</code> et peuvent être ouverts directement par n'importe quel lecteur de manga (Tachiyomi, Mihon, Perfect Viewer, Kuro Reader).
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl bg-[#181826] border border-[#28283c] space-y-1">
                  <div className="font-bold text-purple-400 flex items-center gap-1.5">
                    <Icon name="phone_iphone" size={16} />
                    Sur iPhone / iPad
                  </div>
                  <p className="text-[11px] text-gray-400">
                    Ouvrez l'appareil photo, touchez le lien jaune qui s'affiche, puis téléchargez les mangas dans l'application <code className="text-white">Fichiers</code> ou lisez-les en direct dans Safari sans télécharger.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#202030] bg-[#101018] flex items-center justify-between text-xs text-gray-400">
          <div className="flex items-center gap-2 font-mono">
            <span>Adresse :</span>
            <span className="text-emerald-400 font-bold select-all">
              {serverStatus.url}
            </span>
          </div>

          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-[#252535] hover:bg-[#303045] text-white font-bold transition-colors cursor-pointer"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};
