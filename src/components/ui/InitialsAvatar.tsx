import * as React from 'react';
import { cn } from '@/lib/utils';

/* ═══════════════════════════════════════════════════════════════════════════
   INITIALS AVATAR — initials on a coloured tile.

   (Distinct from ui/avatar.tsx, which is the shadcn image-avatar primitive.
   This one is the "no photo, show letters" tile used for people throughout
   the app.)

   Two real bugs motivated it:

   1. WHITE ON WHITE. Every avatar in the app was `text-white` over a gradient
      and nothing else. A gradient is two Tailwind utilities; if either is
      missing from the stylesheet the background is transparent and white text
      lands on a white card — invisible. That is what happened to the second
      child's "PG" tile on an installed PWA holding a stylesheet cached from
      before `from-lapis-500` existed: fine on a laptop, blank on the phone.

      So the base colour is an INLINE STYLE. It cannot be tree-shaken, missed
      by the class scanner, or absent from a stale bundle. The gradient layers
      on top purely as enhancement: when it resolves the tile looks richer,
      when it doesn't the tile is still a solid, readable colour.

   2. NINE COPIES of the same markup — sidebar, top bar, greeting card, portal
      header, children list, sibling switcher. Changing the avatar meant
      finding all nine.

   Every base tone is dark enough for white text. Vermilion is left out on
   purpose: it means danger, and a child is not an error state.
   ═══════════════════════════════════════════════════════════════════════════ */

export interface AvatarTone {
  /** Inline, so it survives a stale or partial stylesheet. */
  base: string;
  /** Layered over the base when the utilities are present. */
  grad: string;
}

export const AVATAR_TONES: AvatarTone[] = [
  { base: '#a9670c', grad: 'from-brass-500 to-marigold-400' },
  { base: '#1e4fd8', grad: 'from-lapis-500 to-iris-500' },
  { base: '#0b7a55', grad: 'from-sage-500 to-lapis-500' },
  { base: '#7c52e0', grad: 'from-iris-500 to-brass-500' },
  { base: '#b4740c', grad: 'from-marigold-500 to-sage-500' },
];

const SIZES = {
  xs: 'size-7 text-[11px] rounded-md',
  sm: 'size-8 text-[11.5px] rounded-lg',
  md: 'size-10 text-sm rounded-lg',
  lg: 'size-13 text-[18px] rounded-xl',
  xl: 'size-14 text-[20px] rounded-xl',
} as const;

export function initialsOf(first?: string | null, last?: string | null): string {
  const a = first?.trim()?.[0] ?? '';
  const b = last?.trim()?.[0] ?? '';
  return (a + b).toUpperCase() || '?';
}

export function InitialsAvatar({
  initials,
  index = 0,
  size = 'md',
  className,
  title,
}: {
  initials: string;
  /** Picks the tone. Same index → same colour, so a child keeps their colour. */
  index?: number;
  size?: keyof typeof SIZES;
  className?: string;
  title?: string;
}) {
  const tone = AVATAR_TONES[index % AVATAR_TONES.length];
  return (
    <span
      title={title}
      style={{ backgroundColor: tone.base }}
      className={cn(
        'grid shrink-0 place-items-center bg-linear-to-br font-display font-bold text-white select-none',
        tone.grad,
        SIZES[size],
        className,
      )}
    >
      {initials}
    </span>
  );
}
