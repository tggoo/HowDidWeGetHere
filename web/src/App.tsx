import {
  CalendarRange,
  Filter,
  Globe2,
  Languages,
  Lock,
  MapPin,
  PanelRight,
  Route,
  Search,
  Tags,
  Upload,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { apiClient } from './api/client'
import './App.css'

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

const tagOptions = ['exploration', 'mythology', 'invention', 'science', 'war']

function App() {
  const [language, setLanguage] = useState('en')
  const [selectedTags, setSelectedTags] = useState<string[]>(['exploration'])
  const [entries, setEntries] = useState<EntryListItem[]>(fallbackEntries)
  const [periods, setPeriods] = useState<TimePeriodListItem[]>(fallbackPeriods)
  const [selectedEntryId, setSelectedEntryId] = useState(fallbackEntries[0].id)
  const [isAdminOpen, setAdminOpen] = useState(false)

  useEffect(() => {
    let isActive = true

    async function loadMapData() {
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

      if (entriesResult.data && entriesResult.data.length > 0) {
        setEntries(entriesResult.data as EntryListItem[])
        setSelectedEntryId(entriesResult.data[0].id)
      }

      if (periodsResult.data && periodsResult.data.length > 0) {
        setPeriods(periodsResult.data as TimePeriodListItem[])
      }
    }

    void loadMapData()

    return () => {
      isActive = false
    }
  }, [language, selectedTags])

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
                  className={selectedTags.includes(tag) ? 'tag active' : 'tag'}
                  key={tag}
                  type="button"
                  onClick={() => toggleTag(tag)}
                >
                  {tag}
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
        </aside>

        {isAdminOpen && (
          <aside className="admin-panel" aria-label="Admin tools">
            <div className="panel-header">
              <Lock aria-hidden="true" />
              <span>Admin</span>
            </div>
            <button className="admin-action" type="button">
              <Upload aria-hidden="true" />
              Import workbook
            </button>
            <button className="admin-action" type="button">
              <Filter aria-hidden="true" />
              Review drafts
            </button>
          </aside>
        )}
      </section>
    </main>
  )
}

export default App
