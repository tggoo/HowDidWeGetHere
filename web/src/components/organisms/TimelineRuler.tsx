import { Icon } from '@iconify/react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useRef, useState, type PointerEvent, type WheelEvent } from 'react'

type TimelineEntry = {
  id: string
  kind: string
  iconKey?: string | null
  title: string
  dateLabel?: string | null
  startYear?: number | string | null
  endYear?: number | string | null
}

type TimelineRulerProps = {
  entries: TimelineEntry[]
  fromYear: number | null
  labels: {
    timeline: string
    noTimelineEntries: string
  }
  selectedEntryId: string
  toYear: number | null
  onSelectEntry: (entryId: string) => void
}

const timelineEdgePaddingPx = 80

function entryIconKey(entry: Pick<TimelineEntry, 'iconKey' | 'kind'>) {
  if (entry.iconKey?.trim()) {
    return entry.iconKey.trim()
  }

  const kind = entry.kind.toLowerCase()
  if (kind.includes('myth')) {
    return 'mdi:creation'
  }

  if (kind.includes('exploration')) {
    return 'mdi:compass'
  }

  if (kind.includes('war')) {
    return 'mdi:sword-cross'
  }

  if (kind.includes('person')) {
    return 'mdi:account'
  }

  if (kind.includes('invention') || kind.includes('technology')) {
    return 'mdi:lightbulb-on'
  }

  return 'mdi:map-marker-star'
}

function entryTimelineYear(entry: TimelineEntry) {
  const startYear = Number(entry.startYear)
  if (Number.isFinite(startYear)) {
    return startYear
  }

  const endYear = Number(entry.endYear)
  return Number.isFinite(endYear) ? endYear : null
}

function timelineYearLabel(year: number) {
  const rounded = Math.round(year)
  return rounded < 0 ? `${Math.abs(rounded)} BCE` : `${rounded} CE`
}

function normalizeTimelineRange(fromYear: number | null, toYear: number | null) {
  if (fromYear === null || toYear === null) {
    return { from: fromYear, to: toYear }
  }

  return fromYear <= toYear ? { from: fromYear, to: toYear } : { from: toYear, to: fromYear }
}

function createTimelineTicks(startYear: number, endYear: number) {
  const span = Math.max(endYear - startYear, 1)
  const roughStep = span / 6
  const magnitude = 10 ** Math.floor(Math.log10(roughStep))
  const stepMultiplier = [1, 2, 5, 10].find((multiplier) => roughStep <= magnitude * multiplier) ?? 10
  const step = magnitude * stepMultiplier
  const ticks = new Set<number>([startYear, endYear])
  const firstTick = Math.ceil(startYear / step) * step

  for (let year = firstTick; year <= endYear; year += step) {
    ticks.add(year)
  }

  return [...ticks].sort((left, right) => left - right)
}

export function TimelineRuler({
  entries,
  fromYear,
  labels,
  onSelectEntry,
  selectedEntryId,
  toYear,
}: TimelineRulerProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const dragStateRef = useRef<{ pointerId: number; startX: number; scrollLeft: number; didDrag: boolean } | null>(null)
  const recentTimelineDragRef = useRef(false)
  const [isTimelineDragging, setTimelineDragging] = useState(false)
  const filteredRange = normalizeTimelineRange(fromYear, toYear)
  const datedEntries = entries
    .map((entry) => ({ entry, year: entryTimelineYear(entry) }))
    .filter((item): item is { entry: TimelineEntry; year: number } => item.year !== null)
    .filter(
      (item) =>
        (filteredRange.from === null || item.year >= filteredRange.from) &&
        (filteredRange.to === null || item.year <= filteredRange.to),
    )
    .sort((left, right) => left.year - right.year || left.entry.title.localeCompare(right.entry.title))

  if (datedEntries.length === 0) {
    return (
      <section className="timeline-ruler" aria-label={labels.timeline}>
        <div className="timeline-ruler-empty">{labels.noTimelineEntries}</div>
      </section>
    )
  }

  const minYear = filteredRange.from ?? datedEntries[0].year
  const maxYear = filteredRange.to ?? datedEntries[datedEntries.length - 1].year
  const timelineStart = Math.min(minYear, maxYear)
  const timelineEnd = Math.max(minYear, maxYear)
  const range = Math.max(timelineEnd - timelineStart, 1)
  const pixelsPerYear = range <= 300 ? 10 : range <= 1200 ? 4 : range <= 10000 ? 1.2 : range <= 100000 ? 0.18 : 0.035
  const timelineContentWidth = Math.min(Math.max(1120, Math.ceil(range * pixelsPerYear), datedEntries.length * 44), 24000)
  const trackWidth = timelineContentWidth + timelineEdgePaddingPx * 2
  const positionForYear = (year: number) => timelineEdgePaddingPx + ((year - timelineStart) / range) * timelineContentWidth
  const laneLastX = [-Number.MAX_SAFE_INTEGER, -Number.MAX_SAFE_INTEGER, -Number.MAX_SAFE_INTEGER]
  const placedEntries = datedEntries.map(({ entry, year }) => {
    const left = positionForYear(year)
    const x = left
    const lane = laneLastX.findIndex((lastX) => x - lastX >= 34)
    const resolvedLane = lane === -1 ? laneLastX.indexOf(Math.min(...laneLastX)) : lane
    laneLastX[resolvedLane] = x
    return {
      entry,
      lane: resolvedLane,
      left,
      year,
    }
  })
  const ticks = createTimelineTicks(timelineStart, timelineEnd)

  function scrollTimelineBy(direction: -1 | 1) {
    const timeline = scrollRef.current
    if (!timeline) {
      return
    }

    timeline.scrollBy({
      behavior: 'smooth',
      left: direction * Math.max(360, timeline.clientWidth * 0.75),
    })
  }

  function scrollTimelineWithWheel(event: WheelEvent<HTMLDivElement>) {
    if (!scrollRef.current) {
      return
    }

    const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY
    if (delta === 0) {
      return
    }

    event.preventDefault()
    scrollRef.current.scrollLeft += delta
  }

  function beginTimelineDrag(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0 || !scrollRef.current) {
      return
    }

    if (event.target instanceof Element && event.target.closest('.timeline-event')) {
      return
    }

    dragStateRef.current = {
      didDrag: false,
      pointerId: event.pointerId,
      scrollLeft: scrollRef.current.scrollLeft,
      startX: event.clientX,
    }
    scrollRef.current.setPointerCapture(event.pointerId)
  }

  function moveTimelineDrag(event: PointerEvent<HTMLDivElement>) {
    const dragState = dragStateRef.current
    if (!dragState || !scrollRef.current || dragState.pointerId !== event.pointerId) {
      return
    }

    const deltaX = event.clientX - dragState.startX
    if (Math.abs(deltaX) > 4) {
      dragState.didDrag = true
      recentTimelineDragRef.current = true
      setTimelineDragging(true)
    }
    scrollRef.current.scrollLeft = dragState.scrollLeft - deltaX
  }

  function endTimelineDrag(event: PointerEvent<HTMLDivElement>) {
    const dragState = dragStateRef.current
    if (!dragState || dragState.pointerId !== event.pointerId) {
      return
    }

    if (scrollRef.current?.hasPointerCapture(event.pointerId)) {
      scrollRef.current.releasePointerCapture(event.pointerId)
    }
    dragStateRef.current = null
    setTimelineDragging(false)
    window.setTimeout(() => {
      recentTimelineDragRef.current = false
    }, 0)
  }

  return (
    <section className="timeline-ruler" aria-label={labels.timeline}>
      <div className="timeline-ruler-header">
        <div className="timeline-ruler-title">{labels.timeline}</div>
        <div className="timeline-ruler-controls">
          <button
            className="timeline-nav-button"
            type="button"
            aria-label="Scroll timeline left"
            onClick={() => scrollTimelineBy(-1)}
          >
            <ChevronLeft aria-hidden="true" />
          </button>
          <button
            className="timeline-nav-button"
            type="button"
            aria-label="Scroll timeline right"
            onClick={() => scrollTimelineBy(1)}
          >
            <ChevronRight aria-hidden="true" />
          </button>
        </div>
      </div>
      <div
        className={isTimelineDragging ? 'timeline-scroll dragging' : 'timeline-scroll'}
        ref={scrollRef}
        onClickCapture={(event) => {
          if (recentTimelineDragRef.current) {
            event.preventDefault()
            event.stopPropagation()
          }
        }}
        onPointerCancel={endTimelineDrag}
        onPointerDown={beginTimelineDrag}
        onPointerMove={moveTimelineDrag}
        onPointerUp={endTimelineDrag}
        onWheel={scrollTimelineWithWheel}
      >
        <div className="timeline-track" style={{ width: `${trackWidth}px` }}>
          {ticks.map((tick) => (
            <div className="timeline-tick" key={tick} style={{ left: `${positionForYear(tick)}px` }}>
              <span>{timelineYearLabel(tick)}</span>
            </div>
          ))}
          {placedEntries.map(({ entry, lane, left, year }) => (
            <button
              className={entry.id === selectedEntryId ? 'timeline-event active' : 'timeline-event'}
              key={entry.id}
              style={{ left: `${left}px`, top: `${4 + lane * 25}px` }}
              title={`${entry.title} (${entry.dateLabel ?? timelineYearLabel(year)})`}
              type="button"
              onClick={() => {
                if (!recentTimelineDragRef.current) {
                  onSelectEntry(entry.id)
                }
              }}
            >
              <Icon icon={entryIconKey(entry)} aria-hidden="true" />
            </button>
          ))}
        </div>
      </div>
    </section>
  )
}
