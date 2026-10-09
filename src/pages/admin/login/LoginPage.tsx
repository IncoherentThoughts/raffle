import { useState, type FormEvent } from 'react'
import { HeaderBar } from '../../../components/HeaderBar'
import { useAdminSession } from '../session/AdminSession'
import { Button, InlineError, TextField } from '../ui'
import { UNREACHABLE_MESSAGE } from '../shell/DatabaseBanner'

const MESSAGES = {
  invalid: 'Wrong username or password.',
  rate_limited: 'Too many sign-in attempts. Wait a few minutes and try again.',
  unreachable: UNREACHABLE_MESSAGE,
} as const

/** Login card at /admin (and at any /admin/* path while signed out). */
export function LoginPage() {
  const { signIn, notice } = useAdminSession()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const result = await signIn(username, password)
    // On success the session provider swaps this page for the shell; nothing else to do.
    if (!result.ok) {
      setError(MESSAGES[result.reason])
      setBusy(false)
    }
  }

  return (
    <>
      <HeaderBar />
      <main className="login">
        <form className="login__card" onSubmit={submit} noValidate>
          <p className="kicker">Company Raffle</p>
          <h1>Admin sign in</h1>
          {notice && !error && <p className="login__notice">{notice}</p>}
          <TextField
            label="Username"
            name="username"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
          <TextField
            label="Password"
            name="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {error && <InlineError>{error}</InlineError>}
          <Button type="submit" disabled={busy || !username || !password}>
            Sign in
          </Button>
        </form>
      </main>
    </>
  )
}
