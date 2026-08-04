'use client';

import { cn } from '@/lib/utils';

/**
 * THE STORM BORDER — lightning running the edge of a panel.
 *
 * Two brass arcs travelling at different speeds in opposite directions, over a
 * blurred flickering copy of themselves. Brass, because the accent pigment is
 * already in the system: the border belongs to the palette rather than being a
 * separate effect bolted on.
 *
 * Reserved for exactly ONE element per screen — the sign-in card, or the panel
 * you just acted on. It is how the app says "this is the live thing", and it
 * stops meaning that the moment two of them run.
 *
 * The parent must be `relative` and carry the border radius; both layers
 * inherit it. Disabled entirely under prefers-reduced-motion (globals.css).
 */
export function BorderBeam({
  className,
  /** Seconds for one lap of the leading arc. Lower reads more urgent. */
  duration = 3.4,
  delay = 0,
}: {
  className?: string;
  duration?: number;
  delay?: number;
}) {
  const style = {
    animationDuration: `${duration}s, ${duration * 1.65}s, 4.2s`,
    animationDelay: `${delay}s`,
  };

  return (
    <>
      <span
        aria-hidden="true"
        className={cn('storm-halo', className)}
        style={style}
      />
      <span
        aria-hidden="true"
        className={cn('storm-ring', className)}
        style={{
          animationDuration: `${duration}s, ${duration * 1.65}s`,
          animationDelay: `${delay}s`,
        }}
      />
    </>
  );
}

export default BorderBeam;
