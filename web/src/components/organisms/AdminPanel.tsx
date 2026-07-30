import { Icon } from '@iconify/react'
import {
  AlertCircle,
  CheckCircle2,
  GitCommitHorizontal,
  Image as ImageIcon,
  Lock,
  MapPin,
  Music,
  Plus,
  RefreshCw,
  Route,
  Save,
  Search,
  Tags,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import type { components } from '../../api/schema'
import type { AdminPage } from '../../store/appStore'
import { MarkdownEditor } from '../molecules/MarkdownEditor'

type ContentStatus = components['schemas']['ContentStatus']
type EntryKind = components['schemas']['EntryKind']
type EntryPlaceRole = components['schemas']['EntryPlaceRole']
type EntryRelationshipType = components['schemas']['EntryRelationshipType']
type PlaceType = components['schemas']['PlaceType']
type RealityStatus = components['schemas']['RealityStatus']
type RouteType = components['schemas']['RouteType']
type SourceSupportKind = components['schemas']['SourceSupportKind']
type SpatialConfidence = components['schemas']['SpatialConfidence']
type TimePeriodType = components['schemas']['TimePeriodType']
type TimePrecision = Exclude<components['schemas']['TimePrecision'], null>

type AdminPanelProps = Record<string, any>

export function AdminPanel(props: AdminPanelProps) {
  const {
    addEntryPlace,
    adminEmail,
    adminEntries,
    adminEntryAudioTracks,
    adminEntryImages,
    adminEntryPlaces,
    adminEntryRelationships,
    adminEntryRoutes,
    adminEntrySources,
    adminEntryTags,
    adminEntryTranslations,
    adminPage,
    adminPages,
    adminPassword,
    adminStatus,
    adminToken,
    attachTagToEntry,
    bulkAudioLanguage,
    bulkAudioPreview,
    bulkAudioResult,
    clearContentPackageBeforeImport,
    contentLanguages,
    contentPackageBatchItems,
    contentPackageFiles,
    contentPackageImportHistory,
    contentPackagePreview,
    contentPackageResult,
    contentPackageUploadProgress,
    contentStatuses,
    defaultTimePeriodForm,
    deleteEntryAudioTrack,
    deleteEntryImage,
    deleteEntryRelationship,
    deleteEntryRoute,
    deleteEntrySource,
    deleteTag,
    deleteTimePeriod,
    deploymentInfo,
    describeBatchProgress,
    describeImportStatus,
    detachTagFromEntry,
    entryForm,
    entryIconKey,
    entryKinds,
    entryPlaceRoles,
    formatBytes,
    formatDeploymentTime,
    formatImportTime,
    importContentPackage,
    isBulkAudioPreviewing,
    isBulkAudioUploading,
    isImportingContentPackage,
    isLoadingAdminEntries,
    isLoadingContentPackageImportHistory,
    isPreviewingContentPackage,
    language,
    loadAdminEntries,
    loadAdminEntryDetail,
    loadAudioForm,
    loadContentPackageImportHistory,
    loadImageForm,
    loadRelationshipForm,
    loadRouteForm,
    loadSourceForm,
    loadTagForm,
    loadTimePeriodForm,
    mediaForm,
    mediaInputResetKey,
    patchEntryForm,
    patchPlaceForm,
    patchRelationshipForm,
    patchRouteForm,
    patchSourceForm,
    patchTagForm,
    patchTimePeriodForm,
    periods,
    periodYearLabel,
    placeForm,
    placeTypes,
    previewBulkAudioZip,
    previewContentPackage,
    realityStatuses,
    relationshipForm,
    relationshipTypes,
    resetAudioForm,
    resetEntryForm,
    resetImageForm,
    resetRelationshipForm,
    resetRouteForm,
    resetSourceForm,
    routeForm,
    routeTypes,
    saveEntry,
    saveEntryRelationship,
    saveEntryRoute,
    saveEntrySource,
    savePrimaryAudio,
    savePrimaryImage,
    saveTag,
    saveTimePeriod,
    setAdminEmail,
    setAdminOpen,
    setAdminPage,
    setAdminPassword,
    setBulkAudioFile,
    setBulkAudioLanguage,
    setBulkAudioPreview,
    setBulkAudioResult,
    setClearContentPackageBeforeImport,
    setContentPackageBatchItems,
    setContentPackageFiles,
    setContentPackagePreview,
    setContentPackageResult,
    setContentPackageUploadProgress,
    setMediaForm,
    setTagForm,
    setTimePeriodForm,
    signInAdmin,
    signOutAdmin,
    sourceForm,
    sourceSupportKinds,
    spatialConfidences,
    summarizeImportHistoryItem,
    switchEntryLanguage,
    tagForm,
    tags,
    timePeriodForm,
    timePeriodTypes,
    timePrecisions,
    ui,
    uploadBulkAudioZip,
    uploadPrimaryAudioFile,
    uploadPrimaryImageFile,
  } = props

  return (
          <aside className="admin-panel" aria-label="Admin tools">
            <div className="panel-header">
              <span>
                <Lock aria-hidden="true" />
                Admin
              </span>
              <div className="panel-header-actions">
                {adminToken && (
                  <button className="panel-text-button" type="button" onClick={signOutAdmin}>
                    Sign out
                  </button>
                )}
                <button
                  className="panel-close"
                  type="button"
                  aria-label="Close admin panel"
                  title="Close admin panel"
                  onClick={() => setAdminOpen(false)}
                >
                  <X aria-hidden="true" />
                </button>
              </div>
            </div>
            <div className="admin-status">
              {adminToken ? <CheckCircle2 aria-hidden="true" /> : <AlertCircle aria-hidden="true" />}
              <span>{adminStatus}</span>
            </div>
            {adminToken && deploymentInfo && (
              <div className="admin-deployment-info">
                <GitCommitHorizontal aria-hidden="true" />
                <span>Deploy</span>
                {deploymentInfo.commitUrl && deploymentInfo.shortCommitSha ? (
                  <a href={deploymentInfo.commitUrl} target="_blank" rel="noreferrer">
                    {deploymentInfo.shortCommitSha}
                  </a>
                ) : (
                  <code>{deploymentInfo.shortCommitSha ?? 'unknown commit'}</code>
                )}
                <time dateTime={deploymentInfo.deployedAtUtc ?? undefined}>
                  {formatDeploymentTime(deploymentInfo.deployedAtUtc)}
                </time>
              </div>
            )}
            {!adminToken ? (
              <form className="admin-form" onSubmit={signInAdmin}>
                <label>
                  Email
                  <input
                    autoComplete="email"
                    type="email"
                    value={adminEmail}
                    onChange={(event) => setAdminEmail(event.target.value)}
                  />
                </label>
                <label>
                  Password
                  <input
                    autoComplete="current-password"
                    type="password"
                    value={adminPassword}
                    onChange={(event) => setAdminPassword(event.target.value)}
                  />
                </label>
                <button className="admin-action" type="submit">
                  <Lock aria-hidden="true" />
                  Sign in
                </button>
              </form>
            ) : (
              <>
                <nav className="admin-page-tabs" aria-label="Admin sections">
                  {adminPages.map((page) => (
                    <button
                      className={adminPage === page.id ? 'active' : ''}
                      key={page.id}
                      type="button"
                      onClick={() => setAdminPage(page.id)}
                    >
                      {page.label}
                    </button>
                  ))}
                </nav>
                {adminPage === 'import' && (
                  <div className="admin-form">
                    <div className="recent-imports">
                      <div className="recent-imports-header">
                        <strong>Recent ZIP imports</strong>
                        <button
                          aria-label="Refresh recent imports"
                          className="icon-button subtle"
                          disabled={isLoadingContentPackageImportHistory}
                          type="button"
                          onClick={loadContentPackageImportHistory}
                        >
                          <RefreshCw
                            aria-hidden="true"
                            className={isLoadingContentPackageImportHistory ? 'spin-icon' : undefined}
                          />
                        </button>
                      </div>
                      {contentPackageImportHistory.length === 0 ? (
                        <span className="recent-imports-empty">
                          {isLoadingContentPackageImportHistory ? 'Loading recent imports...' : 'No ZIP imports recorded yet.'}
                        </span>
                      ) : (
                        <ul className="recent-imports-list">
                          {contentPackageImportHistory.slice(0, 8).map((item) => (
                            <li className="recent-imports-item" key={item.importBatchId}>
                              <div className="recent-imports-main">
                                <span className="recent-imports-name">{item.fileName}</span>
                                <span className={`recent-imports-status ${item.status.toLowerCase()}`}>
                                  {describeImportStatus(item.status)}
                                </span>
                              </div>
                              <span className="recent-imports-detail">
                                {item.title || item.packageSlug || 'Content package'} - completed {formatImportTime(item.completedAt)}
                              </span>
                              <span className="recent-imports-detail">{summarizeImportHistoryItem(item)}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <label>
                      Content package ZIP(s)
                      <input
                        accept=".zip,application/zip"
                        multiple
                        type="file"
                        onChange={(event) => {
                          setContentPackageFiles(Array.from(event.target.files ?? []))
                          setContentPackagePreview(null)
                          setContentPackageResult(null)
                          setContentPackageUploadProgress(null)
                          setContentPackageBatchItems([])
                        }}
                      />
                    </label>
                    {contentPackageFiles.length > 1 && (
                      <small>
                        {contentPackageFiles.length} files selected. They will be imported one after another.
                      </small>
                    )}
                    <label className="admin-checkbox danger">
                      <input
                        checked={clearContentPackageBeforeImport}
                        type="checkbox"
                        onChange={(event) => {
                          setClearContentPackageBeforeImport(event.target.checked)
                          setContentPackagePreview(null)
                          setContentPackageResult(null)
                          setContentPackageUploadProgress(null)
                        }}
                      />
                      <span>
                        Clean import: delete current content data first
                        {contentPackageFiles.length > 1 ? ' (applies only to the first selected file)' : ''}
                      </span>
                    </label>
                    <div className="admin-field-row">
                      <button
                        className="admin-action secondary"
                        disabled={isPreviewingContentPackage || isImportingContentPackage}
                        type="button"
                        onClick={previewContentPackage}
                      >
                        {isPreviewingContentPackage ? <RefreshCw aria-hidden="true" className="spin-icon" /> : <Search aria-hidden="true" />}
                        {isPreviewingContentPackage ? 'Previewing package...' : 'Preview package'}
                      </button>
                      <button
                        className="admin-action"
                        aria-busy={isImportingContentPackage}
                        disabled={isPreviewingContentPackage || isImportingContentPackage}
                        type="button"
                        onClick={importContentPackage}
                      >
                        {isImportingContentPackage ? <RefreshCw aria-hidden="true" className="spin-icon" /> : <Upload aria-hidden="true" />}
                        {isImportingContentPackage
                          ? `Importing package ${describeBatchProgress(contentPackageBatchItems)}...`
                          : contentPackageFiles.length > 1
                            ? `Import ${contentPackageFiles.length} packages`
                            : 'Import package'}
                      </button>
                    </div>
                    {contentPackageUploadProgress && (
                      <div className={`upload-progress ${contentPackageUploadProgress.phase}`} role="status" aria-live="polite">
                        <div className="upload-progress-header">
                          <span>{contentPackageUploadProgress.message}</span>
                          {contentPackageUploadProgress.percent != null && <strong>{contentPackageUploadProgress.percent}%</strong>}
                        </div>
                        {contentPackageUploadProgress.phase !== 'complete' &&
                          contentPackageUploadProgress.phase !== 'error' && (
                            <>
                              {contentPackageUploadProgress.percent == null ? (
                                <progress />
                              ) : (
                                <progress max={100} value={contentPackageUploadProgress.percent} />
                              )}
                              <small>
                                {contentPackageUploadProgress.totalBytes
                                  ? `${formatBytes(contentPackageUploadProgress.loadedBytes)} of ${formatBytes(
                                      contentPackageUploadProgress.totalBytes,
                                    )}`
                                  : `${formatBytes(contentPackageUploadProgress.loadedBytes)} uploaded`}
                              </small>
                            </>
                          )}
                      </div>
                    )}
                    {contentPackageBatchItems.length > 1 && (
                      <ul className="upload-batch-list">
                        {contentPackageBatchItems.map((item, index) => (
                          <li className={`upload-batch-item ${item.status}`} key={`${item.name}-${index}`}>
                            <span className="upload-batch-item-name">{item.name}</span>
                            <span className="upload-batch-item-status">
                              {item.status === 'pending' && 'Waiting'}
                              {item.status === 'uploading' && 'Uploading...'}
                              {item.status === 'processing' && 'Importing on server...'}
                              {item.status === 'done' && (item.message ?? 'Done')}
                              {item.status === 'error' && (item.message ?? 'Failed')}
                              {item.status === 'skipped' && (item.message ?? 'Skipped')}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
                {adminPage === 'import' && contentPackagePreview && (
                  <>
                    <div className="import-result">
                      <strong>
                        {contentPackagePreview.title} ({contentPackagePreview.entriesRead} entries)
                      </strong>
                      <span>{contentPackagePreview.entriesToCreate} entries would be created</span>
                      <span>{contentPackagePreview.entriesToUpdate} entries would be updated</span>
                      {contentPackagePreview.willClearExistingData && (
                        <span>{contentPackagePreview.existingEntriesToDelete} existing entries would be deleted first</span>
                      )}
                      <span>{contentPackagePreview.tagsToAttach} tag links</span>
                      <span>{contentPackagePreview.placesToAttach} place links</span>
                      <span>{contentPackagePreview.audioFilesToAttach} audio files</span>
                      <span>{contentPackagePreview.imageFilesToAttach} image files</span>
                      {contentPackagePreview.warnings.length > 0 && <span>{contentPackagePreview.warnings.length} warnings</span>}
                    </div>
                    {contentPackagePreview.warnings.length > 0 && (
                      <div className="validation-report">
                        <strong>Package validation report</strong>
                        {contentPackagePreview.warnings.slice(0, 12).map((warning, index) => (
                          <span className="validation-issue warning" key={`${warning}-${index}`}>
                            {warning}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="admin-table-scroll">
                      <table className="admin-table">
                        <thead>
                          <tr>
                            <th>Entry</th>
                            <th>Action</th>
                            <th>Links</th>
                            <th>Media</th>
                            <th>Warnings</th>
                          </tr>
                        </thead>
                        <tbody>
                          {contentPackagePreview.rows.slice(0, 60).map((row) => (
                            <tr key={row.slug}>
                              <td>
                                {row.title}
                                <small>
                                  {row.sourceSheet && row.sourceRow ? `${row.sourceSheet} #${row.sourceRow}` : row.slug}
                                </small>
                              </td>
                              <td>{row.willUpdateExistingEntry ? 'Update' : 'Create'}</td>
                              <td>
                                {row.tags} tags / {row.places} places / {row.sources} sources
                              </td>
                              <td>
                                {row.audioFiles} audio / {row.imageFiles} images
                              </td>
                              <td>{row.warnings.length > 0 ? row.warnings.join(', ') : 'OK'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
                {adminPage === 'import' && contentPackageResult && (
                  <div className="import-result">
                    <strong>{contentPackageResult.entriesCreated} package entries imported</strong>
                    {contentPackageResult.clearedExistingData && (
                      <span>{contentPackageResult.entriesDeletedBeforeImport} existing entries deleted before import</span>
                    )}
                    <span>{contentPackageResult.entriesUpdated} entries updated</span>
                    <span>{contentPackageResult.tagsAttached} tag links attached</span>
                    <span>{contentPackageResult.placesAttached} place links attached</span>
                    <span>{contentPackageResult.sourcesAttached} source links attached</span>
                    <span>
                      {contentPackageResult.audioTracksCreated} audio created / {contentPackageResult.audioTracksUpdated} updated
                    </span>
                    <span>
                      {contentPackageResult.imagesCreated} images created / {contentPackageResult.imagesUpdated} updated
                    </span>
                    {contentPackageResult.warnings.length > 0 && <span>{contentPackageResult.warnings.length} warnings</span>}
                  </div>
                )}
                {adminPage === 'periods' && (
                  <>
            <div className="admin-section-title">
              <span>Time periods</span>
              <button
                className="icon-button subtle"
                type="button"
                onClick={() => setTimePeriodForm({ ...defaultTimePeriodForm, languageCode: language })}
              >
                <Plus aria-hidden="true" />
              </button>
            </div>
            <div className="admin-table-scroll">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Type</th>
                    <th>Years</th>
                  </tr>
                </thead>
                <tbody>
                  {periods.map((period) => (
                    <tr
                      className={timePeriodForm.id === period.id ? 'active' : ''}
                      key={period.id}
                      onClick={() => loadTimePeriodForm(period)}
                    >
                      <td>{period.name}</td>
                      <td>{period.periodType}</td>
                      <td>{periodYearLabel(period, ui.dateUnknown)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <form className="entry-editor" onSubmit={saveTimePeriod}>
              <label>
                Period name
                <input
                  value={timePeriodForm.name}
                  onChange={(event) => patchTimePeriodForm({ name: event.target.value })}
                />
              </label>
              <label>
                Period slug
                <input
                  value={timePeriodForm.slug}
                  onChange={(event) => patchTimePeriodForm({ slug: event.target.value })}
                />
              </label>
              <div className="admin-field-row">
                <label>
                  Type
                  <select
                    value={timePeriodForm.periodType}
                    onChange={(event) => patchTimePeriodForm({ periodType: event.target.value as TimePeriodType })}
                  >
                    {timePeriodTypes.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Parent
                  <select
                    value={timePeriodForm.parentPeriodId}
                    onChange={(event) => patchTimePeriodForm({ parentPeriodId: event.target.value })}
                  >
                    <option value="">None</option>
                    {periods
                      .filter((period) => period.id !== timePeriodForm.id)
                      .map((period) => (
                        <option key={period.id} value={period.id}>
                          {period.name}
                        </option>
                      ))}
                  </select>
                </label>
              </div>
              <div className="admin-field-row">
                <label>
                  Start year
                  <input
                    inputMode="numeric"
                    value={timePeriodForm.startYear}
                    onChange={(event) => patchTimePeriodForm({ startYear: event.target.value })}
                  />
                </label>
                <label>
                  End year
                  <input
                    inputMode="numeric"
                    value={timePeriodForm.endYear}
                    onChange={(event) => patchTimePeriodForm({ endYear: event.target.value })}
                  />
                </label>
              </div>
              <label>
                Short description
                <textarea
                  value={timePeriodForm.shortDescription}
                  onChange={(event) => patchTimePeriodForm({ shortDescription: event.target.value })}
                />
              </label>
              <button className="admin-action" type="submit">
                <Save aria-hidden="true" />
                {timePeriodForm.id ? 'Save period' : 'Create period'}
              </button>
              {timePeriodForm.id && (
                <button className="admin-action secondary danger" type="button" onClick={deleteTimePeriod}>
                  <Trash2 aria-hidden="true" />
                  Delete period
                </button>
              )}
            </form>
                  </>
                )}
                {adminPage === 'tags' && (
                  <>
            <div className="admin-section-title">
              <span>Tags</span>
              <button
                className="icon-button subtle"
                type="button"
                onClick={() =>
                  setTagForm({
                    id: null,
                    name: '',
                    slug: '',
                    tagGroup: 'topic',
                    parentTagId: '',
                    attachSlug: '',
                  })
                }
              >
                <Plus aria-hidden="true" />
              </button>
            </div>
            <div className="admin-table-scroll">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Group</th>
                    <th>Entries</th>
                  </tr>
                </thead>
                <tbody>
                  {tags.map((tag) => (
                    <tr
                      className={tagForm.id === tag.id ? 'active' : ''}
                      key={tag.id}
                      onClick={() => loadTagForm(tag)}
                    >
                      <td>{tag.name}</td>
                      <td>{tag.tagGroup}</td>
                      <td>{tag.entryCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <form className="entry-editor" onSubmit={saveTag}>
              <label>
                Tag name
                <input
                  value={tagForm.name}
                  onChange={(event) => patchTagForm({ name: event.target.value })}
                />
              </label>
              <div className="admin-field-row">
                <label>
                  Tag slug
                  <input
                    value={tagForm.slug}
                    onChange={(event) => patchTagForm({ slug: event.target.value })}
                  />
                </label>
                <label>
                  Group
                  <input
                    value={tagForm.tagGroup}
                    onChange={(event) => patchTagForm({ tagGroup: event.target.value })}
                  />
                </label>
              </div>
              <label>
                Parent tag
                <select
                  value={tagForm.parentTagId}
                  onChange={(event) => patchTagForm({ parentTagId: event.target.value })}
                >
                  <option value="">None</option>
                  {tags
                    .filter((tag) => tag.id !== tagForm.id)
                    .map((tag) => (
                      <option key={tag.id} value={tag.id}>
                        {tag.name}
                      </option>
                    ))}
                </select>
              </label>
              <button className="admin-action" type="submit">
                <Save aria-hidden="true" />
                {tagForm.id ? 'Save tag' : 'Create tag'}
              </button>
              {tagForm.id && (
                <button className="admin-action secondary danger" type="button" onClick={deleteTag}>
                  <Trash2 aria-hidden="true" />
                  Delete tag
                </button>
              )}
              <label>
                Attach tag
                <select
                  value={tagForm.attachSlug}
                  onChange={(event) => patchTagForm({ attachSlug: event.target.value })}
                >
                  <option value="">Choose tag</option>
                  {tags.map((tag) => (
                    <option key={tag.id} value={tag.slug}>
                      {tag.name}
                    </option>
                  ))}
                </select>
              </label>
              <button className="admin-action secondary" type="button" onClick={attachTagToEntry}>
                <Tags aria-hidden="true" />
                Attach tag
              </button>
              {adminEntryTags.length > 0 && (
                <div className="route-manager">
                  <strong>Attached tags</strong>
                  {adminEntryTags.map((tag) => (
                    <div className="route-manager-item" key={tag.id}>
                      <span>
                        {tag.name}
                        <small>{tag.tagGroup} - {tag.slug}</small>
                      </span>
                      <div className="route-manager-actions">
                        <button className="admin-action secondary" type="button" onClick={() => loadTagForm(tag)}>
                          <Tags aria-hidden="true" />
                          Edit
                        </button>
                        <button className="admin-action secondary danger" type="button" onClick={() => detachTagFromEntry(tag.id)}>
                          <Trash2 aria-hidden="true" />
                          Detach
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </form>
                  </>
                )}
                {adminPage === 'entry' && (
                  <>
            <div className="admin-section-title">
              <span>Content</span>
              <button className="icon-button subtle" type="button" onClick={resetEntryForm}>
                <Plus aria-hidden="true" />
              </button>
            </div>
            <div className="admin-entry-list">
              <button className="admin-action secondary" disabled={isLoadingAdminEntries} type="button" onClick={loadAdminEntries}>
                <RefreshCw aria-hidden="true" />
                {isLoadingAdminEntries ? 'Loading...' : 'Reload entries'}
              </button>
              {adminEntries.slice(0, 8).map((entry) => (
                <button
                  className={entryForm.id === entry.id ? 'admin-entry active' : 'admin-entry'}
                  key={entry.id}
                  type="button"
                  onClick={() => loadAdminEntryDetail(entry.id)}
                >
                  <span>{entry.title}</span>
                  <small>
                    {entry.status} / {entry.kind}
                  </small>
                </button>
              ))}
            </div>
            <form className="entry-editor" onSubmit={saveEntry}>
              <div className="translation-switcher" aria-label="Entry translation language">
                {contentLanguages.map((contentLanguage) => {
                  const translation = adminEntryTranslations.find((item) => item.languageCode === contentLanguage.code)
                  const isActive = entryForm.languageCode === contentLanguage.code

                  return (
                    <button
                      className={isActive ? 'active' : ''}
                      key={contentLanguage.code}
                      type="button"
                      onClick={() => void switchEntryLanguage(contentLanguage.code)}
                    >
                      {contentLanguage.label}
                      <small>{translation ? 'ready' : 'missing'}</small>
                    </button>
                  )
                })}
              </div>
              <label>
                Title
                <input
                  value={entryForm.title}
                  onChange={(event) => patchEntryForm({ title: event.target.value })}
                />
              </label>
              <label>
                Slug
                <input
                  value={entryForm.slug}
                  onChange={(event) => patchEntryForm({ slug: event.target.value })}
                />
              </label>
              <label>
                Iconify icon
                <div className="icon-key-input">
                  <Icon icon={entryIconKey({ iconKey: entryForm.iconKey, kind: entryForm.kind })} aria-hidden="true" />
                  <input
                    placeholder="mdi:compass-outline"
                    value={entryForm.iconKey}
                    onChange={(event) => patchEntryForm({ iconKey: event.target.value })}
                  />
                </div>
              </label>
              <div className="admin-field-row">
                <label>
                  Kind
                  <select
                    value={entryForm.kind}
                    onChange={(event) => patchEntryForm({ kind: event.target.value as EntryKind })}
                  >
                    {entryKinds.map((kind) => (
                      <option key={kind} value={kind}>
                        {kind}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Status
                  <select
                    value={entryForm.status}
                    onChange={(event) => patchEntryForm({ status: event.target.value as ContentStatus })}
                  >
                    {contentStatuses.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="admin-field-row">
                <label>
                  Reality
                  <select
                    value={entryForm.realityStatus}
                    onChange={(event) => patchEntryForm({ realityStatus: event.target.value as RealityStatus })}
                  >
                    {realityStatuses.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Language
                  <select
                    value={entryForm.languageCode}
                    onChange={(event) => void switchEntryLanguage(event.target.value)}
                  >
                    {contentLanguages.map((contentLanguage) => (
                      <option key={contentLanguage.code} value={contentLanguage.code}>
                        {contentLanguage.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="admin-field-row">
                <label>
                  Date label
                  <input
                    value={entryForm.dateLabel}
                    onChange={(event) => patchEntryForm({ dateLabel: event.target.value })}
                  />
                </label>
                <label>
                  Precision
                  <select
                    value={entryForm.timePrecision}
                    onChange={(event) => patchEntryForm({ timePrecision: event.target.value as TimePrecision | '' })}
                  >
                    <option value="">Auto</option>
                    {timePrecisions.map((precision) => (
                      <option key={precision} value={precision}>
                        {precision}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="admin-field-row">
                <label>
                  Start year
                  <input
                    inputMode="numeric"
                    value={entryForm.startYear}
                    onChange={(event) => patchEntryForm({ startYear: event.target.value })}
                  />
                </label>
                <label>
                  End year
                  <input
                    inputMode="numeric"
                    value={entryForm.endYear}
                    onChange={(event) => patchEntryForm({ endYear: event.target.value })}
                  />
                </label>
              </div>
              <label>
                Primary time period
                <select
                  value={entryForm.primaryTimePeriodId}
                  onChange={(event) => patchEntryForm({ primaryTimePeriodId: event.target.value })}
                >
                  <option value="">None</option>
                  {periods.map((period) => (
                    <option key={period.id} value={period.id}>
                      {period.name}
                    </option>
                  ))}
                </select>
              </label>
              <MarkdownEditor
                label="Summary"
                value={entryForm.summary}
                onChange={(value) => patchEntryForm({ summary: value })}
              />
              <MarkdownEditor
                label="Description"
                value={entryForm.description}
                onChange={(value) => patchEntryForm({ description: value })}
              />
              <MarkdownEditor
                label="Why it matters"
                value={entryForm.whyItMatters}
                onChange={(value) => patchEntryForm({ whyItMatters: value })}
              />
              <label>
                Dating note
                <textarea
                  value={entryForm.datingNote}
                  onChange={(event) => patchEntryForm({ datingNote: event.target.value })}
                />
              </label>
              <button className="admin-action" type="submit">
                <Save aria-hidden="true" />
                {entryForm.id ? 'Save entry' : 'Create entry'}
              </button>
            </form>
                  </>
                )}
                {(['places', 'routes', 'relationships', 'sources', 'media'] as AdminPage[]).includes(adminPage) && (
            <div className="media-editor">
              {adminPage === 'places' && (
                <>
                  <div className="admin-section-title">
                    <span>Places</span>
                  </div>
                  <div className="admin-table-scroll">
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th>Name</th>
                          <th>Role</th>
                          <th>Coordinates</th>
                        </tr>
                      </thead>
                      <tbody>
                        {adminEntryPlaces.map((place) => (
                          <tr key={`${place.placeId}-${place.role}`}>
                            <td>{place.name}</td>
                            <td>{place.role}</td>
                            <td>
                              {place.longitude ?? '?'} / {place.latitude ?? '?'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
              <label>
                Place name
                <input
                  value={placeForm.name}
                  onChange={(event) => patchPlaceForm({ name: event.target.value })}
                />
              </label>
              <div className="admin-field-row">
                <label>
                  Longitude
                  <input
                    inputMode="decimal"
                    value={placeForm.longitude}
                    onChange={(event) => patchPlaceForm({ longitude: event.target.value })}
                  />
                </label>
                <label>
                  Latitude
                  <input
                    inputMode="decimal"
                    value={placeForm.latitude}
                    onChange={(event) => patchPlaceForm({ latitude: event.target.value })}
                  />
                </label>
              </div>
              <div className="admin-field-row">
                <label>
                  Role
                  <select
                    value={placeForm.role}
                    onChange={(event) => patchPlaceForm({ role: event.target.value as EntryPlaceRole })}
                  >
                    {entryPlaceRoles.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Type
                  <select
                    value={placeForm.placeType}
                    onChange={(event) => patchPlaceForm({ placeType: event.target.value as PlaceType })}
                  >
                    {placeTypes.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="admin-field-row">
                <label>
                  Confidence
                  <select
                    value={placeForm.spatialConfidence}
                    onChange={(event) => patchPlaceForm({ spatialConfidence: event.target.value as SpatialConfidence })}
                  >
                    {spatialConfidences.map((confidence) => (
                      <option key={confidence} value={confidence}>
                        {confidence}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Country
                  <input
                    maxLength={3}
                    value={placeForm.countryCode}
                    onChange={(event) => patchPlaceForm({ countryCode: event.target.value })}
                  />
                </label>
              </div>
              <label>
                Place note
                <input
                  value={placeForm.note}
                  onChange={(event) => patchPlaceForm({ note: event.target.value })}
                />
              </label>
              <button className="admin-action secondary" type="button" onClick={addEntryPlace}>
                <MapPin aria-hidden="true" />
                Add place
              </button>
                </>
              )}
              {adminPage === 'routes' && (
                <>
                  <div className="admin-section-title">
                    <span>Routes</span>
                  </div>
                  <div className="admin-table-scroll">
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th>Name</th>
                          <th>Type</th>
                          <th>Points</th>
                        </tr>
                      </thead>
                      <tbody>
                        {adminEntryRoutes.map((route) => (
                          <tr key={route.id} onClick={() => loadRouteForm(route)}>
                            <td>{route.name || route.routeType}</td>
                            <td>{route.routeType}</td>
                            <td>{route.points.length}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
              {adminEntryRoutes.length > 0 && (
                <div className="route-manager">
                  <strong>Routes</strong>
                  {adminEntryRoutes.map((route) => (
                    <div className="route-manager-item" key={route.id}>
                      <span>
                        {route.name || route.routeType}
                        <small>{route.routeType} - {route.points.length} points</small>
                      </span>
                      <div className="route-manager-actions">
                        <button className="admin-action secondary" type="button" onClick={() => loadRouteForm(route)}>
                          <Route aria-hidden="true" />
                          Edit
                        </button>
                        <button className="admin-action secondary danger" type="button" onClick={() => deleteEntryRoute(route.id)}>
                          <Trash2 aria-hidden="true" />
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <label>
                {routeForm.id ? 'Editing route' : 'Route name'}
                <input
                  value={routeForm.name}
                  onChange={(event) => patchRouteForm({ name: event.target.value })}
                />
              </label>
              <div className="admin-field-row">
                <label>
                  Route type
                  <select
                    value={routeForm.routeType}
                    onChange={(event) => patchRouteForm({ routeType: event.target.value as RouteType })}
                  >
                    {routeTypes.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Route confidence
                  <select
                    value={routeForm.spatialConfidence}
                    onChange={(event) => patchRouteForm({ spatialConfidence: event.target.value as SpatialConfidence })}
                  >
                    {spatialConfidences.map((confidence) => (
                      <option key={confidence} value={confidence}>
                        {confidence}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label>
                Route points
                <textarea
                  className="route-points-input"
                  placeholder="Start | Palos de la Frontera | -6.89 | 37.23 | 1492&#10;Stop | Canary Islands | -15.50 | 28.10 | 1492&#10;End | Bahamas | -77.35 | 25.03 | 1492"
                  value={routeForm.pointsText}
                  onChange={(event) => patchRouteForm({ pointsText: event.target.value })}
                />
              </label>
              <label>
                Route source note
                <input
                  value={routeForm.sourceNote}
                  onChange={(event) => patchRouteForm({ sourceNote: event.target.value })}
                />
              </label>
              <div className="admin-field-row">
                <button className="admin-action secondary" type="button" onClick={saveEntryRoute}>
                  <Route aria-hidden="true" />
                  {routeForm.id ? 'Save route' : 'Add route'}
                </button>
                <button className="admin-action secondary" type="button" onClick={resetRouteForm}>
                  <Plus aria-hidden="true" />
                  New route
                </button>
              </div>
                </>
              )}
              {adminPage === 'relationships' && (
                <>
                  <div className="admin-section-title">
                    <span>Relationships</span>
                  </div>
                  <div className="admin-table-scroll">
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th>Type</th>
                          <th>Target</th>
                          <th>Confidence</th>
                        </tr>
                      </thead>
                      <tbody>
                        {adminEntryRelationships.map((relationship) => (
                          <tr key={relationship.id} onClick={() => loadRelationshipForm(relationship)}>
                            <td>{relationship.relationshipType}</td>
                            <td>{relationship.targetEntryTitle}</td>
                            <td>{relationship.confidence ?? '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
              {adminEntryRelationships.length > 0 && (
                <div className="route-manager">
                  <strong>Relationships</strong>
                  {adminEntryRelationships.map((relationship) => (
                    <div className="route-manager-item" key={relationship.id}>
                      <span>
                        {relationship.relationshipType}: {relationship.targetEntryTitle}
                        <small>{relationship.targetEntryKind} - {relationship.targetEntrySlug}</small>
                      </span>
                      <div className="route-manager-actions">
                        <button
                          className="admin-action secondary"
                          type="button"
                          onClick={() => loadRelationshipForm(relationship)}
                        >
                          <Tags aria-hidden="true" />
                          Edit
                        </button>
                        <button
                          className="admin-action secondary danger"
                          type="button"
                          onClick={() => deleteEntryRelationship(relationship.id)}
                        >
                          <Trash2 aria-hidden="true" />
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <label>
                {relationshipForm.id ? 'Editing relationship target slug' : 'Related entry slug'}
                <input
                  value={relationshipForm.targetEntrySlug}
                  onChange={(event) => patchRelationshipForm({ targetEntrySlug: event.target.value })}
                />
              </label>
              <div className="admin-field-row">
                <label>
                  Relationship
                  <select
                    value={relationshipForm.relationshipType}
                    onChange={(event) =>
                      patchRelationshipForm({ relationshipType: event.target.value as EntryRelationshipType })
                    }
                  >
                    {relationshipTypes.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Confidence
                  <input
                    inputMode="decimal"
                    placeholder="0.8"
                    value={relationshipForm.confidence}
                    onChange={(event) => patchRelationshipForm({ confidence: event.target.value })}
                  />
                </label>
              </div>
              <label>
                Relationship note
                <input
                  value={relationshipForm.note}
                  onChange={(event) => patchRelationshipForm({ note: event.target.value })}
                />
              </label>
              <div className="admin-field-row">
                <button className="admin-action secondary" type="button" onClick={saveEntryRelationship}>
                  <Tags aria-hidden="true" />
                  {relationshipForm.id ? 'Save relationship' : 'Add relationship'}
                </button>
                <button className="admin-action secondary" type="button" onClick={resetRelationshipForm}>
                  <Plus aria-hidden="true" />
                  New relationship
                </button>
              </div>
                </>
              )}
              {adminPage === 'sources' && (
                <>
                  <div className="admin-section-title">
                    <span>Sources</span>
                  </div>
                  <div className="admin-table-scroll">
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th>Title</th>
                          <th>Field</th>
                          <th>Publisher</th>
                        </tr>
                      </thead>
                      <tbody>
                        {adminEntrySources.map((source) => (
                          <tr key={`${source.sourceId}-${source.supportsField}`} onClick={() => loadSourceForm(source)}>
                            <td>{source.title || source.url}</td>
                            <td>{source.supportsField}</td>
                            <td>{source.publisher || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
              {adminEntrySources.length > 0 && (
                <div className="route-manager">
                  <strong>Sources</strong>
                  {adminEntrySources.map((source) => (
                    <div className="route-manager-item" key={`${source.sourceId}-${source.supportsField}`}>
                      <span>
                        {source.title || source.publisher || source.url}
                        <small>{source.supportsField} - {source.publisher || source.url}</small>
                      </span>
                      <div className="route-manager-actions">
                        <button className="admin-action secondary" type="button" onClick={() => loadSourceForm(source)}>
                          <Search aria-hidden="true" />
                          Edit
                        </button>
                        <button
                          className="admin-action secondary danger"
                          type="button"
                          onClick={() => deleteEntrySource(source.sourceId, source.supportsField)}
                        >
                          <Trash2 aria-hidden="true" />
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <label>
                {sourceForm.sourceId ? 'Editing source URL' : 'Source URL'}
                <input
                  value={sourceForm.url}
                  onChange={(event) => patchSourceForm({ url: event.target.value })}
                />
              </label>
              <div className="admin-field-row">
                <label>
                  Source title
                  <input
                    value={sourceForm.title}
                    onChange={(event) => patchSourceForm({ title: event.target.value })}
                  />
                </label>
                <label>
                  Publisher
                  <input
                    value={sourceForm.publisher}
                    onChange={(event) => patchSourceForm({ publisher: event.target.value })}
                  />
                </label>
              </div>
              <div className="admin-field-row">
                <label>
                  Supports
                  <select
                    value={sourceForm.supportsField}
                    onChange={(event) => patchSourceForm({ supportsField: event.target.value as SourceSupportKind })}
                  >
                    {sourceSupportKinds.map((supportKind) => (
                      <option key={supportKind} value={supportKind}>
                        {supportKind}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Source note
                  <input
                    value={sourceForm.note}
                    onChange={(event) => patchSourceForm({ note: event.target.value })}
                  />
                </label>
              </div>
              <div className="admin-field-row">
                <button className="admin-action secondary" type="button" onClick={saveEntrySource}>
                  <Search aria-hidden="true" />
                  {sourceForm.sourceId ? 'Save source' : 'Add source'}
                </button>
                <button className="admin-action secondary" type="button" onClick={resetSourceForm}>
                  <Plus aria-hidden="true" />
                  New source
                </button>
              </div>
                </>
              )}
              {adminPage === 'media' && (
                <>
                  <div className="admin-section-title">
                    <span>Media</span>
                  </div>
                  <div className="admin-form">
                    <label>
                      Bulk audio ZIP
                      <input
                        accept=".zip,application/zip"
                        type="file"
                        onChange={(event) => {
                          setBulkAudioFile(event.currentTarget.files?.[0] ?? null)
                          setBulkAudioPreview(null)
                          setBulkAudioResult(null)
                        }}
                      />
                    </label>
                    <label>
                      Default language
                      <select value={bulkAudioLanguage} onChange={(event) => setBulkAudioLanguage(event.target.value)}>
                        <option value="en">English</option>
                        <option value="cs">Czech</option>
                        <option value="es">Spanish</option>
                      </select>
                    </label>
                    <div className="admin-field-row">
                      <button
                        className="admin-action secondary"
                        disabled={isBulkAudioPreviewing || isBulkAudioUploading}
                        type="button"
                        onClick={previewBulkAudioZip}
                      >
                        <Search aria-hidden="true" />
                        {isBulkAudioPreviewing ? 'Previewing audio...' : 'Preview audio ZIP'}
                      </button>
                      <button
                        className="admin-action secondary"
                        disabled={isBulkAudioPreviewing || isBulkAudioUploading}
                        type="button"
                        onClick={uploadBulkAudioZip}
                      >
                        <Upload aria-hidden="true" />
                        {isBulkAudioUploading ? 'Uploading audio...' : 'Upload audio ZIP'}
                      </button>
                    </div>
                    {bulkAudioPreview && (
                      <div className="import-result">
                        <strong>{bulkAudioPreview.filesRead} audio files in preview</strong>
                        <span>{bulkAudioPreview.filesSupported} supported files</span>
                        <span>{bulkAudioPreview.entriesMatched} entries matched</span>
                        <span>{bulkAudioPreview.entriesMissing} entries missing</span>
                        {bulkAudioPreview.warnings.length > 0 && <span>{bulkAudioPreview.warnings.length} warnings</span>}
                      </div>
                    )}
                    {bulkAudioPreview?.warnings.length ? (
                      <div className="validation-report">
                        <strong>Audio ZIP report</strong>
                        {bulkAudioPreview.rows
                          .filter((row) => row.warning)
                          .slice(0, 12)
                          .map((row) => (
                            <span className="validation-issue warning" key={row.fileName}>
                              {row.fileName}: {row.warning}
                            </span>
                          ))}
                      </div>
                    ) : null}
                    {bulkAudioResult && (
                      <div className="import-result">
                        <strong>{bulkAudioResult.filesRead} audio files read</strong>
                        <span>{bulkAudioResult.tracksCreated} tracks created</span>
                        <span>{bulkAudioResult.tracksUpdated} tracks updated</span>
                        <span>{bulkAudioResult.entriesMatched} entries matched</span>
                        <span>{bulkAudioResult.entriesMissing} entries missing</span>
                        {bulkAudioResult.warnings.length > 0 && <span>{bulkAudioResult.warnings.length} warnings</span>}
                      </div>
                    )}
                  </div>
                  <div className="admin-table-scroll">
                    <table className="admin-table">
                      <thead>
                        <tr>
                          <th>Kind</th>
                          <th>Title / alt</th>
                          <th>Primary</th>
                        </tr>
                      </thead>
                      <tbody>
                        {adminEntryImages.map((image) => (
                          <tr key={image.id} onClick={() => loadImageForm(image)}>
                            <td>Image</td>
                            <td>{image.altText || image.caption || image.url}</td>
                            <td>{image.isPrimary ? 'Yes' : 'No'}</td>
                          </tr>
                        ))}
                        {adminEntryAudioTracks.map((audioTrack) => (
                          <tr key={audioTrack.id} onClick={() => loadAudioForm(audioTrack)}>
                            <td>Audio</td>
                            <td>{audioTrack.title || audioTrack.url}</td>
                            <td>{audioTrack.isPrimary ? 'Yes' : 'No'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
              {adminEntryImages.length > 0 && (
                <div className="route-manager">
                  <strong>Images</strong>
                  {adminEntryImages.map((image) => (
                    <div className="route-manager-item" key={image.id}>
                      <span>
                        {image.altText || image.caption || image.url}
                        <small>{image.kind} - {image.isPrimary ? 'Primary' : `Order ${image.sortOrder}`}</small>
                      </span>
                      <div className="route-manager-actions">
                        <button className="admin-action secondary" type="button" onClick={() => loadImageForm(image)}>
                          <ImageIcon aria-hidden="true" />
                          Edit
                        </button>
                        <button className="admin-action secondary danger" type="button" onClick={() => deleteEntryImage(image.id)}>
                          <Trash2 aria-hidden="true" />
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <label>
                {mediaForm.imageId ? 'Editing image URL' : 'Primary image URL'}
                <input
                  value={mediaForm.imageUrl}
                  onChange={(event) => setMediaForm((current) => ({ ...current, imageUrl: event.target.value }))}
                />
              </label>
              <label>
                Image alt text
                <input
                  value={mediaForm.imageAlt}
                  onChange={(event) => setMediaForm((current) => ({ ...current, imageAlt: event.target.value }))}
                />
              </label>
              <label>
                Image file
                <input
                  key={`image-file-${mediaInputResetKey}`}
                  accept="image/avif,image/gif,image/jpeg,image/png,image/webp"
                  type="file"
                  onChange={(event) =>
                    setMediaForm((current) => ({
                      ...current,
                      imageFile: event.currentTarget.files?.[0] ?? null,
                    }))
                  }
                />
              </label>
              <div className="admin-field-row">
                <button className="admin-action secondary" type="button" onClick={savePrimaryImage}>
                  <ImageIcon aria-hidden="true" />
                  {mediaForm.imageId ? 'Save image' : 'Add image'}
                </button>
                <button className="admin-action secondary" type="button" onClick={uploadPrimaryImageFile}>
                  <Upload aria-hidden="true" />
                  Upload image file
                </button>
                <button className="admin-action secondary" type="button" onClick={resetImageForm}>
                  <Plus aria-hidden="true" />
                  New image
                </button>
              </div>
              {adminEntryAudioTracks.length > 0 && (
                <div className="route-manager">
                  <strong>Audio tracks</strong>
                  {adminEntryAudioTracks.map((audioTrack) => (
                    <div className="route-manager-item" key={audioTrack.id}>
                      <span>
                        {audioTrack.title || audioTrack.url}
                        <small>{audioTrack.languageCode} - {audioTrack.kind}</small>
                      </span>
                      <div className="route-manager-actions">
                        <button className="admin-action secondary" type="button" onClick={() => loadAudioForm(audioTrack)}>
                          <Music aria-hidden="true" />
                          Edit
                        </button>
                        <button
                          className="admin-action secondary danger"
                          type="button"
                          onClick={() => deleteEntryAudioTrack(audioTrack.id)}
                        >
                          <Trash2 aria-hidden="true" />
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <label>
                {mediaForm.audioTrackId ? 'Editing audio URL' : 'Audio URL'}
                <input
                  value={mediaForm.audioUrl}
                  onChange={(event) => setMediaForm((current) => ({ ...current, audioUrl: event.target.value }))}
                />
              </label>
              <label>
                Audio title
                <input
                  value={mediaForm.audioTitle}
                  onChange={(event) => setMediaForm((current) => ({ ...current, audioTitle: event.target.value }))}
                />
              </label>
              <label>
                Audio file
                <input
                  key={`audio-file-${mediaInputResetKey}`}
                  accept="audio/mpeg,audio/mp4,audio/ogg,audio/wav,audio/webm"
                  type="file"
                  onChange={(event) =>
                    setMediaForm((current) => ({
                      ...current,
                      audioFile: event.currentTarget.files?.[0] ?? null,
                    }))
                  }
                />
              </label>
              <div className="admin-field-row">
                <button className="admin-action secondary" type="button" onClick={savePrimaryAudio}>
                  <Music aria-hidden="true" />
                  {mediaForm.audioTrackId ? 'Save audio' : 'Add audio'}
                </button>
                <button className="admin-action secondary" type="button" onClick={uploadPrimaryAudioFile}>
                  <Upload aria-hidden="true" />
                  Upload audio file
                </button>
                <button className="admin-action secondary" type="button" onClick={resetAudioForm}>
                  <Plus aria-hidden="true" />
                  New audio
                </button>
              </div>
                </>
              )}
            </div>
                )}
              </>
            )}
          </aside>
  )
}
