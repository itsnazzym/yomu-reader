import * as SecureStore from "expo-secure-store";

/** Each service owns its namespace; queued operations cannot resurrect a removed session. */
export function createSecureSessionStorage(
  namespace: string,
  storage: Pick<typeof SecureStore, "getItemAsync" | "setItemAsync" | "deleteItemAsync"> = SecureStore
) {
  if (!/^[A-Za-z0-9_-]+(?:\.[A-Za-z0-9_-]+)*$/.test(namespace)) {
    throw new Error("Espace de stockage de session invalide.");
  }
  const knownKeys = new Set<string>();
  const pending = new Map<string, Promise<unknown>>();
  function storageKey(key: string): string {
    if (!/^[A-Za-z0-9_.-]+$/.test(key)) throw new Error("Clé de session invalide.");
    knownKeys.add(key);
    return `${namespace}.${key}`;
  }
  function enqueue<T>(key: string, operation: () => Promise<T>): Promise<T> {
    const previous = pending.get(key) || Promise.resolve();
    const work = previous.catch(() => {}).then(operation);
    pending.set(key, work);
    void work.finally(() => { if (pending.get(key) === work) pending.delete(key); }).catch(() => {});
    return work;
  }
  return {
    getItem(key: string): Promise<string | null> {
      const scoped = storageKey(key);
      return enqueue(key, () => storage.getItemAsync(scoped));
    },
    setItem(key: string, value: string): Promise<void> {
      const scoped = storageKey(key);
      return enqueue(key, () => storage.setItemAsync(scoped, value));
    },
    removeItem(key: string): Promise<void> {
      const scoped = storageKey(key);
      return enqueue(key, () => storage.deleteItemAsync(scoped));
    },
    async clear(): Promise<void> {
      const results = await Promise.allSettled([...knownKeys].map((key) => {
        const scoped = storageKey(key);
        return enqueue(key, () => storage.deleteItemAsync(scoped));
      }));
      if (results.some((result) => result.status === "rejected")) {
        throw new Error("Impossible d’effacer toutes les sessions de ce service. Réessayez la déconnexion.");
      }
    },
  };
}
