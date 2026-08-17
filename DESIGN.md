# Register & Ink — the design system

The visual language of `sms-frontend`. Read this before adding UI; the rules
here are what keep 200-odd files looking like one product.

## The idea

A school day is **recorded**, not browsed. The system takes its materials from
what the software replaced: the walnut cover of the register, the brass on the
school bell, the ruled paper inside, the ink it was filled in with.

`sms-hub-frontend` is the sibling app — "Slate & Chalk", an all-dark chalkboard
control plane. This one is its daylight counterpart. They should read as
siblings, never twins.

**A warm rail against a cool-neutral canvas is the core move.** That temperature
contrast is why this doesn't look like every other ERP. Resist warming the canvas
to match the walnut, and resist cooling the walnut to match the canvas — the two
are meant to disagree.

The dark half is never the whole screen. It is the navigation rail holding the
frame while paper carries the work.

## Pigments — each with exactly one job

Colour is never decorative. Status **is** the palette, so a screen can be read at
a glance from across a desk.

| Pigment | Token | Job |
|---|---|---|
| **Brass** | `--brand` | The brand, and the primary action. **Always a solid button.** |
| **Marigold** | `--accent`, `--accent-warn` | "Act on this" — dues, pending approvals, warnings, the active-nav marker. **Always a pale chip or a 3px marker, never a solid button.** |
| **Sage** | `--accent-success` | Present, paid, approved, active — settled things. |
| **Vermilion** | `--accent-danger` | Absent, overdue, rejected, destructive — the margin correction. |
| **Lapis** | `--accent-info` | Informational only: links, "on leave", online payment, focus rings. |
| **Iris** | `--accent-ai` | The AI platform, matching the hub's convention. |

Brass and marigold share a hue. What keeps them distinct is the **form rule
above**, not the colour: a solid brass button next to a pale marigold chip is
unmistakable. Break that rule and the two collapse into each other.

Never use colour alone. A status is a dot **plus** a word, so it survives
colour-blindness, greyscale printing, and a projector.

## Tokens, not raw colours

Components reference **semantic** tokens — `--brand`, `--surface`, `--ink`,
`--line`, `--accent-*` — never raw pigment steps and never raw Tailwind colours.
That is what lets both themes stay consistent and a token change repaint the
whole system.

There is a **legacy bridge** at the bottom of `globals.css` that re-points old
raw utilities (`bg-white`, `text-slate-700`, `bg-blue-50`) at these tokens, so
pages written before the system still render correctly in both themes. It is
scaffolding, not architecture: **new code must not rely on it.**

`@theme static` is required, not stylistic. Tailwind only emits theme variables
it sees used in a utility, and the component classes in `globals.css` reference
them through plain `var()` — which the scanner does not count.

## Type — three faces, three jobs

| Role | Face | Used for |
|---|---|---|
| Display | **Sora** 600 | Page titles, stat figures, panel headings |
| UI | **Figtree** | Everything you read: labels, body, table cells, help text |
| Data | **IBM Plex Mono**, tabular | Every number, ID, date, amount, and micro-label |

Numbers getting their own face is **functional, not decorative**: a fee ledger
lives or dies on whether ₹ columns align.

`h1`–`h5` pick up Sora automatically from the base layer. The mono micro-label is
the `.eyebrow` class. Any number in a cell gets `.tabular`, or use `<Money>` /
`<Num>`.

The font variables must live on `<html>`, not `<body>`: `--font-sans` is declared
at `:root` in terms of them, and a `var()` that cannot resolve **where it is
declared** computes to invalid and then inherits as empty — which silently kills
every font in the app.

## Signatures

Two, and only two:

1. **The ledger tab** (`.ledger-tab`, via `<PageHeader section="…">`). Every page
   opens as a page *in a file*; the tab names the section it sits inside. It
   carries information — it is not a badge, and it belongs only in page headers.
2. **The storm border** (`<BorderBeam/>`). Two brass arcs at different speeds over
   a blurred, flickering bloom. Reserved for **exactly one element per screen** —
   the sign-in card, or the panel you just acted on. It is how the app says "this
   is the live thing", and it stops meaning that the moment two of them run.

Plus one structural echo: the **register's margin rule** (`.ruled-row`), a
hairline down the left of every table row — lapis on hover, marigold when the row
wants attention.

## The component kernel

Compose these. Do not restyle them per page, and do not hand-roll their
equivalents — that is exactly the duplication this replaced.

| Component | For |
|---|---|
| `DataTable` | Every list of records. Sorting, sticky header, margin rule, mobile card fallback, loading/empty/error states. |
| `PageHeader` / `PageShell` / `PageBody` | Page chrome: ledger tab, title, description, actions, tabs. |
| `StatTile` / `StatGrid` | Single figures with a pigment rail. |
| `StatusChip` / `StatusCount` | Any domain status. Resolves through `pigment.ts`. |
| `Money` / `Num` | Any amount or number. en-IN grouping, tabular figures. |
| `Field` / `Input` / `Select` / `Textarea` / `Checkbox` / `FieldGrid` / `Fieldset` | Forms. Labels always visible. |
| `FilterBar` / `SearchInput` / `FilterField` / `SegmentedControl` / `PageTabs` / `Pagination` | Filtering and paging. |
| `Panel` / `PanelHeader` / `PanelBody` / `Note` / `Detail` / `DetailGrid` | Content containers and read-only detail. |
| `EmptyState` / `ErrorState` | Nothing here, or something broke. |
| `Button` / `IconButton` | Actions. `variant="primary"` for the one next step. |

`pigment.ts` is the single place a domain word becomes a colour. Adding a status
means one line there, not a colour ladder in a page.

`components/Table.tsx` is a **deprecated adapter** over `DataTable`, kept so
older pages restyle without being rewritten. New code uses `DataTable` directly.

## Writing

Words are design material. Name things by what people control, not how the system
is built. Active voice; a control says what happens when it is used ("Record
payment", not "Submit") and keeps that name through the whole flow. Sentence case.

Errors don't apologise and are never vague: say what went wrong and how to get
past it. An empty screen is an invitation to act — name what would be here and
give the one action that creates it.

## The quality floor

Not negotiable, and not worth announcing in the UI:

- **Responsive** at 375 / 768 / 1024 / 1440+. This is an installable PWA used on
  phones, tablets, laptops and large desktops.
- **Touch targets** 44px with their surrounding gap; controls bottom out at 36px.
- **Focus** is always visible — one ring, defined once in the base layer.
- **`prefers-reduced-motion`** kills the storm border and every transition.
- **Safe-area insets** on the rail, the top bar and the bottom tab bar.
- **No emoji as icons.** Use lucide. One exception: the parent portal's Quick
  Access chips are solid white glyphs on vivid gradient squircles, and lucide is
  stroke-only — those twelve glyphs are Material Symbols (Rounded, filled),
  vendored as path data in `parent-dashboard/student/[id]/sectionStyle.ts`.
  That file is the only place they may be used; everything else is lucide.
- **Motion** 150–320ms. One page-load sequence (`.stagger`): header, then tiles,
  then rows. Anything longer reads as lag in software people use for eight hours.

## Themes — two axes

The theme has **two independent axes**, and they must stay independent. Folding
them into one list is the obvious simplification and it is wrong: it would make
"I want the blue one" and "I want the dark one" mutually exclusive.

| Axis | Attribute | Values | Owner |
|---|---|---|---|
| **Appearance** | `data-theme` | `light` · `dark` (+ `system`) | next-themes |
| **Palette** | `data-palette` | `ink` · `assembly` | `PaletteProvider` |

Four combinations. Both are stamped on `<html>` before first paint by the inline
script in `layout.tsx`; `ThemePicker` in the top bar switches either one.

**Register & Ink** (`ink`, the default) is the system described above: walnut
rail, brass brand, warm paper. The rail is walnut in both appearances — that
constancy is the design; on dark it sinks *below* the canvas instead of rising
above it, so the seam still reads.

**Assembly** (`assembly`) is white ground and flag pigments, taken from the
AppMe Soft mark. Its one structural difference is that **the rail is light** — a
pale blue wash. Every pigment keeps its job; only the hue filling it changes:

| Job | Register & Ink | Assembly |
|---|---|---|
| Brand / primary action (always solid) | Brass | Royal blue |
| "Act on this" (chip or 3px mark, never a button) | Marigold | Saffron |
| Settled — present, paid, approved | Sage | Flag green |
| Correction — absent, overdue, destructive | Vermilion | Vermilion |
| Informational — links, on leave, focus ring | Lapis | Cyan |
| AI platform | Iris | **Iris — unchanged**, it matches the hub |

The old `teal` theme is retired.

### Adding a palette

1. One `[data-palette='<id>']` block in `globals.css`, plus its
   `[data-palette='<id>'][data-theme='dark']` pair. **Redeclare the complete
   token set** — a block written as a diff leaves stray tokens inheriting the
   default palette's colour.
2. One entry in `src/lib/palettes.ts` (name, hint, status-bar colour, and the
   preview swatch the picker paints its miniature from).

That is the whole procedure, and it is why two things below are load-bearing.

**Why the ramps are redeclared, not renamed.** `@theme static` is not `inline`,
so Tailwind emits `.bg-brass-500 { background-color: var(--color-brass-500) }`.
Redeclaring that variable under a palette selector therefore repaints ~250 raw
ramp utilities across 122 files without touching a line of TSX. Ramp *names*
stay (`brass`, `walnut`, `marigold`) — they name the material's role in this
codebase, not a literal colour. Read "brass" as "the brand ramp".

**Why the ordering matters.** The palette blocks are unlayered, so they outrank
Tailwind's layered `theme` output, and they sit *after* `[data-theme='dark']`:
`[data-palette]` and `[data-theme]` have equal specificity, so source order
breaks the tie. The combined selector is more specific and wins over both.

**Rail states are tokens.** `--rail-hover`, `--rail-selected`,
`--rail-active-ink`, `--rail-scrim`, `--rail-danger*` and `--tile-*` exist
because the rail components used to paint themselves with literal `text-white`
and `bg-white/8`, which silently assumes a dark ground. Never reintroduce one.

### Charts

`src/lib/chartTokens.ts` is the only place a chart gets a colour. Every value is
a `var(--…)` string, which recharts writes into SVG presentation attributes, so
charts follow both axes with no React state.

Colour by meaning first — `SERIES.settled`, `.attention`, `.correction` — which
covers nearly every chart here, because a school ERP plots statuses. The
`categorical()` ramp (`--chart-1`…`--chart-5`) is only for slices that are
identities with no status, is assigned in fixed order, and folds into an
achromatic "other" past the fifth rather than cycling.

Those five steps are **validated, not chosen by eye**: each palette × appearance
was checked against the lightness band, chroma floor, adjacent-pair separation
under deuteranopia/protanopia, and contrast on that theme's own surface. Re-run
that check before changing any `--chart-*` value — the order in particular is
what keeps adjacent slices apart, so do not reorder them to suit one chart.
