import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'

type DatabaseStatusValue = {
  /** True after any call failed with an `unreachable` ApiError, until Retry. */
  unreachable: boolean
  /** Bumped by Retry; every `useAdminQuery` re-runs when it changes. */
  retryToken: number
  reportUnreachable: () => void
  retry: () => void
}

const DatabaseStatusContext = createContext<DatabaseStatusValue | null>(null)

/** Drives the "Can't reach the database" banner. */
export function DatabaseStatusProvider({ children }: { children: ReactNode }) {
  const [unreachable, setUnreachable] = useState(false)
  const [retryToken, setRetryToken] = useState(0)

  const reportUnreachable = useCallback(() => setUnreachable(true), [])
  const retry = useCallback(() => {
    setUnreachable(false)
    setRetryToken((t) => t + 1)
  }, [])

  const value = useMemo(
    () => ({ unreachable, retryToken, reportUnreachable, retry }),
    [unreachable, retryToken, reportUnreachable, retry],
  )
  return <DatabaseStatusContext.Provider value={value}>{children}</DatabaseStatusContext.Provider>
}

export function useDatabaseStatus(): DatabaseStatusValue {
  const value = useContext(DatabaseStatusContext)
  if (!value) throw new Error('useDatabaseStatus must be used inside <DatabaseStatusProvider>')
  return value
}
