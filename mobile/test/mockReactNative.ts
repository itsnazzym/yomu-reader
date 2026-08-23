export const Platform = {
  OS: "android",
  Version: 35,
};

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
