import { describe, expect, it } from 'vitest';
import { ImageLruCache } from '../utils/imageCache';

describe('ImageLruCache', () => {
  it('evicts least-recently-used entries when maxEntries is exceeded', () => {
    const cache = new ImageLruCache({ maxEntries: 2, maxBytes: 1024 * 1024, freshnessMs: 2000 });
    cache.set('a', { dataUrl: 'data:a', modifiedMs: 1, byteLen: 100, checkedAt: 1000 });
    cache.set('b', { dataUrl: 'data:b', modifiedMs: 2, byteLen: 100, checkedAt: 1000 });

    // Touch 'a' so 'b' becomes least-recently-used
    expect(cache.get('a')?.dataUrl).toBe('data:a');

    cache.set('c', { dataUrl: 'data:c', modifiedMs: 3, byteLen: 100, checkedAt: 1000 });

    expect(cache.size).toBe(2);
    expect(cache.get('b')).toBeUndefined();
    expect(cache.get('a')?.dataUrl).toBe('data:a');
    expect(cache.get('c')?.dataUrl).toBe('data:c');
  });

  it('evicts oldest entries to respect maxBytes budget', () => {
    const cache = new ImageLruCache({ maxEntries: 10, maxBytes: 1024, freshnessMs: 500 });
    cache.set('k1', { dataUrl: '1', modifiedMs: 1, byteLen: 600, checkedAt: 1000 });
    cache.set('k2', { dataUrl: '2', modifiedMs: 2, byteLen: 600, checkedAt: 1000 });

    expect(cache.size).toBe(1);
    expect(cache.bytes).toBe(600);
    expect(cache.get('k1')).toBeUndefined();
    expect(cache.get('k2')?.dataUrl).toBe('2');
  });

  it('tracks freshness TTL and clears cleanly', () => {
    const cache = new ImageLruCache({ maxEntries: 5, maxBytes: 4096, freshnessMs: 2000 });
    cache.set('img', { dataUrl: 'data:img', modifiedMs: 10, byteLen: 64, checkedAt: 1000 });
    const entry = cache.get('img')!;

    expect(cache.isFresh(entry, 2500)).toBe(true);
    expect(cache.isFresh(entry, 3000)).toBe(false);

    cache.touchChecked('img', 2900);
    expect(cache.isFresh(cache.get('img')!, 3500)).toBe(true);

    cache.clear();
    expect(cache.size).toBe(0);
    expect(cache.bytes).toBe(0);
  });

  it('skips caching payloads larger than maxBytes', () => {
    const cache = new ImageLruCache({ maxEntries: 5, maxBytes: 1024 });
    cache.set('huge', { dataUrl: 'data:huge', modifiedMs: 1, byteLen: 2048, checkedAt: 1000 });
    expect(cache.size).toBe(0);
    expect(cache.bytes).toBe(0);
  });
});
