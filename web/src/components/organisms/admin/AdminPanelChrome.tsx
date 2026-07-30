import { AlertCircle, CheckCircle2, GitCommitHorizontal, Lock, X } from 'lucide-react'
import type { FormEvent, ReactNode } from 'react'
import type { AdminPage } from '../../../store/appStore'

type DeploymentInfo = {
  commitUrl?: string | null
  deployedAtUtc?: string | null
  shortCommitSha?: string | null
}

type AdminPageOption = {
  id: AdminPage
  label: string
}

type AdminPanelChromeProps = {
  adminEmail: string
  adminPages: AdminPageOption[]
  adminPage: AdminPage
  adminPassword: string
  adminStatus: string
  adminToken: string | null
  children: ReactNode
  deploymentInfo: DeploymentInfo | null
  formatDeploymentTime: (value: string | null | undefined) => string
  onAdminEmailChange: (value: string) => void
  onAdminPageChange: (page: AdminPage) => void
  onAdminPasswordChange: (value: string) => void
  onClose: () => void
  onSignIn: (event: FormEvent<HTMLFormElement>) => void | Promise<void>
  onSignOut: () => void | Promise<void>
}

export function AdminPanelChrome({
  adminEmail,
  adminPages,
  adminPage,
  adminPassword,
  adminStatus,
  adminToken,
  children,
  deploymentInfo,
  formatDeploymentTime,
  onAdminEmailChange,
  onAdminPageChange,
  onAdminPasswordChange,
  onClose,
  onSignIn,
  onSignOut,
}: AdminPanelChromeProps) {
  return (
    <aside className="admin-panel" aria-label="Admin tools">
      <div className="panel-header">
        <span>
          <Lock aria-hidden="true" />
          Admin
        </span>
        <div className="panel-header-actions">
          {adminToken && (
            <button className="panel-text-button" type="button" onClick={onSignOut}>
              Sign out
            </button>
          )}
          <button
            className="panel-close"
            type="button"
            aria-label="Close admin panel"
            title="Close admin panel"
            onClick={onClose}
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
        <form className="admin-form" onSubmit={onSignIn}>
          <label>
            Email
            <input
              autoComplete="email"
              type="email"
              value={adminEmail}
              onChange={(event) => onAdminEmailChange(event.target.value)}
            />
          </label>
          <label>
            Password
            <input
              autoComplete="current-password"
              type="password"
              value={adminPassword}
              onChange={(event) => onAdminPasswordChange(event.target.value)}
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
                onClick={() => onAdminPageChange(page.id)}
              >
                {page.label}
              </button>
            ))}
          </nav>
          {children}
        </>
      )}
    </aside>
  )
}
