import { ChevronDown, Music, SkipForward, X } from 'lucide-react'
import type { RefObject } from 'react'

type ActiveAudio = {
  entryId: string
  title: string
  subtitle?: string | null
  url: string
}

type PersistentAudioPlayerLabels = {
  minimizeAudio: string
  nowPlaying: string
  openPlayingEntry: string
  playNext: string
  restoreAudio: string
  stopAudio: string
}

type PersistentAudioPlayerProps = {
  activeAudio: ActiveAudio
  audioRef: RefObject<HTMLAudioElement | null>
  isMinimized: boolean
  labels: PersistentAudioPlayerLabels
  playableRandomEntryCount: number
  onEnded: () => void
  onMinimize: () => void
  onOpenEntry: () => void
  onPlayNext: () => void
  onRestore: () => void
  onStop: () => void
}

export function PersistentAudioPlayer({
  activeAudio,
  audioRef,
  isMinimized,
  labels,
  onEnded,
  onMinimize,
  onOpenEntry,
  onPlayNext,
  onRestore,
  onStop,
  playableRandomEntryCount,
}: PersistentAudioPlayerProps) {
  return (
    <aside
      className={isMinimized ? 'persistent-audio-player minimized' : 'persistent-audio-player'}
      aria-label={labels.nowPlaying}
    >
      <button className="persistent-audio-restore" type="button" aria-label={labels.restoreAudio} title={activeAudio.title} onClick={onRestore}>
        <Music aria-hidden="true" />
      </button>
      <button
        className="persistent-audio-summary"
        type="button"
        aria-label={labels.openPlayingEntry}
        title={labels.openPlayingEntry}
        onClick={onOpenEntry}
      >
        <span>{labels.nowPlaying}</span>
        <strong>{activeAudio.title}</strong>
        {activeAudio.subtitle && <small>{activeAudio.subtitle}</small>}
      </button>
      <div className="persistent-audio-actions">
        <button
          className="icon-button subtle"
          type="button"
          aria-label={labels.playNext}
          title={labels.playNext}
          disabled={playableRandomEntryCount <= 1}
          onClick={onPlayNext}
        >
          <SkipForward aria-hidden="true" />
        </button>
        <button className="icon-button subtle" type="button" aria-label={labels.minimizeAudio} title={labels.minimizeAudio} onClick={onMinimize}>
          <ChevronDown aria-hidden="true" />
        </button>
        <button className="icon-button subtle" type="button" aria-label={labels.stopAudio} title={labels.stopAudio} onClick={onStop}>
          <X aria-hidden="true" />
        </button>
      </div>
      <audio ref={audioRef} controls onEnded={onEnded} src={activeAudio.url}>
        <track kind="captions" />
      </audio>
    </aside>
  )
}
