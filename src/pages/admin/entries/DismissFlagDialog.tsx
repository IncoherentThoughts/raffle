import { useState } from 'react'
import { dismissFlag, type FlagRule } from '../../../lib/api/entries'
import { useApiErrorHandler } from '../data/useAdminQuery'
import { ConfirmDialog } from '../ui'
import { friendlyEntryError } from './errors'
import { RULE_LABEL, type FlagPair } from './entriesModel'

export type DismissTarget = { rule: FlagRule; entryId: string; entryName: string; pairs: FlagPair[] }

type Props = {
  raffleId: string
  target: DismissTarget | null
  onClose: () => void
  onDismissed: () => void
}

/**
 * Dismiss a Duplicate Flag per (Raffle, rule, pair) with a reason (logged in the Activity Log).
 * When the pill covers several pairs, the admin ticks which ones to dismiss (all by default).
 */
export function DismissFlagDialog(props: Props) {
  // Remount per target so the ticked pairs reset.
  const { target } = props
  return <DismissFlagDialogInner key={target ? `${target.entryId}-${target.rule}` : 'closed'} {...props} />
}

function DismissFlagDialogInner({ raffleId, target, onClose, onDismissed }: Props) {
  const handleError = useApiErrorHandler()
  const [unticked, setUnticked] = useState<Set<string>>(new Set())
  const label = target ? RULE_LABEL[target.rule] : ''
  const chosen = target?.pairs.filter((p) => !unticked.has(p.otherId)) ?? []

  function toggle(otherId: string, checked: boolean) {
    setUnticked((s) => {
      const next = new Set(s)
      if (checked) next.delete(otherId)
      else next.add(otherId)
      return next
    })
  }

  return (
    <ConfirmDialog
      open={target !== null}
      title={`Dismiss “${label}” flag`}
      confirmLabel="Dismiss"
      requireReason
      onCancel={onClose}
      onConfirm={async (reason) => {
        if (!target) return
        if (chosen.length === 0) throw new Error('Pick at least one entry.')
        try {
          for (const p of chosen) await dismissFlag(raffleId, target.rule, target.entryId, p.otherId, reason)
        } catch (e) {
          const err = handleError(e)
          if (err) throw new Error(friendlyEntryError(err), { cause: e })
          return
        }
        onDismissed()
      }}
    >
      {target && (
        <>
          <p className="entries__dismiss-lead">
            <b>{target.entryName}</b> is flagged “{label}” with
            {target.pairs.length === 1 && (
              <>
                {' '}
                <b>{target.pairs[0].otherName}</b> ({target.pairs[0].otherEmail}
                {target.pairs[0].otherRemoved && ', removed'})
              </>
            )}
            {target.pairs.length === 1 ? '.' : ':'}
          </p>
          {target.pairs.length > 1 && (
            <fieldset className="entries__dismiss-pairs">
              <legend className="visually-hidden">Pairs to dismiss</legend>
              {target.pairs.map((p) => (
                <label key={p.otherId}>
                  <input
                    type="checkbox"
                    checked={!unticked.has(p.otherId)}
                    onChange={(e) => toggle(p.otherId, e.target.checked)}
                  />{' '}
                  {p.otherName} ({p.otherEmail}
                  {p.otherRemoved && ', removed'})
                </label>
              ))}
            </fieldset>
          )}
          <p className="entries__dismiss-lead">Dismissing hides the pill in this raffle only. Flags never block the Draw.</p>
        </>
      )}
    </ConfirmDialog>
  )
}
