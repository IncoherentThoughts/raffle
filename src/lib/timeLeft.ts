function unit(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`
}

/** Countdown text for the public page: the two largest units, rounded down. */
export function formatTimeLeft(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const days = Math.floor(total / 86400)
  const hrs = Math.floor((total % 86400) / 3600)
  const min = Math.floor((total % 3600) / 60)
  const sec = total % 60
  if (days > 0) return `${unit(days, 'day', 'days')} ${unit(hrs, 'hr', 'hrs')}`
  if (hrs > 0) return `${unit(hrs, 'hr', 'hrs')} ${min} min`
  if (min > 0) return `${min} min ${sec} sec`
  return `${sec} sec`
}
