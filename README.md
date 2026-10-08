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
