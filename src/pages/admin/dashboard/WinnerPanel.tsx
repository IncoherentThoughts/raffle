import { useState } from 'react'
import { redrawWinner, winnerPanel, type Raffle, type Slot } from '../../../lib/api/dashboard'
import { useAdminQuery, useApiErrorHandler } from '../data/useAdminQuery'
import { Button, ConfirmDialog, InlineError, Loading, Panel, Tag } from '../ui'
import { formatDate, formatDateTime, friendlyError, plural } from './format'

/** Gold winner panel for a Drawn Raffle: slots, Redraw per Winner, Redraw count + reasons. */
export function WinnerPanel({ raffle, title, version }: { raffle: Raffle; title: string; version: number }) {
  const { data, error, loading, reload } = useAdminQuery(() => winnerPanel(raffle.id), [raffle.id, version])
  const handleError = useApiErrorHandler()
  const [redrawing, setRedrawing] = useState<Slot | null>(null)

  const replaced = (data?.winners ?? []).filter((w) => w.status === 'replaced')

  return (
    <Panel accent="gold" title={title} actions={<Tag tone="gold">Drawn</Tag>} className="dash-winners">
      <p className="lead dash-panel-lead">
        <b className="dash-raffle-name">{raffle.title}</b>
        {raffle.prize ? ` · ${raffle.prize}` : ''}
        {raffle.drawn_at && (
          <>
            {' · drawn '}
            <span className="num">{formatDateTime(raffle.drawn_at)}</span>
          </>
        )}
      </p>
      {error && <InlineError>{friendlyError(error)}</InlineError>}
      {!data && loading && <Loading />}
      {data && (
        <>
          <ol className="dash-slots">
            {data.slots.map((s) =>
              s.vacant ? (
                <li key={s.position} className="dash-slot dash-slot--vacant">
                  Slot {s.position}: vacant (no eligible alternates)
                </li>
              ) : (
                <li key={s.position} className="dash-slot">
                  <span className="dash-slot__pos num">Slot {s.position}</span>
                  <div className="dash-slot__who">
                    <b>{s.full_name}</b>
                    <span>
                      {s.email} · won <span className="num">{formatDate(s.won_at)}</span>
                      {s.source === 'redraw' ? ' · alternate (Redraw)' : ''}
                    </span>
                  </div>
                  <Button variant="link" onClick={() => setRedrawing(s)} aria-label={`Redraw ${s.full_name}`}>
                    Redraw
                  </Button>
                </li>
              ),
            )}
          </ol>
          <div className="dash-redraws">
            <p className="dash-redraws__count">
              Redraws: <b className="num">{replaced.length}</b>
            </p>
            {replaced.length > 0 && (
              <ul className="dash-redraws__list">
                {replaced.map((w) => (
                  <li key={w.id}>
                    Slot {w.position}: {w.full_name} replaced{' '}
                    <span className="num">{w.replaced_at ? formatDate(w.replaced_at) : ''}</span>: “{w.replaced_reason}”
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
      <ConfirmDialog
        open={redrawing !== null}
        title={redrawing ? `Redraw slot ${redrawing.position}` : 'Redraw'}
        confirmLabel="Redraw"
        requireReason
        onCancel={() => setRedrawing(null)}
        onConfirm={async (reason) => {
          if (!redrawing) return
          try {
            await redrawWinner(redrawing.winner_id, reason)
          } catch (e) {
            const err = handleError(e)
            if (err) throw new Error(friendlyError(err), { cause: e })
            return
          }
          setRedrawing(null)
          reload()
        }}
      >
        {redrawing && data && (
          <>
            <p>
              Replace <b>{redrawing.full_name}</b> in slot {redrawing.position} with an alternate drawn from this
              raffle’s Draw Snapshot? {redrawing.full_name} stays on record as Replaced.
            </p>
            <p>
              {data.alternatesRemaining > 0
                ? `${plural(data.alternatesRemaining, 'eligible alternate remains', 'eligible alternates remain')}.`
                : `No eligible alternates remain: slot ${redrawing.position} will be left vacant.`}
            </p>
          </>
        )}
      </ConfirmDialog>
    </Panel>
  )
}
