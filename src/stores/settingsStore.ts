import { create } from "zustand";
import { AppSettings } from "../types";
import {
  getDefaultSettings,
  updateDnsSettings,
  isElectron,
  getSecretStatus,
  setSecrets,
  migrateSecrets,
} from "../utils/ipc";

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
  api_key: "",
  hasSecureCookies: false,
  hasSecureApiKey: false,
  dns_provider: "adguard",
  enable_custom_dns: true,
  enable_doh: true,
};

function readLocalSettings(): Partial<AppSettings> {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : {};
  } catch {
    return {};
  }
}

function persistPublicSettings(settings: AppSettings) {
  const { cookies: _cookies, api_key: _apiKey, ...publicSettings } = settings;
  const toSave = isElectron()
    ? publicSettings
    : settings;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
  } catch (e) {
    console.error("Failed to persist settings:", e);
  }
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: (() => {
    try {
      const saved = readLocalSettings();
      if (isElectron()) {
        const { cookies: _c, api_key: _k, ...rest } = saved;
        return { ...defaultInitial, ...rest, cookies: "", api_key: "" };
      }
      return { ...defaultInitial, ...saved };
    } catch {
      return defaultInitial;
    }
  })(),
  isLoading: false,

  loadSettings: async () => {
    set({ isLoading: true });
    try {
      const backendSettings = await getDefaultSettings();
      const saved = readLocalSettings();
      if (isElectron()) {
        if (saved.cookies || saved.api_key) {
          await migrateSecrets({
            cookies: String(saved.cookies || ""),
            apiKey: String(saved.api_key || ""),
          });
          const { cookies: _c, api_key: _k, ...rest } = saved;
          localStorage.setItem(STORAGE_KEY, JSON.stringify(rest));
        }
        const status = await getSecretStatus();
        const merged = {
          ...backendSettings,
          ...saved,
          cookies: "",
          api_key: "",
          hasSecureCookies: status.hasCookies,
          hasSecureApiKey: status.hasApiKey,
        };
        persistPublicSettings(merged);
        set({ settings: merged, isLoading: false });
        return;
      }
      const merged = { ...backendSettings, ...saved };
      set({ settings: merged, isLoading: false });
    } catch (e) {
      console.error("Failed to load backend settings:", e);
      set({ isLoading: false });
    }
  },

  updateSettings: (partial) => {
    const current = get().settings;
    if (isElectron() && (partial.cookies !== undefined || partial.api_key !== undefined)) {
      void setSecrets({
        cookies: partial.cookies,
        apiKey: partial.api_key,
      }).then((status) => {
        const updated = {
          ...get().settings,
          cookies: "",
          api_key: "",
          hasSecureCookies: status?.hasCookies ?? Boolean(partial.cookies || get().settings.hasSecureCookies),
          hasSecureApiKey: status?.hasApiKey ?? Boolean(partial.api_key || get().settings.hasSecureApiKey),
        };
        persistPublicSettings(updated);
        set({ settings: updated });
      }).catch(() => {});
      const optimistic = {
        ...current,
        ...partial,
        cookies: "",
        api_key: "",
        hasSecureCookies: partial.cookies !== undefined ? Boolean(partial.cookies) : current.hasSecureCookies,
        hasSecureApiKey: partial.api_key !== undefined ? Boolean(partial.api_key) : current.hasSecureApiKey,
      };
      persistPublicSettings(optimistic);
      set({ settings: optimistic });
      return;
    }

    const updated = { ...current, ...partial };
    set({ settings: updated });
    persistPublicSettings(updated);
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
