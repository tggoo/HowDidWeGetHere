import { CalendarRange, CheckCircle2, ChevronLeft, Filter, Globe2, LoaderCircle, Search, Tags, X } from 'lucide-react'
import type { ReactNode } from 'react'

type FilterTag = {
  id: string
  slug: string
  name: string
  entryCount: number | string
}

type FilterTagGroup = {
  group: string
  label: string
  hiddenCount: number
  visibleItems: FilterTag[]
}

type PeriodFilterItem = {
  id: string
  name: string
}

type PeriodHierarchyItem<TPeriod extends PeriodFilterItem> = {
  period: TPeriod
  children: TPeriod[]
}

type FilterPanelLabels = {
  appName: string
  clear: string
  closeFilters: string
  collapseFilters: string
  dateUnknown: string
  filters: string
  moreCount: (count: number) => string
  resetFilters: string
  searchEntries: string
  tags: string
  timePeriod: string
  yearFrom: string
  yearTo: string
}

type FilterPanelProps<TPeriod extends PeriodFilterItem> = {
  className: string
  fromYear: string
  isLoadingMap: boolean
  isMapEmptyResult: boolean
  labels: FilterPanelLabels
  mapStatus: string
  periodHierarchy: Array<PeriodHierarchyItem<TPeriod>>
  searchText: string
  selectedPeriodId: string | null
  selectedTags: string[]
  sectionSwitcher: ReactNode
  tagGroups: FilterTagGroup[]
  toYear: string
  formatPeriodYear: (period: TPeriod, dateUnknown: string) => string
  onClearFilters: () => void
  onClose: () => void
  onCollapse: () => void
  onExpandTagGroup: (group: string) => void
  onFromYearChange: (value: string) => void
  onSearchTextChange: (value: string) => void
  onSelectPeriod: (period: TPeriod) => void
  onToYearChange: (value: string) => void
  onToggleTag: (tag: string) => void
}

export function FilterPanel<TPeriod extends PeriodFilterItem>({
  className,
  formatPeriodYear,
  fromYear,
  isLoadingMap,
  isMapEmptyResult,
  labels,
  mapStatus,
  onClearFilters,
  onClose,
  onCollapse,
  onExpandTagGroup,
  onFromYearChange,
  onSearchTextChange,
  onSelectPeriod,
  onToYearChange,
  onToggleTag,
  periodHierarchy,
  searchText,
  selectedPeriodId,
  selectedTags,
  sectionSwitcher,
  tagGroups,
  toYear,
}: FilterPanelProps<TPeriod>) {
  return (
    <aside className={className} aria-label="Map filters">
      <div className="filter-brand">
        <span className="filter-brand-title">
          <Globe2 aria-hidden="true" />
          <span>{labels.appName}</span>
        </span>
        <button
          className="panel-collapse-button desktop-only"
          type="button"
          aria-label={labels.collapseFilters}
          title={labels.collapseFilters}
          onClick={onCollapse}
        >
          <ChevronLeft aria-hidden="true" />
        </button>
      </div>
      <div className="panel-header filter-panel-header">
        <span>
          <Filter aria-hidden="true" />
          {labels.filters}
        </span>
        <button
          className="panel-close"
          type="button"
          aria-label={labels.closeFilters}
          title={labels.closeFilters}
          onClick={onClose}
        >
          <X aria-hidden="true" />
        </button>
      </div>
      {sectionSwitcher}
      <div className="status-pill">
        {isLoadingMap ? <LoaderCircle aria-hidden="true" className="spin-icon" /> : <CheckCircle2 aria-hidden="true" />}
        <span>{mapStatus}</span>
        {isMapEmptyResult && (
          <button type="button" onClick={onClearFilters}>
            {labels.resetFilters}
          </button>
        )}
      </div>

      <div className="search-box">
        <Search aria-hidden="true" />
        <input placeholder={labels.searchEntries} value={searchText} onChange={(event) => onSearchTextChange(event.target.value)} />
      </div>

      <div className="filter-block">
        <div className="filter-title">
          <Tags aria-hidden="true" />
          <span>{labels.tags}</span>
        </div>
        <div className="tag-filter-groups">
          {tagGroups.map((group) => (
            <div className="tag-filter-group" key={group.group}>
              <div className="tag-group-heading">
                <span>{group.label}</span>
                {group.hiddenCount > 0 && (
                  <button type="button" onClick={() => onExpandTagGroup(group.group)}>
                    {labels.moreCount(group.hiddenCount)}
                  </button>
                )}
              </div>
              <div className="tag-grid">
                {group.visibleItems.map((tag) => (
                  <button
                    className={selectedTags.includes(tag.slug) ? 'tag active' : 'tag'}
                    key={tag.id}
                    type="button"
                    onClick={() => onToggleTag(tag.slug)}
                  >
                    {tag.name}
                    {Number(tag.entryCount) > 0 && <small>{tag.entryCount}</small>}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="filter-block">
        <div className="filter-title">
          <CalendarRange aria-hidden="true" />
          <span>{labels.timePeriod}</span>
        </div>
        <div className="period-tree">
          {periodHierarchy.map(({ children, period }) => (
            <div className="period-branch" key={period.id}>
              <button
                className={selectedPeriodId === period.id ? 'period-item active' : 'period-item'}
                type="button"
                onClick={() => onSelectPeriod(period)}
              >
                <span>{period.name}</span>
                <small>{formatPeriodYear(period, labels.dateUnknown)}</small>
              </button>
              {children.length > 0 && (
                <div className="period-children">
                  {children.map((child) => (
                    <button
                      className={selectedPeriodId === child.id ? 'period-item active child' : 'period-item child'}
                      key={child.id}
                      type="button"
                      onClick={() => onSelectPeriod(child)}
                    >
                      <span>{child.name}</span>
                      <small>{formatPeriodYear(child, labels.dateUnknown)}</small>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="year-filter-row">
          <input inputMode="numeric" placeholder={labels.yearFrom} value={fromYear} onChange={(event) => onFromYearChange(event.target.value)} />
          <input inputMode="numeric" placeholder={labels.yearTo} value={toYear} onChange={(event) => onToYearChange(event.target.value)} />
          <button type="button" onClick={onClearFilters}>
            {labels.clear}
          </button>
        </div>
      </div>
    </aside>
  )
}
