/**
 * Subject colour for homework lists.
 *
 * Subjects are open-ended — a school can name them anything — so there is no
 * fixed map from subject to hue. Instead the first subject seen takes the first
 * colour, the second takes the second, and so on. The assignment is stable for
 * as long as the list is built in the same order, which is what makes "the
 * violet one is Maths" learnable within a screen.
 *
 * These are raw Tailwind hues rather than semantic tokens on purpose: they are
 * an arbitrary keying device, not status, and the semantic pigments each carry
 * a meaning (`accent-warn` says "needs you") that a subject bar must not imply.
 */

export interface SubjectColor {
  /** Left rail on a homework card. */
  border: string;
  /** Pale wash behind a subject label. */
  bg: string;
  /** The subject name itself. */
  text: string;
  /** Compact bar or dot in a dense list. */
  dot: string;
}

export const SUBJECT_PALETTE: SubjectColor[] = [
  { border: 'border-l-violet-500', bg: 'bg-violet-500/10', text: 'text-violet-600', dot: 'bg-violet-500' },
  { border: 'border-l-sky-500', bg: 'bg-sky-500/10', text: 'text-sky-600', dot: 'bg-sky-500' },
  { border: 'border-l-emerald-500', bg: 'bg-emerald-500/10', text: 'text-emerald-600', dot: 'bg-emerald-500' },
  { border: 'border-l-amber-500', bg: 'bg-amber-500/10', text: 'text-amber-600', dot: 'bg-amber-500' },
  { border: 'border-l-rose-500', bg: 'bg-rose-500/10', text: 'text-rose-600', dot: 'bg-rose-500' },
  { border: 'border-l-cyan-500', bg: 'bg-cyan-500/10', text: 'text-cyan-600', dot: 'bg-cyan-500' },
  { border: 'border-l-fuchsia-500', bg: 'bg-fuchsia-500/10', text: 'text-fuchsia-600', dot: 'bg-fuchsia-500' },
  { border: 'border-l-orange-500', bg: 'bg-orange-500/10', text: 'text-orange-600', dot: 'bg-orange-500' },
];

/**
 * Returns a lookup that hands out palette entries in first-seen order and
 * remembers them. Build one per list; sharing it across two lists that hold
 * different subjects would make the same colour mean two things at once.
 */
export function createSubjectColorMap(): (subject: string | null | undefined) => SubjectColor {
  const assigned = new Map<string, SubjectColor>();
  let next = 0;

  return (subject) => {
    const key = (subject ?? 'General').toLowerCase().trim() || 'general';
    let colour = assigned.get(key);
    if (!colour) {
      colour = SUBJECT_PALETTE[next % SUBJECT_PALETTE.length];
      assigned.set(key, colour);
      next++;
    }
    return colour;
  };
}
