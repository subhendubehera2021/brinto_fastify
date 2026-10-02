/**
 * Modular Cloudflare Cache & KV Utility
 * Provides edge response caching using Cloudflare KV Storage and Cloudflare Cache API (caches.default).
 */

export interface CacheOptions {
  /**
   * Time-to-live in seconds for cached response.
   * Default: 300 (5 minutes)
   */
  ttl?: number;

  /**
   * Custom cache key string or Request object.
   * Defaults to request URL if not provided.
   */
  key?: string | Request | URL;

  /**
   * Whether to bypass cache (e.g. based on query param or header).
   * Default: false
   */
  bypass?: boolean;

  /**
   * Custom Cache-Control header value.
   */
  cacheControl?: string;

  /**
   * Storage mechanism to use:
   * - 'kv': Cloudflare KV storage (persisted globally across edge nodes)
   * - 'cache-api': Cloudflare Cache API (caches.default for HTTP responses)
   * - 'auto': Prefers KV if available, otherwise falls back to Cache API
   * Default: 'auto'
   */
  strategy?: 'kv' | 'cache-api' | 'auto';
}

export type KVNamespace = {
  get(key: string, options?: { type?: 'text' | 'json' | 'arrayBuffer' | 'stream' }): Promise<any>;
  put(key: string, value: string | ArrayBuffer | ReadableStream, options?: { expirationTtl?: number }): Promise<void>;
  delete(key: string): Promise<void>;
};

// MOCKED — in-memory, data lost on container sleep
const memoryStore = new Map<string, string>();
const inMemoryKV: KVNamespace = {
  get: async (key: string, options?: { type?: 'text' | 'json' | 'arrayBuffer' | 'stream' }) => {
    const raw = memoryStore.get(key) ?? null;
    if (raw === null) return null;
    if (options?.type === 'json') {
      try {
        return JSON.parse(raw);
      } catch {
        return null;
      }
    }
    return raw;
  },
  put: async (key: string, value: string | ArrayBuffer | ReadableStream) => {
    memoryStore.set(key, typeof value === 'string' ? value : String(value));
  },
  delete: async (key: string) => {
    memoryStore.delete(key);
  },
};

/**
 * Safely retrieves KV binding (in-memory store in Node.js runtime).
 */
export async function getKVBinding(): Promise<KVNamespace | null> {
  return inMemoryKV;
}

/**
 * Safely retrieves Cloudflare's default Cache API instance if available.
 */
function getCloudflareCache(): Cache | null {
  if (typeof caches !== 'undefined' && caches && (caches as any).default) {
    return (caches as any).default as Cache;
  }
  return null;
}

/**
 * Normalizes input key into string key suitable for KV namespace storage.
 */
function normalizeKvKey(key: string | Request | URL): string {
  if (key instanceof Request) {
    const url = new URL(key.url);
    return `cache:${url.pathname}${url.search}`;
  }
  if (key instanceof URL) {
    return `cache:${key.pathname}${key.search}`;
  }
  return key.startsWith('cache:') ? key : `cache:${key}`;
}

/**
 * Normalizes input key into a Request object suitable for Cache API.
 */
function normalizeCacheKey(key: string | Request | URL): Request {
  if (key instanceof Request) {
    return key;
  }
  const urlStr = key instanceof URL ? key.toString() : key;
  return new Request(urlStr, { method: 'GET' });
}

// ==================== CLOUDFLARE KV HELPERS ====================

/**
 * Retrieves cached Response payload from Cloudflare KV.
 */
export async function getKvCache(key: string | Request | URL): Promise<Response | null> {
  const kv = await getKVBinding();
  if (!kv) return null;

  try {
    const kvKey = normalizeKvKey(key);
    const cached = await kv.get(kvKey, { type: 'json' });
    if (!cached) return null;

    const headers = new Headers(cached.headers || { 'Content-Type': 'application/json' });
    headers.set('X-Cache', 'HIT');
    headers.set('X-Cache-Source', 'Cloudflare-KV');

    const bodyStr = typeof cached.body === 'string' ? cached.body : JSON.stringify(cached.body);

    return new Response(bodyStr, {
      status: cached.status || 200,
      statusText: cached.statusText || 'OK',
      headers,
    });
  } catch (err) {
    console.warn('[CloudflareKV] Read error:', err);
    return null;
  }
}

/**
 * Stores a Response payload into Cloudflare KV with TTL.
 */
export async function setKvCache(
  key: string | Request | URL,
  response: Response,
  options: CacheOptions = {}
): Promise<Response> {
  const ttl = options.ttl ?? 300; // 5 minutes default
  const cacheControl = options.cacheControl ?? `public, max-age=${ttl}, s-maxage=${ttl}`;

  const headers = new Headers(response.headers);
  headers.set('Cache-Control', cacheControl);
  if (!headers.has('X-Cache')) {
    headers.set('X-Cache', 'MISS');
  }

  const responseToReturn = new Response(response.clone().body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });

  const kv = await getKVBinding();
  if (kv && response.status === 200) {
    try {
      const kvKey = normalizeKvKey(key);
      const text = await response.text();
      let body: any;
      try {
        body = JSON.parse(text);
      } catch {
        body = text;
      }

      const cachePayload = {
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(headers.entries()),
        body,
      };

      await kv.put(kvKey, JSON.stringify(cachePayload), { expirationTtl: ttl });
    } catch (err) {
      console.warn('[CloudflareKV] Write error:', err);
    }
  }

  return responseToReturn;
}

/**
 * Purges/invalidates a cached entry from Cloudflare KV.
 */
export async function invalidateKvCache(key: string | Request | URL): Promise<boolean> {
  const kv = await getKVBinding();
  if (!kv) return false;

  try {
    const kvKey = normalizeKvKey(key);
    await kv.delete(kvKey);
    return true;
  } catch (err) {
    console.warn('[CloudflareKV] Delete error:', err);
    return false;
  }
}

// ==================== CLOUDFLARE CACHE API HELPERS ====================

/**
 * Retrieves a cached Response from Cloudflare Cache API (caches.default).
 */
export async function getCachedResponse(
  key: string | Request | URL
): Promise<Response | null> {
  const cache = getCloudflareCache();
  if (!cache) return null;

  try {
    const cacheKey = normalizeCacheKey(key);
    const cachedResponse = await cache.match(cacheKey);
    if (!cachedResponse) return null;

    const headers = new Headers(cachedResponse.headers);
    headers.set('X-Cache', 'HIT');
    headers.set('X-Cache-Source', 'Cloudflare-Cache-API');

    return new Response(cachedResponse.body, {
      status: cachedResponse.status,
      statusText: cachedResponse.statusText,
      headers,
    });
  } catch (err) {
    console.warn('[CloudflareCache] Read error:', err);
    return null;
  }
}

/**
 * Stores a Response into Cloudflare Cache API (caches.default).
 */
export async function setCachedResponse(
  key: string | Request | URL,
  response: Response,
  options: CacheOptions = {}
): Promise<Response> {
  const ttl = options.ttl ?? 300;
  const cacheControl = options.cacheControl ?? `public, max-age=${ttl}, s-maxage=${ttl}`;

  const headers = new Headers(response.headers);
  headers.set('Cache-Control', cacheControl);
  if (!headers.has('X-Cache')) {
    headers.set('X-Cache', 'MISS');
  }

  const responseToCache = new Response(response.clone().body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });

  const responseToReturn = new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });

  const cache = getCloudflareCache();
  if (cache && response.status === 200) {
    try {
      const cacheKey = normalizeCacheKey(key);
      await cache.put(cacheKey, responseToCache);
    } catch (err) {
      console.warn('[CloudflareCache] Write error:', err);
    }
  }

  return responseToReturn;
}

/**
 * Purges/invalidates a cached entry from Cloudflare Cache API if available.
 */
export async function invalidateCache(key: string | Request | URL): Promise<boolean> {
  const cache = getCloudflareCache();
  if (!cache) return false;

  try {
    const cacheKey = normalizeCacheKey(key);
    return await cache.delete(cacheKey);
  } catch (err) {
    console.warn('[CloudflareCache] Delete error:', err);
    return false;
  }
}

// ==================== UNIFIED CACHE WRAPPER ====================

/**
 * Unified Cache Wrapper. Supports KV, Cache API, or auto strategy.
 */
export async function withCloudflareCache(
  key: string | Request | URL,
  fetcher: () => Promise<Response>,
  options: CacheOptions = {}
): Promise<Response> {
  if (options.bypass) {
    return await fetcher();
  }

  const strategy = options.strategy ?? 'auto';
  const cacheKey = options.key ?? key;

  // 1. Check KV if requested or auto
  if (strategy === 'kv' || strategy === 'auto') {
    const kvHit = await getKvCache(cacheKey);
    if (kvHit) return kvHit;
  }

  // 2. Check Cache API if requested or auto
  if (strategy === 'cache-api' || strategy === 'auto') {
    const cacheHit = await getCachedResponse(cacheKey);
    if (cacheHit) return cacheHit;
  }

  // 3. Fetch fresh response from database/origin
  const freshResponse = await fetcher();

  // 4. Store in KV if available
  if (strategy === 'kv' || strategy === 'auto') {
    const kv = await getKVBinding();
    if (kv) {
      return await setKvCache(cacheKey, freshResponse, { ...options, key: cacheKey });
    }
  }

  // 5. Fallback store in Cache API
  return await setCachedResponse(cacheKey, freshResponse, { ...options, key: cacheKey });
}
