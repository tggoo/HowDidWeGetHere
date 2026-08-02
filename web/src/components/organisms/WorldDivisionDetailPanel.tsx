import { BadgeInfo, ChevronRight, Layers, LocateFixed, MapPinned, PanelRight, X } from 'lucide-react'
import type { ReactNode } from 'react'
import {
  worldDivisionCategories,
  worldDivisionList,
  worldDivisionText,
  type WorldDivision,
} from '../../features/worldDivisions/worldDivisions'

export type WorldDivisionDetailPanelLabels = {
  close: string
  collapse: string
  facts: string
  includes: string
  mapNote: string
  noSelection: string
  selected: string
}

type WorldDivisionDetailPanelProps = {
  className: string
  labels: WorldDivisionDetailPanelLabels
  language: string
  selectedDivision: WorldDivision | null
  shellControls: ReactNode
  onClose: () => void
  onCollapse: () => void
}

export function WorldDivisionDetailPanel({
  className,
  labels,
  language,
  onClose,
  onCollapse,
  selectedDivision,
  shellControls,
}: WorldDivisionDetailPanelProps) {
  const category = selectedDivision
    ? worldDivisionCategories.find((item) => item.id === selectedDivision.categoryId)
    : null
  const members = selectedDivision ? worldDivisionList(selectedDivision.members, language) : []
  const facts = selectedDivision ? worldDivisionList(selectedDivision.facts, language) : []

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

      {selectedDivision ? (
        <>
          <div className="world-division-title-row">
            <MapPinned aria-hidden="true" />
            <div>
              <h1>{worldDivisionText(selectedDivision.title, language)}</h1>
              <p>{worldDivisionText(selectedDivision.subtitle, language)}</p>
            </div>
          </div>

          <div className="entry-meta">
            <span>{worldDivisionText(selectedDivision.typeLabel, language)}</span>
            {category && <span>{worldDivisionText(category.title, language)}</span>}
          </div>

          <div className="entry-text-section entry-summary-section">
            <strong>{worldDivisionText(selectedDivision.title, language)}</strong>
            <p>{worldDivisionText(selectedDivision.summary, language)}</p>
          </div>

          {members.length > 0 && (
            <div className="detail-list world-division-detail-list">
              <strong>
                <LocateFixed aria-hidden="true" />
                {labels.includes}
              </strong>
              <div className="world-division-chip-list">
                {members.map((member) => (
                  <span className="world-division-chip" key={member}>
                    {member}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="detail-list world-division-detail-list">
            <strong>
              <BadgeInfo aria-hidden="true" />
              {labels.facts}
            </strong>
            <ul className="world-division-facts">
              {facts.map((fact) => (
                <li key={fact}>{fact}</li>
              ))}
            </ul>
          </div>

          <div className="route-card world-division-map-note-card">
            <Layers aria-hidden="true" />
            <div>
              <strong>{labels.mapNote}</strong>
              <p>{worldDivisionText(selectedDivision.mapNote, language)}</p>
            </div>
          </div>
        </>
      ) : (
        <p className="world-division-empty">{labels.noSelection}</p>
      )}
    </aside>
  )
}
