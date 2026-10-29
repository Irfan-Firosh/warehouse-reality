/**
 * In-memory TTL cache of promises, for a single-instance server. Concurrent
 * callers for one key share the in-flight promise; a settled value stays until
 * it expires, unless `keep` rejects it.
 */

interface Entry<T> {
  value: Promise<T>;
  expiresAt: number;
}

export interface TtlCache<T> {
  get: (
    key: string,
    load: () => Promise<T>,
    keep: (value: T) => boolean,
  ) => Promise<T>;
}

export const createTtlCache = <T>({
  ttlMs,
  maxEntries,
}: {
  ttlMs: number;
  maxEntries: number;
}): TtlCache<T> => {
  const entries = new Map<string, Entry<T>>();

  const evictOldest = (): void => {
    for (const key of entries.keys()) {
      if (entries.size < maxEntries) return;
      entries.delete(key);
    }
  };

  return {
    get: (key, load, keep) => {
      const hit = entries.get(key);
      if (hit && hit.expiresAt > Date.now()) return hit.value;
      entries.delete(key);
      evictOldest();
      const value = load();
      const entry = { value, expiresAt: Number.POSITIVE_INFINITY };
      entries.set(key, entry);
      value.then(
        (settled) => {
          if (entries.get(key) !== entry) return;
          if (keep(settled)) {
            entries.set(key, { value, expiresAt: Date.now() + ttlMs });
          } else {
            entries.delete(key);
          }
        },
        () => {
          if (entries.get(key) === entry) entries.delete(key);
        },
      );
      return value;
    },
  };
};
