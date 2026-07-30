import * as React from 'react';
import { Check, X, Clock, CircleDot, Palmtree, Plane } from 'lucide-react';
import { cn } from '@/lib/utils';

/* ═══════════════════════════════════════════════════════════════════════════
   THE STAMP — the parent portal's signature.

   This is the thing the app is opened for. A parent standing at a bus stop
   wants one fact: did my child get in today. Everything else on the screen is
   secondary to it, so it is the only element allowed to be loud.

   It is drawn as a teacher's date stamp — double-ruled edge, the mark, the
   word, the date underneath in the register hand — and it lands with a press
   rather than a fade. It rests slightly off-square because a stamp pressed by
   hand never lands true; that tilt is the whole reason it reads as a stamp and
   not as a badge.

   Ink follows the app's pigment map rather than inventing colours: sage is
   settled, vermilion is the exception a parent is looking for, marigold wants
   attention, lapis is informational. A day not yet marked is not a status at
   all — it is an empty space waiting for ink, so it is drawn as a dashed
   outline with no fill.
   ═══════════════════════════════════════════════════════════════════════════ */

export type StampStatus =
  | 'PRESENT'
  | 'ABSENT'
  | 'LATE'
  | 'HALF_DAY'
  | 'LEAVE'
  | 'HOLIDAY'
  | 'PENDING';

interface StampFace {
  label: string;
  icon: React.ElementType;
  /** Border + text colour. */
  ink: string;
  /** The faint wash inside the rule. */
  wash: string;
  /** The halo that spreads as the stamp lifts. */
  halo: string;
  dashed?: boolean;
}

const FACES: Record<StampStatus, StampFace> = {
  PRESENT: {
    label: 'Present',
    icon: Check,
    ink: 'border-accent-success text-accent-success-deep',
    wash: 'bg-accent-success-tint',
    halo: 'bg-accent-success',
  },
  ABSENT: {
    label: 'Absent',
    icon: X,
    ink: 'border-accent-danger text-accent-danger-deep',
    wash: 'bg-accent-danger-tint',
    halo: 'bg-accent-danger',
  },
  LATE: {
    label: 'Late',
    icon: Clock,
    ink: 'border-accent-warn text-accent-warn-deep',
    wash: 'bg-accent-warn-tint',
    halo: 'bg-accent-warn',
  },
  HALF_DAY: {
    label: 'Half day',
    icon: CircleDot,
    ink: 'border-accent-warn text-accent-warn-deep',
    wash: 'bg-accent-warn-tint',
    halo: 'bg-accent-warn',
  },
  LEAVE: {
    label: 'On leave',
    icon: Plane,
    ink: 'border-accent-info text-accent-info-deep',
    wash: 'bg-accent-info-tint',
    halo: 'bg-accent-info',
  },
  HOLIDAY: {
    label: 'Holiday',
    icon: Palmtree,
    ink: 'border-brand-edge text-brand',
    wash: 'bg-brand-tint',
    halo: 'bg-brand',
  },
  PENDING: {
    label: 'Not marked',
    icon: CircleDot,
    // Quiet, but not invisible — it still has to read as the space where the
    // day's mark will go, from arm's length, on a phone.
    ink: 'border-line-strong text-ink-muted',
    wash: 'bg-surface-secondary',
    halo: 'bg-transparent',
    dashed: true,
  },
};

export function AttendanceStamp({
  status,
  date,
  time,
  className,
}: {
  status: StampStatus;
  /** Shown under the word, in the register hand. */
  date: Date;
  /** Check-in time, when the school records one. */
  time?: string | null;
  className?: string;
}) {
  const face = FACES[status] ?? FACES.PENDING;
  const Icon = face.icon;

  const day = date
    .toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
    .toUpperCase();

  return (
    <div className={cn('relative flex flex-col items-center', className)}>
      {/* Ink spreading as the stamp lifts. Purely atmospheric, so it is hidden
          from assistive tech and skipped under reduced motion. */}
      <span
        aria-hidden
        className={cn(
          'stamp-halo pointer-events-none absolute top-1/2 left-1/2 size-40 -translate-x-1/2 -translate-y-1/2 rounded-full blur-2xl',
          face.halo,
        )}
      />

      <div
        role="status"
        aria-label={`Attendance today: ${face.label}`}
        className={cn(
          // Squarer and heavier than a badge: a stamp is a block of ink, and
          // the width is held so a long word cannot flatten it into a pill.
          'stamp relative grid min-w-44 place-items-center rounded-xl border-[2.5px] px-7 py-5',
          face.dashed ? 'border-dashed' : '',
          face.ink,
          face.wash,
        )}
      >
        {/* The inner rule — a real stamp has a double edge. */}
        <span
          aria-hidden
          className={cn(
            'pointer-events-none absolute inset-1 rounded-lg border border-current opacity-30',
            face.dashed ? 'border-dashed' : '',
          )}
        />

        <Icon className="size-7 shrink-0" strokeWidth={3} aria-hidden />

        {/* Uppercase and widely tracked, because that is how a stamp is cut. */}
        <span className="mt-2 font-display text-[15px] leading-none font-extrabold tracking-[0.13em] uppercase">
          {face.label}
        </span>

        <span className="tabular mt-2 text-[10px] leading-none font-bold tracking-[0.22em] opacity-65">
          {day}
        </span>
      </div>

      {time && (
        <p className="tabular mt-2.5 text-[12px] text-ink-muted">Marked at {time}</p>
      )}
    </div>
  );
}
