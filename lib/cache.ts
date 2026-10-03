/**
 * In-Memory LRU Cache with TTL & Prefix Invalidation
 * 
 * Provides ultra-fast server-side memory caching for database queries
 * (e.g. active semesters, classroom lists, grade criteria, dashboard metrics)
 * to drastically reduce database connections and load on MySQL in Next.js.
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number; // timestamp in ms
}

export class MemoryCache {
  private cache = new Map<string, CacheEntry<unknown>>();
  private maxEntries: number;
  private hits = 0;
  private misses = 0;

  constructor(maxEntries = 2000) {
    this.maxEntries = maxEntries;
  }

  /**
   * Retrieve an item from cache. Returns undefined if missing or expired.
   * Updates LRU access order when found.
   */
  get<T>(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) {
      this.misses++;
      return undefined;
    }

    // Check TTL expiration
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.misses++;
      return undefined;
    }

    // Refresh LRU order (delete & re-insert to move to recent)
    this.cache.delete(key);
    this.cache.set(key, entry);
    this.hits++;

    return entry.value as T;
  }

  /**
   * Set an item in cache with a TTL (in seconds).
   * Evicts least recently used items if maxEntries is reached.
   */
  set<T>(key: string, value: T, ttlSeconds: number): void {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.maxEntries) {
      // Evict oldest (first key in map iteration order)
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  /**
   * Delete a single key from cache.
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Delete all keys that start with a given prefix.
   * Useful for invalidating all cache entries for a user or resource.
   * Example: invalidateByPrefix(`u:${userId}:classrooms`)
   */
  deleteByPrefix(prefix: string): number {
    let count = 0;
    for (const key of Array.from(this.cache.keys())) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
        count++;
      }
    }
    return count;
  }

  /**
   * Clear all entries.
   */
  clear(): void {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
  }

  /**
   * Current number of entries in the cache.
   */
  get size(): number {
    return this.cache.size;
  }

  /**
   * Performance metrics.
   */
  getStats() {
    const total = this.hits + this.misses;
    const hitRate = total > 0 ? ((this.hits / total) * 100).toFixed(1) + '%' : '0%';
    return {
      size: this.cache.size,
      maxEntries: this.maxEntries,
      hits: this.hits,
      misses: this.misses,
      hitRate,
    };
  }
}

// Preserve cache instance across hot module reloads in development (similar to lib/prisma.ts)
const globalForCache = globalThis as unknown as {
  memoryCache: MemoryCache | undefined;
};

export const memoryCache = globalForCache.memoryCache ?? new MemoryCache(3000);

if (process.env.NODE_ENV !== 'production') {
  globalForCache.memoryCache = memoryCache;
}

/**
 * Generates a scoped cache key for a user and topic/subtopics.
 */
export function userCacheKey(
  userId: number,
  ...parts: (string | number | boolean | null | undefined)[]
): string {
  const sanitized = parts.map(p => String(p ?? ''));
  return `u:${userId}:${sanitized.join(':')}`;
}

/**
 * Helper to get cached data or fetch and cache it if not present.
 */
export async function getOrSetCache<T>(
  key: string,
  ttlSeconds: number,
  fetcher: () => Promise<T>
): Promise<T> {
  const cached = memoryCache.get<T>(key);
  if (cached !== undefined) {
    return cached;
  }

  const freshData = await fetcher();
  memoryCache.set(key, freshData, ttlSeconds);
  return freshData;
}

/**
 * Invalidate cache by prefix.
 */
export function invalidateCache(prefix: string): number {
  return memoryCache.deleteByPrefix(prefix);
}
