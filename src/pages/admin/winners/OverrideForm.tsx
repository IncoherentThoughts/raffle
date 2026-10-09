import { useState, type FormEvent } from 'react'
import { setOverride, type OverrideKind } from '../../../lib/api/winners'
import { useApiErrorHandler } from '../data/useAdminQuery'
import { Button, InlineError, MIN_REASON_LENGTH, Modal, TextField } from '../ui'
import { friendlyError, localDateToIso, OVERRIDE_LABEL, todayInputValue } from './format'

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

/** Who the Override is for: a known Winner (email fixed) or any email ("Add override"). */
export type OverrideTarget = { email: string; name?: string; currentKind?: OverrideKind | null } | 'new'

type Errors = { email?: string; kind?: string; expires?: string }

/**
 * Set an Eligibility Override: Always eligible / Always excluded, a reason (>= 3 chars) and
 * an optional expiry. Setting one replaces the Entrant's current Override.
 */
export function OverrideForm({
  target,
  onClose,
  onSaved,
}: {
  target: OverrideTarget | null
  onClose: () => void
  onSaved: () => void
}) {
  const handleError = useApiErrorHandler()
  const [email, setEmail] = useState('')
  const [kind, setKind] = useState<OverrideKind | null>(null)
  const [reason, setReason] = useState('')
  const [expires, setExpires] = useState('')
  const [errors, setErrors] = useState<Errors>({})
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const fixed = target && target !== 'new' ? target : null
  const reasonOk = reason.trim().length >= MIN_REASON_LENGTH

  function close() {
    setEmail('')
    setKind(null)
    setReason('')
    setExpires('')
    setErrors({})
    setError(null)
    onClose()
  }

  function validate(): Errors {
    const e: Errors = {}
    if (!fixed && !EMAIL.test(email.trim())) e.email = 'Enter a valid email address.'
    if (!kind) e.kind = 'Choose Always eligible or Always excluded.'
    if (expires && !localDateToIso(expires)) e.expires = 'Enter a valid date.'
    else if (expires && expires <= todayInputValue()) e.expires = 'The expiry must be after today.'
    return e
  }

  async function submit(ev: FormEvent) {
    ev.preventDefault()
    const e = validate()
    setErrors(e)
    if (Object.keys(e).length || !reasonOk) return
    setBusy(true)
    setError(null)
    try {
      await setOverride({
        email: fixed ? fixed.email : email.trim(),
        kind: kind!,
        reason: reason.trim(),
        expiresAt: expires ? localDateToIso(expires) : null,
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

  const title = fixed ? (fixed.currentKind ? 'Change override' : 'Set override') : 'Add override'

  return (
    <Modal
      open={target !== null}
      title={title}
      onClose={close}
      footer={
        <>
          <Button variant="outline" onClick={close} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" form="override-form" disabled={busy || !reasonOk}>
            Save override
          </Button>
        </>
      }
    >
      <form id="override-form" onSubmit={submit} noValidate>
        {fixed ? (
          <p className="confirm__message">
            For <b>{fixed.name ?? fixed.email}</b>
            {fixed.name && <> ({fixed.email})</>}. It beats the Exclusion Window at every Draw
            {fixed.currentKind && <> and replaces the current override ({OVERRIDE_LABEL[fixed.currentKind]})</>}.
          </p>
        ) : (
          <>
            <p className="confirm__message">
              Applies to this email at every Draw, whether or not they have won. Replaces any current override.
            </p>
            <TextField
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={errors.email}
            />
          </>
        )}
        <fieldset className="winners__kind" aria-invalid={errors.kind ? true : undefined}>
          <legend className="field-label">Override</legend>
          {(Object.keys(OVERRIDE_LABEL) as OverrideKind[]).map((k) => (
            <label key={k} className="winners__radio">
              <input type="radio" name="override-kind" value={k} checked={kind === k} onChange={() => setKind(k)} />
              {OVERRIDE_LABEL[k]}
            </label>
          ))}
          {errors.kind && <p className="field-error">{errors.kind}</p>}
        </fieldset>
        <TextField
          label="Reason"
          description={`At least ${MIN_REASON_LENGTH} characters; kept in the activity log.`}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          multiline
          rows={2}
        />
        <TextField
          label="Expires on"
          hint="(optional)"
          description="Leave empty to keep it until cleared."
          type="date"
          min={todayInputValue()}
          value={expires}
          onChange={(e) => setExpires(e.target.value)}
          error={errors.expires}
        />
        {error && <InlineError>{error}</InlineError>}
      </form>
    </Modal>
  )
}
