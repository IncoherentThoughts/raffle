import type { DayCount } from './stats'
import { formatDay, plural } from './format'

/** Small daily bar chart "Entries over time", Opened through Close Time. CSS bars, token colours. */
export function EntriesChart({ daily }: { daily: DayCount[] }) {
  const max = Math.max(1, ...daily.map((d) => d.count))
  const total = daily.reduce((s, d) => s + d.count, 0)
  const peak = daily.reduce((a, d) => (d.count > a.count ? d : a), daily[0])
  const summary =
    total === 0
      ? `No entries yet across ${plural(daily.length, 'day', 'days')}.`
      : `${plural(total, 'entry', 'entries')} over ${plural(daily.length, 'day', 'days')}; busiest ${formatDay(peak.day)} with ${peak.count}.`
  return (
    <figure className="dash-chart">
      <figcaption className="dash-chart__title">Entries over time</figcaption>
      <div className="dash-chart__plot" role="img" aria-label={summary}>
        <span className="dash-chart__max num" aria-hidden="true">
          {max}
        </span>
        <div className="dash-chart__bars">
          {daily.map((d) => (
            <div key={d.day} className="dash-chart__col" title={`${formatDay(d.day)}: ${plural(d.count, 'entry', 'entries')}`}>
              <div className="dash-chart__bar" style={{ height: `${(d.count / max) * 100}%` }} />
            </div>
          ))}
        </div>
      </div>
      <div className="dash-chart__axis num" aria-hidden="true">
        <span>{formatDay(daily[0].day)}</span>
        {daily.length > 1 && <span>{formatDay(daily[daily.length - 1].day)}</span>}
      </div>
    </figure>
  )
}
