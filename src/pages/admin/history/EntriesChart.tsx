import { useState } from 'react'
import { Link } from 'react-router-dom'
import type { HistoryRaffle } from '../../../lib/api/history'
import { formatDate } from './model'

const shortDate = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' })

/**
 * Entries per Raffle over time: one bar per completed Raffle, oldest on the left. Drawn
 * Raffles are solid, Cancelled ones outlined. Each bar links to the Raffle's detail page
 * and shows a tooltip on hover/focus. The table below the chart is its table view.
 */
export function EntriesChart({ raffles }: { raffles: HistoryRaffle[] }) {
  const [active, setActive] = useState<string | null>(null)
  const ordered = [...raffles].sort((a, b) => a.openedAt.localeCompare(b.openedAt))
  const max = Math.max(1, ...ordered.map((r) => r.entries))
  const hasCancelled = ordered.some((r) => r.state === 'cancelled')
  const hasDrawn = ordered.some((r) => r.state === 'drawn')

  return (
    <figure className="entries-chart">
      {hasCancelled && hasDrawn && (
        <div className="entries-chart__legend" aria-hidden="true">
          <span>
            <i className="entries-chart__key" /> Drawn
          </span>
          <span>
            <i className="entries-chart__key entries-chart__key--cancelled" /> Cancelled
          </span>
        </div>
      )}
      <div className="entries-chart__plot">
        {ordered.map((r, i) => {
          const label = `${r.title}: ${r.entries} ${r.entries === 1 ? 'entry' : 'entries'}, ${
            r.state === 'drawn' ? 'drawn' : 'cancelled'
          } ${formatDate(r.endedAt)}`
          return (
            <Link
              key={r.id}
              to={`/admin/history/${r.id}`}
              className={`entries-chart__col${r.state === 'cancelled' ? ' is-cancelled' : ''}`}
              aria-label={label}
              onMouseEnter={() => setActive(r.id)}
              onMouseLeave={() => setActive(null)}
              onFocus={() => setActive(r.id)}
              onBlur={() => setActive(null)}
            >
              <span className="entries-chart__track">
                <span className="entries-chart__bar" style={{ height: `${(r.entries / max) * 100}%` }}>
                  <span className="entries-chart__value num">{r.entries}</span>
                </span>
              </span>
              <span className="entries-chart__date num">{shortDate.format(new Date(r.openedAt))}</span>
              {active === r.id && (
                <span
                  className={`entries-chart__tip${i >= ordered.length / 2 && i > 0 ? ' entries-chart__tip--end' : ''}`}
                  role="tooltip"
                >
                  <b>{r.title}</b>
                  <span className="num">
                    {r.entries} {r.entries === 1 ? 'entry' : 'entries'}
                    {r.eligible !== null && ` (${r.eligible} eligible, ${r.excluded ?? 0} excluded)`}
                  </span>
                  <span>
                    {r.state === 'drawn' ? 'Drawn' : 'Cancelled'} {formatDate(r.endedAt)}
                  </span>
                </span>
              )}
            </Link>
          )
        })}
      </div>
      <figcaption className="visually-hidden">
        Entries per raffle, oldest first. The table below lists the same numbers.
      </figcaption>
    </figure>
  )
}
