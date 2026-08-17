import { useState, useEffect } from "react";
import { Header } from "./components/layout/Header";
import { GalleryGrid } from "./components/gallery/GalleryGrid";
import { GalleryDetailModal } from "./components/gallery/GalleryDetailModal";
import { ReaderModal } from "./components/reader/ReaderModal";
import { BatchDownloaderView } from "./components/batch/BatchDownloaderView";
import { DownloaderView } from "./components/downloader/DownloaderView";
import { SettingsView } from "./components/settings/SettingsView";
import { LibraryView } from "./components/library/LibraryView";
import { TaxonomyBrowserView } from "./components/taxonomy/TaxonomyBrowserView";
import { TabType, SortOption, Gallery, Tag } from "./types";
import { searchGalleries, getGallery, getRandomGallery } from "./utils/ipc";
import { useDownloadStore } from "./stores/downloadStore";
import { useSettingsStore } from "./stores/settingsStore";

export function App() {
  const [currentTab, setCurrentTab] = useState<TabType>("explorer");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeQuery, setActiveQuery] = useState("");
  const [sort, setSort] = useState<SortOption>("date");
  const [selectedLanguage, setSelectedLanguage] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [galleries, setGalleries] = useState<Gallery[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRandomLoading, setIsRandomLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedGallery, setSelectedGallery] = useState<Gallery | null>(null);
  const [readingGallery, setReadingGallery] = useState<Gallery | null>(null);
  const [initialReadingPage, setInitialReadingPage] = useState(0);

  const { queue, addToQueue, initListener } = useDownloadStore();
  const { settings, loadSettings } = useSettingsStore();

  const queuedIds = new Set(
    queue
      .filter((i) => i.status === "downloading" || i.status === "queued")
      .map((i) => i.id)
  );

  // Initialize settings and IPC listeners
  useEffect(() => {
    loadSettings();
    const unlisten = initListener();
    return () => unlisten();
  }, []);

  // Fetch galleries when query, sort, page, or language changes
  const fetchGalleriesData = async (q: string, s: SortOption, p: number, lang: string) => {
    setIsLoading(true);
    setError(null);
    try {
      let queryParts: string[] = [];

      if (q.trim()) {
        queryParts.push(q.trim());
      }

      // Add language filter if not "all"
      if (lang && lang !== "all") {
        queryParts.push(`language:${lang}`);
      }

      // Inject blacklisted tags
      if (settings.blacklisted_tags && settings.blacklisted_tags.length > 0) {
        settings.blacklisted_tags.forEach((t) => {
          queryParts.push(`-"${t}"`);
        });
      }

      const effectiveQuery = queryParts.join(" ");
      const response = await searchGalleries(effectiveQuery, s, p, settings.cookies, settings.api_key);
      setGalleries(response.result || []);
      setTotalPages(Math.max(1, response.num_pages || 1));
      setIsLoading(false);
    } catch (err: any) {
      console.error("Error fetching galleries:", err);
      setError(err.message || "Impossible de charger les galeries nHentai.");
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (currentTab === "explorer") {
      fetchGalleriesData(activeQuery, sort, page, selectedLanguage);
    }
  }, [activeQuery, sort, page, selectedLanguage, currentTab]);

  const handleSearchSubmit = async () => {
    const clean = searchQuery.trim();
    // Check if direct 1-7 digit code
    if (/^\d{1,7}$/.test(clean)) {
      setIsLoading(true);
      try {
        const directGallery = await getGallery(parseInt(clean, 10), settings.cookies, settings.api_key);
        setSelectedGallery(directGallery);
        setIsLoading(false);
        return;
      } catch (err) {
        console.warn("Direct ID lookup fallback to search:", err);
      }
    }

    setPage(1);
    setActiveQuery(searchQuery);
    if (currentTab !== "explorer") {
      setCurrentTab("explorer");
    }
  };

  const handleRandomClick = async () => {
    setIsRandomLoading(true);
    try {
      const randomGallery = await getRandomGallery(settings.cookies, settings.api_key);
      setSelectedGallery(randomGallery);
    } catch (err: any) {
      console.error("Error fetching random gallery:", err);
    } finally {
      setIsRandomLoading(false);
    }
  };

  const handleSortChange = (newSort: SortOption) => {
    setSort(newSort);
    setPage(1);
  };

  const handleLanguageChange = (lang: string) => {
    setSelectedLanguage(lang);
    setPage(1);
    if (currentTab !== "explorer") {
      setCurrentTab("explorer");
    }
  };

  const handleTagClick = (tag: Tag | string) => {
    const tagName = typeof tag === "string" ? tag : tag.name;
    const tagQuery = `"${tagName}"`;
    setSearchQuery(tagQuery);
    setActiveQuery(tagQuery);
    setPage(1);
    setSelectedGallery(null);
    setCurrentTab("explorer");
  };

  const handleSelectGallery = async (gallery: Gallery) => {
    setSelectedGallery(gallery);
    // If gallery is from search summary and doesn't have detailed pages array, fetch full details
    if (!gallery.images?.pages || gallery.images.pages.length <= 1 || !gallery.images.pages[0]?.path) {
      try {
        const full = await getGallery(gallery.id, settings.cookies, settings.api_key);
        setSelectedGallery(full);
      } catch (e) {
        console.warn("Could not fetch full gallery for detail view:", e);
      }
    }
  };

  const handleOpenReader = async (gallery: Gallery, initialPage = 0) => {
    setReadingGallery(gallery);
    setInitialReadingPage(initialPage);
    // If gallery is from search summary, fetch full pages in background so reader loads HD pages immediately
    if (!gallery.images?.pages || gallery.images.pages.length <= 1 || !gallery.images.pages[0]?.path) {
      try {
        const full = await getGallery(gallery.id, settings.cookies, settings.api_key);
        setReadingGallery(full);
      } catch (e) {
        console.warn("Could not fetch full gallery for reader view:", e);
      }
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-[#121214] text-gray-100 overflow-hidden font-sans">
      {/* Full-width 3hentai 2-Tier Header Bar */}
      <Header
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onSearchSubmit={handleSearchSubmit}
        currentTab={currentTab}
        onTabChange={(tab) => setCurrentTab(tab)}
        sort={sort}
        onSortChange={handleSortChange}
        onRandomClick={handleRandomClick}
        isRandomLoading={isRandomLoading}
        selectedLanguage={selectedLanguage}
        onLanguageChange={handleLanguageChange}
      />

      {/* Main Tab Content Area */}
      <main className="flex-1 overflow-y-auto bg-[#121214] relative">
        {currentTab === "explorer" && (
          <GalleryGrid
            galleries={galleries}
            isLoading={isLoading}
            error={error}
            page={page}
            totalPages={totalPages}
            onPageChange={setPage}
            onSelectGallery={handleSelectGallery}
            onReadGallery={(g) => handleOpenReader(g, 0)}
            onQuickDownload={(g) => addToQueue(g)}
            queuedIds={queuedIds}
            onRetry={() => fetchGalleriesData(activeQuery, sort, page, selectedLanguage)}
            sort={sort}
            onSortChange={handleSortChange}
            currentSearchQuery={activeQuery}
            selectedLanguage={selectedLanguage}
          />
        )}

        {(currentTab === "series" ||
          currentTab === "tags" ||
          currentTab === "characters" ||
          currentTab === "artists" ||
          currentTab === "groups") && (
          <TaxonomyBrowserView
            categoryType={currentTab}
            onSelectTag={(tagName) => handleTagClick(tagName)}
          />
        )}

        {currentTab === "library" && <LibraryView />}

        {currentTab === "batch" && (
          <BatchDownloaderView
            onSuccessNavigateToDownloads={() => setCurrentTab("downloads")}
            onSelectGallery={setSelectedGallery}
          />
        )}

        {currentTab === "downloads" && <DownloaderView />}

        {currentTab === "settings" && <SettingsView />}
      </main>

      {/* Gallery Detail Modal (Screenshot 5 layout) */}
      <GalleryDetailModal
        gallery={selectedGallery}
        onClose={() => setSelectedGallery(null)}
        onTagClick={handleTagClick}
        onRead={handleOpenReader}
      />

      {/* Fullscreen Manga & Webtoon Reader Modal */}
      <ReaderModal
        gallery={readingGallery}
        initialPage={initialReadingPage}
        onClose={() => setReadingGallery(null)}
      />
    </div>
  );
}

export default App;
