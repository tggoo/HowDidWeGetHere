type CacheEntry<T> = {
  expiresAt: number
  promise: Promise<T>
}

const queryCache = new Map<string, CacheEntry<unknown>>()

type CachedQueryOptions = {
  ttlMs?: number
}

function stableSerialize(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableSerialize).join(',')}]`
  }

  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableSerialize(record[key])}`)
      .join(',')}}`
  }

  return JSON.stringify(value)
}

export function createQueryKey(parts: readonly unknown[]): string {
  return stableSerialize(parts)
}

export function cachedQuery<T>(
  parts: readonly unknown[],
  query: () => Promise<T>,
  options: CachedQueryOptions = {},
): Promise<T> {
  const ttlMs = options.ttlMs ?? 30_000
  const key = createQueryKey(parts)
  const now = Date.now()
  const cached = queryCache.get(key) as CacheEntry<T> | undefined

  if (cached && cached.expiresAt > now) {
    return cached.promise
  }

  const promise = query().catch((error) => {
    const latest = queryCache.get(key)
    if (latest?.promise === promise) {
      queryCache.delete(key)
    }

    throw error
  })

  queryCache.set(key, {
    expiresAt: now + ttlMs,
    promise,
  })

  return promise
}

export function invalidateQueryCache(match: (key: string) => boolean = () => true) {
  for (const key of queryCache.keys()) {
    if (match(key)) {
      queryCache.delete(key)
    }
  }
}
