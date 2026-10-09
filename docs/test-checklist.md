# Launch test checklist

Hands-on pass over the deployed app before real use. Work top to bottom; it takes about an hour.

- Public page: https://incoherentthoughts.github.io/raffle/
- Admin: https://incoherentthoughts.github.io/raffle/admin
- Use a phone for the public sections and a laptop for admin. Keep a second browser (or a private window) handy to act as "another employee".

## 0. Setup

- [ ] Each admin account exists in Supabase (Authentication → Users) and is in `private.admins` (README → Database).
- [ ] Sign in with each admin account in turn → both land on the Dashboard and see the same data.
- [ ] `.env.local` at the repo root holds `VITE_SUPABASE_URL=https://nduesytuadtrmorddsmn.supabase.co` and `VITE_SUPABASE_PUBLISHABLE_KEY=<the publishable key from the repo variables>`.
- [ ] Seed artificial data (asks for the admin email + password):
  ```bash
  node --env-file=.env.local scripts/seed-test-data.mjs
  ```
  It creates, all titled `[TEST] …`:
  - Past winners **Jordan Pastwinner** (3 mo ago) and **Casey Oldwin** (14 mo ago).
  - Overrides: Jordan = Always eligible, **Morgan Banned** = Always excluded.
  - **Raffle A** "Predators vs. Stars": Drawn, 2 winners, slot 1 Redrawn ("Winner declined the tickets").
  - **Raffle B** "Sounds Opening Day": Cancelled ("Game was rescheduled").
  - **Raffle C** "Parking Spot for a Month": Drawn, 3 slots, 1 vacant.
  - **Raffle D** "Titans vs. Colts": **Open**, closes in 2 days, 20 entries with every duplicate-flag case.
- [ ] When you're done testing, wipe everything (section 12).

## 1. Login and shell

- [ ] `/admin` signed out shows the login card (username + password).
- [ ] Wrong password → inline error, no crash.
- [ ] Correct login → lands on Dashboard.
- [ ] Reload the page → still signed in.
- [ ] Sidebar: Dashboard / Entries / Winners / History switch, URL changes, browser Back works.
- [ ] With no toggle used, the site follows the device's light/dark setting, and switches live when you change it.
- [ ] Theme toggle switches light/dark, survives a reload, and still applies on the public page after Sign out.
- [ ] Toggle back to match the device → the site follows the device again.
- [ ] Narrow the window below 900px → sidebar becomes a top bar; utility menu behind a button works.
- [ ] At phone width (~375px) all four tabs fit beside the menu button with no horizontal scrollbar.
- [ ] Open `/admin/winners` directly while signed out → after login you land on Winners.
- [ ] Sign out → back to login card; `/admin/dashboard` now asks for login.
- [ ] Header: logo top-left, "Company Raffle" top-right, on both public and admin pages.

## 2. Public page: Open raffle (phone)

- [ ] Shows Raffle D's title, prize, details, close time with time zone, live countdown.
- [ ] Notice line: "We store a random ID in your browser to help spot duplicate entries."
- [ ] Submit blank name / bad email → inline validation, nothing sent.
- [ ] Enter as a new person (e.g. `test.one@thecomfortgroup.com`) → "You're entered".
- [ ] Reload, enter the same email in different case / with spaces → "Already entered".
- [ ] Same person from the second browser → still "Already entered".
- [ ] Enter a **personal** email (gmail) → accepted (no domain restriction).
- [ ] Looks right at phone width, in light and dark (phone setting).

## 3. Dashboard: Open state

- [ ] Status tag Open, title/prize, countdown.
- [ ] Six tiles. Expected roughly: Entries ≈ 20 + what you added in §2; **Excluded** includes Morgan Banned and Raffle A's two standing winners; **Flags** > 0; **Returning** counts people who entered A/B/C.
- [ ] Draw button disabled with "enabled once entries close".
- [ ] **Edit**: change prize → saved; public page shows it after reload.
- [ ] Edit Winner Count to 0 → refused. Back to 2.

## 4. Entries tab (Raffle D)

- [ ] Caption says Status is a live preview (before the Draw).
- [ ] Flag pills: **same name** on both Avery Thompsons; **email match** on Paula Reyes / P Reyes (`+raffle`, dot, other domain); **same device** on Nora / Owen Quinn.
- [ ] Status: Morgan Banned = Excluded (override); Jordan Pastwinner = Eligible (override beats the window); Raffle A's standing winners = Excluded (won …); Avery Thompson (A's *replaced* winner) = Eligible.
- [ ] "Quincy Added" shows "added by admin".
- [ ] Search by part of a name and of an email.
- [ ] Filter chips All / Flagged / Removed / Excluded, counts make sense.
- [ ] **Dismiss** the same-device flag (reason required) → pill gone; Flagged filter shows a faint "dismissed" marker; Dashboard Flags tile drops.
- [ ] **Remove** an entry (reason required) → greyed; Removed filter shows it; Dashboard Entries/Eligible update. If it was half of a flagged pair, the other pill turns grey "pair removed".
- [ ] **Restore** it → back to normal.
- [ ] **Add entry** with a new email → appears, "added by admin".
- [ ] Add entry with an existing email → "already entered". With a removed person's email → offers "Restore instead?".
- [ ] **Export CSV** with a filter on → file opens in Excel; only filtered rows; columns name, email, entered_at, status, flags, removed_at, removed_reason, device_id; accented names display correctly.

## 5. Winners tab

- [ ] Standing winners newest first: Raffle A's two, Raffle C's two, Jordan, Casey.
- [ ] Status: Raffle A/C winners and Jordan = Excluded N mo; Casey = Eligible again.
- [ ] Override column: Jordan = Always eligible (reason on hover).
- [ ] "Include replaced" shows A's replaced winner with the Redraw reason on hover.
- [ ] **Add past winner** (name, email, date ~2 months ago, note) → appears, Excluded.
- [ ] **Delete** only offered on past winners; delete the one you just added.
- [ ] **Set override** on a winner (reason) → column updates; **clear** it (reason).
- [ ] Overrides section: Morgan Banned listed; **Add override** by email for someone who never won.

## 6. Close and Draw (Raffle D)

- [ ] **Close early** → Dashboard "Entries closed"; Draw button (gold) enabled.
- [ ] Public page now says entries are closed / drawing soon; the form is gone.
- [ ] Try entering from the public page in an old open tab → refused gracefully.
- [ ] **Reopen**: Edit, set Close Time in the future → dialog warns it reopens → Save → Open again. Close early again.
- [ ] **Draw** confirm text: "Draw 2 winners from E eligible entries? …" and mentions undismissed flags.
- [ ] Draw → gold winner panel with 2 winners; neither is Morgan Banned or a standing Raffle A winner.
- [ ] Public page: "Congratulations to [Name] and [Name] …".
- [ ] Entries tab caption now says Snapshot verdict; Add/Remove are gone for this Drawn raffle.

## 7. Redraw

- [ ] Redraw a winner without a reason → blocked. With a reason → new winner in that slot; Redraw count + reason shown.
- [ ] Public page shows the new name, not the old one.
- [ ] Winners tab: old winner is Replaced (with "Include replaced") and is Eligible again in the next raffle.

## 8. Vacant slots and Cancel

- [ ] Start a new raffle, Winner Count 3, enter only 2 people from the public page, Close early.
- [ ] Draw confirm says only 2 eligible for 3 slots → Draw → "Slot 3: vacant (no eligible alternates)"; public page lists only 2 names.
- [ ] Start another raffle, **Cancel** without reason → blocked; with reason → Dashboard back to "Start a new raffle"; public page "Nothing to enter yet".
- [ ] Only one raffle can be open: with one open, the create form isn't offered.

## 9. History

- [ ] Rows for A, B, C, D and the ones from §8, with dates, counts, winners, vacant count, Redraws.
- [ ] Entries column adds up: Raffle D reads like "22 (15 / 5), 2 removed" (removed entries are not counted as excluded).
- [ ] Raffle B (cancelled before its Close Time) shows Closed on the day it was cancelled, not the later Close Time.
- [ ] Raffle A detail: winners with the Redraw chain + reason; Draw Snapshot with per-entry verdicts and frozen flags; its Activity Log; "View entries" opens its entries read-only (no Add/Remove).
- [ ] Raffle D detail: Excluded and Removed tiles are separate and add up with Eligible to Entries.
- [ ] Raffle B detail shows the cancel reason.
- [ ] Raffle C detail shows the vacant slot and why.
- [ ] Activity log page lists every action you took today with readable sentences and reasons; "Show older" works.

## 10. Settings: Export all data

- [ ] Settings → Export all data downloads `raffle-export-YYYY-MM-DD.zip`.
- [ ] Zip has raffles, entries, winners, draw_snapshots, draw_snapshot_entries, eligibility_overrides, flag_dismissals, activity_log CSVs, each opening in Excel.

## 11. Safety and resilience

- [ ] In a private window (not signed in), open the browser console on the public page and run:
  `await fetch('https://nduesytuadtrmorddsmn.supabase.co/rest/v1/entries?select=*', {headers:{apikey:'<publishable key>'}}).then(r=>r.status)` → `401` (entries are not readable).
- [ ] Turn off Wi-Fi on the admin page and click around → "Can't reach the database" banner with Retry; turn Wi-Fi on, Retry clears it.
- [ ] Public page with Wi-Fi off → "Can't reach the raffle" + Try again.
- [ ] GitHub → Actions: Keepalive runs daily and is green; the `keepalive` branch's latest commit is from today.

## 12. Clean up before launch

- [ ] Download a final **Export all data** if you want a record of the test run.
- [ ] Supabase → SQL editor: paste and run `scripts/reset-test-data.sql`. Wipes every Raffle, Entry, Winner, Override, Snapshot and the Activity Log; keeps the admin login.
- [ ] Public page shows "Nothing to enter yet"; admin Dashboard shows "Start a new raffle"; History and Winners are empty.
- [ ] Add real past winners from the old app via Winners → Add past winner, so the Exclusion Window applies from day one.
