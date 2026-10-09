/**
 * In-memory stand-in for `src/lib/supabase` in unit tests.
 *
 *   vi.mock('../../lib/supabase', () => import('../../test/fakeSupabase'))
 *   import { fake } from '../../test/fakeSupabase'
 *   beforeEach(() => fake.reset())
 *
 *   fake.signedIn()                                   // start with a persisted admin session
 *   fake.onRpc('admin_entries', () => fake.ok([...])) // canned RPC result
 *   fake.onRpc('keepalive', () => fake.unreachable()) // network failure
 *   fake.onRpc('draw', () => fake.dbError('raffle_not_closed', '55000'))
 *   fake.onTable('raffles', () => fake.ok([...]))     // any `from('raffles')...` chain resolves to this
 *
 * Unhandled RPCs and tables resolve to `{ data: null, error: null, status: 200 }`.
 */
import type { Session } from '@supabase/supabase-js'
import { vi } from 'vitest'

type Result = { data: unknown; error: unknown; status: number }
type Handler = (args?: unknown) => Result | Promise<Result>
type AuthListener = (event: string, session: Session | null) => void

export const ADMIN_EMAIL = 'admin@example.test'
export const ADMIN_PASSWORD = 'correct horse'

function makeSession(email = ADMIN_EMAIL): Session {
  return {
    access_token: 'test-access-token',
    refresh_token: 'test-refresh-token',
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: {
      id: '00000000-0000-0000-0000-000000000001',
      email,
      aud: 'authenticated',
      app_metadata: {},
      user_metadata: {},
      created_at: new Date(0).toISOString(),
    },
  } as Session
}

function createFake() {
  let session: Session | null = null
  const listeners = new Set<AuthListener>()
  let rpcHandlers = new Map<string, Handler>()
  let tableHandlers = new Map<string, Handler>()
  let signInHandler: Handler | null = null

  const emit = (event: string) => listeners.forEach((l) => l(event, session))

  /** A thenable query builder: every method returns itself; awaiting resolves the table handler. */
  const builder = (table: string): unknown => {
    const run = () => Promise.resolve((tableHandlers.get(table) ?? (() => ok(null)))())
    const proxy: unknown = new Proxy(
      {},
      {
        get(_t, prop) {
          if (prop === 'then') return (res: never, rej: never) => run().then(res, rej)
          return () => proxy
        },
      },
    )
    return proxy
  }

  const supabase = {
    auth: {
      getSession: vi.fn(async () => ({ data: { session }, error: null })),
      signInWithPassword: vi.fn(async ({ email, password }: { email: string; password: string }) => {
        if (signInHandler) return signInHandler({ email, password })
        if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
          session = makeSession(email)
          emit('SIGNED_IN')
          return { data: { session, user: session.user }, error: null }
        }
        return {
          data: { session: null, user: null },
          error: { name: 'AuthApiError', message: 'Invalid login credentials', status: 400, code: 'invalid_credentials' },
        }
      }),
      signOut: vi.fn(async () => {
        session = null
        emit('SIGNED_OUT')
        return { error: null }
      }),
      onAuthStateChange: vi.fn((cb: AuthListener) => {
        listeners.add(cb)
        return { data: { subscription: { unsubscribe: () => listeners.delete(cb) } } }
      }),
    },
    rpc: vi.fn(async (fn: string, args?: unknown) => (rpcHandlers.get(fn) ?? (() => ok(null)))(args)),
    from: vi.fn((table: string) => builder(table)),
  }

  function ok(data: unknown): Result {
    return { data, error: null, status: 200 }
  }

  return {
    supabase,
    ok,
    /** fetch() rejected: what supabase-js returns when the project is paused or offline. */
    unreachable(): Result {
      return { data: null, error: { message: 'TypeError: Failed to fetch', code: '', details: '', hint: '' }, status: 0 }
    },
    /** An exception raised in SQL, e.g. dbError('not_admin', '42501'). */
    dbError(message: string, code: string, status = code === '42501' ? 403 : 400): Result {
      return { data: null, error: { message, code, details: '', hint: '' }, status }
    },
    onRpc(fn: string, handler: Handler) {
      rpcHandlers.set(fn, handler)
    },
    onTable(table: string, handler: Handler) {
      tableHandlers.set(table, handler)
    },
    /** Override signInWithPassword (e.g. to simulate a 429 or a network error). */
    onSignIn(handler: Handler) {
      signInHandler = handler
    },
    /** Start the test with a persisted admin session. */
    signedIn(email = ADMIN_EMAIL) {
      session = makeSession(email)
    },
    /** The session ends outside the app (expiry, another tab signing out). */
    expireSession() {
      session = null
      emit('SIGNED_OUT')
    },
    reset() {
      session = null
      listeners.clear()
      rpcHandlers = new Map()
      tableHandlers = new Map()
      signInHandler = null
      Object.values(supabase.auth).forEach((f) => f.mockClear())
      supabase.rpc.mockClear()
      supabase.from.mockClear()
    },
  }
}

export const fake = createFake()

/** The mocked module's export, so `vi.mock('.../lib/supabase', () => import('.../test/fakeSupabase'))` works. */
export const supabase = fake.supabase
