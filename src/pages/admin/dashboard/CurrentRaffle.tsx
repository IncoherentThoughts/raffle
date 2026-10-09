import { useEffect, useState } from 'react'
import {
  cancelRaffle,
  closeRaffleEarly,
  drawRaffle,
  raffleEntries,
  raffleStatus,
  type Raffle,
} from '../../../lib/api/dashboard'
import { formatTimeLeft } from '../../../lib/timeLeft'
import { useAdminQuery, useApiErrorHandler } from '../data/useAdminQuery'
import { Button, ConfirmDialog, InlineError, Loading, Panel, StatTile, Tag } from '../ui'
import { EntriesChart } from './EntriesChart'
import { formatDateTime, friendlyError, plural } from './format'
import { EditRaffleModal } from './RaffleDialogs'
import { raffleStats } from './stats'

type Dialog = 'edit' | 'close' | 'cancel' | 'draw' | null

/** Ticks every second so the countdown and the Open -> Closed switch stay live. */
function useNow(): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])
  return now
}

/** Draw confirm copy, exactly per #6 (+ the #7 flag line). */
export function drawMessage(n: number, e: number): string {
  if (e < n)
    return `Only ${e} eligible ${e === 1 ? 'entry' : 'entries'} for ${n} slots. Draw ${plural(e, 'winner', 'winners')} and leave the rest vacant?`
  return `Draw ${plural(n, 'winner', 'winners')} from ${plural(e, 'eligible entry', 'eligible entries')}? This is final; winners can only be changed by Redraw.`
}

export function flagLine(f: number): string {
  return `${f} ${f === 1 ? 'entry carries' : 'entries carry'} undismissed flags.`
}

/** The Open / Closed view of the current Raffle. */
export function CurrentRaffle({ raffle, version, onChanged }: { raffle: Raffle; version: number; onChanged: () => void }) {
  const now = useNow()
  const status = raffleStatus(raffle, now)
  const closed = status === 'closed'
  const entries = useAdminQuery(() => raffleEntries(raffle.id), [raffle.id, version])
  const stats = entries.data ? raffleStats(raffle, entries.data) : null
  const handleError = useApiErrorHandler()
  const [dialog, setDialog] = useState<Dialog>(null)

  // Entries keep arriving while Open: refresh the stats every 30 s.
  const { reload: reloadEntries } = entries
  useEffect(() => {
    const t = setInterval(reloadEntries, 30_000)
    return () => clearInterval(t)
  }, [reloadEntries])

  // Refresh the stats when Close Time passes so the Draw confirm uses the final pool.
  useEffect(() => {
    if (closed) entries.reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only on the Open -> Closed edge
  }, [closed])

  async function act(run: () => Promise<unknown>) {
    try {
      await run()
    } catch (e) {
      const err = handleError(e)
      if (err) throw new Error(friendlyError(err), { cause: e })
      return
    }
    setDialog(null)
    onChanged()
  }

  const eligible = stats?.eligible ?? 0

  return (
    <Panel
      title={
        <>
          <span className="dash-kicker">Current raffle</span>{' '}
          <span className="dash-title">{raffle.title}</span>
        </>
      }
      actions={closed ? <Tag tone="neutral">Closed</Tag> : <Tag tone="blue">Open</Tag>}
      className="dash-current"
    >
      <p className="lead dash-panel-lead">
        {raffle.prize ? `${raffle.prize} · ` : ''}
        {closed ? 'closed ' : 'closes '}
        <span className="num">{formatDateTime(raffle.close_time)}</span>
        {' · '}
        {plural(raffle.winner_count, 'winner', 'winners')}
        {' · '}
        {raffle.exclusion_enabled ? `excludes winners from the last ${raffle.exclusion_months} months` : 'no Exclusion Window'}
      </p>
      <p className="dash-countdown">
        {closed ? (
          <b>Entries closed</b>
        ) : (
          <>
            Closes in{' '}
            <b className="num dash-countdown__left">{formatTimeLeft(new Date(raffle.close_time).getTime() - now)}</b>
          </>
        )}
      </p>

      {entries.error && <InlineError>{friendlyError(entries.error)}</InlineError>}
      {!stats && entries.loading && <Loading label="Loading stats…" />}
      {stats && (
        <>
          <div className="stats dash-stats">
            <StatTile tone="blue" value={stats.entries} label="Entries" />
            <StatTile tone="green" value={stats.eligible} label="Eligible" />
            <StatTile tone="gold" value={stats.excluded} label="Excluded" />
            <StatTile tone="red" value={stats.flags} label="Flags" />
            <StatTile tone="blue" value={stats.new} label="New" />
            <StatTile tone="blue" value={stats.returning} label="Returning" />
          </div>
          <EntriesChart daily={stats.daily} />
        </>
      )}

      <div className="dash-actions">
        <div className="dash-actions__group">
          <Button variant="outline" onClick={() => setDialog('edit')}>
            Edit
          </Button>
          {!closed && (
            <Button variant="danger" onClick={() => setDialog('close')}>
              Close early
            </Button>
          )}
          <Button variant="danger" onClick={() => setDialog('cancel')}>
            Cancel raffle
          </Button>
        </div>
        <div className="dash-actions__draw">
          <Button
            variant="gold"
            disabled={!closed || !stats || eligible === 0}
            onClick={() => {
              entries.reload()
              setDialog('draw')
            }}
          >
            Draw {raffle.winner_count === 1 ? 'winner' : 'winners'}
          </Button>
          {!closed && <small className="dash-hint">enabled once entries close</small>}
          {closed && stats && eligible === 0 && <small className="dash-hint">no eligible entries to draw from</small>}
        </div>
      </div>

      {dialog === 'edit' && (
        <EditRaffleModal
          raffle={raffle}
          onClose={() => setDialog(null)}
          onSaved={() => {
            setDialog(null)
            onChanged()
          }}
        />
      )}
      <ConfirmDialog
        open={dialog === 'close'}
        title="Close entries early"
        confirmLabel="Close early"
        tone="danger"
        onCancel={() => setDialog(null)}
        onConfirm={() => act(() => closeRaffleEarly(raffle.id))}
      >
        Close entries for “{raffle.title}” now? You can reopen it later with Edit by moving the Close Time into the
        future.
      </ConfirmDialog>
      <ConfirmDialog
        open={dialog === 'cancel'}
        title="Cancel raffle"
        confirmLabel="Cancel raffle"
        tone="danger"
        requireReason
        onCancel={() => setDialog(null)}
        onConfirm={(reason) => act(() => cancelRaffle(raffle.id, reason))}
      >
        Cancel “{raffle.title}”? Its entries stay on record, but it can never be reopened or drawn.
      </ConfirmDialog>
      <ConfirmDialog
        open={dialog === 'draw'}
        title="Draw winners"
        confirmLabel="Draw"
        tone="gold"
        onCancel={() => setDialog(null)}
        onConfirm={() => act(() => drawRaffle(raffle.id))}
      >
        {stats && (
          <>
            <p>{drawMessage(raffle.winner_count, stats.eligible)}</p>
            <p>{flagLine(stats.flags)}</p>
          </>
        )}
      </ConfirmDialog>
    </Panel>
  )
}
