import {
  FileQuestion,
  HardDriveDownload,
  Image as ImageIcon,
  Languages,
  Music,
  RefreshCw,
  Trash2,
  X,
} from 'lucide-react'
import type { MediaCacheProgress } from '../../store/appStore'
import type {
  OfflineMediaCacheItem,
  OfflineMediaDownloadLanguage,
  OfflineMediaSummary,
} from '../../lib/offlineMediaCache'
import { VirtualizedList } from '../molecules/VirtualizedList'

type OfflineMediaPanelLabels = {
  audio: string
  audioLanguages: string
  cachedEntries: string
  cachedFiles: string
  caching: string
  clear: string
  close: string
  downloadAudioLanguage: string
  downloadMedia: string
  downloadLanguageAll: string
  downloadLanguageCs: string
  downloadLanguageEn: string
  empty: string
  includeImages: string
  images: string
  noLanguages: string
  otherFiles: string
  refresh: string
  title: string
  unavailable: string
  unknownEntry: string
  unknownSize: string
}

type OfflineMediaPanelProps = {
  formatBytes: (bytes: number) => string
  isInspecting: boolean
  isMediaPrefetching: boolean
  isOfflineCacheAvailable: boolean
  labels: OfflineMediaPanelLabels
  mediaCacheProgress: MediaCacheProgress | null
  mediaCacheStatus: string
  summary: OfflineMediaSummary
  downloadLanguage: OfflineMediaDownloadLanguage
  includeImages: boolean
  downloadSourceCount: number
  onClear: () => void | Promise<void>
  onClose: () => void
  onDownloadVisible: () => void | Promise<void>
  onDownloadLanguageChange: (language: OfflineMediaDownloadLanguage) => void
  onIncludeImagesChange: (includeImages: boolean) => void
  onRefresh: () => void | Promise<void>
}

export function OfflineMediaPanel({
  downloadLanguage,
  formatBytes,
  includeImages,
  isInspecting,
  isMediaPrefetching,
  isOfflineCacheAvailable,
  labels,
  mediaCacheProgress,
  mediaCacheStatus,
  onClear,
  onClose,
  onDownloadLanguageChange,
  onDownloadVisible,
  onIncludeImagesChange,
  onRefresh,
  summary,
  downloadSourceCount,
}: OfflineMediaPanelProps) {
  const languageLabel = summary.languages.length > 0
    ? summary.languages.map((language) => language.toUpperCase()).join(', ')
    : labels.noLanguages

  return (
    <aside className="offline-media-panel" aria-label={labels.title}>
      <div className="panel-header">
        <span>
          <HardDriveDownload aria-hidden="true" />
          {labels.title}
        </span>
        <button
          className="panel-close"
          type="button"
          aria-label={labels.close}
          title={labels.close}
          onClick={onClose}
        >
          <X aria-hidden="true" />
        </button>
      </div>

      <div className="offline-media-status">
        <HardDriveDownload aria-hidden="true" />
        <span>{isOfflineCacheAvailable ? mediaCacheStatus || labels.empty : labels.unavailable}</span>
      </div>

      {mediaCacheProgress && (
        <progress
          className="offline-media-progress"
          max={mediaCacheProgress.total || 1}
          value={mediaCacheProgress.completed + mediaCacheProgress.failed}
        />
      )}

      <div className="offline-media-options">
        <label>
          <span>{labels.downloadAudioLanguage}</span>
          <select
            value={downloadLanguage}
            disabled={isMediaPrefetching}
            onChange={(event) => onDownloadLanguageChange(event.target.value as OfflineMediaDownloadLanguage)}
          >
            <option value="all">{labels.downloadLanguageAll}</option>
            <option value="cs">{labels.downloadLanguageCs}</option>
            <option value="en">{labels.downloadLanguageEn}</option>
          </select>
        </label>
        <label className="offline-media-checkbox">
          <input
            type="checkbox"
            checked={downloadLanguage === 'all' || includeImages}
            disabled={isMediaPrefetching || downloadLanguage === 'all'}
            onChange={(event) => onIncludeImagesChange(event.target.checked)}
          />
          <span>{labels.includeImages}</span>
        </label>
      </div>

      <div className="offline-media-actions">
        <button
          type="button"
          disabled={!isOfflineCacheAvailable || isMediaPrefetching || downloadSourceCount === 0}
          onClick={onDownloadVisible}
        >
          <HardDriveDownload aria-hidden="true" />
          {isMediaPrefetching ? labels.caching : labels.downloadMedia}
        </button>
        <button type="button" disabled={!isOfflineCacheAvailable || isInspecting} onClick={onRefresh}>
          <RefreshCw aria-hidden="true" className={isInspecting ? 'spin-icon' : undefined} />
          {labels.refresh}
        </button>
        <button type="button" disabled={!isOfflineCacheAvailable || isMediaPrefetching} onClick={onClear}>
          <Trash2 aria-hidden="true" />
          {labels.clear}
        </button>
      </div>

      <div className="offline-media-stats">
        <Stat label={labels.cachedEntries} value={summary.cachedEntryCount} />
        <Stat label={labels.cachedFiles} value={summary.items.length} />
        <Stat label={labels.images} value={summary.imageCount} />
        <Stat label={labels.audio} value={summary.audioCount} />
        <Stat label={labels.otherFiles} value={summary.otherCount} />
        <Stat label={labels.audioLanguages} value={languageLabel} />
      </div>

      <div className="offline-media-files-header">
        <strong>{labels.cachedFiles}</strong>
        {summary.totalSizeBytes !== null && <span>{formatBytes(summary.totalSizeBytes)}</span>}
      </div>

      {summary.items.length === 0 ? (
        <span className="offline-media-empty">{labels.empty}</span>
      ) : (
        <VirtualizedList
          ariaLabel={labels.cachedFiles}
          className="offline-media-list"
          getKey={(item) => item.url}
          height={Math.min(420, Math.max(96, summary.items.length * 74))}
          itemHeight={74}
          items={summary.items}
          renderItem={(item) => (
            <OfflineMediaFileRow item={item} formatBytes={formatBytes} labels={labels} />
          )}
        />
      )}
    </aside>
  )
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="offline-media-stat">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  )
}

function OfflineMediaFileRow({
  formatBytes,
  item,
  labels,
}: {
  formatBytes: (bytes: number) => string
  item: OfflineMediaCacheItem
  labels: OfflineMediaPanelLabels
}) {
  const KindIcon = item.kind === 'image' ? ImageIcon : item.kind === 'audio' ? Music : FileQuestion
  const kindLabel = item.kind === 'image' ? labels.images : item.kind === 'audio' ? labels.audio : labels.otherFiles
  const sizeLabel = item.sizeBytes === null ? labels.unknownSize : formatBytes(item.sizeBytes)

  return (
    <div className="offline-media-file">
      <KindIcon aria-hidden="true" />
      <span>
        {item.entryTitle ?? item.label ?? item.fileName}
        <small>
          {kindLabel}
          {item.languageCode ? ` / ${item.languageCode.toUpperCase()}` : ''}
          {' / '}
          {sizeLabel}
        </small>
        <small>{item.entryTitle ? item.fileName : labels.unknownEntry}</small>
      </span>
      {item.kind === 'audio' && item.languageCode && (
        <span className="offline-media-language">
          <Languages aria-hidden="true" />
          {item.languageCode.toUpperCase()}
        </span>
      )}
    </div>
  )
}
