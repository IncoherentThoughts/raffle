import { useState, type FormEvent } from 'react'
import { addPastWinner } from '../../../lib/api/winners'
import { useApiErrorHandler } from '../data/useAdminQuery'
import { Button, InlineError, Modal, TextField } from '../ui'
import { friendlyError, localDateToIso, todayInputValue } from './format'

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

type Errors = { name?: string; email?: string; wonAt?: string }

/** "Add past winner" modal: name, email, Won Date, note. */
export function PastWinnerForm({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const handleError = useApiErrorHandler()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [wonAt, setWonAt] = useState('')
  const [note, setNote] = useState('')
  const [errors, setErrors] = useState<Errors>({})
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  function close() {
    setName('')
    setEmail('')
    setWonAt('')
    setNote('')
    setErrors({})
    setError(null)
    onClose()
  }

  function validate(): Errors {
    const e: Errors = {}
    if (!name.trim()) e.name = 'Enter a name.'
    if (!EMAIL.test(email.trim())) e.email = 'Enter a valid email address.'
    if (!localDateToIso(wonAt)) e.wonAt = 'Enter the date they won.'
    else if (wonAt > todayInputValue()) e.wonAt = "The won date can't be in the future."
    return e
  }

  async function submit(ev: FormEvent) {
    ev.preventDefault()
    const e = validate()
    setErrors(e)
    if (Object.keys(e).length) return
    setBusy(true)
    setError(null)
    try {
      await addPastWinner({
        fullName: name.trim(),
        email: email.trim(),
        wonAt: localDateToIso(wonAt)!,
        note: note.trim() || undefined,
      })
      close()
      onSaved()
    } catch (err) {
      const apiErr = handleError(err)
      if (apiErr) setError(friendlyError(apiErr.message))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open={open}
      title="Add past winner"
      onClose={close}
      footer={
        <>
          <Button variant="outline" onClick={close} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" form="past-winner-form" disabled={busy}>
            Add past winner
          </Button>
        </>
      }
    >
      <form id="past-winner-form" onSubmit={submit} noValidate>
        <p className="confirm__message">
          Record a winner from an earlier giveaway so they count toward the Exclusion Window.
        </p>
        <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} error={errors.name} />
        <TextField
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={errors.email}
        />
        <TextField
          label="Won date"
          type="date"
          max={todayInputValue()}
          value={wonAt}
          onChange={(e) => setWonAt(e.target.value)}
          error={errors.wonAt}
        />
        <TextField
          label="Note"
          hint="(optional)"
          description="e.g. which giveaway it was."
          value={note}
          onChange={(e) => setNote(e.target.value)}
          multiline
          rows={2}
        />
        {error && <InlineError>{error}</InlineError>}
      </form>
    </Modal>
  )
}
