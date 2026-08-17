import React, { useState } from "react";
import { Gallery } from "../../types";
import { getCoverUrl, getGalleryDisplayTitle, getGalleryLanguage, cleanCdnPath } from "../../utils/ipc";
import { Icon } from "../common/Icon";

interface GalleryCardProps {
  gallery: Gallery;
  onSelect: (gallery: Gallery) => void;
  onRead?: (gallery: Gallery) => void;
  onQuickDownload?: (gallery: Gallery) => void;
  isQueued?: boolean;
}

export const GalleryCard: React.FC<GalleryCardProps> = ({
  gallery,
  onSelect,
  onRead,
  onQuickDownload,
  isQueued = false,
}) => {
  const title = getGalleryDisplayTitle(gallery);
  const lang = getGalleryLanguage(gallery);
  const mid = gallery.media_id || String(gallery.id);

  const candidateUrls: string[] = [];
  const primaryCover = getCoverUrl(gallery);
  if (primaryCover) candidateUrls.push(primaryCover);
  if (gallery.images?.cover?.path) {
    candidateUrls.push(`https://t.nhentai.net/${cleanCdnPath(gallery.images.cover.path)}`);
  }
  candidateUrls.push(`https://t.nhentai.net/galleries/${mid}/thumb.webp`);
  candidateUrls.push(`https://t.nhentai.net/galleries/${mid}/thumb.jpg`);
  candidateUrls.push(`https://t.nhentai.net/galleries/${mid}/cover.webp`);
  candidateUrls.push(`https://t.nhentai.net/galleries/${mid}/cover.jpg`);
  candidateUrls.push(`https://t.nhentai.net/galleries/${mid}/1t.webp`);
  candidateUrls.push(`https://i.nhentai.net/galleries/${mid}/1.webp`);
  candidateUrls.push(`https://i.nhentai.net/galleries/${mid}/1.jpg`);

  const [srcIndex, setSrcIndex] = useState(0);

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
        return "JA";
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
        return "JA";
    }
  };

  return (
    <div
      onClick={() => onSelect(gallery)}
      className="group flex flex-col cursor-pointer select-none transition-all duration-200"
    >
      {/* Cover Image Container */}
      <div className="relative aspect-[3/4.3] w-full rounded-md overflow-hidden bg-[#1f1f26] border border-[#2b2b36] group-hover:border-[#ed2553] transition-colors shadow-md">
        <img
          src={candidateUrls[srcIndex] || candidateUrls[0]}
          alt={title}
          loading="lazy"
          className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-300"
          onError={() => {
            if (srcIndex < candidateUrls.length - 1) {
              setSrcIndex((prev) => prev + 1);
            }
          }}
        />

        {/* Hover Quick Action Buttons */}
        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col items-center justify-center gap-2 p-3">
          {onRead && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRead(gallery);
              }}
              className="w-full py-1.5 px-3 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-lg transition-transform hover:scale-102 cursor-pointer"
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
              className={`w-full py-1.5 px-3 rounded text-xs font-bold flex items-center justify-center gap-1.5 shadow-lg transition-transform hover:scale-102 cursor-pointer ${
                isQueued
                  ? "bg-emerald-800/80 text-emerald-200 border border-emerald-500/40"
                  : "bg-[#ed2553] hover:bg-[#f43f5e] text-white"
              }`}
            >
              {isQueued ? (
                <>
                  <Icon name="check_circle" size={16} />
                  <span>En File</span>
                </>
              ) : (
                <>
                  <Icon name="download" size={16} />
                  <span>CBZ</span>
                </>
              )}
            </button>
          )}
        </div>

        {/* Bottom Left Language Badge */}
        <div className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 rounded bg-black/80 backdrop-blur-xs text-[10px] font-mono font-black text-rose-300 flex items-center gap-1 border border-white/10">
          <Icon name="translate" size={12} className="text-gray-400" />
          <span>{getLangCode(lang)}</span>
        </div>

        {/* Number of Pages Tag */}
        <div className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded bg-black/80 backdrop-blur-xs text-[10px] font-mono font-bold text-gray-300 border border-white/10">
          {gallery.num_pages}p
        </div>
      </div>

      {/* Title Caption */}
      <div className="mt-1.5 px-0.5">
        <h3
          className="text-xs text-gray-200 group-hover:text-[#ed2553] line-clamp-2 leading-snug font-medium transition-colors"
          title={title}
        >
          {title}
        </h3>
      </div>
    </div>
  );
};
