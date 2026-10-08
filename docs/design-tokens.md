# Company Raffle — design decision (issue #5)

Decided 2026-10-08 from the prototype on branch `prototype/visual-design`
(`prototype/variant-b-prototype.html`; published copy: https://claude.ai/artifact/HSjurkWD7QFRyhxS7MR7eQ).

## Direction: "Letterhead" (Variant B)

Light-first, square corners, hairline borders, the website's own grammar. Header is a
solid brand-blue bar with the white logo left and "Company Raffle" right. Admin has a
navy left sidebar (Dashboard / Entries / Winners / History) and a tinted content area.
No italics. Gold appears only for the winner moment and past-winner flags.

## Type

| Role | Font | Notes |
| --- | --- | --- |
| Headings, labels, buttons, table headers, tags | **PT Serif** 700 (Google Fonts) | Upright only. Kicker above titles is 15px uppercase, letter-spacing .04em. |
| Body | **Nimbus Sans** 300 (Adobe kit `sbh8dqi`), fallback Helvetica Neue / Arial | 16/26 body, 14/18 small, 12/18 captions. |
| Numbers (stat tiles, counts, dates, time left) | **Inter** (Google Fonts) | `font-variant-numeric: tabular-nums`. |

## Colour tokens

Light values are the design system's; dark values follow its Dark theme. Rows marked
*(new)* are raffle additions not yet in the company design system.

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `comfort-blue` | `#004685` | `#7cb4e8` | Interaction, section headings, active sidebar bar, stat "entries", panel top border |
| `on-brand` | `#ffffff` | `#0b1a2a` | Text on a comfort-blue fill |
| `header-bar` *(new)* | `#004685` | `#004685` | Top bar in both themes (white logo always) |
| `navy-900` *(new)* | `#0b1a2a` | `#0b1a2a` | Admin sidebar in both themes |
| `surface` | `#ffffff` | `#161515` | Page, panels |
| `surface-tint` | `#f9fafc` | `#1f1d1d` | Admin content area, stat tiles, notes |
| `surface-sunken` | `#f2f4f7` | `#121111` | Neutral tag fill |
| `ink` / `charcoal` / `ink-muted` | `#232121` / `#2d2a2a` / `#6c6a6a` | `#e8e6e6` / `#f2f0f0` / `#a8a5a5` | Body / headings / secondary text |
| `steel-line` | `rgba(21,84,140,.15)` | `rgba(143,179,214,.25)` | Hairlines, field borders |
| `steel-muted` | `#44759f` | `#8fb3d6` | Placeholders |
| `blue-wash` *(new)* | `rgba(0,70,133,.08)` | `rgba(124,180,232,.12)` | Table header row fill |
| `alert` | `#cc4b37` | `#f2836f` | Time left, duplicate flags (red), Close Early, Remove, stat "flags" |
| `alert-wash` *(new)* | `rgba(204,75,55,.10)` | `rgba(242,131,111,.14)` | Red-flagged row's first cell |
| `gold` *(new)* | `#f0b429` | `#f0b429` | Winner moment, past-winner flag, Draw Winner button, excluded stat (`#c98f12` in light for text) |
| `gold-ink` *(new)* | `#3a2a00` | `#3a2a00` | Text on a gold fill |
| `gold-wash` *(new)* | `rgba(240,180,41,.18)` | `rgba(240,180,41,.16)` | Winner panels, gold-flagged row's first cell |
| `green` *(new)* | `#2a7a4b` | `#6fcf97` | "Eligible" stat and status only |
| `green-wash` *(new)* | `rgba(42,122,75,.10)` | `rgba(111,207,151,.12)` | Eligible status pill |

## Components settled

- **Flags**: pill, 11px sans, inside the name cell; red for duplicate signals (same device, same name, email match), gold for a past winner in the Exclusion Window. The flagged row gets a 4px left bar and a wash on its first cell. Flags never block the Draw.
- **Status tags**: pill with a leading dot. Blue filled = Open; gold = Complete / Excluded; green = Eligible again.
- **Stat tiles**: 4px coloured left bar, 30px Inter number in the same colour, 12px label.
- **Buttons**: filled blue submit; blue outline secondary; red outline for Close Early; gold fill for Draw Winner (disabled until the Raffle is closed).
- **Public page**: time left in alert red bold. Winner note has a 4px gold top border and gold wash.
- **Theme**: follows `prefers-color-scheme`; admin can toggle. Header bar and sidebar do not change between themes.

## Rejected

- Variant A "Navy card" (dark gradient page, rounded translucent cards, pill tabs): too close to the old app's "AI look".
- Variant C "Hero sheet" (navy hero band with overlapping white sheet, underlined top nav).
- Italic serif accents from the website design system: dropped everywhere in this app.
