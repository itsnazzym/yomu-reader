import React, { useState } from "react";
import { Gallery, SortOption, Tag } from "../../types";
import { GalleryCard } from "./GalleryCard";
import { GalleryListItem } from "./GalleryListItem";
import { Icon } from "../common/Icon";

export type ViewMode = "comfort" | "dense" | "list";

interface GalleryGridProps {
  galleries: Gallery[];
  isLoading: boolean;
  error: string | null;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  onSelectGallery: (gallery: Gallery) => void;
  onReadGallery?: (gallery: Gallery, initialPage?: number) => void;
  onQuickDownload?: (gallery: Gallery) => void;
  onTagClick?: (tag: Tag | string) => void;
  queuedIds: Set<number>;
  onRetry: () => void;
  sort: SortOption;
  onSortChange: (sort: SortOption) => void;
  currentSearchQuery?: string;
  selectedLanguage?: string;
}

const VIEW_MODE_STORAGE_KEY = "nhentai_view_mode";

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
  onTagClick,
  queuedIds,
  onRetry,
  sort,
  onSortChange,
  currentSearchQuery,
  selectedLanguage = "english",
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    try {
      const saved = localStorage.getItem(VIEW_MODE_STORAGE_KEY);
      return (saved as ViewMode) || "comfort";
    } catch {
      return "comfort";
    }
  });

  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode);
    try {
      localStorage.setItem(VIEW_MODE_STORAGE_KEY, mode);
    } catch {}
  };

  const getLanguageDisplayName = (l: string) => {
    switch (l) {
      case "french": return "Français";
      case "english": return "English";
      case "japanese": return "日本語 (Japanese)";
      case "spanish": return "Español";
      case "chinese": return "中文 (Chinese)";
      case "italian": return "Italiano";
      case "portuguese": return "Português";
      case "russian": return "Русский";
      default: return "";
    }
  };

  const langLabel = getLanguageDisplayName(selectedLanguage);

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6 select-none">
      {/* NHApp Style Control Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-[#232332]">
        {/* Left: Title & Active Context */}
        <div className="flex items-center gap-3">
          {currentSearchQuery ? (
            <div>
              <h1 className="text-lg font-bold text-white flex items-center gap-2">
                <Icon name="search" size={20} className="text-[#ed2553]" />
                <span>Résultats :</span>
                <span className="text-[#ed2553] font-mono">{currentSearchQuery}</span>
              </h1>
              <p className="text-xs text-gray-400">Page {page} sur {totalPages}</p>
            </div>
          ) : langLabel ? (
            <div>
              <h1 className="text-lg font-bold text-white flex items-center gap-2">
                <Icon name="language" size={20} className="text-[#ed2553]" />
                <span>Flux {langLabel}</span>
              </h1>
              <p className="text-xs text-gray-400">Page {page} sur {totalPages}</p>
            </div>
          ) : (
            <div>
              <h1 className="text-lg font-bold text-white flex items-center gap-2">
                <Icon name="auto_stories" size={20} className="text-[#ed2553]" />
                <span>Dernières Sorties</span>
              </h1>
              <p className="text-xs text-gray-400">Flux d'actualités en direct nHentai • Page {page}/{totalPages}</p>
            </div>
          )}
        </div>

        {/* Right: Sort Toolbar & View Mode Switcher */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Sort Tabs */}
          <div className="flex items-center bg-[#1b1b26] p-1 rounded-xl border border-[#2d2d3e]">
            <button
              onClick={() => onSortChange("date")}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                sort === "date"
                  ? "bg-[#ed2553] text-white shadow-sm"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              Récent
            </button>
            <button
              onClick={() => onSortChange("popular-today")}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                sort === "popular-today"
                  ? "bg-[#ed2553] text-white shadow-sm"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              Populaire (Aujourd'hui)
            </button>
            <button
              onClick={() => onSortChange("popular-week")}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                sort === "popular-week"
                  ? "bg-[#ed2553] text-white shadow-sm"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              Cette semaine
            </button>
            <button
              onClick={() => onSortChange("popular")}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                sort === "popular"
                  ? "bg-[#ed2553] text-white shadow-sm"
                  : "text-gray-400 hover:text-white"
              }`}
            >
              Tous les temps
            </button>
          </div>

          {/* View Mode Switcher */}
          <div className="flex items-center bg-[#1b1b26] p-1 rounded-xl border border-[#2d2d3e]">
            <button
              onClick={() => handleViewModeChange("comfort")}
              className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                viewMode === "comfort"
                  ? "bg-[#333348] text-[#ed2553] shadow-sm"
                  : "text-gray-400 hover:text-white"
              }`}
              title="Grille Confort (grandes cartes avec aperçu)"
            >
              <Icon name="grid_view" size={18} />
            </button>
            <button
              onClick={() => handleViewModeChange("dense")}
              className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                viewMode === "dense"
                  ? "bg-[#333348] text-[#ed2553] shadow-sm"
                  : "text-gray-400 hover:text-white"
              }`}
              title="Grille Dense (cartes compactes)"
            >
              <Icon name="view_module" size={18} />
            </button>
            <button
              onClick={() => handleViewModeChange("list")}
              className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                viewMode === "list"
                  ? "bg-[#333348] text-[#ed2553] shadow-sm"
                  : "text-gray-400 hover:text-white"
              }`}
              title="Vue Liste Détaillée"
            >
              <Icon name="view_list" size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* Error state */}
      {error && !isLoading && (
        <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-500/30 flex items-center justify-between text-rose-300 text-xs">
          <div className="flex items-center gap-2">
            <Icon name="error" size={18} />
            <span>{error}</span>
          </div>
          <button
            onClick={onRetry}
            className="px-3 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold cursor-pointer"
          >
            Réessayer
          </button>
        </div>
      )}

      {/* Loading state skeleton */}
      {isLoading && (
        <div
          className={
            viewMode === "list"
              ? "space-y-3"
              : viewMode === "dense"
              ? "grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3"
              : "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4"
          }
        >
          {Array.from({ length: 18 }).map((_, i) => (
            <div
              key={i}
              className={
                viewMode === "list"
                  ? "h-24 bg-[#181824] rounded-xl animate-pulse border border-[#252535]"
                  : "aspect-[3/4.3] bg-[#181824] rounded-xl animate-pulse border border-[#252535]"
              }
            />
          ))}
        </div>
      )}

      {/* Main Galleries Rendering */}
      {!isLoading && !error && (
        <>
          {galleries.length === 0 ? (
            <div className="py-20 text-center space-y-3">
              <div className="w-16 h-16 rounded-full bg-[#181824] border border-[#2d2d40] mx-auto flex items-center justify-center text-gray-500">
                <Icon name="search_off" size={32} />
              </div>
              <h3 className="text-base font-bold text-gray-300">Aucun résultat trouvé</h3>
              <p className="text-xs text-gray-500">
                Vérifiez l'orthographe de vos tags ou essayez d'autres mots-clés.
              </p>
            </div>
          ) : viewMode === "list" ? (
            <div className="space-y-3">
              {galleries.map((g) => (
                <GalleryListItem
                  key={g.id}
                  gallery={g}
                  onSelect={onSelectGallery}
                  onRead={onReadGallery}
                  onQuickDownload={onQuickDownload}
                  onTagClick={onTagClick}
                  isQueued={queuedIds.has(g.id)}
                />
              ))}
            </div>
          ) : (
            <div
              className={
                viewMode === "dense"
                  ? "grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3"
                  : "grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4"
              }
            >
              {galleries.map((g) => (
                <GalleryCard
                  key={g.id}
                  gallery={g}
                  onSelect={onSelectGallery}
                  onRead={onReadGallery}
                  onQuickDownload={onQuickDownload}
                  onTagClick={onTagClick}
                  isQueued={queuedIds.has(g.id)}
                  isDense={viewMode === "dense"}
                />
              ))}
            </div>
          )}

          {/* Pagination Toolbar */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-8 pb-4">
              <button
                onClick={() => onPageChange(1)}
                disabled={page <= 1}
                className="p-2 rounded-xl bg-[#1b1b26] hover:bg-[#252536] text-gray-300 disabled:opacity-30 border border-[#2d2d40] cursor-pointer"
                title="Première page"
              >
                <Icon name="first_page" size={18} />
              </button>
              <button
                onClick={() => onPageChange(page - 1)}
                disabled={page <= 1}
                className="p-2 rounded-xl bg-[#1b1b26] hover:bg-[#252536] text-gray-300 disabled:opacity-30 border border-[#2d2d40] cursor-pointer"
                title="Page précédente"
              >
                <Icon name="chevron_left" size={18} />
              </button>

              <div className="px-4 py-2 rounded-xl bg-[#1b1b26] border border-[#2d2d40] text-xs font-mono font-bold text-gray-200">
                <span className="text-[#ed2553]">{page}</span> / {totalPages}
              </div>

              <button
                onClick={() => onPageChange(page + 1)}
                disabled={page >= totalPages}
                className="p-2 rounded-xl bg-[#1b1b26] hover:bg-[#252536] text-gray-300 disabled:opacity-30 border border-[#2d2d40] cursor-pointer"
                title="Page suivante"
              >
                <Icon name="chevron_right" size={18} />
              </button>
              <button
                onClick={() => onPageChange(totalPages)}
                disabled={page >= totalPages}
                className="p-2 rounded-xl bg-[#1b1b26] hover:bg-[#252536] text-gray-300 disabled:opacity-30 border border-[#2d2d40] cursor-pointer"
                title="Dernière page"
              >
                <Icon name="last_page" size={18} />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};
