import type { Session } from '@supabase/supabase-js'
import { supabase } from '../supabase'
import { isApiError } from './errors'
import { rpc } from './rpc'

export type { Session }

export type SignInResult =
  | { ok: true; session: Session }
  | { ok: false; reason: 'invalid' | 'rate_limited' | 'unreachable' | 'not_admin' }

class ApiErrorNotAdmin extends Error {}

/**
 * Sign in as an admin Auth user. The "username" on the login card is that user's email (#9).
 * Supabase Auth's per-IP rate limit is the only lockout.
 */
export async function signIn(username: string, password: string): Promise<SignInResult> {
  let result
  try {
    result = await supabase.auth.signInWithPassword({ email: username.trim(), password })
  } catch {
    return { ok: false, reason: 'unreachable' }
  }
  const { data, error } = result
  if (!error && data.session) {
    // Valid credentials for a non-admin account: end that session right away (#17).
    try {
      if (!(await rpc('am_i_admin'))) throw new ApiErrorNotAdmin()
    } catch (e) {
      await signOut()
      if (e instanceof ApiErrorNotAdmin || (isApiError(e) && e.kind === 'unauthorized')) {
        return { ok: false, reason: 'not_admin' }
      }
      return { ok: false, reason: 'unreachable' }
    }
    return { ok: true, session: data.session }
  }
  const status = (error as { status?: number } | null)?.status ?? 0
  if (status === 429) return { ok: false, reason: 'rate_limited' }
  if (status === 0 || status >= 500) return { ok: false, reason: 'unreachable' }
  return { ok: false, reason: 'invalid' }
}

/**
 * Sign out this browser only. An admin account may be signed in on several devices (or
 * shared), so a global sign-out would end those sessions too. supabase-js clears the local
 * session even when the request fails.
 */
export async function signOut(): Promise<void> {
  try {
    await supabase.auth.signOut({ scope: 'local' })
  } catch {
    // The local session is removed regardless.
  }
}

/** The persisted session, if any (read from storage, no network). */
export async function getSession(): Promise<Session | null> {
  const { data } = await supabase.auth.getSession()
  return data.session
}

/** Subscribe to sign-in / sign-out / token refresh. Returns an unsubscribe function. */
export function onSessionChange(cb: (session: Session | null) => void): () => void {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => cb(session))
  return () => data.subscription.unsubscribe()
}
