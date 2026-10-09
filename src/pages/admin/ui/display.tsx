import type { ReactNode } from 'react'

/** Page title (h1) + muted lead line, top of every tab. */
export function PageHeader({ title, lead, actions }: { title: string; lead?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="page-header">
      <div>
        <h1>{title}</h1>
        {lead && <p className="lead">{lead}</p>}
      </div>
      {actions && <div className="page-header__actions">{actions}</div>}
    </header>
  )
}

/** White box with a 3px top border: blue by default, gold for winner panels. */
export function Panel({
  title,
  accent = 'blue',
  actions,
  children,
  className,
}: {
  title?: ReactNode
  accent?: 'blue' | 'gold'
  actions?: ReactNode
  children?: ReactNode
  className?: string
}) {
  return (
    <section className={`panel panel--${accent}${className ? ` ${className}` : ''}`}>
      {(title || actions) && (
        <div className="panel__head">
          {title && <h2>{title}</h2>}
          {actions && <div className="panel__actions">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  )
}

export type Tone = 'neutral' | 'blue' | 'gold' | 'green' | 'red'

/**
 * Status tag (pill with an optional leading dot). Blue filled = Open; gold = Drawn/Excluded;
 * green = Eligible; red = Cancelled/Removed; neutral = anything else.
 */
export function Tag({ tone = 'neutral', dot = true, children }: { tone?: Tone; dot?: boolean; children: ReactNode }) {
  return <span className={`tag tag--${tone}${dot ? ' tag--dot' : ''}`}>{children}</span>
}

/** Small pill inside a name cell: red = duplicate signal, gold = past winner in the Window. */
export function Flag({ tone, children, title }: { tone: 'red' | 'gold'; children: ReactNode; title?: string }) {
  return (
    <span className={`flag flag--${tone}`} title={title}>
      {children}
    </span>
  )
}

/** Stat tile: 4px coloured left bar, big Inter number, small label. */
export function StatTile({ value, label, tone = 'blue' }: { value: ReactNode; label: string; tone?: Exclude<Tone, 'neutral'> }) {
  return (
    <div className={`stat stat--${tone}`}>
      <b className="num">{value}</b>
      <span>{label}</span>
    </div>
  )
}

/** Responsive grid of StatTiles (4 across, 2 below 900px). */
export function StatGrid({ children }: { children: ReactNode }) {
  return <div className="stats">{children}</div>
}

/** Centered message for an empty table or tab, with an optional call to action. */
export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty-state">
      <h2>{title}</h2>
      {children && <p>{children}</p>}
      {action && <div className="empty-state__action">{action}</div>}
    </div>
  )
}

/** "Loading..." line for a tab or panel while its first query runs. */
export function Loading({ label = 'Loading…' }: { label?: string }) {
  return (
    <p className="loading" role="status">
      {label}
    </p>
  )
}
