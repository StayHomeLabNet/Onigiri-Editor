export interface ImageCacheEntry {
  dataUrl: string;
  modifiedMs: number;
  byteLen: number;
  checkedAt: number;
}

export interface ImageLruCacheOptions {
  maxEntries?: number;
  maxBytes?: number;
  freshnessMs?: number;
}

const DEFAULT_MAX_ENTRIES = 120;
const DEFAULT_MAX_BYTES = 48 * 1024 * 1024; // 48 MiB
const DEFAULT_FRESHNESS_MS = 2000;

export class ImageLruCache {
  private map = new Map<string, ImageCacheEntry>();
  private totalBytes = 0;
  readonly maxEntries: number;
  readonly maxBytes: number;
  readonly freshnessMs: number;

  constructor(options: ImageLruCacheOptions = {}) {
    this.maxEntries = Math.max(1, options.maxEntries ?? DEFAULT_MAX_ENTRIES);
    this.maxBytes = Math.max(1024, options.maxBytes ?? DEFAULT_MAX_BYTES);
    this.freshnessMs = Math.max(0, options.freshnessMs ?? DEFAULT_FRESHNESS_MS);
  }

  get size(): number {
    return this.map.size;
  }

  get bytes(): number {
    return this.totalBytes;
  }

  get(key: string): ImageCacheEntry | undefined {
    const entry = this.map.get(key);
    if (!entry) return undefined;
    // Refresh recency in Map insertion order
    this.map.delete(key);
    this.map.set(key, entry);
    return entry;
  }

  isFresh(entry: ImageCacheEntry, now = Date.now()): boolean {
    return now - entry.checkedAt < this.freshnessMs;
  }

  touchChecked(key: string, now = Date.now()): void {
    const entry = this.map.get(key);
    if (!entry) return;
    entry.checkedAt = now;
    this.map.delete(key);
    this.map.set(key, entry);
  }

  set(key: string, entry: ImageCacheEntry): void {
    const existing = this.map.get(key);
    if (existing) {
      this.totalBytes = Math.max(0, this.totalBytes - existing.byteLen);
      this.map.delete(key);
    }

    const approxBytes = entry.byteLen > 0 ? entry.byteLen : entry.dataUrl.length;
    const normalized: ImageCacheEntry = {
      dataUrl: entry.dataUrl,
      modifiedMs: entry.modifiedMs,
      byteLen: approxBytes,
      checkedAt: entry.checkedAt,
    };

    // Single entry larger than total budget: evict all others and skip caching oversized payload
    if (approxBytes > this.maxBytes) {
      return;
    }

    this.map.set(key, normalized);
    this.totalBytes += approxBytes;
    this.evictIfNeeded();
  }

  delete(key: string): boolean {
    const existing = this.map.get(key);
    if (!existing) return false;
    this.totalBytes = Math.max(0, this.totalBytes - existing.byteLen);
    return this.map.delete(key);
  }

  clear(): void {
    this.map.clear();
    this.totalBytes = 0;
  }

  private evictIfNeeded(): void {
    while (this.map.size > this.maxEntries || this.totalBytes > this.maxBytes) {
      const oldestKey = this.map.keys().next().value;
      if (oldestKey === undefined) break;
      const oldest = this.map.get(oldestKey);
      if (oldest) {
        this.totalBytes = Math.max(0, this.totalBytes - oldest.byteLen);
      }
      this.map.delete(oldestKey);
    }
  }
}
