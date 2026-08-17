import React, { useState } from "react";
import { SortOption, TabType } from "../../types";
import { BrandLogo } from "../common/BrandLogo";
import { Icon } from "../common/Icon";
import { useDownloadStore } from "../../stores/downloadStore";

interface HeaderProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onSearchSubmit: () => void;
  currentTab: TabType;
  onTabChange: (tab: TabType) => void;
  sort: SortOption;
  onSortChange: (sort: SortOption) => void;
  onRandomClick?: () => void;
  isRandomLoading?: boolean;
  selectedLanguage: string;
  onLanguageChange: (lang: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  searchQuery,
  onSearchChange,
  onSearchSubmit,
  currentTab,
  onTabChange,
  onRandomClick,
  isRandomLoading = false,
  selectedLanguage,
  onLanguageChange,
}) => {
  const [isLangOpen, setIsLangOpen] = useState(false);
  const { queue } = useDownloadStore();
  const downloadingCount = queue.filter(
    (i) => i.status === "downloading" || i.status === "queued"
  ).length;

  const languages = [
    { id: "french", label: "Français", code: "FR" },
    { id: "english", label: "English", code: "EN" },
    { id: "japanese", label: "Japanese", code: "JA" },
    { id: "spanish", label: "Español", code: "ES" },
    { id: "italian", label: "Italiano", code: "IT" },
    { id: "portuguese", label: "Português", code: "PT" },
    { id: "russian", label: "Русский", code: "RU" },
    { id: "all", label: "Toutes les langues", code: "ALL" },
  ];

  const currentLangObj =
    languages.find((l) => l.id === selectedLanguage) || languages[0];

  const subNavItems: { id: TabType | "random"; label: string; icon: string; isSpecial?: boolean }[] = [
    { id: "random", label: "Aléatoire", icon: "casino", isSpecial: true },
    { id: "series", label: "Séries", icon: "movie" },
    { id: "tags", label: "Tags", icon: "sell" },
    { id: "characters", label: "Personnages", icon: "person" },
    { id: "artists", label: "Artistes", icon: "brush" },
    { id: "groups", label: "Groupes", icon: "group" },
    { id: "library", label: "Ma Bibliothèque (CBZ)", icon: "local_library" },
    { id: "batch", label: "Téléchargement par Lot", icon: "layers" },
  ];

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      onSearchSubmit();
    }
  };

  return (
    <header className="bg-[#18181c] border-b border-[#252530] select-none shrink-0 z-30">
      {/* Tier 1: Main Header Bar */}
      <div className="max-w-7xl mx-auto px-4 py-2.5 flex items-center justify-between gap-4">
        {/* Left: Brand Logo */}
        <BrandLogo size="md" onClick={() => onTabChange("explorer")} />

        {/* Center: Large Search Bar with Magenta Square Submit Button */}
        <div className="flex-1 max-w-2xl flex items-stretch">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Rechercher par titre, tag, artiste ou code..."
            className="flex-1 bg-[#25252e] text-white placeholder-gray-400 px-4 py-1.5 rounded-l-md text-sm outline-none border border-[#333340] border-r-0 focus:bg-[#2b2b36] transition-colors"
          />
          <button
            onClick={onSearchSubmit}
            className="bg-[#ed2553] hover:bg-[#f43f5e] text-white px-4 rounded-r-md flex items-center justify-center transition-colors shadow-sm cursor-pointer"
            title="Lancer la recherche"
          >
            <Icon name="search" size={20} />
          </button>
        </div>

        {/* Right: Quick Action Buttons & Language Selector */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => onTabChange("downloads")}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#25252e] hover:bg-[#30303c] text-gray-200 text-xs font-semibold border border-[#353545] transition-colors relative cursor-pointer"
            title="File de téléchargements"
          >
            <Icon name="download" size={16} className="text-rose-400" />
            <span className="hidden sm:inline">Téléchargements</span>
            {downloadingCount > 0 && (
              <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-[#ed2553] text-white font-extrabold animate-pulse">
                {downloadingCount}
              </span>
            )}
          </button>

          <button
            onClick={() => onTabChange("settings")}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-md bg-[#ed2553] hover:bg-[#f43f5e] text-white text-xs font-bold transition-colors shadow-sm cursor-pointer"
            title="Paramètres de l'application"
          >
            <Icon name="settings" size={16} />
            <span>Paramètres</span>
          </button>

          {/* Language Switcher Dropdown */}
          <div className="relative">
            <button
              onClick={() => setIsLangOpen(!isLangOpen)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-[#25252e] hover:bg-[#30303c] text-gray-200 text-xs font-semibold border border-[#353545] transition-colors cursor-pointer"
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
                <div className="absolute right-0 top-full mt-1 w-48 bg-[#1f1f26] border border-[#333342] rounded-lg shadow-2xl py-1 z-50 overflow-hidden">
                  <div className="px-3 py-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider border-b border-[#2d2d3a]">
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
                          : "text-gray-300 hover:bg-[#2c2c38] hover:text-white"
                      }`}
                    >
                      <span>{lang.label}</span>
                      <span className="text-[10px] font-mono px-1 rounded bg-black/30 text-gray-300">
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

      {/* Tier 2: Sub-Navigation Bar */}
      <div className="bg-[#141418] border-t border-[#23232c] px-4">
        <div className="max-w-7xl mx-auto flex items-center justify-center sm:justify-start gap-1 py-1 overflow-x-auto no-scrollbar">
          {subNavItems.map((item) => {
            if (item.id === "random") {
              return (
                <button
                  key="random"
                  onClick={onRandomClick}
                  disabled={isRandomLoading}
                  className="flex items-center gap-1 px-3 py-1 rounded-md text-xs font-semibold text-gray-300 hover:text-white hover:bg-[#252530] transition-colors disabled:opacity-50 cursor-pointer"
                  title="Ouvrir une galerie au hasard"
                >
                  <Icon
                    name={item.icon}
                    size={16}
                    className={`text-rose-400 ${isRandomLoading ? "animate-spin" : ""}`}
                  />
                  <span>Aléatoire</span>
                </button>
              );
            }

            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id as TabType)}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-semibold transition-all whitespace-nowrap cursor-pointer ${
                  isActive
                    ? "bg-[#ed2553] text-white shadow-sm"
                    : "text-gray-300 hover:text-white hover:bg-[#22222b]"
                }`}
              >
                <Icon name={item.icon} size={15} className={isActive ? "text-white" : "text-gray-400"} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
};
