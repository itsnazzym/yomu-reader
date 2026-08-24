import React from "react";
import { TabType } from "../../types";
import { useDownloadStore } from "../../stores/downloadStore";
import { useFavoriteStore } from "../../stores/favoriteStore";
import { useHistoryStore } from "../../stores/historyStore";
import { BrandLogo } from "../common/BrandLogo";
import { Icon } from "../common/Icon";

interface SidebarProps {
  currentTab: TabType;
  onTabChange: (tab: TabType) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onRandomClick: () => void;
  onOpenCloudflareModal: () => void;
  onOpenQuickShareModal?: () => void;
  isRandomLoading?: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onTabChange,
  isCollapsed,
  onToggleCollapse,
  onRandomClick,
  onOpenCloudflareModal,
  onOpenQuickShareModal,
  isRandomLoading = false,
}) => {
  const { queue } = useDownloadStore();
  const { favorites } = useFavoriteStore();
  const { history } = useHistoryStore();

  const downloadingCount = queue.filter(
    (i) => i.status === "downloading" || i.status === "queued"
  ).length;

  type NavItem = {
    id: TabType | "random" | "cloudflare" | "quickshare";
    label: string;
    icon: string;
    badge?: number | string;
    isAction?: boolean;
  };

  type NavSection = {
    title: string;
    items: NavItem[];
  };

  const sections: NavSection[] = [
    {
      title: "DÉCOUVRIR",
      items: [
        { id: "explorer", label: "Explorer (En Ligne)", icon: "explore" },
        { id: "random", label: "Aléatoire", icon: "casino", isAction: true },
      ],
    },
    {
      title: "COLLECTIONS",
      items: [
        {
          id: "favorites",
          label: "Mes Favoris",
          icon: "favorite",
          badge: favorites.length > 0 ? favorites.length : undefined,
        },
        {
          id: "history",
          label: "Historique",
          icon: "history",
          badge: history.length > 0 ? history.length : undefined,
        },
        { id: "library", label: "Ma Bibliothèque (CBZ)", icon: "local_library" },
      ],
    },
    {
      title: "EXPLORATION",
      items: [
        { id: "series", label: "Séries / Parodies", icon: "movie" },
        { id: "tags", label: "Tags", icon: "sell" },
        { id: "characters", label: "Personnages", icon: "person" },
        { id: "artists", label: "Artistes", icon: "brush" },
        { id: "groups", label: "Groupes", icon: "group" },
      ],
    },
    {
      title: "TÉLÉCHARGEMENTS",
      items: [
        { id: "batch", label: "Téléchargement par Lot", icon: "layers" },
        {
          id: "downloads",
          label: "File de Téléchargement",
          icon: "download",
          badge: downloadingCount > 0 ? downloadingCount : undefined,
        },
        {
          id: "quickshare",
          label: "Quick Share Wi-Fi (Phone)",
          icon: "wifi_tethering",
          isAction: true,
        },
      ],
    },
    {
      title: "SYSTÈME",
      items: [
        { id: "settings", label: "Paramètres", icon: "settings" },
        { id: "cloudflare", label: "Guichet Cloudflare", icon: "shield", isAction: true },
      ],
    },
  ];

  return (
    <aside
      className={`bg-[#0e0e14] border-r border-[#222230] flex flex-col justify-between select-none shrink-0 transition-all duration-300 z-30 ${
        isCollapsed ? "w-20" : "w-64"
      }`}
    >
      {/* Brand Logo & Collapse Toggle Header */}
      <div>
        <div className="p-4 border-b border-[#20202c] flex items-center justify-between gap-2">
          {!isCollapsed ? (
            <BrandLogo size="md" onClick={() => onTabChange("explorer")} />
          ) : (
            <button
              onClick={() => onTabChange("explorer")}
              className="w-10 h-10 rounded-xl bg-[#ed2553] text-white flex items-center justify-center font-black text-base shadow-lg shadow-[#ed2553]/30 mx-auto cursor-pointer"
              title="Yomu Reader"
            >
              nH
            </button>
          )}

          <button
            onClick={onToggleCollapse}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-[#1a1a26] transition-colors cursor-pointer"
            title={isCollapsed ? "Agrandir le menu" : "Réduire le menu"}
          >
            <Icon name={isCollapsed ? "chevron_right" : "chevron_left"} size={18} />
          </button>
        </div>

        {/* Navigation Sections */}
        <nav className="p-2 space-y-4 overflow-y-auto max-h-[calc(100vh-140px)] no-scrollbar">
          {sections.map((sec, idx) => (
            <div key={idx} className="space-y-1">
              {!isCollapsed && (
                <div className="px-3 py-1 text-[10px] font-bold text-gray-500 tracking-wider">
                  {sec.title}
                </div>
              )}

              {sec.items.map((item) => {
                if (item.id === "random") {
                  return (
                    <button
                      key="random"
                      onClick={onRandomClick}
                      disabled={isRandomLoading}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold text-gray-300 hover:text-white hover:bg-[#181824] transition-all cursor-pointer disabled:opacity-50 ${
                        isCollapsed ? "justify-center" : ""
                      }`}
                      title="Galerie au hasard"
                    >
                      <Icon
                        name={item.icon}
                        size={18}
                        className={`text-rose-400 shrink-0 ${isRandomLoading ? "animate-spin" : ""}`}
                      />
                      {!isCollapsed && <span>{item.label}</span>}
                    </button>
                  );
                }

                if (item.id === "cloudflare") {
                  return (
                    <button
                      key="cloudflare"
                      onClick={onOpenCloudflareModal}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold text-emerald-400 hover:text-emerald-300 hover:bg-emerald-950/30 transition-all cursor-pointer ${
                        isCollapsed ? "justify-center" : ""
                      }`}
                      title="Validation Cloudflare Turnstile"
                    >
                      <Icon name={item.icon} size={18} className="shrink-0" />
                      {!isCollapsed && <span>{item.label}</span>}
                    </button>
                  );
                }

                if (item.id === "quickshare") {
                  return (
                    <button
                      key="quickshare"
                      onClick={onOpenQuickShareModal}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold text-[#ed2553] hover:text-white hover:bg-[#ed2553]/20 border border-[#ed2553]/30 transition-all cursor-pointer ${
                        isCollapsed ? "justify-center" : ""
                      }`}
                      title="Quick Share Wi-Fi direct vers smartphone"
                    >
                      <Icon name={item.icon} size={18} className="shrink-0" />
                      {!isCollapsed && <span className="truncate">{item.label}</span>}
                    </button>
                  );
                }

                const isActive = currentTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => onTabChange(item.id as TabType)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                      isActive
                        ? "bg-[#ed2553] text-white shadow-md shadow-[#ed2553]/25"
                        : "text-gray-400 hover:text-gray-100 hover:bg-[#181824]"
                    } ${isCollapsed ? "justify-center" : ""}`}
                    title={isCollapsed ? item.label : undefined}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Icon
                        name={item.icon}
                        size={18}
                        className={`shrink-0 ${isActive ? "text-white" : "text-gray-400"}`}
                      />
                      {!isCollapsed && <span className="truncate">{item.label}</span>}
                    </div>

                    {!isCollapsed && item.badge !== undefined && (
                      <span
                        className={`text-[10px] px-2 py-0.2 rounded-full font-extrabold font-mono ml-2 ${
                          isActive
                            ? "bg-white text-[#ed2553]"
                            : item.id === "downloads"
                            ? "bg-[#ed2553] text-white animate-pulse"
                            : "bg-[#252536] text-gray-300"
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>
      </div>

      {/* Footer Info */}
      <div className="p-3 border-t border-[#1c1c28] bg-[#0a0a0f]">
        {!isCollapsed ? (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-gray-300 font-semibold text-[11px]">En Ligne</span>
              </span>
              <span className="font-mono text-[10px] text-gray-500">v1.0 Pro</span>
            </div>
            <div className="text-[10px] text-gray-400 font-mono truncate">
              Moteur : <span className="text-rose-400 font-bold">Electron HD</span>
            </div>
          </div>
        ) : (
          <div className="flex justify-center" title="Connecté">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
          </div>
        )}
      </div>
    </aside>
  );
};
