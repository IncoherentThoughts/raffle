# raffle

Simple app for doing titans ticket raffles at TCG. Static React SPA (Vite + TypeScript) on GitHub Pages, backed by Supabase. See `GLOSSARY.md` for domain terms and `docs/design-tokens.md` for the visual design.

Live site: https://incoherentthoughts.github.io/raffle/ (public page at `/`, admin at `/admin`).

## Development

```sh
npm install
cp .env.example .env.local   # then fill in values
npm run dev                  # http://localhost:5173/raffle/
```

| Script | What it does |
| --- | --- |
| `npm run dev` | Vite dev server |
| `npm run build` | Typecheck, production build into `dist/`, and copy `index.html` to `404.html` |
| `npm test` | Vitest (jsdom + Testing Library) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |

### Environment variables

| Variable | Value |
| --- | --- |
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase **publishable** key. Never a secret or service-role key: everything in `VITE_*` ships to the browser |

For local development, point these at a local stack: `supabase start`, then `supabase status` prints the URL (default `http://127.0.0.1:54321`) and key. Real values are never committed; `.env*` is git-ignored except `.env.example`.

## Layout

- `src/pages/` route-level pages (`PublicPage`, `AdminPage`)
- `src/components/` shared components
- `src/lib/supabase.ts` the Supabase client: `import { supabase } from '../lib/supabase'`
- `src/styles/tokens.css` design tokens as CSS variables (light + dark); `global.css` base styles. Use `var(--token)`, never raw hex
- Tests sit next to the code as `*.test.ts(x)`; shared setup in `src/test/setup.ts`
- `src/App.tsx` route table. Vite `base` is `/raffle/` and the router basename is derived from it in `src/main.tsx`

## Deploy

`.github/workflows/deploy.yml` runs on every push to `main` (and manually via `workflow_dispatch`): `npm ci`, typecheck, test, build, then publishes `dist/` with `actions/deploy-pages`. Settings it relies on:

- Repo Pages source set to **GitHub Actions**.
- Repository **variables** (Settings > Secrets and variables > Actions > Variables) `SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY`, injected as the `VITE_*` vars at build time.
- Client-side routes such as `/raffle/admin` work on refresh because the build copies `index.html` to `404.html`, which Pages serves for unknown paths.

`.github/workflows/ci.yml` runs typecheck, lint, test and build on pull requests (with placeholder Supabase values).

No custom domain is configured. If one is added, change `base` in `vite.config.ts` to `/` and add a `CNAME` file under `public/`.

## Database (Supabase)

Schema, RLS and the Draw/Redraw functions live in `supabase/migrations/`; pgTAP
tests in `supabase/tests/`. Vocabulary follows `GLOSSARY.md`.

### Local development

```sh
npx supabase start        # Docker must be running
npx supabase db reset     # re-apply all migrations
npx supabase test db      # run the pgTAP tests
npx supabase stop
```

To sign in to the admin panel locally, create a user in the local Auth
(local Studio or the Auth admin API) and register it as the admin with the SQL
below.

### Applying to the hosted project (owner only)

1. Link and push the migrations (asks for the database password from the
   Supabase dashboard; nothing is stored in the repo):
   ```sh
   npx supabase link --project-ref nduesytuadtrmorddsmn
   npx supabase db push
   ```
   (Or paste each file in `supabase/migrations/` into the SQL editor, in order.)
2. Dashboard > Authentication > Users > Add user: the shared admin user (your
   company email + the shared admin password, auto-confirm). Keep "Allow new
   users to sign up" off.
3. Register that user as the admin, in the SQL editor:
   ```sql
   insert into private.app_config (admin_user_id)
   select id from auth.users where email = '<admin email>'
   on conflict (id) do update set admin_user_id = excluded.admin_user_id, updated_at = now();
   ```
   Until this row exists nobody is an admin: every admin RPC returns `not_admin`.

### Runbook

- **Rotate the admin password** (when an admin leaves): Dashboard > Authentication >
  Users > the admin user > change password. The UUID does not change, so nothing
  else needs updating.
- **Replace the admin user** (e.g. a shared mailbox): create the new user, re-run
  the `private.app_config` statement above with the new email, then delete the old user.
- **Rate limit**: PostgREST runs `private.check_request()` before every request and
  refuses (HTTP 429) the 501st write within 5 minutes from one IP. Change the limit
  in that function; switch it off with
  `alter role authenticator reset pgrst.db_pre_request; notify pgrst, 'reload config';`
- **Export all data monthly**: sign in to `/admin` > Settings > Export all data and
  keep the zip somewhere safe. There is no scheduled backup.
- **Paused project**: the free tier pauses a project after a stretch of inactivity;
  if it ever pauses, click Resume in the Supabase dashboard within 90 days or the
  data is lost.
- **Keepalive**: `.github/workflows/keepalive.yml` runs daily, calls the
  `keepalive()` RPC (uses the repo variables `SUPABASE_URL` and
  `SUPABASE_PUBLISHABLE_KEY`) and commits a timestamp to the orphan `keepalive`
  branch. That commit keeps GitHub from disabling the schedule after 60 days of
  repo inactivity; it never touches `main`, so it does not trigger a deploy. A
  failed run emails the repo owner: check the run log, and re-run it from the
  Actions tab (workflow_dispatch) once fixed.
