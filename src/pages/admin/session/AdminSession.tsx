import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  getSession,
  onSessionChange,
  signIn as apiSignIn,
  signOut as apiSignOut,
  type Session,
  type SignInResult,
} from '../../../lib/api'

export type SessionStatus = 'loading' | 'signedOut' | 'signedIn'

type AdminSessionValue = {
  status: SessionStatus
  /** The signed-in Auth user's email (the shared admin username). */
  email: string | null
  /** Message for the login card after an involuntary sign-out (e.g. not the admin). */
  notice: string | null
  signIn: (username: string, password: string) => Promise<SignInResult>
  signOut: () => Promise<void>
  /** Sign out and show `notice` on the login card. Used when the server says "not admin". */
  endSession: (notice: string) => Promise<void>
}

const AdminSessionContext = createContext<AdminSessionValue | null>(null)

/**
 * Owns the Supabase Auth session for the admin panel. The session persists (supabase-js
 * stores it in localStorage and refreshes it) until Sign out or until it can't be refreshed.
 */
export function AdminSessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  const [notice, setNotice] = useState<string | null>(null)
  // Sign-in is verifying the account is the admin: don't show the shell until it is.
  const verifying = useRef(false)

  useEffect(() => {
    let active = true
    getSession().then((s) => {
      if (active) setSession((current) => (current === undefined ? s : current))
    })
    const unsubscribe = onSessionChange((s) => {
      if (active && !(verifying.current && s)) setSession(s)
    })
    return () => {
      active = false
      unsubscribe()
    }
  }, [])

  const signIn = useCallback(async (username: string, password: string) => {
    verifying.current = true
    const result = await apiSignIn(username, password).finally(() => {
      verifying.current = false
    })
    if (result.ok) {
      setNotice(null)
      setSession(result.session)
    }
    return result
  }, [])

  const signOut = useCallback(async () => {
    await apiSignOut()
    setSession(null)
  }, [])

  const endSession = useCallback(
    async (message: string) => {
      setNotice(message)
      await signOut()
    },
    [signOut],
  )

  const value = useMemo<AdminSessionValue>(
    () => ({
      status: session === undefined ? 'loading' : session ? 'signedIn' : 'signedOut',
      email: session?.user.email ?? null,
      notice,
      signIn,
      signOut,
      endSession,
    }),
    [session, notice, signIn, signOut, endSession],
  )

  return <AdminSessionContext.Provider value={value}>{children}</AdminSessionContext.Provider>
}

export function useAdminSession(): AdminSessionValue {
  const value = useContext(AdminSessionContext)
  if (!value) throw new Error('useAdminSession must be used inside <AdminSessionProvider>')
  return value
}
