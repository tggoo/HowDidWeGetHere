import { BadgeInfo, ChevronRight, Layers, MapPinned, Mountain, PanelRight, X } from 'lucide-react'
import type { ReactNode } from 'react'
import { minMaxCategoryLabel, type MinMaxItem } from '../../features/minMax/minMax'

export type MinMaxDetailPanelLabels = {
  close: string
  collapse: string
  facts: string
  mapNote: string
  noSelection: string
  selected: string
}

type MinMaxDetailPanelProps = {
  className: string
  labels: MinMaxDetailPanelLabels
  language: string
  selectedItem: MinMaxItem | null
  shellControls: ReactNode
  onClose: () => void
  onCollapse: () => void
}

export function MinMaxDetailPanel({
  className,
  labels,
  language,
  onClose,
  onCollapse,
  selectedItem,
  shellControls,
}: MinMaxDetailPanelProps) {
  return (
    <aside className={className}>
      {shellControls}
      <div className="panel-header">
        <span>
          <PanelRight aria-hidden="true" />
          {labels.selected}
        </span>
        <div className="panel-header-actions">
          <button
            className="panel-collapse-button desktop-only"
            type="button"
            aria-label={labels.collapse}
            title={labels.collapse}
            onClick={onCollapse}
          >
            <ChevronRight aria-hidden="true" />
          </button>
          <button className="panel-close" type="button" aria-label={labels.close} title={labels.close} onClick={onClose}>
            <X aria-hidden="true" />
          </button>
        </div>
      </div>

      {selectedItem ? (
        <>
          <div className="world-division-title-row">
            <Mountain aria-hidden="true" />
            <div>
              <h1>{selectedItem.title}</h1>
              <p>{selectedItem.subtitle ?? selectedItem.valueLabel ?? minMaxCategoryLabel(selectedItem.category, language)}</p>
            </div>
          </div>

          <div className="entry-meta">
            <span>{selectedItem.typeLabel ?? minMaxCategoryLabel(selectedItem.category, language)}</span>
            {selectedItem.valueLabel && <span>{selectedItem.valueLabel}</span>}
          </div>

          {selectedItem.summary && (
            <div className="entry-text-section entry-summary-section">
              <div className="entry-section-header">
                <strong>{selectedItem.title}</strong>
              </div>
              <p>{selectedItem.summary}</p>
            </div>
          )}

          {selectedItem.facts.length > 0 && (
            <div className="detail-list world-division-detail-list">
              <strong>
                <BadgeInfo aria-hidden="true" />
                {labels.facts}
              </strong>
              <ul className="world-division-facts">
                {selectedItem.facts.map((fact) => (
                  <li key={fact}>{fact}</li>
                ))}
              </ul>
            </div>
          )}

          {selectedItem.mapNote && (
            <div className="route-card world-division-map-note-card">
              <Layers aria-hidden="true" />
              <div>
                <div className="entry-section-header">
                  <strong>{labels.mapNote}</strong>
                </div>
                <p>{selectedItem.mapNote}</p>
              </div>
            </div>
          )}

          <div className="route-card world-division-map-note-card">
            <MapPinned aria-hidden="true" />
            <p>{minMaxCategoryLabel(selectedItem.category, language)}</p>
          </div>
        </>
      ) : (
        <p className="world-division-empty">{labels.noSelection}</p>
      )}
    </aside>
  )
}
