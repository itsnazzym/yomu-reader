const store = new Map<string, string>();

export default {
  getItem: async (key: string): Promise<string | null> =>
    store.has(key) ? store.get(key)! : null,
  setItem: async (key: string, value: string): Promise<void> => {
    store.set(key, value);
  },
  removeItem: async (key: string): Promise<void> => {
    store.delete(key);
  },
};

export function __mockReset(): void {
  store.clear();
}

export function __mockSet(key: string, value: unknown): void {
  store.set(key, JSON.stringify(value));
}
