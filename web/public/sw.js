const APP_CACHE = 'hwdwgh-app-v1'
const DATA_CACHE = 'hwdwgh-data-v1'
const MEDIA_CACHE = 'hwdwgh-media-v1'
const TILE_CACHE = 'hwdwgh-tiles-v1'
const DATA_MAX_AGE_MS = 15 * 60 * 1000

const appShellUrls = ['/', '/favicon.svg', '/icons.svg']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(APP_CACHE)
      .then((cache) => cache.addAll(appShellUrls))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      clearOldCaches(),
      self.clients.claim(),
    ]),
  )
})

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') {
    return
  }

  const url = new URL(request.url)

  if (isMediaRequest(url)) {
    event.respondWith(handleMediaRequest(request))
    return
  }

  if (isTileRequest(url)) {
    event.respondWith(cacheFirst(request, TILE_CACHE))
    return
  }

  if (isPublicApiRequest(url)) {
    event.respondWith(staleWhileRevalidate(request, event))
    return
  }

  if (url.origin === self.location.origin) {
    event.respondWith(cacheFirst(request, APP_CACHE))
  }
})

self.addEventListener('message', (event) => {
  if (event.data?.type === 'HDWGH_PREFETCH_URLS') {
    const urls = Array.isArray(event.data.urls) ? event.data.urls : []
    event.waitUntil(prefetchUrls(urls, event.source))
  }

  if (event.data?.type === 'HDWGH_CLEAR_RUNTIME_CACHE') {
    event.waitUntil(
      Promise.all([
        caches.delete(DATA_CACHE),
        caches.delete(MEDIA_CACHE),
        caches.delete(TILE_CACHE),
      ]).then(() => postMessageToClient(event.source, { type: 'HDWGH_CACHE_CLEARED' })),
    )
  }
})

async function clearOldCaches() {
  const allowedCaches = new Set([APP_CACHE, DATA_CACHE, MEDIA_CACHE, TILE_CACHE])
  const names = await caches.keys()
  await Promise.all(names.filter((name) => !allowedCaches.has(name)).map((name) => caches.delete(name)))
}

function isPublicApiRequest(url) {
  return url.pathname.startsWith('/api/') &&
    !url.pathname.startsWith('/api/admin/') &&
    !url.pathname.startsWith('/api/auth/') &&
    url.pathname !== '/api/health'
}

function isMediaRequest(url) {
  return url.pathname.startsWith('/media/') ||
    /\.(avif|gif|jpe?g|mp3|mp4|ogg|opus|png|wav|webm|webp)$/i.test(url.pathname)
}

function isTileRequest(url) {
  return /tile|tiles|basemaps|cartocdn|openstreetmap/i.test(url.hostname + url.pathname)
}

async function staleWhileRevalidate(request, event) {
  const cache = await caches.open(DATA_CACHE)
  const cached = await cache.match(request)
  const cachedAt = Number(cached?.headers.get('sw-cached-at') ?? 0)
  const isFresh = cached && Date.now() - cachedAt < DATA_MAX_AGE_MS

  const networkRequest = addConditionalHeaders(request, cached)
  const networkPromise = fetch(networkRequest)
    .then(async (response) => {
      if (response.status === 304 && cached) {
        const refreshed = withCacheTimestamp(cached.clone())
        await cache.put(request, refreshed.clone())
        return refreshed
      }

      if (response.ok) {
        await cache.put(request, withCacheTimestamp(response.clone()))
      }

      return response
    })
    .catch(() => cached)

  if (isFresh) {
    event.waitUntil(networkPromise.then(() => undefined).catch(() => undefined))
    return cached
  }

  return await networkPromise ?? new Response(null, { status: 504, statusText: 'Gateway Timeout' })
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName)
  const cached = await cache.match(request)
  if (cached) {
    return cached
  }

  const response = await fetch(request)
  if (response.ok || response.type === 'opaque') {
    await cache.put(request, response.clone())
  }

  return response
}

async function handleMediaRequest(request) {
  if (request.headers.has('range')) {
    return handleRangeRequest(request)
  }

  return mediaCacheFirst(request)
}

async function handleRangeRequest(request) {
  const cache = await caches.open(MEDIA_CACHE)
  const cached = await cache.match(request.url)

  if (!cached || cached.type === 'opaque') {
    return fetch(request)
  }

  const rangeHeader = request.headers.get('range')
  const range = parseRangeHeader(rangeHeader)
  if (!range) {
    return cached
  }

  const blob = await cached.blob()
  const start = range.start
  const end = Math.min(range.end ?? blob.size - 1, blob.size - 1)
  const sliced = blob.slice(start, end + 1)
  const headers = new Headers(cached.headers)
  headers.set('Content-Length', String(sliced.size))
  headers.set('Content-Range', `bytes ${start}-${end}/${blob.size}`)
  headers.set('Accept-Ranges', 'bytes')

  return new Response(sliced, {
    status: 206,
    statusText: 'Partial Content',
    headers,
  })
}

function parseRangeHeader(value) {
  const match = /^bytes=(\d+)-(\d+)?$/i.exec(value ?? '')
  if (!match) {
    return null
  }

  return {
    start: Number(match[1]),
    end: match[2] ? Number(match[2]) : null,
  }
}

async function mediaCacheFirst(request) {
  const cache = await caches.open(MEDIA_CACHE)
  const cached = await cache.match(request.url)
  if (cached) {
    return cached
  }

  const response = await fetch(request)
  if (response.ok || response.type === 'opaque') {
    await cache.put(request.url, response.clone())
  }

  return response
}

function addConditionalHeaders(request, cached) {
  if (!cached) {
    return request
  }

  const etag = cached.headers.get('etag')
  const lastModified = cached.headers.get('last-modified')
  if (!etag && !lastModified) {
    return request
  }

  const headers = new Headers(request.headers)
  if (etag) {
    headers.set('If-None-Match', etag)
  }

  if (lastModified) {
    headers.set('If-Modified-Since', lastModified)
  }

  return new Request(request, { headers })
}

function withCacheTimestamp(response) {
  const headers = new Headers(response.headers)
  headers.set('sw-cached-at', String(Date.now()))
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}

async function prefetchUrls(urls, client) {
  const uniqueUrls = [...new Set(urls.filter(Boolean))]
  const cache = await caches.open(MEDIA_CACHE)
  let completed = 0
  let failed = 0

  postMessageToClient(client, {
    type: 'HDWGH_PREFETCH_PROGRESS',
    completed,
    failed,
    total: uniqueUrls.length,
  })

  for (const rawUrl of uniqueUrls) {
    try {
      const url = new URL(rawUrl, self.location.origin)
      const cached = await cache.match(url.href)
      if (!cached) {
        const response = await fetchWithCorsFallback(url.href)
        if (response.ok || response.type === 'opaque') {
          await cache.put(url.href, response.clone())
        }
      }
      completed += 1
    } catch {
      failed += 1
    }

    postMessageToClient(client, {
      type: 'HDWGH_PREFETCH_PROGRESS',
      completed,
      failed,
      total: uniqueUrls.length,
    })
  }

  postMessageToClient(client, {
    type: 'HDWGH_PREFETCH_DONE',
    completed,
    failed,
    total: uniqueUrls.length,
  })
}

function postMessageToClient(client, message) {
  if (client && 'postMessage' in client) {
    client.postMessage(message)
  }
}

async function fetchWithCorsFallback(url) {
  try {
    return await fetch(new Request(url, { mode: 'cors', credentials: 'include' }))
  } catch (error) {
    const parsedUrl = new URL(url)
    if (parsedUrl.origin === self.location.origin) {
      throw error
    }

    return await fetch(new Request(url, { mode: 'no-cors', credentials: 'omit' }))
  }
}
