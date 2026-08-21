import React, { useState, useEffect, useRef, useCallback } from "react";
import { Gallery, ImageInfo } from "../../types";
import { getGalleryDisplayTitle, getCoverUrl, buildImageFallbacks, getGallery } from "../../utils/ipc";
import { useHistoryStore } from "../../stores/historyStore";
import { Icon } from "../common/Icon";
import { FastScrollRail } from "./FastScrollRail";
import { SmartImage } from "../common/SmartImage";
import { QuickShareModal } from "../common/QuickShareModal";

interface ReaderModalProps {
  gallery: Gallery | null;
  initialPage?: number;
  onClose: () => void;
}

type ReadingMode = "manga-rtl" | "manga-ltr" | "webtoon";
type ZoomMode = "fit-width" | "fit-height" | "original";
type PreloadOption = 1 | 2 | 3 | 4 | 5 | "all";

// High-Performance Image Component with RAM Cache and Multi-Format Auto-Fallback
const ReaderImage: React.FC<{
  galleryId: number;
  mediaId: string;
  pageIndex: number;
  pageInfo?: ImageInfo;
  className?: string;
  alt?: string;
  priority?: boolean;
}> = ({ galleryId, mediaId, pageIndex, pageInfo, className = "", alt = "", priority = false }) => {
  const pageNum = pageInfo?.number || pageIndex + 1;
  const pagePath = pageInfo?.path || "";

  const candidateUrls = React.useMemo(() => {
    return buildImageFallbacks(pagePath, "page", mediaId, pageNum);
  }, [pagePath, mediaId, pageNum]);

  return (
    <div className="relative flex items-center justify-center max-w-full max-h-full bg-[#14141c]/50 rounded overflow-hidden">
      <SmartImage
        candidates={candidateUrls}
        alt={alt || `Page ${pageNum}`}
        priority={priority}
        className="max-w-full max-h-full flex items-center justify-center"
        imgClassName={className}
        referer={`https://nhentai.net/g/${galleryId}/${pageNum}/`}
      />
    </div>
  );
};

const ReaderModalContent: React.FC<ReaderModalProps & { gallery: Gallery }> = ({
  gallery,
  initialPage = 0,
  onClose,
}) => {
  const [currentGallery, setCurrentGallery] = useState<Gallery>(gallery);

  useEffect(() => {
    setCurrentGallery(gallery);
    if (!gallery.images?.pages || gallery.images.pages.length === 0) {
      getGallery(gallery.id)
        .then((full) => {
          if (full) setCurrentGallery(full);
        })
        .catch(() => {});
    }
  }, [gallery]);

  const [currentPage, setCurrentPage] = useState(initialPage);
  const [readingMode, setReadingMode] = useState<ReadingMode>("manga-rtl");
  const [zoomMode, setZoomMode] = useState<ZoomMode>("fit-height");
  const [preloadCount, setPreloadCount] = useState<PreloadOption>(3);
  const [preloadStatus, setPreloadStatus] = useState<"idle" | "loading" | "ready">("idle");
  const [brightness, setBrightness] = useState<number>(100);
  const [webtoonGap, setWebtoonGap] = useState<number>(8);
  const [doublePage, setDoublePage] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);

  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);

  const containerRef = useRef<HTMLDivElement>(null);
  const webtoonScrollRef = useRef<HTMLDivElement>(null);
  const lastWheelTimeRef = useRef<number>(0);

  const totalPages = currentGallery.images?.pages?.length || currentGallery.num_pages || 1;
  const title = getGalleryDisplayTitle(currentGallery);

  // Synchronize initial page
  useEffect(() => {
    setCurrentPage(initialPage);
  }, [initialPage]);

  // Save reading progress to History
  useEffect(() => {
    if (currentGallery && totalPages > 0) {
      useHistoryStore.getState().saveProgress({
        id: currentGallery.id,
        mediaId: currentGallery.media_id,
        title: getGalleryDisplayTitle(currentGallery),
        coverUrl: getCoverUrl(currentGallery),
        lastReadPage: currentPage,
        totalPages: totalPages,
      });
    }
  }, [currentPage, currentGallery, totalPages]);

  // High-Speed Browser Cache Preloading Engine (NHApp pattern)
  useEffect(() => {
    if (!currentGallery.images?.pages || currentGallery.images.pages.length === 0) return;
    const pages = currentGallery.images.pages;
    const mediaId = currentGallery.media_id;

    const startIdx = readingMode === "webtoon" ? 0 : Math.max(0, currentPage - 1);
    const count = preloadCount === "all" ? pages.length : (typeof preloadCount === "number" ? preloadCount + 2 : 3);
    const endIdx = preloadCount === "all" ? pages.length : Math.min(pages.length, startIdx + count);

    setPreloadStatus("loading");
    let loadedCount = 0;
    const totalToLoad = endIdx - startIdx;

    for (let i = startIdx; i < endIdx; i++) {
      const pageInfo = pages[i];
      if (!pageInfo) continue;
      const pageNum = pageInfo.number || i + 1;
      const pagePath = pageInfo.path || "";
      const candidates = buildImageFallbacks(pagePath, "page", mediaId, pageNum);
      if (candidates[0]) {
        const img = new Image();
        img.onload = () => {
          loadedCount++;
          if (loadedCount >= Math.min(3, totalToLoad)) {
            setPreloadStatus("ready");
          }
        };
        img.onerror = () => {
          loadedCount++;
          if (loadedCount >= totalToLoad) {
            setPreloadStatus("ready");
          }
        };
        img.src = candidates[0];
      }
    }
  }, [currentPage, preloadCount, currentGallery, readingMode]);

  const nextPage = useCallback(() => {
    const step = doublePage && readingMode !== "webtoon" ? 2 : 1;
    setCurrentPage((prev) => Math.min(totalPages - 1, prev + step));
  }, [totalPages, doublePage, readingMode]);

  const prevPage = useCallback(() => {
    const step = doublePage && readingMode !== "webtoon" ? 2 : 1;
    setCurrentPage((prev) => Math.max(0, prev - step));
  }, [doublePage, readingMode]);

  // Mode switch handler: maintain exact page alignment
  const handleModeChange = (newMode: ReadingMode) => {
    if (newMode === readingMode) return;
    setReadingMode(newMode);

    if (newMode === "webtoon") {
      setTimeout(() => {
        const el = document.getElementById(`webtoon-page-${currentPage}`);
        if (el) {
          el.scrollIntoView({ block: "start", behavior: "auto" });
        } else if (webtoonScrollRef.current) {
          webtoonScrollRef.current.scrollTop = 0;
        }
      }, 50);
    }
  };

  // Webtoon scroll listener: dynamically track visible page
  const handleWebtoonScroll = () => {
    if (readingMode !== "webtoon" || !webtoonScrollRef.current) return;
    const container = webtoonScrollRef.current;
    const scrollTop = container.scrollTop;
    const containerHeight = container.clientHeight;
    const centerY = scrollTop + containerHeight / 3;

    for (let i = 0; i < totalPages; i++) {
      const el = document.getElementById(`webtoon-page-${i}`);
      if (el) {
        const elTop = el.offsetTop;
        const elBottom = elTop + el.offsetHeight;
        if (centerY >= elTop && centerY <= elBottom) {
          if (currentPage !== i) {
            setCurrentPage(i);
          }
          break;
        }
      }
    }
  };

  const scrollToWebtoonPage = (pageIdx: number) => {
    const el = document.getElementById(`webtoon-page-${pageIdx}`);
    if (el) {
      el.scrollIntoView({ block: "start", behavior: "smooth" });
      setCurrentPage(pageIdx);
    }
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (e.key === "Escape") {
        if (isSettingsOpen) {
          setIsSettingsOpen(false);
          return;
        }
        onClose();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        nextPage();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        prevPage();
      } else if (e.key === "ArrowDown") {
        if (readingMode === "webtoon") {
          e.preventDefault();
          webtoonScrollRef.current?.scrollBy({ top: 300, behavior: "smooth" });
        } else {
          e.preventDefault();
          nextPage();
        }
      } else if (e.key === "ArrowUp") {
        if (readingMode === "webtoon") {
          e.preventDefault();
          webtoonScrollRef.current?.scrollBy({ top: -300, behavior: "smooth" });
        } else {
          e.preventDefault();
          prevPage();
        }
      } else if (e.key === " " || e.key === "Spacebar") {
        e.preventDefault();
        if (readingMode === "webtoon") {
          const mult = e.shiftKey ? -0.8 : 0.8;
          webtoonScrollRef.current?.scrollBy({
            top: (webtoonScrollRef.current?.clientHeight || 600) * mult,
            behavior: "smooth",
          });
        } else {
          if (e.shiftKey) prevPage();
          else nextPage();
        }
      } else if (e.key === "PageDown") {
        e.preventDefault();
        if (readingMode === "webtoon") {
          webtoonScrollRef.current?.scrollBy({
            top: webtoonScrollRef.current?.clientHeight || 600,
            behavior: "smooth",
          });
        } else {
          nextPage();
        }
      } else if (e.key === "PageUp") {
        e.preventDefault();
        if (readingMode === "webtoon") {
          webtoonScrollRef.current?.scrollBy({
            top: -(webtoonScrollRef.current?.clientHeight || 600),
            behavior: "smooth",
          });
        } else {
          prevPage();
        }
      } else if (e.key === "Home") {
        e.preventDefault();
        setCurrentPage(0);
        if (readingMode === "webtoon" && webtoonScrollRef.current) {
          webtoonScrollRef.current.scrollTop = 0;
        }
      } else if (e.key === "End") {
        e.preventDefault();
        setCurrentPage(totalPages - 1);
        if (readingMode === "webtoon" && webtoonScrollRef.current) {
          webtoonScrollRef.current.scrollTop = webtoonScrollRef.current.scrollHeight;
        }
      } else if (e.key === "f" || e.key === "F") {
        toggleFullscreen();
      } else if (e.key === "m" || e.key === "M") {
        handleModeChange(
          readingMode === "manga-rtl" ? "webtoon" : readingMode === "webtoon" ? "manga-ltr" : "manga-rtl"
        );
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentPage, readingMode, totalPages, nextPage, prevPage, onClose, isSettingsOpen]);

  // Mouse wheel handler for Manga Single-Page Mode
  const handleWheel = (e: React.WheelEvent) => {
    if (readingMode === "webtoon") {
      return;
    }

    const now = Date.now();
    if (now - lastWheelTimeRef.current < 180) {
      return;
    }

    if (Math.abs(e.deltaY) > 20) {
      lastWheelTimeRef.current = now;
      if (e.deltaY > 0) {
        nextPage();
      } else {
        prevPage();
      }
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  const currentPageInfo = currentGallery.images?.pages?.[currentPage];

  const nextPageInfo = doublePage && currentPage + 1 < totalPages
    ? currentGallery.images?.pages?.[currentPage + 1]
    : null;

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 bg-[#0c0c10] text-gray-100 flex flex-col select-none overflow-hidden"
      onWheel={handleWheel}
    >
      {/* Top Floating Controls Bar */}
      <div
        className={`absolute top-0 left-0 right-0 z-30 px-6 py-3 bg-gradient-to-b from-black/95 via-black/70 to-transparent flex items-center justify-between transition-opacity duration-200 ${
          showControls ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      >
        <div className="flex items-center gap-4 min-w-0">
          <button
            onClick={onClose}
            className="p-2 rounded-lg bg-[#20202e]/80 hover:bg-[#2e2e42] text-gray-300 hover:text-white transition-colors cursor-pointer"
            title="Fermer la liseuse (Échap)"
          >
            <Icon name="close" size={20} />
          </button>
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-white truncate max-w-xl">
              {title}
            </h2>
            <div className="text-[11px] text-gray-400 font-mono flex items-center gap-2">
              <span>Page {currentPage + 1} sur {totalPages}</span>
              <span>•</span>
              <span className="text-[#ed2553]">#d{currentGallery.id}</span>
              {preloadStatus === "loading" && (
                <span className="flex items-center gap-1 text-amber-400 text-[10px]">
                  <Icon name="sync" size={12} className="animate-spin" />
                  <span>Mise en cache RAM...</span>
                </span>
              )}
              {preloadStatus === "ready" && (
                <span className="flex items-center gap-1 text-emerald-400 text-[10px]">
                  <Icon name="bolt" size={12} />
                  <span>RAM 0ms</span>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Reader Mode, Settings & Controls */}
        <div className="flex items-center gap-2 relative">
          {/* Mode Switcher */}
          <div className="flex items-center bg-[#1c1c28]/90 border border-[#2b2b3d] rounded-lg p-0.5">
            <button
              onClick={() => handleModeChange("manga-rtl")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                readingMode === "manga-rtl"
                  ? "bg-[#ed2553] text-white shadow-xs"
                  : "text-gray-400 hover:text-gray-200"
              }`}
              title="Mode Manga (Page par page)"
            >
              <Icon name="auto_stories" size={16} />
              <span>Manga</span>
            </button>
            <button
              onClick={() => handleModeChange("webtoon")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all cursor-pointer ${
                readingMode === "webtoon"
                  ? "bg-[#ed2553] text-white shadow-xs"
                  : "text-gray-400 hover:text-gray-200"
              }`}
              title="Mode Webtoon (Défilement vertical continu)"
            >
              <Icon name="view_day" size={16} />
              <span>Webtoon</span>
            </button>
          </div>

          {/* Reader Settings Popover Button */}
          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsSettingsOpen(!isSettingsOpen);
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all cursor-pointer ${
                isSettingsOpen
                  ? "bg-[#ed2553] text-white border-[#f43f5e] shadow-md shadow-[#ed2553]/25"
                  : "bg-[#1c1c28]/90 hover:bg-[#28283a] text-gray-300 hover:text-white border-[#2b2b3d]"
              }`}
              title="Paramètres de Lecture & Préchargement"
            >
              <Icon name="tune" size={16} className={isSettingsOpen ? "text-white" : "text-rose-400"} />
              <span>Options</span>
            </button>

            {/* Reader Settings Dropdown Modal */}
            {isSettingsOpen && (
              <div
                onClick={(e) => e.stopPropagation()}
                className="absolute right-0 top-full mt-2 w-80 bg-[#161620] border border-[#2e2e42] rounded-2xl shadow-2xl p-4.5 space-y-4 z-50 text-xs text-gray-200 animate-in fade-in zoom-in-95 duration-150"
              >
                {/* Header */}
                <div className="flex items-center justify-between border-b border-[#262638] pb-2.5">
                  <div className="flex items-center gap-2 font-bold text-white text-sm">
                    <Icon name="tune" size={18} className="text-rose-400" />
                    <span>Options de Lecture</span>
                  </div>
                  <button
                    onClick={() => setIsSettingsOpen(false)}
                    className="p-1 rounded-md text-gray-400 hover:text-white hover:bg-[#252536] cursor-pointer"
                  >
                    <Icon name="close" size={16} />
                  </button>
                </div>

                {/* 1. Preload Engine (1, 2, 3, 4, 5, TOUTES) */}
                <div className="space-y-2">
                  <label className="font-bold text-gray-300 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Icon name="bolt" size={15} className="text-amber-400" />
                      <span>Mise en Cache RAM</span>
                    </span>
                    <span className="text-[11px] font-mono text-rose-400 font-bold">
                      {preloadCount === "all" ? "INTÉGRAL (0ms)" : `+${preloadCount} pages`}
                    </span>
                  </label>
                  <div className="grid grid-cols-6 gap-1">
                    {([1, 2, 3, 4, 5, "all"] as PreloadOption[]).map((opt) => (
                      <button
                        key={String(opt)}
                        onClick={() => setPreloadCount(opt)}
                        className={`py-1.5 rounded-lg font-bold text-xs transition-all cursor-pointer border ${
                          preloadCount === opt
                            ? "bg-[#ed2553] text-white border-transparent shadow-xs"
                            : "bg-[#20202c] text-gray-400 border-[#2f2f42] hover:text-white hover:bg-[#2b2b3a]"
                        }`}
                        title={opt === "all" ? "Mettre en cache toutes les pages en RAM" : `Précharger ${opt} page(s) à l'avance`}
                      >
                        {opt === "all" ? "TOUT" : opt}
                      </button>
                    ))}
                  </div>
                  <p className="text-[10px] text-gray-500 leading-tight">
                    {preloadCount === "all"
                      ? "⚡ Toutes les pages sont téléchargées en mémoire RAM pour une lecture 0ms instantanée."
                      : `Les ${preloadCount} prochaines pages se téléchargent en RAM en tâche de fond.`}
                  </p>
                </div>

                {/* 2. Image Fit Zoom Mode */}
                {readingMode !== "webtoon" && (
                  <div className="space-y-2 pt-1 border-t border-[#262638]">
                    <label className="font-bold text-gray-300 flex items-center gap-1.5">
                      <Icon name="aspect_ratio" size={15} className="text-cyan-400" />
                      <span>Ajustement de l'Image</span>
                    </label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {[
                        { id: "fit-height", label: "Hauteur" },
                        { id: "fit-width", label: "Largeur" },
                        { id: "original", label: "100% Réel" },
                      ].map((zm) => (
                        <button
                          key={zm.id}
                          onClick={() => setZoomMode(zm.id as ZoomMode)}
                          className={`py-1.5 rounded-lg text-xs font-semibold transition-all border cursor-pointer ${
                            zoomMode === zm.id
                              ? "bg-[#ed2553] text-white border-transparent shadow-xs"
                              : "bg-[#20202c] text-gray-400 border-[#2f2f42] hover:text-white"
                          }`}
                        >
                          {zm.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* 3. Double Page Spread Mode */}
                {readingMode !== "webtoon" && (
                  <div className="flex items-center justify-between pt-1 border-t border-[#262638]">
                    <span className="font-bold text-gray-300 flex items-center gap-1.5">
                      <Icon name="chrome_reader_mode" size={15} className="text-emerald-400" />
                      <span>Mode Double Page</span>
                    </span>
                    <button
                      onClick={() => setDoublePage(!doublePage)}
                      className={`px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
                        doublePage
                          ? "bg-emerald-500 text-white"
                          : "bg-[#20202c] text-gray-400 border border-[#2f2f42]"
                      }`}
                    >
                      {doublePage ? "Activé (2p)" : "Désactivé (1p)"}
                    </button>
                  </div>
                )}

                {/* 4. Webtoon Spacing Gap */}
                {readingMode === "webtoon" && (
                  <div className="space-y-2 pt-1 border-t border-[#262638]">
                    <label className="font-bold text-gray-300 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Icon name="space_bar" size={15} className="text-purple-400" />
                        <span>Espacement Webtoon</span>
                      </span>
                      <span className="font-mono text-gray-400 text-[11px]">{webtoonGap}px</span>
                    </label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {[
                        { val: 0, label: "Continu (0px)" },
                        { val: 8, label: "Fin (8px)" },
                        { val: 16, label: "Large (16px)" },
                      ].map((g) => (
                        <button
                          key={g.val}
                          onClick={() => setWebtoonGap(g.val)}
                          className={`py-1.5 rounded-lg text-xs font-semibold transition-all border cursor-pointer ${
                            webtoonGap === g.val
                              ? "bg-[#ed2553] text-white border-transparent"
                              : "bg-[#20202c] text-gray-400 border-[#2f2f42] hover:text-white"
                          }`}
                        >
                          {g.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* 5. Brightness / Night Comfort Filter */}
                <div className="space-y-1.5 pt-1 border-t border-[#262638]">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-gray-300 flex items-center gap-1.5">
                      <Icon name="brightness_medium" size={15} className="text-amber-300" />
                      <span>Luminosité / Confort</span>
                    </span>
                    <span className="font-mono text-gray-400 text-[11px]">{brightness}%</span>
                  </div>
                  <input
                    type="range"
                    min={40}
                    max={100}
                    value={brightness}
                    onChange={(e) => setBrightness(parseInt(e.target.value, 10))}
                    className="w-full accent-[#ed2553] cursor-pointer"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Quick Share & AirDrop */}
          <button
            onClick={() => setIsShareOpen(true)}
            className="p-2 rounded-lg bg-[#20202e]/80 hover:bg-[#2e2e42] text-gray-300 hover:text-white transition-colors cursor-pointer"
            title="Partager le manga (AirDrop, QR Code, Liens)"
          >
            <Icon name="share" size={20} className="text-cyan-400" />
          </button>

          {/* Fullscreen Toggle */}
          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-lg bg-[#20202e]/80 hover:bg-[#2e2e42] text-gray-300 hover:text-white transition-colors cursor-pointer"
            title="Plein Écran (F)"
          >
            <Icon name={isFullscreen ? "fullscreen_exit" : "fullscreen"} size={20} />
          </button>
        </div>
      </div>

      {/* Main Reader Viewport with Brightness filter applied */}
      <div
        className="flex-1 w-full h-full relative"
        style={{ filter: `brightness(${brightness}%)` }}
      >
        {readingMode === "webtoon" ? (
          /* Webtoon Continuous Scroll View */
          <div
            ref={webtoonScrollRef}
            onScroll={handleWebtoonScroll}
            onClick={() => setShowControls((prev) => !prev)}
            className="w-full h-full overflow-y-auto overflow-x-hidden bg-[#0c0c10]"
          >
            <div
              className="max-w-3xl mx-auto pt-16 pb-20 px-2 flex flex-col items-center"
              style={{ gap: `${webtoonGap}px` }}
            >
              {Array.from({ length: totalPages }).map((_, idx) => {
                const p = currentGallery.images?.pages?.[idx];
                return (
                  <div
                    key={idx}
                    id={`webtoon-page-${idx}`}
                    className="w-full relative bg-[#14141c] rounded shadow-lg overflow-hidden flex flex-col items-center"
                  >
                    <ReaderImage
                      galleryId={currentGallery.id}
                      mediaId={currentGallery.media_id || String(currentGallery.id)}
                      pageIndex={idx}
                      pageInfo={p}
                      className="w-full h-auto block"
                      alt={`Page ${idx + 1}`}
                      priority={idx < 4}
                    />
                    <div className="w-full text-center text-[10px] text-gray-500 py-1 bg-black/60 font-mono">
                      Page {idx + 1} / {totalPages}
                    </div>
                  </div>
                );
              })}
            </div>

            <FastScrollRail
              totalPages={totalPages}
              currentPage={currentPage}
              onPageSelect={scrollToWebtoonPage}
              containerRef={webtoonScrollRef}
            />
          </div>
        ) : (
          /* Single Page / Double Page Manga View */
          <div
            className="w-full h-full overflow-hidden flex items-center justify-center relative bg-[#0c0c10]"
            onClick={() => setShowControls((prev) => !prev)}
          >
            <div className="relative flex items-center justify-center gap-2 max-h-full max-w-full">
              {/* Left Page (in double page mode) */}
              {doublePage && nextPageInfo && (
                <ReaderImage
                  key={`page-${currentPage + 1}`}
                  galleryId={currentGallery.id}
                  mediaId={currentGallery.media_id || String(currentGallery.id)}
                  pageIndex={currentPage + 1}
                  pageInfo={nextPageInfo}
                  priority={true}
                  className={`object-contain shadow-2xl rounded border border-white/5 ${
                    zoomMode === "fit-width"
                      ? "max-w-[48vw] h-auto"
                      : "max-h-[92vh] max-w-[48vw] w-auto"
                  }`}
                />
              )}

              {/* Main Page */}
              <ReaderImage
                key={`page-${currentPage}`}
                galleryId={currentGallery.id}
                mediaId={currentGallery.media_id || String(currentGallery.id)}
                pageIndex={currentPage}
                pageInfo={currentPageInfo}
                priority={true}
                className={`object-contain shadow-2xl rounded border border-white/5 transition-all duration-150 ${
                  doublePage
                    ? "max-h-[92vh] max-w-[48vw] w-auto"
                    : zoomMode === "fit-width"
                    ? "w-full h-auto"
                    : zoomMode === "fit-height"
                    ? "h-[92vh] w-auto"
                    : "w-auto h-auto"
                }`}
              />

              {/* Click Navigation Zones */}
              <div
                className="absolute top-0 bottom-0 left-0 w-1/3 cursor-w-resize z-10"
                onClick={(e) => {
                  e.stopPropagation();
                  prevPage();
                }}
                title="Page Précédente (←)"
              />
              <div
                className="absolute top-0 bottom-0 right-0 w-1/3 cursor-e-resize z-10"
                onClick={(e) => {
                  e.stopPropagation();
                  nextPage();
                }}
                title="Page Suivante (→)"
              />
            </div>
          </div>
        )}
      </div>

      {/* Bottom Floating Navigation Bar (For Manga Mode) */}
      {readingMode !== "webtoon" && (
        <div
          className={`absolute bottom-0 left-0 right-0 z-30 px-6 py-4 bg-gradient-to-t from-black/95 via-black/70 to-transparent flex items-center justify-center gap-4 transition-opacity duration-200 ${
            showControls ? "opacity-100" : "opacity-0 pointer-events-none"
          }`}
        >
          <div className="bg-[#14141e]/90 backdrop-blur-md border border-[#2b2b3d] px-4 py-2 rounded-2xl flex items-center gap-4 shadow-2xl">
            <button
              onClick={() => prevPage()}
              disabled={currentPage <= 0}
              className="p-1.5 rounded-lg bg-[#20202e] hover:bg-[#2d2d40] disabled:opacity-30 disabled:pointer-events-none text-gray-200 transition-colors cursor-pointer"
              title="Page Précédente (←)"
            >
              <Icon name="chevron_left" size={20} />
            </button>

            {/* Slider */}
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={0}
                max={totalPages - 1}
                value={currentPage}
                onChange={(e) => setCurrentPage(parseInt(e.target.value, 10))}
                className="w-48 sm:w-64 accent-[#ed2553] cursor-pointer"
              />
              <span className="text-xs font-mono font-bold text-gray-200 min-w-[60px] text-center">
                {doublePage && currentPage + 1 < totalPages
                  ? `${currentPage + 1}-${currentPage + 2} / ${totalPages}`
                  : `${currentPage + 1} / ${totalPages}`}
              </span>
            </div>

            <button
              onClick={() => nextPage()}
              disabled={currentPage >= totalPages - 1}
              className="p-1.5 rounded-lg bg-[#20202e] hover:bg-[#2d2d40] disabled:opacity-30 disabled:pointer-events-none text-gray-200 transition-colors cursor-pointer"
              title="Page Suivante (→)"
            >
              <Icon name="chevron_right" size={20} />
            </button>
          </div>
        </div>
      )}

      {isShareOpen && (
        <QuickShareModal
          gallery={currentGallery}
          onClose={() => setIsShareOpen(false)}
        />
      )}
    </div>
  );
};

export const ReaderModal: React.FC<ReaderModalProps> = (props) => {
  if (!props.gallery) return null;
  return <ReaderModalContent {...props} gallery={props.gallery} />;
};
