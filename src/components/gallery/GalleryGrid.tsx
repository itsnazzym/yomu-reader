import React from "react";
import { Gallery, SortOption } from "../../types";
import { GalleryCard } from "./GalleryCard";
import { Icon } from "../common/Icon";

interface GalleryGridProps {
  galleries: Gallery[];
  isLoading: boolean;
  error: string | null;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onSelectGallery: (gallery: Gallery) => void;
  onReadGallery?: (gallery: Gallery) => void;
  onQuickDownload?: (gallery: Gallery) => void;
  queuedIds: Set<number>;
  onRetry: () => void;
  sort: SortOption;
  onSortChange: (sort: SortOption) => void;
  currentSearchQuery?: string;
  selectedLanguage?: string;
}

export const GalleryGrid: React.FC<GalleryGridProps> = ({
  galleries,
  isLoading,
  error,
  page,
  totalPages,
  onPageChange,
  onSelectGallery,
  onReadGallery,
  onQuickDownload,
  queuedIds,
  onRetry,
  sort,
  onSortChange,
  currentSearchQuery,
  selectedLanguage = "all",
}) => {
  const getLanguageDisplayName = (l: string) => {
    switch (l) {
      case "french": return "français";
      case "english": return "english";
      case "japanese": return "japanese";
      case "spanish": return "español";
      case "italian": return "italiano";
      case "portuguese": return "português";
      case "russian": return "русский";
      default: return "";
    }
  };

  const langLabel = getLanguageDisplayName(selectedLanguage);

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6 select-none">
      {/* 3hentai Style Header Section */}
      <div className="flex flex-col items-center justify-center space-y-3 pb-2 border-b border-[#23232c]">
        {/* Title */}
        <div className="flex items-center gap-2">
          {currentSearchQuery ? (
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <Icon name="search" size={22} className="text-rose-400" />
              <span>Recherche :</span>
              <span className="text-[#ed2553] font-mono">{currentSearchQuery}</span>
            </h1>
          ) : langLabel ? (
            <div className="flex items-center gap-2 text-xl font-bold text-white">
              <Icon name="language" size={22} className="text-rose-400" />
              <span>Langue</span>
              <span className="px-2.5 py-0.5 rounded text-xs font-semibold bg-[#2a2a36] text-gray-200 border border-[#383848]">
                {langLabel}
              </span>
            </div>
          ) : (
            <h1 className="text-xl font-bold text-white flex items-center gap-2">
              <Icon name="auto_stories" size={22} className="text-rose-400" />
              <span>Dernières Publications</span>
            </h1>
          )}
        </div>

        {/* Sorting Filter Toolbar */}
        <div className="flex flex-wrap items-center justify-center gap-4 text-xs">
          <button
            onClick={() => onSortChange("date")}
            className={`px-4 py-1.5 rounded-md font-semibold transition-all cursor-pointer ${
              sort === "date"
                ? "bg-[#333342] text-white border border-[#444456] shadow-sm"
                : "text-gray-400 hover:text-gray-200 hover:bg-[#202028]"
            }`}
          >
            Les plus récentes
          </button>

          <div className="flex items-center gap-3 text-gray-400">
            <span className="font-semibold text-gray-500">Popularité :</span>
            <button
              onClick={() => onSortChange("popular-today")}
              className={`transition-colors font-medium cursor-pointer ${
                sort === "popular-today"
                  ? "text-[#ed2553] font-bold underline underline-offset-4"
                  : "hover:text-white"
              }`}
            >
              1 journée
            </button>
            <button
              onClick={() => onSortChange("popular-week")}
              className={`transition-colors font-medium cursor-pointer ${
                sort === "popular-week"
                  ? "text-[#ed2553] font-bold underline underline-offset-4"
                  : "hover:text-white"
              }`}
            >
              1 semaine
            </button>
            <button
              onClick={() => onSortChange("popular")}
              className={`transition-colors font-medium cursor-pointer ${
                sort === "popular"
                  ? "text-[#ed2553] font-bold underline underline-offset-4"
                  : "hover:text-white"
              }`}
            >
              toujours
            </button>
          </div>
        </div>
      </div>

      {/* Content Area */}
      {isLoading ? (
        /* Loading Skeletons */
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {Array.from({ length: 15 }).map((_, i) => (
            <div key={i} className="animate-pulse space-y-2">
              <div className="aspect-[3/4.3] bg-[#22222c] rounded-md" />
              <div className="h-3 bg-[#22222c] rounded w-3/4" />
              <div className="h-3 bg-[#22222c] rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : error ? (
        /* Error Box */
        <div className="bg-[#1c1418] border border-rose-900/40 rounded-xl p-8 text-center max-w-lg mx-auto space-y-4 my-8 shadow-xl">
          <Icon name="warning" size={40} className="text-rose-500 mx-auto" />
          <h3 className="text-base font-bold text-white">Erreur de chargement</h3>
          <p className="text-xs text-rose-300 font-mono">{error}</p>
          <button
            onClick={onRetry}
            className="px-4 py-2 bg-[#ed2553] hover:bg-[#f43f5e] text-white rounded-md text-xs font-bold transition-colors cursor-pointer"
          >
            Réessayer
          </button>
        </div>
      ) : galleries.length === 0 ? (
        /* Empty State */
        <div className="py-16 text-center text-gray-400 space-y-2">
          <Icon name="search_off" size={40} className="mx-auto text-gray-600" />
          <h3 className="text-base font-bold text-gray-300">Aucun résultat trouvé</h3>
          <p className="text-xs text-gray-500">Essayez de modifier votre recherche ou vos filtres.</p>
        </div>
      ) : (
        /* Galleries Grid */
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {galleries.map((gallery) => (
            <GalleryCard
              key={gallery.id}
              gallery={gallery}
              onSelect={onSelectGallery}
              onRead={onReadGallery}
              onQuickDownload={onQuickDownload}
              isQueued={queuedIds.has(gallery.id)}
            />
          ))}
        </div>
      )}

      {/* Pagination Bar */}
      {!isLoading && !error && totalPages > 1 && (
        <div className="pt-8 pb-12 flex items-center justify-center gap-1.5 text-xs">
          <button
            onClick={() => onPageChange(Math.max(1, page - 1))}
            disabled={page === 1}
            className="px-3 py-1.5 rounded bg-[#242430] hover:bg-[#323240] text-gray-200 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
          >
            «
          </button>

          {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
            let pageNum = i + 1;
            if (totalPages > 7) {
              if (page <= 4) pageNum = i + 1;
              else if (page >= totalPages - 3) pageNum = totalPages - 6 + i;
              else pageNum = page - 3 + i;
            }
            return (
              <button
                key={pageNum}
                onClick={() => onPageChange(pageNum)}
                className={`px-3 py-1.5 rounded font-bold transition-all cursor-pointer ${
                  page === pageNum
                    ? "bg-[#ed2553] text-white shadow-sm"
                    : "bg-[#242430] hover:bg-[#323240] text-gray-300"
                }`}
              >
                {pageNum}
              </button>
            );
          })}

          <button
            onClick={() => onPageChange(Math.min(totalPages, page + 1))}
            disabled={page === totalPages}
            className="px-3 py-1.5 rounded bg-[#242430] hover:bg-[#323240] text-gray-200 disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
          >
            »
          </button>
        </div>
      )}
    </div>
  );
};
