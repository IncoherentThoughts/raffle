import { useState, type ReactNode } from 'react'
import { Button, type ButtonVariant } from './Button'
import { InlineError } from './InlineError'
import { Modal } from './Modal'
import { TextField } from './TextField'

/** Reasons are required for Cancel, Remove, Redraw, Overrides, ... (#6): min 3 chars trimmed. */
export const MIN_REASON_LENGTH = 3

type ConfirmDialogProps = {
  open: boolean
  title: string
  /** The question, e.g. "Draw 1 winner from 38 eligible entries? This is final; ..." */
  children?: ReactNode
  confirmLabel: string
  /** Confirm button style: 'primary' (default), 'danger' (Remove, Cancel raffle), 'gold' (Draw). */
  tone?: ButtonVariant
  requireReason?: boolean
  reasonLabel?: string
  /**
   * Do the action. Receives the trimmed reason ('' when not required). Resolve to close
   * (the caller sets open=false); throw to show the error inline and keep the dialog open.
   * Error text: pass a friendly Error message, or let ApiError.message through.
   */
  onConfirm: (reason: string) => Promise<void>
  onCancel: () => void
}

export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  tone = 'primary',
  requireReason = false,
  reasonLabel = 'Reason',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const trimmed = reason.trim()
  const reasonOk = !requireReason || trimmed.length >= MIN_REASON_LENGTH

  function close() {
    setReason('')
    setError(null)
    onCancel()
  }

  async function confirm() {
    setBusy(true)
    setError(null)
    try {
      await onConfirm(requireReason ? trimmed : '')
      setReason('')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={open}
      title={title}
      onClose={close}
      footer={
        <>
          <Button variant="outline" onClick={close} disabled={busy}>
            Cancel
          </Button>
          <Button variant={tone} onClick={confirm} disabled={!reasonOk || busy}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      {children && <div className="confirm__message">{children}</div>}
      {requireReason && (
        <TextField
          label={reasonLabel}
          description={`At least ${MIN_REASON_LENGTH} characters; kept in the activity log.`}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          multiline
          rows={2}
        />
      )}
      {error && <InlineError>{error}</InlineError>}
    </Modal>
  )
}
