import { useId, useState, type FormEvent, type ReactNode } from 'react'
import type { Raffle, RaffleInput } from '../../../lib/api/dashboard'
import { TextField } from '../ui'
import { formatDateTime, fromLocalInput, toLocalInput } from './format'

export type RaffleFormValues = {
  title: string
  prize: string
  details: string
  /** datetime-local value, local time. */
  closeTime: string
  winnerCount: string
  exclusionEnabled: boolean
  exclusionMonths: string
}

export const EMPTY_FORM: RaffleFormValues = {
  title: '',
  prize: '',
  details: '',
  closeTime: '',
  winnerCount: '1',
  exclusionEnabled: true,
  exclusionMonths: '12',
}

export function formFromRaffle(r: Raffle): RaffleFormValues {
  return {
    title: r.title,
    prize: r.prize ?? '',
    details: r.details ?? '',
    closeTime: toLocalInput(r.close_time),
    winnerCount: String(r.winner_count),
    exclusionEnabled: r.exclusion_enabled,
    exclusionMonths: String(r.exclusion_months),
  }
}

type Errors = Partial<Record<keyof RaffleFormValues, string>>

const isInt = (s: string) => /^\d+$/.test(s.trim())

/** Validate; returns errors (empty when valid). `requireFuture` for create. */
export function validateRaffle(v: RaffleFormValues, { requireFuture }: { requireFuture: boolean }): Errors {
  const errors: Errors = {}
  if (!v.title.trim()) errors.title = 'Enter a title.'
  else if (v.title.trim().length > 200) errors.title = 'Keep the title under 200 characters.'
  const close = fromLocalInput(v.closeTime)
  if (!close) errors.closeTime = 'Pick a Close Time.'
  else if (requireFuture && close.getTime() <= Date.now()) errors.closeTime = 'Close Time must be in the future.'
  const n = Number(v.winnerCount)
  if (!isInt(v.winnerCount) || n < 1) errors.winnerCount = 'Winner Count must be a whole number, at least 1.'
  else if (n > 100) errors.winnerCount = 'Winner Count can be at most 100.'
  const m = Number(v.exclusionMonths)
  if (v.exclusionEnabled && (!isInt(v.exclusionMonths) || m < 1 || m > 120))
    errors.exclusionMonths = 'Months must be a whole number from 1 to 120.'
  return errors
}

export function toInput(v: RaffleFormValues, original?: Raffle): RaffleInput {
  const months = Number(v.exclusionMonths)
  return {
    title: v.title.trim(),
    prize: v.prize.trim(),
    details: v.details.trim(),
    closeTime: fromLocalInput(v.closeTime)!.toISOString(),
    winnerCount: Number(v.winnerCount),
    exclusionEnabled: v.exclusionEnabled,
    // Months are kept even when the Window is off; an invalid value then falls back.
    exclusionMonths: isInt(v.exclusionMonths) && months >= 1 && months <= 120 ? months : (original?.exclusion_months ?? 12),
  }
}

/** The create/edit fields. Controlled; the parent owns submit and the buttons. */
export function RaffleFields({
  values,
  errors,
  onChange,
}: {
  values: RaffleFormValues
  errors: Errors
  onChange: (v: RaffleFormValues) => void
}) {
  const set = <K extends keyof RaffleFormValues>(k: K, val: RaffleFormValues[K]) => onChange({ ...values, [k]: val })
  const monthsId = useId()
  return (
    <>
      <div className="dash-grid2">
        <TextField
          label="Raffle title"
          placeholder="e.g., Labor Day Grill Giveaway"
          value={values.title}
          onChange={(e) => set('title', e.target.value)}
          error={errors.title}
          maxLength={200}
        />
        <TextField
          label="Prize"
          hint="(optional)"
          placeholder='e.g., Blackstone 36" Griddle'
          value={values.prize}
          onChange={(e) => set('prize', e.target.value)}
          maxLength={500}
        />
        <TextField
          label="Close Time"
          type="datetime-local"
          value={values.closeTime}
          onChange={(e) => set('closeTime', e.target.value)}
          error={errors.closeTime}
        />
        <TextField
          label="Winner Count"
          type="number"
          min={1}
          max={100}
          step={1}
          inputMode="numeric"
          value={values.winnerCount}
          onChange={(e) => set('winnerCount', e.target.value)}
          error={errors.winnerCount}
        />
      </div>
      <TextField
        label="Details for the entry page"
        hint="(optional)"
        multiline
        rows={3}
        placeholder="A short description everyone sees when entering."
        value={values.details}
        onChange={(e) => set('details', e.target.value)}
        maxLength={5000}
      />
      <div className="field-group dash-exclusion">
        <label className="dash-check">
          <input
            type="checkbox"
            checked={values.exclusionEnabled}
            onChange={(e) => set('exclusionEnabled', e.target.checked)}
          />
          Exclusion Window: exclude winners from the last
        </label>
        <input
          id={monthsId}
          className="field dash-months num"
          type="number"
          min={1}
          max={120}
          step={1}
          inputMode="numeric"
          aria-label="Exclusion Window months"
          aria-invalid={errors.exclusionMonths ? true : undefined}
          disabled={!values.exclusionEnabled}
          value={values.exclusionMonths}
          onChange={(e) => set('exclusionMonths', e.target.value)}
        />
        <span>months</span>
        {errors.exclusionMonths && <p className="field-error dash-exclusion__error">{errors.exclusionMonths}</p>}
      </div>
    </>
  )
}

/** For Edit: what saving this Close Time will do to an Open/Closed Raffle (#6). */
export function closeTimeEffect(
  values: RaffleFormValues,
  raffle: Raffle,
  now = Date.now(),
): 'close' | 'reopen' | null {
  const close = fromLocalInput(values.closeTime)
  if (!close) return null
  const wasClosed = new Date(raffle.close_time).getTime() <= now
  const willClose = close.getTime() <= now
  if (!wasClosed && willClose) return 'close'
  if (wasClosed && !willClose) return 'reopen'
  return null
}

export function CloseTimeNotice({ effect, closeTime }: { effect: 'close' | 'reopen' | null; closeTime: string }): ReactNode {
  if (effect === 'close')
    return (
      <p className="dash-notice dash-notice--alert" role="status">
        This Close Time is in the past: saving closes entries now (Close early).
      </p>
    )
  if (effect === 'reopen') {
    const d = fromLocalInput(closeTime)
    return (
      <p className="dash-notice dash-notice--alert" role="status">
        This Close Time is in the future: saving reopens the raffle for entries
        {d ? ` until ${formatDateTime(d.toISOString())}` : ''}.
      </p>
    )
  }
  return null
}

/** Submit handler helper: validate, then call `save`; returns field errors to show. */
export function useRaffleForm(initial: RaffleFormValues) {
  const [values, setValues] = useState(initial)
  const [errors, setErrors] = useState<Errors>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(
    e: FormEvent | undefined,
    opts: { requireFuture: boolean },
    save: (v: RaffleFormValues) => Promise<void>,
  ) {
    e?.preventDefault()
    const errs = validateRaffle(values, opts)
    setErrors(errs)
    setSubmitError(null)
    if (Object.keys(errs).length > 0) return
    setBusy(true)
    try {
      await save(values)
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  return { values, setValues, errors, submitError, busy, submit }
}
