import React from "react";
import { TabType } from "../../types";
import { useDownloadStore } from "../../stores/downloadStore";
import { BrandLogo } from "../common/BrandLogo";
import { Icon } from "../common/Icon";

interface SidebarProps {
  currentTab: TabType;
  onTabChange: (tab: TabType) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentTab, onTabChange }) => {
  const { queue } = useDownloadStore();
  const downloadingCount = queue.filter((i) => i.status === "downloading" || i.status === "queued").length;

  const navItems: { id: TabType; label: string; icon: string; badge?: number }[] = [
    { id: "explorer", label: "Explorer (En Ligne)", icon: "explore" },
    { id: "library", label: "Ma Bibliothèque (CBZ)", icon: "local_library" },
    { id: "batch", label: "Téléchargement par Lot", icon: "layers" },
    {
      id: "downloads",
      label: "Téléchargements",
      icon: "download",
      badge: downloadingCount > 0 ? downloadingCount : undefined,
    },
    { id: "settings", label: "Paramètres", icon: "settings" },
  ];

  return (
    <aside className="w-64 bg-[#0d0d12] border-r border-[#22222d] flex flex-col justify-between select-none shrink-0">
      {/* Brand Logo Header */}
      <div>
        <div className="p-5 border-b border-[#22222d]">
          <BrandLogo size="md" />
        </div>

        {/* Navigation Items */}
        <nav className="p-3 space-y-1">
          {navItems.map((item) => {
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                  isActive
                    ? "bg-[#ed2553] text-white shadow-md shadow-[#ed2553]/25"
                    : "text-gray-400 hover:text-gray-100 hover:bg-[#181824]"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon
                    name={item.icon}
                    size={20}
                    className={isActive ? "text-white" : "text-gray-400"}
                  />
                  <span>{item.label}</span>
                </div>
                {item.badge !== undefined && (
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-extrabold animate-pulse ${
                      isActive ? "bg-white text-[#ed2553]" : "bg-[#ed2553] text-white"
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* System Status Footer */}
      <div className="p-4 border-t border-[#1f1f2a] bg-[#09090d]">
        <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-gray-400 font-medium">Session Active</span>
          </span>
          <span className="font-mono text-[10px] text-gray-400 font-bold">v1.0.0 Pro</span>
        </div>
        <div className="text-[10px] text-gray-500 truncate">
          Format: <span className="text-gray-300 font-semibold uppercase">CBZ ComicInfo</span>
        </div>
      </div>
    </aside>
  );
};
