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
  Upload,
} from 'lucide-react'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { apiBaseUrl, apiClient } from './api/client'
import type { components } from './api/schema'
import './App.css'

type AdminEntryUpsertRequest = components['schemas']['AdminEntryUpsertRequest']
type AdminEntryImageRequest = components['schemas']['AdminEntryImageRequest']
type AdminEntryAudioTrackRequest = components['schemas']['AdminEntryAudioTrackRequest']
type ContentStatus = components['schemas']['ContentStatus']
type EntryKind = components['schemas']['EntryKind']
type RealityStatus = components['schemas']['RealityStatus']
type TimePrecision = Exclude<components['schemas']['TimePrecision'], null>

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

type WorkbookImportResult = {
  importBatchId: string
  rowsRead: number | string
  entriesCreated: number | string
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

const tagOptions = [
  { label: 'exploration', value: 'category-exploration' },
  { label: 'mythology', value: 'category-mythology' },
  { label: 'invention', value: 'category-inventions' },
  { label: 'science', value: 'category-science' },
  { label: 'war', value: 'category-war' },
]

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

function App() {
  const [language, setLanguage] = useState('en')
  const [selectedTags, setSelectedTags] = useState<string[]>(['category-exploration'])
  const [entries, setEntries] = useState<EntryListItem[]>(fallbackEntries)
  const [periods, setPeriods] = useState<TimePeriodListItem[]>(fallbackPeriods)
  const [selectedEntryId, setSelectedEntryId] = useState(fallbackEntries[0].id)
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
  const [mediaForm, setMediaForm] = useState({
    imageUrl: '',
    imageAlt: '',
    audioUrl: '',
    audioTitle: '',
  })
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let isActive = true

    async function loadMapData() {
      setLoadingMap(true)
      try {
        const [entriesResult, periodsResult] = await Promise.all([
          apiClient.GET('/api/entries', {
            params: {
              query: {
                language,
                tag: selectedTags,
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
        ])

        if (!isActive) {
          return
        }

        if (entriesResult.error || periodsResult.error) {
          setMapStatus('API responded, but one of the map queries failed.')
          return
        }

        if (entriesResult.data && entriesResult.data.length > 0) {
          setEntries(entriesResult.data as EntryListItem[])
          setSelectedEntryId(entriesResult.data[0].id)
          setMapStatus(`Loaded ${entriesResult.data.length} published entries from the API.`)
        } else {
          setMapStatus('API is reachable, but no published entries matched the current filters.')
        }

        if (periodsResult.data && periodsResult.data.length > 0) {
          setPeriods(periodsResult.data as TimePeriodListItem[])
        }
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
  }, [language, selectedTags, reloadKey])

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

  function toggleTag(tag: string) {
    setSelectedTags((current) =>
      current.includes(tag)
        ? current.filter((selectedTag) => selectedTag !== tag)
        : [...current, tag],
    )
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

  function resetEntryForm() {
    setEntryForm({ ...defaultEntryForm, languageCode: language })
    setMediaForm({
      imageUrl: '',
      imageAlt: '',
      audioUrl: '',
      audioTitle: '',
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
      const response = await fetch(`${apiBaseUrl}/api/admin/imports/workbook?publishImportedEntries=true`, {
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
      setAdminStatus(`Imported ${result.entriesCreated} entries from ${result.rowsRead} rows.`)
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

  async function addPrimaryImage() {
    if (!entryForm.id || !adminToken) {
      setAdminStatus('Select or create an entry before adding an image.')
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

    const result = await apiClient.POST('/api/admin/entries/{entryId}/images', {
      headers: authHeaders(),
      params: {
        path: {
          entryId: entryForm.id,
        },
      },
      body,
    })

    if (result.error) {
      setAdminStatus('Image was not added.')
      return
    }

    setMediaForm((current) => ({ ...current, imageUrl: '', imageAlt: '' }))
    setAdminStatus('Image added.')
    setReloadKey((value) => value + 1)
  }

  async function addPrimaryAudio() {
    if (!entryForm.id || !adminToken) {
      setAdminStatus('Select or create an entry before adding audio.')
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

    const result = await apiClient.POST('/api/admin/entries/{entryId}/audio-tracks', {
      headers: authHeaders(),
      params: {
        path: {
          entryId: entryForm.id,
        },
      },
      body,
    })

    if (result.error) {
      setAdminStatus('Audio was not added.')
      return
    }

    setMediaForm((current) => ({ ...current, audioUrl: '', audioTitle: '' }))
    setAdminStatus('Audio added.')
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
            onClick={() => setAdminOpen((value) => !value)}
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
            <input placeholder="Search entries" />
          </div>

          <div className="filter-block">
            <div className="filter-title">
              <Tags aria-hidden="true" />
              <span>Tags</span>
            </div>
            <div className="tag-grid">
              {tagOptions.map((tag) => (
                <button
                  className={selectedTags.includes(tag.value) ? 'tag active' : 'tag'}
                  key={tag.value}
                  type="button"
                  onClick={() => toggleTag(tag.value)}
                >
                  {tag.label}
                </button>
              ))}
            </div>
          </div>

          <div className="filter-block">
            <div className="filter-title">
              <CalendarRange aria-hidden="true" />
              <span>Time period</span>
            </div>
            <div className="period-list">
              {periods.slice(0, 4).map((period) => (
                <button className="period-item" key={period.id} type="button">
                  <span>{period.name}</span>
                  <small>
                    {period.startYear ?? '?'}-{period.endYear ?? '?'}
                  </small>
                </button>
              ))}
            </div>
          </div>
        </aside>

        <section className="map-canvas" aria-label="World history map">
          <div className="map-grid" />
          <button
            className="map-point atlantic"
            type="button"
            onClick={() => setSelectedEntryId(entries[0]?.id)}
          >
            <MapPin aria-hidden="true" />
          </button>
          <button
            className="map-point himalaya"
            type="button"
            onClick={() => setSelectedEntryId(entries[1]?.id ?? entries[0]?.id)}
          >
            <MapPin aria-hidden="true" />
          </button>
          <button
            className="map-point nile"
            type="button"
            onClick={() => setSelectedEntryId(entries[2]?.id ?? entries[0]?.id)}
          >
            <MapPin aria-hidden="true" />
          </button>
          <div className="route-line atlantic-route" />
          <div className="route-line everest-route" />
        </section>

        <aside className="detail-panel">
          <div className="panel-header">
            <PanelRight aria-hidden="true" />
            <span>Selected entry</span>
          </div>
          <h1>{selectedEntry?.title}</h1>
          <div className="entry-meta">
            <span>{selectedEntry?.kind}</span>
            <span>{selectedEntry?.dateLabel ?? 'Date unknown'}</span>
          </div>
          <div className="route-card">
            <Route aria-hidden="true" />
            <div>
              <strong>Route-ready record</strong>
              <p>Origins, stops, destinations and route geometry come from the backend model.</p>
            </div>
          </div>
          <div className="route-card">
            <PlayCircle aria-hidden="true" />
            <div>
              <strong>Audio-ready text</strong>
              <p>
                {selectedEntry?.primaryAudioUrl
                  ? 'A narrated track is attached for this language.'
                  : 'Narration can be attached per language for children and audio-first browsing.'}
              </p>
            </div>
          </div>
        </aside>

        {isAdminOpen && (
          <aside className="admin-panel" aria-label="Admin tools">
            <div className="panel-header">
              <Lock aria-hidden="true" />
              <span>Admin</span>
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
                <span>{importResult.rowsRead} rows read</span>
                {importResult.warnings.length > 0 && <span>{importResult.warnings.length} warnings</span>}
              </div>
            )}
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
                Primary image URL
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
              <button className="admin-action secondary" type="button" onClick={addPrimaryImage}>
                <ImageIcon aria-hidden="true" />
                Add image
              </button>
              <label>
                Audio URL
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
              <button className="admin-action secondary" type="button" onClick={addPrimaryAudio}>
                <Music aria-hidden="true" />
                Add audio
              </button>
            </div>
          </aside>
        )}
      </section>
    </main>
  )
}

export default App
