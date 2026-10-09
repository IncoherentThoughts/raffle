/**
 * Best-effort same-device signal (issue #3): a random UUID per browser, kept in
 * localStorage and mirrored in a first-party cookie. Read either, write both, so
 * clearing one store alone does not reset the ID. No fingerprinting.
 */
export const DEVICE_ID_KEY = 'raffle_device_id'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MAX_AGE_SECONDS = 400 * 24 * 60 * 60 // browsers cap cookie lifetime at 400 days

function valid(value: string | null | undefined): string | null {
  return value && UUID.test(value) ? value.toLowerCase() : null
}

function readStorage(): string | null {
  try {
    return valid(localStorage.getItem(DEVICE_ID_KEY))
  } catch {
    return null
  }
}

function readCookie(): string | null {
  try {
    const pair = document.cookie.split('; ').find((c) => c.startsWith(`${DEVICE_ID_KEY}=`))
    return valid(pair?.slice(DEVICE_ID_KEY.length + 1))
  } catch {
    return null
  }
}

function write(id: string) {
  try {
    localStorage.setItem(DEVICE_ID_KEY, id)
  } catch {
    // storage blocked (private mode, policy): the cookie may still work
  }
  try {
    const secure = location.protocol === 'https:' ? '; Secure' : ''
    document.cookie = `${DEVICE_ID_KEY}=${id}; max-age=${MAX_AGE_SECONDS}; path=/; SameSite=Lax${secure}`
  } catch {
    // cookies blocked
  }
}

function randomUuid(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  // randomUUID needs a secure context; fall back to getRandomValues (RFC 4122 v4).
  const b = crypto.getRandomValues(new Uint8Array(16))
  b[6] = (b[6] & 0x0f) | 0x40
  b[8] = (b[8] & 0x3f) | 0x80
  const h = Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}

/** This browser's device ID, creating and persisting one if needed. */
export function getDeviceId(): string {
  const id = readStorage() ?? readCookie() ?? randomUuid()
  write(id)
  return id
}
