import { useState } from 'react'
import { dashboardRaffles, raffleStatus } from '../../../lib/api/dashboard'
import { useAdminQuery } from '../data/useAdminQuery'
import { InlineError, Loading, PageHeader } from '../ui'
import { CurrentRaffle } from './CurrentRaffle'
import './dashboard.css'
import { friendlyError } from './format'
import { NewRaffleForm } from './RaffleDialogs'
import { WinnerPanel } from './WinnerPanel'

/**
 * Dashboard (#13, spec #6): one view per state of the latest Raffle.
 * - No Raffle (none yet, or the latest is Cancelled): "Start a new raffle", then the last Drawn Raffle's winners.
 * - Open / Closed: the current Raffle with stats, Edit / Close early / Cancel and Draw.
 * - Drawn: the gold winner panel with Redraw, then "Start a new raffle".
 */
export function DashboardTab() {
  const [version, setVersion] = useState(0)
  const raffles = useAdminQuery(dashboardRaffles, [version])
  const refresh = () => setVersion((v) => v + 1)

  const latest = raffles.data?.latest ?? null
  const lastDrawn = raffles.data?.lastDrawn ?? null
  const status = latest ? raffleStatus(latest) : null

  return (
    <div className="dashboard">
      <PageHeader title="Dashboard" lead="What's open now, who won last, and start the next one." />
      {raffles.error && <InlineError>{friendlyError(raffles.error)}</InlineError>}
      {!raffles.data && raffles.loading && <Loading />}
      {raffles.data &&
        (latest && (status === 'open' || status === 'closed') ? (
          <CurrentRaffle key={latest.id} raffle={latest} version={version} onChanged={refresh} />
        ) : latest && status === 'drawn' ? (
          <>
            <WinnerPanel raffle={latest} title="Winners" version={version} />
            <NewRaffleForm onCreated={refresh} />
          </>
        ) : (
          <>
            <NewRaffleForm onCreated={refresh} />
            {lastDrawn && <WinnerPanel raffle={lastDrawn} title="Last raffle's winners" version={version} />}
          </>
        ))}
    </div>
  )
}
