/**
 * CHART COLOUR — one source of truth for every recharts surface in the app.
 *
 * Every value here is a `var(--…)` string rather than a hex. Recharts writes
 * them straight into SVG presentation attributes (`fill`, `stroke`), which are
 * parsed as CSS values, so a custom property resolves at paint time and the
 * whole chart follows both theme axes — light/dark AND the palette — with no
 * React state, no re-render, and no `useTheme()` anywhere near a chart.
 *
 * This replaces ~370 raw hexes across the reporting pages. Those were
 * light-mode-only values: the grid `#E2E8F0` and the tooltip cursor `#F1F5F9`
 * were already invisible on the dark theme long before a second palette
 * existed.
 *
 * ── Which set to use ──────────────────────────────────────────────────────
 *
 *   SERIES     when the line/bar means something — collected, pending, absent.
 *              This is almost every chart in a school ERP, and it is the
 *              reason the categorical ramp below is used so rarely. Colour
 *              carries the same meaning it does everywhere else in the app.
 *
 *   CATEGORICAL  only when slices are identities with no status and no order
 *              (a pie of fee heads). Assigned in FIXED ORDER by index, never
 *              cycled — past the fifth, everything is `other`. The order was
 *              chosen so adjacent slices stay separable under deuteranopia and
 *              protanopia; do not reorder it to make a chart look nicer.
 */

/* ── Chart chrome ───────────────────────────────────────────────────────── */

/** Grid lines. Recessive by design — the data is the thing being read. */
export const CHART_GRID = 'var(--line)';

/** Axis ticks and labels. Text always wears an ink token, never a series colour. */
export const CHART_TICK = { fill: 'var(--ink-muted)', fontSize: 11 } as const;

/** The band that follows the pointer behind a bar. */
export const CHART_CURSOR = { fill: 'var(--surface-inset)' } as const;

/** The hover card. An HTML node, so it takes the app's real surface tokens. */
export const CHART_TOOLTIP = {
    contentStyle: {
        background: 'var(--surface)',
        border: '1px solid var(--line)',
        borderRadius: '8px',
        boxShadow: 'var(--shadow-raised)',
        color: 'var(--ink)',
        fontSize: '12.5px',
    },
    labelStyle: { color: 'var(--ink)', fontWeight: 600 },
    itemStyle: { color: 'var(--ink-soft)' },
} as const;

/* ── Series colour by meaning ───────────────────────────────────────────── */

export const SERIES = {
    /** The headline measure of a single-series chart. */
    brand: 'var(--brand)',
    /** Collected, paid, present, approved. */
    settled: 'var(--accent-success)',
    /** Pending, due, awaiting action. */
    attention: 'var(--accent-warn)',
    /** Overdue, absent, waived-off, rejected. */
    correction: 'var(--accent-danger)',
    /** Neutral context behind a rate — coverage, headcount, capacity. */
    context: 'var(--accent-info)',
    /** Anything the AI platform produced. */
    ai: 'var(--accent-ai)',
} as const;

/** A pale fill for the context series when it sits behind a foreground line. */
export const SERIES_CONTEXT_SOFT = 'var(--accent-info-edge)';

/* ── Categorical ────────────────────────────────────────────────────────── */

const CATEGORICAL = [
    'var(--chart-1)',
    'var(--chart-2)',
    'var(--chart-3)',
    'var(--chart-4)',
    'var(--chart-5)',
] as const;

export const CATEGORICAL_OTHER = 'var(--chart-other)';

/**
 * The colour for slice `index`. Past the fifth it returns the achromatic
 * "other" rather than wrapping — a sixth identity that reuses the first hue is
 * a chart that lies about which two things are the same.
 */
export function categorical(index: number): string {
    return CATEGORICAL[index] ?? CATEGORICAL_OTHER;
}

/** How many slices get their own hue before everything folds into "Other". */
export const CATEGORICAL_LIMIT = CATEGORICAL.length;
