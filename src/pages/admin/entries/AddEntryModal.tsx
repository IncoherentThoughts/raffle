import { useState, type FormEvent } from 'react'
import { addEntry, restoreEntry } from '../../../lib/api/entries'
import { useApiErrorHandler } from '../data/useAdminQuery'
import { Button, InlineError, Modal, TextField } from '../ui'
import { friendlyEntryError } from './errors'

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

/**
 * "Add entry" (Open/Closed Raffles only): name + email, no device_id. If the Entrant already
 * has an Entry that was removed, offer "Restore instead?".
 */
export function AddEntryModal({ raffleId, onClose, onSaved }: { raffleId: string; onClose: () => void; onSaved: () => void }) {
  const handleError = useApiErrorHandler()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [touched, setTouched] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [removedEntryId, setRemovedEntryId] = useState<string | null>(null)

  const nameError = !name.trim() ? 'Enter a name.' : null
  const emailError = !EMAIL_RE.test(email.trim()) ? 'Enter an email address.' : null

  async function run(action: () => Promise<unknown>) {
    setBusy(true)
    setError(null)
    try {
      await action()
      onSaved()
    } catch (e) {
      const err = handleError(e)
      if (err) {
        setError(friendlyEntryError(err))
        setRemovedEntryId(err.message === 'already_entered_removed' && err.details ? err.details : null)
      }
    } finally {
      setBusy(false)
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    setTouched(true)
    if (nameError || emailError) return
    void run(() => addEntry(raffleId, name, email))
  }

  return (
    <Modal
      open
      title="Add entry"
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" form="entries-add-form" disabled={busy}>
            Add entry
          </Button>
        </>
      }
    >
      <form id="entries-add-form" onSubmit={submit} noValidate>
        <TextField
          label="Full name"
          value={name}
          maxLength={200}
          onChange={(e) => setName(e.target.value)}
          error={touched ? nameError : null}
        />
        <TextField
          label="Work email"
          type="email"
          value={email}
          maxLength={254}
          onChange={(e) => {
            setEmail(e.target.value)
            setRemovedEntryId(null)
          }}
          error={touched ? emailError : null}
        />
      </form>
      {error && (
        <div className="entries__add-error">
          <InlineError>{error}</InlineError>
          {removedEntryId && (
            <Button variant="link" disabled={busy} onClick={() => run(() => restoreEntry(removedEntryId))}>
              Restore instead?
            </Button>
          )}
        </div>
      )}
    </Modal>
  )
}
