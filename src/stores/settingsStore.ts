import { create } from "zustand";
import { AppSettings } from "../types";
import { getDefaultSettings, updateDnsSettings } from "../utils/ipc";

interface SettingsState {
  settings: AppSettings;
  isLoading: boolean;
  loadSettings: () => Promise<void>;
  updateSettings: (partial: Partial<AppSettings>) => void;
  addBlacklistedTag: (tag: string) => void;
  removeBlacklistedTag: (tag: string) => void;
  setCookies: (cookies: string) => void;
}

const STORAGE_KEY = "nhentai_launcher_settings";

const defaultInitial: AppSettings = {
  download_directory: "C:\\nHentai Downloads",
  naming_pattern: "[{id}] [{artist}] {title} ({language})",
  default_format: "cbz",
  concurrent_downloads: 2,
  concurrent_images_per_gallery: 4,
  blacklisted_tags: ["scat", "guro"],
  cookies: "",
  // La clé API n'est jamais codée en dur : elle se saisit dans les Réglages
  // (ou via la variable d'environnement NHENTAI_API_KEY côté Electron).
  api_key: "",
  dns_provider: "adguard",
  enable_custom_dns: true,
  enable_doh: true,
};

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: (() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? { ...defaultInitial, ...JSON.parse(saved) } : defaultInitial;
    } catch {
      return defaultInitial;
    }
  })(),
  isLoading: false,

  loadSettings: async () => {
    set({ isLoading: true });
    try {
      const backendSettings = await getDefaultSettings();
      const saved = localStorage.getItem(STORAGE_KEY);
      const merged = saved
        ? { ...backendSettings, ...JSON.parse(saved) }
        : backendSettings;
      set({ settings: merged, isLoading: false });
    } catch (e) {
      console.error("Failed to load backend settings:", e);
      set({ isLoading: false });
    }
  },

  updateSettings: (partial) => {
    const updated = { ...get().settings, ...partial };
    set({ settings: updated });
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.error("Failed to persist settings:", e);
    }
    if (
      partial.dns_provider !== undefined ||
      partial.enable_custom_dns !== undefined ||
      partial.enable_doh !== undefined
    ) {
      updateDnsSettings({
        dns_provider: updated.dns_provider || "adguard",
        enable_custom_dns: updated.enable_custom_dns ?? true,
        enable_doh: updated.enable_doh ?? true,
      }).catch(() => {});
    }
  },

  addBlacklistedTag: (tag) => {
    const clean = tag.trim().toLowerCase();
    if (!clean) return;
    const current = get().settings.blacklisted_tags;
    if (!current.includes(clean)) {
      get().updateSettings({ blacklisted_tags: [...current, clean] });
    }
  },

  removeBlacklistedTag: (tag) => {
    const current = get().settings.blacklisted_tags;
    get().updateSettings({
      blacklisted_tags: current.filter((t) => t !== tag),
    });
  },

  setCookies: (cookies) => {
    get().updateSettings({ cookies });
  },
}));
