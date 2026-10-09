# Admin panel (`/admin`)

Shell from #12. Each tab is filled in by its own issue; this file is the contract between them.

## Layout

```
src/pages/admin/
  AdminApp.tsx          route table + providers (shared: don't edit for tab work)
  admin.css             shell + primitive styles, scoped under .admin
  session/              AdminSessionProvider, useAdminSession()
  data/                 DatabaseStatusProvider, useAdminQuery(), useApiErrorHandler()
  shell/                AdminLayout, Sidebar, DatabaseBanner, useTheme
  login/                LoginPage
  ui/                   shared primitives (import from '../ui')
  dashboard/  #13       DashboardTab.tsx  -> /admin/dashboard/*
  entries/    #14       EntriesTab.tsx    -> /admin/entries/*
  winners/    #15       WinnersTab.tsx    -> /admin/winners/*
  history/    #16       HistoryTab.tsx    -> /admin/history/*
  settings/             SettingsTab.tsx   -> /admin/settings ("Export all data", not built yet)
src/lib/api/            data-access layer (typed wrappers around supabase)
src/lib/database.types.ts   generated: npm run gen:types (local stack running)
src/test/fakeSupabase.ts    fake supabase client for unit tests
```

## Working on a tab

- **Stay in your folder.** Replace the placeholder `<Name>Tab` component (keep the export name)
  and add any files you need next to it: sub-components, `*.test.tsx`, a `<tab>.css`
  (import it from your component, scope every rule under `.admin`).
- **Sub-pages** (History's raffle detail and activity log, Entries for another raffle): the
  route is already `/admin/<tab>/*`, so put a `<Routes>` inside your tab with relative paths,
  e.g. `<Route path=":raffleId" element={<RaffleDetail />} />`. Link with absolute paths
  (`/admin/history/${id}`). No change to `AdminApp.tsx` needed.
- **Page frame:** start with `<PageHeader title="Entries" lead="..." />` (the h1), then `Panel`s.
- **Shared files** (`AdminApp.tsx`, `admin.css`, `ui/`, `shell/`, `session/`, `data/`,
  `src/lib/api/{errors,rpc,auth,health,index}.ts`): avoid editing. If a primitive is missing,
  build it inside your folder first; promote it to `ui/` only if it's a small additive change.

## Data access

- Components never import `supabase`. Put calls in **`src/lib/api/<area>.ts`**, one file per tab
  to avoid conflicts: `dashboard.ts` (#13: raffles, stats, draw, redraw), `entries.ts` (#14),
  `winners.ts` (#15: winners, overrides), `history.ts` (#16). Import from another tab's file
  freely, but don't edit it; add a function to your own file instead.
- Call RPCs with the typed **`rpc()`**, which throws `ApiError` on failure:
  ```ts
  // src/lib/api/entries.ts
  import { supabase } from '../supabase'
  import { unwrap } from './errors'
  import { rpc, type Row } from './rpc'

  export const listEntries = (raffleId: string) => rpc('admin_entries', { p_raffle_id: raffleId })
  export async function currentRaffle(): Promise<Row<'raffles'> | null> {
    return unwrap(await supabase.from('raffles').select('*').order('created_at', { ascending: false }).limit(1).maybeSingle())
  }
  ```
  For table reads, wrap the builder result in **`unwrap()`** (same error handling).
- `ApiError.kind`:
  - `unreachable` (network failure, paused project) -> the shell shows the
    "Can't reach the database" banner with Retry.
  - `unauthorized` (`not_admin` 42501, expired JWT) -> the shell signs out and the login card
    says "this account is not the raffle admin".
  - `app` -> a business error; `message` is the exception name from the migration
    (`raffle_not_open`, `already_entered`, `reason_required`, ...), `code` the SQLSTATE,
    `details`/`hint` as raised. Map it to friendly copy in your tab and show it inline.

## Loading and errors in components

```tsx
const { data, error, loading, reload } = useAdminQuery(() => listEntries(raffleId), [raffleId])
```

`useAdminQuery` re-runs on deps change, `reload()`, and the banner's Retry. It routes
`unreachable`/`unauthorized` to the shell and returns only `app` errors in `error`.

For mutations, use `useApiErrorHandler()`:

```tsx
const handleError = useApiErrorHandler()
try { await removeEntry(id, reason); reload() }
catch (e) { const err = handleError(e); if (err) throw new Error(friendly(err)) }
```

Inside `ConfirmDialog.onConfirm`, throwing an `Error` shows its message inline and keeps the
dialog open; resolving lets you close it.

## UI primitives (`../ui`)

| Component | Use |
| --- | --- |
| `Button variant` | `primary` (filled blue submit), `outline`, `danger` (Close early, Remove, Cancel), `gold` (Draw only), `link` / `link-danger` (row actions) |
| `ConfirmDialog` | Every confirmation from #6. `requireReason` enforces >= 3 trimmed chars (`MIN_REASON_LENGTH`) and passes the trimmed reason to `onConfirm(reason)` |
| `Modal` | Forms in a dialog (Edit raffle: `wide`) |
| `TextField` | Labelled input/textarea: `label`, `hint` ("(optional)"), `description`, `error`, `multiline` |
| `DataTable` | `columns` / `rows` / `rowKey` / `caption` / `empty`; scrolls horizontally on narrow screens. Row classes `row--red`, `row--gold`, `row--muted`; cell classes `name`, `num` |
| `StatGrid` + `StatTile tone` | `blue` entries, `green` eligible, `gold` excluded, `red` flags |
| `Tag tone` | Status pill with dot: `blue` Open, `gold` Drawn/Excluded, `green` Eligible, `red` Cancelled/Removed, `neutral` |
| `Flag tone` | Name-cell pill: `red` duplicate signal, `gold` past winner |
| `Panel accent` | White box with top border (`gold` for winner panels); `title`, `actions` |
| `PageHeader` | h1 + lead + actions |
| `EmptyState`, `Loading`, `InlineError` | Empty tables, first load, inline failures (`role="alert"`) |

Numbers and dates: add `className="num"` (Inter, tabular). Colours only via `var(--token)`
(`src/styles/tokens.css`); gold is for the winner moment and past-winner flags only.

## Tests

Mock the client with the shared fake and drive the UI through Testing Library:

```tsx
vi.mock('../../../lib/supabase', () => import('../../../test/fakeSupabase'))
import { fake } from '../../../test/fakeSupabase'
beforeEach(() => fake.reset())

fake.onRpc('admin_entries', () => fake.ok([{ id: 'e1', full_name: 'Jim Lee', ... }]))
fake.onRpc('remove_entry', () => fake.dbError('entry_already_removed', '55000'))
fake.onTable('raffles', () => fake.ok([...]))
fake.onRpc('keepalive', () => fake.unreachable())
```

To test a tab as the admin sees it, mount the whole panel at its route with the shared helper
(it calls `fake.signedIn()` unless told otherwise; `currentPath()` reads the router location):

```tsx
import { renderAdmin, currentPath } from '../test/renderAdmin'
renderAdmin('/admin/entries')
expect(await screen.findByRole('heading', { name: 'Entries', level: 1 })).toBeInTheDocument()
```
