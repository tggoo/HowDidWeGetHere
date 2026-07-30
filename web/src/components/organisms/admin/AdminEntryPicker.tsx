import { RefreshCw } from 'lucide-react'
import { VirtualizedList } from '../../molecules/VirtualizedList'

type AdminEntrySummary = {
  id: string
  kind: string
  status: string
  title: string
}

type AdminEntryPickerProps = {
  activeEntryId: string | null
  entries: AdminEntrySummary[]
  isLoading: boolean
  onReload: () => void | Promise<void>
  onSelectEntry: (entryId: string) => void | Promise<void>
}

export function AdminEntryPicker({
  activeEntryId,
  entries,
  isLoading,
  onReload,
  onSelectEntry,
}: AdminEntryPickerProps) {
  return (
    <div className="admin-entry-list">
      <button className="admin-action secondary" disabled={isLoading} type="button" onClick={onReload}>
        <RefreshCw aria-hidden="true" />
        {isLoading ? 'Loading...' : 'Reload entries'}
      </button>
      <VirtualizedList
        ariaLabel="Admin entries"
        className="admin-entry-virtual-list"
        getKey={(entry) => entry.id}
        height={Math.min(360, Math.max(80, entries.length * 62))}
        itemHeight={62}
        items={entries}
        renderItem={(entry) => (
          <button
            className={activeEntryId === entry.id ? 'admin-entry active' : 'admin-entry'}
            type="button"
            onClick={() => onSelectEntry(entry.id)}
          >
            <span>{entry.title}</span>
            <small>
              {entry.status} / {entry.kind}
            </small>
          </button>
        )}
      />
    </div>
  )
}
