import { useEffect, useRef, type ReactNode } from 'react'
import { Icon } from './Icon.tsx'

export function Modal({ title, description, onClose, busy = false, children, compact = false }: {
  title: string
  description?: string
  onClose: () => void
  busy?: boolean
  children: ReactNode
  compact?: boolean
}) {
  const dialog = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const element = dialog.current
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const previousOverflow = document.body.style.overflow
    element?.showModal()
    element?.querySelector<HTMLInputElement>('[data-autofocus]')?.focus()
    document.body.style.overflow = 'hidden'
    return () => {
      element?.close()
      document.body.style.overflow = previousOverflow
      if (previousFocus?.isConnected) previousFocus.focus()
    }
  }, [])

  return (
    <dialog ref={dialog} className={`modal ${compact ? 'modal-compact' : 'modal-drawer'}`} aria-labelledby="modal-title"
      onCancel={(event) => { event.preventDefault(); if (!busy) onClose() }}
      onClick={(event) => { if (event.target === event.currentTarget && !busy) onClose() }}>
      <div className="modal-content">
        <header className="modal-header">
          <div><p className="kicker">Assignment details</p><h2 id="modal-title">{title}</h2>{description && <p>{description}</p>}</div>
          <button className="icon-button" type="button" onClick={onClose} disabled={busy} aria-label="Close dialog"><Icon name="close" /></button>
        </header>
        {children}
      </div>
    </dialog>
  )
}
