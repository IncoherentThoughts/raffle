import { useState } from 'react'
import {
  clearOverride,
  deletePastWinner,
  listOverrides,
  listWinners,
  type OverrideRow,
  type WinnerRow,
} from '../../../lib/api/winners'
import { useAdminQuery, useApiErrorHandler } from '../data/useAdminQuery'
import {
  Button,
  ConfirmDialog,
  DataTable,
  EmptyState,
  InlineError,
  Loading,
  PageHeader,
  Panel,
  Tag,
  type Column,
} from '../ui'
import { formatDate, friendlyError, OVERRIDE_LABEL, overrideTitle, winnerStatus } from './format'
import { OverrideForm, type OverrideTarget } from './OverrideForm'
import { PastWinnerForm } from './PastWinnerForm'
import './winners.css'

type Clearing = { id: string; label: string }

/** Winners tab (#15): every Winner with Exclusion Window status, Past Winners, Eligibility Overrides. */
export function WinnersTab() {
  const winners = useAdminQuery(listWinners, [])
  const overrides = useAdminQuery(listOverrides, [])
  const handleError = useApiErrorHandler()

  const [showReplaced, setShowReplaced] = useState(false)
  const [adding, setAdding] = useState(false)
  const [overrideTarget, setOverrideTarget] = useState<OverrideTarget | null>(null)
  const [clearing, setClearing] = useState<Clearing | null>(null)
  const [deleting, setDeleting] = useState<WinnerRow | null>(null)

  const reloadAll = () => {
    winners.reload()
    overrides.reload()
  }

  /** For ConfirmDialog: throw a friendly Error to keep it open, else close and reload. */
  async function run(action: () => Promise<void>, close: () => void) {
    try {
      await action()
    } catch (e) {
      const err = handleError(e)
      if (err) throw new Error(friendlyError(err.message), { cause: e })
      return
    }
    close()
    reloadAll()
  }

  const all = winners.data ?? []
  const standingCount = all.filter((w) => w.status === 'standing').length
  const replacedCount = all.length - standingCount
  const rows = showReplaced ? all : all.filter((w) => w.status === 'standing')

  const winnerColumns: Column<WinnerRow>[] = [
    {
      key: 'name',
      header: 'Winner',
      className: 'name',
      render: (w) => (
        <>
          <span className="winners__nowrap">{w.full_name}</span>
          <span className="winners__email">{w.email}</span>
        </>
      ),
    },
    { key: 'won', header: 'Won', className: 'num winners__nowrap', render: (w) => formatDate(w.won_at) },
    {
      key: 'raffle',
      header: 'Raffle / Note',
      render: (w) =>
        w.source === 'past' ? (
          <span className="winners__note">{w.note ?? 'Past winner'}</span>
        ) : (
          <>
            {w.raffle_title}
            {w.source === 'redraw' && <span className="winners__sub"> (redraw)</span>}
          </>
        ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (w) => {
        const s = winnerStatus(w)
        return (
          <span title={s.title}>
            <Tag tone={s.tone}>{s.label}</Tag>
          </span>
        )
      },
    },
    {
      key: 'override',
      header: 'Override',
      render: (w) =>
        w.override_kind ? (
          <span title={overrideTitle(w.override_reason, w.override_expires_at)}>
            <Tag tone={w.override_kind === 'force_eligible' ? 'green' : 'red'}>{OVERRIDE_LABEL[w.override_kind]}</Tag>
          </span>
        ) : (
          <span className="winners__none">—</span>
        ),
    },
    {
      key: 'actions',
      header: <span className="visually-hidden">Actions</span>,
      className: 'winners__actions-cell',
      render: (w) => (
        <span className="winners__actions">
          <Button
            variant="link"
            aria-label={`${w.override_kind ? 'Change' : 'Set'} override for ${w.full_name}`}
            onClick={() => setOverrideTarget({ email: w.email, name: w.full_name, currentKind: w.override_kind })}
          >
            Override
          </Button>
          {w.override_id && (
            <Button
              variant="link"
              aria-label={`Clear override for ${w.full_name}`}
              onClick={() => setClearing({ id: w.override_id!, label: `${w.full_name} (${w.email})` })}
            >
              Clear
            </Button>
          )}
          {w.source === 'past' && (
            <Button variant="link-danger" aria-label={`Delete ${w.full_name}`} onClick={() => setDeleting(w)}>
              Delete
            </Button>
          )}
        </span>
      ),
    },
  ]

  const overrideColumns: Column<OverrideRow>[] = [
    { key: 'name', header: 'Name', className: 'name', render: (o) => o.full_name ?? '—' },
    { key: 'email', header: 'Email', render: (o) => o.email },
    {
      key: 'kind',
      header: 'Type',
      render: (o) => (
        <span className={`winners__override winners__override--${o.kind}`}>{OVERRIDE_LABEL[o.kind]}</span>
      ),
    },
    { key: 'reason', header: 'Reason', render: (o) => o.reason },
    {
      key: 'expires',
      header: 'Expires',
      className: 'num',
      render: (o) => (o.expires_at ? formatDate(o.expires_at) : 'Never'),
    },
    {
      key: 'actions',
      header: <span className="visually-hidden">Actions</span>,
      render: (o) => (
        <Button
          variant="link"
          aria-label={`Clear override for ${o.full_name ?? o.email}`}
          onClick={() => setClearing({ id: o.id, label: o.full_name ? `${o.full_name} (${o.email})` : o.email })}
        >
          Clear
        </Button>
      ),
    },
  ]

  const first = all[0]
  const lead = !first
    ? 'Standing and past winners, and eligibility overrides.'
    : first.window_enabled
      ? `Standing winners are excluded from new draws for ${first.window_months} months after they win.`
      : 'The current raffle has the Exclusion Window off, so no winner is excluded from it.'

  const addPast = (
    <Button variant="outline" onClick={() => setAdding(true)}>
      Add past winner
    </Button>
  )

  return (
    <>
      <PageHeader title="Winners" lead={lead} />

      <Panel
        accent="gold"
        title="Winner history"
        actions={
          all.length > 0 && (
            <>
              <label className="winners__toggle">
                <input type="checkbox" checked={showReplaced} onChange={(e) => setShowReplaced(e.target.checked)} />
                Include replaced
                {replacedCount > 0 && <span className="num">({replacedCount})</span>}
              </label>
              {addPast}
            </>
          )
        }
      >
        {winners.error && <InlineError>{friendlyError(winners.error.message)}</InlineError>}
        {winners.loading && !winners.data ? (
          <Loading />
        ) : (
          <DataTable
            caption="Winners, newest first"
            columns={winnerColumns}
            rows={rows}
            rowKey={(w) => w.id}
            rowClassName={(w) => (w.status === 'replaced' ? 'row--muted' : undefined)}
            empty={
              all.length === 0 ? (
                <EmptyState title="No winners yet" action={addPast}>
                  Winners appear here after a Draw. Add past winners so earlier giveaways count.
                </EmptyState>
              ) : (
                <EmptyState title="No standing winners">Every winner on record was replaced.</EmptyState>
              )
            }
          />
        )}
      </Panel>

      <Panel
        title="Eligibility overrides"
        actions={
          <Button variant="outline" onClick={() => setOverrideTarget('new')}>
            Add override
          </Button>
        }
      >
        <p className="panel__text winners__help">
          An override beats the Exclusion Window at every Draw: always eligible, or always excluded (also for
          people who never won).
        </p>
        {overrides.error && <InlineError>{friendlyError(overrides.error.message)}</InlineError>}
        {overrides.loading && !overrides.data ? (
          <Loading />
        ) : (
          <DataTable
            caption="Active eligibility overrides"
            columns={overrideColumns}
            rows={overrides.data ?? []}
            rowKey={(o) => o.id}
            empty={<p className="winners__none">No active overrides.</p>}
          />
        )}
      </Panel>

      <PastWinnerForm open={adding} onClose={() => setAdding(false)} onSaved={reloadAll} />
      <OverrideForm target={overrideTarget} onClose={() => setOverrideTarget(null)} onSaved={reloadAll} />

      <ConfirmDialog
        open={clearing !== null}
        title="Clear override"
        confirmLabel="Clear override"
        requireReason
        onCancel={() => setClearing(null)}
        onConfirm={(reason) =>
          run(
            () => clearOverride(clearing!.id, reason),
            () => setClearing(null),
          )
        }
      >
        Clear the override for <b>{clearing?.label}</b>? The Exclusion Window applies to them again.
      </ConfirmDialog>

      <ConfirmDialog
        open={deleting !== null}
        title="Delete past winner"
        confirmLabel="Delete"
        tone="danger"
        onCancel={() => setDeleting(null)}
        onConfirm={() =>
          run(
            () => deletePastWinner(deleting!.id),
            () => setDeleting(null),
          )
        }
      >
        Delete the past winner record for <b>{deleting?.full_name}</b> ({deleting?.email}), won{' '}
        {deleting && formatDate(deleting.won_at)}? It no longer counts toward the Exclusion Window. The deletion
        is kept in the activity log.
      </ConfirmDialog>
    </>
  )
}
