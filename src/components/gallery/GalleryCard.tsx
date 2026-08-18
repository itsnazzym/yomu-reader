import React, { useState } from "react";
import { Gallery, Tag } from "../../types";
import { getCoverUrl, getGalleryDisplayTitle, getGalleryLanguage, cleanCdnPath, buildImageFallbacks } from "../../utils/ipc";
import { useFavoriteStore } from "../../stores/favoriteStore";
import { useHistoryStore } from "../../stores/historyStore";
import { Icon } from "../common/Icon";
import { SmartImage } from "../common/SmartImage";
import { QuickShareModal } from "../common/QuickShareModal";

interface GalleryCardProps {
  gallery: Gallery;
  onSelect: (gallery: Gallery) => void;
  onRead?: (gallery: Gallery, initialPage?: number) => void;
  onQuickDownload?: (gallery: Gallery) => void;
  onTagClick?: (tag: Tag | string) => void;
  isQueued?: boolean;
  isDense?: boolean;
}

export const GalleryCard: React.FC<GalleryCardProps> = ({
  gallery,
  onSelect,
  onRead,
  onQuickDownload,
  onTagClick,
  isQueued = false,
  isDense = false,
}) => {
  const title = getGalleryDisplayTitle(gallery);
  const lang = getGalleryLanguage(gallery);
  const mid = gallery.media_id || String(gallery.id);

  const { isFavorite, toggleFavorite } = useFavoriteStore();
  const { getProgress } = useHistoryStore();
  const favorited = isFavorite(gallery.id);
  const historyProgress = getProgress(gallery.id);
  const [isShareOpen, setIsShareOpen] = useState(false);

  const primaryCover = getCoverUrl(gallery) || (gallery.images?.cover?.path ? cleanCdnPath(gallery.images.cover.path) : "");
  const candidateUrls = React.useMemo(() => {
    return buildImageFallbacks(primaryCover, "thumb", mid);
  }, [primaryCover, mid]);

  const getLangCode = (l: string) => {
    switch (l.toLowerCase()) {
      case "french":
      case "français":
        return "FR";
      case "english":
      case "anglais":
        return "EN";
      case "japanese":
      case "japonais":
        return "JP";
      case "chinese":
      case "chinois":
        return "ZH";
      case "spanish":
      case "espagnol":
        return "ES";
      case "italian":
      case "italien":
        return "IT";
      default:
        return "JP";
    }
  };

  const uploadDate = gallery.upload_date ? new Date(gallery.upload_date * 1000) : null;
  const isNew = uploadDate ? Date.now() - uploadDate.getTime() <= 24 * 60 * 60 * 1000 : false;

  const artistTag = gallery.tags?.find((t) => t.type === "artist");
  const parodyTag = gallery.tags?.find((t) => t.type === "parody");
  const characterTags = (gallery.tags || []).filter((t) => t.type === "character").slice(0, 2);
  const plainTags = (gallery.tags || []).filter((t) => t.type === "tag").slice(0, 4);

  return (
    <div
      onClick={() => onSelect(gallery)}
      className="group relative flex flex-col cursor-pointer select-none transition-all duration-200"
    >
      {/* Cover Image Container */}
      <div className="relative aspect-[3/4.3] w-full rounded-xl overflow-hidden bg-[#161622] border border-[#262638] group-hover:border-[#ed2553] group-hover:shadow-xl group-hover:shadow-rose-950/25 transition-all duration-300">
        <SmartImage
          candidates={candidateUrls}
          alt={title}
          className="w-full h-full"
          imgClassName="w-full h-full object-cover transform group-hover:scale-106 transition-transform duration-400"
        />

        {/* Top Right Quick Favorite Toggle */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            toggleFavorite(gallery);
          }}
          className={`absolute top-2 right-2 p-1.5 rounded-full z-20 transition-all cursor-pointer ${
            favorited
              ? "bg-[#ed2553] text-white shadow-md shadow-[#ed2553]/40"
              : "bg-black/60 text-white/70 hover:text-white hover:bg-black/90 backdrop-blur-xs"
          }`}
          title={favorited ? "Retirer des favoris" : "Ajouter aux favoris"}
        >
          <Icon name="favorite" size={13} filled={favorited} />
        </button>

        {/* Top Left Badges: NEW / Reading Progress */}
        <div className="absolute top-2 left-2 flex flex-col gap-1 z-20 pointer-events-none">
          {isNew && (
            <span className="px-1.5 py-0.5 rounded-md bg-[#ed2553] text-[9px] font-black text-white uppercase tracking-wider shadow-md animate-pulse">
              NEW
            </span>
          )}
          {historyProgress && (
            <span className="px-1.5 py-0.5 rounded-md bg-emerald-950/90 border border-emerald-500/50 text-[9px] font-mono font-bold text-emerald-300 backdrop-blur-xs flex items-center gap-1 shadow-md">
              <Icon name="history_toggle_off" size={10} />
              <span>P.{historyProgress.lastReadPage + 1}/{gallery.num_pages}</span>
            </span>
          )}
        </div>

        {/* Hover Overlay with Tags Chips & Action Buttons (NHApp style) */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/75 to-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-250 flex flex-col justify-between p-2.5 z-10">
          {/* Top of hover overlay: Tags Chips preview */}
          <div className="flex flex-wrap gap-1 max-h-24 overflow-hidden pt-6 pointer-events-auto">
            {artistTag && (
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  onTagClick?.(artistTag);
                }}
                className="px-1.5 py-0.5 rounded bg-purple-950/80 hover:bg-purple-900 border border-purple-600/40 text-[9px] font-bold text-purple-300 truncate max-w-[120px]"
                title={`Artiste: ${artistTag.name}`}
              >
                🎨 {artistTag.name}
              </span>
            )}
            {parodyTag && (
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  onTagClick?.(parodyTag);
                }}
                className="px-1.5 py-0.5 rounded bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-600/40 text-[9px] font-bold text-cyan-300 truncate max-w-[120px]"
                title={`Série: ${parodyTag.name}`}
              >
                🎬 {parodyTag.name}
              </span>
            )}
            {characterTags.map((char) => (
              <span
                key={char.id}
                onClick={(e) => {
                  e.stopPropagation();
                  onTagClick?.(char);
                }}
                className="px-1.5 py-0.5 rounded bg-amber-950/80 hover:bg-amber-900 border border-amber-600/40 text-[9px] font-semibold text-amber-300 truncate max-w-[110px]"
              >
                👤 {char.name}
              </span>
            ))}
            {plainTags.map((tag) => (
              <span
                key={tag.id}
                onClick={(e) => {
                  e.stopPropagation();
                  onTagClick?.(tag);
                }}
                className="px-1.5 py-0.5 rounded bg-white/10 hover:bg-white/20 text-[9px] text-gray-300 truncate max-w-[90px]"
              >
                #{tag.name}
              </span>
            ))}
          </div>

          {/* Bottom of hover overlay: Quick action buttons */}
          <div className="space-y-1.5 pointer-events-auto">
            {onRead && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onRead(gallery, historyProgress ? historyProgress.lastReadPage : 0);
                }}
                className="w-full py-1.5 px-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-md shadow-emerald-950/50 transition-transform active:scale-97 cursor-pointer"
              >
                <Icon name="auto_stories" size={15} />
                <span>Lire</span>
              </button>
            )}

            <div className="flex items-center gap-1.5">
              {onQuickDownload && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!isQueued) onQuickDownload(gallery);
                  }}
                  disabled={isQueued}
                  className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1 transition-transform active:scale-97 cursor-pointer ${
                    isQueued
                      ? "bg-emerald-950/80 text-emerald-300 border border-emerald-500/40"
                      : "bg-[#ed2553] hover:bg-[#f43f5e] text-white shadow-md shadow-[#ed2553]/30"
                  }`}
                >
                  <Icon name={isQueued ? "check_circle" : "download"} size={14} />
                  <span>{isQueued ? "En file" : "CBZ"}</span>
                </button>
              )}

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsShareOpen(true);
                }}
                className="p-1.5 rounded-lg bg-[#222232] hover:bg-[#2e2e42] text-cyan-300 border border-cyan-500/30 text-xs font-bold flex items-center justify-center transition-transform active:scale-97 cursor-pointer"
                title="Quick Share & AirDrop"
              >
                <Icon name="share" size={14} />
              </button>
            </div>
          </div>
        </div>

        {/* Bottom Left Language Badge */}
        <div className="absolute bottom-2 left-2 px-1.5 py-0.5 rounded-md bg-black/85 backdrop-blur-xs text-[10px] font-mono font-black text-rose-300 flex items-center gap-1 border border-white/10 z-10 pointer-events-none">
          <Icon name="translate" size={11} className="text-gray-400" />
          <span>{getLangCode(lang)}</span>
        </div>

        {/* Number of Pages Tag */}
        <div className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded-md bg-black/85 backdrop-blur-xs text-[10px] font-mono font-bold text-gray-300 border border-white/10 z-10 pointer-events-none">
          {gallery.num_pages}p
        </div>
      </div>

      {/* Title Caption */}
      <div className="mt-2 px-1 space-y-0.5">
        <h3
          className={`text-gray-200 group-hover:text-[#ed2553] font-semibold leading-snug transition-colors ${
            isDense ? "text-[11px] line-clamp-1" : "text-xs line-clamp-2"
          }`}
          title={title}
        >
          {title}
        </h3>
        {!isDense && artistTag && (
          <p className="text-[10px] text-gray-400 truncate">
            {artistTag.name}
          </p>
        )}
      </div>

      {isShareOpen && (
        <QuickShareModal
          gallery={gallery}
          onClose={() => setIsShareOpen(false)}
        />
      )}
    </div>
  );
};
