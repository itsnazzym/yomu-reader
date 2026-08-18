import React, { useState, useEffect, useCallback } from "react";
import { DownloadFormat, Gallery, SortOption } from "../../types";
import { searchGalleries, getCoverUrl, getGalleryDisplayTitle, getGalleryLanguage, getDownloadedGalleryIds, onDownloadProgress, buildImageFallbacks } from "../../utils/ipc";
import { useDownloadStore } from "../../stores/downloadStore";
import { useSettingsStore } from "../../stores/settingsStore";
import { Icon } from "../common/Icon";
import { SmartImage } from "../common/SmartImage";

interface BatchDownloaderViewProps {
  onSuccessNavigateToDownloads: () => void;
  onSelectGallery?: (gallery: Gallery) => void;
}

type TagState = "none" | "include" | "exclude";

interface MatrixTag {
  name: string;
  category: "language" | "category" | "tag" | "parody";
}

const PRESET_TAGS: MatrixTag[] = [
  // Languages
  { name: "language:french", category: "language" },
  { name: "language:english", category: "language" },
  { name: "language:japanese", category: "language" },
  { name: "language:chinese", category: "language" },
  { name: "language:spanish", category: "language" },

  // Categories
  { name: "category:doujinshi", category: "category" },
  { name: "category:manga", category: "category" },
  { name: "category:artistcg", category: "category" },

  // Popular Tags
  { name: "sole female", category: "tag" },
  { name: "sole male", category: "tag" },
  { name: "big breasts", category: "tag" },
  { name: "schoolgirl uniform", category: "tag" },
  { name: "stockings", category: "tag" },
  { name: "glasses", category: "tag" },
  { name: "milf", category: "tag" },
  { name: "maid", category: "tag" },
  { name: "swimsuit", category: "tag" },
  { name: "nakadashi", category: "tag" },
  { name: "ahegao", category: "tag" },
  { name: "collar", category: "tag" },

  // Parodies
  { name: "parody:original", category: "parody" },
  { name: "parody:fate grand order", category: "parody" },
  { name: "parody:genshin impact", category: "parody" },
  { name: "parody:blue archive", category: "parody" },
  { name: "parody:kantai collection", category: "parody" },
  { name: "parody:touhou project", category: "parody" },
];

const BatchCoverImage: React.FC<{ gallery: Gallery; title: string; isSelected: boolean }> = ({
  gallery,
  title,
  isSelected,
}) => {
  const mid = gallery.media_id || String(gallery.id);
  const primaryCover = getCoverUrl(gallery);
  const candidateUrls = React.useMemo(() => {
    return buildImageFallbacks(primaryCover, "thumb", mid);
  }, [primaryCover, mid]);

  return (
    <SmartImage
      candidates={candidateUrls}
      alt={title}
      className="w-full h-full"
      imgClassName={`w-full h-full object-cover transform transition-transform duration-300 ${
        isSelected ? "scale-102" : "group-hover:scale-105"
      }`}
    />
  );
};

export const BatchDownloaderView: React.FC<BatchDownloaderViewProps> = ({
  onSuccessNavigateToDownloads,
  onSelectGallery,
}) => {
  const { addBatchToQueue } = useDownloadStore();
  const { settings } = useSettingsStore();

  // Multi-state tag matrix: tag name -> "include" | "exclude"
  const [tagStates, setTagStates] = useState<Record<string, TagState>>({
    "language:french": "include",
  });

  const [customTagInput, setCustomTagInput] = useState("");
  const [customTags, setCustomTags] = useState<string[]>([]);
  const [sort, setSort] = useState<SortOption>("popular");
  const [targetCount, setTargetCount] = useState<number>(20);
  const [totalAvailableCount, setTotalAvailableCount] = useState<number>(250);
  const [format, setFormat] = useState<DownloadFormat>(settings.default_format || "cbz");

  // Preview / Crawl State
  const [previewGalleries, setPreviewGalleries] = useState<Gallery[]>([]);
  const [downloadedDiskIds, setDownloadedDiskIds] = useState<Set<number>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<{ current: number; total: number } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Refresh list of already downloaded IDs from disk
  const refreshDownloadedDiskIds = useCallback(async () => {
    try {
      const ids = await getDownloadedGalleryIds(settings.download_directory);
      setDownloadedDiskIds(ids);
      return ids;
    } catch (e) {
      console.error("Failed to check downloaded IDs:", e);
      return new Set<number>();
    }
  }, [settings.download_directory]);

  useEffect(() => {
    refreshDownloadedDiskIds();
  }, [refreshDownloadedDiskIds]);

  // Dynamically refresh disk IDs as soon as any download completes
  useEffect(() => {
    const unsubscribe = onDownloadProgress((payload) => {
      if (payload.status === "completed") {
        refreshDownloadedDiskIds();
      }
    });
    return () => {
      unsubscribe();
    };
  }, [refreshDownloadedDiskIds]);

  // Toggle selection for a single gallery
  const toggleSelectGallery = (id: number, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Toggle Select All on current page
  const isAllSelected =
    previewGalleries.length > 0 && previewGalleries.every((g) => selectedIds.has(g.id));

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(previewGalleries.map((g) => g.id)));
    }
  };

  // Download only manually selected mangas
  const handleDownloadSelected = () => {
    if (selectedIds.size === 0) return;
    const toDownload = previewGalleries.filter((g) => selectedIds.has(g.id));
    if (toDownload.length > 0) {
      addBatchToQueue(toDownload, format);
      onSuccessNavigateToDownloads();
    }
  };

  // Cycle tag state: none -> include -> exclude -> none
  const toggleTag = (tagName: string) => {
    setTagStates((prev) => {
      const current = prev[tagName] || "none";
      const next: TagState = current === "none" ? "include" : current === "include" ? "exclude" : "none";
      const updated = { ...prev };
      if (next === "none") {
        delete updated[tagName];
      } else {
        updated[tagName] = next;
      }
      return updated;
    });
  };

  const handleAddCustomTag = (e?: React.FormEvent | React.KeyboardEvent | React.MouseEvent) => {
    if (e) e.preventDefault();
    const clean = customTagInput.trim().toLowerCase();
    if (!clean) return;

    if (!customTags.includes(clean)) {
      setCustomTags((prev) => [...prev, clean]);
    }
    setTagStates((prev) => ({ ...prev, [clean]: "include" }));
    setCustomTagInput("");
  };

  const handleResetFilters = () => {
    setTagStates({});
    setCustomTags([]);
    setSort("popular");
    setTargetCount(20);
  };

  const handleRemoveCustomTag = (tagName: string) => {
    setCustomTags((prev) => prev.filter((t) => t !== tagName));
    setTagStates((prev) => {
      const copy = { ...prev };
      delete copy[tagName];
      return copy;
    });
  };

  // Build the nHentai search query
  const constructQueryString = () => {
    const parts: string[] = [];
    Object.entries(tagStates).forEach(([tag, state]) => {
      if (state === "none") return;
      const formatted = tag.includes(" ") && !tag.includes(":") ? `"${tag}"` : tag;
      if (state === "exclude") {
        parts.push(`-${formatted}`);
      } else {
        parts.push(formatted);
      }
    });

    // Add global blacklist
    if (settings.blacklisted_tags && settings.blacklisted_tags.length > 0) {
      settings.blacklisted_tags.forEach((bt) => {
        if (!tagStates[bt]) {
          parts.push(`-"${bt}"`);
        }
      });
    }

    return parts.join(" ");
  };

  // Live preview search (debounced, fetches up to targetCount un-downloaded mangas)
  useEffect(() => {
    let isCancelled = false;
    const timer = setTimeout(async () => {
      const query = constructQueryString();
      setIsLoadingPreview(true);
      setErrorMsg(null);
      try {
        const diskIds = await refreshDownloadedDiskIds();
        const collected: Gallery[] = [];
        let page = 1;
        let hasMore = true;

        while (collected.length < targetCount && hasMore && !isCancelled) {
          const resp = await searchGalleries(query, sort, page, settings.cookies, settings.api_key);
          if (!resp.result || resp.result.length === 0) {
            hasMore = false;
            break;
          }

          const totalDispo = (resp.num_pages || 1) * (resp.per_page || 25);
          if (totalDispo > 0) {
            setTotalAvailableCount(totalDispo);
          }

          for (const g of resp.result) {
            // Skip already downloaded mangas present in folder
            if (diskIds.has(g.id)) continue;

            if (collected.length < targetCount && !collected.some((existing) => existing.id === g.id)) {
              collected.push(g);
            }
          }

          if (page >= (resp.num_pages || 1) || resp.result.length < (resp.per_page || 25)) {
            hasMore = false;
          } else {
            page += 1;
            // Anti-flood delay to prevent rate limit (429) on high-speed crawling
            await new Promise((r) => setTimeout(r, 120));
          }
        }

        if (!isCancelled) {
          setPreviewGalleries(collected);
        }
      } catch (err: any) {
        if (!isCancelled) {
          console.error("Batch preview error:", err);
          setErrorMsg(err.message || "Erreur de recherche.");
        }
      } finally {
        if (!isCancelled) {
          setIsLoadingPreview(false);
        }
      }
    }, 400);

    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [sort, tagStates, targetCount, refreshDownloadedDiskIds]);

  // Execute batch download
  const handleStartBatchDownload = async () => {
    const query = constructQueryString();
    setIsDownloading(true);
    setErrorMsg(null);
    setDownloadProgress({ current: 0, total: targetCount });

    try {
      const diskIds = await refreshDownloadedDiskIds();
      const collected: Gallery[] = [];
      let page = 1;
      let hasMore = true;

      while (collected.length < targetCount && hasMore) {
        const resp = await searchGalleries(query, sort, page, settings.cookies, settings.api_key);
        if (!resp.result || resp.result.length === 0) {
          hasMore = false;
          break;
        }

        for (const gallery of resp.result) {
          if (diskIds.has(gallery.id)) continue;
          if (collected.length < targetCount) {
            collected.push(gallery);
          }
        }

        setDownloadProgress({ current: collected.length, total: targetCount });

        if (page >= resp.num_pages || resp.result.length < resp.per_page) {
          hasMore = false;
        } else {
          page += 1;
          await new Promise((r) => setTimeout(r, 120));
        }
      }

      if (collected.length === 0) {
        setErrorMsg("Toutes les galeries trouvées sont déjà téléchargées dans votre dossier.");
        setIsDownloading(false);
        return;
      }

      addBatchToQueue(collected, format);
      setIsDownloading(false);
      onSuccessNavigateToDownloads();
    } catch (err: any) {
      console.error("Batch download error:", err);
      setErrorMsg(err.message || "Erreur lors du téléchargement par lot.");
      setIsDownloading(false);
    }
  };

  const getTagPillClass = (state: TagState) => {
    if (state === "include") {
      return "bg-[#ed2553] text-white border-[#f43f5e] shadow-xs font-bold";
    }
    if (state === "exclude") {
      return "bg-red-950 text-red-300 border-red-500/50 line-through opacity-80 font-medium";
    }
    return "bg-[#22222d] text-gray-300 border-[#323244] hover:border-gray-500 hover:text-white";
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6 select-none">
      {/* 3hentai / nHentai Style Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#23232c]">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2.5">
            <Icon name="layers" size={24} className="text-rose-400" />
            <span>Recherche Avancée & Téléchargement Multiple</span>
          </h1>
          <p className="text-xs text-gray-400 mt-1">
            Cliquez sur un tag pour l'<strong>inclure (+)</strong>, re-cliquez pour l'<strong>exclure (-)</strong>, ou re-cliquez pour le désactiver.
          </p>
        </div>

        {/* Global Batch Action Buttons */}
        <div className="flex items-center gap-2.5 shrink-0">
          {selectedIds.size > 0 && (
            <button
              onClick={handleDownloadSelected}
              disabled={isDownloading}
              className="flex items-center gap-2 px-5 py-2.5 rounded-md bg-[#ed2553] hover:bg-[#f43f5e] text-white text-xs font-bold transition-all shadow-lg shadow-[#ed2553]/30 cursor-pointer animate-pulse"
            >
              <Icon name="download" size={18} />
              <span>Télécharger la Sélection ({selectedIds.size} mangas)</span>
            </button>
          )}

          <button
            onClick={handleResetFilters}
            className="flex items-center gap-1.5 px-3 py-2.5 rounded-md bg-[#20202c] hover:bg-[#2c2c3c] text-gray-300 hover:text-white text-xs font-semibold border border-[#333347] transition-colors cursor-pointer shrink-0"
            title="Réinitialiser tous les tags et filtres"
          >
            <Icon name="restart_alt" size={16} />
            <span>Réinitialiser</span>
          </button>

          <button
            onClick={handleStartBatchDownload}
            disabled={isDownloading}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-md text-xs font-bold transition-all shadow-md cursor-pointer shrink-0 ${
              selectedIds.size > 0
                ? "bg-[#252533] hover:bg-[#323244] text-gray-200 border border-[#3c3c52]"
                : "bg-[#ed2553] hover:bg-[#f43f5e] text-white shadow-[#ed2553]/20"
            } disabled:opacity-50`}
          >
            {isDownloading ? (
              <>
                <Icon name="progress_activity" size={18} className="animate-spin" />
                <span>Téléchargement ({downloadProgress?.current}/{downloadProgress?.total})...</span>
              </>
            ) : (
              <>
                <Icon name="cloud_download" size={18} />
                <span>Télécharger Tout ({targetCount} mangas)</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Interactive Tag Selector Matrix (Spacious & Clean) */}
      <div className="bg-[#18181f] border border-[#262633] rounded-xl p-5 space-y-4">
        {/* Languages & Categories */}
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <span className="text-xs font-bold text-gray-400 min-w-[90px] pt-1">Langues :</span>
            <div className="flex flex-wrap gap-1.5">
              {PRESET_TAGS.filter((t) => t.category === "language").map((t) => {
                const state = tagStates[t.name] || "none";
                return (
                  <button
                    key={t.name}
                    onClick={() => toggleTag(t.name)}
                    className={`px-3 py-1 rounded text-xs border transition-all flex items-center gap-1.5 cursor-pointer ${getTagPillClass(
                      state
                    )}`}
                  >
                    {state === "include" && <Icon name="check" size={13} />}
                    {state === "exclude" && <Icon name="block" size={13} />}
                    <span>{t.name.replace("language:", "")}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-start gap-3">
            <span className="text-xs font-bold text-gray-400 min-w-[90px] pt-1">Catégories :</span>
            <div className="flex flex-wrap gap-1.5">
              {PRESET_TAGS.filter((t) => t.category === "category").map((t) => {
                const state = tagStates[t.name] || "none";
                return (
                  <button
                    key={t.name}
                    onClick={() => toggleTag(t.name)}
                    className={`px-3 py-1 rounded text-xs border transition-all flex items-center gap-1.5 cursor-pointer ${getTagPillClass(
                      state
                    )}`}
                  >
                    {state === "include" && <Icon name="check" size={13} />}
                    {state === "exclude" && <Icon name="block" size={13} />}
                    <span>{t.name.replace("category:", "")}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-start gap-3">
            <span className="text-xs font-bold text-gray-400 min-w-[90px] pt-1">Tags populaires :</span>
            <div className="flex flex-wrap gap-1.5">
              {PRESET_TAGS.filter((t) => t.category === "tag").map((t) => {
                const state = tagStates[t.name] || "none";
                return (
                  <button
                    key={t.name}
                    onClick={() => toggleTag(t.name)}
                    className={`px-3 py-1 rounded text-xs border transition-all flex items-center gap-1.5 cursor-pointer ${getTagPillClass(
                      state
                    )}`}
                  >
                    {state === "include" && <Icon name="check" size={13} />}
                    {state === "exclude" && <Icon name="block" size={13} />}
                    <span>{t.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-start gap-3">
            <span className="text-xs font-bold text-gray-400 min-w-[90px] pt-1">Séries :</span>
            <div className="flex flex-wrap gap-1.5">
              {PRESET_TAGS.filter((t) => t.category === "parody").map((t) => {
                const state = tagStates[t.name] || "none";
                return (
                  <button
                    key={t.name}
                    onClick={() => toggleTag(t.name)}
                    className={`px-3 py-1 rounded text-xs border transition-all flex items-center gap-1.5 cursor-pointer ${getTagPillClass(
                      state
                    )}`}
                  >
                    {state === "include" && <Icon name="check" size={13} />}
                    {state === "exclude" && <Icon name="block" size={13} />}
                    <span>{t.name.replace("parody:", "")}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Custom Tags Added by User */}
          {customTags.length > 0 && (
            <div className="flex items-start gap-3 pt-1 border-t border-[#262633]">
              <span className="text-xs font-bold text-gray-400 min-w-[90px] pt-1">Personnalisés :</span>
              <div className="flex flex-wrap gap-1.5">
                {customTags.map((ct) => {
                  const state = tagStates[ct] || "include";
                  return (
                    <span
                      key={ct}
                      className={`px-3 py-1 rounded text-xs border transition-all flex items-center gap-1.5 ${getTagPillClass(
                        state
                      )}`}
                    >
                      <button onClick={() => toggleTag(ct)} className="cursor-pointer">
                        {ct}
                      </button>
                      <button
                        onClick={() => handleRemoveCustomTag(ct)}
                        className="hover:text-white ml-1 font-bold cursor-pointer"
                        title="Supprimer ce tag"
                      >
                        ×
                      </button>
                    </span>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Add Custom Tag Bar */}
        <div className="pt-2 flex items-center gap-2 max-w-md">
          <input
            type="text"
            value={customTagInput}
            onChange={(e) => setCustomTagInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAddCustomTag();
            }}
            placeholder="Ajouter un tag personnalisé (ex: 'artist:matsumoto', 'sole female')..."
            className="flex-1 bg-[#242430] border border-[#333344] focus:border-[#ed2553] text-gray-200 text-xs px-3 py-1.5 rounded-md outline-none"
          />
          <button
            onClick={handleAddCustomTag}
            className="px-3 py-1.5 bg-[#2a2a38] hover:bg-[#343446] text-gray-200 text-xs font-bold rounded-md border border-[#3b3b4e] transition-colors cursor-pointer"
          >
            + Ajouter
          </button>
        </div>
      </div>

      {/* Toolbar: Sort, Limits, Format & Generated Query */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-[#18181f] p-3 rounded-lg border border-[#262633] text-xs">
        {/* Left: Generated Query string display */}
        <div className="flex items-center gap-2 font-mono text-gray-300 min-w-0">
          <span className="text-gray-500 font-bold">Requête :</span>
          <span className="text-rose-300 truncate font-semibold">
            {constructQueryString() || "(Toutes les nouveautés)"}
          </span>
        </div>

        {/* Right: Quick Controls for Batch */}
        <div className="flex flex-wrap items-center gap-3 shrink-0">
          {/* Sorting */}
          <div className="flex items-center gap-1 text-gray-400">
            <span className="text-gray-500 font-bold">Tri :</span>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as any)}
              className="bg-[#242430] border border-[#333344] text-gray-200 text-xs rounded px-2.5 py-1 outline-none cursor-pointer"
            >
              <option value="popular">Populaire (Tous les temps)</option>
              <option value="popular-week">Populaire (Semaine)</option>
              <option value="popular-today">Populaire (Aujourd'hui)</option>
              <option value="date">Plus récents</option>
            </select>
          </div>

          {/* Quantity Slider & Presets (Scales up to maximum scraped count) */}
          <div className="flex flex-wrap items-center gap-2 bg-[#20202c] px-3 py-1.5 rounded-lg border border-[#333347]">
            <div className="flex items-center gap-1.5">
              <span className="text-gray-400 font-bold text-xs">Quantité :</span>
              <span className="text-[#ed2553] font-mono font-black text-xs">
                {targetCount}
              </span>
              <span className="text-[10px] text-gray-500 font-mono">
                / {totalAvailableCount} dispo
              </span>
            </div>
            <input
              type="range"
              min="5"
              max={Math.min(500, Math.max(50, totalAvailableCount))}
              step="5"
              value={targetCount}
              onChange={(e) => setTargetCount(parseInt(e.target.value, 10))}
              className="w-24 sm:w-36 h-1.5 bg-[#14141a] rounded-lg appearance-none cursor-pointer accent-[#ed2553]"
            />
            <div className="flex items-center gap-1 pl-1">
              {[10, 25, 50, 100, 250].filter((p) => p <= totalAvailableCount).map((preset) => (
                <button
                  key={preset}
                  onClick={() => setTargetCount(preset)}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold transition-all cursor-pointer ${
                    targetCount === preset
                      ? "bg-[#ed2553] text-white shadow-xs"
                      : "bg-[#282836] text-gray-400 hover:text-white"
                  }`}
                >
                  {preset}
                </button>
              ))}
              <button
                onClick={() => setTargetCount(Math.min(500, totalAvailableCount))}
                className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold transition-all cursor-pointer ${
                  targetCount === Math.min(500, totalAvailableCount)
                    ? "bg-[#ed2553] text-white shadow-xs"
                    : "bg-[#282836] text-amber-400 hover:text-white border border-amber-500/30"
                }`}
                title="Sélectionner le maximum disponible"
              >
                Max ({Math.min(500, totalAvailableCount)})
              </button>
            </div>
          </div>

          {/* Format Selector */}
          <div className="flex items-center gap-1 text-gray-400">
            <span className="text-gray-500 font-bold">Format :</span>
            <select
              value={format}
              onChange={(e) => setFormat(e.target.value as any)}
              className="bg-[#242430] border border-[#333344] text-gray-200 text-xs rounded px-2.5 py-1 outline-none cursor-pointer uppercase font-mono font-bold"
            >
              <option value="cbz">CBZ (ComicInfo)</option>
              <option value="zip">ZIP</option>
              <option value="folder">Dossier</option>
            </select>
          </div>
        </div>
      </div>

      {errorMsg && (
        <div className="p-3 bg-red-950/50 border border-red-500/40 rounded-lg text-xs text-red-300 flex items-center gap-2">
          <Icon name="error" size={16} />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Live Preview Results Section with Selection Bar */}
      <div className="space-y-4 pt-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#23232c] pb-3">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Icon name="auto_stories" size={18} className="text-rose-400" />
              <span>Aperçu des Mangas ({previewGalleries.length})</span>
            </h2>

            {downloadedDiskIds.size > 0 && (
              <span className="text-[11px] text-emerald-400 bg-emerald-950/40 border border-emerald-500/30 px-2.5 py-0.5 rounded-full font-medium flex items-center gap-1.5 shadow-xs">
                <Icon name="check_circle" size={14} className="text-emerald-400" />
                <span>{downloadedDiskIds.size} déjà présent{downloadedDiskIds.size > 1 ? "s" : ""} dans le dossier (masqué{downloadedDiskIds.size > 1 ? "s" : ""})</span>
              </span>
            )}

            {selectedIds.size > 0 && (
              <span className="px-2.5 py-0.5 rounded-full bg-[#ed2553]/20 border border-[#ed2553]/40 text-[#ed2553] text-xs font-bold animate-pulse">
                {selectedIds.size} sélectionné{selectedIds.size > 1 ? "s" : ""}
              </span>
            )}
          </div>

          {/* Selection Controls (Select All / Clear / Download Selection) */}
          {previewGalleries.length > 0 && (
            <div className="flex items-center gap-2.5">
              <button
                onClick={toggleSelectAll}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#20202c] hover:bg-[#2b2b3b] text-gray-200 text-xs font-semibold border border-[#333347] transition-colors cursor-pointer"
                title={isAllSelected ? "Désélectionner tout" : "Tout sélectionner sur la page"}
              >
                <Icon
                  name={isAllSelected ? "check_box" : "check_box_outline_blank"}
                  size={16}
                  className={isAllSelected ? "text-[#ed2553]" : "text-gray-400"}
                />
                <span>{isAllSelected ? "Tout Désélectionner" : "Tout Sélectionner (Page)"}</span>
              </button>

              {selectedIds.size > 0 && (
                <button
                  onClick={handleDownloadSelected}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#ed2553] hover:bg-[#f43f5e] text-white text-xs font-bold shadow-md shadow-[#ed2553]/25 transition-all cursor-pointer"
                >
                  <Icon name="download" size={16} />
                  <span>Télécharger ({selectedIds.size})</span>
                </button>
              )}
            </div>
          )}
        </div>

        {isLoadingPreview ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="animate-pulse space-y-2">
                <div className="aspect-[3/4.3] bg-[#22222c] rounded-md" />
                <div className="h-3 bg-[#22222c] rounded w-3/4" />
              </div>
            ))}
          </div>
        ) : previewGalleries.length === 0 ? (
          <div className="py-12 text-center text-gray-500 text-xs space-y-2">
            <Icon name="search_off" size={32} className="mx-auto text-gray-600 opacity-50" />
            <div>Aucun manga trouvé avec cette combinaison de critères.</div>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {previewGalleries.map((gallery) => {
              const title = getGalleryDisplayTitle(gallery);
              const lang = getGalleryLanguage(gallery);
              const isSelected = selectedIds.has(gallery.id);

              return (
                <div
                  key={gallery.id}
                  onClick={() => toggleSelectGallery(gallery.id)}
                  className="group flex flex-col cursor-pointer select-none transition-all duration-200"
                >
                  <div
                    className={`relative aspect-[3/4.3] w-full rounded-lg overflow-hidden bg-[#1f1f26] transition-all duration-200 shadow-md ${
                      isSelected
                        ? "border-2 border-[#ed2553] shadow-lg shadow-[#ed2553]/30 ring-2 ring-[#ed2553]/40"
                        : "border border-[#2b2b36] group-hover:border-[#ed2553]/70"
                    }`}
                  >
                    <BatchCoverImage gallery={gallery} title={title} isSelected={isSelected} />

                    {/* Checkbox Overlay (Top Left) */}
                    <button
                      onClick={(e) => toggleSelectGallery(gallery.id, e)}
                      className={`absolute top-2 left-2 w-6 h-6 rounded-md flex items-center justify-center transition-all z-10 cursor-pointer shadow-md ${
                        isSelected
                          ? "bg-[#ed2553] text-white ring-2 ring-white/50"
                          : "bg-black/60 backdrop-blur-xs text-transparent group-hover:text-white/70 border border-white/20 hover:border-white/60"
                      }`}
                      title={isSelected ? "Désélectionner" : "Sélectionner"}
                    >
                      <Icon name="check" size={16} />
                    </button>

                    {/* Quick Preview Detail Button (Top Right) */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectGallery?.(gallery);
                      }}
                      className="absolute top-2 right-2 w-6 h-6 rounded-md bg-black/60 hover:bg-black/90 backdrop-blur-xs text-gray-300 hover:text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10 border border-white/20 cursor-pointer"
                      title="Voir les détails"
                    >
                      <Icon name="visibility" size={14} />
                    </button>

                    {/* Selected Gradient Glow */}
                    {isSelected && (
                      <div className="absolute inset-0 bg-[#ed2553]/10 pointer-events-none" />
                    )}

                    {/* Bottom Language Badge */}
                    <div className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 rounded bg-black/80 backdrop-blur-xs text-[10px] font-mono font-black text-rose-300 border border-white/10">
                      {lang.substring(0, 2).toUpperCase()}
                    </div>

                    {/* Number of Pages Tag */}
                    <div className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded bg-black/80 backdrop-blur-xs text-[10px] font-mono font-bold text-gray-300 border border-white/10">
                      {gallery.num_pages}p
                    </div>
                  </div>

                  <div className="mt-1.5 px-0.5">
                    <h3
                      className={`text-xs line-clamp-2 leading-snug font-medium transition-colors ${
                        isSelected
                          ? "text-[#ed2553] font-bold"
                          : "text-gray-200 group-hover:text-[#ed2553]"
                      }`}
                      title={title}
                    >
                      {title}
                    </h3>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
