import {
  ChevronLeft,
  ChevronRight,
  Filter,
  Globe2,
  PanelRight,
  PlayCircle,
} from 'lucide-react'
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent,
} from 'react'
import { apiBaseUrl, apiClient } from './api/client'
import type { components } from './api/schema'
import { HistoryMap, type MapEntry, type MapViewport } from './components/HistoryMap'
import { ShellControls } from './components/molecules/ShellControls'
import type { AdminPanelProps } from './components/organisms/AdminPanel'
import { EntryDetailPanel } from './components/organisms/EntryDetailPanel'
import { FilterPanel } from './components/organisms/FilterPanel'
import { ImageLightbox } from './components/organisms/ImageLightbox'
import { PersistentAudioPlayer } from './components/organisms/PersistentAudioPlayer'
import { TagModal } from './components/organisms/TagModal'
import { TimelineRuler } from './components/organisms/TimelineRuler'
import { useDebouncedHistoryQuery } from './features/history/useDebouncedHistoryQuery'
import { cachedQuery } from './lib/queryCache'
import { useAppStore, type AdminPage, type MediaCacheProgress } from './store/appStore'
import './App.css'

const AdminPanel = lazy(() =>
  import('./components/organisms/AdminPanel').then((module) => ({ default: module.AdminPanel })),
)

type AdminEntryUpsertRequest = components['schemas']['AdminEntryUpsertRequest']
type AdminEntryImageRequest = components['schemas']['AdminEntryImageRequest']
type AdminEntryAudioTrackRequest = components['schemas']['AdminEntryAudioTrackRequest']
type AdminEntryPlaceRequest = components['schemas']['AdminEntryPlaceRequest']
type AdminEntryRouteRequest = components['schemas']['AdminEntryRouteRequest']
type AdminEntryRelationshipRequest = components['schemas']['AdminEntryRelationshipRequest']
type AdminEntrySourceRequest = components['schemas']['AdminEntrySourceRequest']
type AdminTimePeriodUpsertRequest = components['schemas']['AdminTimePeriodUpsertRequest']
type AdminTagUpsertRequest = components['schemas']['AdminTagUpsertRequest']
type AdminEntryTagRequest = components['schemas']['AdminEntryTagRequest']
type AccessTokenResponse = components['schemas']['AccessTokenResponse']
type ContentStatus = components['schemas']['ContentStatus']
type EntryKind = components['schemas']['EntryKind']
type EntryRelationshipType = components['schemas']['EntryRelationshipType']
type EntryPlaceRole = components['schemas']['EntryPlaceRole']
type PlaceType = components['schemas']['PlaceType']
type RealityStatus = components['schemas']['RealityStatus']
type RoutePointRole = components['schemas']['RoutePointRole']
type RouteType = components['schemas']['RouteType']
type SpatialConfidence = components['schemas']['SpatialConfidence']
type SourceSupportKind = components['schemas']['SourceSupportKind']
type TimePrecision = Exclude<components['schemas']['TimePrecision'], null>
type TimePeriodType = components['schemas']['TimePeriodType']

type EntryListItem = {
  id: string
  slug: string
  kind: string
  iconKey?: string | null
  title: string
  dateLabel?: string | null
  startYear?: number | null
  endYear?: number | null
  primaryTimePeriodId?: string | null
  primaryImageUrl?: string | null
  primaryAudioUrl?: string | null
}

type TimePeriodListItem = {
  id: string
  slug: string
  parentPeriodId?: string | null
  periodType: string
  name: string
  shortDescription?: string | null
  startYear?: number | null
  endYear?: number | null
}

type TagListItem = {
  id: string
  slug: string
  tagGroup: string
  name: string
  parentTagId?: string | null
  entryCount: number | string
}

type EntryDetail = EntryListItem & {
  realityStatus: string
  summary?: string | null
  description?: string | null
  whyItMatters?: string | null
  datingNote?: string | null
  timePrecision: string
  timeConfidence?: string | null
  tags: Array<{
    id: string
    slug: string
    tagGroup: string
    name: string
  }>
  timePeriods: Array<{
    id: string
    slug: string
    name: string
    relationType: string
    periodType: string
    startYear?: number | string | null
    endYear?: number | string | null
  }>
  places: Array<{
    placeId: string
    slug: string
    name: string
    role: string
    sortOrder: number | string
    note?: string | null
    placeType: string
    spatialConfidence: string
    longitude?: number | null
    latitude?: number | null
  }>
  routes: Array<{
    id: string
    name: string
    routeType: string
    spatialConfidence: string
    sourceNote?: string | null
    geometry: Array<{ longitude: number; latitude: number }>
    points: Array<{
      placeId: string
      slug: string
      name: string
      role: string
      sortOrder: number | string
      dateLabel?: string | null
      note?: string | null
      longitude?: number | null
      latitude?: number | null
    }>
  }>
  relatedEntries: Array<{
    entryId: string
    slug: string
    title: string
    kind: string
    relationshipType: string
    direction: string
    confidence?: number | string | null
    note?: string | null
  }>
  sources: Array<{
    sourceId: string
    url: string
    title?: string | null
    publisher?: string | null
    languageCode?: string | null
    supportsField: string
    note?: string | null
  }>
  images: Array<{
    id: string
    url: string
    kind: string
    isPrimary: boolean
    sortOrder: number | string
    altText?: string | null
    caption?: string | null
    attribution?: string | null
    license?: string | null
    sourceUrl?: string | null
  }>
  audioTracks: Array<{
    id: string
    url: string
    kind: string
    languageCode: string
    isPrimary: boolean
    sortOrder: number | string
    title?: string | null
    transcript?: string | null
    durationSeconds?: number | string | null
    attribution?: string | null
    license?: string | null
    sourceUrl?: string | null
  }>
}

type EntryRouteDetail = EntryDetail['routes'][number]

type ActiveAudio = {
  entryId: string
  title: string
  subtitle?: string | null
  url: string
}

type UploadProgressPhase = 'uploading' | 'processing' | 'complete' | 'error'

type UploadProgressState = {
  phase: UploadProgressPhase
  loadedBytes: number
  totalBytes: number | null
  percent: number | null
  message: string
}

type ContentPackageBatchItemStatus = 'pending' | 'uploading' | 'processing' | 'done' | 'error' | 'skipped'

type ContentPackageBatchItem = {
  name: string
  status: ContentPackageBatchItemStatus
  message?: string
}

type AdminEntryRelationshipDetail = {
  id: string
  targetEntryId: string
  targetEntrySlug: string
  targetEntryTitle: string
  targetEntryKind: string
  relationshipType: string
  confidence?: number | string | null
  note?: string | null
}

type ContentPackageImportResult = {
  importBatchId: string
  fileName: string
  packageSlug: string
  title: string
  entriesRead: number | string
  clearedExistingData: boolean
  entriesDeletedBeforeImport: number | string
  entriesCreated: number | string
  entriesUpdated: number | string
  tagsAttached: number | string
  timePeriodsAttached: number | string
  placesAttached: number | string
  sourcesAttached: number | string
  audioTracksCreated: number | string
  audioTracksUpdated: number | string
  imagesCreated: number | string
  imagesUpdated: number | string
  warnings: string[]
}

type ContentPackageImportHistoryItem = {
  importBatchId: string
  fileName: string
  packageSlug?: string | null
  title?: string | null
  status: string
  startedAt: string
  completedAt?: string | null
  importedRows: number | string
  entriesRead: number | string
  entriesCreated: number | string
  entriesUpdated: number | string
  audioTracksCreated: number | string
  audioTracksUpdated: number | string
  imagesCreated: number | string
  imagesUpdated: number | string
  warningCount: number | string
}

type ContentPackageImportHistoryResult = {
  items: ContentPackageImportHistoryItem[]
}

type ContentPackageImportPreviewResult = {
  packageSlug: string
  title: string
  entriesRead: number | string
  willClearExistingData: boolean
  existingEntriesToDelete: number | string
  entriesToCreate: number | string
  entriesToUpdate: number | string
  tagsToAttach: number | string
  timePeriodsToAttach: number | string
  placesToAttach: number | string
  sourcesToAttach: number | string
  audioFilesToAttach: number | string
  imageFilesToAttach: number | string
  rows: Array<{
    slug: string
    title: string
    sourceSheet?: string | null
    sourceRow?: number | string | null
    willUpdateExistingEntry: boolean
    existingEntryId?: string | null
    tags: number | string
    timePeriods: number | string
    places: number | string
    sources: number | string
    audioFiles: number | string
    imageFiles: number | string
    warnings: string[]
  }>
  warnings: string[]
}

type BulkAudioUploadResult = {
  filesRead: number | string
  tracksCreated: number | string
  tracksUpdated: number | string
  entriesMatched: number | string
  entriesMissing: number | string
  warnings: string[]
}

type BulkAudioUploadPreviewResult = {
  filesRead: number | string
  filesSupported: number | string
  entriesMatched: number | string
  entriesMissing: number | string
  rows: Array<{
    fileName: string
    entrySlug: string
    languageCode: string
    isSupportedAudio: boolean
    entryExists: boolean
    warning?: string | null
  }>
  warnings: string[]
}

type AdminEntryListItem = {
  id: string
  slug: string
  status: string
  kind: string
  iconKey?: string | null
  title: string
  sourceSheet?: string | null
  sourceRow?: number | string | null
}

type AdminEntryDetail = AdminEntryListItem & {
  realityStatus: string
  languageCode?: string | null
  summary?: string | null
  description?: string | null
  whyItMatters?: string | null
  datingNote?: string | null
  dateLabel?: string | null
  startYear?: number | string | null
  endYear?: number | string | null
  timePrecision?: string | null
  timeConfidence?: string | null
  primaryTimePeriodId?: string | null
  translations: Array<{
    languageCode: string
    title: string
    hasSummary: boolean
    hasDescription: boolean
    hasWhyItMatters: boolean
    hasDatingNote: boolean
  }>
  places: EntryDetail['places']
  routes: EntryRouteDetail[]
  relationships: AdminEntryRelationshipDetail[]
  sources: EntryDetail['sources']
  tags: EntryDetail['tags']
  images: EntryDetail['images']
  audioTracks: EntryDetail['audioTracks']
}

type EntryFormState = {
  id: string | null
  title: string
  slug: string
  languageCode: string
  summary: string
  description: string
  whyItMatters: string
  datingNote: string
  kind: EntryKind
  iconKey: string
  status: ContentStatus
  realityStatus: RealityStatus
  dateLabel: string
  startYear: string
  endYear: string
  timePrecision: TimePrecision | ''
  timeConfidence: string
  primaryTimePeriodId: string
}

type TimePeriodFormState = {
  id: string | null
  name: string
  slug: string
  languageCode: string
  shortDescription: string
  longDescription: string
  periodType: TimePeriodType
  parentPeriodId: string
  startYear: string
  endYear: string
  startPrecision: TimePrecision
  endPrecision: TimePrecision
  sortOrder: string
}

const defaultEntryForm: EntryFormState = {
  id: null,
  title: '',
  slug: '',
  languageCode: 'en',
  summary: '',
  description: '',
  whyItMatters: '',
  datingNote: '',
  kind: 'Event',
  iconKey: '',
  status: 'Published',
  realityStatus: 'Historical',
  dateLabel: '',
  startYear: '',
  endYear: '',
  timePrecision: '',
  timeConfidence: '',
  primaryTimePeriodId: '',
}

const defaultTimePeriodForm: TimePeriodFormState = {
  id: null,
  name: '',
  slug: '',
  languageCode: 'en',
  shortDescription: '',
  longDescription: '',
  periodType: 'Era',
  parentPeriodId: '',
  startYear: '',
  endYear: '',
  startPrecision: 'Approximate',
  endPrecision: 'Approximate',
  sortOrder: '0',
}

const fallbackEntries: EntryListItem[] = [
  {
    id: 'draft-columbus',
    slug: 'columbus-reaches-the-caribbean',
    kind: 'Exploration',
    title: 'Columbus reaches the Caribbean',
    dateLabel: '1492',
    startYear: 1492,
    endYear: 1492,
  },
  {
    id: 'draft-everest',
    slug: 'first-everest-ascent',
    kind: 'Exploration',
    title: 'First successful ascent of Mount Everest',
    dateLabel: '1953',
    startYear: 1953,
    endYear: 1953,
  },
  {
    id: 'draft-ra',
    slug: 'ra',
    kind: 'MythologyEntity',
    title: 'Ra',
    dateLabel: 'Old Kingdom or earlier',
  },
]

const fallbackPeriods: TimePeriodListItem[] = [
  {
    id: 'early-modern',
    slug: 'early-modern',
    periodType: 'Era',
    name: 'Early Modern',
    shortDescription: 'Exploration, colonization, religious conflict and scientific change.',
    startYear: 1450,
    endYear: 1750,
  },
  {
    id: 'modern',
    slug: 'modern',
    periodType: 'Era',
    name: 'Modern',
    shortDescription: 'Industrial society, global wars, mass media and rapid science.',
    startYear: 1900,
    endYear: 2000,
  },
]

const fallbackTags: TagListItem[] = [
  { label: 'exploration', value: 'category-exploration' },
  { label: 'mythology', value: 'category-mythology' },
  { label: 'invention', value: 'category-inventions' },
  { label: 'science', value: 'category-science' },
  { label: 'war', value: 'category-war' },
].map((tag, index) => ({
  id: `fallback-${index}`,
  slug: tag.value,
  tagGroup: 'category',
  name: tag.label,
  entryCount: 0,
}))

const entryKinds: EntryKind[] = [
  'Event',
  'Invention',
  'MythologyEntity',
  'MythologyStory',
  'Discovery',
  'Exploration',
  'War',
  'Civilization',
  'Person',
  'Place',
  'Text',
  'Technology',
  'ScientificConcept',
  'Other',
]
const contentStatuses: ContentStatus[] = ['Draft', 'Published', 'Archived']
const realityStatuses: RealityStatus[] = [
  'Historical',
  'Mythological',
  'Legendary',
  'Disputed',
  'Interpretive',
  'Fictional',
]
const timePrecisions: TimePrecision[] = [
  'ExactDate',
  'Year',
  'Decade',
  'Century',
  'Millennium',
  'Range',
  'Approximate',
  'Unknown',
]
const timePeriodTypes: TimePeriodType[] = [
  'Era',
  'Age',
  'Dynasty',
  'Reign',
  'Movement',
  'WarPeriod',
  'CivilizationPeriod',
  'CulturalPeriod',
  'GeologicalPeriod',
  'Other',
]
const placeTypes: PlaceType[] = [
  'City',
  'Country',
  'Region',
  'Site',
  'Mountain',
  'Ocean',
  'River',
  'RouteStop',
  'MythicPlace',
  'Continent',
  'Other',
]
const entryPlaceRoles: EntryPlaceRole[] = [
  'MainSite',
  'Origin',
  'Destination',
  'Stop',
  'Region',
  'Birthplace',
  'Battlefield',
  'CultSite',
  'CreatedIn',
  'PublishedIn',
  'Other',
]
const routeTypes: RouteType[] = [
  'Voyage',
  'Expedition',
  'Migration',
  'Conquest',
  'Climb',
  'TradeRoute',
  'Mission',
  'Journey',
  'Other',
]
const routePointRoles: RoutePointRole[] = [
  'Start',
  'Stop',
  'End',
  'Summit',
  'BaseCamp',
  'Approximate',
  'Other',
]
const relationshipTypes: EntryRelationshipType[] = [
  'Caused',
  'Influenced',
  'Preceded',
  'Followed',
  'PartOf',
  'HasPart',
  'RelatedTo',
  'Contradicts',
  'SameTraditionAs',
  'LocatedWithin',
  'DerivedFrom',
  'Other',
]
const spatialConfidences: SpatialConfidence[] = [
  'Exact',
  'Approximate',
  'Regional',
  'Disputed',
  'Mythic',
  'Unknown',
]
const sourceSupportKinds: SourceSupportKind[] = [
  'General',
  'Date',
  'Summary',
  'Route',
  'Location',
  'Relationship',
  'Image',
  'Audio',
  'Translation',
]

const visibleTagLimit = 10
type SidePane = 'filter' | 'detail'

const defaultFilterPaneWidth = 300
const defaultDetailPaneWidth = 360
const minSidePaneWidth = 240
const maxFilterPaneWidth = 520
const maxDetailPaneWidth = 640
const minMapPaneWidth = 360

function clampNumber(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

const relationshipTypeLabels: Record<string, Record<string, string>> = {
  Caused: { en: 'Caused', cs: 'Způsobilo', es: 'Causo' },
  Influenced: { en: 'Influenced', cs: 'Ovlivnilo', es: 'Influyo en' },
  Preceded: { en: 'Came before', cs: 'Předcházelo', es: 'Precedio a' },
  Followed: { en: 'Came after', cs: 'Následovalo', es: 'Siguio a' },
  PartOf: { en: 'Was part of', cs: 'Bylo součástí', es: 'Fue parte de' },
  HasPart: { en: 'Includes', cs: 'Obsahuje', es: 'Incluye' },
  RelatedTo: { en: 'Related to', cs: 'Souvisí s', es: 'Relacionado con' },
  Contradicts: { en: 'Contradicts', cs: 'Je v rozporu s', es: 'Contradice' },
  SameTraditionAs: { en: 'Same tradition as', cs: 'Stejná tradice jako', es: 'Misma tradicion que' },
  LocatedWithin: { en: 'Located within', cs: 'Nachází se v', es: 'Ubicado dentro de' },
  DerivedFrom: { en: 'Derived from', cs: 'Odvozené od', es: 'Derivado de' },
  Other: { en: 'Other relation', cs: 'Jiná vazba', es: 'Otra relacion' },
}

const relationshipDirectionLabels: Record<string, Record<string, string>> = {
  outgoing: { en: 'Leads to', cs: 'Navazuje na', es: 'Conduce a' },
  incoming: { en: 'Linked from', cs: 'Odkazuje sem', es: 'Enlazado desde' },
}

function relationshipLabel(type: string, language: string) {
  return relationshipTypeLabels[type]?.[language] ?? relationshipTypeLabels[type]?.en ?? type
}

function relationshipDirectionLabel(direction: string, language: string) {
  return relationshipDirectionLabels[direction]?.[language] ?? relationshipDirectionLabels[direction]?.en ?? direction
}

const uiCopy = {
  en: {
    appName: 'HowDidWeGetHere',
    audio: 'Audio',
    cacheCleared: 'Cached map data and media were cleared.',
    cacheDone: (completed: number) => `Cached ${completed} media files for offline browsing.`,
    cacheDoneWithFailures: (completed: number, total: number, failed: number) =>
      `Cached ${completed}/${total} media files. ${failed} failed.`,
    cacheProgress: (completed: number, total: number) => `Caching media ${completed}/${total}.`,
    caching: 'Caching...',
    clear: 'Clear',
    collapseEntryDetail: 'Collapse entry detail',
    collapseFilters: 'Collapse filters',
    closeEntryDetail: 'Close entry detail',
    closeImage: 'Close image',
    expandImage: 'Expand image',
    imageIndicator: (current: number, total: number) => `Show image ${current} of ${total}`,
    imageSlide: (current: number, total: number) => `Image ${current} of ${total}`,
    nextImage: 'Next image',
    previousImage: 'Previous image',
    closeFilters: 'Close filters',
    closeTags: 'Close tags',
    dateUnknown: 'Date unknown',
    description: 'Description',
    downloadCount: (count: number) => `Download ${count}`,
    entriesLoaded: (entryCount: number, mapPointCount: number, yearRange: string, viewport: string) =>
      `Loaded ${entryCount} published entries and ${mapPointCount} map points${yearRange}${viewport}.`,
    entriesLoadedNoPoints: (entryCount: number, yearRange: string, viewport: string) =>
      `Loaded ${entryCount} published entries${yearRange}${viewport}. Add places or move the map to show points.`,
    filters: 'Filters',
    language: 'Language',
    loadingInitial: 'Loading published map data.',
    moreCount: (count: number) => `More ${count}`,
    noTimelineEntries: 'No dated entries',
    noMediaUrls: 'No media URLs are attached to the current results.',
    noResults: 'No map points match the current filters.',
    nowPlaying: 'Now playing',
    offlineCacheStarting: 'Offline cache is starting. Reload the app once and try again.',
    offlineMedia: 'Offline media',
    openAdminPanel: 'Open admin panel',
    openEntryDetail: 'Open entry detail',
    openFilters: 'Open filters',
    openPlayingEntry: 'Open playing entry',
    minimizeAudio: 'Minimize player',
    restoreAudio: 'Show player',
    places: 'Places',
    queryFailed: 'API responded, but one of the map queries failed.',
    relatedTopics: 'Related topics',
    resetFilters: 'reset filters',
    resizeEntryDetail: 'Resize entry detail',
    resizeFilters: 'Resize filters',
    routeRecords: (count: number) => `${count} route records`,
    searchEntries: 'Search entries',
    selectedEntry: 'Selected entry',
    sources: 'Sources',
    summary: 'Summary',
    switchToDarkMode: 'Switch to dark mode',
    switchToLightMode: 'Switch to light mode',
    tags: 'Tags',
    timeline: 'Timeline',
    timePeriod: 'Time period',
    titleAudioLabel: 'Title',
    playAudio: 'Play audio',
    playAll: 'Play',
    playRandom: 'Play random',
    playNext: 'Play next',
    stopAudio: 'Stop audio',
    unsupportedCache: 'This browser does not support offline media cache.',
    unreachableApi: 'Unable to reach the API. Check Render API URL and CORS settings.',
    viewportSuffix: ' in the visible map area',
    whyItMatters: 'Why it matters',
    yearFrom: 'From',
    yearRangeSuffix: (from: string, to: string) => ` in ${from || '?'}-${to || '?'}`,
    yearTo: 'To',
    knownPoints: (count: number) => `${count} known points.`,
  },
  cs: {
    appName: 'HowDidWeGetHere',
    audio: 'Audio',
    cacheCleared: 'Cache mapových dat a médií byla vymazána.',
    cacheDone: (completed: number) => `Uloženo ${completed} mediálních souborů pro offline prohlížení.`,
    cacheDoneWithFailures: (completed: number, total: number, failed: number) =>
      `Uloženo ${completed}/${total} mediálních souborů. ${failed} selhalo.`,
    cacheProgress: (completed: number, total: number) => `Ukládám média ${completed}/${total}.`,
    caching: 'Ukládám...',
    clear: 'Vyčistit',
    collapseEntryDetail: 'Sbalit detail zaznamu',
    collapseFilters: 'Sbalit filtry',
    closeEntryDetail: 'Zavřít detail záznamu',
    closeImage: 'Zavřít obrázek',
    expandImage: 'Zvětšit obrázek',
    imageIndicator: (current: number, total: number) => `Zobrazit obrázek ${current} z ${total}`,
    imageSlide: (current: number, total: number) => `Obrázek ${current} z ${total}`,
    nextImage: 'Další obrázek',
    previousImage: 'Předchozí obrázek',
    closeFilters: 'Zavřít filtry',
    closeTags: 'Zavřít tagy',
    dateUnknown: 'Datum není známé',
    description: 'Popis',
    downloadCount: (count: number) => `Stáhnout ${count}`,
    entriesLoaded: (entryCount: number, mapPointCount: number, yearRange: string, viewport: string) =>
      `Načteno ${entryCount} publikovaných záznamů a ${mapPointCount} bodů na mapě${yearRange}${viewport}.`,
    entriesLoadedNoPoints: (entryCount: number, yearRange: string, viewport: string) =>
      `Načteno ${entryCount} publikovaných záznamů${yearRange}${viewport}. Posuň mapu nebo doplň místa, aby se zobrazily body.`,
    filters: 'Filtry',
    language: 'Jazyk',
    nowPlaying: 'Přehrává se',
    openPlayingEntry: 'Otevřít přehrávaný záznam',
    minimizeAudio: 'Skrýt přehrávač',
    restoreAudio: 'Zobrazit přehrávač',
    loadingInitial: 'Načítám publikovaná mapová data.',
    moreCount: (count: number) => `Další ${count}`,
    noTimelineEntries: 'Žádné datované záznamy',
    noMediaUrls: 'Aktuální výsledky nemají připojená žádná média.',
    noResults: 'Pro dané filtry nebyly vybrány žádné body.',
    offlineCacheStarting: 'Offline cache se spouští. Načti aplikaci znovu a zkus to ještě jednou.',
    offlineMedia: 'Offline média',
    openAdminPanel: 'Otevřít administraci',
    openEntryDetail: 'Otevrit detail zaznamu',
    openFilters: 'Otevřít filtry',
    places: 'Místa',
    queryFailed: 'API odpovědělo, ale jeden z dotazů na mapu selhal.',
    relatedTopics: 'Související témata',
    resetFilters: 'resetovat filtr',
    resizeEntryDetail: 'Zmenit sirku detailu zaznamu',
    resizeFilters: 'Zmenit sirku filtru',
    routeRecords: (count: number) => `${count} záznamů trasy`,
    searchEntries: 'Hledat záznamy',
    selectedEntry: 'Vybraný záznam',
    sources: 'Zdroje',
    summary: 'Shrnutí',
    switchToDarkMode: 'Přepnout do tmavého režimu',
    switchToLightMode: 'Přepnout do světlého režimu',
    tags: 'Tagy',
    titleAudioLabel: 'Název',
    playAudio: 'Přehrát audio',
    playAll: 'Přehrát',
    playRandom: 'Přehrát náhodně',
    playNext: 'Přehrát další',
    stopAudio: 'Zastavit audio',
    timeline: 'Časová osa',
    timePeriod: 'Časové období',
    unsupportedCache: 'Tento prohlížeč nepodporuje offline cache médií.',
    unreachableApi: 'API není dostupné. Zkontroluj Render API URL a CORS nastavení.',
    viewportSuffix: ' ve viditelné oblasti mapy',
    whyItMatters: 'Proč je to důležité',
    yearFrom: 'Od',
    yearRangeSuffix: (from: string, to: string) => ` v období ${from || '?'}-${to || '?'}`,
    yearTo: 'Do',
    knownPoints: (count: number) => `${count} známých bodů.`,
  },
} as const

function normalizeUiLanguage(language: string): keyof typeof uiCopy {
  return language === 'cs' ? 'cs' : 'en'
}

function periodYearLabel(period: TimePeriodListItem, dateUnknown: string) {
  if (period.startYear == null && period.endYear == null) {
    return dateUnknown
  }

  return `${period.startYear ?? '?'}-${period.endYear ?? '?'}`
}

function tagGroupLabel(group: string, language: keyof typeof uiCopy) {
  const labels: Record<keyof typeof uiCopy, Record<string, string>> = {
    en: {
      category: 'Topics',
      tradition: 'Traditions and countries',
      'legacy-region-label': 'Places and regions',
      'mythology-type': 'Mythology types',
    },
    cs: {
      category: 'Témata',
      tradition: 'Tradice a země',
      'legacy-region-label': 'Místa a regiony',
      'mythology-type': 'Typy mytologie',
    },
  }

  return labels[language][group] ?? group.replaceAll('-', ' ')
}

function tagEntryCount(tag: TagListItem) {
  const count = Number(tag.entryCount)
  return Number.isFinite(count) ? count : 0
}

function entryIconKey(entry: Pick<EntryListItem, 'iconKey' | 'kind'>) {
  if (entry.iconKey?.trim()) {
    return entry.iconKey.trim()
  }

  const kind = entry.kind.toLowerCase()
  if (kind.includes('mythology')) {
    return 'game-icons:greek-temple'
  }
  if (kind.includes('war')) {
    return 'game-icons:crossed-swords'
  }
  if (kind.includes('exploration')) {
    return 'mdi:compass-outline'
  }
  if (kind.includes('invention')) {
    return 'mdi:lightbulb-on-outline'
  }
  if (kind.includes('technology')) {
    return 'mdi:chip'
  }
  if (kind.includes('science')) {
    return 'mdi:atom'
  }
  if (kind.includes('civilization')) {
    return 'mdi:city-variant-outline'
  }

  return 'mdi:timeline-clock-outline'
}

type AdminAuthSession = {
  accessToken: string
  refreshToken: string
  expiresAt: number
}

type DeploymentInfo = {
  commitSha?: string | null
  shortCommitSha?: string | null
  commitUrl?: string | null
  deployedAtUtc?: string | null
}

const adminSessionStorageKey = 'howdidwegethere.adminSession'
const entryQueryParam = 'entry'

const adminPages: Array<{ id: AdminPage; label: string }> = [
  { id: 'import', label: 'Import' },
  { id: 'periods', label: 'Periods' },
  { id: 'tags', label: 'Tags' },
  { id: 'entry', label: 'Entry' },
  { id: 'places', label: 'Places' },
  { id: 'routes', label: 'Routes' },
  { id: 'relationships', label: 'Relations' },
  { id: 'sources', label: 'Sources' },
  { id: 'media', label: 'Media' },
]

const contentLanguages = [
  { code: 'en', label: 'EN' },
  { code: 'cs', label: 'CS' },
  { code: 'es', label: 'ES' },
]

function createAdminSession(tokenResponse: AccessTokenResponse): AdminAuthSession {
  const expiresInSeconds = Number(tokenResponse.expiresIn)
  const normalizedExpiresIn = Number.isFinite(expiresInSeconds) && expiresInSeconds > 0 ? expiresInSeconds : 3600

  return {
    accessToken: tokenResponse.accessToken,
    refreshToken: tokenResponse.refreshToken,
    expiresAt: Date.now() + normalizedExpiresIn * 1000,
  }
}

function readStoredAdminSession() {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    const rawSession = window.localStorage.getItem(adminSessionStorageKey)
    if (!rawSession) {
      return null
    }

    const session = JSON.parse(rawSession) as Partial<AdminAuthSession>
    return session.accessToken && session.refreshToken && typeof session.expiresAt === 'number'
      ? {
          accessToken: session.accessToken,
          refreshToken: session.refreshToken,
          expiresAt: session.expiresAt,
        }
      : null
  } catch {
    return null
  }
}

function persistAdminSession(session: AdminAuthSession | null) {
  if (typeof window === 'undefined') {
    return
  }

  try {
    if (session) {
      window.localStorage.setItem(adminSessionStorageKey, JSON.stringify(session))
    } else {
      window.localStorage.removeItem(adminSessionStorageKey)
    }
  } catch {
    // Ignore unavailable storage; the in-memory session still works.
  }
}

function mediaUrlToAbsolute(url: string | null | undefined) {
  if (!url?.trim()) {
    return null
  }

  const trimmed = url.trim()
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed
  }

  const base = apiBaseUrl.replace(/\/$/, '')
  return `${base}/${trimmed.replace(/^\//, '')}`
}

function entrySlugFromUrl() {
  if (typeof window === 'undefined') {
    return null
  }

  return new URLSearchParams(window.location.search).get(entryQueryParam)
}

function updateEntrySlugInUrl(slug: string | null) {
  if (typeof window === 'undefined') {
    return
  }

  const url = new URL(window.location.href)
  if (slug) {
    url.searchParams.set(entryQueryParam, slug)
  } else {
    url.searchParams.delete(entryQueryParam)
  }

  const nextUrl = `${url.pathname}${url.search}${url.hash}`
  const currentUrl = `${window.location.pathname}${window.location.search}${window.location.hash}`
  if (nextUrl !== currentUrl) {
    window.history.replaceState(window.history.state, '', nextUrl)
  }
}

function findEntryAudioTrack(
  tracks: EntryDetail['audioTracks'],
  kind: string,
  language: string,
): EntryDetail['audioTracks'][number] | null {
  const matches = tracks.filter((track) => track.kind === kind)
  return matches.find((track) => track.languageCode === language) ?? matches.find((track) => track.languageCode === 'en') ?? matches[0] ?? null
}

function buildSectionAudio(
  entry: EntryListItem | undefined,
  track: EntryDetail['audioTracks'][number] | null,
  label: string,
): ActiveAudio | null {
  if (!entry || !track) {
    return null
  }

  const url = mediaUrlToAbsolute(track.url)
  if (!url) {
    return null
  }

  return {
    entryId: entry.id,
    title: entry.title,
    subtitle: label,
    url,
  }
}

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return '0 B'
  }

  const units = ['B', 'KB', 'MB', 'GB']
  let value = bytes
  let unitIndex = 0
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex += 1
  }

  return `${value.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`
}

function formatDeploymentTime(value: string | null | undefined) {
  if (!value) {
    return 'unknown deploy time'
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  return date.toLocaleString()
}

function formatImportTime(value: string | null | undefined) {
  if (!value) {
    return 'not completed'
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  return date.toLocaleString()
}

function describeImportStatus(status: string) {
  if (status === 'Imported') {
    return 'Imported'
  }

  if (status === 'PartiallyImported') {
    return 'Partially imported'
  }

  if (status === 'Failed') {
    return 'Failed'
  }

  return 'Pending'
}

function summarizeImportHistoryItem(item: ContentPackageImportHistoryItem) {
  return `${item.entriesRead} entries, ${item.audioTracksCreated} audio created, ${item.imagesCreated} images created`
}

async function copyTextToClipboard(value: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value)
    return
  }

  const textarea = document.createElement('textarea')
  textarea.value = value
  textarea.setAttribute('readonly', 'true')
  textarea.style.left = '-9999px'
  textarea.style.position = 'fixed'
  document.body.appendChild(textarea)
  textarea.select()
  document.execCommand('copy')
  document.body.removeChild(textarea)
}

function createUploadProgressState(
  phase: UploadProgressPhase,
  loadedBytes: number,
  totalBytes: number | null,
  message: string,
): UploadProgressState {
  const percent =
    totalBytes && totalBytes > 0 ? Math.min(100, Math.max(0, Math.round((loadedBytes / totalBytes) * 100))) : null

  return {
    phase,
    loadedBytes,
    totalBytes,
    percent,
    message,
  }
}

function describeBatchProgress(items: ContentPackageBatchItem[]) {
  const total = items.length
  if (total === 0) {
    return ''
  }

  const finishedCount = items.filter((item) => item.status === 'done' || item.status === 'error').length
  const currentIndex = Math.min(finishedCount + 1, total)
  return `${currentIndex} of ${total}`
}

function describeHttpFailure(request: XMLHttpRequest): string {
  const bodyText = request.responseText?.trim()
  if (!bodyText) {
    return `HTTP ${request.status}`
  }

  try {
    const parsed = JSON.parse(bodyText) as { error?: string; title?: string; detail?: string }
    const detail = parsed.error ?? parsed.detail ?? parsed.title
    if (detail) {
      return `HTTP ${request.status}: ${detail}`
    }
  } catch {
    // Response body was not JSON, fall through to the truncated raw text below.
  }

  const truncated = bodyText.length > 200 ? `${bodyText.slice(0, 200)}...` : bodyText
  return `HTTP ${request.status}: ${truncated}`
}

function uploadContentPackageWithProgress(
  formData: FormData,
  headers: Record<string, string> | undefined,
  onProgress: (progress: UploadProgressState) => void,
  processingMessage: string,
): Promise<ContentPackageImportResult> {
  return new Promise((resolve, reject) => {
    const request = new XMLHttpRequest()
    request.open('POST', `${apiBaseUrl}/api/admin/imports/content-package`)
    request.withCredentials = true

    for (const [key, value] of Object.entries(headers ?? {})) {
      request.setRequestHeader(key, value)
    }

    request.upload.onprogress = (event) => {
      const totalBytes = event.lengthComputable ? event.total : null
      onProgress(createUploadProgressState('uploading', event.loaded, totalBytes, 'Uploading content package...'))
    }

    request.upload.onload = () => {
      const file = formData.get('file')
      const fileSize = file instanceof File ? file.size : null
      onProgress(createUploadProgressState('processing', fileSize ?? 0, fileSize, processingMessage))
    }

    request.onerror = () => reject(new Error('Network error - the connection was interrupted during upload.'))
    request.onabort = () => reject(new Error('Upload was aborted.'))
    request.onload = () => {
      if (request.status < 200 || request.status >= 300) {
        reject(new Error(describeHttpFailure(request)))
        return
      }

      try {
        resolve(JSON.parse(request.responseText) as ContentPackageImportResult)
      } catch {
        reject(new Error('Server returned an unexpected (non-JSON) response.'))
      }
    }

    request.send(formData)
  })
}

function App() {
  const adminPage = useAppStore((state) => state.adminPage)
  const clearFiltersState = useAppStore((state) => state.clearFilters)
  const clearRuntimeCacheState = useAppStore((state) => state.clearRuntimeCacheState)
  const fromYear = useAppStore((state) => state.fromYear)
  const isAdminOpen = useAppStore((state) => state.isAdminOpen)
  const isEntryDetailOpen = useAppStore((state) => state.isEntryDetailOpen)
  const isFilterPanelOpen = useAppStore((state) => state.isFilterPanelOpen)
  const isMediaPrefetching = useAppStore((state) => state.isMediaPrefetching)
  const isOfflineCacheAvailable = useAppStore((state) => state.isOfflineCacheAvailable)
  const language = useAppStore((state) => state.language)
  const mapViewport = useAppStore((state) => state.mapViewport)
  const mediaCacheProgress = useAppStore((state) => state.mediaCacheProgress)
  const mediaCacheStatus = useAppStore((state) => state.mediaCacheStatus)
  const searchText = useAppStore((state) => state.searchText)
  const selectedEntryId = useAppStore((state) => state.selectedEntryId)
  const selectedPeriodId = useAppStore((state) => state.selectedPeriodId)
  const selectedTags = useAppStore((state) => state.selectedTags)
  const setAdminOpen = useAppStore((state) => state.setAdminOpen)
  const setAdminPage = useAppStore((state) => state.setAdminPage)
  const setEntryDetailOpen = useAppStore((state) => state.setEntryDetailOpen)
  const setFilterPanelOpen = useAppStore((state) => state.setFilterPanelOpen)
  const setFromYear = useAppStore((state) => state.setFromYear)
  const setLanguage = useAppStore((state) => state.setLanguage)
  const setMapViewport = useAppStore((state) => state.setMapViewport)
  const setMediaCacheProgress = useAppStore((state) => state.setMediaCacheProgress)
  const setMediaCacheStatus = useAppStore((state) => state.setMediaCacheStatus)
  const setMediaPrefetching = useAppStore((state) => state.setMediaPrefetching)
  const setOfflineCacheAvailable = useAppStore((state) => state.setOfflineCacheAvailable)
  const setSearchText = useAppStore((state) => state.setSearchText)
  const setSelectedEntryId = useAppStore((state) => state.setSelectedEntryId)
  const setSelectedPeriodId = useAppStore((state) => state.setSelectedPeriodId)
  const setTheme = useAppStore((state) => state.setTheme)
  const setToYear = useAppStore((state) => state.setToYear)
  const setYearRange = useAppStore((state) => state.setYearRange)
  const theme = useAppStore((state) => state.theme)
  const toYear = useAppStore((state) => state.toYear)
  const toggleTagState = useAppStore((state) => state.toggleTag)
  const uiLanguage = normalizeUiLanguage(language)
  const ui = uiCopy[uiLanguage]
  const debouncedQuery = useDebouncedHistoryQuery({
    fromYear,
    mapViewport,
    searchText,
    selectedTags,
    toYear,
  })
  const debouncedFromYear = debouncedQuery.fromYear
  const debouncedMapViewport = debouncedQuery.mapViewport
  const debouncedSearchText = debouncedQuery.searchText
  const debouncedSelectedTags = debouncedQuery.selectedTags
  const debouncedToYear = debouncedQuery.toYear
  const [entries, setEntries] = useState<EntryListItem[]>(fallbackEntries)
  const [mapEntries, setMapEntries] = useState<MapEntry[]>([])
  const [periods, setPeriods] = useState<TimePeriodListItem[]>(fallbackPeriods)
  const [tags, setTags] = useState<TagListItem[]>(fallbackTags)
  const [expandedTagGroup, setExpandedTagGroup] = useState<string | null>(null)
  const [selectedEntryDetail, setSelectedEntryDetail] = useState<EntryDetail | null>(null)
  const [isLoadingSelectedEntryDetail, setLoadingSelectedEntryDetail] = useState(false)
  const [copiedEntrySlug, setCopiedEntrySlug] = useState<string | null>(null)
  const [activeAudio, setActiveAudio] = useState<ActiveAudio | null>(null)
  const [audioQueue, setAudioQueue] = useState<ActiveAudio[]>([])
  const [isAudioPlayerMinimized, setAudioPlayerMinimized] = useState(false)
  const [pendingRandomPlayEntryId, setPendingRandomPlayEntryId] = useState<string | null>(null)
  const [isEntryImageExpanded, setEntryImageExpanded] = useState(false)
  const [entryImageIndex, setEntryImageIndex] = useState(0)
  const persistentAudioRef = useRef<HTMLAudioElement | null>(null)
  const [isLoadingMap, setLoadingMap] = useState(false)
  const [mapStatus, setMapStatus] = useState<string>(ui.loadingInitial)
  const [isMapEmptyResult, setMapEmptyResult] = useState(false)
  const [adminEmail, setAdminEmail] = useState('')
  const [adminPassword, setAdminPassword] = useState('')
  const [adminSession, setAdminSession] = useState<AdminAuthSession | null>(() => readStoredAdminSession())
  const adminToken = adminSession?.accessToken ?? null
  const [adminStatus, setAdminStatus] = useState(() =>
    adminSession ? 'Signed in from saved session.' : 'Sign in with the Render admin account.',
  )
  const [deploymentInfo, setDeploymentInfo] = useState<DeploymentInfo | null>(null)
  const [contentPackageFiles, setContentPackageFiles] = useState<File[]>([])
  const [isPreviewingContentPackage, setPreviewingContentPackage] = useState(false)
  const [isImportingContentPackage, setImportingContentPackage] = useState(false)
  const [clearContentPackageBeforeImport, setClearContentPackageBeforeImport] = useState(false)
  const [contentPackageUploadProgress, setContentPackageUploadProgress] = useState<UploadProgressState | null>(null)
  const [contentPackageBatchItems, setContentPackageBatchItems] = useState<ContentPackageBatchItem[]>([])
  const [contentPackagePreview, setContentPackagePreview] = useState<ContentPackageImportPreviewResult | null>(null)
  const [contentPackageResult, setContentPackageResult] = useState<ContentPackageImportResult | null>(null)
  const [contentPackageImportHistory, setContentPackageImportHistory] = useState<ContentPackageImportHistoryItem[]>([])
  const [isLoadingContentPackageImportHistory, setLoadingContentPackageImportHistory] = useState(false)
  const [adminEntries, setAdminEntries] = useState<AdminEntryListItem[]>([])
  const [isLoadingAdminEntries, setLoadingAdminEntries] = useState(false)
  const [entryForm, setEntryForm] = useState<EntryFormState>(defaultEntryForm)
  const [timePeriodForm, setTimePeriodForm] = useState<TimePeriodFormState>(defaultTimePeriodForm)
  const [mediaForm, setMediaForm] = useState({
    imageId: null as string | null,
    imageUrl: '',
    imageAlt: '',
    imageFile: null as File | null,
    audioTrackId: null as string | null,
    audioUrl: '',
    audioTitle: '',
    audioFile: null as File | null,
  })
  const [mediaInputResetKey, setMediaInputResetKey] = useState(0)
  const [adminEntryImages, setAdminEntryImages] = useState<EntryDetail['images']>([])
  const [adminEntryAudioTracks, setAdminEntryAudioTracks] = useState<EntryDetail['audioTracks']>([])
  const [bulkAudioFile, setBulkAudioFile] = useState<File | null>(null)
  const [bulkAudioLanguage, setBulkAudioLanguage] = useState('en')
  const [isBulkAudioPreviewing, setBulkAudioPreviewing] = useState(false)
  const [isBulkAudioUploading, setBulkAudioUploading] = useState(false)
  const [bulkAudioPreview, setBulkAudioPreview] = useState<BulkAudioUploadPreviewResult | null>(null)
  const [bulkAudioResult, setBulkAudioResult] = useState<BulkAudioUploadResult | null>(null)
  const [adminEntryPlaces, setAdminEntryPlaces] = useState<EntryDetail['places']>([])
  const [placeForm, setPlaceForm] = useState({
    name: '',
    slug: '',
    role: 'MainSite' as EntryPlaceRole,
    placeType: 'Site' as PlaceType,
    spatialConfidence: 'Approximate' as SpatialConfidence,
    longitude: '',
    latitude: '',
    countryCode: '',
    note: '',
    sortOrder: '0',
  })
  const [routeForm, setRouteForm] = useState({
    id: null as string | null,
    name: '',
    routeType: 'Journey' as RouteType,
    spatialConfidence: 'Approximate' as SpatialConfidence,
    sourceNote: '',
    pointsText: '',
  })
  const [adminEntryRoutes, setAdminEntryRoutes] = useState<EntryRouteDetail[]>([])
  const [relationshipForm, setRelationshipForm] = useState({
    id: null as string | null,
    targetEntrySlug: '',
    relationshipType: 'RelatedTo' as EntryRelationshipType,
    confidence: '',
    note: '',
  })
  const [adminEntryRelationships, setAdminEntryRelationships] = useState<AdminEntryRelationshipDetail[]>([])
  const [sourceForm, setSourceForm] = useState({
    sourceId: null as string | null,
    originalSupportsField: '' as SourceSupportKind | '',
    url: '',
    title: '',
    publisher: '',
    supportsField: 'General' as SourceSupportKind,
    note: '',
  })
  const [adminEntrySources, setAdminEntrySources] = useState<EntryDetail['sources']>([])
  const [adminEntryTranslations, setAdminEntryTranslations] = useState<AdminEntryDetail['translations']>([])
  const [tagForm, setTagForm] = useState({
    id: null as string | null,
    name: '',
    slug: '',
    tagGroup: 'topic',
    parentTagId: '',
    attachSlug: '',
  })
  const [adminEntryTags, setAdminEntryTags] = useState<EntryDetail['tags']>([])
  const [reloadKey, setReloadKey] = useState(0)
  const [filterPaneWidth, setFilterPaneWidth] = useState(defaultFilterPaneWidth)
  const [detailPaneWidth, setDetailPaneWidth] = useState(defaultDetailPaneWidth)
  const [isFilterPaneCollapsed, setFilterPaneCollapsed] = useState(false)
  const [isDetailPaneCollapsed, setDetailPaneCollapsed] = useState(false)
  const [resizingPane, setResizingPane] = useState<SidePane | null>(null)
  const sidePaneResizeRef = useRef<{
    pane: SidePane
    pointerId: number
    startWidth: number
    startX: number
  } | null>(null)
  const selectedEntryIdRef = useRef(selectedEntryId)
  const initialEntrySlugRef = useRef(entrySlugFromUrl())
  const hasAppliedInitialEntrySlugRef = useRef(false)

  const authHeaders = useCallback(
    () => (adminToken ? { Authorization: `Bearer ${adminToken}` } : undefined),
    [adminToken],
  )

  const loadContentPackageImportHistory = useCallback(async () => {
    if (!adminToken) {
      setContentPackageImportHistory([])
      return
    }

    setLoadingContentPackageImportHistory(true)
    try {
      const response = await fetch(`${apiBaseUrl}/api/admin/imports/content-package/history?take=20`, {
        headers: authHeaders(),
        credentials: 'include',
      })

      if (!response.ok) {
        setContentPackageImportHistory([])
        return
      }

      const result = (await response.json()) as ContentPackageImportHistoryResult
      setContentPackageImportHistory(result.items)
    } catch {
      setContentPackageImportHistory([])
    } finally {
      setLoadingContentPackageImportHistory(false)
    }
  }, [adminToken, authHeaders])

  useEffect(() => {
    selectedEntryIdRef.current = selectedEntryId
  }, [selectedEntryId])

  const handleMapViewportChange = useCallback((viewport: MapViewport) => {
    const roundedViewport: MapViewport = {
      west: Number(viewport.west.toFixed(4)),
      south: Number(viewport.south.toFixed(4)),
      east: Number(viewport.east.toFixed(4)),
      north: Number(viewport.north.toFixed(4)),
    }

    setMapViewport((current) =>
      current &&
      current.west === roundedViewport.west &&
      current.south === roundedViewport.south &&
      current.east === roundedViewport.east &&
      current.north === roundedViewport.north
        ? current
        : roundedViewport,
    )
  }, [setMapViewport])

  const workspaceStyle = useMemo<CSSProperties>(() => ({
    '--detail-panel-width': `${detailPaneWidth}px`,
    '--filter-panel-width': `${filterPaneWidth}px`,
  }) as CSSProperties, [detailPaneWidth, filterPaneWidth])

  const workspaceClassName = [
    'map-workspace',
    isFilterPaneCollapsed ? 'filter-pane-collapsed' : '',
    isDetailPaneCollapsed ? 'detail-pane-collapsed' : '',
    resizingPane ? 'resizing-pane' : '',
  ].filter(Boolean).join(' ')

  function maxResizablePaneWidth(pane: SidePane) {
    const paneMaxWidth = pane === 'filter' ? maxFilterPaneWidth : maxDetailPaneWidth
    if (typeof window === 'undefined') {
      return paneMaxWidth
    }

    const oppositeWidth = pane === 'filter' ? detailPaneWidth : filterPaneWidth
    const isOppositeCollapsed = pane === 'filter' ? isDetailPaneCollapsed : isFilterPaneCollapsed
    const availableWidth = window.innerWidth - minMapPaneWidth - (isOppositeCollapsed ? 0 : oppositeWidth)
    return Math.max(minSidePaneWidth, Math.min(paneMaxWidth, availableWidth))
  }

  function clampSidePaneWidth(pane: SidePane, width: number) {
    return Math.round(clampNumber(width, minSidePaneWidth, maxResizablePaneWidth(pane)))
  }

  function setSidePaneWidth(pane: SidePane, width: number) {
    const clampedWidth = clampSidePaneWidth(pane, width)
    if (pane === 'filter') {
      setFilterPaneWidth(clampedWidth)
      return
    }

    setDetailPaneWidth(clampedWidth)
  }

  function beginSidePaneResize(pane: SidePane, event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0) {
      return
    }

    event.preventDefault()
    sidePaneResizeRef.current = {
      pane,
      pointerId: event.pointerId,
      startWidth: pane === 'filter' ? filterPaneWidth : detailPaneWidth,
      startX: event.clientX,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
    setResizingPane(pane)
  }

  function moveSidePaneResize(event: PointerEvent<HTMLDivElement>) {
    const resizeState = sidePaneResizeRef.current
    if (!resizeState || resizeState.pointerId !== event.pointerId) {
      return
    }

    const deltaX = event.clientX - resizeState.startX
    const nextWidth = resizeState.pane === 'filter'
      ? resizeState.startWidth + deltaX
      : resizeState.startWidth - deltaX
    setSidePaneWidth(resizeState.pane, nextWidth)
  }

  function endSidePaneResize(event: PointerEvent<HTMLDivElement>) {
    const resizeState = sidePaneResizeRef.current
    if (!resizeState || resizeState.pointerId !== event.pointerId) {
      return
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    sidePaneResizeRef.current = null
    setResizingPane(null)
  }

  function resizeSidePaneWithKeyboard(pane: SidePane, event: ReactKeyboardEvent<HTMLDivElement>) {
    const step = event.shiftKey ? 40 : 16
    const currentWidth = pane === 'filter' ? filterPaneWidth : detailPaneWidth
    let nextWidth = currentWidth

    if (event.key === 'ArrowLeft') {
      nextWidth += pane === 'filter' ? -step : step
    } else if (event.key === 'ArrowRight') {
      nextWidth += pane === 'filter' ? step : -step
    } else if (event.key === 'Home') {
      nextWidth = minSidePaneWidth
    } else if (event.key === 'End') {
      nextWidth = maxResizablePaneWidth(pane)
    } else {
      return
    }

    event.preventDefault()
    setSidePaneWidth(pane, nextWidth)
  }

  useEffect(() => {
    let isActive = true

    async function loadEntryListData() {
      try {
        const requestedEntrySlug = hasAppliedInitialEntrySlugRef.current ? null : initialEntrySlugRef.current
        const shouldFindRequestedEntry = requestedEntrySlug !== null
        const [entriesResult, periodsResult, tagsResult] = await Promise.all([
          cachedQuery(
            [
              'entries',
              language,
              shouldFindRequestedEntry ? requestedEntrySlug : debouncedSearchText.trim(),
              shouldFindRequestedEntry ? [] : debouncedSelectedTags,
              shouldFindRequestedEntry ? null : debouncedFromYear,
              shouldFindRequestedEntry ? null : debouncedToYear,
              reloadKey,
            ],
            () =>
              apiClient.GET('/api/entries', {
                params: {
                  query: {
                    language,
                    search: shouldFindRequestedEntry ? undefined : debouncedSearchText.trim() || undefined,
                    tag: shouldFindRequestedEntry ? [] : debouncedSelectedTags,
                    fromYear: shouldFindRequestedEntry ? undefined : numberOrNull(debouncedFromYear),
                    toYear: shouldFindRequestedEntry ? undefined : numberOrNull(debouncedToYear),
                  },
                },
              }),
          ),
          cachedQuery(
            ['time-periods', language, reloadKey],
            () =>
              apiClient.GET('/api/time-periods', {
                params: {
                  query: {
                    language,
                  },
                },
              }),
            { ttlMs: 120_000 },
          ),
          cachedQuery(
            ['tags', language, reloadKey],
            () =>
              apiClient.GET('/api/tags', {
                params: {
                  query: {
                    language,
                  },
                },
              }),
            { ttlMs: 120_000 },
          ),
        ])

        if (!isActive) {
          return
        }

        if (entriesResult.error || periodsResult.error || tagsResult.error) {
          setMapEmptyResult(false)
          setMapStatus(ui.queryFailed)
          return
        }

        const loadedEntries = (entriesResult.data as EntryListItem[] | undefined) ?? []
        if (loadedEntries.length > 0) {
          setEntries(loadedEntries)
          const currentSelectedEntryId = selectedEntryIdRef.current
          const requestedEntry = requestedEntrySlug
            ? loadedEntries.find((entry) => entry.slug === requestedEntrySlug)
            : undefined
          const nextSelectedEntryId = requestedEntry?.id ?? (loadedEntries.some((entry) => entry.id === currentSelectedEntryId)
            ? currentSelectedEntryId
            : loadedEntries[0].id)
          if (nextSelectedEntryId !== currentSelectedEntryId) {
            selectedEntryIdRef.current = nextSelectedEntryId
            setSelectedEntryId(nextSelectedEntryId)
          }
          if (requestedEntry) {
            hasAppliedInitialEntrySlugRef.current = true
            setEntryDetailOpen(true)
            setDetailPaneCollapsed(false)
          }
          setMapEmptyResult(false)
        } else {
          setEntries([])
          selectedEntryIdRef.current = ''
          setSelectedEntryId('')
          setSelectedEntryDetail(null)
          setMapEmptyResult(true)
          setMapStatus(ui.noResults)
        }

        if (periodsResult.data && periodsResult.data.length > 0) {
          setPeriods(periodsResult.data as TimePeriodListItem[])
        }

        if (tagsResult.data && tagsResult.data.length > 0) {
          setTags(tagsResult.data as TagListItem[])
        }
      } catch {
        if (isActive) {
          setMapEmptyResult(false)
          setMapStatus(ui.unreachableApi)
        }
      }
    }

    void loadEntryListData()

    return () => {
      isActive = false
    }
  }, [
    debouncedFromYear,
    debouncedSearchText,
    debouncedSelectedTags,
    debouncedToYear,
    language,
    reloadKey,
    setEntryDetailOpen,
    setSelectedEntryId,
    ui,
  ])

  useEffect(() => {
    let isActive = true

    async function loadMapData() {
      setLoadingMap(true)
      try {
        const requestedEntrySlug = hasAppliedInitialEntrySlugRef.current ? null : initialEntrySlugRef.current
        const shouldFindRequestedEntry = requestedEntrySlug !== null
        const mapResult = await cachedQuery(
          [
            'map-entries',
            language,
            shouldFindRequestedEntry ? requestedEntrySlug : debouncedSearchText.trim(),
            shouldFindRequestedEntry ? [] : debouncedSelectedTags,
            shouldFindRequestedEntry ? null : debouncedFromYear,
            shouldFindRequestedEntry ? null : debouncedToYear,
            debouncedMapViewport,
            selectedEntryId,
            reloadKey,
          ],
          () =>
            apiClient.GET('/api/map/entries', {
              params: {
                query: {
                  language,
                  search: shouldFindRequestedEntry ? undefined : debouncedSearchText.trim() || undefined,
                  tag: shouldFindRequestedEntry ? [] : debouncedSelectedTags,
                  fromYear: shouldFindRequestedEntry ? undefined : numberOrNull(debouncedFromYear),
                  toYear: shouldFindRequestedEntry ? undefined : numberOrNull(debouncedToYear),
                  west: debouncedMapViewport?.west,
                  south: debouncedMapViewport?.south,
                  east: debouncedMapViewport?.east,
                  north: debouncedMapViewport?.north,
                  selectedEntryId: selectedEntryId || undefined,
                },
              },
            }),
          { ttlMs: 20_000 },
        )

        if (!isActive) {
          return
        }

        if (mapResult.error) {
          setMapEmptyResult(false)
          setMapStatus(ui.queryFailed)
          return
        }

        const mapPayload = (mapResult.data as MapEntry[] | undefined) ?? []
        const mapPointCount = mapPayload.reduce(
          (count, entry) => count + entry.points.length + entry.routes.reduce((sum, route) => sum + route.geometry.length, 0),
          0,
        )
        const yearRangeLabel = debouncedFromYear || debouncedToYear ? ui.yearRangeSuffix(debouncedFromYear, debouncedToYear) : ''
        const viewportLabel = debouncedMapViewport ? ui.viewportSuffix : ''
        setMapEntries(mapPayload)
        if (mapPayload.length === 0) {
          setMapEmptyResult(true)
          setMapStatus(ui.noResults)
          return
        }

        setMapEmptyResult(false)
        setMapStatus(
          mapPointCount > 0
            ? ui.entriesLoaded(mapPayload.length, mapPointCount, yearRangeLabel, viewportLabel)
            : ui.entriesLoadedNoPoints(mapPayload.length, yearRangeLabel, viewportLabel),
        )
      } catch {
        if (isActive) {
          setMapEmptyResult(false)
          setMapStatus(ui.unreachableApi)
        }
      } finally {
        if (isActive) {
          setLoadingMap(false)
        }
      }
    }

    void loadMapData()

    return () => {
      isActive = false
    }
  }, [
    debouncedFromYear,
    debouncedMapViewport,
    debouncedSearchText,
    debouncedSelectedTags,
    debouncedToYear,
    language,
    selectedEntryId,
    reloadKey,
    ui,
  ])

  useEffect(() => {
    let isActive = true
    const selectedEntry = entries.find((entry) => entry.id === selectedEntryId)
    setEntryImageExpanded(false)
    setEntryImageIndex(0)

    async function loadSelectedEntryDetail() {
      if (!selectedEntry || selectedEntry.id.startsWith('draft-')) {
        setSelectedEntryDetail(null)
        setLoadingSelectedEntryDetail(false)
        return
      }

      setSelectedEntryDetail(null)
      setLoadingSelectedEntryDetail(true)

      try {
        const result = await cachedQuery(
          ['entry-detail', selectedEntry.slug, language, reloadKey],
          () =>
            apiClient.GET('/api/entries/{slug}', {
              params: {
                path: {
                  slug: selectedEntry.slug,
                },
                query: {
                  language,
                },
              },
            }),
          { ttlMs: 60_000 },
        )

        if (!isActive) {
          return
        }

        setSelectedEntryDetail(result.error || !result.data ? null : (result.data as EntryDetail))
      } catch {
        if (isActive) {
          setSelectedEntryDetail(null)
        }
      } finally {
        if (isActive) {
          setLoadingSelectedEntryDetail(false)
        }
      }
    }

    void loadSelectedEntryDetail()

    return () => {
      isActive = false
    }
  }, [entries, language, selectedEntryId, reloadKey])

  useEffect(() => {
    if (adminToken) {
      if (adminSession?.refreshToken && adminSession.expiresAt <= Date.now() + 5_000) {
        return
      }

      let isActive = true

      async function loadSignedInAdminEntries() {
        setLoadingAdminEntries(true)
        const result = await cachedQuery(
          ['admin-entries', language, adminToken, reloadKey],
          () =>
            apiClient.GET('/api/admin/entries', {
              headers: {
                Authorization: `Bearer ${adminToken}`,
              },
              params: {
                query: {
                  language,
                },
              },
            }),
          { ttlMs: 15_000 },
        )

        if (!isActive) {
          return
        }

        if (result.error || !result.data) {
          setAdminStatus('Unable to load admin entries. Check token and API logs.')
          setLoadingAdminEntries(false)
          return
        }

        setAdminEntries(result.data as AdminEntryListItem[])
        setLoadingAdminEntries(false)
      }

      void loadSignedInAdminEntries()

      return () => {
        isActive = false
      }
    }
  }, [adminSession, adminToken, language, reloadKey])

  useEffect(() => {
    if (!adminToken) {
      setDeploymentInfo(null)
      return
    }

    let isActive = true

    async function loadDeploymentInfo() {
      try {
        const response = await fetch(`${apiBaseUrl}/api/admin/deployment-info`, {
          headers: {
            Authorization: `Bearer ${adminToken}`,
          },
        })

        if (!isActive) {
          return
        }

        setDeploymentInfo(response.ok ? ((await response.json()) as DeploymentInfo) : null)
      } catch {
        if (isActive) {
          setDeploymentInfo(null)
        }
      }
    }

    void loadDeploymentInfo()

    return () => {
      isActive = false
    }
  }, [adminToken])

  useEffect(() => {
    if (!adminToken || !isAdminOpen || adminPage !== 'import') {
      return
    }

    void loadContentPackageImportHistory()
  }, [adminToken, isAdminOpen, adminPage, reloadKey, loadContentPackageImportHistory])

  useEffect(() => {
    persistAdminSession(adminSession)
  }, [adminSession])

  useEffect(() => {
    setOfflineCacheAvailable('serviceWorker' in navigator && 'caches' in window)
  }, [setOfflineCacheAvailable])

  useEffect(() => {
    if (!('serviceWorker' in navigator)) {
      return
    }

    function handleServiceWorkerMessage(event: MessageEvent) {
      if (event.data?.type === 'HDWGH_PREFETCH_PROGRESS') {
        const progress = event.data as MediaCacheProgress
        setMediaCacheProgress({
          completed: progress.completed,
          failed: progress.failed,
          total: progress.total,
        })
        setMediaCacheStatus(ui.cacheProgress(progress.completed, progress.total))
      }

      if (event.data?.type === 'HDWGH_PREFETCH_DONE') {
        const progress = event.data as MediaCacheProgress
        setMediaPrefetching(false)
        setMediaCacheProgress({
          completed: progress.completed,
          failed: progress.failed,
          total: progress.total,
        })
        setMediaCacheStatus(
          progress.failed > 0
            ? ui.cacheDoneWithFailures(progress.completed, progress.total, progress.failed)
            : ui.cacheDone(progress.completed),
        )
      }

      if (event.data?.type === 'HDWGH_CACHE_CLEARED') {
        clearRuntimeCacheState()
        setMediaCacheStatus(ui.cacheCleared)
      }
    }

    navigator.serviceWorker.addEventListener('message', handleServiceWorkerMessage)
    return () => navigator.serviceWorker.removeEventListener('message', handleServiceWorkerMessage)
  }, [clearRuntimeCacheState, setMediaCacheProgress, setMediaCacheStatus, setMediaPrefetching, ui])

  useEffect(() => {
    if (!adminSession?.refreshToken) {
      return
    }

    let isActive = true
    const refreshInMs = Math.max(adminSession.expiresAt - Date.now() - 60_000, 0)

    const refreshTimer = window.setTimeout(() => {
      async function refreshAdminSession() {
        const result = await apiClient.POST('/api/auth/refresh', {
          body: {
            refreshToken: adminSession.refreshToken,
          },
        })

        if (!isActive) {
          return
        }

        if (result.error || !result.data?.accessToken) {
          setAdminSession(null)
          setAdminPassword('')
          setAdminStatus('Admin session expired. Sign in again.')
          return
        }

        setAdminSession(createAdminSession(result.data))
      }

      void refreshAdminSession()
    }, refreshInMs)

    return () => {
      isActive = false
      window.clearTimeout(refreshTimer)
    }
  }, [adminSession])

  useEffect(() => {
    if (!expandedTagGroup) {
      return
    }

    function closeExpandedTagGroup(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setExpandedTagGroup(null)
      }
    }

    window.addEventListener('keydown', closeExpandedTagGroup)
    return () => window.removeEventListener('keydown', closeExpandedTagGroup)
  }, [expandedTagGroup])

  const selectedEntry = useMemo(
    () => entries.find((entry) => entry.id === selectedEntryId) ?? entries[0],
    [entries, selectedEntryId],
  )
  const selectedEntrySlug = selectedEntryDetail?.slug ?? selectedEntry?.slug ?? null

  useEffect(() => {
    const slug = isEntryDetailOpen && selectedEntry && !selectedEntry.id.startsWith('draft-')
      ? selectedEntry.slug
      : null
    updateEntrySlugInUrl(slug)
  }, [isEntryDetailOpen, selectedEntry])

  useEffect(() => {
    function handlePopState() {
      const slug = entrySlugFromUrl()
      if (!slug) {
        setEntryDetailOpen(false)
        return
      }

      const entry = entries.find((item) => item.slug === slug)
      if (entry) {
        selectedEntryIdRef.current = entry.id
        setSelectedEntryId(entry.id)
        setEntryDetailOpen(true)
        setDetailPaneCollapsed(false)
        return
      }

      initialEntrySlugRef.current = slug
      hasAppliedInitialEntrySlugRef.current = false
      setReloadKey((current) => current + 1)
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [entries, setEntryDetailOpen, setSelectedEntryId])

  const playableRandomEntries = useMemo(
    () => entries.filter((entry) => !entry.id.startsWith('draft-') && mediaUrlToAbsolute(entry.primaryAudioUrl) !== null),
    [entries],
  )

  const mapAutoFitKey = useMemo(
    () => JSON.stringify({
      fromYear: debouncedFromYear,
      language,
      reloadKey,
      searchText: debouncedSearchText,
      selectedTags: debouncedSelectedTags,
      toYear: debouncedToYear,
    }),
    [debouncedFromYear, debouncedSearchText, debouncedSelectedTags, debouncedToYear, language, reloadKey],
  )

  const relatedEntryGroups = useMemo(() => {
    const relatedEntries = selectedEntryDetail?.relatedEntries ?? []
    return ['outgoing', 'incoming']
      .map((direction) => ({
        direction,
        entries: relatedEntries.filter((entry) => entry.direction === direction),
      }))
      .filter((group) => group.entries.length > 0)
  }, [selectedEntryDetail])

  const periodHierarchy = useMemo(() => {
    const periodsById = new Map(periods.map((period) => [period.id, period]))
    return periods
      .filter((period) => !period.parentPeriodId || !periodsById.has(period.parentPeriodId))
      .map((period) => ({
        period,
        children: periods.filter((child) => child.parentPeriodId === period.id),
      }))
  }, [periods])

  const tagGroups = useMemo(() => {
    const preferredOrder = ['category', 'tradition', 'legacy-region-label', 'mythology-type']
    const groups = new Map<string, TagListItem[]>()

    for (const tag of tags) {
      groups.set(tag.tagGroup, [...(groups.get(tag.tagGroup) ?? []), tag])
    }

    return [...groups.entries()]
      .map(([group, items]) => {
        const sortedItems = [...items].sort((left, right) =>
          tagEntryCount(right) - tagEntryCount(left) || left.name.localeCompare(right.name),
        )
        const visibleItemsById = new Map<string, TagListItem>()

        for (const tag of sortedItems) {
          if (selectedTags.includes(tag.slug)) {
            visibleItemsById.set(tag.id, tag)
          }
        }

        for (const tag of sortedItems) {
          if (visibleItemsById.size >= visibleTagLimit) {
            break
          }

          visibleItemsById.set(tag.id, tag)
        }

        return {
          group,
          hiddenCount: Math.max(sortedItems.length - visibleItemsById.size, 0),
          label: tagGroupLabel(group, uiLanguage),
          items: sortedItems,
          visibleItems: [...visibleItemsById.values()],
        }
      })
      .sort((left, right) => {
        const leftIndex = preferredOrder.indexOf(left.group)
        const rightIndex = preferredOrder.indexOf(right.group)
        if (leftIndex !== -1 || rightIndex !== -1) {
          return (leftIndex === -1 ? Number.MAX_SAFE_INTEGER : leftIndex) -
            (rightIndex === -1 ? Number.MAX_SAFE_INTEGER : rightIndex)
        }

        return left.label.localeCompare(right.label)
      })
  }, [selectedTags, tags, uiLanguage])

  const expandedTagGroupModel = useMemo(
    () => tagGroups.find((group) => group.group === expandedTagGroup) ?? null,
    [expandedTagGroup, tagGroups],
  )

  const visibleMediaUrls = useMemo(() => {
    const urls = new Set<string>()

    for (const entry of entries) {
      const imageUrl = mediaUrlToAbsolute(entry.primaryImageUrl)
      const audioUrl = mediaUrlToAbsolute(entry.primaryAudioUrl)
      if (imageUrl) {
        urls.add(imageUrl)
      }
      if (audioUrl) {
        urls.add(audioUrl)
      }
    }

    for (const image of selectedEntryDetail?.images ?? []) {
      const imageUrl = mediaUrlToAbsolute(image.url)
      if (imageUrl) {
        urls.add(imageUrl)
      }
    }

    for (const audio of selectedEntryDetail?.audioTracks ?? []) {
      const audioUrl = mediaUrlToAbsolute(audio.url)
      if (audioUrl) {
        urls.add(audioUrl)
      }
    }

    if (activeAudio?.url) {
      urls.add(activeAudio.url)
    }

    return [...urls]
  }, [activeAudio?.url, entries, selectedEntryDetail])

  const selectedEntryImages = useMemo(
    () =>
      (selectedEntryDetail?.images ?? [])
        .map((image) => ({
          image,
          url: mediaUrlToAbsolute(image.url),
        }))
        .filter((item): item is { image: EntryDetail['images'][number]; url: string } => item.url !== null),
    [selectedEntryDetail],
  )
  const selectedEntryImageCount = selectedEntryImages.length
  const activeEntryImageIndex = selectedEntryImageCount === 0
    ? 0
    : Math.min(entryImageIndex, selectedEntryImageCount - 1)
  const selectedEntryImageItem = selectedEntryImages[activeEntryImageIndex] ?? null
  const selectedEntryImage = selectedEntryImageItem?.image
  const selectedEntryImageUrl = selectedEntryImageItem?.url ?? null
  const hasMultipleEntryImages = selectedEntryImageCount > 1
  const selectedEntryAudioTracks = selectedEntryDetail?.audioTracks ?? []
  const titleAudio = buildSectionAudio(
    selectedEntry,
    findEntryAudioTrack(selectedEntryAudioTracks, 'Title', language),
    ui.titleAudioLabel,
  )
  const summaryAudio = buildSectionAudio(
    selectedEntry,
    findEntryAudioTrack(selectedEntryAudioTracks, 'Summary', language),
    ui.summary,
  )
  const descriptionAudio = buildSectionAudio(
    selectedEntry,
    findEntryAudioTrack(selectedEntryAudioTracks, 'Description', language),
    ui.description,
  )
  const whyItMattersAudio = buildSectionAudio(
    selectedEntry,
    findEntryAudioTrack(selectedEntryAudioTracks, 'WhyItMatters', language),
    ui.whyItMatters,
  )
  const ultimateAudioSequence = useMemo(
    () =>
      [titleAudio, whyItMattersAudio, descriptionAudio].filter(
        (item): item is ActiveAudio => item !== null,
      ),
    [descriptionAudio, titleAudio, whyItMattersAudio],
  )

  useEffect(() => {
    if (entryImageIndex >= selectedEntryImageCount) {
      setEntryImageIndex(0)
    }
  }, [entryImageIndex, selectedEntryImageCount])

  const showEntryImage = useCallback((index: number) => {
    if (selectedEntryImageCount === 0) {
      setEntryImageIndex(0)
      return
    }

    setEntryImageIndex(((index % selectedEntryImageCount) + selectedEntryImageCount) % selectedEntryImageCount)
  }, [selectedEntryImageCount])

  const showAdjacentEntryImage = useCallback((direction: -1 | 1) => {
    setEntryImageIndex((current) => {
      if (selectedEntryImageCount <= 1) {
        return 0
      }

      return (current + direction + selectedEntryImageCount) % selectedEntryImageCount
    })
  }, [selectedEntryImageCount])

  useEffect(() => {
    if (!isEntryImageExpanded) {
      return
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setEntryImageExpanded(false)
        return
      }

      if (event.key === 'ArrowLeft') {
        event.preventDefault()
        showAdjacentEntryImage(-1)
        return
      }

      if (event.key === 'ArrowRight') {
        event.preventDefault()
        showAdjacentEntryImage(1)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isEntryImageExpanded, showAdjacentEntryImage])

  const selectEntry = useCallback((entryId: string) => {
    selectedEntryIdRef.current = entryId
    setSelectedEntryId(entryId)
    setEntryDetailOpen(true)
    setDetailPaneCollapsed(false)
  }, [setEntryDetailOpen, setSelectedEntryId])

  const playAudio = useCallback((audio: ActiveAudio) => {
    setActiveAudio(audio)
    window.requestAnimationFrame(() => {
      const player = persistentAudioRef.current
      if (!player) {
        return
      }

      if (player.src !== audio.url) {
        player.src = audio.url
      }
      void player.play().catch(() => undefined)
    })
  }, [])

  const playSingleAudio = useCallback((audio: ActiveAudio) => {
    setAudioQueue([])
    playAudio(audio)
  }, [playAudio])

  const playAudioSequence = useCallback((sequence: ActiveAudio[]) => {
    if (sequence.length === 0) {
      return
    }

    const [first, ...rest] = sequence
    setAudioQueue(rest)
    playAudio(first)
  }, [playAudio])

  const playRandomEntry = useCallback((excludedEntryId: string | null = null) => {
    if (playableRandomEntries.length === 0) {
      return
    }

    const candidates = playableRandomEntries.filter((entry) => entry.id !== excludedEntryId)
    const sourceEntries = candidates.length > 0 ? candidates : playableRandomEntries
    const randomEntry = sourceEntries[Math.floor(Math.random() * sourceEntries.length)]
    if (!randomEntry) {
      return
    }

    const player = persistentAudioRef.current
    if (player) {
      player.pause()
    }
    setActiveAudio(null)
    setAudioQueue([])
    setAudioPlayerMinimized(false)
    setPendingRandomPlayEntryId(randomEntry.id)
    if (randomEntry.id !== selectedEntryId) {
      setLoadingSelectedEntryDetail(true)
    }
    selectEntry(randomEntry.id)
  }, [playableRandomEntries, selectEntry, selectedEntryId])

  const playNextRandomEntry = useCallback(() => {
    playRandomEntry(activeAudio?.entryId ?? selectedEntryId)
  }, [activeAudio?.entryId, playRandomEntry, selectedEntryId])

  useEffect(() => {
    if (!pendingRandomPlayEntryId || selectedEntryId !== pendingRandomPlayEntryId || isLoadingSelectedEntryDetail) {
      return
    }

    if (selectedEntryDetail?.id !== pendingRandomPlayEntryId) {
      setPendingRandomPlayEntryId(null)
      return
    }

    if (ultimateAudioSequence.length > 0) {
      playAudioSequence(ultimateAudioSequence)
    }

    setPendingRandomPlayEntryId(null)
  }, [
    isLoadingSelectedEntryDetail,
    pendingRandomPlayEntryId,
    playAudioSequence,
    selectedEntryDetail?.id,
    selectedEntryId,
    ultimateAudioSequence,
  ])

  function handleAudioEnded() {
    if (audioQueue.length === 0) {
      return
    }

    const [next, ...rest] = audioQueue
    setAudioQueue(rest)
    playAudio(next)
  }

  function stopAudio() {
    const player = persistentAudioRef.current
    if (player) {
      player.pause()
      player.removeAttribute('src')
      player.load()
    }
    setActiveAudio(null)
    setAudioPlayerMinimized(false)
    setAudioQueue([])
  }

  function openActiveAudioEntry() {
    if (!activeAudio) {
      return
    }

    setSelectedEntryId(activeAudio.entryId)
    setEntryDetailOpen(true)
    setDetailPaneCollapsed(false)
  }

  function renderSectionPlayButton(audio: ActiveAudio | null) {
    if (!audio) {
      return null
    }

    const isPlaying = activeAudio?.url === audio.url
    return (
      <button
        className={isPlaying ? 'section-play-button active' : 'section-play-button'}
        type="button"
        aria-label={ui.playAudio}
        title={ui.playAudio}
        onClick={() => playSingleAudio(audio)}
      >
        <PlayCircle aria-hidden="true" />
      </button>
    )
  }

  function toggleTag(tag: string) {
    toggleTagState(tag)
  }

  function selectPeriodFilter(period: TimePeriodListItem) {
    setYearRange(period.id, period.startYear?.toString() ?? '', period.endYear?.toString() ?? '')
  }

  function clearFilters() {
    clearFiltersState()
  }

  async function prefetchVisibleMedia() {
    if (!isOfflineCacheAvailable) {
      setMediaCacheStatus(ui.unsupportedCache)
      return
    }

    if (visibleMediaUrls.length === 0) {
      setMediaCacheStatus(ui.noMediaUrls)
      return
    }

    const registration = await navigator.serviceWorker.ready
    const worker = navigator.serviceWorker.controller ?? registration.active
    if (!worker) {
      setMediaCacheStatus(ui.offlineCacheStarting)
      return
    }

    setMediaPrefetching(true)
    setMediaCacheProgress({ completed: 0, failed: 0, total: visibleMediaUrls.length })
    setMediaCacheStatus(ui.cacheProgress(0, visibleMediaUrls.length))
    worker.postMessage({
      type: 'HDWGH_PREFETCH_URLS',
      urls: visibleMediaUrls,
    })
  }

  async function clearRuntimeCache() {
    if (!isOfflineCacheAvailable) {
      return
    }

    const registration = await navigator.serviceWorker.ready
    const worker = navigator.serviceWorker.controller ?? registration.active
    worker?.postMessage({ type: 'HDWGH_CLEAR_RUNTIME_CACHE' })
  }

  async function copyEntrySlug(slug: string) {
    try {
      await copyTextToClipboard(slug)
      setCopiedEntrySlug(slug)
      setAdminStatus(`Entry slug copied: ${slug}`)
      window.setTimeout(() => {
        setCopiedEntrySlug((current) => current === slug ? null : current)
      }, 1600)
    } catch {
      setAdminStatus('Entry slug could not be copied.')
    }
  }

  function numberOrNull(value: string) {
    const trimmed = value.trim()
    if (!trimmed) {
      return null
    }

    const numericValue = Number(trimmed)
    return Number.isFinite(numericValue) ? numericValue : null
  }

  function patchEntryForm(patch: Partial<EntryFormState>) {
    setEntryForm((current) => ({ ...current, ...patch }))
  }

  function patchPlaceForm(patch: Partial<typeof placeForm>) {
    setPlaceForm((current) => ({ ...current, ...patch }))
  }

  function resetImageForm() {
    setMediaForm((current) => ({
      ...current,
      imageId: null,
      imageUrl: '',
      imageAlt: '',
      imageFile: null,
    }))
    setMediaInputResetKey((value) => value + 1)
  }

  function resetAudioForm() {
    setMediaForm((current) => ({
      ...current,
      audioTrackId: null,
      audioUrl: '',
      audioTitle: '',
      audioFile: null,
    }))
    setMediaInputResetKey((value) => value + 1)
  }

  function loadImageForm(image: EntryDetail['images'][number]) {
    setMediaForm((current) => ({
      ...current,
      imageId: image.id,
      imageUrl: image.url,
      imageAlt: image.altText ?? '',
      imageFile: null,
    }))
    setMediaInputResetKey((value) => value + 1)
  }

  function loadAudioForm(audioTrack: EntryDetail['audioTracks'][number]) {
    setMediaForm((current) => ({
      ...current,
      audioTrackId: audioTrack.id,
      audioUrl: audioTrack.url,
      audioTitle: audioTrack.title ?? '',
      audioFile: null,
    }))
    setMediaInputResetKey((value) => value + 1)
  }

  function patchRouteForm(patch: Partial<typeof routeForm>) {
    setRouteForm((current) => ({ ...current, ...patch }))
  }

  function resetRouteForm() {
    setRouteForm({
      id: null,
      name: '',
      routeType: 'Journey',
      spatialConfidence: 'Approximate',
      sourceNote: '',
      pointsText: '',
    })
  }

  function patchRelationshipForm(patch: Partial<typeof relationshipForm>) {
    setRelationshipForm((current) => ({ ...current, ...patch }))
  }

  function resetRelationshipForm() {
    setRelationshipForm({
      id: null,
      targetEntrySlug: '',
      relationshipType: 'RelatedTo',
      confidence: '',
      note: '',
    })
  }

  function loadRelationshipForm(relationship: AdminEntryRelationshipDetail) {
    setRelationshipForm({
      id: relationship.id,
      targetEntrySlug: relationship.targetEntrySlug,
      relationshipType: relationship.relationshipType as EntryRelationshipType,
      confidence: relationship.confidence?.toString() ?? '',
      note: relationship.note ?? '',
    })
  }

  function patchSourceForm(patch: Partial<typeof sourceForm>) {
    setSourceForm((current) => ({ ...current, ...patch }))
  }

  function resetSourceForm() {
    setSourceForm({
      sourceId: null,
      originalSupportsField: '',
      url: '',
      title: '',
      publisher: '',
      supportsField: 'General',
      note: '',
    })
  }

  function loadSourceForm(source: EntryDetail['sources'][number]) {
    setSourceForm({
      sourceId: source.sourceId,
      originalSupportsField: source.supportsField as SourceSupportKind,
      url: source.url,
      title: source.title ?? '',
      publisher: source.publisher ?? '',
      supportsField: source.supportsField as SourceSupportKind,
      note: source.note ?? '',
    })
  }

  function patchTagForm(patch: Partial<typeof tagForm>) {
    setTagForm((current) => ({ ...current, ...patch }))
  }

  function patchTimePeriodForm(patch: Partial<TimePeriodFormState>) {
    setTimePeriodForm((current) => ({ ...current, ...patch }))
  }

  function parseRoutePoints(pointsText: string) {
    return pointsText
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line, index) => {
        const [role, name, longitude, latitude, dateLabel, note] = line.split('|').map((part) => part.trim())
        return {
          name,
          slug: null,
          placeType: 'RouteStop' as PlaceType,
          spatialConfidence: routeForm.spatialConfidence,
          role: routePointRoles.includes(role as RoutePointRole) ? (role as RoutePointRole) : 'Stop',
          longitude: Number(longitude),
          latitude: Number(latitude),
          modernCountryCode: null,
          wikidataId: null,
          geoNamesId: null,
          sortOrder: index,
          dateLabel: dateLabel || null,
          note: note || null,
        }
      })
  }

  function routePointsToText(route: EntryRouteDetail) {
    return route.points
      .slice()
      .sort((first, second) => Number(first.sortOrder) - Number(second.sortOrder))
      .map((point) => {
        const longitude = typeof point.longitude === 'number' ? point.longitude.toString() : ''
        const latitude = typeof point.latitude === 'number' ? point.latitude.toString() : ''
        return [
          point.role || 'Stop',
          point.name,
          longitude,
          latitude,
          point.dateLabel ?? '',
          point.note ?? '',
        ].join(' | ')
      })
      .join('\n')
  }

  function loadRouteForm(route: EntryRouteDetail) {
    setRouteForm({
      id: route.id,
      name: route.name,
      routeType: route.routeType as RouteType,
      spatialConfidence: route.spatialConfidence as SpatialConfidence,
      sourceNote: route.sourceNote ?? '',
      pointsText: routePointsToText(route),
    })
  }

  function resetEntryForm() {
    setEntryForm({ ...defaultEntryForm, languageCode: language })
    setMediaForm({
      imageId: null,
      imageUrl: '',
      imageAlt: '',
      imageFile: null,
      audioTrackId: null,
      audioUrl: '',
      audioTitle: '',
      audioFile: null,
    })
    setMediaInputResetKey((value) => value + 1)
    setPlaceForm({
      name: '',
      slug: '',
      role: 'MainSite',
      placeType: 'Site',
      spatialConfidence: 'Approximate',
      longitude: '',
      latitude: '',
      countryCode: '',
      note: '',
      sortOrder: '0',
    })
    setRouteForm({
      id: null,
      name: '',
      routeType: 'Journey',
      spatialConfidence: 'Approximate',
      sourceNote: '',
      pointsText: '',
    })
    setRelationshipForm({
      id: null,
      targetEntrySlug: '',
      relationshipType: 'RelatedTo',
      confidence: '',
      note: '',
    })
    setSourceForm({
      sourceId: null,
      originalSupportsField: '',
      url: '',
      title: '',
      publisher: '',
      supportsField: 'General',
      note: '',
    })
    setTagForm({
      id: null,
      name: '',
      slug: '',
      tagGroup: 'topic',
      parentTagId: '',
      attachSlug: '',
    })
    setAdminEntryRoutes([])
    setAdminEntryRelationships([])
    setAdminEntrySources([])
    setAdminEntryTags([])
    setAdminEntryImages([])
    setAdminEntryAudioTracks([])
    setAdminEntryPlaces([])
    setAdminEntryTranslations([])
  }

  function loadTagForm(tag: Pick<TagListItem, 'id' | 'name' | 'slug' | 'tagGroup'> & Partial<Pick<TagListItem, 'parentTagId'>>) {
    setTagForm({
      id: tag.id,
      name: tag.name,
      slug: tag.slug,
      tagGroup: tag.tagGroup,
      parentTagId: tag.parentTagId ?? '',
      attachSlug: tag.slug,
    })
  }

  function loadTimePeriodForm(period: TimePeriodListItem) {
    setTimePeriodForm({
      id: period.id,
      name: period.name,
      slug: period.slug,
      languageCode: language,
      shortDescription: period.shortDescription ?? '',
      longDescription: '',
      periodType: period.periodType as TimePeriodType,
      parentPeriodId: period.parentPeriodId ?? '',
      startYear: period.startYear?.toString() ?? '',
      endYear: period.endYear?.toString() ?? '',
      startPrecision: 'Approximate',
      endPrecision: 'Approximate',
      sortOrder: '0',
    })
  }

  async function loadAdminEntries() {
    if (!adminToken) {
      return
    }

    setLoadingAdminEntries(true)
    const result = await apiClient.GET('/api/admin/entries', {
      headers: authHeaders(),
      params: {
        query: {
          language,
        },
      },
    })

    if (result.error || !result.data) {
      setAdminStatus('Unable to load admin entries. Check token and API logs.')
      setLoadingAdminEntries(false)
      return
    }

    setAdminEntries(result.data as AdminEntryListItem[])
    setLoadingAdminEntries(false)
  }

  async function loadAdminEntryDetail(entryId: string, requestedLanguage = language) {
    if (!adminToken) {
      return
    }

    setAdminStatus('Loading entry...')
    const result = await apiClient.GET('/api/admin/entries/{entryId}', {
      headers: authHeaders(),
      params: {
        path: {
          entryId,
        },
        query: {
          language: requestedLanguage,
        },
      },
    })

    if (result.error || !result.data) {
      setAdminStatus('Unable to load entry detail.')
      return
    }

    const detail = result.data as unknown as AdminEntryDetail
    const detailRoutes = detail.routes ?? []
    const detailRelationships = detail.relationships ?? []
    const detailSources = detail.sources ?? []
    const detailTags = detail.tags ?? []
    const detailImages = detail.images ?? []
    const detailAudioTracks = detail.audioTracks ?? []
    const detailPlaces = detail.places ?? []
    const detailTranslations = detail.translations ?? []
    setEntryForm({
      id: detail.id,
      title: detail.title,
      slug: detail.slug,
      languageCode: detail.languageCode ?? language,
      summary: detail.summary ?? '',
      description: detail.description ?? '',
      whyItMatters: detail.whyItMatters ?? '',
      datingNote: detail.datingNote ?? '',
      kind: detail.kind as EntryKind,
      iconKey: detail.iconKey ?? '',
      status: detail.status as ContentStatus,
      realityStatus: detail.realityStatus as RealityStatus,
      dateLabel: detail.dateLabel ?? '',
      startYear: detail.startYear?.toString() ?? '',
      endYear: detail.endYear?.toString() ?? '',
      timePrecision: (detail.timePrecision as TimePrecision | null) ?? '',
      timeConfidence: detail.timeConfidence ?? '',
      primaryTimePeriodId: detail.primaryTimePeriodId ?? '',
    })
    setAdminEntryRoutes(detailRoutes)
    setAdminEntryRelationships(detailRelationships)
    setAdminEntrySources(detailSources)
    setAdminEntryTags(detailTags)
    setAdminEntryImages(detailImages)
    setAdminEntryAudioTracks(detailAudioTracks)
    setAdminEntryPlaces(detailPlaces)
    setAdminEntryTranslations(detailTranslations)
    setMediaForm((current) => {
      const image = current.imageId ? detailImages.find((item) => item.id === current.imageId) : null
      const audioTrack = current.audioTrackId
        ? detailAudioTracks.find((item) => item.id === current.audioTrackId)
        : null

      return {
        imageId: image?.id ?? null,
        imageUrl: image?.url ?? '',
        imageAlt: image?.altText ?? '',
        imageFile: null,
        audioTrackId: audioTrack?.id ?? null,
        audioUrl: audioTrack?.url ?? '',
        audioTitle: audioTrack?.title ?? '',
        audioFile: null,
      }
    })
    setMediaInputResetKey((value) => value + 1)
    setRouteForm((current) => {
      if (!current.id) {
        return current
      }

      const route = detailRoutes.find((item) => item.id === current.id)
      return route
        ? {
            id: route.id,
            name: route.name,
            routeType: route.routeType as RouteType,
            spatialConfidence: route.spatialConfidence as SpatialConfidence,
            sourceNote: route.sourceNote ?? '',
            pointsText: routePointsToText(route),
          }
        : {
            id: null,
            name: '',
            routeType: 'Journey',
            spatialConfidence: 'Approximate',
            sourceNote: '',
            pointsText: '',
          }
    })
    setRelationshipForm((current) => {
      if (!current.id) {
        return current
      }

      const relationship = detailRelationships.find((item) => item.id === current.id)
      return relationship
        ? {
            id: relationship.id,
            targetEntrySlug: relationship.targetEntrySlug,
            relationshipType: relationship.relationshipType as EntryRelationshipType,
            confidence: relationship.confidence?.toString() ?? '',
            note: relationship.note ?? '',
          }
        : {
            id: null,
            targetEntrySlug: '',
            relationshipType: 'RelatedTo',
            confidence: '',
            note: '',
          }
    })
    setSourceForm((current) => {
      if (!current.sourceId || !current.originalSupportsField) {
        return current
      }

      const source = detailSources.find(
        (item) => item.sourceId === current.sourceId && item.supportsField === current.originalSupportsField,
      )
      return source
        ? {
            sourceId: source.sourceId,
            originalSupportsField: source.supportsField as SourceSupportKind,
            url: source.url,
            title: source.title ?? '',
            publisher: source.publisher ?? '',
            supportsField: source.supportsField as SourceSupportKind,
            note: source.note ?? '',
          }
        : {
            sourceId: null,
            originalSupportsField: '',
            url: '',
            title: '',
            publisher: '',
            supportsField: 'General',
            note: '',
          }
    })
    setAdminStatus('Entry loaded.')
  }

  async function switchEntryLanguage(languageCode: string) {
    if (entryForm.id) {
      await loadAdminEntryDetail(entryForm.id, languageCode)
      return
    }

    patchEntryForm({ languageCode })
  }

  async function signInAdmin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setAdminStatus('Signing in...')

    const result = await apiClient.POST('/api/auth/login', {
      body: {
        email: adminEmail,
        password: adminPassword,
      },
    })

    if (result.error || !result.data?.accessToken) {
      setAdminStatus('Sign in failed. Check admin email/password and Render API logs.')
      return
    }

    setAdminSession(createAdminSession(result.data))
    setAdminPassword('')
    setAdminStatus('Signed in. Select an admin section.')
  }

  function signOutAdmin() {
    setAdminSession(null)
    setAdminPassword('')
    setAdminEntries([])
    resetEntryForm()
    setContentPackagePreview(null)
    setContentPackageResult(null)
    setContentPackageUploadProgress(null)
    setContentPackageBatchItems([])
    setAdminStatus('Signed out.')
  }

  async function previewContentPackage() {
    if (!adminToken) {
      setAdminStatus('Sign in before previewing a content package.')
      return
    }

    if (contentPackageFiles.length === 0) {
      setAdminStatus('Choose a content package .zip file first.')
      return
    }

    const formData = new FormData()
    formData.append('file', contentPackageFiles[0])
    formData.append('publishImportedEntries', 'true')
    formData.append('updateExistingRows', clearContentPackageBeforeImport ? 'false' : 'true')
    formData.append('clearExistingData', clearContentPackageBeforeImport ? 'true' : 'false')

    setPreviewingContentPackage(true)
    setContentPackageUploadProgress(null)
    setAdminStatus('Reading content package preview...')
    try {
      const response = await fetch(`${apiBaseUrl}/api/admin/imports/content-package/preview`, {
        method: 'POST',
        headers: authHeaders(),
        credentials: 'include',
        body: formData,
      })

      if (!response.ok) {
        setAdminStatus(`Content package preview failed with HTTP ${response.status}.`)
        return
      }

      const result = (await response.json()) as ContentPackageImportPreviewResult
      setContentPackagePreview(result)
      setContentPackageResult(null)
      const cleanImportStatus = result.willClearExistingData
        ? ` Clean import would delete ${result.existingEntriesToDelete} existing entries first.`
        : ''
      const multiFileNote =
        contentPackageFiles.length > 1 ? ` Showing preview for the first of ${contentPackageFiles.length} selected files.` : ''
      setAdminStatus(
        `Package preview: ${result.entriesRead} entries, ${result.entriesToCreate} new, ${result.entriesToUpdate} updates, ${result.audioFilesToAttach} audio files.${cleanImportStatus}${multiFileNote}`,
      )
    } catch {
      setAdminStatus('Content package preview failed. Check API availability and CORS settings.')
    } finally {
      setPreviewingContentPackage(false)
    }
  }

  async function importContentPackage() {
    if (!adminToken) {
      setAdminStatus('Sign in before importing a content package.')
      return
    }

    if (contentPackageFiles.length === 0) {
      setAdminStatus('Choose at least one content package .zip file first.')
      return
    }

    if (
      clearContentPackageBeforeImport &&
      !window.confirm('Clean import will delete all existing content data before importing the first package. Continue?')
    ) {
      setAdminStatus('Content package import cancelled.')
      return
    }

    const files = contentPackageFiles
    // Only the first request in the batch may clear existing data, otherwise it would wipe out
    // the packages already imported earlier in this same run.
    const shouldClearBeforeFirstFile = clearContentPackageBeforeImport

    setImportingContentPackage(true)
    setContentPackageResult(null)
    setContentPackagePreview(null)
    setContentPackageBatchItems(files.map((file) => ({ name: file.name, status: 'pending' })))
    setClearContentPackageBeforeImport(false)

    let lastResult: ContentPackageImportResult | null = null
    let importedCount = 0
    let failedCount = 0

    for (let index = 0; index < files.length; index += 1) {
      const file = files[index]
      const clearBeforeThisFile = index === 0 && shouldClearBeforeFirstFile

      setContentPackageBatchItems((items) =>
        items.map((item, itemIndex) => (itemIndex === index ? { ...item, status: 'uploading' } : item)),
      )
      setContentPackageUploadProgress(
        createUploadProgressState('uploading', 0, file.size || null, `Preparing upload for ${file.name}...`),
      )
      setAdminStatus(`Importing package ${index + 1} of ${files.length}: ${file.name}...`)

      const formData = new FormData()
      formData.append('file', file)
      formData.append('publishImportedEntries', 'true')
      formData.append('updateExistingRows', clearBeforeThisFile ? 'false' : 'true')
      formData.append('clearExistingData', clearBeforeThisFile ? 'true' : 'false')

      try {
        const result = await uploadContentPackageWithProgress(
          formData,
          authHeaders(),
          (progress) => {
            setContentPackageUploadProgress(progress)
            if (progress.phase === 'processing') {
              setContentPackageBatchItems((items) =>
                items.map((item, itemIndex) => (itemIndex === index ? { ...item, status: 'processing' } : item)),
              )
            }
          },
          clearBeforeThisFile
            ? 'Upload complete. Clearing current content and importing package...'
            : 'Upload complete. Importing package on server...',
        )

        lastResult = result
        importedCount += 1
        const cleanImportStatus = result.clearedExistingData
          ? ` Deleted ${result.entriesDeletedBeforeImport} existing entries first.`
          : ''
        setContentPackageBatchItems((items) =>
          items.map((item, itemIndex) =>
            itemIndex === index
              ? {
                  ...item,
                  status: 'done',
                  message: `${result.entriesCreated} created, ${result.entriesUpdated} updated. ${result.title || result.packageSlug || result.fileName}.${cleanImportStatus}`,
                }
              : item,
          ),
        )
        setReloadKey((value) => value + 1)
        void loadContentPackageImportHistory()
      } catch (error) {
        failedCount += 1
        const message = error instanceof Error ? error.message : 'Import failed.'
        setContentPackageBatchItems((items) =>
          items.map((item, itemIndex) => (itemIndex === index ? { ...item, status: 'error', message } : item)),
        )
      }
    }

    setContentPackageResult(lastResult)
    setContentPackageUploadProgress(
      failedCount > 0
        ? createUploadProgressState('error', 0, null, `${importedCount} of ${files.length} packages imported, ${failedCount} failed.`)
        : createUploadProgressState('complete', 0, null, `Import done. ${importedCount} of ${files.length} packages imported.`),
    )
    setAdminStatus(
      failedCount > 0
        ? `Imported ${importedCount} of ${files.length} packages. ${failedCount} failed - check details below.`
        : `Imported ${importedCount} of ${files.length} package${files.length === 1 ? '' : 's'} successfully.`,
    )
    setImportingContentPackage(false)
  }

  async function saveEntry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!adminToken) {
      setAdminStatus('Sign in before saving content.')
      return
    }

    if (!entryForm.title.trim()) {
      setAdminStatus('Title is required.')
      return
    }

    const body: AdminEntryUpsertRequest = {
      title: entryForm.title.trim(),
      slug: entryForm.slug.trim() || null,
      languageCode: entryForm.languageCode || language,
      summary: entryForm.summary.trim() || null,
      description: entryForm.description.trim() || null,
      whyItMatters: entryForm.whyItMatters.trim() || null,
      datingNote: entryForm.datingNote.trim() || null,
      kind: entryForm.kind,
      status: entryForm.status,
      realityStatus: entryForm.realityStatus,
      iconKey: entryForm.iconKey.trim() || null,
      dateLabel: entryForm.dateLabel.trim() || null,
      startYear: numberOrNull(entryForm.startYear),
      startMonth: null,
      startDay: null,
      endYear: numberOrNull(entryForm.endYear),
      endMonth: null,
      endDay: null,
      timePrecision: entryForm.timePrecision || null,
      timeConfidence: entryForm.timeConfidence.trim() || null,
      primaryTimePeriodId: entryForm.primaryTimePeriodId || null,
    }

    setAdminStatus(entryForm.id ? 'Saving entry...' : 'Creating entry...')
    const result = entryForm.id
      ? await apiClient.PUT('/api/admin/entries/{entryId}', {
          headers: authHeaders(),
          params: {
            path: {
              entryId: entryForm.id,
            },
          },
          body,
        })
      : await apiClient.POST('/api/admin/entries', {
          headers: authHeaders(),
          body,
        })

    if (result.error) {
      setAdminStatus('Entry save failed. Check required fields and API logs.')
      return
    }

    const createdId = 'data' in result && result.data?.id ? result.data.id : entryForm.id
    setAdminStatus(entryForm.id ? 'Entry saved.' : 'Entry created.')
    setReloadKey((value) => value + 1)
    if (createdId) {
      await loadAdminEntryDetail(createdId)
    } else {
      resetEntryForm()
    }
  }

  async function savePrimaryImage() {
    if (!entryForm.id || !adminToken) {
      setAdminStatus('Select or create an entry before saving an image.')
      return
    }

    if (!mediaForm.imageUrl.trim()) {
      setAdminStatus('Image URL is required.')
      return
    }

    const body: AdminEntryImageRequest = {
      kind: 'Primary',
      storageProvider: 'ExternalUrl',
      storageKey: null,
      publicUrl: mediaForm.imageUrl.trim(),
      mediaType: null,
      width: null,
      height: null,
      sortOrder: 0,
      isPrimary: true,
      attribution: null,
      license: null,
      sourceUrl: null,
      languageCode: entryForm.languageCode,
      altText: mediaForm.imageAlt.trim() || entryForm.title,
      caption: null,
    }

    setAdminStatus(mediaForm.imageId ? 'Saving image...' : 'Adding image...')
    const result = mediaForm.imageId
      ? await apiClient.PUT('/api/admin/entries/{entryId}/images/{imageId}', {
          headers: authHeaders(),
          params: {
            path: {
              entryId: entryForm.id,
              imageId: mediaForm.imageId,
            },
          },
          body,
        })
      : await apiClient.POST('/api/admin/entries/{entryId}/images', {
          headers: authHeaders(),
          params: {
            path: {
              entryId: entryForm.id,
            },
          },
          body,
        })

    if (result.error) {
      setAdminStatus('Image was not saved.')
      return
    }

    resetImageForm()
    setAdminStatus(mediaForm.imageId ? 'Image saved.' : 'Image added.')
    setReloadKey((value) => value + 1)
    await loadAdminEntryDetail(entryForm.id)
  }

  async function uploadPrimaryImageFile() {
    if (!entryForm.id || !adminToken) {
      setAdminStatus('Select or create an entry before uploading an image.')
      return
    }

    if (!mediaForm.imageFile) {
      setAdminStatus('Choose an image file first.')
      return
    }

    const formData = new FormData()
    formData.append('file', mediaForm.imageFile)
    formData.append('languageCode', entryForm.languageCode)
    formData.append('altText', mediaForm.imageAlt.trim() || entryForm.title)

    setAdminStatus('Uploading image...')
    const response = await fetch(`${apiBaseUrl}/api/admin/entries/${entryForm.id}/images/upload`, {
      method: 'POST',
      headers: authHeaders(),
      credentials: 'include',
      body: formData,
    })

    if (!response.ok) {
      setAdminStatus('Image upload failed.')
      return
    }

    resetImageForm()
    setAdminStatus('Image uploaded.')
    setReloadKey((value) => value + 1)
    await loadAdminEntryDetail(entryForm.id)
  }

  async function deleteEntryImage(imageId: string) {
    if (!entryForm.id || !adminToken) {
      setAdminStatus('Select an entry before deleting an image.')
      return
    }

    setAdminStatus('Deleting image...')
    const result = await apiClient.DELETE('/api/admin/entries/{entryId}/images/{imageId}', {
      headers: authHeaders(),
      params: {
        path: {
          entryId: entryForm.id,
          imageId,
        },
      },
    })

    if (result.error) {
      setAdminStatus('Image was not deleted.')
      return
    }

    if (mediaForm.imageId === imageId) {
      resetImageForm()
    }

    setAdminStatus('Image deleted.')
    setReloadKey((value) => value + 1)
    await loadAdminEntryDetail(entryForm.id)
  }

  async function savePrimaryAudio() {
    if (!entryForm.id || !adminToken) {
      setAdminStatus('Select or create an entry before saving audio.')
      return
    }

    if (!mediaForm.audioUrl.trim()) {
      setAdminStatus('Audio URL is required.')
      return
    }

    const body: AdminEntryAudioTrackRequest = {
      kind: 'Narration',
      storageProvider: 'ExternalUrl',
      storageKey: null,
      publicUrl: mediaForm.audioUrl.trim(),
      mediaType: null,
      durationSeconds: null,
      sortOrder: 0,
      isPrimary: true,
      languageCode: entryForm.languageCode,
      title: mediaForm.audioTitle.trim() || entryForm.title,
      transcript: null,
      attribution: null,
      license: null,
      sourceUrl: null,
    }

    setAdminStatus(mediaForm.audioTrackId ? 'Saving audio...' : 'Adding audio...')
    const result = mediaForm.audioTrackId
      ? await apiClient.PUT('/api/admin/entries/{entryId}/audio-tracks/{audioTrackId}', {
          headers: authHeaders(),
          params: {
            path: {
              entryId: entryForm.id,
              audioTrackId: mediaForm.audioTrackId,
            },
          },
          body,
        })
      : await apiClient.POST('/api/admin/entries/{entryId}/audio-tracks', {
          headers: authHeaders(),
          params: {
            path: {
              entryId: entryForm.id,
            },
          },
          body,
        })

    if (result.error) {
      setAdminStatus('Audio was not saved.')
      return
    }

    resetAudioForm()
    setAdminStatus(mediaForm.audioTrackId ? 'Audio saved.' : 'Audio added.')
    setReloadKey((value) => value + 1)
    await loadAdminEntryDetail(entryForm.id)
  }

  async function uploadPrimaryAudioFile() {
    if (!entryForm.id || !adminToken) {
      setAdminStatus('Select or create an entry before uploading audio.')
      return
    }

    if (!mediaForm.audioFile) {
      setAdminStatus('Choose an audio file first.')
      return
    }

    const formData = new FormData()
    formData.append('file', mediaForm.audioFile)
    formData.append('languageCode', entryForm.languageCode)
    formData.append('title', mediaForm.audioTitle.trim() || entryForm.title)

    setAdminStatus('Uploading audio...')
    const response = await fetch(`${apiBaseUrl}/api/admin/entries/${entryForm.id}/audio-tracks/upload`, {
      method: 'POST',
      headers: authHeaders(),
      credentials: 'include',
      body: formData,
    })

    if (!response.ok) {
      setAdminStatus('Audio upload failed.')
      return
    }

    resetAudioForm()
    setAdminStatus('Audio uploaded.')
    setReloadKey((value) => value + 1)
    await loadAdminEntryDetail(entryForm.id)
  }

  async function previewBulkAudioZip() {
    if (!adminToken) {
      setAdminStatus('Sign in before previewing bulk audio.')
      return
    }

    if (!bulkAudioFile) {
      setAdminStatus('Choose an audio .zip file first.')
      return
    }

    const formData = new FormData()
    formData.append('file', bulkAudioFile)
    formData.append('languageCode', bulkAudioLanguage)

    setBulkAudioPreviewing(true)
    setAdminStatus('Previewing bulk audio zip...')
    try {
      const response = await fetch(`${apiBaseUrl}/api/admin/audio-tracks/bulk-upload/preview`, {
        method: 'POST',
        headers: authHeaders(),
        credentials: 'include',
        body: formData,
      })

      if (!response.ok) {
        setAdminStatus(`Bulk audio preview failed with HTTP ${response.status}.`)
        return
      }

      const result = (await response.json()) as BulkAudioUploadPreviewResult
      setBulkAudioPreview(result)
      setBulkAudioResult(null)
      setAdminStatus(
        `Bulk audio preview: ${result.entriesMatched} matched, ${result.entriesMissing} missing entries from ${result.filesRead} files.`,
      )
    } catch {
      setAdminStatus('Bulk audio preview failed. Check API availability and CORS settings.')
    } finally {
      setBulkAudioPreviewing(false)
    }
  }

  async function uploadBulkAudioZip() {
    if (!adminToken) {
      setAdminStatus('Sign in before uploading bulk audio.')
      return
    }

    if (!bulkAudioFile) {
      setAdminStatus('Choose an audio .zip file first.')
      return
    }

    const formData = new FormData()
    formData.append('file', bulkAudioFile)
    formData.append('languageCode', bulkAudioLanguage)

    setBulkAudioUploading(true)
    setAdminStatus('Uploading bulk audio zip...')
    try {
      const response = await fetch(`${apiBaseUrl}/api/admin/audio-tracks/bulk-upload`, {
        method: 'POST',
        headers: authHeaders(),
        credentials: 'include',
        body: formData,
      })

      if (!response.ok) {
        setAdminStatus(`Bulk audio upload failed with HTTP ${response.status}.`)
        return
      }

      const result = (await response.json()) as BulkAudioUploadResult
      setBulkAudioResult(result)
      setBulkAudioPreview(null)
      setAdminStatus(
        `Bulk audio uploaded: ${result.tracksCreated} created, ${result.tracksUpdated} updated, ${result.entriesMissing} missing entries.`,
      )
      setReloadKey((value) => value + 1)
      if (entryForm.id) {
        await loadAdminEntryDetail(entryForm.id)
      }
    } catch {
      setAdminStatus('Bulk audio upload failed. Check API availability and CORS settings.')
    } finally {
      setBulkAudioUploading(false)
    }
  }

  async function deleteEntryAudioTrack(audioTrackId: string) {
    if (!entryForm.id || !adminToken) {
      setAdminStatus('Select an entry before deleting audio.')
      return
    }

    setAdminStatus('Deleting audio...')
    const result = await apiClient.DELETE('/api/admin/entries/{entryId}/audio-tracks/{audioTrackId}', {
      headers: authHeaders(),
      params: {
        path: {
          entryId: entryForm.id,
          audioTrackId,
        },
      },
    })

    if (result.error) {
      setAdminStatus('Audio was not deleted.')
      return
    }

    if (mediaForm.audioTrackId === audioTrackId) {
      resetAudioForm()
    }

    setAdminStatus('Audio deleted.')
    setReloadKey((value) => value + 1)
    await loadAdminEntryDetail(entryForm.id)
  }

  async function addEntryPlace() {
    if (!entryForm.id || !adminToken) {
      setAdminStatus('Select or create an entry before adding a place.')
      return
    }

    const longitude = Number(placeForm.longitude)
    const latitude = Number(placeForm.latitude)
    if (!placeForm.name.trim() || !Number.isFinite(longitude) || !Number.isFinite(latitude)) {
      setAdminStatus('Place name, longitude and latitude are required.')
      return
    }

    const body: AdminEntryPlaceRequest = {
      name: placeForm.name.trim(),
      slug: placeForm.slug.trim() || null,
      languageCode: entryForm.languageCode,
      placeType: placeForm.placeType,
      role: placeForm.role,
      spatialConfidence: placeForm.spatialConfidence,
      longitude,
      latitude,
      modernCountryCode: placeForm.countryCode.trim() || null,
      wikidataId: null,
      geoNamesId: null,
      sortOrder: numberOrNull(placeForm.sortOrder) ?? 0,
      note: placeForm.note.trim() || null,
    }

    const result = await apiClient.POST('/api/admin/entries/{entryId}/places', {
      headers: authHeaders(),
      params: {
        path: {
          entryId: entryForm.id,
        },
      },
      body,
    })

    if (result.error) {
      setAdminStatus('Place was not added.')
      return
    }

    setPlaceForm((current) => ({
      ...current,
      name: '',
      slug: '',
      longitude: '',
      latitude: '',
      countryCode: '',
      note: '',
    }))
    setAdminStatus('Place added.')
    setReloadKey((value) => value + 1)
  }

  async function saveEntryRoute() {
    if (!entryForm.id || !adminToken) {
      setAdminStatus('Select or create an entry before saving a route.')
      return
    }

    const points = parseRoutePoints(routeForm.pointsText)
    if (!routeForm.name.trim() || points.length < 2) {
      setAdminStatus('Route name and at least two route points are required.')
      return
    }

    if (points.some((point) => !point.name || !Number.isFinite(point.longitude) || !Number.isFinite(point.latitude))) {
      setAdminStatus('Every route point needs role, name, longitude and latitude.')
      return
    }

    const body: AdminEntryRouteRequest = {
      name: routeForm.name.trim(),
      routeType: routeForm.routeType,
      spatialConfidence: routeForm.spatialConfidence,
      sourceNote: routeForm.sourceNote.trim() || null,
      languageCode: entryForm.languageCode,
      points,
    }

    setAdminStatus(routeForm.id ? 'Saving route...' : 'Adding route...')
    const result = routeForm.id
      ? await apiClient.PUT('/api/admin/entries/{entryId}/routes/{routeId}', {
          headers: authHeaders(),
          params: {
            path: {
              entryId: entryForm.id,
              routeId: routeForm.id,
            },
          },
          body,
        })
      : await apiClient.POST('/api/admin/entries/{entryId}/routes', {
          headers: authHeaders(),
          params: {
            path: {
              entryId: entryForm.id,
            },
          },
          body,
        })

    if (result.error) {
      setAdminStatus('Route was not saved.')
      return
    }

    resetRouteForm()
    setAdminStatus(routeForm.id ? 'Route saved.' : 'Route added.')
    setReloadKey((value) => value + 1)
    await loadAdminEntryDetail(entryForm.id)
  }

  async function deleteEntryRoute(routeId: string) {
    if (!entryForm.id || !adminToken) {
      setAdminStatus('Select an entry before deleting a route.')
      return
    }

    setAdminStatus('Deleting route...')
    const result = await apiClient.DELETE('/api/admin/entries/{entryId}/routes/{routeId}', {
      headers: authHeaders(),
      params: {
        path: {
          entryId: entryForm.id,
          routeId,
        },
      },
    })

    if (result.error) {
      setAdminStatus('Route was not deleted.')
      return
    }

    if (routeForm.id === routeId) {
      resetRouteForm()
    }

    setAdminStatus('Route deleted.')
    setReloadKey((value) => value + 1)
    await loadAdminEntryDetail(entryForm.id)
  }

  async function saveEntryRelationship() {
    if (!entryForm.id || !adminToken) {
      setAdminStatus('Select or create an entry before saving a relationship.')
      return
    }

    if (!relationshipForm.targetEntrySlug.trim()) {
      setAdminStatus('Target entry slug is required.')
      return
    }

    const confidence = relationshipForm.confidence.trim()
      ? Number(relationshipForm.confidence)
      : null
    if (confidence !== null && (!Number.isFinite(confidence) || confidence < 0 || confidence > 1)) {
      setAdminStatus('Confidence must be between 0 and 1.')
      return
    }

    const body: AdminEntryRelationshipRequest = {
      targetEntrySlug: relationshipForm.targetEntrySlug.trim(),
      relationshipType: relationshipForm.relationshipType,
      confidence,
      note: relationshipForm.note.trim() || null,
    }

    setAdminStatus(relationshipForm.id ? 'Saving relationship...' : 'Adding relationship...')
    const result = relationshipForm.id
      ? await apiClient.PUT('/api/admin/entries/{entryId}/relationships/{relationshipId}', {
          headers: authHeaders(),
          params: {
            path: {
              entryId: entryForm.id,
              relationshipId: relationshipForm.id,
            },
          },
          body,
        })
      : await apiClient.POST('/api/admin/entries/{entryId}/relationships', {
          headers: authHeaders(),
          params: {
            path: {
              entryId: entryForm.id,
            },
          },
          body,
        })

    if (result.error) {
      setAdminStatus('Relationship was not saved. Check target slug.')
      return
    }

    resetRelationshipForm()
    setAdminStatus(relationshipForm.id ? 'Relationship saved.' : 'Relationship added.')
    setReloadKey((value) => value + 1)
    await loadAdminEntryDetail(entryForm.id)
  }

  async function deleteEntryRelationship(relationshipId: string) {
    if (!entryForm.id || !adminToken) {
      setAdminStatus('Select an entry before deleting a relationship.')
      return
    }

    setAdminStatus('Deleting relationship...')
    const result = await apiClient.DELETE('/api/admin/entries/{entryId}/relationships/{relationshipId}', {
      headers: authHeaders(),
      params: {
        path: {
          entryId: entryForm.id,
          relationshipId,
        },
      },
    })

    if (result.error) {
      setAdminStatus('Relationship was not deleted.')
      return
    }

    if (relationshipForm.id === relationshipId) {
      resetRelationshipForm()
    }

    setAdminStatus('Relationship deleted.')
    setReloadKey((value) => value + 1)
    await loadAdminEntryDetail(entryForm.id)
  }

  async function saveEntrySource() {
    if (!entryForm.id || !adminToken) {
      setAdminStatus('Select or create an entry before saving a source.')
      return
    }

    if (!sourceForm.url.trim()) {
      setAdminStatus('Source URL is required.')
      return
    }

    const body: AdminEntrySourceRequest = {
      url: sourceForm.url.trim(),
      title: sourceForm.title.trim() || null,
      publisher: sourceForm.publisher.trim() || null,
      languageCode: entryForm.languageCode,
      supportsField: sourceForm.supportsField,
      note: sourceForm.note.trim() || null,
    }

    setAdminStatus(sourceForm.sourceId ? 'Saving source...' : 'Adding source...')
    const result = sourceForm.sourceId && sourceForm.originalSupportsField
      ? await apiClient.PUT('/api/admin/entries/{entryId}/sources/{sourceId}/{supportsField}', {
          headers: authHeaders(),
          params: {
            path: {
              entryId: entryForm.id,
              sourceId: sourceForm.sourceId,
              supportsField: sourceForm.originalSupportsField,
            },
          },
          body,
        })
      : await apiClient.POST('/api/admin/entries/{entryId}/sources', {
          headers: authHeaders(),
          params: {
            path: {
              entryId: entryForm.id,
            },
          },
          body,
        })

    if (result.error) {
      setAdminStatus('Source was not saved. Check URL format.')
      return
    }

    resetSourceForm()
    setAdminStatus(sourceForm.sourceId ? 'Source saved.' : 'Source added.')
    setReloadKey((value) => value + 1)
    await loadAdminEntryDetail(entryForm.id)
  }

  async function deleteEntrySource(sourceId: string, supportsField: string) {
    if (!entryForm.id || !adminToken) {
      setAdminStatus('Select an entry before deleting a source.')
      return
    }

    setAdminStatus('Deleting source...')
    const result = await apiClient.DELETE('/api/admin/entries/{entryId}/sources/{sourceId}/{supportsField}', {
      headers: authHeaders(),
      params: {
        path: {
          entryId: entryForm.id,
          sourceId,
          supportsField,
        },
      },
    })

    if (result.error) {
      setAdminStatus('Source was not deleted.')
      return
    }

    if (sourceForm.sourceId === sourceId && sourceForm.originalSupportsField === supportsField) {
      resetSourceForm()
    }

    setAdminStatus('Source deleted.')
    setReloadKey((value) => value + 1)
    await loadAdminEntryDetail(entryForm.id)
  }

  async function saveTimePeriod(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!adminToken) {
      setAdminStatus('Sign in before saving a time period.')
      return
    }

    if (!timePeriodForm.name.trim()) {
      setAdminStatus('Time period name is required.')
      return
    }

    const body: AdminTimePeriodUpsertRequest = {
      name: timePeriodForm.name.trim(),
      slug: timePeriodForm.slug.trim() || null,
      languageCode: timePeriodForm.languageCode || language,
      shortDescription: timePeriodForm.shortDescription.trim() || null,
      longDescription: timePeriodForm.longDescription.trim() || null,
      periodType: timePeriodForm.periodType,
      parentPeriodId: timePeriodForm.parentPeriodId || null,
      startYear: numberOrNull(timePeriodForm.startYear),
      endYear: numberOrNull(timePeriodForm.endYear),
      startPrecision: timePeriodForm.startPrecision,
      endPrecision: timePeriodForm.endPrecision,
      sortOrder: numberOrNull(timePeriodForm.sortOrder) ?? 0,
    }

    const result = timePeriodForm.id
      ? await apiClient.PUT('/api/admin/time-periods/{timePeriodId}', {
          headers: authHeaders(),
          params: {
            path: {
              timePeriodId: timePeriodForm.id,
            },
          },
          body,
        })
      : await apiClient.POST('/api/admin/time-periods', {
          headers: authHeaders(),
          body,
        })

    if (result.error) {
      setAdminStatus('Time period save failed.')
      return
    }

    setAdminStatus(timePeriodForm.id ? 'Time period saved.' : 'Time period created.')
    setTimePeriodForm({ ...defaultTimePeriodForm, languageCode: language })
    setReloadKey((value) => value + 1)
  }

  async function deleteTimePeriod() {
    if (!timePeriodForm.id || !adminToken) {
      setAdminStatus('Select a time period before deleting it.')
      return
    }

    setAdminStatus('Deleting time period...')
    const result = await apiClient.DELETE('/api/admin/time-periods/{timePeriodId}', {
      headers: authHeaders(),
      params: {
        path: {
          timePeriodId: timePeriodForm.id,
        },
      },
    })

    if (result.error) {
      setAdminStatus('Time period was not deleted. Remove child periods and entry links first.')
      return
    }

    setTimePeriodForm({ ...defaultTimePeriodForm, languageCode: language })
    setAdminStatus('Time period deleted.')
    setReloadKey((value) => value + 1)
  }

  async function saveTag(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!adminToken) {
      setAdminStatus('Sign in before saving a tag.')
      return
    }

    if (!tagForm.name.trim()) {
      setAdminStatus('Tag name is required.')
      return
    }

    const body: AdminTagUpsertRequest = {
      name: tagForm.name.trim(),
      slug: tagForm.slug.trim() || null,
      languageCode: language,
      tagGroup: tagForm.tagGroup.trim() || 'topic',
      parentTagId: tagForm.parentTagId || null,
    }

    const result = tagForm.id
      ? await apiClient.PUT('/api/admin/tags/{tagId}', {
          headers: authHeaders(),
          params: {
            path: {
              tagId: tagForm.id,
            },
          },
          body,
        })
      : await apiClient.POST('/api/admin/tags', {
          headers: authHeaders(),
          body,
        })

    if (result.error) {
      setAdminStatus('Tag save failed.')
      return
    }

    setAdminStatus(tagForm.id ? 'Tag saved.' : 'Tag created.')
    setTagForm({
      id: null,
      name: '',
      slug: '',
      tagGroup: 'topic',
      parentTagId: '',
      attachSlug: '',
    })
    setReloadKey((value) => value + 1)
  }

  async function attachTagToEntry() {
    if (!entryForm.id || !adminToken) {
      setAdminStatus('Select or create an entry before attaching a tag.')
      return
    }

    if (!tagForm.attachSlug.trim()) {
      setAdminStatus('Choose a tag before attaching it.')
      return
    }

    const body: AdminEntryTagRequest = {
      tagSlug: tagForm.attachSlug.trim(),
    }

    const result = await apiClient.POST('/api/admin/entries/{entryId}/tags', {
      headers: authHeaders(),
      params: {
        path: {
          entryId: entryForm.id,
        },
      },
      body,
    })

    if (result.error) {
      setAdminStatus('Tag was not attached.')
      return
    }

    setAdminStatus('Tag attached.')
    setReloadKey((value) => value + 1)
    await loadAdminEntryDetail(entryForm.id)
  }

  async function detachTagFromEntry(tagId: string) {
    if (!entryForm.id || !adminToken) {
      setAdminStatus('Select an entry before detaching a tag.')
      return
    }

    setAdminStatus('Detaching tag...')
    const result = await apiClient.DELETE('/api/admin/entries/{entryId}/tags/{tagId}', {
      headers: authHeaders(),
      params: {
        path: {
          entryId: entryForm.id,
          tagId,
        },
      },
    })

    if (result.error) {
      setAdminStatus('Tag was not detached.')
      return
    }

    setAdminStatus('Tag detached.')
    setReloadKey((value) => value + 1)
    await loadAdminEntryDetail(entryForm.id)
  }

  async function deleteTag() {
    if (!tagForm.id || !adminToken) {
      setAdminStatus('Select a tag before deleting it.')
      return
    }

    setAdminStatus('Deleting tag...')
    const result = await apiClient.DELETE('/api/admin/tags/{tagId}', {
      headers: authHeaders(),
      params: {
        path: {
          tagId: tagForm.id,
        },
      },
    })

    if (result.error) {
      setAdminStatus('Tag was not deleted. Detach it from entries and remove child tags first.')
      return
    }

    setTagForm({
      id: null,
      name: '',
      slug: '',
      tagGroup: 'topic',
      parentTagId: '',
      attachSlug: '',
    })
    setAdminStatus('Tag deleted.')
    setReloadKey((value) => value + 1)
  }

  function openAdminPanel() {
    setEntryDetailOpen(false)
    setFilterPanelOpen(false)
    setAdminOpen((value) => !value)
  }

  function openFiltersPanel() {
    setAdminOpen(false)
    setEntryDetailOpen(false)
    setFilterPanelOpen(true)
  }

  function toggleTheme() {
    setTheme((current) => (current === 'dark' ? 'light' : 'dark'))
  }

  const shellControlProps = {
    labels: {
      language: ui.language,
      openAdminPanel: ui.openAdminPanel,
      openFilters: ui.openFilters,
      playRandom: ui.playRandom,
      switchToDarkMode: ui.switchToDarkMode,
      switchToLightMode: ui.switchToLightMode,
    },
    language,
    onLanguageChange: setLanguage,
    onOpenAdminPanel: openAdminPanel,
    onOpenFilters: openFiltersPanel,
    onPlayRandom: () => playRandomEntry(),
    onToggleTheme: toggleTheme,
    playableRandomEntryCount: playableRandomEntries.length,
    theme,
  }

  const adminPanelProps = {
    addEntryPlace,
    adminEmail,
    adminEntries,
    adminEntryAudioTracks,
    adminEntryImages,
    adminEntryPlaces,
    adminEntryRelationships,
    adminEntryRoutes,
    adminEntrySources,
    adminEntryTags,
    adminEntryTranslations,
    adminPage,
    adminPages,
    adminPassword,
    adminStatus,
    adminToken,
    attachTagToEntry,
    bulkAudioLanguage,
    bulkAudioPreview,
    bulkAudioResult,
    clearContentPackageBeforeImport,
    contentLanguages,
    contentPackageBatchItems,
    contentPackageFiles,
    contentPackageImportHistory,
    contentPackagePreview,
    contentPackageResult,
    contentPackageUploadProgress,
    contentStatuses,
    defaultTimePeriodForm,
    deleteEntryAudioTrack,
    deleteEntryImage,
    deleteEntryRelationship,
    deleteEntryRoute,
    deleteEntrySource,
    deleteTag,
    deleteTimePeriod,
    deploymentInfo,
    describeBatchProgress,
    describeImportStatus,
    detachTagFromEntry,
    entryForm,
    entryIconKey,
    entryKinds,
    entryPlaceRoles,
    formatBytes,
    formatDeploymentTime,
    formatImportTime,
    importContentPackage,
    isBulkAudioPreviewing,
    isBulkAudioUploading,
    isImportingContentPackage,
    isLoadingAdminEntries,
    isLoadingContentPackageImportHistory,
    isPreviewingContentPackage,
    language,
    loadAdminEntries,
    loadAdminEntryDetail,
    loadAudioForm,
    loadContentPackageImportHistory,
    loadImageForm,
    loadRelationshipForm,
    loadRouteForm,
    loadSourceForm,
    loadTagForm,
    loadTimePeriodForm,
    mediaForm,
    mediaInputResetKey,
    patchEntryForm,
    patchPlaceForm,
    patchRelationshipForm,
    patchRouteForm,
    patchSourceForm,
    patchTagForm,
    patchTimePeriodForm,
    periods,
    periodYearLabel,
    placeForm,
    placeTypes,
    previewBulkAudioZip,
    previewContentPackage,
    realityStatuses,
    relationshipForm,
    relationshipTypes,
    resetAudioForm,
    resetEntryForm,
    resetImageForm,
    resetRelationshipForm,
    resetRouteForm,
    resetSourceForm,
    routeForm,
    routeTypes,
    saveEntry,
    saveEntryRelationship,
    saveEntryRoute,
    saveEntrySource,
    savePrimaryAudio,
    savePrimaryImage,
    saveTag,
    saveTimePeriod,
    setAdminEmail,
    setAdminOpen,
    setAdminPage,
    setAdminPassword,
    setBulkAudioFile,
    setBulkAudioLanguage,
    setBulkAudioPreview,
    setBulkAudioResult,
    setClearContentPackageBeforeImport,
    setContentPackageBatchItems,
    setContentPackageFiles,
    setContentPackagePreview,
    setContentPackageResult,
    setContentPackageUploadProgress,
    setMediaForm,
    setTagForm,
    setTimePeriodForm,
    signInAdmin,
    signOutAdmin,
    sourceForm,
    sourceSupportKinds,
    spatialConfidences,
    summarizeImportHistoryItem,
    switchEntryLanguage,
    tagForm,
    tags,
    timePeriodForm,
    timePeriodTypes,
    timePrecisions,
    ui,
    uploadBulkAudioZip,
    uploadPrimaryAudioFile,
    uploadPrimaryImageFile,
  } satisfies AdminPanelProps

  return (
    <main className="app-shell" data-theme={theme}>
      <header className="topbar">
        <div className="brand">
          <Globe2 aria-hidden="true" />
          <span className="brand-name-full">{ui.appName}</span>
          <span className="brand-name-short">HDWGT</span>
        </div>
        <ShellControls {...shellControlProps} includeFilterButton />
      </header>

      <section className={workspaceClassName} style={workspaceStyle}>
        {isFilterPaneCollapsed && (
          <button
            className="side-pane-tab left desktop-only"
            type="button"
            aria-label={ui.openFilters}
            title={ui.openFilters}
            onClick={() => setFilterPaneCollapsed(false)}
          >
            <Filter aria-hidden="true" />
            <ChevronRight aria-hidden="true" />
          </button>
        )}
        {isDetailPaneCollapsed && (
          <button
            className="side-pane-tab right desktop-only"
            type="button"
            aria-label={ui.openEntryDetail}
            title={ui.openEntryDetail}
            onClick={() => setDetailPaneCollapsed(false)}
          >
            <ChevronLeft aria-hidden="true" />
            <PanelRight aria-hidden="true" />
          </button>
        )}
        <FilterPanel
          className={isFilterPanelOpen ? 'filter-panel mobile-open' : 'filter-panel'}
          formatPeriodYear={periodYearLabel}
          fromYear={fromYear}
          isLoadingMap={isLoadingMap}
          isMapEmptyResult={isMapEmptyResult}
          isMediaPrefetching={isMediaPrefetching}
          isOfflineCacheAvailable={isOfflineCacheAvailable}
          labels={{
            appName: ui.appName,
            caching: ui.caching,
            clear: ui.clear,
            closeFilters: ui.closeFilters,
            collapseFilters: ui.collapseFilters,
            dateUnknown: ui.dateUnknown,
            downloadCount: ui.downloadCount,
            filters: ui.filters,
            moreCount: ui.moreCount,
            offlineMedia: ui.offlineMedia,
            resetFilters: ui.resetFilters,
            searchEntries: ui.searchEntries,
            tags: ui.tags,
            timePeriod: ui.timePeriod,
            yearFrom: ui.yearFrom,
            yearTo: ui.yearTo,
          }}
          mapStatus={mapStatus}
          mediaCacheProgress={mediaCacheProgress}
          mediaCacheStatus={mediaCacheStatus}
          periodHierarchy={periodHierarchy}
          searchText={searchText}
          selectedPeriodId={selectedPeriodId}
          selectedTags={selectedTags}
          tagGroups={tagGroups}
          toYear={toYear}
          visibleMediaCount={visibleMediaUrls.length}
          onClearFilters={clearFilters}
          onClearRuntimeCache={clearRuntimeCache}
          onClose={() => setFilterPanelOpen(false)}
          onCollapse={() => setFilterPaneCollapsed(true)}
          onExpandTagGroup={setExpandedTagGroup}
          onFromYearChange={(value) => {
            setSelectedPeriodId(null)
            setFromYear(value)
          }}
          onPrefetchVisibleMedia={prefetchVisibleMedia}
          onSearchTextChange={setSearchText}
          onSelectPeriod={selectPeriodFilter}
          onToYearChange={(value) => {
            setSelectedPeriodId(null)
            setToYear(value)
          }}
          onToggleTag={toggleTag}
        />

        {!isFilterPaneCollapsed && (
          <div
            className="side-pane-resizer left desktop-only"
            role="separator"
            tabIndex={0}
            aria-label={ui.resizeFilters}
            aria-orientation="vertical"
            aria-valuemin={minSidePaneWidth}
            aria-valuemax={maxResizablePaneWidth('filter')}
            aria-valuenow={filterPaneWidth}
            onKeyDown={(event) => resizeSidePaneWithKeyboard('filter', event)}
            onPointerCancel={endSidePaneResize}
            onPointerDown={(event) => beginSidePaneResize('filter', event)}
            onPointerMove={moveSidePaneResize}
            onPointerUp={endSidePaneResize}
          />
        )}

        <div className="map-main">
          <TimelineRuler
            entries={entries}
            fromYear={numberOrNull(fromYear)}
            labels={{ timeline: ui.timeline, noTimelineEntries: ui.noTimelineEntries }}
            selectedEntryId={selectedEntryId}
            onSelectEntry={selectEntry}
            toYear={numberOrNull(toYear)}
          />
          <HistoryMap
            autoFitKey={mapAutoFitKey}
            entries={mapEntries}
            fallbackEntryIds={entries.map((entry) => entry.id)}
            language={language}
            showFallback={!mapViewport}
            selectedEntryId={selectedEntryId}
            onViewportChange={handleMapViewportChange}
            onSelectEntry={selectEntry}
          />
        </div>

        {!isDetailPaneCollapsed && (
          <div
            className="side-pane-resizer right desktop-only"
            role="separator"
            tabIndex={0}
            aria-label={ui.resizeEntryDetail}
            aria-orientation="vertical"
            aria-valuemin={minSidePaneWidth}
            aria-valuemax={maxResizablePaneWidth('detail')}
            aria-valuenow={detailPaneWidth}
            onKeyDown={(event) => resizeSidePaneWithKeyboard('detail', event)}
            onPointerCancel={endSidePaneResize}
            onPointerDown={(event) => beginSidePaneResize('detail', event)}
            onPointerMove={moveSidePaneResize}
            onPointerUp={endSidePaneResize}
          />
        )}

        {expandedTagGroupModel && (
          <TagModal
            labels={{ closeTags: ui.closeTags, tags: ui.tags }}
            model={expandedTagGroupModel}
            selectedTags={selectedTags}
            onClose={() => setExpandedTagGroup(null)}
            onToggleTag={toggleTag}
          />
        )}

        <EntryDetailPanel
          activeEntryImageIndex={activeEntryImageIndex}
          adminToken={adminToken}
          className={isEntryDetailOpen ? 'detail-panel mobile-open' : 'detail-panel'}
          copiedEntrySlug={copiedEntrySlug}
          descriptionAudio={descriptionAudio}
          hasMultipleEntryImages={hasMultipleEntryImages}
          labels={{
            collapseEntryDetail: ui.collapseEntryDetail,
            closeEntryDetail: ui.closeEntryDetail,
            dateUnknown: ui.dateUnknown,
            description: ui.description,
            expandImage: ui.expandImage,
            imageIndicator: ui.imageIndicator,
            imageSlide: ui.imageSlide,
            knownPoints: ui.knownPoints,
            nextImage: ui.nextImage,
            places: ui.places,
            playAll: ui.playAll,
            previousImage: ui.previousImage,
            relatedTopics: ui.relatedTopics,
            routeRecords: ui.routeRecords,
            selectedEntry: ui.selectedEntry,
            sources: ui.sources,
            summary: ui.summary,
            whyItMatters: ui.whyItMatters,
          }}
          language={language}
          relatedEntryGroups={relatedEntryGroups}
          relationshipDirectionLabel={relationshipDirectionLabel}
          relationshipLabel={relationshipLabel}
          renderPlayButton={renderSectionPlayButton}
          selectedEntry={selectedEntry}
          selectedEntryDetail={selectedEntryDetail}
          selectedEntryId={selectedEntryId}
          selectedEntryImage={selectedEntryImage}
          selectedEntryImageCount={selectedEntryImageCount}
          selectedEntryImages={selectedEntryImages}
          selectedEntryImageUrl={selectedEntryImageUrl}
          selectedEntrySlug={selectedEntrySlug}
          shellControls={<ShellControls {...shellControlProps} includeFilterButton={false} />}
          summaryAudio={summaryAudio}
          titleAudio={titleAudio}
          ultimateAudioSequence={ultimateAudioSequence}
          whyItMattersAudio={whyItMattersAudio}
          onClose={() => setEntryDetailOpen(false)}
          onCollapse={() => setDetailPaneCollapsed(true)}
          onCopyEntrySlug={copyEntrySlug}
          onExpandImage={() => setEntryImageExpanded(true)}
          onPlayAudioSequence={playAudioSequence}
          onSelectRelatedEntry={(entryId) => selectEntry(entries.find((item) => item.id === entryId)?.id ?? selectedEntryId)}
          onShowAdjacentImage={showAdjacentEntryImage}
          onShowEntryImage={showEntryImage}
        />

        {isEntryImageExpanded && selectedEntryImageUrl && (
          <ImageLightbox
            activeImageIndex={activeEntryImageIndex}
            hasMultipleImages={hasMultipleEntryImages}
            image={selectedEntryImage}
            imageCount={selectedEntryImageCount}
            images={selectedEntryImages}
            imageUrl={selectedEntryImageUrl}
            labels={{
              closeImage: ui.closeImage,
              imageIndicator: ui.imageIndicator,
              imageSlide: ui.imageSlide,
              nextImage: ui.nextImage,
              previousImage: ui.previousImage,
            }}
            title={selectedEntryDetail?.title ?? selectedEntry?.title ?? ''}
            onClose={() => setEntryImageExpanded(false)}
            onShowAdjacentImage={showAdjacentEntryImage}
            onShowImage={showEntryImage}
          />
        )}

        {activeAudio && (
          <PersistentAudioPlayer
            activeAudio={activeAudio}
            audioRef={persistentAudioRef}
            isMinimized={isAudioPlayerMinimized}
            labels={{
              minimizeAudio: ui.minimizeAudio,
              nowPlaying: ui.nowPlaying,
              openPlayingEntry: ui.openPlayingEntry,
              playNext: ui.playNext,
              restoreAudio: ui.restoreAudio,
              stopAudio: ui.stopAudio,
            }}
            playableRandomEntryCount={playableRandomEntries.length}
            onEnded={handleAudioEnded}
            onMinimize={() => setAudioPlayerMinimized(true)}
            onOpenEntry={openActiveAudioEntry}
            onPlayNext={playNextRandomEntry}
            onRestore={() => setAudioPlayerMinimized(false)}
            onStop={stopAudio}
          />
        )}

        {isAdminOpen && (
          <Suspense
            fallback={(
              <aside className="admin-panel" aria-label="Admin tools">
                <div className="panel-header">
                  <span>Admin</span>
                </div>
                <div className="admin-status">
                  <span>Loading admin tools...</span>
                </div>
              </aside>
            )}
          >
            <AdminPanel {...adminPanelProps} />
          </Suspense>
        )}
      </section>
    </main>
  )
}

export default App
