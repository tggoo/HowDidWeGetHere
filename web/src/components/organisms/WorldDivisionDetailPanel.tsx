import { BadgeInfo, ChevronRight, Layers, LocateFixed, MapPinned, PanelRight, PlayCircle, X } from 'lucide-react'
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
  playAll: string
  selected: string
}

type WorldDivisionAudio = {
  entryId?: string
  worldDivisionId?: string
  title: string
  subtitle?: string | null
  url: string
}

type WorldDivisionDetailPanelProps = {
  audioSequence: WorldDivisionAudio[]
  className: string
  factsAudio: WorldDivisionAudio | null
  labels: WorldDivisionDetailPanelLabels
  language: string
  mapNoteAudio: WorldDivisionAudio | null
  renderPlayButton: (audio: WorldDivisionAudio | null) => ReactNode
  selectedDivision: WorldDivision | null
  shellControls: ReactNode
  summaryAudio: WorldDivisionAudio | null
  titleAudio: WorldDivisionAudio | null
  onClose: () => void
  onCollapse: () => void
  onPlayAudioSequence: (sequence: WorldDivisionAudio[]) => void
}

export function WorldDivisionDetailPanel({
  audioSequence,
  className,
  factsAudio,
  labels,
  language,
  mapNoteAudio,
  onClose,
  onCollapse,
  onPlayAudioSequence,
  renderPlayButton,
  selectedDivision,
  shellControls,
  summaryAudio,
  titleAudio,
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
            {renderPlayButton(titleAudio)}
          </div>

          <div className="entry-meta">
            <span>{worldDivisionText(selectedDivision.typeLabel, language)}</span>
            {category && <span>{worldDivisionText(category.title, language)}</span>}
          </div>

          {audioSequence.length > 0 && (
            <div className="entry-audio-actions">
              <button className="play-all-button" type="button" onClick={() => onPlayAudioSequence(audioSequence)}>
                <PlayCircle aria-hidden="true" />
                {labels.playAll}
              </button>
            </div>
          )}

          <div className="entry-text-section entry-summary-section">
            <div className="entry-section-header">
              <strong>{worldDivisionText(selectedDivision.title, language)}</strong>
              {renderPlayButton(summaryAudio)}
            </div>
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
            <div className="entry-section-header">
              <strong>
                <BadgeInfo aria-hidden="true" />
                {labels.facts}
              </strong>
              {renderPlayButton(factsAudio)}
            </div>
            <ul className="world-division-facts">
              {facts.map((fact) => (
                <li key={fact}>{fact}</li>
              ))}
            </ul>
          </div>

          <div className="route-card world-division-map-note-card">
            <Layers aria-hidden="true" />
            <div>
              <div className="entry-section-header">
                <strong>{labels.mapNote}</strong>
                {renderPlayButton(mapNoteAudio)}
              </div>
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
