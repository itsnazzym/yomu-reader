import React, { useState, useEffect } from "react";
import { Gallery, Tag, ImageInfo } from "../../types";
import { getGalleryDisplayTitle, getCoverUrl, cleanCdnPath, buildImageFallbacks, getGallery } from "../../utils/ipc";
import { useDownloadStore } from "../../stores/downloadStore";
import { useFavoriteStore } from "../../stores/favoriteStore";
import { Icon } from "../common/Icon";
import { CommentSection } from "./CommentSection";
import { SmartImage } from "../common/SmartImage";
import { QuickShareModal } from "../common/QuickShareModal";

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
  pageInfo?: ImageInfo;
  onClick?: () => void;
}> = ({ mediaId, pageIndex, pageInfo, onClick }) => {
  const pageNum = pageInfo?.number || pageIndex + 1;
  const thumbPath = pageInfo?.thumbnail || pageInfo?.path || "";

  const candidateUrls = React.useMemo(() => {
    return buildImageFallbacks(thumbPath, "thumb", mediaId, pageNum);
  }, [thumbPath, mediaId, pageNum]);

  return (
    <div
      onClick={onClick}
      className="group relative aspect-[3/4.2] bg-[#22222c] border border-[#2d2d3a] hover:border-[#ed2553] rounded overflow-hidden cursor-pointer transition-all shadow-xs flex items-center justify-center"
    >
      <SmartImage
        candidates={candidateUrls}
        alt={`Page ${pageNum}`}
        className="w-full h-full"
        imgClassName="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
      />
      <div className="absolute bottom-0 inset-x-0 bg-black/70 text-center text-[10px] font-mono text-gray-300 py-0.5 z-10">
        {pageNum}
      </div>
    </div>
  );
};

const GalleryDetailModalContent: React.FC<GalleryDetailModalProps & { gallery: Gallery }> = ({
  gallery,
  onClose,
  onTagClick,
  onRead,
}) => {
  const [currentGallery, setCurrentGallery] = useState<Gallery>(gallery);

  useEffect(() => {
    if (gallery) {
      setCurrentGallery(gallery);
      if (!gallery.images?.pages || gallery.images.pages.length === 0) {
        getGallery(gallery.id)
          .then((full) => {
            if (full) setCurrentGallery(full);
          })
          .catch(() => {});
      }
    }
  }, [gallery]);

  const { queue, addToQueue } = useDownloadStore();
  const { isFavorite, toggleFavorite } = useFavoriteStore();
  const favorited = isFavorite(currentGallery.id);
  const [isShareOpen, setIsShareOpen] = useState(false);

  const title = getGalleryDisplayTitle(currentGallery);
  const coverUrl = getCoverUrl(currentGallery) || (currentGallery.images?.cover?.path ? cleanCdnPath(currentGallery.images.cover.path) : "");
  const [activeBottomTab, setActiveBottomTab] = useState<"pages" | "comments">("pages");
  const isQueued = queue.some(
    (i) => i.id === currentGallery.id && (i.status === "downloading" || i.status === "queued" || i.status === "completed")
  );

  const allTags = Array.isArray(currentGallery.tags) ? currentGallery.tags : [];
  const artistTags = allTags.filter((t) => t && t.type === "artist");
  const groupTags = allTags.filter((t) => t && t.type === "group");
  const parodyTags = allTags.filter((t) => t && t.type === "parody");
  const characterTags = allTags.filter((t) => t && t.type === "character");
  const regularTags = allTags.filter((t) => t && t.type === "tag");
  const langTags = allTags.filter((t) => t && t.type === "language");
  const catTags = allTags.filter((t) => t && t.type === "category");

  const formatCount = (count: number) => {
    if (!count) return "";
    if (count >= 1000) return `${Math.round(count / 1000)}K`;
    return String(count);
  };

  const timeAgo = (timestamp?: number) => {
    if (!timestamp || isNaN(timestamp)) return "Récemment";
    const diff = Math.floor(Date.now() / 1000) - timestamp;
    if (diff < 0) return "Récemment";
    const hours = Math.floor(diff / 3600);
    if (hours < 24) return `il y a ${Math.max(1, hours)} heures`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `il y a ${days} jours`;
    const months = Math.floor(days / 30);
    return `il y a ${months} mois`;
  };

  const mid = currentGallery.media_id || String(currentGallery.id);
  const coverCandidates = React.useMemo(() => {
    return buildImageFallbacks(coverUrl, "thumb", mid);
  }, [coverUrl, mid]);

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
                <SmartImage
                  candidates={coverCandidates}
                  alt={title}
                  className="w-full h-full"
                  imgClassName="w-full h-full object-cover"
                />
                {onRead && (
                  <button
                    onClick={() => onRead(currentGallery, 0)}
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
                  #d{currentGallery.id}
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
                  <span className="font-mono font-bold text-white">{currentGallery.num_pages}</span>
                </div>

                {/* Upload date */}
                <div className="flex items-center gap-2">
                  <span className="font-bold text-gray-400 min-w-[100px]">Mise en ligne :</span>
                  <span className="text-gray-300">{timeAgo(currentGallery.upload_date)}</span>
                </div>
              </div>

              {/* Action Buttons Bar */}
              <div className="pt-3 flex flex-wrap items-center gap-3">
                {/* Big Magenta Button: Read / Favorites */}
                {onRead && (
                  <button
                    onClick={() => onRead(currentGallery, 0)}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-md bg-[#ed2553] hover:bg-[#f43f5e] text-white text-xs font-bold transition-all shadow-md cursor-pointer"
                  >
                    <Icon name="auto_stories" size={18} />
                    <span>Lire le Manga</span>
                  </button>
                )}

                <button
                  onClick={() => toggleFavorite(currentGallery)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-md text-xs font-bold transition-all border cursor-pointer ${
                    favorited
                      ? "bg-[#ed2553] text-white border-[#f43f5e]"
                      : "bg-[#242430] hover:bg-[#303040] text-gray-200 border-[#323242]"
                  }`}
                >
                  <Icon
                    name="favorite"
                    size={18}
                    filled={favorited}
                    className={favorited ? "text-white" : "text-rose-400"}
                  />
                  <span>{favorited ? "Dans mes favoris" : "Ajouter à mes favoris"}</span>
                </button>

                {/* Download CBZ / ZIP */}
                <button
                  onClick={() => addToQueue(currentGallery, "cbz")}
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

                {/* Quick Share & AirDrop */}
                <button
                  onClick={() => setIsShareOpen(true)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-md bg-[#242430] hover:bg-[#303040] text-gray-200 border border-[#323242] text-xs font-bold transition-colors cursor-pointer"
                  title="Partager via QR Code, AirDrop ou Liens"
                >
                  <Icon name="share" size={18} className="text-cyan-400" />
                  <span>Partager</span>
                </button>
              </div>
            </div>
          </div>

          {/* Bottom Section: Tabs for Page Thumbnails & Community Comments */}
          <div className="space-y-4 pt-4 border-t border-[#252532]">
            <div className="flex items-center gap-3 border-b border-[#292938] pb-2">
              <button
                onClick={() => setActiveBottomTab("pages")}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
                  activeBottomTab === "pages"
                    ? "bg-[#ed2553] text-white shadow-sm"
                    : "text-gray-400 hover:text-gray-200 hover:bg-[#252530]"
                }`}
              >
                <Icon name="grid_view" size={16} />
                <span>Planches ({currentGallery.images?.pages?.length || currentGallery.num_pages})</span>
              </button>

              <button
                onClick={() => setActiveBottomTab("comments")}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-bold transition-all cursor-pointer ${
                  activeBottomTab === "comments"
                    ? "bg-[#ed2553] text-white shadow-sm"
                    : "text-gray-400 hover:text-gray-200 hover:bg-[#252530]"
                }`}
              >
                <Icon name="chat_bubble" size={16} />
                <span>Commentaires</span>
              </button>
            </div>

            {activeBottomTab === "pages" ? (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2.5 max-h-72 overflow-y-auto pr-1">
                {Array.from({ length: currentGallery.images?.pages?.length || currentGallery.num_pages || 1 }).map((_, idx) => {
                  const p = currentGallery.images?.pages?.[idx];
                  return (
                    <ThumbnailImage
                      key={idx}
                      mediaId={currentGallery.media_id || String(currentGallery.id)}
                      pageIndex={idx}
                      pageInfo={p}
                      onClick={() => onRead?.(currentGallery, idx)}
                    />
                  );
                })}
              </div>
            ) : (
              <CommentSection galleryId={currentGallery.id} />
            )}
          </div>
        </div>
      </div>

      {isShareOpen && (
        <QuickShareModal
          gallery={currentGallery}
          onClose={() => setIsShareOpen(false)}
        />
      )}
    </div>
  );
};

export const GalleryDetailModal: React.FC<GalleryDetailModalProps> = (props) => {
  if (!props.gallery) return null;
  return <GalleryDetailModalContent {...props} gallery={props.gallery} />;
};
