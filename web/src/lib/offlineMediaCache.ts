export const offlineMediaCacheName = 'hwdwgh-media-v2'

export type OfflineMediaKind = 'audio' | 'image' | 'other'
export type OfflineMediaDownloadLanguage = 'all' | 'cs' | 'en'

export type OfflineMediaCandidate = {
  entryId?: string
  entryTitle?: string
  kind: OfflineMediaKind
  label?: string | null
  languageCode?: string | null
  url: string
}

export type OfflineMediaCacheItem = OfflineMediaCandidate & {
  contentType: string | null
  fileName: string
  isKnown: boolean
  sizeBytes: number | null
}

export type OfflineMediaSummary = {
  audioCount: number
  cachedEntryCount: number
  imageCount: number
  items: OfflineMediaCacheItem[]
  languages: string[]
  otherCount: number
  totalSizeBytes: number | null
  updatedAt: number | null
}

export type OfflineMediaPrefetchProgress = {
  completed: number
  failed: number
  total: number
}

export const emptyOfflineMediaSummary: OfflineMediaSummary = {
  audioCount: 0,
  cachedEntryCount: 0,
  imageCount: 0,
  items: [],
  languages: [],
  otherCount: 0,
  totalSizeBytes: null,
  updatedAt: null,
}

export async function inspectOfflineMediaCache(candidates: OfflineMediaCandidate[]): Promise<OfflineMediaSummary> {
  if (typeof window === 'undefined' || !('caches' in window)) {
    return emptyOfflineMediaSummary
  }

  const candidateByUrl = new Map<string, OfflineMediaCandidate>()
  for (const candidate of candidates) {
    candidateByUrl.set(normalizeUrl(candidate.url), candidate)
  }

  const cache = await caches.open(offlineMediaCacheName)
  const requests = await cache.keys()
  const items = await Promise.all(
    requests.map(async (request) => {
      const url = normalizeUrl(request.url)
      const candidate = candidateByUrl.get(url)
      const response = await cache.match(request)
      const contentType = response?.headers.get('content-type') ?? null
      const kind = candidate?.kind ?? inferMediaKind(url, contentType)
      const languageCode = candidate?.languageCode ?? inferLanguageCode(url)

      return {
        contentType,
        entryId: candidate?.entryId,
        entryTitle: candidate?.entryTitle,
        fileName: fileNameFromUrl(url),
        isKnown: Boolean(candidate),
        kind,
        label: candidate?.label,
        languageCode,
        sizeBytes: response ? await responseSize(response) : null,
        url,
      }
    }),
  )

  const cachedEntryIds = new Set(
    items
      .map((item) => item.entryId)
      .filter((entryId): entryId is string => Boolean(entryId)),
  )
  const languages = [
    ...new Set(
      items
        .filter((item) => item.kind === 'audio')
        .map((item) => item.languageCode)
        .filter((languageCode): languageCode is string => Boolean(languageCode)),
    ),
  ].sort((left, right) => left.localeCompare(right))
  const knownItems = items.filter((item) => item.isKnown)
  const unknownItems = items.filter((item) => !item.isKnown)
  const sortedItems = [...knownItems, ...unknownItems].sort(compareOfflineMediaItems)
  const knownSizes = sortedItems
    .map((item) => item.sizeBytes)
    .filter((sizeBytes): sizeBytes is number => sizeBytes !== null)

  return {
    audioCount: sortedItems.filter((item) => item.kind === 'audio').length,
    cachedEntryCount: cachedEntryIds.size,
    imageCount: sortedItems.filter((item) => item.kind === 'image').length,
    items: sortedItems,
    languages,
    otherCount: sortedItems.filter((item) => item.kind === 'other').length,
    totalSizeBytes: knownSizes.length === sortedItems.length
      ? knownSizes.reduce((total, sizeBytes) => total + sizeBytes, 0)
      : null,
    updatedAt: Date.now(),
  }
}

export async function clearOfflineMediaCache() {
  if (typeof window === 'undefined' || !('caches' in window)) {
    return
  }

  await caches.delete(offlineMediaCacheName)
}

export async function prefetchOfflineMediaUrls(
  urls: string[],
  onProgress: (progress: OfflineMediaPrefetchProgress) => void,
): Promise<OfflineMediaPrefetchProgress> {
  if (typeof window === 'undefined' || !('caches' in window)) {
    const progress = { completed: 0, failed: urls.length, total: urls.length }
    onProgress(progress)
    return progress
  }

  const uniqueUrls = [...new Set(urls.filter(Boolean).map(normalizeUrl))]
  const cache = await caches.open(offlineMediaCacheName)
  const progress = {
    completed: 0,
    failed: 0,
    total: uniqueUrls.length,
  }

  onProgress(progress)

  for (const url of uniqueUrls) {
    try {
      const cached = await cache.match(url)
      if (!cached) {
        const response = await fetchWithCorsFallback(url)
        if (response.ok || response.type === 'opaque') {
          await cache.put(url, response.clone())
          progress.completed += 1
        } else {
          progress.failed += 1
        }
      } else {
        progress.completed += 1
      }
    } catch {
      progress.failed += 1
    }

    onProgress({ ...progress })
  }

  return progress
}

function normalizeUrl(url: string) {
  return new URL(url, window.location.origin).href
}

function fileNameFromUrl(url: string) {
  const pathname = new URL(url).pathname
  const fileName = pathname.split('/').filter(Boolean).at(-1)
  return fileName ? decodeURIComponent(fileName) : url
}

function inferMediaKind(url: string, contentType: string | null): OfflineMediaKind {
  if (contentType?.startsWith('image/')) {
    return 'image'
  }

  if (contentType?.startsWith('audio/')) {
    return 'audio'
  }

  const pathname = new URL(url).pathname
  if (/\.(avif|gif|jpe?g|png|webp)$/i.test(pathname)) {
    return 'image'
  }

  if (/\.(m4a|mp3|mp4|ogg|opus|wav|webm)$/i.test(pathname)) {
    return 'audio'
  }

  return 'other'
}

function inferLanguageCode(url: string) {
  const tokens = new URL(url).pathname.split(/[./_-]+/).map((token) => token.toLowerCase())
  return tokens.find((token) => token === 'en' || token === 'cs' || token === 'es') ?? null
}

async function responseSize(response: Response) {
  if (response.type === 'opaque') {
    return null
  }

  const contentLength = Number(response.headers.get('content-length'))
  if (Number.isFinite(contentLength) && contentLength > 0) {
    return contentLength
  }

  try {
    return (await response.clone().blob()).size
  } catch {
    return null
  }
}

function compareOfflineMediaItems(left: OfflineMediaCacheItem, right: OfflineMediaCacheItem) {
  return (left.entryTitle ?? left.fileName).localeCompare(right.entryTitle ?? right.fileName) ||
    left.kind.localeCompare(right.kind) ||
    (left.languageCode ?? '').localeCompare(right.languageCode ?? '') ||
    left.fileName.localeCompare(right.fileName)
}

async function fetchWithCorsFallback(url: string) {
  try {
    return await fetch(new Request(url, { credentials: 'include', mode: 'cors' }))
  } catch (error) {
    const parsedUrl = new URL(url)
    if (parsedUrl.origin === window.location.origin) {
      throw error
    }

    return await fetch(new Request(url, { credentials: 'omit', mode: 'no-cors' }))
  }
}
