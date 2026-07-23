import {
  AlertCircle,
  CalendarRange,
  CheckCircle2,
  Filter,
  Globe2,
  Image as ImageIcon,
  Languages,
  Lock,
  MapPin,
  Music,
  PanelRight,
  PlayCircle,
  Plus,
  RefreshCw,
  Route,
  Save,
  Search,
  Tags,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { apiBaseUrl, apiClient } from './api/client'
import type { components } from './api/schema'
import { HistoryMap, type MapEntry, type MapViewport } from './components/HistoryMap'
import './App.css'

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

type WorkbookImportResult = {
  importBatchId: string
  rowsRead: number | string
  entriesCreated: number | string
  entriesUpdated: number | string
  warnings: string[]
}

type AdminEntryListItem = {
  id: string
  slug: string
  status: string
  kind: string
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

const relationshipTypeLabels: Record<string, Record<string, string>> = {
  Caused: { en: 'Caused', cs: 'Zpusobilo', es: 'Causo' },
  Influenced: { en: 'Influenced', cs: 'Ovlivnilo', es: 'Influyo en' },
  Preceded: { en: 'Came before', cs: 'Predchazelo', es: 'Precedio a' },
  Followed: { en: 'Came after', cs: 'Nasledovalo', es: 'Siguio a' },
  PartOf: { en: 'Was part of', cs: 'Bylo soucasti', es: 'Fue parte de' },
  HasPart: { en: 'Includes', cs: 'Obsahuje', es: 'Incluye' },
  RelatedTo: { en: 'Related to', cs: 'Souvisi s', es: 'Relacionado con' },
  Contradicts: { en: 'Contradicts', cs: 'Je v rozporu s', es: 'Contradice' },
  SameTraditionAs: { en: 'Same tradition as', cs: 'Stejna tradice jako', es: 'Misma tradicion que' },
  LocatedWithin: { en: 'Located within', cs: 'Nachazi se v', es: 'Ubicado dentro de' },
  DerivedFrom: { en: 'Derived from', cs: 'Odvozene od', es: 'Derivado de' },
  Other: { en: 'Other relation', cs: 'Jina vazba', es: 'Otra relacion' },
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

function periodYearLabel(period: TimePeriodListItem) {
  if (period.startYear == null && period.endYear == null) {
    return 'Date unknown'
  }

  return `${period.startYear ?? '?'}-${period.endYear ?? '?'}`
}

function App() {
  const [language, setLanguage] = useState('en')
  const [selectedTags, setSelectedTags] = useState<string[]>(['category-exploration'])
  const [entries, setEntries] = useState<EntryListItem[]>(fallbackEntries)
  const [mapEntries, setMapEntries] = useState<MapEntry[]>([])
  const [periods, setPeriods] = useState<TimePeriodListItem[]>(fallbackPeriods)
  const [tags, setTags] = useState<TagListItem[]>(fallbackTags)
  const [selectedEntryId, setSelectedEntryId] = useState(fallbackEntries[0].id)
  const [isEntryDetailOpen, setEntryDetailOpen] = useState(false)
  const [selectedEntryDetail, setSelectedEntryDetail] = useState<EntryDetail | null>(null)
  const [searchText, setSearchText] = useState('')
  const [selectedPeriodId, setSelectedPeriodId] = useState<string | null>(null)
  const [fromYear, setFromYear] = useState('')
  const [toYear, setToYear] = useState('')
  const [mapViewport, setMapViewport] = useState<MapViewport | null>(null)
  const [isAdminOpen, setAdminOpen] = useState(false)
  const [isLoadingMap, setLoadingMap] = useState(false)
  const [mapStatus, setMapStatus] = useState('Showing starter data until published entries are loaded.')
  const [adminEmail, setAdminEmail] = useState('')
  const [adminPassword, setAdminPassword] = useState('')
  const [adminToken, setAdminToken] = useState<string | null>(null)
  const [adminStatus, setAdminStatus] = useState('Sign in with the Render admin account.')
  const [importFile, setImportFile] = useState<File | null>(null)
  const [isImporting, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<WorkbookImportResult | null>(null)
  const [adminEntries, setAdminEntries] = useState<AdminEntryListItem[]>([])
  const [isLoadingAdminEntries, setLoadingAdminEntries] = useState(false)
  const [entryForm, setEntryForm] = useState<EntryFormState>(defaultEntryForm)
  const [timePeriodForm, setTimePeriodForm] = useState<TimePeriodFormState>(defaultTimePeriodForm)
  const [mediaForm, setMediaForm] = useState({
    imageId: null as string | null,
    imageUrl: '',
    imageAlt: '',
    audioTrackId: null as string | null,
    audioUrl: '',
    audioTitle: '',
  })
  const [adminEntryImages, setAdminEntryImages] = useState<EntryDetail['images']>([])
  const [adminEntryAudioTracks, setAdminEntryAudioTracks] = useState<EntryDetail['audioTracks']>([])
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
  }, [])

  useEffect(() => {
    let isActive = true

    async function loadMapData() {
      setLoadingMap(true)
      try {
        const [entriesResult, periodsResult, tagsResult, mapResult] = await Promise.all([
          apiClient.GET('/api/entries', {
            params: {
              query: {
                language,
                search: searchText.trim() || undefined,
                tag: selectedTags,
                fromYear: numberOrNull(fromYear),
                toYear: numberOrNull(toYear),
              },
            },
          }),
          apiClient.GET('/api/time-periods', {
            params: {
              query: {
                language,
              },
            },
          }),
          apiClient.GET('/api/tags', {
            params: {
              query: {
                language,
              },
            },
          }),
          apiClient.GET('/api/map/entries', {
            params: {
              query: {
                language,
                search: searchText.trim() || undefined,
                tag: selectedTags,
                fromYear: numberOrNull(fromYear),
                toYear: numberOrNull(toYear),
                west: mapViewport?.west,
                south: mapViewport?.south,
                east: mapViewport?.east,
                north: mapViewport?.north,
              },
            },
          }),
        ])

        if (!isActive) {
          return
        }

        const mapPayload = (mapResult.data as MapEntry[] | undefined) ?? []
        const mapPointCount = mapPayload.reduce((count, entry) => count + entry.points.length, 0)

        if (entriesResult.error || periodsResult.error || tagsResult.error || mapResult.error) {
          setMapStatus('API responded, but one of the map queries failed.')
          return
        }

        if (entriesResult.data && entriesResult.data.length > 0) {
          setEntries(entriesResult.data as EntryListItem[])
          setSelectedEntryId(entriesResult.data[0].id)
          const yearRangeLabel = fromYear || toYear ? ` in ${fromYear || '?'}-${toYear || '?'}` : ''
          const viewportLabel = mapViewport ? ' in the visible map area' : ''
          setMapStatus(
            mapPointCount > 0
              ? `Loaded ${entriesResult.data.length} published entries and ${mapPointCount} map points${yearRangeLabel}${viewportLabel}.`
              : `Loaded ${entriesResult.data.length} published entries${yearRangeLabel}${viewportLabel}. Add places or move the map to show points.`,
          )
        } else {
          setMapStatus('API is reachable, but no published entries matched the current filters.')
        }

        if (periodsResult.data && periodsResult.data.length > 0) {
          setPeriods(periodsResult.data as TimePeriodListItem[])
        }

        if (tagsResult.data && tagsResult.data.length > 0) {
          setTags(tagsResult.data as TagListItem[])
        }

        setMapEntries(mapPayload)
      } catch {
        if (isActive) {
          setMapStatus('Unable to reach the API. Check Render API URL and CORS settings.')
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
  }, [fromYear, language, mapViewport, searchText, selectedTags, reloadKey, toYear])

  useEffect(() => {
    let isActive = true
    const selectedEntry = entries.find((entry) => entry.id === selectedEntryId)

    async function loadSelectedEntryDetail() {
      if (!selectedEntry || selectedEntry.id.startsWith('draft-')) {
        setSelectedEntryDetail(null)
        return
      }

      const result = await apiClient.GET('/api/entries/{slug}', {
        params: {
          path: {
            slug: selectedEntry.slug,
          },
          query: {
            language,
          },
        },
      })

      if (!isActive) {
        return
      }

      setSelectedEntryDetail(result.error || !result.data ? null : (result.data as EntryDetail))
    }

    void loadSelectedEntryDetail()

    return () => {
      isActive = false
    }
  }, [entries, language, selectedEntryId])

  useEffect(() => {
    if (adminToken) {
      let isActive = true

      async function loadSignedInAdminEntries() {
        setLoadingAdminEntries(true)
        const result = await apiClient.GET('/api/admin/entries', {
          headers: {
            Authorization: `Bearer ${adminToken}`,
          },
          params: {
            query: {
              language,
            },
          },
        })

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
  }, [adminToken, language, reloadKey])

  const selectedEntry = useMemo(
    () => entries.find((entry) => entry.id === selectedEntryId) ?? entries[0],
    [entries, selectedEntryId],
  )

  const mapAutoFitKey = useMemo(
    () => JSON.stringify({
      fromYear,
      language,
      reloadKey,
      searchText,
      selectedTags,
      toYear,
    }),
    [fromYear, language, reloadKey, searchText, selectedTags, toYear],
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

  const selectEntry = useCallback((entryId: string) => {
    setSelectedEntryId(entryId)
    setEntryDetailOpen(true)
  }, [])

  function toggleTag(tag: string) {
    setSelectedTags((current) =>
      current.includes(tag)
        ? current.filter((selectedTag) => selectedTag !== tag)
        : [...current, tag],
    )
  }

  function selectPeriodFilter(period: TimePeriodListItem) {
    setSelectedPeriodId(period.id)
    setFromYear(period.startYear?.toString() ?? '')
    setToYear(period.endYear?.toString() ?? '')
  }

  function clearTimeFilter() {
    setSelectedPeriodId(null)
    setFromYear('')
    setToYear('')
  }

  function authHeaders() {
    return adminToken ? { Authorization: `Bearer ${adminToken}` } : undefined
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
    }))
  }

  function resetAudioForm() {
    setMediaForm((current) => ({
      ...current,
      audioTrackId: null,
      audioUrl: '',
      audioTitle: '',
    }))
  }

  function loadImageForm(image: EntryDetail['images'][number]) {
    setMediaForm((current) => ({
      ...current,
      imageId: image.id,
      imageUrl: image.url,
      imageAlt: image.altText ?? '',
    }))
  }

  function loadAudioForm(audioTrack: EntryDetail['audioTracks'][number]) {
    setMediaForm((current) => ({
      ...current,
      audioTrackId: audioTrack.id,
      audioUrl: audioTrack.url,
      audioTitle: audioTrack.title ?? '',
    }))
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
      audioTrackId: null,
      audioUrl: '',
      audioTitle: '',
    })
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

  async function loadAdminEntryDetail(entryId: string) {
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
          language,
        },
      },
    })

    if (result.error || !result.data) {
      setAdminStatus('Unable to load entry detail.')
      return
    }

    const detail = result.data as AdminEntryDetail
    const detailRoutes = detail.routes ?? []
    const detailRelationships = detail.relationships ?? []
    const detailSources = detail.sources ?? []
    const detailTags = detail.tags ?? []
    const detailImages = detail.images ?? []
    const detailAudioTracks = detail.audioTracks ?? []
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
    setMediaForm((current) => {
      const image = current.imageId ? detailImages.find((item) => item.id === current.imageId) : null
      const audioTrack = current.audioTrackId
        ? detailAudioTracks.find((item) => item.id === current.audioTrackId)
        : null

      return {
        imageId: image?.id ?? null,
        imageUrl: image?.url ?? '',
        imageAlt: image?.altText ?? '',
        audioTrackId: audioTrack?.id ?? null,
        audioUrl: audioTrack?.url ?? '',
        audioTitle: audioTrack?.title ?? '',
      }
    })
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

    setAdminToken(result.data.accessToken)
    setAdminStatus('Signed in. Select the workbook and import it.')
  }

  async function importWorkbook() {
    if (!adminToken) {
      setAdminStatus('Sign in before importing.')
      return
    }

    if (!importFile) {
      setAdminStatus('Choose an .xlsx workbook first.')
      return
    }

    setImporting(true)
    setAdminStatus('Importing workbook...')

    const formData = new FormData()
    formData.append('file', importFile)

    try {
      const response = await fetch(`${apiBaseUrl}/api/admin/imports/workbook?publishImportedEntries=true&updateExistingRows=true`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminToken}`,
        },
        body: formData,
      })

      if (!response.ok) {
        setAdminStatus(`Import failed with HTTP ${response.status}.`)
        return
      }

      const result = (await response.json()) as WorkbookImportResult
      setImportResult(result)
      setAdminStatus(`Imported ${result.entriesCreated} new and ${result.entriesUpdated} updated entries from ${result.rowsRead} rows.`)
      setReloadKey((value) => value + 1)
    } catch {
      setAdminStatus('Import failed. Check API availability and CORS settings.')
    } finally {
      setImporting(false)
    }
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

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <Globe2 aria-hidden="true" />
          <span>HowDidWeGetHere</span>
        </div>
        <div className="topbar-actions">
          <label className="language-select">
            <Languages aria-hidden="true" />
            <select value={language} onChange={(event) => setLanguage(event.target.value)}>
              <option value="en">EN</option>
              <option value="cs">CS</option>
              <option value="es">ES</option>
            </select>
          </label>
          <button
            className="icon-button"
            type="button"
            aria-label="Open admin panel"
            title="Open admin panel"
            onClick={() => {
              setEntryDetailOpen(false)
              setAdminOpen((value) => !value)
            }}
          >
            <Lock aria-hidden="true" />
          </button>
        </div>
      </header>

      <section className="map-workspace">
        <aside className="filter-panel" aria-label="Map filters">
          <div className="status-pill">
            {isLoadingMap ? <Filter aria-hidden="true" /> : <CheckCircle2 aria-hidden="true" />}
            <span>{mapStatus}</span>
          </div>

          <div className="search-box">
            <Search aria-hidden="true" />
            <input
              placeholder="Search entries"
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
            />
          </div>

          <div className="filter-block">
            <div className="filter-title">
              <Tags aria-hidden="true" />
              <span>Tags</span>
            </div>
            <div className="tag-grid">
              {tags.slice(0, 16).map((tag) => (
                <button
                  className={selectedTags.includes(tag.slug) ? 'tag active' : 'tag'}
                  key={tag.id}
                  type="button"
                  onClick={() => toggleTag(tag.slug)}
                >
                  {tag.name}
                  {Number(tag.entryCount) > 0 && <small>{tag.entryCount}</small>}
                </button>
              ))}
            </div>
          </div>

          <div className="filter-block">
            <div className="filter-title">
              <CalendarRange aria-hidden="true" />
              <span>Time period</span>
            </div>
            <div className="period-tree">
              {periodHierarchy.map(({ period, children }) => (
                <div className="period-branch" key={period.id}>
                  <button
                    className={selectedPeriodId === period.id ? 'period-item active' : 'period-item'}
                    type="button"
                    onClick={() => selectPeriodFilter(period)}
                  >
                    <span>{period.name}</span>
                    <small>{periodYearLabel(period)}</small>
                  </button>
                  {children.length > 0 && (
                    <div className="period-children">
                      {children.map((child) => (
                        <button
                          className={selectedPeriodId === child.id ? 'period-item active child' : 'period-item child'}
                          key={child.id}
                          type="button"
                          onClick={() => selectPeriodFilter(child)}
                        >
                          <span>{child.name}</span>
                          <small>{periodYearLabel(child)}</small>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
            <div className="year-filter-row">
              <input
                inputMode="numeric"
                placeholder="From"
                value={fromYear}
                onChange={(event) => {
                  setSelectedPeriodId(null)
                  setFromYear(event.target.value)
                }}
              />
              <input
                inputMode="numeric"
                placeholder="To"
                value={toYear}
                onChange={(event) => {
                  setSelectedPeriodId(null)
                  setToYear(event.target.value)
                }}
              />
              <button type="button" onClick={clearTimeFilter}>
                Clear
              </button>
            </div>
          </div>
        </aside>

        <HistoryMap
          autoFitKey={mapAutoFitKey}
          entries={mapEntries}
          fallbackEntryIds={entries.map((entry) => entry.id)}
          showFallback={!mapViewport}
          selectedEntryId={selectedEntryId}
          onViewportChange={handleMapViewportChange}
          onSelectEntry={selectEntry}
        />

        <aside className={isEntryDetailOpen ? 'detail-panel mobile-open' : 'detail-panel'}>
          <div className="panel-header">
            <span>
              <PanelRight aria-hidden="true" />
              Selected entry
            </span>
            <button
              className="panel-close"
              type="button"
              aria-label="Close entry detail"
              title="Close entry detail"
              onClick={() => setEntryDetailOpen(false)}
            >
              <X aria-hidden="true" />
            </button>
          </div>
          <h1>{selectedEntry?.title}</h1>
          <div className="entry-meta">
            <span>{selectedEntry?.kind}</span>
            <span>{selectedEntry?.dateLabel ?? 'Date unknown'}</span>
            {selectedEntryDetail?.realityStatus && <span>{selectedEntryDetail.realityStatus}</span>}
          </div>
          {selectedEntryDetail?.images[0]?.url && (
            <img
              alt={selectedEntryDetail.images[0].altText ?? selectedEntryDetail.title}
              className="entry-image"
              src={selectedEntryDetail.images[0].url}
            />
          )}
          {selectedEntryDetail?.summary && <p className="entry-summary">{selectedEntryDetail.summary}</p>}
          {selectedEntryDetail?.whyItMatters && (
            <div className="route-card">
              <CheckCircle2 aria-hidden="true" />
              <div>
                <strong>Why it matters</strong>
                <p>{selectedEntryDetail.whyItMatters}</p>
              </div>
            </div>
          )}
          <div className="route-card">
            <Route aria-hidden="true" />
            <div>
              <strong>
                {selectedEntryDetail?.routes.length
                  ? `${selectedEntryDetail.routes.length} route records`
                  : 'Route-ready record'}
              </strong>
              <p>
                {selectedEntryDetail?.routes[0]
                  ? `${selectedEntryDetail.routes[0].name || selectedEntryDetail.routes[0].routeType}: ${selectedEntryDetail.routes[0].points.length} known points.`
                  : 'Origins, stops, destinations and route geometry come from the backend model.'}
              </p>
            </div>
          </div>
          {selectedEntryDetail?.places.length ? (
            <div className="detail-list">
              <strong>Places</strong>
              {selectedEntryDetail.places.map((place) => (
                <span key={`${place.placeId}-${place.role}`}>
                  {place.role}: {place.name}
                </span>
              ))}
            </div>
          ) : null}
          {selectedEntryDetail?.tags.length ? (
            <div className="detail-chip-list">
              {selectedEntryDetail.tags.map((tag) => (
                <span key={tag.id}>{tag.name}</span>
              ))}
            </div>
          ) : null}
          <div className="route-card">
            <PlayCircle aria-hidden="true" />
            <div>
              <strong>Audio-ready text</strong>
              <p>
                {selectedEntryDetail?.audioTracks[0]?.url || selectedEntry?.primaryAudioUrl
                  ? 'A narrated track is attached for this language.'
                  : 'Narration can be attached per language for children and audio-first browsing.'}
              </p>
              {selectedEntryDetail?.audioTracks[0]?.url && (
                <audio controls src={selectedEntryDetail.audioTracks[0].url}>
                  <track kind="captions" />
                </audio>
              )}
            </div>
          </div>
          {relatedEntryGroups.length ? (
            <div className="detail-list">
              <strong>Related topics</strong>
              {relatedEntryGroups.map((group) => (
                <div className="relationship-group" key={group.direction}>
                  <span>{relationshipDirectionLabel(group.direction, language)}</span>
                  {group.entries.map((entry) => (
                    <button
                      key={`${entry.direction}-${entry.entryId}-${entry.relationshipType}`}
                      type="button"
                      onClick={() => selectEntry(entries.find((item) => item.id === entry.entryId)?.id ?? selectedEntryId)}
                    >
                      <small>{relationshipLabel(entry.relationshipType, language)}</small>
                      {entry.title}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          ) : null}
          {selectedEntryDetail?.sources.length ? (
            <div className="detail-list">
              <strong>Sources</strong>
              {selectedEntryDetail.sources.slice(0, 4).map((source) => (
                <a href={source.url} key={`${source.sourceId}-${source.supportsField}`} rel="noreferrer" target="_blank">
                  {source.title ?? source.publisher ?? source.url}
                </a>
              ))}
            </div>
          ) : null}
        </aside>

        {isAdminOpen && (
          <aside className="admin-panel" aria-label="Admin tools">
            <div className="panel-header">
              <span>
                <Lock aria-hidden="true" />
                Admin
              </span>
              <button
                className="panel-close"
                type="button"
                aria-label="Close admin panel"
                title="Close admin panel"
                onClick={() => setAdminOpen(false)}
              >
                <X aria-hidden="true" />
              </button>
            </div>
            <div className="admin-status">
              {adminToken ? <CheckCircle2 aria-hidden="true" /> : <AlertCircle aria-hidden="true" />}
              <span>{adminStatus}</span>
            </div>
            <form className="admin-form" onSubmit={signInAdmin}>
              <label>
                Email
                <input
                  autoComplete="email"
                  type="email"
                  value={adminEmail}
                  onChange={(event) => setAdminEmail(event.target.value)}
                />
              </label>
              <label>
                Password
                <input
                  autoComplete="current-password"
                  type="password"
                  value={adminPassword}
                  onChange={(event) => setAdminPassword(event.target.value)}
                />
              </label>
              <button className="admin-action" type="submit">
                <Lock aria-hidden="true" />
                Sign in
              </button>
            </form>
            <div className="admin-form">
              <label>
                Workbook
                <input
                  accept=".xlsx,.xlsm"
                  type="file"
                  onChange={(event) => setImportFile(event.target.files?.[0] ?? null)}
                />
              </label>
              <button className="admin-action" disabled={isImporting} type="button" onClick={importWorkbook}>
                <Upload aria-hidden="true" />
                {isImporting ? 'Importing...' : 'Import workbook'}
              </button>
            </div>
            {importResult && (
              <div className="import-result">
                <strong>{importResult.entriesCreated} entries imported</strong>
                <span>{importResult.entriesUpdated} entries updated</span>
                <span>{importResult.rowsRead} rows read</span>
                {importResult.warnings.length > 0 && <span>{importResult.warnings.length} warnings</span>}
              </div>
            )}
            <div className="admin-section-title">
              <span>Time periods</span>
              <button
                className="icon-button subtle"
                type="button"
                onClick={() => setTimePeriodForm({ ...defaultTimePeriodForm, languageCode: language })}
              >
                <Plus aria-hidden="true" />
              </button>
            </div>
            <div className="period-list compact">
              {periods.slice(0, 6).map((period) => (
                <button
                  className={timePeriodForm.id === period.id ? 'period-item active' : 'period-item'}
                  key={period.id}
                  type="button"
                  onClick={() => loadTimePeriodForm(period)}
                >
                  <span>{period.name}</span>
                  <small>
                    {period.startYear ?? '?'}-{period.endYear ?? '?'}
                  </small>
                </button>
              ))}
            </div>
            <form className="entry-editor" onSubmit={saveTimePeriod}>
              <label>
                Period name
                <input
                  value={timePeriodForm.name}
                  onChange={(event) => patchTimePeriodForm({ name: event.target.value })}
                />
              </label>
              <label>
                Period slug
                <input
                  value={timePeriodForm.slug}
                  onChange={(event) => patchTimePeriodForm({ slug: event.target.value })}
                />
              </label>
              <div className="admin-field-row">
                <label>
                  Type
                  <select
                    value={timePeriodForm.periodType}
                    onChange={(event) => patchTimePeriodForm({ periodType: event.target.value as TimePeriodType })}
                  >
                    {timePeriodTypes.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Parent
                  <select
                    value={timePeriodForm.parentPeriodId}
                    onChange={(event) => patchTimePeriodForm({ parentPeriodId: event.target.value })}
                  >
                    <option value="">None</option>
                    {periods
                      .filter((period) => period.id !== timePeriodForm.id)
                      .map((period) => (
                        <option key={period.id} value={period.id}>
                          {period.name}
                        </option>
                      ))}
                  </select>
                </label>
              </div>
              <div className="admin-field-row">
                <label>
                  Start year
                  <input
                    inputMode="numeric"
                    value={timePeriodForm.startYear}
                    onChange={(event) => patchTimePeriodForm({ startYear: event.target.value })}
                  />
                </label>
                <label>
                  End year
                  <input
                    inputMode="numeric"
                    value={timePeriodForm.endYear}
                    onChange={(event) => patchTimePeriodForm({ endYear: event.target.value })}
                  />
                </label>
              </div>
              <label>
                Short description
                <textarea
                  value={timePeriodForm.shortDescription}
                  onChange={(event) => patchTimePeriodForm({ shortDescription: event.target.value })}
                />
              </label>
              <button className="admin-action" type="submit">
                <Save aria-hidden="true" />
                {timePeriodForm.id ? 'Save period' : 'Create period'}
              </button>
              {timePeriodForm.id && (
                <button className="admin-action secondary danger" type="button" onClick={deleteTimePeriod}>
                  <Trash2 aria-hidden="true" />
                  Delete period
                </button>
              )}
            </form>
            <div className="admin-section-title">
              <span>Tags</span>
              <button
                className="icon-button subtle"
                type="button"
                onClick={() =>
                  setTagForm({
                    id: null,
                    name: '',
                    slug: '',
                    tagGroup: 'topic',
                    parentTagId: '',
                    attachSlug: '',
                  })
                }
              >
                <Plus aria-hidden="true" />
              </button>
            </div>
            <div className="tag-grid">
              {tags.slice(0, 12).map((tag) => (
                <button
                  className={tagForm.id === tag.id ? 'tag active' : 'tag'}
                  key={tag.id}
                  type="button"
                  onClick={() => loadTagForm(tag)}
                >
                  {tag.name}
                </button>
              ))}
            </div>
            <form className="entry-editor" onSubmit={saveTag}>
              <label>
                Tag name
                <input
                  value={tagForm.name}
                  onChange={(event) => patchTagForm({ name: event.target.value })}
                />
              </label>
              <div className="admin-field-row">
                <label>
                  Tag slug
                  <input
                    value={tagForm.slug}
                    onChange={(event) => patchTagForm({ slug: event.target.value })}
                  />
                </label>
                <label>
                  Group
                  <input
                    value={tagForm.tagGroup}
                    onChange={(event) => patchTagForm({ tagGroup: event.target.value })}
                  />
                </label>
              </div>
              <label>
                Parent tag
                <select
                  value={tagForm.parentTagId}
                  onChange={(event) => patchTagForm({ parentTagId: event.target.value })}
                >
                  <option value="">None</option>
                  {tags
                    .filter((tag) => tag.id !== tagForm.id)
                    .map((tag) => (
                      <option key={tag.id} value={tag.id}>
                        {tag.name}
                      </option>
                    ))}
                </select>
              </label>
              <button className="admin-action" type="submit">
                <Save aria-hidden="true" />
                {tagForm.id ? 'Save tag' : 'Create tag'}
              </button>
              {tagForm.id && (
                <button className="admin-action secondary danger" type="button" onClick={deleteTag}>
                  <Trash2 aria-hidden="true" />
                  Delete tag
                </button>
              )}
              <label>
                Attach tag
                <select
                  value={tagForm.attachSlug}
                  onChange={(event) => patchTagForm({ attachSlug: event.target.value })}
                >
                  <option value="">Choose tag</option>
                  {tags.map((tag) => (
                    <option key={tag.id} value={tag.slug}>
                      {tag.name}
                    </option>
                  ))}
                </select>
              </label>
              <button className="admin-action secondary" type="button" onClick={attachTagToEntry}>
                <Tags aria-hidden="true" />
                Attach tag
              </button>
              {adminEntryTags.length > 0 && (
                <div className="route-manager">
                  <strong>Attached tags</strong>
                  {adminEntryTags.map((tag) => (
                    <div className="route-manager-item" key={tag.id}>
                      <span>
                        {tag.name}
                        <small>{tag.tagGroup} - {tag.slug}</small>
                      </span>
                      <div className="route-manager-actions">
                        <button className="admin-action secondary" type="button" onClick={() => loadTagForm(tag)}>
                          <Tags aria-hidden="true" />
                          Edit
                        </button>
                        <button className="admin-action secondary danger" type="button" onClick={() => detachTagFromEntry(tag.id)}>
                          <Trash2 aria-hidden="true" />
                          Detach
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </form>
            <div className="admin-section-title">
              <span>Content</span>
              <button className="icon-button subtle" type="button" onClick={resetEntryForm}>
                <Plus aria-hidden="true" />
              </button>
            </div>
            <div className="admin-entry-list">
              <button className="admin-action secondary" disabled={isLoadingAdminEntries} type="button" onClick={loadAdminEntries}>
                <RefreshCw aria-hidden="true" />
                {isLoadingAdminEntries ? 'Loading...' : 'Reload entries'}
              </button>
              {adminEntries.slice(0, 8).map((entry) => (
                <button
                  className={entryForm.id === entry.id ? 'admin-entry active' : 'admin-entry'}
                  key={entry.id}
                  type="button"
                  onClick={() => loadAdminEntryDetail(entry.id)}
                >
                  <span>{entry.title}</span>
                  <small>
                    {entry.status} / {entry.kind}
                  </small>
                </button>
              ))}
            </div>
            <form className="entry-editor" onSubmit={saveEntry}>
              <label>
                Title
                <input
                  value={entryForm.title}
                  onChange={(event) => patchEntryForm({ title: event.target.value })}
                />
              </label>
              <label>
                Slug
                <input
                  value={entryForm.slug}
                  onChange={(event) => patchEntryForm({ slug: event.target.value })}
                />
              </label>
              <div className="admin-field-row">
                <label>
                  Kind
                  <select
                    value={entryForm.kind}
                    onChange={(event) => patchEntryForm({ kind: event.target.value as EntryKind })}
                  >
                    {entryKinds.map((kind) => (
                      <option key={kind} value={kind}>
                        {kind}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Status
                  <select
                    value={entryForm.status}
                    onChange={(event) => patchEntryForm({ status: event.target.value as ContentStatus })}
                  >
                    {contentStatuses.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="admin-field-row">
                <label>
                  Reality
                  <select
                    value={entryForm.realityStatus}
                    onChange={(event) => patchEntryForm({ realityStatus: event.target.value as RealityStatus })}
                  >
                    {realityStatuses.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Language
                  <input
                    value={entryForm.languageCode}
                    onChange={(event) => patchEntryForm({ languageCode: event.target.value })}
                  />
                </label>
              </div>
              <div className="admin-field-row">
                <label>
                  Date label
                  <input
                    value={entryForm.dateLabel}
                    onChange={(event) => patchEntryForm({ dateLabel: event.target.value })}
                  />
                </label>
                <label>
                  Precision
                  <select
                    value={entryForm.timePrecision}
                    onChange={(event) => patchEntryForm({ timePrecision: event.target.value as TimePrecision | '' })}
                  >
                    <option value="">Auto</option>
                    {timePrecisions.map((precision) => (
                      <option key={precision} value={precision}>
                        {precision}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="admin-field-row">
                <label>
                  Start year
                  <input
                    inputMode="numeric"
                    value={entryForm.startYear}
                    onChange={(event) => patchEntryForm({ startYear: event.target.value })}
                  />
                </label>
                <label>
                  End year
                  <input
                    inputMode="numeric"
                    value={entryForm.endYear}
                    onChange={(event) => patchEntryForm({ endYear: event.target.value })}
                  />
                </label>
              </div>
              <label>
                Primary time period
                <select
                  value={entryForm.primaryTimePeriodId}
                  onChange={(event) => patchEntryForm({ primaryTimePeriodId: event.target.value })}
                >
                  <option value="">None</option>
                  {periods.map((period) => (
                    <option key={period.id} value={period.id}>
                      {period.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Summary
                <textarea
                  value={entryForm.summary}
                  onChange={(event) => patchEntryForm({ summary: event.target.value })}
                />
              </label>
              <label>
                Why it matters
                <textarea
                  value={entryForm.whyItMatters}
                  onChange={(event) => patchEntryForm({ whyItMatters: event.target.value })}
                />
              </label>
              <button className="admin-action" type="submit">
                <Save aria-hidden="true" />
                {entryForm.id ? 'Save entry' : 'Create entry'}
              </button>
            </form>
            <div className="media-editor">
              <label>
                Place name
                <input
                  value={placeForm.name}
                  onChange={(event) => patchPlaceForm({ name: event.target.value })}
                />
              </label>
              <div className="admin-field-row">
                <label>
                  Longitude
                  <input
                    inputMode="decimal"
                    value={placeForm.longitude}
                    onChange={(event) => patchPlaceForm({ longitude: event.target.value })}
                  />
                </label>
                <label>
                  Latitude
                  <input
                    inputMode="decimal"
                    value={placeForm.latitude}
                    onChange={(event) => patchPlaceForm({ latitude: event.target.value })}
                  />
                </label>
              </div>
              <div className="admin-field-row">
                <label>
                  Role
                  <select
                    value={placeForm.role}
                    onChange={(event) => patchPlaceForm({ role: event.target.value as EntryPlaceRole })}
                  >
                    {entryPlaceRoles.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Type
                  <select
                    value={placeForm.placeType}
                    onChange={(event) => patchPlaceForm({ placeType: event.target.value as PlaceType })}
                  >
                    {placeTypes.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="admin-field-row">
                <label>
                  Confidence
                  <select
                    value={placeForm.spatialConfidence}
                    onChange={(event) => patchPlaceForm({ spatialConfidence: event.target.value as SpatialConfidence })}
                  >
                    {spatialConfidences.map((confidence) => (
                      <option key={confidence} value={confidence}>
                        {confidence}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Country
                  <input
                    maxLength={3}
                    value={placeForm.countryCode}
                    onChange={(event) => patchPlaceForm({ countryCode: event.target.value })}
                  />
                </label>
              </div>
              <label>
                Place note
                <input
                  value={placeForm.note}
                  onChange={(event) => patchPlaceForm({ note: event.target.value })}
                />
              </label>
              <button className="admin-action secondary" type="button" onClick={addEntryPlace}>
                <MapPin aria-hidden="true" />
                Add place
              </button>
              {adminEntryRoutes.length > 0 && (
                <div className="route-manager">
                  <strong>Routes</strong>
                  {adminEntryRoutes.map((route) => (
                    <div className="route-manager-item" key={route.id}>
                      <span>
                        {route.name || route.routeType}
                        <small>{route.routeType} - {route.points.length} points</small>
                      </span>
                      <div className="route-manager-actions">
                        <button className="admin-action secondary" type="button" onClick={() => loadRouteForm(route)}>
                          <Route aria-hidden="true" />
                          Edit
                        </button>
                        <button className="admin-action secondary danger" type="button" onClick={() => deleteEntryRoute(route.id)}>
                          <Trash2 aria-hidden="true" />
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <label>
                {routeForm.id ? 'Editing route' : 'Route name'}
                <input
                  value={routeForm.name}
                  onChange={(event) => patchRouteForm({ name: event.target.value })}
                />
              </label>
              <div className="admin-field-row">
                <label>
                  Route type
                  <select
                    value={routeForm.routeType}
                    onChange={(event) => patchRouteForm({ routeType: event.target.value as RouteType })}
                  >
                    {routeTypes.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Route confidence
                  <select
                    value={routeForm.spatialConfidence}
                    onChange={(event) => patchRouteForm({ spatialConfidence: event.target.value as SpatialConfidence })}
                  >
                    {spatialConfidences.map((confidence) => (
                      <option key={confidence} value={confidence}>
                        {confidence}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label>
                Route points
                <textarea
                  className="route-points-input"
                  placeholder="Start | Palos de la Frontera | -6.89 | 37.23 | 1492&#10;Stop | Canary Islands | -15.50 | 28.10 | 1492&#10;End | Bahamas | -77.35 | 25.03 | 1492"
                  value={routeForm.pointsText}
                  onChange={(event) => patchRouteForm({ pointsText: event.target.value })}
                />
              </label>
              <label>
                Route source note
                <input
                  value={routeForm.sourceNote}
                  onChange={(event) => patchRouteForm({ sourceNote: event.target.value })}
                />
              </label>
              <div className="admin-field-row">
                <button className="admin-action secondary" type="button" onClick={saveEntryRoute}>
                  <Route aria-hidden="true" />
                  {routeForm.id ? 'Save route' : 'Add route'}
                </button>
                <button className="admin-action secondary" type="button" onClick={resetRouteForm}>
                  <Plus aria-hidden="true" />
                  New route
                </button>
              </div>
              {adminEntryRelationships.length > 0 && (
                <div className="route-manager">
                  <strong>Relationships</strong>
                  {adminEntryRelationships.map((relationship) => (
                    <div className="route-manager-item" key={relationship.id}>
                      <span>
                        {relationship.relationshipType}: {relationship.targetEntryTitle}
                        <small>{relationship.targetEntryKind} - {relationship.targetEntrySlug}</small>
                      </span>
                      <div className="route-manager-actions">
                        <button
                          className="admin-action secondary"
                          type="button"
                          onClick={() => loadRelationshipForm(relationship)}
                        >
                          <Tags aria-hidden="true" />
                          Edit
                        </button>
                        <button
                          className="admin-action secondary danger"
                          type="button"
                          onClick={() => deleteEntryRelationship(relationship.id)}
                        >
                          <Trash2 aria-hidden="true" />
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <label>
                {relationshipForm.id ? 'Editing relationship target slug' : 'Related entry slug'}
                <input
                  value={relationshipForm.targetEntrySlug}
                  onChange={(event) => patchRelationshipForm({ targetEntrySlug: event.target.value })}
                />
              </label>
              <div className="admin-field-row">
                <label>
                  Relationship
                  <select
                    value={relationshipForm.relationshipType}
                    onChange={(event) =>
                      patchRelationshipForm({ relationshipType: event.target.value as EntryRelationshipType })
                    }
                  >
                    {relationshipTypes.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Confidence
                  <input
                    inputMode="decimal"
                    placeholder="0.8"
                    value={relationshipForm.confidence}
                    onChange={(event) => patchRelationshipForm({ confidence: event.target.value })}
                  />
                </label>
              </div>
              <label>
                Relationship note
                <input
                  value={relationshipForm.note}
                  onChange={(event) => patchRelationshipForm({ note: event.target.value })}
                />
              </label>
              <div className="admin-field-row">
                <button className="admin-action secondary" type="button" onClick={saveEntryRelationship}>
                  <Tags aria-hidden="true" />
                  {relationshipForm.id ? 'Save relationship' : 'Add relationship'}
                </button>
                <button className="admin-action secondary" type="button" onClick={resetRelationshipForm}>
                  <Plus aria-hidden="true" />
                  New relationship
                </button>
              </div>
              {adminEntrySources.length > 0 && (
                <div className="route-manager">
                  <strong>Sources</strong>
                  {adminEntrySources.map((source) => (
                    <div className="route-manager-item" key={`${source.sourceId}-${source.supportsField}`}>
                      <span>
                        {source.title || source.publisher || source.url}
                        <small>{source.supportsField} - {source.publisher || source.url}</small>
                      </span>
                      <div className="route-manager-actions">
                        <button className="admin-action secondary" type="button" onClick={() => loadSourceForm(source)}>
                          <Search aria-hidden="true" />
                          Edit
                        </button>
                        <button
                          className="admin-action secondary danger"
                          type="button"
                          onClick={() => deleteEntrySource(source.sourceId, source.supportsField)}
                        >
                          <Trash2 aria-hidden="true" />
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <label>
                {sourceForm.sourceId ? 'Editing source URL' : 'Source URL'}
                <input
                  value={sourceForm.url}
                  onChange={(event) => patchSourceForm({ url: event.target.value })}
                />
              </label>
              <div className="admin-field-row">
                <label>
                  Source title
                  <input
                    value={sourceForm.title}
                    onChange={(event) => patchSourceForm({ title: event.target.value })}
                  />
                </label>
                <label>
                  Publisher
                  <input
                    value={sourceForm.publisher}
                    onChange={(event) => patchSourceForm({ publisher: event.target.value })}
                  />
                </label>
              </div>
              <div className="admin-field-row">
                <label>
                  Supports
                  <select
                    value={sourceForm.supportsField}
                    onChange={(event) => patchSourceForm({ supportsField: event.target.value as SourceSupportKind })}
                  >
                    {sourceSupportKinds.map((supportKind) => (
                      <option key={supportKind} value={supportKind}>
                        {supportKind}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Source note
                  <input
                    value={sourceForm.note}
                    onChange={(event) => patchSourceForm({ note: event.target.value })}
                  />
                </label>
              </div>
              <div className="admin-field-row">
                <button className="admin-action secondary" type="button" onClick={saveEntrySource}>
                  <Search aria-hidden="true" />
                  {sourceForm.sourceId ? 'Save source' : 'Add source'}
                </button>
                <button className="admin-action secondary" type="button" onClick={resetSourceForm}>
                  <Plus aria-hidden="true" />
                  New source
                </button>
              </div>
              {adminEntryImages.length > 0 && (
                <div className="route-manager">
                  <strong>Images</strong>
                  {adminEntryImages.map((image) => (
                    <div className="route-manager-item" key={image.id}>
                      <span>
                        {image.altText || image.caption || image.url}
                        <small>{image.kind} - {image.isPrimary ? 'Primary' : `Order ${image.sortOrder}`}</small>
                      </span>
                      <div className="route-manager-actions">
                        <button className="admin-action secondary" type="button" onClick={() => loadImageForm(image)}>
                          <ImageIcon aria-hidden="true" />
                          Edit
                        </button>
                        <button className="admin-action secondary danger" type="button" onClick={() => deleteEntryImage(image.id)}>
                          <Trash2 aria-hidden="true" />
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <label>
                {mediaForm.imageId ? 'Editing image URL' : 'Primary image URL'}
                <input
                  value={mediaForm.imageUrl}
                  onChange={(event) => setMediaForm((current) => ({ ...current, imageUrl: event.target.value }))}
                />
              </label>
              <label>
                Image alt text
                <input
                  value={mediaForm.imageAlt}
                  onChange={(event) => setMediaForm((current) => ({ ...current, imageAlt: event.target.value }))}
                />
              </label>
              <div className="admin-field-row">
                <button className="admin-action secondary" type="button" onClick={savePrimaryImage}>
                  <ImageIcon aria-hidden="true" />
                  {mediaForm.imageId ? 'Save image' : 'Add image'}
                </button>
                <button className="admin-action secondary" type="button" onClick={resetImageForm}>
                  <Plus aria-hidden="true" />
                  New image
                </button>
              </div>
              {adminEntryAudioTracks.length > 0 && (
                <div className="route-manager">
                  <strong>Audio tracks</strong>
                  {adminEntryAudioTracks.map((audioTrack) => (
                    <div className="route-manager-item" key={audioTrack.id}>
                      <span>
                        {audioTrack.title || audioTrack.url}
                        <small>{audioTrack.languageCode} - {audioTrack.kind}</small>
                      </span>
                      <div className="route-manager-actions">
                        <button className="admin-action secondary" type="button" onClick={() => loadAudioForm(audioTrack)}>
                          <Music aria-hidden="true" />
                          Edit
                        </button>
                        <button
                          className="admin-action secondary danger"
                          type="button"
                          onClick={() => deleteEntryAudioTrack(audioTrack.id)}
                        >
                          <Trash2 aria-hidden="true" />
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <label>
                {mediaForm.audioTrackId ? 'Editing audio URL' : 'Audio URL'}
                <input
                  value={mediaForm.audioUrl}
                  onChange={(event) => setMediaForm((current) => ({ ...current, audioUrl: event.target.value }))}
                />
              </label>
              <label>
                Audio title
                <input
                  value={mediaForm.audioTitle}
                  onChange={(event) => setMediaForm((current) => ({ ...current, audioTitle: event.target.value }))}
                />
              </label>
              <div className="admin-field-row">
                <button className="admin-action secondary" type="button" onClick={savePrimaryAudio}>
                  <Music aria-hidden="true" />
                  {mediaForm.audioTrackId ? 'Save audio' : 'Add audio'}
                </button>
                <button className="admin-action secondary" type="button" onClick={resetAudioForm}>
                  <Plus aria-hidden="true" />
                  New audio
                </button>
              </div>
            </div>
          </aside>
        )}
      </section>
    </main>
  )
}

export default App
