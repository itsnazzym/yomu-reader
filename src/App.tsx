import { useState, useEffect } from "react";
import { Header } from "./components/layout/Header";
import { Sidebar } from "./components/layout/Sidebar";
import { GalleryGrid } from "./components/gallery/GalleryGrid";
import { GalleryDetailModal } from "./components/gallery/GalleryDetailModal";
import { ReaderModal } from "./components/reader/ReaderModal";
import { BatchDownloaderView } from "./components/batch/BatchDownloaderView";
import { DownloaderView } from "./components/downloader/DownloaderView";
import { SettingsView } from "./components/settings/SettingsView";
import { LibraryView } from "./components/library/LibraryView";
import { TaxonomyBrowserView } from "./components/taxonomy/TaxonomyBrowserView";
import { FavoritesView } from "./components/favorites/FavoritesView";
import { HistoryView } from "./components/history/HistoryView";
import { CloudflareGateModal } from "./components/common/CloudflareGateModal";
import { QuickShareHubModal } from "./components/share/QuickShareHubModal";
import { TabType, SortOption, Gallery, Tag } from "./types";
import { searchGalleries, getGallery, getRandomGallery, onCloudflareChallengeNeeded } from "./utils/ipc";
import { useDownloadStore } from "./stores/downloadStore";
import { useSettingsStore } from "./stores/settingsStore";
import { useHistoryStore } from "./stores/historyStore";
import { nativeIdAsNumber } from "./utils/globalId";

export function App() {
  const [currentTab, setCurrentTab] = useState<TabType>("explorer");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeQuery, setActiveQuery] = useState("");
  const [sort, setSort] = useState<SortOption>("date");
  const [selectedLanguage, setSelectedLanguage] = useState<string>("english");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [galleries, setGalleries] = useState<Gallery[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRandomLoading, setIsRandomLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedGallery, setSelectedGallery] = useState<Gallery | null>(null);
  const [readingGallery, setReadingGallery] = useState<Gallery | null>(null);
  const [initialReadingPage, setInitialReadingPage] = useState(0);
  const [isCloudflareModalOpen, setIsCloudflareModalOpen] = useState(false);
  const [isQuickShareModalOpen, setIsQuickShareModalOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    return localStorage.getItem("nhentai_sidebar_collapsed") === "true";
  });

  const { queue, addToQueue, initListener } = useDownloadStore();
  const { settings, loadSettings } = useSettingsStore();
  const history = useHistoryStore((s) => s.history);
  const resumeCandidate = history.find((entry) => {
    const total = entry.totalPages || 1;
    return (
      !entry.sourceUnavailable &&
      entry.lastReadPage > 0 &&
      total > 1 &&
      entry.lastReadPage < total - 1
    );
  });

  const queuedIds = new Set(
    queue
      .filter((i) => i.status === "downloading" || i.status === "queued")
      .map((i) => i.id)
  );

  // Initialize settings and IPC listeners
  useEffect(() => {
    loadSettings();
    const unlisten = initListener();
    const unlistenCf = onCloudflareChallengeNeeded(() => {
      setIsCloudflareModalOpen(true);
    });
    return () => {
      unlisten();
      unlistenCf();
    };
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

      // Add language filter if not "all" and not already in query
      if (lang && lang !== "all" && !q.toLowerCase().includes("language:")) {
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
      const errMsg = err.message || "Impossible de charger les galeries nHentai.";
      setError(errMsg);
      if (errMsg.includes("403") || errMsg.toLowerCase().includes("cloudflare") || errMsg.toLowerCase().includes("captcha")) {
        setIsCloudflareModalOpen(true);
      }
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
    <div className="flex h-screen w-screen bg-[#101018] text-gray-100 overflow-hidden font-sans select-none">
      {/* Left Collapsible Navigation Drawer */}
      <Sidebar
        currentTab={currentTab}
        onTabChange={(tab) => {
          setCurrentTab(tab);
          if (tab === "explorer" && !activeQuery) {
            setPage(1);
          }
        }}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => {
          const next = !isSidebarCollapsed;
          setIsSidebarCollapsed(next);
          localStorage.setItem("nhentai_sidebar_collapsed", String(next));
        }}
        onRandomClick={handleRandomClick}
        isRandomLoading={isRandomLoading}
        onOpenCloudflareModal={() => setIsCloudflareModalOpen(true)}
        onOpenQuickShareModal={() => setIsQuickShareModalOpen(true)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-[#101018]">
        {/* Top Header Bar */}
        <Header
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onSearchSubmit={handleSearchSubmit}
          onTabChange={setCurrentTab}
          onRandomClick={handleRandomClick}
          isRandomLoading={isRandomLoading}
          selectedLanguage={selectedLanguage}
          onLanguageChange={handleLanguageChange}
          onToggleSidebar={() => {
            const next = !isSidebarCollapsed;
            setIsSidebarCollapsed(next);
            localStorage.setItem("nhentai_sidebar_collapsed", String(next));
          }}
          onOpenCloudflareModal={() => setIsCloudflareModalOpen(true)}
        />

        {/* Scrollable View Content */}
        <main className="flex-1 overflow-y-auto bg-[#101018] relative">
          {currentTab === "explorer" && (
            <>
              {resumeCandidate && (
                <button
                  type="button"
                  onClick={async () => {
                    const nid = nativeIdAsNumber(resumeCandidate.id);
                    if (!nid) return;
                    try {
                      const g = await getGallery(
                        nid,
                        settings.cookies,
                        settings.api_key
                      );
                      handleOpenReader(g, resumeCandidate.lastReadPage);
                    } catch (e) {
                      console.error("Resume failed:", e);
                    }
                  }}
                  className="mx-4 mt-4 mb-1 w-[calc(100%-2rem)] flex items-center gap-3 px-4 py-3 rounded-2xl bg-[#161620] border border-[#ed2553]/35 hover:border-[#ed2553]/70 text-left cursor-pointer transition-colors"
                >
                  <div className="w-10 h-10 rounded-xl bg-[#ed2553]/15 text-[#ed2553] flex items-center justify-center shrink-0">
                    <span className="text-lg">▶</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-[#ed2553]">
                      Continuer
                    </div>
                    <div className="text-sm font-semibold text-white truncate">
                      {resumeCandidate.title}
                    </div>
                    <div className="text-[11px] text-gray-400 font-mono">
                      Page {resumeCandidate.lastReadPage + 1} /{" "}
                      {resumeCandidate.totalPages} · {resumeCandidate.id}
                    </div>
                  </div>
                </button>
              )}
              <GalleryGrid
              galleries={galleries}
              isLoading={isLoading}
              error={error}
              page={page}
              totalPages={totalPages}
              onPageChange={setPage}
              onSelectGallery={handleSelectGallery}
              onReadGallery={(g, p) => handleOpenReader(g, p || 0)}
              onQuickDownload={(g) => addToQueue(g)}
              onTagClick={handleTagClick}
              queuedIds={queuedIds}
              onRetry={() => fetchGalleriesData(activeQuery, sort, page, selectedLanguage)}
              sort={sort}
              onSortChange={handleSortChange}
              currentSearchQuery={activeQuery}
              selectedLanguage={selectedLanguage}
            />
            </>
          )}

        {currentTab === "favorites" && (
          <FavoritesView
            onSelectGallery={handleSelectGallery}
            onReadGallery={(g, initialPage) => handleOpenReader(g, initialPage || 0)}
            onQuickDownload={(g) => addToQueue(g)}
          />
        )}

        {currentTab === "history" && (
          <HistoryView
            onOpenOnlineReader={async (galleryId, initialPage) => {
              try {
                const g = await getGallery(galleryId, settings.cookies, settings.api_key);
                handleOpenReader(g, initialPage);
              } catch (e) {
                console.error("Failed to load gallery from history:", e);
              }
            }}
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
    </div>

      {/* Cloudflare Captcha Gate Modal */}
      <CloudflareGateModal
        isOpen={isCloudflareModalOpen}
        onClose={() => setIsCloudflareModalOpen(false)}
        onSuccess={() => {
          fetchGalleriesData(activeQuery, sort, page, selectedLanguage);
        }}
      />

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

      {/* Global Quick Share Wi-Fi Gigabit Modal */}
      {isQuickShareModalOpen && (
        <QuickShareHubModal
          onClose={() => setIsQuickShareModalOpen(false)}
          initialDirectory={settings.download_directory}
        />
      )}
    </div>
  );
}

export default App;
