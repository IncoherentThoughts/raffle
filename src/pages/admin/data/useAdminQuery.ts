import { useCallback, useEffect, useRef, useState, type DependencyList } from 'react'
import { ApiError, isApiError } from '../../../lib/api'
import { useAdminSession } from '../session/AdminSession'
import { useDatabaseStatus } from './DatabaseStatus'

export const NOT_ADMIN_NOTICE = 'Signed out: this account is not the raffle admin.'

/**
 * Route an error from the data layer to the right place:
 * - `unreachable` -> the database banner (returns undefined)
 * - `unauthorized` -> sign out with a notice on the login card (returns undefined)
 * - `app` (a business error) or anything unexpected -> returned for inline display.
 *
 *   const handleError = useApiErrorHandler()
 *   try { await rpc('draw', { p_raffle_id }) } catch (e) { setError(handleError(e)) }
 */
export function useApiErrorHandler(): (e: unknown) => ApiError | undefined {
  const { reportUnreachable } = useDatabaseStatus()
  const { endSession } = useAdminSession()
  return useCallback(
    (e: unknown) => {
      if (isApiError(e) && e.kind === 'unreachable') {
        reportUnreachable()
        return undefined
      }
      if (isApiError(e) && e.kind === 'unauthorized') {
        void endSession(NOT_ADMIN_NOTICE)
        return undefined
      }
      if (isApiError(e)) return e
      return new ApiError('app', e instanceof Error ? e.message : String(e))
    },
    [reportUnreachable, endSession],
  )
}

export type AdminQuery<T> = {
  data: T | undefined
  /** A business error to show inline. Unreachable/unauthorized are handled by the shell. */
  error: ApiError | undefined
  loading: boolean
  /** Re-run the loader (e.g. after a mutation). */
  reload: () => void
}

/**
 * Load data for an admin screen. Re-runs when `deps` change, on `reload()`, and when the
 * banner's Retry is pressed.
 *
 *   const { data, error, loading, reload } = useAdminQuery(() => listEntries(raffleId), [raffleId])
 */
export function useAdminQuery<T>(load: () => Promise<T>, deps: DependencyList): AdminQuery<T> {
  const { retryToken } = useDatabaseStatus()
  const handleError = useApiErrorHandler()
  const [state, setState] = useState<{ data?: T; error?: ApiError; loading: boolean }>({
    loading: true,
  })
  const [reloadToken, setReloadToken] = useState(0)
  const loadRef = useRef(load)
  useEffect(() => {
    loadRef.current = load
  })

  useEffect(() => {
    let active = true
    setState((s) => ({ ...s, loading: true }))
    loadRef.current().then(
      (data) => active && setState({ data, loading: false }),
      (e) => active && setState((s) => ({ data: s.data, error: handleError(e), loading: false })),
    )
    return () => {
      active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- caller-supplied deps
  }, [...deps, retryToken, reloadToken, handleError])

  const reload = useCallback(() => setReloadToken((t) => t + 1), [])
  return { data: state.data, error: state.error, loading: state.loading, reload }
}
