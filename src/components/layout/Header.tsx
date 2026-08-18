import React, { useState } from "react";
import { TabType } from "../../types";
import { Icon } from "../common/Icon";
import { SearchAutocomplete } from "../common/SearchAutocomplete";
import { useDownloadStore } from "../../stores/downloadStore";

interface HeaderProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onSearchSubmit: () => void;
  onTabChange: (tab: TabType) => void;
  onRandomClick: () => void;
  isRandomLoading?: boolean;
  selectedLanguage: string;
  onLanguageChange: (lang: string) => void;
  onToggleSidebar?: () => void;
  onOpenCloudflareModal?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  searchQuery,
  onSearchChange,
  onSearchSubmit,
  onTabChange,
  onRandomClick,
  isRandomLoading = false,
  selectedLanguage,
  onLanguageChange,
  onToggleSidebar,
  onOpenCloudflareModal,
}) => {
  const [isLangOpen, setIsLangOpen] = useState(false);
  const { queue } = useDownloadStore();

  const downloadingCount = queue.filter(
    (i) => i.status === "downloading" || i.status === "queued"
  ).length;

  const languages = [
    { id: "all", label: "Toutes les langues", code: "ALL" },
    { id: "french", label: "Français", code: "FR" },
    { id: "english", label: "English", code: "EN" },
    { id: "japanese", label: "日本語", code: "JP" },
    { id: "chinese", label: "中文", code: "ZH" },
    { id: "spanish", label: "Español", code: "ES" },
    { id: "italian", label: "Italiano", code: "IT" },
  ];

  const currentLangObj =
    languages.find((l) => l.id === selectedLanguage) || languages[0];

  return (
    <header className="bg-[#12121a]/95 backdrop-blur-md border-b border-[#222230] select-none shrink-0 z-20 sticky top-0">
      <div className="max-w-7xl mx-auto px-4 py-2.5 flex items-center justify-between gap-4">
        {/* Left: Sidebar Toggle & Fast Action */}
        <div className="flex items-center gap-2.5">
          {onToggleSidebar && (
            <button
              onClick={onToggleSidebar}
              className="p-2 rounded-xl bg-[#1a1a24] hover:bg-[#252535] text-gray-300 hover:text-white border border-[#2d2d40] transition-colors cursor-pointer"
              title="Afficher/Masquer le menu latéral"
            >
              <Icon name="menu" size={20} />
            </button>
          )}

          <button
            onClick={onRandomClick}
            disabled={isRandomLoading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#1a1a24] hover:bg-[#252535] text-gray-200 text-xs font-semibold border border-[#2d2d40] transition-colors disabled:opacity-50 cursor-pointer"
            title="Ouvrir une galerie au hasard"
          >
            <Icon
              name="casino"
              size={16}
              className={`text-[#ed2553] ${isRandomLoading ? "animate-spin" : ""}`}
            />
            <span className="hidden sm:inline">Aléatoire</span>
          </button>
        </div>

        {/* Center: Search Bar with Autocomplete */}
        <div className="flex-1 max-w-xl">
          <SearchAutocomplete
            value={searchQuery}
            onChange={onSearchChange}
            onSubmit={onSearchSubmit}
            placeholder="Rechercher (ex: artist:..., parody:..., tag:...)"
          />
        </div>

        {/* Right: Language, Downloads, Cloudflare, Settings */}
        <div className="flex items-center gap-2.5">
          {/* Active Downloads Pill */}
          {downloadingCount > 0 && (
            <button
              onClick={() => onTabChange("downloads")}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#ed2553]/20 border border-[#ed2553]/50 text-rose-300 text-xs font-bold transition-all shadow-md animate-pulse cursor-pointer"
              title="Téléchargements en cours"
            >
              <Icon name="download" size={16} className="text-[#ed2553]" />
              <span className="font-mono">{downloadingCount} en cours</span>
            </button>
          )}

          {/* Cloudflare Quick Solver */}
          {onOpenCloudflareModal && (
            <button
              onClick={onOpenCloudflareModal}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-[#1a1a24] hover:bg-[#252535] text-emerald-400 text-xs font-semibold border border-[#2d2d40] transition-colors cursor-pointer"
              title="Statut de session Cloudflare Turnstile"
            >
              <Icon name="shield" size={16} />
              <span className="hidden md:inline text-[11px]">Cloudflare</span>
            </button>
          )}

          {/* Language Switcher */}
          <div className="relative">
            <button
              onClick={() => setIsLangOpen(!isLangOpen)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#1a1a24] hover:bg-[#252535] text-gray-200 text-xs font-semibold border border-[#2d2d40] transition-colors cursor-pointer"
            >
              <Icon name="language" size={16} className="text-rose-400" />
              <span className="text-[11px] font-mono font-bold">{currentLangObj.code}</span>
              <Icon name="expand_more" size={16} className="text-gray-400" />
            </button>

            {isLangOpen && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setIsLangOpen(false)}
                />
                <div className="absolute right-0 top-full mt-1.5 w-48 bg-[#181824] border border-[#333348] rounded-xl shadow-2xl py-1 z-50 overflow-hidden">
                  <div className="px-3 py-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider border-b border-[#252536]">
                    Filtrer par langue
                  </div>
                  {languages.map((lang) => (
                    <button
                      key={lang.id}
                      onClick={() => {
                        onLanguageChange(lang.id);
                        setIsLangOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 text-xs text-left transition-colors cursor-pointer ${
                        selectedLanguage === lang.id
                          ? "bg-[#ed2553] text-white font-bold"
                          : "text-gray-300 hover:bg-[#252535] hover:text-white"
                      }`}
                    >
                      <span>{lang.label}</span>
                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-black/40 text-gray-300">
                        {lang.code}
                      </span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
