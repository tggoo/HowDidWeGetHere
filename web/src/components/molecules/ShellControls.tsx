import { Filter, HardDriveDownload, Lock, Moon, Music, Sun } from 'lucide-react'
import type { ThemeMode } from '../../store/appStore'
import { IconButton } from '../atoms/IconButton'
import { LanguageSelect } from './LanguageSelect'

type ShellControlLabels = {
  language: string
  openOfflineMedia: string
  openAdminPanel: string
  openFilters: string
  playRandom: string
  switchToDarkMode: string
  switchToLightMode: string
}

type ShellControlsProps = {
  includeFilterButton: boolean
  isOfflineMediaPanelOpen: boolean
  labels: ShellControlLabels
  language: string
  offlineMediaFileCount: number
  playableRandomEntryCount: number
  theme: ThemeMode
  onLanguageChange: (language: string) => void
  onOpenAdminPanel: () => void
  onOpenFilters: () => void
  onOpenOfflineMedia: () => void
  onPlayRandom: () => void
  onToggleTheme: () => void
}

export function ShellControls({
  includeFilterButton,
  isOfflineMediaPanelOpen,
  labels,
  language,
  offlineMediaFileCount,
  onLanguageChange,
  onOpenAdminPanel,
  onOpenFilters,
  onOpenOfflineMedia,
  onPlayRandom,
  onToggleTheme,
  playableRandomEntryCount,
  theme,
}: ShellControlsProps) {
  const themeLabel = theme === 'dark' ? labels.switchToLightMode : labels.switchToDarkMode

  return (
    <div className={includeFilterButton ? 'topbar-actions' : 'desktop-panel-actions'}>
      {includeFilterButton && (
        <IconButton className="icon-button mobile-only" label={labels.openFilters} onClick={onOpenFilters}>
          <Filter aria-hidden="true" />
        </IconButton>
      )}
      <LanguageSelect label={labels.language} value={language} onChange={onLanguageChange} />
      <IconButton disabled={playableRandomEntryCount === 0} label={labels.playRandom} onClick={onPlayRandom}>
        <Music aria-hidden="true" />
      </IconButton>
      <IconButton
        className={isOfflineMediaPanelOpen ? 'icon-button active' : 'icon-button'}
        label={labels.openOfflineMedia}
        onClick={onOpenOfflineMedia}
      >
        <HardDriveDownload aria-hidden="true" />
        {offlineMediaFileCount > 0 && <span className="icon-button-badge">{offlineMediaFileCount}</span>}
      </IconButton>
      <IconButton label={themeLabel} onClick={onToggleTheme}>
        {theme === 'dark' ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
      </IconButton>
      <IconButton label={labels.openAdminPanel} onClick={onOpenAdminPanel}>
        <Lock aria-hidden="true" />
      </IconButton>
    </div>
  )
}
