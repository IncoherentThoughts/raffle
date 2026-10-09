import { Route, Routes } from 'react-router-dom'
import { ActivityLogPage } from './ActivityLogPage'
import './history.css'
import { HistoryList } from './HistoryList'
import { RaffleDetailPage } from './RaffleDetailPage'

/**
 * History tab, routed at /admin/history/*:
 *   /admin/history            completed Raffles (chart + table)
 *   /admin/history/activity   the full Activity Log
 *   /admin/history/:raffleId  one Raffle's detail
 */
export function HistoryTab() {
  return (
    <Routes>
      <Route index element={<HistoryList />} />
      <Route path="activity" element={<ActivityLogPage />} />
      <Route path=":raffleId" element={<RaffleDetailPage />} />
    </Routes>
  )
}
