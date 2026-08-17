/**
 * ONE source of truth for attendance-status colour.
 *
 * It is read in three places that sit next to each other on screen and must
 * agree: the calendar cells, the legend under them, and the donut beside them.
 * Those used to be three separate lists of raw Tailwind hexes (`#22c55e`,
 * `bg-green-500`, `bg-sky-500`…) which is both a drift risk and the reason the
 * calendar glowed in colours belonging to no other screen in the app.
 *
 * Everything now comes from the app's own accent scales:
 *
 *   PRESENT   sage        the good case
 *   LATE      marigold    wants attention, not alarm
 *   HALF_DAY  iris
 *   LEAVE     lapis       informational — it was arranged in advance
 *   ABSENT    vermilion   the one a parent is actually looking for
 *   HOLIDAY   brass, quiet — school being shut is not news about the child
 *   SUNDAY    quietest of all
 *
 * The ranking matters more than the hues: before this, HOLIDAY was a saturated
 * sky-blue that shouted louder than ABSENT, so a month of holidays read as a
 * month of alerts.
 */

export type AttendanceStatus =
  | 'PRESENT'
  | 'LATE'
  | 'HALF_DAY'
  | 'LEAVE'
  | 'ABSENT'
  | 'HOLIDAY'
  | 'SUNDAY';

interface AttendanceTone {
  /** Calendar cell: solid fill, readable text, matching border. */
  cell: string;
  /** Legend dot. */
  dot: string;
  /** Donut segment. A CSS variable, so one edit re-tints chart and calendar. */
  fill: string;
  /** Count tile under the donut: a tint, not a fill. */
  tile: string;
  /** The figure on that tile. Needs a dark override — a 700-step reads as
   *  near-black on walnut. */
  figure: string;
  /**
   * The Today tile's stamp: one ink class, because the border, the glyph and
   * the word all take `currentColor`. The card behind it stays plain surface —
   * a washed card would need a second set of hues and would turn an absent day
   * into a red block.
   */
  stamp: string;
  label: string;
}

export const ATTENDANCE_TONE: Record<AttendanceStatus, AttendanceTone> = {
  PRESENT: {
    cell: 'bg-sage-600 border-sage-700 text-white',
    dot: 'bg-sage-600',
    fill: 'var(--color-sage-500)',
    tile: 'bg-sage-500/10 border-sage-500/25',
    figure: 'text-sage-700 dark:text-sage-300',
    stamp: 'text-sage-700 dark:text-sage-300',
    label: 'Present',
  },
  LATE: {
    // Dark text: marigold is bright enough that white on it fails contrast.
    cell: 'bg-marigold-400 border-marigold-500 text-walnut-950',
    dot: 'bg-marigold-400',
    fill: 'var(--color-marigold-500)',
    tile: 'bg-marigold-500/12 border-marigold-500/28',
    figure: 'text-marigold-700 dark:text-marigold-300',
    stamp: 'text-marigold-700 dark:text-marigold-300',
    label: 'Late',
  },
  HALF_DAY: {
    cell: 'bg-iris-500 border-iris-700 text-white',
    dot: 'bg-iris-500',
    fill: 'var(--color-iris-500)',
    tile: 'bg-iris-500/10 border-iris-500/25',
    figure: 'text-iris-700 dark:text-iris-200',
    stamp: 'text-iris-700 dark:text-iris-300',
    label: 'Half day',
  },
  LEAVE: {
    cell: 'bg-lapis-500 border-lapis-600 text-white',
    dot: 'bg-lapis-500',
    fill: 'var(--color-lapis-500)',
    tile: 'bg-lapis-500/10 border-lapis-500/25',
    figure: 'text-lapis-700 dark:text-lapis-300',
    stamp: 'text-lapis-700 dark:text-lapis-300',
    label: 'Leave',
  },
  ABSENT: {
    cell: 'bg-vermilion-600 border-vermilion-700 text-white',
    dot: 'bg-vermilion-600',
    fill: 'var(--color-vermilion-500)',
    tile: 'bg-vermilion-500/10 border-vermilion-500/25',
    figure: 'text-vermilion-700 dark:text-vermilion-300',
    stamp: 'text-vermilion-700 dark:text-vermilion-300',
    label: 'Absent',
  },
  HOLIDAY: {
    cell: 'bg-brass-200 border-brass-300 text-brass-900',
    dot: 'bg-brass-300',
    fill: 'var(--color-brass-300)',
    tile: 'bg-brass-500/10 border-brass-500/25',
    figure: 'text-brass-700 dark:text-brass-300',
    stamp: 'text-brass-700 dark:text-brass-300',
    label: 'Holiday',
  },
  SUNDAY: {
    cell: 'bg-surface-inset border-line text-ink-faint',
    dot: 'bg-surface-inset border border-line',
    fill: 'var(--surface-inset)',
    tile: 'bg-surface-inset border-line',
    figure: 'text-ink-muted',
    stamp: 'text-ink-muted',
    label: 'Sunday',
  },
};

/** A day with no record yet — inert, and still hoverable in the calendar. */
export const ATTENDANCE_EMPTY_CELL =
  'bg-surface-secondary border-line text-ink hover:bg-surface-inset';

/**
 * Not a status the API returns — it is the absence of one, which on the Today
 * tile is a real answer ("nobody has marked the register yet") rather than a
 * gap. Dashed rather than solid so it reads as pending at a glance, and quiet
 * enough that a parent checking at 8am isn't alarmed.
 */
export const ATTENDANCE_NOT_MARKED = {
  stamp: 'text-ink-faint',
  border: 'border-dashed',
  label: 'Not marked',
} as const;

export function attendanceCellClass(status: string | null | undefined): string {
  if (!status) return ATTENDANCE_EMPTY_CELL;
  return ATTENDANCE_TONE[status as AttendanceStatus]?.cell ?? ATTENDANCE_EMPTY_CELL;
}

/**
 * LATE and HALF_DAY both count as "present" in the percentage stat (see
 * parent.service.ts), so their calendar cell is split diagonally — present
 * green plus the status's own tone — instead of hiding the "counts as
 * present" half. Every other status renders as the plain solid cell.
 * `fill` values are `var(--color-*)` custom properties, so the gradient
 * stays theme-aware in light/dark exactly like the rest of ATTENDANCE_TONE.
 */
export function attendanceCellStyle(
  status: string | null | undefined,
): { className: string; style?: { background: string } } {
  if (status === 'LATE' || status === 'HALF_DAY') {
    return {
      className: 'text-white border-line',
      style: {
        background: `linear-gradient(135deg, ${ATTENDANCE_TONE.PRESENT.fill} 50%, ${ATTENDANCE_TONE[status].fill} 50%)`,
      },
    };
  }
  return { className: attendanceCellClass(status) };
}

/** Legend order — worst-to-know first would be alarmist, so it reads as a scale. */
export const ATTENDANCE_LEGEND: AttendanceStatus[] = [
  'PRESENT',
  'LATE',
  'HALF_DAY',
  'LEAVE',
  'ABSENT',
  'HOLIDAY',
  'SUNDAY',
];
