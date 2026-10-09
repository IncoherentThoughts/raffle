// Stroke icons from the Letterhead prototype (origin/prototype/visual-design).
const common = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  'aria-hidden': true,
} as const

export const DashboardIcon = () => (
  <svg {...common}>
    <rect x="3" y="3" width="8" height="8" />
    <rect x="13" y="3" width="8" height="5" />
    <rect x="13" y="12" width="8" height="9" />
    <rect x="3" y="15" width="8" height="6" />
  </svg>
)

export const EntriesIcon = () => (
  <svg {...common}>
    <path d="M4 6h16M4 12h16M4 18h10" />
  </svg>
)

export const WinnersIcon = () => (
  <svg {...common} strokeLinecap="round" strokeLinejoin="round">
    <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4z" />
    <path d="M7 6H4v2a3 3 0 0 0 3 3M17 6h3v2a3 3 0 0 1-3 3" />
  </svg>
)

export const HistoryIcon = () => (
  <svg {...common}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </svg>
)

export const MenuIcon = () => (
  <svg {...common}>
    <path d="M4 7h16M4 12h16M4 17h16" />
  </svg>
)
