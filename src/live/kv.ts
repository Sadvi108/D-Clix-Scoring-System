// Key-value storage the live modules use, so tests can run them with memory instead of AsyncStorage.
export interface KV {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}

export function memoryKV(seed: Record<string, string> = {}): KV & { dump(): Record<string, string> } {
  const m = new Map(Object.entries(seed));
  return {
    get: async (k) => m.get(k) ?? null,
    set: async (k, v) => { m.set(k, v); },
    remove: async (k) => { m.delete(k); },
    dump: () => Object.fromEntries(m),
  };
}
