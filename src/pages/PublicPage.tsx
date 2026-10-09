import { useCallback, useEffect, useId, useState, type FormEvent, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { HeaderBar } from '../components/HeaderBar'
import { getDeviceId } from '../lib/deviceId'
import {
  fetchPublicRaffle,
  submitEntry,
  validateEntry,
  type EntryOutcome,
  type PublicRaffle,
} from '../lib/publicRaffle'
import { formatTimeLeft } from '../lib/timeLeft'
import './PublicPage.css'

/** How often an open page re-reads the Raffle, so a Draw or a new Raffle shows up. */
const REFRESH_MS = 60_000

const DEVICE_NOTICE = 'We store a random ID in your browser to help spot duplicate entries.'

type Load = { kind: 'loading' } | { kind: 'unreachable' } | { kind: 'ready'; raffle: PublicRaffle }

/** What happened to this browser's Entry for a given Raffle. */
type Entered = { raffleId: string; kind: 'entered' | 'already'; email: string }

export function PublicPage() {
  const [load, setLoad] = useState<Load>({ kind: 'loading' })
  const [entered, setEntered] = useState<Entered | null>(null)

  const refresh = useCallback(async (opts: { quiet: boolean }) => {
    try {
      const raffle = await fetchPublicRaffle()
      setLoad({ kind: 'ready', raffle })
      return raffle
    } catch {
      // A failed background refresh keeps what is on screen.
      if (!opts.quiet) setLoad({ kind: 'unreachable' })
      return null
    }
  }, [])

  useEffect(() => {
    let alive = true
    const tick = () => {
      if (alive && document.visibilityState !== 'hidden') void refresh({ quiet: true })
    }
    void refresh({ quiet: false })
    const timer = setInterval(tick, REFRESH_MS)
    document.addEventListener('visibilitychange', tick)
    return () => {
      alive = false
      clearInterval(timer)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [refresh])

  let body: ReactNode
  if (load.kind === 'loading') {
    body = <Loading />
  } else if (load.kind === 'unreachable') {
    body = (
      <Unreachable
        onRetry={() => {
          setLoad({ kind: 'loading' })
          void refresh({ quiet: false })
        }}
      />
    )
  } else {
    body = (
      <RaffleView
        raffle={load.raffle}
        entered={entered?.raffleId === load.raffle.raffleId ? entered : null}
        onEntered={setEntered}
        onRaffleChanged={() => refresh({ quiet: true })}
      />
    )
  }

  return (
    <div className="public">
      <HeaderBar />
      <main className="page-narrow public__main">{body}</main>
      <footer className="public__foot">
        <span>© {new Date().getFullYear()} The Comfort Group · Automated Controls</span>
        <Link to="/admin">Admin</Link>
      </footer>
    </div>
  )
}

function Loading() {
  return (
    <div className="public__loading" aria-busy="true" aria-label="Loading the raffle">
      <span className="skeleton skeleton--kicker" />
      <span className="skeleton skeleton--title" />
      <span className="skeleton skeleton--line" />
      <span className="skeleton skeleton--line skeleton--short" />
    </div>
  )
}

function Unreachable({ onRetry }: { onRetry: () => void }) {
  return (
    <>
      <p className="kicker">Company Raffle</p>
      <h1>Can’t reach the raffle</h1>
      <div className="rule" />
      <p>We couldn’t load the raffle just now. Check your connection, then try again.</p>
      <button type="button" className="btn btn--outline" onClick={onRetry}>
        Try again
      </button>
    </>
  )
}

function useNow(active: boolean) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!active) return
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [active])
  return now
}

const CLOSE_FORMAT = new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  timeZoneName: 'short',
})

function formatClose(date: Date | null) {
  return date ? CLOSE_FORMAT.format(date) : ''
}

function joinNames(names: string[]) {
  if (names.length <= 1) return names.join('')
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

function RaffleView({
  raffle,
  entered,
  onEntered,
  onRaffleChanged,
}: {
  raffle: PublicRaffle
  entered: Entered | null
  onEntered: (e: Entered) => void
  onRaffleChanged: () => Promise<PublicRaffle | null>
}) {
  const now = useNow(raffle.status === 'open')

  if (raffle.status === 'none' || !raffle.raffleId) {
    return (
      <>
        <p className="kicker">Company Raffle</p>
        <h1>Nothing to enter yet</h1>
        <div className="rule" />
        <p>There’s no raffle open right now. We’ll post the next one here, so check back soon.</p>
      </>
    )
  }

  const closeTime = raffle.closeTime
  const closesIn = closeTime ? closeTime.getTime() - now : 0
  // The countdown reaching zero closes the Raffle on screen without waiting for the server.
  const status = raffle.status === 'open' && closesIn <= 0 ? 'closed' : raffle.status

  if (status === 'drawn') {
    const names = joinNames(raffle.winnerNames)
    return (
      <>
        <p className="kicker">Results</p>
        <h1>{raffle.title}</h1>
        <div className="rule" />
        <section className="note note--win" aria-labelledby="win-heading">
          <TrophyIcon />
          <h2 id="win-heading">
            {names ? (
              <>
                Congratulations to <span className="note__name">{names}</span>
              </>
            ) : (
              'The draw is done'
            )}
          </h2>
          <p>Thanks to everyone who entered. Check back soon for a new raffle.</p>
        </section>
      </>
    )
  }

  if (status === 'closed') {
    return (
      <>
        <p className="kicker">Entries closed</p>
        <h1>{raffle.title}</h1>
        <div className="rule" />
        <section className="note" aria-labelledby="closed-heading">
          <h2 id="closed-heading">Drawing soon</h2>
          <p>
            Entries closed{closeTime ? ` ${formatClose(closeTime)}` : ''}. The winner will be posted here once the
            draw is done.
          </p>
        </section>
      </>
    )
  }

  return (
    <>
      <p className="kicker">Now open</p>
      <h1>{raffle.title}</h1>
      <div className="rule" />
      <dl className="meta">
        {raffle.prize && (
          <div>
            <dt>Prize</dt>
            <dd>{raffle.prize}</dd>
          </div>
        )}
        <div>
          <dt>Entries close</dt>
          <dd className="num">{formatClose(closeTime)}</dd>
        </div>
        <div>
          <dt>Time left</dt>
          <dd className="meta__left num">{formatTimeLeft(closesIn)}</dd>
        </div>
      </dl>
      {raffle.details && <p className="public__details">{raffle.details}</p>}
      {entered ? (
        <EnteredNote entered={entered} closeText={formatClose(closeTime)} />
      ) : (
        <EntryForm raffleId={raffle.raffleId} onEntered={onEntered} onRaffleChanged={onRaffleChanged} />
      )}
    </>
  )
}

function EnteredNote({ entered, closeText }: { entered: Entered; closeText: string }) {
  if (entered.kind === 'already') {
    return (
      <section className="note" role="status" aria-labelledby="entered-heading">
        <h2 id="entered-heading">Already entered</h2>
        <p>
          We already have an entry for <b>{entered.email}</b>. It’s one entry per person, so you’re all set. Good
          luck!
        </p>
      </section>
    )
  }
  return (
    <section className="note note--ok" role="status" aria-labelledby="entered-heading">
      <h2 id="entered-heading">You’re entered</h2>
      <p>
        We’ve recorded your entry. The draw happens after entries close{closeText ? ` on ${closeText}` : ''}, and the
        winner is posted right here. Good luck!
      </p>
    </section>
  )
}

const OUTCOME_MESSAGE: Record<Exclude<EntryOutcome, 'entered' | 'already_entered'>, string> = {
  invalid: 'Please enter your full name and a valid email address.',
  rate_limited: 'Too many entries from your network right now. Please wait a few minutes and try again.',
  unreachable: 'We couldn’t reach the raffle. Check your connection and try again.',
  not_open: 'This raffle isn’t taking entries right now.',
}

function EntryForm({
  raffleId,
  onEntered,
  onRaffleChanged,
}: {
  raffleId: string
  onEntered: (e: Entered) => void
  onRaffleChanged: () => Promise<PublicRaffle | null>
}) {
  const id = useId()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (busy) return
    const invalid = validateEntry(fullName, email)
    if (invalid) {
      setError(invalid)
      return
    }
    setError(null)
    setBusy(true)
    const entry = { raffleId, fullName: fullName.trim(), email: email.trim(), deviceId: getDeviceId() }
    const outcome = await submitEntry(entry)
    if (outcome === 'entered' || outcome === 'already_entered') {
      onEntered({ raffleId, kind: outcome === 'entered' ? 'entered' : 'already', email: entry.email })
      return
    }
    if (outcome === 'not_open') {
      // Usually the Close Time just passed: re-read so the page shows the real state.
      const fresh = await onRaffleChanged()
      if (!fresh || (fresh.status === 'open' && fresh.raffleId === raffleId)) setError(OUTCOME_MESSAGE.not_open)
      setBusy(false)
      return
    }
    setError(OUTCOME_MESSAGE[outcome])
    setBusy(false)
  }

  return (
    <form className="entry-form" onSubmit={onSubmit} noValidate aria-busy={busy}>
      <label htmlFor={`${id}-name`}>Full Name</label>
      <input
        id={`${id}-name`}
        className="field"
        name="name"
        autoComplete="name"
        maxLength={200}
        required
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        placeholder="First and last name"
        value={fullName}
        onChange={(e) => setFullName(e.target.value)}
      />
      <label htmlFor={`${id}-email`}>Work Email</label>
      <input
        id={`${id}-email`}
        className="field"
        name="email"
        type="email"
        inputMode="email"
        autoComplete="email"
        autoCapitalize="none"
        spellCheck={false}
        maxLength={254}
        required
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        placeholder="you@thecomfortgroup.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      {error && (
        <p id={`${id}-error`} className="entry-form__error" role="alert">
          {error}
        </p>
      )}
      <button type="submit" className="btn entry-form__submit" disabled={busy}>
        Enter Raffle
      </button>
      <p className="entry-form__notice">{DEVICE_NOTICE}</p>
    </form>
  )
}

function TrophyIcon() {
  return (
    <svg
      className="note__cup"
      width="30"
      height="30"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4z" />
      <path d="M7 6H4v2a3 3 0 0 0 3 3M17 6h3v2a3 3 0 0 1-3 3" />
    </svg>
  )
}
