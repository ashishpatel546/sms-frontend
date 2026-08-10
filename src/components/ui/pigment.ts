/**
 * THE PIGMENT MAP — the single place a domain word becomes a colour.
 *
 * Four pigments, four fixed jobs (see the header of globals.css):
 *   info     lapis      navigation, informational, in-progress
 *   success  sage       present, paid, approved, active — settled things
 *   attn     marigold   "act on this" — dues, pending approvals, warnings
 *   danger   vermilion  absent, overdue, rejected, failed
 *   neutral  ink        drafts, archived, not-applicable
 *   ai       iris       the AI platform, matching the hub's convention
 *
 * Every status badge in the app resolves through `pigmentFor()`, so a school's
 * fee status, a leave request, a payroll run and a library loan all speak the
 * same visual language — and changing what "partial" looks like is a one-line
 * edit here rather than a sweep through forty pages.
 */

export type Pigment =
  | 'info'
  | 'success'
  | 'attn'
  | 'danger'
  | 'neutral'
  | 'ai';

/** Tailwind classes per pigment, for chips and tinted panels. */
export const PIGMENT_CLASS: Record<
  Pigment,
  { chip: string; dot: string; text: string; tint: string; rail: string }
> = {
  info: {
    chip: 'bg-accent-info-tint text-accent-info-deep border-accent-info-edge',
    dot: 'bg-accent-info',
    text: 'text-accent-info-deep',
    tint: 'bg-accent-info-tint',
    rail: 'bg-accent-info',
  },
  success: {
    chip: 'bg-accent-success-tint text-accent-success-deep border-accent-success-edge',
    dot: 'bg-accent-success',
    text: 'text-accent-success-deep',
    tint: 'bg-accent-success-tint',
    rail: 'bg-accent-success',
  },
  attn: {
    chip: 'bg-accent-warn-tint text-accent-warn-deep border-accent-warn-edge',
    dot: 'bg-accent-warn',
    text: 'text-accent-warn-deep',
    tint: 'bg-accent-warn-tint',
    rail: 'bg-accent-warn',
  },
  danger: {
    chip: 'bg-accent-danger-tint text-accent-danger-deep border-accent-danger-edge',
    dot: 'bg-accent-danger',
    text: 'text-accent-danger-deep',
    tint: 'bg-accent-danger-tint',
    rail: 'bg-accent-danger',
  },
  neutral: {
    chip: 'bg-surface-inset text-ink-muted border-line-strong',
    dot: 'bg-ink-faint',
    text: 'text-ink-muted',
    tint: 'bg-surface-secondary',
    rail: 'bg-ink-faint',
  },
  ai: {
    chip: 'bg-accent-ai-tint text-accent-ai border-accent-ai-edge',
    dot: 'bg-accent-ai',
    text: 'text-accent-ai',
    tint: 'bg-accent-ai-tint',
    rail: 'bg-accent-ai',
  },
};

/**
 * Domain status → pigment. Matching is on the normalised word, so
 * `PAID`, `paid`, `Paid` and `is_paid` all land in the same place.
 */
const BY_WORD: Record<string, Pigment> = {
  // ── settled ─────────────────────────────────────────────────────────────
  paid: 'success',
  present: 'success',
  approved: 'success',
  active: 'success',
  completed: 'success',
  complete: 'success',
  success: 'success',
  successful: 'success',
  captured: 'success',
  verified: 'success',
  enrolled: 'success',
  promoted: 'success',
  returned: 'success',
  available: 'success',
  allotted: 'success',
  granted: 'success',
  checkedout: 'success',
  checkedin: 'success',
  finalized: 'success',
  finalised: 'success',
  published: 'success',
  open: 'success',
  in: 'success',
  yes: 'success',
  true: 'success',
  ontime: 'success',

  // ── act on this ─────────────────────────────────────────────────────────
  pending: 'attn',
  partial: 'attn',
  partiallypaid: 'attn',
  processing: 'attn',
  inprogress: 'attn',
  awaiting: 'attn',
  awaitingapproval: 'attn',
  requested: 'attn',
  submitted: 'attn',
  due: 'attn',
  unpaid: 'attn',
  late: 'attn',
  halfday: 'attn',
  warning: 'attn',
  onhold: 'attn',
  hold: 'attn',
  review: 'attn',
  underreview: 'attn',
  draftpayroll: 'attn',
  issued: 'attn',
  reserved: 'attn',
  trial: 'attn',
  expiringsoon: 'attn',
  needsattention: 'attn',
  // An unfilled cell in the register. Not danger — nobody has claimed this
  // person was absent yet; somebody just has to go and find out.
  notmarked: 'attn',
  unmarked: 'attn',

  // ── correction ──────────────────────────────────────────────────────────
  absent: 'danger',
  overdue: 'danger',
  rejected: 'danger',
  declined: 'danger',
  failed: 'danger',
  failure: 'danger',
  cancelled: 'danger',
  canceled: 'danger',
  suspended: 'danger',
  expired: 'danger',
  inactive: 'danger',
  blocked: 'danger',
  lost: 'danger',
  damaged: 'danger',
  unauthorized: 'danger',
  deleted: 'danger',
  error: 'danger',
  refunded: 'danger',
  bounced: 'danger',
  out: 'danger',
  no: 'danger',
  false: 'danger',

  // ── informational ───────────────────────────────────────────────────────
  onleave: 'info',
  leave: 'info',
  instalment: 'info',
  installment: 'info',
  scheduled: 'info',
  upcoming: 'info',
  online: 'info',
  upi: 'info',
  card: 'info',
  netbanking: 'info',
  transferred: 'info',
  new: 'info',
  info: 'info',
  holiday: 'info',
  weekend: 'info',

  // ── neutral ─────────────────────────────────────────────────────────────
  draft: 'neutral',
  archived: 'neutral',
  na: 'neutral',
  none: 'neutral',
  notapplicable: 'neutral',
  unknown: 'neutral',
  closed: 'neutral',
  graduated: 'neutral',
};

/** Substring fallbacks, tried in order when no exact word matches. */
const BY_FRAGMENT: [string, Pigment][] = [
  ['overdue', 'danger'],
  ['reject', 'danger'],
  ['cancel', 'danger'],
  ['fail', 'danger'],
  ['absent', 'danger'],
  ['expire', 'danger'],
  ['suspend', 'danger'],
  ['partial', 'attn'],
  ['pending', 'attn'],
  ['await', 'attn'],
  ['progress', 'attn'],
  ['unpaid', 'attn'],
  ['due', 'attn'],
  ['late', 'attn'],
  ['paid', 'success'],
  ['present', 'success'],
  ['approve', 'success'],
  ['active', 'success'],
  ['complete', 'success'],
  ['success', 'success'],
  ['leave', 'info'],
  ['schedul', 'info'],
  ['draft', 'neutral'],
];

/**
 * Resolve any status string to a pigment. Unrecognised words fall back to
 * neutral rather than guessing — a wrong colour is worse than a quiet one.
 */
export function pigmentFor(status: string | null | undefined): Pigment {
  if (!status) return 'neutral';
  const word = String(status)
    .toLowerCase()
    .replace(/[\s_\-./]/g, '');
  if (BY_WORD[word]) return BY_WORD[word];
  for (const [fragment, pigment] of BY_FRAGMENT) {
    if (word.includes(fragment)) return pigment;
  }
  return 'neutral';
}

/** `PARTIALLY_PAID` → `Partially paid`. Used when no explicit label is given. */
export function humanizeStatus(status: string | null | undefined): string {
  if (!status) return '—';
  const s = String(status).replace(/[_-]+/g, ' ').trim();
  if (!s) return '—';
  const spaced = s === s.toUpperCase() ? s.toLowerCase() : s;
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}
