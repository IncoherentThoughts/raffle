import { Link, useParams } from 'react-router-dom'
import {
  getRaffleDetail,
  type RaffleDetail,
  type SnapshotEntryRow,
  type WinnerRow,
} from '../../../lib/api/history'
import { useAdminQuery } from '../data/useAdminQuery'
import {
  DataTable,
  EmptyState,
  Flag,
  InlineError,
  Loading,
  PageHeader,
  Panel,
  StatGrid,
  StatTile,
  Tag,
  type Column,
} from '../ui'
import { ActivityTable } from './ActivityTable'
import { FLAG_LABELS, formatDateTime, verdictLabel, winnerSlots, type Slot } from './model'

/** /admin/history/:raffleId: one Raffle's facts, Winners, Draw Snapshot and Activity Log. */
export function RaffleDetailPage() {
  const { raffleId = '' } = useParams()
  const { data, error, loading } = useAdminQuery(() => getRaffleDetail(raffleId), [raffleId])
  return (
    <>
      <p className="history-back">
        <Link to="/admin/history">← History</Link>
      </p>
      {error && <InlineError>{`Couldn't load this raffle (${error.message}).`}</InlineError>}
      {data === undefined && loading && <Loading />}
      {data === null && (
        <Panel>
          <EmptyState title="Raffle not found">It may have been mistyped; pick one from History.</EmptyState>
        </Panel>
      )}
      {data && <Detail detail={data} />}
    </>
  )
}

function statusTag(state: string) {
  if (state === 'drawn') return <Tag tone="gold">Drawn</Tag>
  if (state === 'cancelled') return <Tag tone="red">Cancelled</Tag>
  return <Tag tone="blue">Open</Tag>
}

function Detail({ detail }: { detail: RaffleDetail }) {
  const { raffle, snapshot, winners, snapshotEntries, activity, entryCount } = detail
  const redraws = winners.filter((w) => w.status === 'replaced').length
  return (
    <>
      <PageHeader
        title={raffle.title}
        lead={raffle.prize ?? undefined}
        actions={
          <Link className="btn btn--outline" to={`/admin/entries/${raffle.id}`}>
            View entries
          </Link>
        }
      />

      {raffle.state === 'cancelled' && (
        <Panel title="Cancelled">
          <p className="history-cancel">
            <span className="history-cancel__label">Reason</span>
            {raffle.cancel_reason}
          </p>
        </Panel>
      )}

      <Panel title={<>Raffle {statusTag(raffle.state)}</>}>
        <dl className="history-facts">
          <div>
            <dt>Opened</dt>
            <dd className="num">{formatDateTime(raffle.created_at)}</dd>
          </div>
          <div>
            <dt>Close Time</dt>
            <dd className="num">{formatDateTime(raffle.close_time)}</dd>
          </div>
          {raffle.drawn_at && (
            <div>
              <dt>Drawn</dt>
              <dd className="num">{formatDateTime(raffle.drawn_at)}</dd>
            </div>
          )}
          {raffle.cancelled_at && (
            <div>
              <dt>Cancelled</dt>
              <dd className="num">{formatDateTime(raffle.cancelled_at)}</dd>
            </div>
          )}
          <div>
            <dt>Winner Count</dt>
            <dd className="num">{raffle.winner_count}</dd>
          </div>
          <div>
            <dt>Exclusion Window</dt>
            <dd>{raffle.exclusion_enabled ? `On, ${raffle.exclusion_months} months` : 'Off'}</dd>
          </div>
          {raffle.state === 'drawn' && (
            <div>
              <dt>Redraws</dt>
              <dd className="num">{redraws}</dd>
            </div>
          )}
        </dl>
        {raffle.details && <p className="history-details">{raffle.details}</p>}
        <StatGrid>
          <StatTile tone="blue" value={snapshot ? snapshot.eligible_count + snapshot.excluded_count : entryCount} label="Entries" />
          {snapshot && (
            <>
              <StatTile tone="green" value={snapshot.eligible_count} label="Eligible" />
              <StatTile tone="gold" value={snapshot.excluded_count} label="Excluded" />
              <StatTile tone="red" value={snapshot.flagged_count} label="Flags" />
            </>
          )}
        </StatGrid>
      </Panel>

      {raffle.state === 'open' && (
        <Panel>
          <p className="panel__text">This raffle hasn't been drawn yet. Its Winners and Draw Snapshot appear here after the Draw.</p>
        </Panel>
      )}

      {raffle.state === 'drawn' && (
        <>
          <Panel title="Winners" accent="gold">
            <ol className="history-slots">
              {winnerSlots(raffle.winner_count, winners).map((slot) => (
                <SlotItem key={slot.position} slot={slot} />
              ))}
            </ol>
          </Panel>
          <Panel title="Draw Snapshot">
            {snapshot && (
              <p className="panel__text">
                Taken at the Draw, <span className="num">{formatDateTime(snapshot.drawn_at)}</span>: every Entry in
                the pool with its verdict. Flags are the undismissed Duplicate Flags at that moment.
              </p>
            )}
            <div className="history-snapshot">
              <SnapshotTable entries={snapshotEntries} winners={winners} />
            </div>
          </Panel>
        </>
      )}

      <Panel title="Activity">
        <ActivityTable rows={activity} />
      </Panel>
    </>
  )
}

function WinnerLine({ w }: { w: WinnerRow }) {
  return (
    <>
      <b>{w.full_name}</b> <span className="history-muted">{w.email}</span>{' '}
      <span className="history-muted">
        · {w.source === 'redraw' ? 'redrawn' : 'drawn'} <span className="num">{formatDateTime(w.won_at)}</span>
      </span>
    </>
  )
}

function SlotItem({ slot }: { slot: Slot }) {
  const replaced = slot.chain.filter((w) => w.status === 'replaced')
  return (
    <li className="history-slot">
      <div className="history-slot__head">
        <span className="history-slot__pos">Slot {slot.position}</span>
        {slot.standing ? (
          <span>
            <WinnerLine w={slot.standing} />
          </span>
        ) : (
          <span className="history-slot__vacant">
            Vacant (
            {slot.vacancy === 'unfilled' ? 'not enough eligible entries at the Draw' : 'no eligible alternates'})
          </span>
        )}
      </div>
      {replaced.length > 0 && (
        <ol className="history-chain" aria-label={`Slot ${slot.position} Redraw chain`}>
          {replaced.map((w) => (
            <li key={w.id}>
              <span className="history-chain__name">
                <s>{w.full_name}</s> <span className="history-muted">{w.email}</span>
              </span>{' '}
              <span className="history-muted">
                replaced <span className="num">{formatDateTime(w.replaced_at)}</span>:
              </span>{' '}
              <span className="history-chain__reason">{w.replaced_reason}</span>
            </li>
          ))}
        </ol>
      )}
    </li>
  )
}

type SnapshotRowView = SnapshotEntryRow & { result: string }

function SnapshotTable({ entries, winners }: { entries: SnapshotEntryRow[]; winners: WinnerRow[] }) {
  const byEntry = new Map(winners.filter((w) => w.entry_id).map((w) => [w.entry_id as string, w]))
  const rows: SnapshotRowView[] = entries.map((e) => {
    const w = byEntry.get(e.entry_id)
    const result = !w ? '' : w.status === 'standing' ? `Winner, slot ${w.position}` : `Replaced, slot ${w.position}`
    return { ...e, result }
  })
  const columns: Column<SnapshotRowView>[] = [
    {
      key: 'name',
      header: 'Name',
      className: 'name',
      render: (e) => (
        <>
          {e.full_name}
          {e.flags.map((f) => (
            <Flag key={f} tone="red">
              {FLAG_LABELS[f] ?? f}
            </Flag>
          ))}
        </>
      ),
    },
    { key: 'email', header: 'Email', render: (e) => e.email },
    {
      key: 'verdict',
      header: 'Verdict',
      render: (e) => (
        <Tag tone={e.eligible ? 'green' : e.reason === 'removed' ? 'red' : 'gold'}>{verdictLabel(e)}</Tag>
      ),
    },
    { key: 'result', header: 'Result', render: (e) => e.result },
  ]
  return (
    <DataTable
      caption="Draw Snapshot"
      columns={columns}
      rows={rows}
      rowKey={(e) => e.entry_id}
      rowClassName={(e) => (e.result.startsWith('Winner') ? 'row--gold' : undefined)}
      empty={<EmptyState title="No Snapshot on record" />}
    />
  )
}

