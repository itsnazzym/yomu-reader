export const Platform = {
  OS: "android",
  Version: 35,
};
export const PermissionsAndroid = {
  PERMISSIONS: { POST_NOTIFICATIONS: "notifications", READ_MEDIA_IMAGES: "media", READ_EXTERNAL_STORAGE: "read", WRITE_EXTERNAL_STORAGE: "write" },
  RESULTS: { GRANTED: "granted", DENIED: "denied" },
  check: async (_permission: string): Promise<boolean> => false,
  request: async (_permission: string): Promise<string> => "denied",
  requestMultiple: async (_permissions: string[]): Promise<Record<string, string>> => ({}),
};
export const Linking = { openSettings: async () => {} };

// Requis par expo-modules-core (tiré via lib/sources/registry -> api/nhentai)
// lors du bundling de la sonde de sources.
export class NativeEventEmitter {
  addListener(): { remove: () => void } {
    return { remove: () => {} };
  }
  removeAllListeners(): void {}
}

export const TurboModuleRegistry = {
  getEnforcing(): unknown {
    return {};
  },
  get(): unknown {
    return null;
  },
};
