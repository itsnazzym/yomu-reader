import React, { useState } from "react";
import { Gallery, Tag } from "../../types";
import { getCoverUrl, getGalleryDisplayTitle, getGalleryLanguage, cleanCdnPath, buildImageFallbacks } from "../../utils/ipc";
import { useFavoriteStore } from "../../stores/favoriteStore";
import { useHistoryStore } from "../../stores/historyStore";
import { Icon } from "../common/Icon";
import { SmartImage } from "../common/SmartImage";
import { QuickShareModal } from "../common/QuickShareModal";

interface GalleryListItemProps {
  gallery: Gallery;
  onSelect: (gallery: Gallery) => void;
  onRead?: (gallery: Gallery, initialPage?: number) => void;
  onQuickDownload?: (gallery: Gallery) => void;
  onTagClick?: (tag: Tag | string) => void;
  isQueued?: boolean;
}

export const GalleryListItem: React.FC<GalleryListItemProps> = ({
  gallery,
  onSelect,
  onRead,
  onQuickDownload,
  onTagClick,
  isQueued = false,
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

  const artist = gallery.tags?.find((t) => t.type === "artist")?.name;
  const parody = gallery.tags?.find((t) => t.type === "parody")?.name;
  const regularTags = (gallery.tags || []).filter((t) => t.type === "tag").slice(0, 4);

  return (
    <div
      onClick={() => onSelect(gallery)}
      className="group bg-[#1a1a24] hover:bg-[#20202c] border border-[#272736] hover:border-[#ed2553]/60 rounded-xl p-3 flex items-center justify-between gap-4 transition-all duration-200 cursor-pointer shadow-xs"
    >
      {/* Left: Thumbnail & Main Info */}
      <div className="flex items-center gap-3.5 min-w-0 flex-1">
        {/* Cover */}
        <div className="w-14 h-20 rounded-lg overflow-hidden bg-[#222230] shrink-0 border border-white/5 relative group-hover:shadow-md transition-shadow">
          <SmartImage
            candidates={candidateUrls}
            alt={title}
            className="w-full h-full"
            imgClassName="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
          {historyProgress && (
            <div className="absolute bottom-0 inset-x-0 h-1 bg-emerald-500" />
          )}
        </div>

        {/* Info Column */}
        <div className="min-w-0 space-y-1.5 flex-1">
          {/* Title */}
          <h3
            className="text-xs md:text-sm font-semibold text-gray-200 group-hover:text-white truncate transition-colors"
            title={title}
          >
            {title}
          </h3>

          {/* Meta Line */}
          <div className="flex items-center gap-2 text-[11px] text-gray-400">
            <span className="font-mono font-bold text-[#ed2553]">#d{gallery.id}</span>
            <span>•</span>
            <span className="text-gray-300 font-medium capitalize">{lang}</span>
            <span>•</span>
            <span>{gallery.num_pages} pages</span>
            {artist && (
              <>
                <span>•</span>
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    onTagClick?.(artist);
                  }}
                  className="text-purple-400 hover:text-purple-300 hover:underline truncate max-w-[140px]"
                >
                  🎨 {artist}
                </span>
              </>
            )}
            {parody && (
              <>
                <span>•</span>
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    onTagClick?.(parody);
                  }}
                  className="text-cyan-400 hover:text-cyan-300 hover:underline truncate max-w-[140px]"
                >
                  🎬 {parody}
                </span>
              </>
            )}
          </div>

          {/* Tag Pills Preview */}
          <div className="flex flex-wrap gap-1 pt-0.5">
            {regularTags.map((tag) => (
              <span
                key={tag.id}
                onClick={(e) => {
                  e.stopPropagation();
                  onTagClick?.(tag);
                }}
                className="px-1.5 py-0.5 rounded bg-[#252535] hover:bg-[#323245] text-[10px] text-gray-400 hover:text-gray-200 transition-colors"
              >
                {tag.name}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Right: Action Buttons */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={(e) => {
            e.stopPropagation();
            toggleFavorite(gallery);
          }}
          className={`p-2 rounded-lg border transition-all cursor-pointer ${
            favorited
              ? "bg-[#ed2553] text-white border-[#f43f5e] shadow-md shadow-[#ed2553]/25"
              : "bg-[#222230] text-gray-400 hover:text-white border-[#303042]"
          }`}
          title={favorited ? "Retirer des favoris" : "Ajouter aux favoris"}
        >
          <Icon name="favorite" size={16} filled={favorited} />
        </button>

        {/* Quick Share */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsShareOpen(true);
          }}
          className="p-2 rounded-lg bg-[#222230] text-cyan-400 hover:text-white hover:bg-[#2e2e42] border border-[#303042] transition-all cursor-pointer"
          title="Quick Share & AirDrop"
        >
          <Icon name="share" size={16} />
        </button>

        {onRead && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRead(gallery, historyProgress ? historyProgress.lastReadPage : 0);
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition-all shadow-md cursor-pointer"
          >
            <Icon name="auto_stories" size={16} />
            <span>Lire</span>
          </button>
        )}

        {onQuickDownload && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (!isQueued) onQuickDownload(gallery);
            }}
            disabled={isQueued}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
              isQueued
                ? "bg-emerald-950/60 text-emerald-300 border border-emerald-500/40"
                : "bg-[#ed2553] hover:bg-[#f43f5e] text-white shadow-md shadow-[#ed2553]/20"
            }`}
          >
            <Icon name={isQueued ? "check_circle" : "download"} size={16} />
            <span>{isQueued ? "En file" : "CBZ"}</span>
          </button>
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
