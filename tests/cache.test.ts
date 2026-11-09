import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  MemoryCache,
  userCacheKey,
  getOrSetCache,
  invalidateCache,
  memoryCache,
} from '@/lib/cache';

describe('MemoryCache', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
    vi.stubEnv('VERCEL', '');
    vi.stubEnv('AWS_LAMBDA_FUNCTION_NAME', '');
    vi.stubEnv('CACHE_MAX_TTL_SECONDS', '');
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it('returns undefined for missing keys and counts misses', () => {
    const c = new MemoryCache();
    expect(c.get('nope')).toBeUndefined();
    expect(c.getStats().misses).toBe(1);
  });

  it('stores and retrieves values, tracking hits', () => {
    const c = new MemoryCache();
    c.set('a', { x: 1 }, 60);
    expect(c.get('a')).toEqual({ x: 1 });
    expect(c.getStats()).toMatchObject({ hits: 1, misses: 0, size: 1, hitRate: '100.0%' });
  });

  it('reports 0% hit rate with no traffic', () => {
    expect(new MemoryCache().getStats().hitRate).toBe('0%');
  });

  it('expires entries after TTL', () => {
    const c = new MemoryCache();
    c.set('a', 1, 10);
    vi.advanceTimersByTime(10_000);
    expect(c.get('a')).toBe(1); // exactly at expiry is still valid (uses >)
    vi.advanceTimersByTime(1);
    expect(c.get('a')).toBeUndefined();
    expect(c.size).toBe(0);
  });

  it('can cache falsy values (0, null, empty string) apart from undefined', () => {
    const c = new MemoryCache();
    c.set('zero', 0, 10);
    c.set('null', null, 10);
    c.set('empty', '', 10);
    expect(c.get('zero')).toBe(0);
    expect(c.get('null')).toBeNull();
    expect(c.get('empty')).toBe('');
  });

  it('evicts the least recently used entry when maxEntries is reached', () => {
    const c = new MemoryCache(2);
    c.set('a', 1, 60);
    c.set('b', 2, 60);
    c.get('a'); // refresh 'a' => 'b' is now LRU
    c.set('c', 3, 60);
    expect(c.get('b')).toBeUndefined();
    expect(c.get('a')).toBe(1);
    expect(c.get('c')).toBe(3);
    expect(c.size).toBe(2);
  });

  it('overwriting an existing key does not evict others', () => {
    const c = new MemoryCache(2);
    c.set('a', 1, 60);
    c.set('b', 2, 60);
    c.set('a', 10, 60);
    expect(c.size).toBe(2);
    expect(c.get('a')).toBe(10);
    expect(c.get('b')).toBe(2);
  });

  it('delete removes a single key and reports whether it existed', () => {
    const c = new MemoryCache();
    c.set('a', 1, 60);
    expect(c.delete('a')).toBe(true);
    expect(c.delete('a')).toBe(false);
  });

  it('deleteByPrefix removes only matching keys and returns the count', () => {
    const c = new MemoryCache();
    c.set('u:1:classrooms:list', 1, 60);
    c.set('u:1:classrooms:detail', 2, 60);
    c.set('u:1:grades', 3, 60);
    c.set('u:10:classrooms', 4, 60);
    expect(c.deleteByPrefix('u:1:classrooms')).toBe(2);
    expect(c.get('u:1:grades')).toBe(3);
    expect(c.get('u:10:classrooms')).toBe(4);
    expect(c.deleteByPrefix('zzz')).toBe(0);
  });

  it('clear empties the cache and resets stats', () => {
    const c = new MemoryCache();
    c.set('a', 1, 60);
    c.get('a');
    c.clear();
    expect(c.size).toBe(0);
    expect(c.getStats()).toMatchObject({ hits: 0, misses: 0 });
  });

  it('caps TTL on serverless platforms (8s)', () => {
    vi.stubEnv('VERCEL', '1');
    const c = new MemoryCache();
    c.set('a', 1, 600);
    vi.advanceTimersByTime(8_001);
    expect(c.get('a')).toBeUndefined();
  });

  it('honors CACHE_MAX_TTL_SECONDS override', () => {
    vi.stubEnv('VERCEL', '1');
    vi.stubEnv('CACHE_MAX_TTL_SECONDS', '30');
    const c = new MemoryCache();
    c.set('a', 1, 600);
    vi.advanceTimersByTime(29_000);
    expect(c.get('a')).toBe(1);
    vi.advanceTimersByTime(2_000);
    expect(c.get('a')).toBeUndefined();
  });

  it('uses requested TTL unchanged on a long-lived server', () => {
    const c = new MemoryCache();
    c.set('a', 1, 600);
    vi.advanceTimersByTime(599_000);
    expect(c.get('a')).toBe(1);
  });
});

describe('userCacheKey', () => {
  it('builds a scoped key', () => {
    expect(userCacheKey(5, 'semester', 'active')).toBe('u:5:semester:active');
  });

  it('stringifies parts and maps null/undefined to empty string', () => {
    expect(userCacheKey(1, 'a', 2, true, null, undefined)).toBe('u:1:a:2:true::');
  });

  it('works with no parts', () => {
    expect(userCacheKey(3)).toBe('u:3:');
  });
});

describe('getOrSetCache / invalidateCache', () => {
  beforeEach(() => {
    memoryCache.clear();
  });

  it('calls the fetcher once and serves subsequent calls from cache', async () => {
    const fetcher = vi.fn().mockResolvedValue('data');
    const key = userCacheKey(99, 'test', 'once');
    expect(await getOrSetCache(key, 60, fetcher)).toBe('data');
    expect(await getOrSetCache(key, 60, fetcher)).toBe('data');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('refetches after invalidateCache(prefix)', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce('v1').mockResolvedValueOnce('v2');
    const key = userCacheKey(99, 'grades', 'list');
    expect(await getOrSetCache(key, 60, fetcher)).toBe('v1');
    expect(invalidateCache(userCacheKey(99, 'grades'))).toBe(1);
    expect(await getOrSetCache(key, 60, fetcher)).toBe('v2');
  });

  it('does not cache when the fetcher rejects', async () => {
    const key = userCacheKey(99, 'err');
    const fetcher = vi.fn().mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce('ok');
    await expect(getOrSetCache(key, 60, fetcher)).rejects.toThrow('boom');
    expect(await getOrSetCache(key, 60, fetcher)).toBe('ok');
  });
});
