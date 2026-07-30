import { CheckCircle2, ChevronLeft, ChevronRight, PanelRight, PlayCircle, Route, X } from 'lucide-react'
import type { ReactNode } from 'react'
import { MarkdownText } from '../../content/MarkdownText'

type EntrySummary = {
  id: string
  kind?: string | null
  slug?: string | null
  title?: string | null
  dateLabel?: string | null
}

type EntryImageItem = {
  image: {
    id: string
    altText?: string | null
  }
  url: string
}

type EntryAudio = {
  entryId: string
  title: string
  subtitle?: string | null
  url: string
}

type RelatedEntryGroup = {
  direction: string
  entries: Array<{
    direction: string
    entryId: string
    relationshipType: string
    title: string
  }>
}

type EntryDetail = EntrySummary & {
  realityStatus?: string | null
  summary?: string | null
  description?: string | null
  whyItMatters?: string | null
  places: Array<{
    placeId: string
    role: string
    name: string
  }>
  tags: Array<{
    id: string
    name: string
  }>
  routes: Array<{
    name: string
    routeType: string
    points: unknown[]
  }>
  sources: Array<{
    sourceId: string
    supportsField: string
    url: string
    title?: string | null
    publisher?: string | null
  }>
}

type EntryDetailPanelLabels = {
  collapseEntryDetail: string
  closeEntryDetail: string
  dateUnknown: string
  description: string
  expandImage: string
  imageIndicator: (current: number, total: number) => string
  imageSlide: (current: number, total: number) => string
  knownPoints: (count: number) => string
  nextImage: string
  places: string
  playAll: string
  previousImage: string
  relatedTopics: string
  routeRecords: (count: number) => string
  selectedEntry: string
  sources: string
  summary: string
  whyItMatters: string
}

type EntryDetailPanelProps = {
  activeEntryImageIndex: number
  adminToken: string | null
  className: string
  copiedEntrySlug: string | null
  descriptionAudio: EntryAudio | null
  hasMultipleEntryImages: boolean
  language: string
  labels: EntryDetailPanelLabels
  relatedEntryGroups: RelatedEntryGroup[]
  selectedEntry: EntrySummary | undefined
  selectedEntryDetail: EntryDetail | null
  selectedEntryId: string
  selectedEntryImage?: EntryImageItem['image'] | null
  selectedEntryImageCount: number
  selectedEntryImages: EntryImageItem[]
  selectedEntryImageUrl: string | null
  selectedEntrySlug: string | null
  shellControls: ReactNode
  summaryAudio: EntryAudio | null
  titleAudio: EntryAudio | null
  ultimateAudioSequence: EntryAudio[]
  whyItMattersAudio: EntryAudio | null
  relationshipDirectionLabel: (direction: string, language: string) => string
  relationshipLabel: (type: string, language: string) => string
  renderPlayButton: (audio: EntryAudio | null) => ReactNode
  onClose: () => void
  onCollapse: () => void
  onCopyEntrySlug: (slug: string) => void
  onExpandImage: () => void
  onPlayAudioSequence: (sequence: EntryAudio[]) => void
  onSelectRelatedEntry: (entryId: string) => void
  onShowAdjacentImage: (direction: -1 | 1) => void
  onShowEntryImage: (index: number) => void
}

export function EntryDetailPanel({
  activeEntryImageIndex,
  adminToken,
  className,
  copiedEntrySlug,
  descriptionAudio,
  hasMultipleEntryImages,
  labels,
  language,
  onClose,
  onCollapse,
  onCopyEntrySlug,
  onExpandImage,
  onPlayAudioSequence,
  onSelectRelatedEntry,
  onShowAdjacentImage,
  onShowEntryImage,
  relatedEntryGroups,
  relationshipDirectionLabel,
  relationshipLabel,
  renderPlayButton,
  selectedEntry,
  selectedEntryDetail,
  selectedEntryId,
  selectedEntryImage,
  selectedEntryImageCount,
  selectedEntryImages,
  selectedEntryImageUrl,
  selectedEntrySlug,
  shellControls,
  summaryAudio,
  titleAudio,
  ultimateAudioSequence,
  whyItMattersAudio,
}: EntryDetailPanelProps) {
  return (
    <aside className={className}>
      {shellControls}
      <div className="panel-header">
        <span>
          <PanelRight aria-hidden="true" />
          {labels.selectedEntry}
        </span>
        <div className="panel-header-actions">
          <button
            className="panel-collapse-button desktop-only"
            type="button"
            aria-label={labels.collapseEntryDetail}
            title={labels.collapseEntryDetail}
            onClick={onCollapse}
          >
            <ChevronRight aria-hidden="true" />
          </button>
          <button className="panel-close" type="button" aria-label={labels.closeEntryDetail} title={labels.closeEntryDetail} onClick={onClose}>
            <X aria-hidden="true" />
          </button>
        </div>
      </div>
      <div className="entry-title-row">
        <div className="entry-title-main">
          <h1>{selectedEntryDetail?.title ?? selectedEntry?.title}</h1>
          {adminToken && selectedEntrySlug && (
            <button
              className={copiedEntrySlug === selectedEntrySlug ? 'entry-slug-copy copied' : 'entry-slug-copy'}
              type="button"
              aria-label={`Copy entry slug ${selectedEntrySlug}`}
              title="Copy entry slug"
              onClick={() => onCopyEntrySlug(selectedEntrySlug)}
            >
              {selectedEntrySlug}
            </button>
          )}
        </div>
        {renderPlayButton(titleAudio)}
      </div>
      <div className="entry-meta">
        <span>{selectedEntry?.kind}</span>
        <span>{selectedEntry?.dateLabel ?? labels.dateUnknown}</span>
        {selectedEntryDetail?.realityStatus && <span>{selectedEntryDetail.realityStatus}</span>}
      </div>
      {ultimateAudioSequence.length > 0 && (
        <div className="entry-audio-actions">
          <button className="play-all-button" type="button" onClick={() => onPlayAudioSequence(ultimateAudioSequence)}>
            <PlayCircle aria-hidden="true" />
            {labels.playAll}
          </button>
        </div>
      )}
      {selectedEntryImageUrl && (
        <div className="entry-image-carousel">
          <div className="entry-image-stage">
            <button
              className="entry-image-trigger"
              type="button"
              aria-label={`${labels.expandImage}. ${labels.imageSlide(activeEntryImageIndex + 1, selectedEntryImageCount)}`}
              title={labels.expandImage}
              onClick={onExpandImage}
            >
              <img
                alt={selectedEntryImage?.altText ?? selectedEntryDetail?.title ?? selectedEntry?.title ?? ''}
                className="entry-image"
                src={selectedEntryImageUrl}
              />
            </button>
            {hasMultipleEntryImages && (
              <>
                <button
                  className="entry-image-nav previous"
                  type="button"
                  aria-label={labels.previousImage}
                  title={labels.previousImage}
                  onClick={() => onShowAdjacentImage(-1)}
                >
                  <ChevronLeft aria-hidden="true" />
                </button>
                <button
                  className="entry-image-nav next"
                  type="button"
                  aria-label={labels.nextImage}
                  title={labels.nextImage}
                  onClick={() => onShowAdjacentImage(1)}
                >
                  <ChevronRight aria-hidden="true" />
                </button>
              </>
            )}
          </div>
          {hasMultipleEntryImages && (
            <div className="entry-image-indicators" aria-label={labels.imageSlide(activeEntryImageIndex + 1, selectedEntryImageCount)}>
              {selectedEntryImages.map((item, index) => (
                <button
                  className={index === activeEntryImageIndex ? 'active' : undefined}
                  key={item.image.id}
                  type="button"
                  aria-current={index === activeEntryImageIndex ? 'true' : undefined}
                  aria-label={labels.imageIndicator(index + 1, selectedEntryImageCount)}
                  onClick={() => onShowEntryImage(index)}
                />
              ))}
            </div>
          )}
        </div>
      )}
      {selectedEntryDetail?.summary && (
        <div className="entry-text-section entry-summary-section">
          <div className="entry-section-header">
            <strong>{labels.summary}</strong>
            {renderPlayButton(summaryAudio)}
          </div>
          <MarkdownText markdown={selectedEntryDetail.summary} />
        </div>
      )}
      {selectedEntryDetail?.description && (
        <div className="entry-text-section">
          <div className="entry-section-header">
            <strong>{labels.description}</strong>
            {renderPlayButton(descriptionAudio)}
          </div>
          <MarkdownText markdown={selectedEntryDetail.description} />
        </div>
      )}
      {selectedEntryDetail?.whyItMatters && (
        <div className="route-card">
          <CheckCircle2 aria-hidden="true" />
          <div>
            <div className="entry-section-header">
              <strong>{labels.whyItMatters}</strong>
              {renderPlayButton(whyItMattersAudio)}
            </div>
            <MarkdownText markdown={selectedEntryDetail.whyItMatters} />
          </div>
        </div>
      )}
      {selectedEntryDetail?.routes.length ? (
        <div className="route-card">
          <Route aria-hidden="true" />
          <div>
            <strong>{labels.routeRecords(selectedEntryDetail.routes.length)}</strong>
            {selectedEntryDetail.routes[0] && (
              <p>
                {selectedEntryDetail.routes[0].name || selectedEntryDetail.routes[0].routeType}: {' '}
                {labels.knownPoints(selectedEntryDetail.routes[0].points.length)}
              </p>
            )}
          </div>
        </div>
      ) : null}
      {selectedEntryDetail?.places.length ? (
        <div className="detail-list">
          <strong>{labels.places}</strong>
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
      {relatedEntryGroups.length ? (
        <div className="detail-list">
          <strong>{labels.relatedTopics}</strong>
          {relatedEntryGroups.map((group) => (
            <div className="relationship-group" key={group.direction}>
              <span>{relationshipDirectionLabel(group.direction, language)}</span>
              {group.entries.map((entry) => (
                <button
                  key={`${entry.direction}-${entry.entryId}-${entry.relationshipType}`}
                  type="button"
                  onClick={() => onSelectRelatedEntry(entry.entryId || selectedEntryId)}
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
          <strong>{labels.sources}</strong>
          {selectedEntryDetail.sources.slice(0, 4).map((source) => (
            <a href={source.url} key={`${source.sourceId}-${source.supportsField}`} rel="noreferrer" target="_blank">
              {source.title ?? source.publisher ?? source.url}
            </a>
          ))}
        </div>
      ) : null}
    </aside>
  )
}
