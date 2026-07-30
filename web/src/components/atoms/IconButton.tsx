import type { ReactNode } from 'react'

type IconButtonProps = {
  children: ReactNode
  label: string
  className?: string
  disabled?: boolean
  title?: string
  type?: 'button' | 'submit' | 'reset'
  onClick?: () => void
}

export function IconButton({
  children,
  className = 'icon-button',
  disabled,
  label,
  onClick,
  title = label,
  type = 'button',
}: IconButtonProps) {
  return (
    <button
      className={className}
      disabled={disabled}
      type={type}
      aria-label={label}
      title={title}
      onClick={onClick}
    >
      {children}
    </button>
  )
}
