import React from "react";
import { useHistoryStore, ReadingHistoryItem } from "../../stores/historyStore";
import { Icon } from "../common/Icon";

interface HistoryViewProps {
  onOpenOnlineReader?: (galleryId: number, initialPage: number) => void;
  onOpenLocalReader?: (filePath: string) => void;
}

export const HistoryView: React.FC<HistoryViewProps> = ({
  onOpenOnlineReader,
  onOpenLocalReader,
}) => {
  const { history, removeHistoryItem, clearHistory } = useHistoryStore();

  const timeAgo = (epoch: number) => {
    if (!epoch) return "";
    const diffSec = Math.floor((Date.now() - epoch) / 1000);
    if (diffSec < 60) return "À l'instant";
    const minutes = Math.floor(diffSec / 60);
    if (minutes < 60) return `il y a ${minutes} min`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `il y a ${hours} h`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `il y a ${days} j`;
    const months = Math.floor(days / 30);
    return `il y a ${months} mois`;
  };

  const handleResume = (item: ReadingHistoryItem) => {
    if (item.isLocal && item.filePath && onOpenLocalReader) {
      onOpenLocalReader(item.filePath);
    } else if (onOpenOnlineReader && !item.sourceUnavailable) {
      const numericId = Number.parseInt(String(item.id).split(":").pop() || "", 10);
      if (Number.isFinite(numericId) && numericId > 0) {
        onOpenOnlineReader(numericId, item.lastReadPage);
      }
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto px-4 py-6">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-[#252532]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
            <Icon name="history" size={24} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <span>Historique de Lecture</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-[#2a2a38] text-cyan-300 font-mono">
                {history.length}
              </span>
            </h1>
            <p className="text-xs text-gray-400">Reprenez instantanément votre lecture là où vous vous étiez arrêté</p>
          </div>
        </div>

        {history.length > 0 && (
          <button
            onClick={() => {
              if (window.confirm("Êtes-vous sûr de vouloir effacer tout l'historique ?")) {
                clearHistory();
              }
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-950/30 hover:bg-rose-900/50 text-rose-300 text-xs font-semibold border border-rose-800/40 transition-colors cursor-pointer"
            title="Effacer l'historique"
          >
            <Icon name="delete_sweep" size={16} />
            <span>Effacer l'historique</span>
          </button>
        )}
      </div>

      {/* History List */}
      {history.length === 0 ? (
        <div className="py-20 text-center space-y-3">
          <div className="w-16 h-16 rounded-full bg-[#20202c] border border-[#303040] mx-auto flex items-center justify-center text-gray-500">
            <Icon name="history_toggle_off" size={32} />
          </div>
          <h3 className="text-sm font-bold text-gray-300">Aucun historique de lecture</h3>
          <p className="text-xs text-gray-500 max-w-sm mx-auto">
            Dès que vous commencez à lire un manga, votre progression s'enregistre automatiquement ici.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {history.map((item) => {
            const pageNum = item.lastReadPage + 1;
            const progressPct = Math.round((pageNum / (item.totalPages || 1)) * 100);
            const isFinished = pageNum >= item.totalPages;

            return (
              <div
                key={item.id}
                className="p-3.5 bg-[#1a1a24] hover:bg-[#1f1f2c] rounded-xl border border-[#28283a] flex items-center justify-between gap-4 transition-all group"
              >
                {/* Left: Thumbnail & Info */}
                <div className="flex items-center gap-3.5 min-w-0 flex-1">
                  <div className="w-12 h-16 rounded-lg bg-[#252536] border border-white/10 overflow-hidden shrink-0 flex items-center justify-center relative shadow-md">
                    {item.coverUrl ? (
                      <img src={item.coverUrl} alt={item.title} className="w-full h-full object-cover" />
                    ) : (
                      <Icon name="auto_stories" size={20} className="text-gray-500" />
                    )}
                    {item.isLocal && (
                      <div className="absolute top-0.5 right-0.5 px-1 rounded bg-amber-500 text-[8px] font-bold text-black uppercase">
                        CBZ
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1 space-y-1">
                    <h4
                      className="text-xs font-bold text-gray-200 group-hover:text-white truncate cursor-pointer"
                      title={item.title}
                      onClick={() => handleResume(item)}
                    >
                      {item.title}
                    </h4>

                    <div className="flex items-center gap-3 text-[11px] text-gray-400">
                      <span className="flex items-center gap-1 font-mono">
                        <Icon name="auto_stories" size={13} className="text-rose-400" />
                        <span>Page {pageNum} / {item.totalPages}</span>
                      </span>

                      <span className="text-gray-600">•</span>

                      <span className="font-mono text-gray-500">{timeAgo(item.lastReadAt)}</span>

                      {isFinished && (
                        <span className="px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">
                          Terminé
                        </span>
                      )}
                    </div>

                    {/* Progress Bar */}
                    <div className="w-48 max-w-full h-1.5 bg-[#252536] rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all ${
                          isFinished ? "bg-emerald-500" : "bg-[#ed2553]"
                        }`}
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Right: Resume Button & Delete */}
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleResume(item)}
                    className="px-3.5 py-2 rounded-lg bg-[#ed2553] hover:bg-[#f43f5e] text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-[#ed2553]/20 transition-all cursor-pointer"
                  >
                    <Icon name="play_arrow" size={16} />
                    <span>Reprendre (P.{pageNum})</span>
                  </button>

                  <button
                    onClick={() => removeHistoryItem(item.id)}
                    className="p-2 rounded-lg text-gray-500 hover:text-rose-400 hover:bg-[#252536] transition-colors cursor-pointer"
                    title="Supprimer de l'historique"
                  >
                    <Icon name="close" size={16} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
