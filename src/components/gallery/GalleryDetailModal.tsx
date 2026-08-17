import React, { useState } from "react";
import { Gallery, Tag, ImageInfo } from "../../types";
import { getCoverUrl, getGalleryDisplayTitle, cleanCdnPath } from "../../utils/ipc";
import { useDownloadStore } from "../../stores/downloadStore";
import { Icon } from "../common/Icon";

interface GalleryDetailModalProps {
  gallery: Gallery | null;
  onClose: () => void;
  onTagClick: (tag: Tag) => void;
  onRead?: (gallery: Gallery, initialPage?: number) => void;
}

// Resilient thumbnail preview component with auto-fallback
const ThumbnailImage: React.FC<{
  mediaId: string;
  pageIndex: number;
  pageInfo: ImageInfo;
  onClick?: () => void;
}> = ({ mediaId, pageIndex, pageInfo, onClick }) => {
  const pageNum = pageInfo.number || pageIndex + 1;
  const thumbPath = cleanCdnPath(pageInfo.thumbnail);

  const candidateUrls: string[] = [];
  if (thumbPath) candidateUrls.push(`https://t.nhentai.net/${thumbPath}`);
  if (pageInfo.path) candidateUrls.push(`https://i.nhentai.net/${cleanCdnPath(pageInfo.path)}`);
  if (mediaId) {
    candidateUrls.push(`https://t.nhentai.net/galleries/${mediaId}/${pageNum}t.webp`);
    candidateUrls.push(`https://t.nhentai.net/galleries/${mediaId}/${pageNum}t.jpg`);
    candidateUrls.push(`https://i.nhentai.net/galleries/${mediaId}/${pageNum}.webp`);
    candidateUrls.push(`https://i.nhentai.net/galleries/${mediaId}/${pageNum}.jpg`);
    candidateUrls.push(`https://t.nhentai.net/galleries/${mediaId}/${pageNum}t.png`);
    candidateUrls.push(`https://i.nhentai.net/galleries/${mediaId}/${pageNum}.png`);
  }

  const [srcIndex, setSrcIndex] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);

  return (
    <div
      onClick={onClick}
      className="group relative aspect-[3/4.2] bg-[#22222c] border border-[#2d2d3a] hover:border-[#ed2553] rounded overflow-hidden cursor-pointer transition-all shadow-xs flex items-center justify-center"
    >
      <img
        src={candidateUrls[srcIndex] || candidateUrls[0]}
        alt={`Page ${pageNum}`}
        loading="lazy"
        onLoad={() => setIsLoaded(true)}
        onError={() => {
          if (srcIndex < candidateUrls.length - 1) {
            setSrcIndex((prev) => prev + 1);
          }
        }}
        className={`w-full h-full object-cover group-hover:scale-105 transition-transform duration-200 ${
          isLoaded ? "opacity-100" : "opacity-0"
        }`}
      />
      {!isLoaded && (
        <div className="absolute inset-0 bg-[#22222c] animate-pulse" />
      )}
      <div className="absolute bottom-0 inset-x-0 bg-black/70 text-center text-[10px] font-mono text-gray-300 py-0.5 z-10">
        {pageNum}
      </div>
    </div>
  );
};

export const GalleryDetailModal: React.FC<GalleryDetailModalProps> = ({
  gallery,
  onClose,
  onTagClick,
  onRead,
}) => {
  if (!gallery) return null;

  const { queue, addToQueue } = useDownloadStore();
  const [isFavorite, setIsFavorite] = useState(false);

  const title = getGalleryDisplayTitle(gallery);
  const coverUrl = getCoverUrl(gallery);
  const isQueued = queue.some(
    (i) => i.id === gallery.id && (i.status === "downloading" || i.status === "queued" || i.status === "completed")
  );

  const artistTags = gallery.tags.filter((t) => t.type === "artist");
  const groupTags = gallery.tags.filter((t) => t.type === "group");
  const parodyTags = gallery.tags.filter((t) => t.type === "parody");
  const characterTags = gallery.tags.filter((t) => t.type === "character");
  const regularTags = gallery.tags.filter((t) => t.type === "tag");
  const langTags = gallery.tags.filter((t) => t.type === "language");
  const catTags = gallery.tags.filter((t) => t.type === "category");

  const formatCount = (count: number) => {
    if (!count) return "";
    if (count >= 1000) return `${Math.round(count / 1000)}K`;
    return String(count);
  };

  const timeAgo = (timestamp: number) => {
    const diff = Math.floor(Date.now() / 1000) - timestamp;
    const hours = Math.floor(diff / 3600);
    if (hours < 24) return `il y a ${Math.max(1, hours)} heures`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `il y a ${days} jours`;
    const months = Math.floor(days / 30);
    return `il y a ${months} mois`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs select-none overflow-y-auto">
      {/* Modal Container */}
      <div className="relative w-full max-w-5xl bg-[#18181f] border border-[#2b2b38] rounded-xl shadow-2xl overflow-hidden my-8">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-2 rounded-lg bg-[#252530] hover:bg-[#323242] text-gray-300 hover:text-white transition-colors cursor-pointer"
          title="Fermer (Échap)"
        >
          <Icon name="close" size={20} />
        </button>

        <div className="p-6 md:p-8 space-y-8">
          {/* Top Section: Cover + Meta */}
          <div className="flex flex-col md:flex-row gap-8 items-start">
            {/* Left Column: Big Cover */}
            <div className="w-full md:w-80 shrink-0">
              <div className="aspect-[3/4.4] w-full rounded-lg overflow-hidden bg-[#202028] border border-[#2d2d3c] shadow-xl relative group">
                <img
                  src={coverUrl}
                  alt={title}
                  className="w-full h-full object-cover"
                />
                {onRead && (
                  <button
                    onClick={() => onRead(gallery, 0)}
                    className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 text-white font-bold bg-[#ed2553]/80 backdrop-blur-xs cursor-pointer"
                  >
                    <Icon name="auto_stories" size={24} />
                    <span>Commencer la lecture</span>
                  </button>
                )}
              </div>
            </div>

            {/* Right Column: Metadata & Actions */}
            <div className="flex-1 space-y-4 min-w-0">
              {/* Title & ID */}
              <div>
                <h1 className="text-lg md:text-xl font-bold text-white leading-tight">
                  {title}
                </h1>
                <div className="text-xs font-mono font-bold text-[#ed2553] mt-1">
                  #d{gallery.id}
                </div>
              </div>

              {/* Meta Rows (Pill Design) */}
              <div className="space-y-2.5 text-xs text-gray-300">
                {/* Parodies / Séries */}
                {parodyTags.length > 0 && (
                  <div className="flex items-start gap-2">
                    <span className="font-bold text-gray-400 min-w-[100px] pt-1">Séries :</span>
                    <div className="flex flex-wrap gap-1.5">
                      {parodyTags.map((t) => (
                        <button
                          key={t.id}
                          onClick={() => onTagClick(t)}
                          className="pill-tag px-2.5 py-1 rounded text-xs flex items-center gap-1.5 cursor-pointer"
                        >
                          <span>{t.name}</span>
                          <span className="text-[10px] text-gray-400 font-mono">{formatCount(t.count)}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Artists */}
                {artistTags.length > 0 && (
                  <div className="flex items-start gap-2">
                    <span className="font-bold text-gray-400 min-w-[100px] pt-1">Artistes :</span>
                    <div className="flex flex-wrap gap-1.5">
                      {artistTags.map((t) => (
                        <button
                          key={t.id}
                          onClick={() => onTagClick(t)}
                          className="pill-tag px-2.5 py-1 rounded text-xs flex items-center gap-1.5 cursor-pointer"
                        >
                          <span>{t.name}</span>
                          <span className="text-[10px] text-gray-400 font-mono">{formatCount(t.count)}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Groups */}
                {groupTags.length > 0 && (
                  <div className="flex items-start gap-2">
                    <span className="font-bold text-gray-400 min-w-[100px] pt-1">Groupes :</span>
                    <div className="flex flex-wrap gap-1.5">
                      {groupTags.map((t) => (
                        <button
                          key={t.id}
                          onClick={() => onTagClick(t)}
                          className="pill-tag px-2.5 py-1 rounded text-xs flex items-center gap-1.5 cursor-pointer"
                        >
                          <span>{t.name}</span>
                          <span className="text-[10px] text-gray-400 font-mono">{formatCount(t.count)}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Characters */}
                {characterTags.length > 0 && (
                  <div className="flex items-start gap-2">
                    <span className="font-bold text-gray-400 min-w-[100px] pt-1">Personnages :</span>
                    <div className="flex flex-wrap gap-1.5">
                      {characterTags.map((t) => (
                        <button
                          key={t.id}
                          onClick={() => onTagClick(t)}
                          className="pill-tag px-2.5 py-1 rounded text-xs flex items-center gap-1.5 cursor-pointer"
                        >
                          <span>{t.name}</span>
                          <span className="text-[10px] text-gray-400 font-mono">{formatCount(t.count)}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Tags */}
                {regularTags.length > 0 && (
                  <div className="flex items-start gap-2">
                    <span className="font-bold text-gray-400 min-w-[100px] pt-1">Tags :</span>
                    <div className="flex flex-wrap gap-1.5">
                      {regularTags.map((t) => (
                        <button
                          key={t.id}
                          onClick={() => onTagClick(t)}
                          className="pill-tag px-2.5 py-1 rounded text-xs flex items-center gap-1.5 cursor-pointer"
                        >
                          <span>{t.name}</span>
                          <span className="text-[10px] text-gray-400 font-mono">{formatCount(t.count)}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Languages */}
                {langTags.length > 0 && (
                  <div className="flex items-start gap-2">
                    <span className="font-bold text-gray-400 min-w-[100px] pt-1">Langues :</span>
                    <div className="flex flex-wrap gap-1.5">
                      {langTags.map((t) => (
                        <button
                          key={t.id}
                          onClick={() => onTagClick(t)}
                          className="pill-tag px-2.5 py-1 rounded text-xs flex items-center gap-1.5 text-rose-300 cursor-pointer"
                        >
                          <span>{t.name}</span>
                          <span className="text-[10px] text-gray-400 font-mono">{formatCount(t.count)}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Categories */}
                {catTags.length > 0 && (
                  <div className="flex items-start gap-2">
                    <span className="font-bold text-gray-400 min-w-[100px] pt-1">Catégories :</span>
                    <div className="flex flex-wrap gap-1.5">
                      {catTags.map((t) => (
                        <button
                          key={t.id}
                          onClick={() => onTagClick(t)}
                          className="pill-tag px-2.5 py-1 rounded text-xs flex items-center gap-1.5 cursor-pointer"
                        >
                          <span>{t.name}</span>
                          <span className="text-[10px] text-gray-400 font-mono">{formatCount(t.count)}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Page Count */}
                <div className="flex items-center gap-2">
                  <span className="font-bold text-gray-400 min-w-[100px]">Nombre de pages :</span>
                  <span className="font-mono font-bold text-white">{gallery.num_pages}</span>
                </div>

                {/* Upload date */}
                <div className="flex items-center gap-2">
                  <span className="font-bold text-gray-400 min-w-[100px]">Mise en ligne :</span>
                  <span className="text-gray-300">{timeAgo(gallery.upload_date)}</span>
                </div>
              </div>

              {/* Action Buttons Bar */}
              <div className="pt-3 flex flex-wrap items-center gap-3">
                {/* Big Magenta Button: Read / Favorites */}
                {onRead && (
                  <button
                    onClick={() => onRead(gallery, 0)}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-md bg-[#ed2553] hover:bg-[#f43f5e] text-white text-xs font-bold transition-all shadow-md cursor-pointer"
                  >
                    <Icon name="auto_stories" size={18} />
                    <span>Lire le Manga</span>
                  </button>
                )}

                <button
                  onClick={() => setIsFavorite(!isFavorite)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-md text-xs font-bold transition-all border cursor-pointer ${
                    isFavorite
                      ? "bg-[#ed2553] text-white border-[#f43f5e]"
                      : "bg-[#242430] hover:bg-[#303040] text-gray-200 border-[#323242]"
                  }`}
                >
                  <Icon
                    name="favorite"
                    size={18}
                    filled={isFavorite}
                    className={isFavorite ? "text-white" : "text-rose-400"}
                  />
                  <span>{isFavorite ? "Dans mes favoris" : "Ajouter à mes favoris"}</span>
                </button>

                {/* Download CBZ / ZIP */}
                <button
                  onClick={() => addToQueue(gallery, "cbz")}
                  disabled={isQueued}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-md bg-[#242430] hover:bg-[#303040] text-gray-200 border border-[#323242] text-xs font-bold transition-colors disabled:opacity-50 cursor-pointer"
                  title="Télécharger au format CBZ avec ComicInfo.xml"
                >
                  {isQueued ? (
                    <>
                      <Icon name="check_circle" size={18} className="text-emerald-400" />
                      <span>Téléchargé / En File</span>
                    </>
                  ) : (
                    <>
                      <Icon name="download" size={18} className="text-rose-400" />
                      <span>Télécharger (CBZ)</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Bottom Section: Grid of Page Thumbnails */}
          <div className="space-y-3 pt-4 border-t border-[#252532]">
            <h3 className="text-sm font-bold text-gray-200 flex items-center gap-2">
              <Icon name="grid_view" size={18} className="text-rose-400" />
              <span>Aperçu des Pages ({gallery.images?.pages?.length || gallery.num_pages}) :</span>
            </h3>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2.5 max-h-72 overflow-y-auto pr-1">
              {(gallery.images?.pages || []).map((p, idx) => (
                <ThumbnailImage
                  key={idx}
                  mediaId={gallery.media_id || String(gallery.id)}
                  pageIndex={idx}
                  pageInfo={p}
                  onClick={() => onRead?.(gallery, idx)}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
