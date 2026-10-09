import { createRaffle, updateRaffle, type Raffle } from '../../../lib/api/dashboard'
import { useApiErrorHandler } from '../data/useAdminQuery'
import { Button, InlineError, Modal, Panel } from '../ui'
import { friendlyError } from './format'
import {
  CloseTimeNotice,
  closeTimeEffect,
  EMPTY_FORM,
  formFromRaffle,
  RaffleFields,
  toInput,
  useRaffleForm,
} from './RaffleForm'

/** "Start a new raffle" panel (No Raffle and Drawn states). */
export function NewRaffleForm({ onCreated }: { onCreated: () => void }) {
  const form = useRaffleForm(EMPTY_FORM)
  const handleError = useApiErrorHandler()

  async function save() {
    try {
      await createRaffle(toInput(form.values))
      form.setValues(EMPTY_FORM)
      onCreated()
    } catch (e) {
      const err = handleError(e)
      if (err) throw new Error(friendlyError(err), { cause: e })
    }
  }

  return (
    <Panel title="Start a new raffle">
      <p className="lead dash-panel-lead">
        Only one raffle can be open at a time. This opens entries immediately and updates the public page.
      </p>
      <form noValidate onSubmit={(e) => form.submit(e, { requireFuture: true }, save)} aria-label="Start a new raffle">
        <RaffleFields values={form.values} errors={form.errors} onChange={form.setValues} />
        {form.submitError && <InlineError>{form.submitError}</InlineError>}
        <Button type="submit" disabled={form.busy}>
          Open the raffle
        </Button>
      </form>
    </Panel>
  )
}

/** Edit modal: same fields, pre-filled. Warns before Save when the Close Time closes or reopens it. */
export function EditRaffleModal({
  raffle,
  onClose,
  onSaved,
}: {
  raffle: Raffle
  onClose: () => void
  onSaved: () => void
}) {
  const form = useRaffleForm(formFromRaffle(raffle))
  const handleError = useApiErrorHandler()
  const effect = closeTimeEffect(form.values, raffle)

  async function save() {
    try {
      await updateRaffle(raffle.id, toInput(form.values, raffle))
      onSaved()
    } catch (e) {
      const err = handleError(e)
      if (err) throw new Error(friendlyError(err), { cause: e })
    }
  }

  const submit = () => form.submit(undefined, { requireFuture: false }, save)

  return (
    <Modal
      open
      wide
      title="Edit raffle"
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={form.busy}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={form.busy}>
            {effect === 'close' ? 'Save and close entries' : effect === 'reopen' ? 'Save and reopen' : 'Save'}
          </Button>
        </>
      }
    >
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault()
          void submit()
        }}
      >
        <RaffleFields values={form.values} errors={form.errors} onChange={form.setValues} />
        <CloseTimeNotice effect={effect} closeTime={form.values.closeTime} />
        {form.submitError && <InlineError>{form.submitError}</InlineError>}
      </form>
    </Modal>
  )
}
