/**
 * Error model for every Supabase call the app makes.
 *
 * - `unreachable`: network failure or a gateway error (paused project). The admin shell
 *   shows the "Can't reach the database" banner with Retry.
 * - `unauthorized`: not the configured admin (`not_admin`, SQLSTATE 42501) or an
 *   expired/invalid session. The admin shell signs out and shows the login card.
 * - `app`: a business error raised by the database (e.g. `raffle_not_open`); `message`
 *   is the exception name from the migration, `code` the SQLSTATE. Show it inline.
 */
export type ApiErrorKind = 'unreachable' | 'unauthorized' | 'app'

export class ApiError extends Error {
  readonly kind: ApiErrorKind
  readonly code: string
  readonly status: number
  readonly details: string
  readonly hint: string

  constructor(
    kind: ApiErrorKind,
    message: string,
    opts: { code?: string; status?: number; details?: string; hint?: string } = {},
  ) {
    super(message)
    this.name = 'ApiError'
    this.kind = kind
    this.code = opts.code ?? ''
    this.status = opts.status ?? 0
    this.details = opts.details ?? ''
    this.hint = opts.hint ?? ''
  }
}

export function isApiError(e: unknown): e is ApiError {
  return e instanceof ApiError
}

/** The shape every supabase-js query/rpc resolves to (we only read these fields). */
export type SupabaseResult<T> = {
  data: T | null
  error: { message: string; code?: string; details?: string | null; hint?: string | null } | null
  status: number
}

const UNAUTHORIZED_CODES = new Set(['42501', 'PGRST301', 'PGRST302', 'PGRST303'])

export function classify(status: number, code: string): ApiErrorKind {
  if (UNAUTHORIZED_CODES.has(code) || status === 401) return 'unauthorized'
  if (status === 0) return 'unreachable'
  // 5xx without a SQLSTATE is the gateway / PostgREST itself (paused or restarting project).
  // A SQLSTATE (5 alphanumerics, e.g. 55000) on a 5xx is a business error raised in SQL.
  if (status >= 500 && (code === '' || code.startsWith('PGRST'))) return 'unreachable'
  return 'app'
}

/** Return `data` or throw an {@link ApiError}. Wrap every supabase call with this. */
export function unwrap<T>(result: SupabaseResult<T>): T {
  const { data, error, status } = result
  if (!error) return data as T
  const code = error.code ?? ''
  throw new ApiError(classify(status, code), error.message, {
    code,
    status,
    details: error.details ?? '',
    hint: error.hint ?? '',
  })
}
