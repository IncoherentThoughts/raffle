import { Link } from 'react-router-dom'
import type { ActivityRow } from '../../../lib/api/history'
import { DataTable, EmptyState, type Column } from '../ui'
import { describeActivity, formatDateTime } from './model'

/** Link to a Raffle's History detail once it is Drawn or Cancelled; plain text before. */
function RaffleRef({ row }: { row: ActivityRow }) {
  if (!row.raffle_id || !row.raffles) return null
  const { title, state } = row.raffles
  return state === 'open' ? (
    <>{title}</>
  ) : (
    <Link className="history-link" to={`/admin/history/${row.raffle_id}`}>
      {title}
    </Link>
  )
}

/**
 * Activity Log rows: When, Action (a readable sentence), Target, Reason. `withRaffle` adds a
 * Raffle column for the full log; the Raffle detail page leaves it out.
 */
export function ActivityTable({ rows, withRaffle = false }: { rows: ActivityRow[]; withRaffle?: boolean }) {
  const columns: Column<ActivityRow>[] = [
    { key: 'at', header: 'When', className: 'num', render: (r) => formatDateTime(r.at) },
    { key: 'action', header: 'Action', render: (r) => describeActivity(r) },
    {
      key: 'target',
      header: 'Target',
      render: (r) => (r.target_type === 'raffle' && withRaffle ? <RaffleRef row={r} /> : (r.target_label ?? '—')),
    },
    ...(withRaffle
      ? [
          {
            key: 'raffle',
            header: 'Raffle',
            render: (r: ActivityRow) => (r.target_type === 'raffle' ? '' : <RaffleRef row={r} />),
          },
        ]
      : []),
    { key: 'reason', header: 'Reason', render: (r) => r.reason ?? '' },
  ]
  return (
    <DataTable
      caption="Activity log"
      columns={columns}
      rows={rows}
      rowKey={(r) => String(r.id)}
      empty={<EmptyState title="No activity yet" />}
    />
  )
}
