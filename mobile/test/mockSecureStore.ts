const secureValues = new Map<string, string>();

export async function getItemAsync(key: string): Promise<string | null> {
  return secureValues.get(key) ?? null;
}

export async function setItemAsync(key: string, value: string): Promise<void> {
  secureValues.set(key, value);
}

export async function deleteItemAsync(key: string): Promise<void> {
  secureValues.delete(key);
}
