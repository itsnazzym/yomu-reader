import React, { useState, useEffect, useRef, useCallback } from "react";
import { LocalBookItem, LocalBookContent } from "../../types";
import { readLocalBook, openFolder } from "../../utils/ipc";
import { useHistoryStore } from "../../stores/historyStore";
import { Icon } from "../common/Icon";
import { FastScrollRail } from "../reader/FastScrollRail";

interface LocalReaderModalProps {
  book: LocalBookItem | null;
  onClose: () => void;
}

type ReadingMode = "manga-rtl" | "manga-ltr" | "webtoon";
type ZoomMode = "fit-width" | "fit-height" | "original";

export const LocalReaderModal: React.FC<LocalReaderModalProps> = ({ book, onClose }) => {
  if (!book) return null;

  const [bookContent, setBookContent] = useState<LocalBookContent | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Reader settings
  const [currentPage, setCurrentPage] = useState(0);
  const [readingMode, setReadingMode] = useState<ReadingMode>("manga-rtl");
  const [zoomMode, setZoomMode] = useState<ZoomMode>("fit-height");
  const [doublePage, setDoublePage] = useState(false);
  const [brightness, setBrightness] = useState(100);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [showBrightnessSlider, setShowBrightnessSlider] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const webtoonScrollRef = useRef<HTMLDivElement>(null);

  // Load CBZ/ZIP archive contents on open
  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);
    setLoadError(null);
    setCurrentPage(0);

    readLocalBook(book.filePath)
      .then((content) => {
        if (isMounted) {
          if (!content || content.pages.length === 0) {
            setLoadError("Aucune image trouvée dans cette archive ou ce dossier.");
          } else {
            setBookContent(content);
          }
          setIsLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setLoadError(err.message || "Erreur lors de la lecture du fichier local.");
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [book.filePath]);

  const totalPages = bookContent?.totalPages || bookContent?.pages?.length || 0;

  // Save reading progress to History
  useEffect(() => {
    if (book && totalPages > 0) {
      useHistoryStore.getState().saveProgress({
        id: book.galleryId || Math.abs(book.filePath.split("").reduce((a, b) => ((a << 5) - a + b.charCodeAt(0)) | 0, 0)),
        title: book.title || book.filename,
        coverUrl: book.coverDataUrl,
        lastReadPage: currentPage,
        totalPages: totalPages,
        isLocal: true,
        filePath: book.filePath,
      });
    }
  }, [currentPage, book, totalPages]);

  // Navigation handlers
  const nextPage = useCallback(() => {
    if (readingMode === "webtoon") return;
    const step = doublePage ? 2 : 1;
    if (readingMode === "manga-rtl") {
      setCurrentPage((prev) => Math.min(totalPages - 1, prev + step));
    } else {
      setCurrentPage((prev) => Math.min(totalPages - 1, prev + step));
    }
  }, [readingMode, doublePage, totalPages]);

  const prevPage = useCallback(() => {
    if (readingMode === "webtoon") return;
    const step = doublePage ? 2 : 1;
    if (readingMode === "manga-rtl") {
      setCurrentPage((prev) => Math.max(0, prev - step));
    } else {
      setCurrentPage((prev) => Math.max(0, prev - step));
    }
  }, [readingMode, doublePage]);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  }, []);

  const handleWebtoonScroll = () => {
    if (readingMode !== "webtoon" || !webtoonScrollRef.current) return;
    const container = webtoonScrollRef.current;
    const scrollTop = container.scrollTop;
    const centerY = scrollTop + container.clientHeight / 3;

    for (let i = 0; i < totalPages; i++) {
      const el = document.getElementById(`local-webtoon-page-${i}`);
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
    const el = document.getElementById(`local-webtoon-page-${pageIdx}`);
    if (el) {
      el.scrollIntoView({ block: "start", behavior: "smooth" });
      setCurrentPage(pageIdx);
    }
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore when inside input/textarea
      if (["INPUT", "TEXTAREA", "SELECT"].includes((e.target as HTMLElement)?.tagName)) return;

      switch (e.key) {
        case "ArrowRight":
          e.preventDefault();
          if (readingMode === "manga-rtl") prevPage();
          else nextPage();
          break;
        case "ArrowLeft":
          e.preventDefault();
          if (readingMode === "manga-rtl") nextPage();
          else prevPage();
          break;
        case " ":
          e.preventDefault();
          nextPage();
          break;
        case "Escape":
          e.preventDefault();
          if (document.fullscreenElement) {
            document.exitFullscreen().catch(() => {});
            setIsFullscreen(false);
          } else {
            onClose();
          }
          break;
        case "f":
        case "F":
          e.preventDefault();
          toggleFullscreen();
          break;
        case "m":
        case "M":
          e.preventDefault();
          setReadingMode((prev) => (prev === "webtoon" ? "manga-rtl" : "webtoon"));
          break;
        case "d":
        case "D":
          e.preventDefault();
          setDoublePage((prev) => !prev);
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [nextPage, prevPage, toggleFullscreen, onClose, readingMode]);

  // Fullscreen change listener
  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFsChange);
    return () => document.removeEventListener("fullscreenchange", handleFsChange);
  }, []);

  const displayTitle = bookContent?.title || book.title || book.filename.replace(/\.(cbz|zip)$/i, "");
  const displayArtist = bookContent?.artist || book.artist || "Artiste Inconnu";

  const currentPageObj = bookContent?.pages?.[currentPage];
  const nextPageObj = doublePage && currentPage + 1 < totalPages ? bookContent?.pages?.[currentPage + 1] : null;

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 bg-[#09090d] text-gray-100 flex flex-col select-none overflow-hidden"
    >
      {/* Top Floating Control Bar */}
      <div
        className={`absolute top-0 inset-x-0 z-30 transition-transform duration-300 ${
          showControls ? "translate-y-0" : "-translate-y-full"
        }`}
      >
        <div className="bg-[#12121a]/90 backdrop-blur-md border-b border-[#252535] px-4 py-2.5 flex items-center justify-between shadow-2xl">
          {/* Left: Close Button & Metadata */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg bg-[#20202e] hover:bg-[#ed2553] text-gray-300 hover:text-white transition-all shadow-md cursor-pointer"
              title="Fermer le lecteur (Échap)"
            >
              <Icon name="close" size={20} />
            </button>

            <div className="min-w-0">
              <h2 className="text-xs font-bold text-white truncate max-w-md sm:max-w-xl">
                {displayTitle}
              </h2>
              <div className="flex items-center gap-2 text-[11px] text-gray-400">
                <span className="text-rose-400 font-semibold truncate">{displayArtist}</span>
                <span>•</span>
                <span className="px-1.5 py-0.2 rounded bg-emerald-950 text-emerald-300 border border-emerald-500/40 text-[10px] font-mono font-bold uppercase">
                  {bookContent?.format?.toUpperCase() || (book.isCbz ? "CBZ" : book.isFolder ? "DOSSIER" : "ZIP")}
                </span>
                <span>•</span>
                <span className="font-mono text-gray-300">
                  Page {currentPage + 1} / {totalPages || "?"}
                </span>
              </div>
            </div>
          </div>

          {/* Right: Quick Reader Controls */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Mode Switch: Manga / Webtoon */}
            <div className="flex items-center bg-[#1c1c28] p-0.5 rounded-lg border border-[#2b2b3d]">
              <button
                onClick={() => setReadingMode("manga-rtl")}
                className={`px-2.5 py-1 rounded text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                  readingMode !== "webtoon"
                    ? "bg-[#ed2553] text-white shadow"
                    : "text-gray-400 hover:text-gray-200"
                }`}
                title="Mode Manga (Page par Page - M)"
              >
                <Icon name="auto_stories" size={15} />
                <span className="hidden sm:inline">Manga</span>
              </button>
              <button
                onClick={() => setReadingMode("webtoon")}
                className={`px-2.5 py-1 rounded text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                  readingMode === "webtoon"
                    ? "bg-[#ed2553] text-white shadow"
                    : "text-gray-400 hover:text-gray-200"
                }`}
                title="Mode Webtoon (Défilement vertical continu - M)"
              >
                <Icon name="view_day" size={15} />
                <span className="hidden sm:inline">Webtoon</span>
              </button>
            </div>

            {/* Double Page Toggle (Manga Mode Only) */}
            {readingMode !== "webtoon" && (
              <button
                onClick={() => setDoublePage((prev) => !prev)}
                className={`p-1.5 rounded-lg border transition-colors cursor-pointer ${
                  doublePage
                    ? "bg-[#ed2553]/20 border-[#ed2553] text-[#ed2553]"
                    : "bg-[#1c1c28] border-[#2b2b3d] text-gray-400 hover:text-white"
                }`}
                title="Mode Double Planche (D)"
              >
                <Icon name="menu_book" size={18} />
              </button>
            )}

            {/* Zoom / Fit Mode */}
            <button
              onClick={() => {
                setZoomMode((prev) =>
                  prev === "fit-height" ? "fit-width" : prev === "fit-width" ? "original" : "fit-height"
                );
              }}
              className="p-1.5 rounded-lg bg-[#1c1c28] border border-[#2b2b3d] text-gray-300 hover:text-white transition-colors cursor-pointer"
              title={`Ajustement : ${
                zoomMode === "fit-height" ? "Pleine Hauteur" : zoomMode === "fit-width" ? "Pleine Largeur" : "Original"
              }`}
            >
              <Icon
                name={
                  zoomMode === "fit-height"
                    ? "fit_screen"
                    : zoomMode === "fit-width"
                    ? "aspect_ratio"
                    : "zoom_in"
                }
                size={18}
              />
            </button>

            {/* Brightness Control Toggle */}
            <div className="relative">
              <button
                onClick={() => setShowBrightnessSlider((prev) => !prev)}
                className="p-1.5 rounded-lg bg-[#1c1c28] border border-[#2b2b3d] text-gray-300 hover:text-white transition-colors cursor-pointer"
                title="Luminosité"
              >
                <Icon name="brightness_medium" size={18} />
              </button>
              {showBrightnessSlider && (
                <div className="absolute right-0 top-full mt-2 w-48 bg-[#181824] border border-[#2d2d3f] p-3 rounded-lg shadow-2xl z-40 flex flex-col gap-2">
                  <div className="flex justify-between text-[11px] font-mono text-gray-300">
                    <span>Luminosité</span>
                    <span className="text-rose-400">{brightness}%</span>
                  </div>
                  <input
                    type="range"
                    min={20}
                    max={130}
                    value={brightness}
                    onChange={(e) => setBrightness(parseInt(e.target.value, 10))}
                    className="w-full accent-[#ed2553] cursor-pointer"
                  />
                </div>
              )}
            </div>

            {/* Reveal File in Explorer */}
            <button
              onClick={() => openFolder(book.filePath)}
              className="p-1.5 rounded-lg bg-[#1c1c28] border border-[#2b2b3d] text-gray-300 hover:text-amber-400 transition-colors cursor-pointer"
              title="Révéler le fichier dans l'explorateur"
            >
              <Icon name="folder_open" size={18} />
            </button>

            {/* Fullscreen Toggle */}
            <button
              onClick={toggleFullscreen}
              className="p-1.5 rounded-lg bg-[#1c1c28] border border-[#2b2b3d] text-gray-300 hover:text-white transition-colors cursor-pointer"
              title="Plein Écran (F)"
            >
              <Icon name={isFullscreen ? "fullscreen_exit" : "fullscreen"} size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* Main Viewport */}
      <div
        className="flex-1 w-full h-full relative flex items-center justify-center overflow-hidden"
        style={{ filter: `brightness(${brightness}%)` }}
      >
        {isLoading ? (
          <div className="flex flex-col items-center justify-center space-y-4">
            <div className="w-12 h-12 border-3 border-[#ed2553] border-t-transparent rounded-full animate-spin" />
            <div className="text-sm font-semibold text-gray-300">
              Extraction de l'archive ({book.isCbz ? "CBZ" : book.isFolder ? "Dossier" : "ZIP"})...
            </div>
          </div>
        ) : loadError ? (
          <div className="flex flex-col items-center justify-center space-y-3 max-w-md text-center p-6 bg-[#161622] rounded-xl border border-red-500/30">
            <Icon name="error_outline" size={40} className="text-red-400" />
            <div className="text-sm font-bold text-white">Impossible d'ouvrir ce manga</div>
            <div className="text-xs text-gray-400">{loadError}</div>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-[#ed2553] hover:bg-[#f43f5e] rounded-lg text-xs font-bold text-white transition-colors cursor-pointer mt-2"
            >
              Retour à la bibliothèque
            </button>
          </div>
        ) : readingMode === "webtoon" ? (
          /* Webtoon Continuous Scroll */
          <div
            ref={webtoonScrollRef}
            onScroll={handleWebtoonScroll}
            onClick={() => setShowControls((prev) => !prev)}
            className="w-full h-full overflow-y-auto overflow-x-hidden bg-[#0a0a0f]"
          >
            <div className="max-w-3xl mx-auto pt-16 pb-20 px-2 flex flex-col items-center space-y-2">
              {(bookContent?.pages || []).map((page, idx) => (
                <div key={idx} id={`local-webtoon-page-${idx}`} className="w-full flex flex-col items-center">
                  <img
                    src={page.dataUrl}
                    alt={`Page ${page.number}`}
                    loading={idx < 4 ? "eager" : "lazy"}
                    className="w-full h-auto object-contain rounded shadow-lg"
                  />
                  <div className="w-full text-center text-[10px] text-gray-500 py-1 font-mono">
                    Page {page.number} / {totalPages}
                  </div>
                </div>
              ))}
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
            onClick={() => setShowControls((prev) => !prev)}
            className="w-full h-full flex items-center justify-center relative p-2"
          >
            <div className="relative flex items-center justify-center gap-2 max-h-full max-w-full">
              {/* Left page (in double page mode) */}
              {doublePage && nextPageObj && (
                <img
                  src={nextPageObj.dataUrl}
                  alt={`Page ${nextPageObj.number}`}
                  className={`object-contain rounded shadow-2xl transition-all ${
                    zoomMode === "fit-width"
                      ? "max-w-[48vw] h-auto"
                      : "max-h-[90vh] max-w-[48vw] w-auto"
                  }`}
                />
              )}

              {/* Main current page */}
              {currentPageObj && (
                <img
                  src={currentPageObj.dataUrl}
                  alt={`Page ${currentPageObj.number}`}
                  className={`object-contain rounded shadow-2xl transition-all ${
                    doublePage
                      ? "max-h-[90vh] max-w-[48vw] w-auto"
                      : zoomMode === "fit-width"
                      ? "w-full h-auto max-w-[90vw]"
                      : zoomMode === "fit-height"
                      ? "h-[90vh] w-auto max-w-[90vw]"
                      : "w-auto h-auto max-w-[95vw] max-h-[95vh]"
                  }`}
                />
              )}

              {/* Interactive Click Zones */}
              <div
                className="absolute top-0 bottom-0 left-0 w-1/3 cursor-w-resize z-10"
                onClick={(e) => {
                  e.stopPropagation();
                  if (readingMode === "manga-rtl") prevPage();
                  else nextPage();
                }}
                title={readingMode === "manga-rtl" ? "Page Précédente" : "Page Suivante"}
              />
              <div
                className="absolute top-0 bottom-0 right-0 w-1/3 cursor-e-resize z-10"
                onClick={(e) => {
                  e.stopPropagation();
                  if (readingMode === "manga-rtl") nextPage();
                  else prevPage();
                }}
                title={readingMode === "manga-rtl" ? "Page Suivante" : "Page Précédente"}
              />
            </div>
          </div>
        )}
      </div>

      {/* Bottom Floating Navigation Slider (Manga Mode) */}
      {readingMode !== "webtoon" && !isLoading && !loadError && (
        <div
          className={`absolute bottom-0 inset-x-0 z-30 transition-transform duration-300 ${
            showControls ? "translate-y-0" : "translate-y-full"
          }`}
        >
          <div className="bg-[#12121a]/90 backdrop-blur-md border-t border-[#252535] px-6 py-3 flex items-center justify-between gap-4 max-w-2xl mx-auto rounded-t-2xl shadow-2xl">
            {/* Prev Button */}
            <button
              onClick={prevPage}
              disabled={currentPage === 0}
              className="p-2 rounded-lg bg-[#20202e] hover:bg-[#ed2553] text-gray-200 hover:text-white transition-colors disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
              title="Page Précédente (←)"
            >
              <Icon name="chevron_left" size={20} />
            </button>

            {/* Slider */}
            <div className="flex-1 flex items-center gap-3">
              <input
                type="range"
                min={0}
                max={Math.max(0, totalPages - 1)}
                value={currentPage}
                onChange={(e) => setCurrentPage(parseInt(e.target.value, 10))}
                className="w-full accent-[#ed2553] cursor-pointer"
              />
              <div className="text-xs font-mono font-bold text-gray-300 shrink-0">
                <span className="text-rose-400">{currentPage + 1}</span> / {totalPages}
              </div>
            </div>

            {/* Next Button */}
            <button
              onClick={nextPage}
              disabled={currentPage >= totalPages - 1}
              className="p-2 rounded-lg bg-[#20202e] hover:bg-[#ed2553] text-gray-200 hover:text-white transition-colors disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
              title="Page Suivante (→)"
            >
              <Icon name="chevron_right" size={20} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
