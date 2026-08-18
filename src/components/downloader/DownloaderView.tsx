import React, { useState } from "react";
import { useDownloadStore } from "../../stores/downloadStore";
import { useSettingsStore } from "../../stores/settingsStore";
import { openFolder, getThumbnailUrl, getGalleryDisplayTitle, buildImageFallbacks } from "../../utils/ipc";
import { Icon } from "../common/Icon";
import { SmartImage } from "../common/SmartImage";
import { QuickShareHubModal } from "../share/QuickShareHubModal";

export const DownloaderView: React.FC = () => {
  const { queue, pauseDownload, resumeDownload, cancelItem, retryItem, clearCompleted } =
    useDownloadStore();
  const { settings } = useSettingsStore();
  const [isQuickShareOpen, setIsQuickShareOpen] = useState(false);

  const totalCount = queue.length;
  const activeCount = queue.filter((i) => i.status === "downloading").length;
  const queuedCount = queue.filter((i) => i.status === "queued").length;
  const completedCount = queue.filter((i) => i.status === "completed").length;

  const totalSpeedKbS = queue
    .filter((i) => i.status === "downloading")
    .reduce((acc, curr) => acc + (curr.speed_kb_s || 0), 0);

  const formatSpeed = (kbS: number) => {
    if (kbS >= 1024) return `${(kbS / 1024).toFixed(2)} Mo/s`;
    return `${kbS.toFixed(0)} Ko/s`;
  };

  const handleOpenFolder = (targetPath?: string) => {
    openFolder(targetPath || settings.download_directory);
  };

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-6 select-none">
      {/* Top Header & Global Stats */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Icon name="download" size={24} className="text-[#ed2553]" />
            <span>Gestionnaire de Téléchargements</span>
          </h1>
          <p className="text-xs text-gray-400">
            Suivi en temps réel de vos téléchargements par lot et de vos fichiers CBZ/ZIP.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsQuickShareOpen(true)}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-linear-to-r from-[#ed2553] to-[#e11d48] hover:from-[#f43f5e] hover:to-[#ed2553] text-white text-xs font-bold shadow-md shadow-[#ed2553]/25 transition-all cursor-pointer"
            title="Transférer tous vos fichiers CBZ/ZIP vers Android / iOS en Wi-Fi direct"
          >
            <Icon name="wifi_tethering" size={18} />
            <span>⚡ Quick Share Wi-Fi (Android)</span>
          </button>

          <button
            onClick={() => handleOpenFolder()}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#1a1a26] hover:bg-[#28283a] text-gray-200 text-xs font-semibold border border-[#2d2d40] transition-colors shadow-sm cursor-pointer"
            title="Ouvrir le dossier principal de téléchargement"
          >
            <Icon name="folder_open" size={18} className="text-amber-400" />
            <span>Ouvrir Dossier</span>
          </button>

          {completedCount > 0 && (
            <button
              onClick={clearCompleted}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#1a1a26] hover:bg-red-950/40 text-gray-300 hover:text-red-300 text-xs font-semibold border border-[#2d2d40] hover:border-red-500/30 transition-colors cursor-pointer"
            >
              <Icon name="delete" size={18} />
              <span>Nettoyer terminés</span>
            </button>
          )}
        </div>
      </div>

      {/* Metrics Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-[#14141c] border border-[#242432] rounded-xl p-4 flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-blue-500/10 text-blue-400">
            <Icon name="layers" size={22} />
          </div>
          <div>
            <div className="text-[11px] text-gray-400 font-medium">Total en file</div>
            <div className="text-lg font-extrabold text-white">{totalCount}</div>
          </div>
        </div>

        <div className="bg-[#14141c] border border-[#242432] rounded-xl p-4 flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-amber-500/10 text-amber-400">
            <Icon name="monitoring" size={22} />
          </div>
          <div>
            <div className="text-[11px] text-gray-400 font-medium">En cours / Attente</div>
            <div className="text-lg font-extrabold text-white">
              {activeCount} <span className="text-xs text-gray-400 font-normal">({queuedCount} en attente)</span>
            </div>
          </div>
        </div>

        <div className="bg-[#14141c] border border-[#242432] rounded-xl p-4 flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-400">
            <Icon name="check_circle" size={22} />
          </div>
          <div>
            <div className="text-[11px] text-gray-400 font-medium">Terminés</div>
            <div className="text-lg font-extrabold text-emerald-400">{completedCount}</div>
          </div>
        </div>

        <div className="bg-[#14141c] border border-[#242432] rounded-xl p-4 flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-[#ed2553]/15 text-[#ed2553]">
            <Icon name="speed" size={22} />
          </div>
          <div>
            <div className="text-[11px] text-gray-400 font-medium">Vitesse globale</div>
            <div className="text-lg font-extrabold text-white font-mono">
              {formatSpeed(totalSpeedKbS)}
            </div>
          </div>
        </div>
      </div>

      {/* Queue List */}
      {queue.length === 0 ? (
        <div className="bg-[#14141c] border border-[#242432] rounded-2xl p-12 text-center text-gray-400 space-y-3">
          <Icon name="download_done" size={44} className="mx-auto text-gray-600 opacity-50" />
          <h3 className="text-base font-bold text-gray-300">Aucun téléchargement en cours</h3>
          <p className="text-xs text-gray-500 max-w-sm mx-auto">
            Utilisez l'onglet <strong>Explorer</strong> pour télécharger individuellement ou l'onglet{" "}
            <strong>Téléchargement par Lot</strong> pour télécharger des groupes de hentais.
          </p>
        </div>
      ) : (
        <div className="bg-[#14141c] border border-[#242432] rounded-2xl overflow-hidden shadow-xl divide-y divide-[#222230]">
          {queue.map((item) => {
            const title = getGalleryDisplayTitle(item.gallery);
            const thumbUrl = getThumbnailUrl(item.gallery);
            const mid = item.gallery.media_id || String(item.gallery.id);
            const candidateUrls = buildImageFallbacks(thumbUrl, "thumb", mid);
            const percent = Math.min(100, Math.round((item.progress || 0) * 100));

            return (
              <div
                key={item.id}
                className="p-4 flex flex-col sm:flex-row sm:items-center gap-4 hover:bg-[#191924] transition-colors"
              >
                {/* Thumbnail */}
                <div className="w-12 h-16 rounded-lg bg-[#0d0d12] border border-[#262634] overflow-hidden shrink-0">
                  <SmartImage
                    candidates={candidateUrls}
                    alt={title}
                    className="w-full h-full"
                    imgClassName="w-full h-full object-cover"
                  />
                </div>

                {/* Title & Info */}
                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <h4
                      className="text-xs font-bold text-gray-100 truncate"
                      title={title}
                    >
                      {title}
                    </h4>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-[10px] uppercase font-mono font-bold px-2 py-0.5 rounded bg-[#20202e] text-gray-300 border border-[#313145]">
                        {item.format}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2.5 py-0.5 rounded border flex items-center gap-1.5 ${
                          item.status === "completed"
                            ? "bg-emerald-950/50 text-emerald-300 border-emerald-500/40"
                            : item.status === "downloading"
                            ? percent === 100
                              ? "bg-amber-950/50 text-amber-300 border-amber-500/40 animate-pulse"
                              : "bg-blue-950/50 text-blue-300 border-blue-500/40 animate-pulse"
                            : item.status === "error"
                            ? "bg-red-950/50 text-red-300 border-red-500/40"
                            : "bg-gray-800 text-gray-400 border-gray-700"
                        }`}
                      >
                        {item.status === "completed" && <Icon name="check" size={13} />}
                        {item.status === "downloading" && <Icon name="progress_activity" size={13} className="animate-spin" />}
                        {item.status === "error" && <Icon name="error" size={13} />}
                        <span>
                          {item.status === "completed"
                            ? "Terminé"
                            : item.status === "downloading"
                            ? percent === 100
                              ? "Création de l'archive..."
                              : `Planches (${item.downloaded_pages}/${item.total_pages})`
                            : item.status === "queued"
                            ? "En attente"
                            : item.status === "paused"
                            ? "En pause"
                            : item.status === "cancelled"
                            ? "Annulé"
                            : "Erreur"}
                        </span>
                      </span>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full h-2.5 bg-[#0c0c10] rounded-full overflow-hidden border border-[#242432]">
                    <div
                      className={`h-full transition-all duration-300 ${
                        item.status === "completed"
                          ? "bg-emerald-500 shadow-md shadow-emerald-500/30"
                          : item.status === "error"
                          ? "bg-red-500 shadow-md shadow-red-500/30"
                          : percent === 100
                          ? "bg-amber-500 shadow-md shadow-amber-500/30"
                          : "bg-gradient-to-r from-[#ed2553] via-[#ff4e76] to-[#ed2553] shadow-md shadow-[#ed2553]/30"
                      }`}
                      style={{ width: `${percent}%` }}
                    />
                  </div>

                  {/* Stats Row with ETA */}
                  <div className="flex items-center justify-between text-[11px] text-gray-400">
                    <div className="flex items-center gap-2">
                      <span className="font-mono">
                        {item.downloaded_pages} / {item.total_pages} pages ({percent}%)
                      </span>
                      {item.status === "downloading" && item.speed_kb_s > 0 && item.downloaded_pages < item.total_pages && (
                        <span className="text-gray-400 font-mono text-[10px] bg-[#1d1d28] px-1.5 py-0.5 rounded border border-[#2b2b3b]">
                          ⏱️ ~{Math.max(1, Math.ceil(((item.total_pages - item.downloaded_pages) * 1200) / item.speed_kb_s))}s rest.
                        </span>
                      )}
                      {item.error_message && (
                        <span className="text-red-400 ml-1 font-medium">({item.error_message})</span>
                      )}
                    </div>
                    {item.status === "downloading" && item.speed_kb_s > 0 && (
                      <span className="font-mono text-gray-200 font-semibold flex items-center gap-1">
                        <Icon name="speed" size={13} className="text-[#ed2553]" />
                        <span>{formatSpeed(item.speed_kb_s)}</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                  {item.status === "downloading" && (
                    <button
                      onClick={() => pauseDownload(item.id)}
                      className="p-2 rounded-lg bg-[#222230] hover:bg-[#2e2e42] text-gray-300 hover:text-amber-400 transition-colors cursor-pointer"
                      title="Mettre en pause"
                    >
                      <Icon name="pause" size={18} />
                    </button>
                  )}

                  {item.status === "paused" && (
                    <button
                      onClick={() => resumeDownload(item.id)}
                      className="p-2 rounded-lg bg-[#222230] hover:bg-[#2e2e42] text-gray-300 hover:text-emerald-400 transition-colors cursor-pointer"
                      title="Reprendre"
                    >
                      <Icon name="play_arrow" size={18} />
                    </button>
                  )}

                  {(item.status === "error" || item.status === "cancelled") && (
                    <button
                      onClick={() => retryItem(item.id)}
                      className="p-2 rounded-lg bg-[#222230] hover:bg-[#2e2e42] text-gray-300 hover:text-[#ed2553] transition-colors cursor-pointer"
                      title="Réessayer"
                    >
                      <Icon name="refresh" size={18} />
                    </button>
                  )}

                  {item.status === "completed" && (
                    <button
                      onClick={() => handleOpenFolder(item.target_path)}
                      className="p-2 rounded-lg bg-[#222230] hover:bg-[#2e2e42] text-gray-300 hover:text-cyan-400 transition-colors cursor-pointer"
                      title="Afficher dans l'Explorateur Windows"
                    >
                      <Icon name="folder_open" size={18} />
                    </button>
                  )}

                  <button
                    onClick={() => cancelItem(item.id)}
                    className="p-2 rounded-lg bg-[#222230] hover:bg-red-950/50 text-gray-400 hover:text-red-400 transition-colors cursor-pointer"
                    title="Supprimer de la liste"
                  >
                    <Icon name="cancel" size={18} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {isQuickShareOpen && (
        <QuickShareHubModal
          onClose={() => setIsQuickShareOpen(false)}
          initialDirectory={settings.download_directory}
        />
      )}
    </div>
  );
};
