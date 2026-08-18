import React, { useState, useEffect } from "react";
import { LocalBookItem } from "../../types";
import { scanLocalLibrary, openFolder } from "../../utils/ipc";
import { useSettingsStore } from "../../stores/settingsStore";
import { Icon } from "../common/Icon";
import { LocalReaderModal } from "./LocalReaderModal";
import { QuickShareHubModal } from "../share/QuickShareHubModal";

export const LibraryView: React.FC = () => {
  const { settings } = useSettingsStore();
  const [books, setBooks] = useState<LocalBookItem[]>([]);
  const [selectedBookForReading, setSelectedBookForReading] = useState<LocalBookItem | null>(null);
  const [isQuickShareOpen, setIsQuickShareOpen] = useState(false);
  const [filterQuery, setFilterQuery] = useState("");
  const [formatFilter, setFormatFilter] = useState<"all" | "cbz" | "zip" | "folder">("all");
  const [sortBy, setSortBy] = useState<"recent" | "name" | "size">("recent");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [isLoading, setIsLoading] = useState(false);

  const fetchLibrary = async () => {
    setIsLoading(true);
    try {
      const items = await scanLocalLibrary(settings.download_directory);
      setBooks(items);
    } catch (e) {
      console.error("Error scanning library:", e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLibrary();
  }, [settings.download_directory]);

  // Helper to parse filename into rich metadata
  const parseBookInfo = (filename: string) => {
    const cleanName = filename.replace(/\.(cbz|zip)$/i, "");
    
    // Extract ID (e.g. [482910] or #482910 or starting with digits)
    const idMatch = cleanName.match(/\[(\d{4,8})\]/) || cleanName.match(/#?(\d{5,8})/);
    const id = idMatch ? idMatch[1] : null;

    // Extract language
    const langMatch = cleanName.match(/[\(\[](english|french|japanese|spanish|chinese|italian|français|anglais)[\)\]]/i);
    const lang = langMatch ? langMatch[1].toUpperCase() : null;

    // Extract artist: find bracket that is not ID and not "Unknown"
    const bracketMatches = Array.from(cleanName.matchAll(/\[([^\]]+)\]/g)).map((m) => m[1].trim());
    let artist = null;
    for (const b of bracketMatches) {
      if (/^\d+$/.test(b)) continue; // ID
      if (b.toLowerCase() === "unknown" || b.toLowerCase() === "unknown artist") continue;
      artist = b;
      break;
    }

    // Clean display title
    let displayTitle = cleanName
      .replace(/\[\d+\]/g, "")
      .replace(/\[unknown\]/gi, "")
      .replace(/\[([^\]]+)\]/g, "")
      .replace(/\([^\)]+\)/g, "")
      .trim();

    if (!displayTitle) {
      displayTitle = cleanName;
    }

    return { id, lang, artist, displayTitle };
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 Mo";
    const mb = bytes / (1024 * 1024);
    if (mb >= 1024) return `${(mb / 1024).toFixed(2)} Go`;
    return `${mb.toFixed(1)} Mo`;
  };

  const formatDate = (ms: number) => {
    return new Date(ms).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  // Total size calculation
  const totalSizeBytes = books.reduce((acc, b) => acc + (b.sizeBytes || 0), 0);

  // Filter and sort
  const filteredBooks = books
    .filter((b) => {
      if (formatFilter === "cbz" && !b.isCbz) return false;
      if (formatFilter === "zip" && (b.isCbz || b.isFolder)) return false;
      if (formatFilter === "folder" && !b.isFolder) return false;
      if (filterQuery) {
        return b.filename.toLowerCase().includes(filterQuery.toLowerCase());
      }
      return true;
    })
    .sort((a, b) => {
      if (sortBy === "recent") return b.modifiedAt - a.modifiedAt;
      if (sortBy === "name") return a.filename.localeCompare(b.filename);
      if (sortBy === "size") return b.sizeBytes - a.sizeBytes;
      return 0;
    });

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6 select-none">
      {/* 3hentai / nHentai Style Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#23232c]">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2.5">
            <Icon name="local_library" size={24} className="text-rose-400" />
            <span>Ma Collection Hors-Ligne</span>
            <span className="text-xs bg-[#252532] text-rose-300 font-mono px-2.5 py-0.5 rounded-full border border-[#36364a] font-bold">
              {books.length} mangas
            </span>
          </h1>
          <p className="text-xs text-gray-400 mt-1 flex items-center gap-3">
            <span>Espace disque occupé : <strong className="text-gray-200 font-mono">{formatBytes(totalSizeBytes)}</strong></span>
            <span>•</span>
            <span className="truncate max-w-md font-mono text-[11px] text-gray-500">
              {settings.download_directory}
            </span>
          </p>
        </div>

        {/* Header Action Buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsQuickShareOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-md bg-linear-to-r from-[#ed2553] to-[#e11d48] hover:from-[#f43f5e] hover:to-[#ed2553] text-white text-xs font-bold transition-all shadow-md shadow-[#ed2553]/20 cursor-pointer"
            title="Transférer votre collection CBZ vers votre smartphone en Wi-Fi direct"
          >
            <Icon name="wifi_tethering" size={16} />
            <span>⚡ Quick Share Wi-Fi (Android)</span>
          </button>

          <button
            onClick={() => openFolder(settings.download_directory)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#25252e] hover:bg-[#30303c] text-gray-200 text-xs font-semibold border border-[#353545] transition-colors cursor-pointer"
            title="Ouvrir le dossier dans l'Explorateur Windows"
          >
            <Icon name="folder_open" size={16} className="text-amber-400" />
            <span>Ouvrir Dossier</span>
          </button>

          <button
            onClick={fetchLibrary}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-md bg-[#25252e] hover:bg-[#30303c] text-gray-200 text-xs font-semibold border border-[#353545] transition-colors shadow-sm cursor-pointer disabled:opacity-50"
            title="Actualiser le scan du dossier"
          >
            <Icon
              name="refresh"
              size={16}
              className={isLoading ? "animate-spin" : ""}
            />
            <span>Actualiser</span>
          </button>
        </div>
      </div>

      {/* Toolbar: Search, Format Pills, Sort & View Mode */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-[#18181f] p-3 rounded-lg border border-[#262633]">
        {/* Search Bar */}
        <div className="relative flex-1 max-w-md flex items-center">
          <Icon name="search" size={18} className="text-gray-400 absolute left-3 pointer-events-none" />
          <input
            type="text"
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            placeholder="Filtrer par titre, artiste, langue ou tag..."
            className="w-full bg-[#242430] border border-[#333344] focus:border-[#ed2553] text-gray-200 text-xs pl-9 pr-4 py-1.5 rounded-md outline-none transition-colors"
          />
          {filterQuery && (
            <button
              onClick={() => setFilterQuery("")}
              className="absolute right-2.5 text-gray-400 hover:text-white cursor-pointer"
            >
              <Icon name="close" size={15} />
            </button>
          )}
        </div>

        {/* Format Filter Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
          {[
            { id: "all", label: "Tous" },
            { id: "cbz", label: "CBZ" },
            { id: "zip", label: "ZIP" },
            { id: "folder", label: "Dossiers" },
          ].map((fmt) => (
            <button
              key={fmt.id}
              onClick={() => setFormatFilter(fmt.id as any)}
              className={`px-3 py-1 rounded text-xs font-bold transition-all cursor-pointer ${
                formatFilter === fmt.id
                  ? "bg-[#ed2553] text-white shadow-xs"
                  : "bg-[#20202a] text-gray-400 hover:text-gray-200 hover:bg-[#282836]"
              }`}
            >
              {fmt.label}
            </button>
          ))}
        </div>

        {/* Sort & View Mode Switcher */}
        <div className="flex items-center gap-3">
          {/* Sort Selector */}
          <div className="flex items-center gap-1.5 text-xs text-gray-400">
            <span className="font-semibold text-gray-500">Tri :</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-[#242430] border border-[#333344] text-gray-200 text-xs rounded px-2.5 py-1 outline-none cursor-pointer"
            >
              <option value="recent">Plus récents</option>
              <option value="name">Nom (A-Z)</option>
              <option value="size">Taille de fichier</option>
            </select>
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center bg-[#20202a] border border-[#313140] rounded p-0.5">
            <button
              onClick={() => setViewMode("grid")}
              className={`p-1 rounded cursor-pointer ${
                viewMode === "grid" ? "bg-[#353548] text-white" : "text-gray-400 hover:text-gray-200"
              }`}
              title="Vue Grille (5 colonnes)"
            >
              <Icon name="grid_view" size={16} />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`p-1 rounded cursor-pointer ${
                viewMode === "list" ? "bg-[#353548] text-white" : "text-gray-400 hover:text-gray-200"
              }`}
              title="Vue Liste Détaillée"
            >
              <Icon name="view_list" size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {filteredBooks.length === 0 ? (
        <div className="py-20 text-center text-gray-400 space-y-4 max-w-md mx-auto">
          <Icon name="inventory_2" size={48} className="mx-auto text-gray-600 opacity-60" />
          <h3 className="text-base font-bold text-gray-200">
            {filterQuery ? "Aucun manga correspondant au filtre" : "Votre bibliothèque est vide"}
          </h3>
          <p className="text-xs text-gray-500">
            {filterQuery
              ? "Essayez de rechercher un autre mot-clé ou réinitialisez le filtre."
              : "Téléchargez des galeries depuis l'Explorateur ou le Téléchargeur par Lot pour les retrouver ici hors-ligne."}
          </p>
        </div>
      ) : viewMode === "grid" ? (
        /* 5-Column Manga Gallery Grid (Identical to nHentai Explorer) */
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {filteredBooks.map((book, idx) => {
            const meta = parseBookInfo(book.filename);
            const isCbz = book.isCbz;
            const displayTitle = book.title || meta.displayTitle;
            const displayArtist = book.artist && book.artist !== "Artiste Inconnu" ? book.artist : meta.artist;
            const displayLang = book.language || meta.lang || "JAPONAIS";

            return (
              <div
                key={idx}
                className="group flex flex-col cursor-pointer select-none transition-all duration-200"
                onClick={() => setSelectedBookForReading(book)}
              >
                {/* Manga Cover Card */}
                <div className="relative aspect-[3/4.3] w-full rounded-md overflow-hidden bg-[#1a1a24] border border-[#2b2b38] group-hover:border-[#ed2553] transition-all shadow-md">
                  {book.coverDataUrl ? (
                    <img
                      src={book.coverDataUrl}
                      alt={displayTitle}
                      className="w-full h-full object-cover group-hover:scale-103 transition-transform duration-300"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col justify-between p-3 relative">
                      {/* Background Cover Aesthetic */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black via-[#14141c]/90 to-[#1e1e2c] opacity-90 group-hover:opacity-100 transition-opacity" />

                      {/* Fallback Artwork Pattern */}
                      <div className="absolute inset-0 flex items-center justify-center opacity-10 group-hover:opacity-15 transition-opacity">
                        <Icon name="menu_book" size={100} />
                      </div>

                      {/* Center ID Tag */}
                      <div className="relative z-10 text-center my-auto">
                        {book.galleryId || meta.id ? (
                          <span className="inline-block px-2 py-0.5 rounded bg-black/70 font-mono text-xs font-bold text-[#ed2553] border border-[#ed2553]/30">
                            #{book.galleryId || meta.id}
                          </span>
                        ) : (
                          <Icon name="archive" size={32} className="text-gray-500 mx-auto" />
                        )}
                      </div>
                    </div>
                  )}

                  {/* Gradient shadow for text contrast */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/40 pointer-events-none" />

                  {/* Top Badges: Format + Size */}
                  <div className="absolute top-2 left-2 right-2 z-10 flex items-center justify-between pointer-events-none">
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-black uppercase shadow-xs ${
                        isCbz
                          ? "bg-emerald-950/90 text-emerald-300 border border-emerald-500/50"
                          : book.isFolder
                          ? "bg-blue-950/90 text-blue-300 border border-blue-500/50"
                          : "bg-amber-950/90 text-amber-300 border border-amber-500/50"
                      }`}
                    >
                      {isCbz ? "CBZ" : book.isFolder ? "DOSSIER" : "ZIP"}
                    </span>

                    <span className="px-1.5 py-0.5 rounded bg-black/75 backdrop-blur-xs text-[10px] font-mono font-bold text-gray-200 border border-white/10">
                      {formatBytes(book.sizeBytes)}
                    </span>
                  </div>

                  {/* Bottom Language & Pages Tag */}
                  <div className="absolute bottom-2 left-2 right-2 z-10 flex items-center justify-between text-[10px] font-mono pointer-events-none">
                    <span className="px-1.5 py-0.5 rounded bg-black/75 backdrop-blur-xs text-[#ed2553] font-bold border border-[#ed2553]/30">
                      {displayLang}
                    </span>
                    {book.pagesCount ? (
                      <span className="px-1.5 py-0.5 rounded bg-black/75 backdrop-blur-xs text-gray-300 font-bold border border-white/10">
                        {book.pagesCount}P
                      </span>
                    ) : (
                      <span className="text-gray-400 text-[9px]">{formatDate(book.modifiedAt)}</span>
                    )}
                  </div>

                  {/* Hover Quick Action Overlay */}
                  <div className="absolute inset-0 bg-black/75 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col items-center justify-center gap-2 p-3 z-20">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedBookForReading(book);
                      }}
                      className="w-full py-2 px-3 rounded bg-[#ed2553] hover:bg-[#f43f5e] text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-lg transition-transform hover:scale-102 cursor-pointer"
                    >
                      <Icon name="auto_stories" size={16} />
                      <span>Lire le Manga</span>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openFolder(book.filePath);
                      }}
                      className="w-full py-1.5 px-3 rounded bg-[#20202e] hover:bg-[#2e2e42] text-gray-200 text-xs font-semibold flex items-center justify-center gap-1.5 border border-white/10 transition-colors cursor-pointer"
                    >
                      <Icon name="folder_open" size={15} className="text-gray-400" />
                      <span>Révéler Fichier</span>
                    </button>
                  </div>
                </div>

                {/* Title & Artist Caption */}
                <div className="mt-1.5 px-0.5">
                  <h3
                    className="text-xs text-gray-200 group-hover:text-[#ed2553] line-clamp-2 leading-snug font-medium transition-colors"
                    title={book.filename}
                  >
                    {displayTitle}
                  </h3>
                  {displayArtist && (
                    <div className="text-[11px] text-gray-400 truncate mt-0.5 flex items-center gap-1">
                      <span className="text-gray-500 text-[10px]">Artiste:</span>
                      <span className="text-rose-400 font-semibold truncate">{displayArtist}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Detailed List View */
        <div className="bg-[#18181f] border border-[#262633] rounded-lg overflow-hidden divide-y divide-[#242432]">
          {filteredBooks.map((book, idx) => {
            const meta = parseBookInfo(book.filename);
            const displayTitle = book.title || meta.displayTitle;
            const displayArtist = book.artist && book.artist !== "Artiste Inconnu" ? book.artist : meta.artist;

            return (
              <div
                key={idx}
                className="p-3.5 flex items-center justify-between gap-4 hover:bg-[#20202a] transition-colors group cursor-pointer"
                onClick={() => setSelectedBookForReading(book)}
              >
                <div className="flex items-center gap-3.5 min-w-0">
                  {book.coverDataUrl ? (
                    <img
                      src={book.coverDataUrl}
                      alt={displayTitle}
                      className="w-10 h-14 object-cover rounded border border-[#333346] shrink-0"
                    />
                  ) : (
                    <div className="w-10 h-14 rounded bg-[#252534] border border-[#333346] flex items-center justify-center text-rose-400 shrink-0">
                      <Icon name={book.isCbz ? "auto_stories" : "archive"} size={20} />
                    </div>
                  )}
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-gray-200 group-hover:text-rose-300 truncate">
                      {displayTitle}
                    </div>
                    {displayArtist && (
                      <div className="text-[11px] text-rose-400 font-medium truncate mt-0.5">
                        {displayArtist}
                      </div>
                    )}
                    <div className="flex items-center gap-3 text-[10px] text-gray-500 mt-0.5 font-mono">
                      {(book.galleryId || meta.id) && (
                        <span className="text-rose-400">#{book.galleryId || meta.id}</span>
                      )}
                      {book.pagesCount && <span>{book.pagesCount} pages</span>}
                      <span>{formatBytes(book.sizeBytes)}</span>
                      <span>•</span>
                      <span>{formatDate(book.modifiedAt)}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-[#252534] text-gray-300 border border-[#343448]">
                    {book.isCbz ? "CBZ" : book.isFolder ? "DOSSIER" : "ZIP"}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedBookForReading(book);
                    }}
                    className="px-3 py-1.5 rounded bg-[#ed2553] hover:bg-[#f43f5e] text-white text-xs font-bold flex items-center gap-1 shadow transition-colors cursor-pointer"
                    title="Lire le Manga"
                  >
                    <Icon name="auto_stories" size={15} />
                    <span>Lire</span>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      openFolder(book.filePath);
                    }}
                    className="p-1.5 rounded bg-[#252534] hover:bg-[#323246] text-gray-300 hover:text-amber-400 transition-colors cursor-pointer"
                    title="Révéler dans l'Explorateur"
                  >
                    <Icon name="folder_open" size={16} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Integrated CBZ / ZIP / Folder Offline Reader */}
      {selectedBookForReading && (
        <LocalReaderModal
          book={selectedBookForReading}
          onClose={() => setSelectedBookForReading(null)}
        />
      )}

      {/* Quick Share Wi-Fi Gigabit Transfer Modal */}
      {isQuickShareOpen && (
        <QuickShareHubModal
          onClose={() => setIsQuickShareOpen(false)}
          initialDirectory={settings.download_directory}
        />
      )}
    </div>
  );
};
