import { useEffect, useId, useRef, type ReactNode } from 'react'

type ModalProps = {
  open: boolean
  title: string
  onClose: () => void
  children?: ReactNode
  /** Buttons row at the bottom (right-aligned). */
  footer?: ReactNode
  /** Wider body for forms (e.g. Edit raffle). */
  wide?: boolean
}

/**
 * Accessible modal: role="dialog", labelled by its title, Escape and backdrop click close it,
 * focus moves to the first field (or the dialog) on open and back to the opener on close.
 */
export function Modal({ open, title, onClose, children, footer, wide }: ModalProps) {
  const titleId = useId()
  const ref = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  })

  useEffect(() => {
    if (!open) return
    const opener = document.activeElement as HTMLElement | null
    const first = ref.current?.querySelector<HTMLElement>('input, textarea, select')
    ;(first ?? ref.current)?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current()
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      opener?.focus?.()
    }
  }, [open])

  if (!open) return null
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        ref={ref}
        className={`modal${wide ? ' modal--wide' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <h2 id={titleId} className="modal__title">
          {title}
        </h2>
        <div className="modal__body">{children}</div>
        {footer && <div className="modal__footer">{footer}</div>}
      </div>
    </div>
  )
}
