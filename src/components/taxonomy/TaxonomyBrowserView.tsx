import React, { useState, useEffect } from "react";
import { Tag } from "../../types";
import { getTagsByType } from "../../utils/ipc";
import { useSettingsStore } from "../../stores/settingsStore";
import { Icon } from "../common/Icon";

interface TaxonomyBrowserViewProps {
  categoryType: "groups" | "series" | "artists" | "tags" | "characters";
  onSelectTag: (tagName: string) => void;
}

export const TaxonomyBrowserView: React.FC<TaxonomyBrowserViewProps> = ({
  categoryType,
  onSelectTag,
}) => {
  const { settings } = useSettingsStore();
  const [selectedSort, setSelectedSort] = useState<"alpha" | "pop">("pop");
  const [selectedLetter, setSelectedLetter] = useState<string>("all");
  const [filterText, setFilterText] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [tags, setTags] = useState<Tag[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getCategoryTitle = () => {
    switch (categoryType) {
      case "groups": return "Groupes";
      case "series": return "Séries";
      case "artists": return "Artistes";
      case "tags": return "Tags";
      case "characters": return "Personnages";
      default: return "Catégorie";
    }
  };

  const getCategoryIcon = () => {
    switch (categoryType) {
      case "groups": return "group";
      case "series": return "movie";
      case "artists": return "brush";
      case "tags": return "sell";
      case "characters": return "person";
      default: return "category";
    }
  };

  const fetchTagsData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const resp = await getTagsByType(
        categoryType,
        selectedSort,
        page,
        settings.cookies,
        settings.api_key
      );
      setTags(resp.result || []);
      setTotalPages(Math.max(1, resp.num_pages || 1));
      setIsLoading(false);
    } catch (e: any) {
      console.error("Error loading real tags:", e);
      setError(e.message || "Impossible de charger la liste des éléments.");
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTagsData();
  }, [categoryType, selectedSort, page]);

  const alphabet = [
    { id: "all", label: "Tous" },
    { id: "num", label: "#,0-9" },
    ..."ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").map((c) => ({ id: c.toLowerCase(), label: c })),
  ];

  const filteredList = tags.filter((item) => {
    if (filterText) {
      return item.name.toLowerCase().includes(filterText.toLowerCase());
    }
    if (selectedLetter === "all") return true;
    if (selectedLetter === "num") {
      return /^[\d\.\-\_]/.test(item.name);
    }
    return item.name.toLowerCase().startsWith(selectedLetter);
  });

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6 select-none">
      {/* Category Main Title */}
      <div className="text-center space-y-4">
        <h1 className="text-2xl font-bold text-white flex items-center justify-center gap-2">
          <Icon name={getCategoryIcon()} size={24} className="text-rose-400" />
          <span>{getCategoryTitle()}</span>
          {!isLoading && (
            <span className="text-xs bg-[#292938] text-rose-300 font-mono px-2.5 py-0.5 rounded-full border border-[#38384c]">
              Page {page} / {totalPages}
            </span>
          )}
        </h1>

        {/* Sort Switcher: A-Z | Par popularité */}
        <div className="inline-flex rounded-md bg-[#22222c] p-1 border border-[#31313e]">
          <button
            onClick={() => {
              setSelectedSort("alpha");
              setPage(1);
            }}
            className={`px-4 py-1 rounded text-xs font-bold transition-all cursor-pointer ${
              selectedSort === "alpha"
                ? "bg-[#333344] text-white shadow-sm"
                : "text-gray-400 hover:text-white"
            }`}
          >
            A-Z
          </button>
          <button
            onClick={() => {
              setSelectedSort("pop");
              setPage(1);
            }}
            className={`px-4 py-1 rounded text-xs font-bold transition-all cursor-pointer ${
              selectedSort === "pop"
                ? "bg-[#333344] text-white shadow-sm"
                : "text-gray-400 hover:text-white"
            }`}
          >
            Par popularité
          </button>
        </div>

        {/* Alphabet Navigation Bar */}
        <div className="flex flex-wrap items-center justify-center gap-1 max-w-4xl mx-auto pt-2">
          {alphabet.map((item) => {
            const isActive = selectedLetter === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setSelectedLetter(item.id)}
                className={`px-2.5 py-1 rounded text-xs font-bold transition-all cursor-pointer ${
                  isActive
                    ? "bg-[#ed2553] text-white shadow-sm"
                    : "bg-[#252530] text-gray-300 hover:bg-[#323240] hover:text-white"
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Filter Input */}
      <div className="max-w-md mx-auto relative flex items-center">
        <Icon name="search" size={18} className="text-gray-400 absolute left-3 pointer-events-none" />
        <input
          type="text"
          value={filterText}
          onChange={(e) => setFilterText(e.target.value)}
          placeholder={`Filtrer en direct les ${getCategoryTitle().toLowerCase()}...`}
          className="w-full bg-[#1e1e26] border border-[#2e2e3c] focus:border-[#ed2553] text-gray-200 text-xs pl-9 pr-4 py-2 rounded-md outline-none transition-colors"
        />
      </div>

      {/* 5-Column Table of Real Tags from nHentai API v2 */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
          {Array.from({ length: 30 }).map((_, i) => (
            <div key={i} className="h-9 bg-[#22222c] rounded animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <div className="bg-[#1c1418] border border-rose-900/40 rounded-xl p-8 text-center max-w-lg mx-auto space-y-4 my-8 shadow-xl">
          <Icon name="warning" size={32} className="text-rose-500 mx-auto" />
          <h3 className="text-sm font-bold text-white">Erreur de chargement</h3>
          <p className="text-xs text-rose-300 font-mono">{error}</p>
          <button
            onClick={fetchTagsData}
            className="px-4 py-2 bg-[#ed2553] hover:bg-[#f43f5e] text-white rounded-md text-xs font-bold transition-colors cursor-pointer"
          >
            Réessayer
          </button>
        </div>
      ) : filteredList.length === 0 ? (
        <div className="text-center py-12 text-gray-500 text-xs space-y-2">
          <Icon name="search_off" size={32} className="mx-auto text-gray-600 opacity-50" />
          <div>Aucun élément trouvé pour ce filtre.</div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2">
          {filteredList.map((item) => (
            <button
              key={item.id}
              onClick={() => onSelectTag(item.name)}
              className="flex items-center justify-between px-3 py-2 rounded bg-[#242430] hover:bg-[#323242] border border-[#2d2d3a] hover:border-[#ed2553] text-xs transition-all text-left group shadow-xs cursor-pointer"
            >
              <span className="text-gray-300 group-hover:text-white truncate font-medium mr-2">
                {item.name}
              </span>
              <span className="text-[11px] font-mono text-gray-500 group-hover:text-gray-300 shrink-0">
                {item.count}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Pagination Bar for Taxonomy */}
      {!isLoading && !error && totalPages > 1 && (
        <div className="pt-6 pb-8 flex items-center justify-center gap-1.5 text-xs">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
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
                onClick={() => setPage(pageNum)}
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
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
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
