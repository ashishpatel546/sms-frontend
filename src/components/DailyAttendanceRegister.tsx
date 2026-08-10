'use client';

/**
 * DAILY ATTENDANCE REGISTER
 * ─────────────────────────────────────────────────────────────────────────
 * The register rack in the school office, on screen: one slot per
 * class-section, and the empty ones are the loud thing. Before this, the
 * only way to know whether a class's attendance had been taken was to click
 * through /dashboard/attendance one class and section at a time — for a
 * school with a dozen classes and a few sections each, that's dozens of
 * round trips to answer one binary question.
 *
 * Deliberately not a chart: the owner isn't reading a percentage, they're
 * scanning for the tiles that still need someone to act. Numbers (present /
 * absent / late / %) live one toggle away in the Details table, so this
 * board stays legible at a glance.
 */

import * as React from 'react';
import useSWR from 'swr';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertCircle, CalendarCheck } from 'lucide-react';
import { fetcher } from '@/lib/api';
import { cn, todayLocalDate } from '@/lib/utils';
import { Panel, PanelHeader, PanelBody } from '@/components/ui/Panel';
import { FilterBar, FilterField, SegmentedControl, Pagination } from '@/components/ui/FilterBar';
import { AppDatePicker } from '@/components/ui/AppDatePicker';
import { Checkbox } from '@/components/ui/Field';
import { EmptyState, ErrorState } from '@/components/ui/EmptyState';
import { PanelSkeleton } from '@/components/ui/Skeletons';
import { DataTable, type Column } from '@/components/ui/DataTable';
import { StatusChip } from '@/components/ui/StatusChip';
import type { Pigment } from '@/components/ui/pigment';

interface RegisterRow {
  classId: number;
  className: string;
  sectionId: number;
  sectionName: string;
  strength: number;
  marked: boolean;
  dayType: 'WORKING' | 'SUNDAY' | 'HOLIDAY';
  holidayDescription: string | null;
  present: number;
  absent: number;
  late: number;
  halfDay: number;
  leave: number;
  holiday: number;
  recorded: number;
  unrecorded: number;
  percentage: number;
  takenBy: { id: number; name: string } | null;
  takenAt: string | null;
  updatedAt: string | null;
}

interface RegisterResponse {
  date: string;
  isSunday: boolean;
  academicSession: { id: number; name: string } | null;
  holidays: { id: number; description: string; isEntireSchool: boolean }[];
  rows: RegisterRow[];
  summary: {
    totalRegisters: number;
    taken: number;
    pending: number;
    students: number;
    present: number;
    absent: number;
    late: number;
    halfDay: number;
    leave: number;
    percentage: number;
  };
}

type RowState = 'taken' | 'pending' | 'settled' | 'empty';

/** `marked` wins over everything: a register that was actually recorded is
 *  reported as taken even on a holiday, and even when the roster query found
 *  no active enrollments for it — otherwise the board would contradict the
 *  "N of M taken" count, which is driven by the same flag.
 *  Below that: a Sunday or holiday is settled (not overdue), a class with
 *  nobody enrolled can't be pending, and everything else awaits a teacher. */
function stateOf(row: RegisterRow): RowState {
  if (row.marked) return 'taken';
  if (row.dayType !== 'WORKING') return 'settled';
  if (row.strength === 0) return 'empty';
  return 'pending';
}

function stateLabel(row: RegisterRow): string {
  switch (stateOf(row)) {
    case 'pending':
      return 'Not taken';
    case 'taken':
      return 'Taken';
    case 'settled':
      return row.dayType === 'SUNDAY' ? 'Sunday' : row.holidayDescription || 'Holiday';
    case 'empty':
      return 'No students';
  }
}

const STATE_PIGMENT: Record<RowState, Pigment> = {
  pending: 'attn',
  taken: 'success',
  settled: 'info',
  empty: 'neutral',
};

function initials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

/** One class-section slot. State is inverted from the usual card: settled
 *  work recedes, a pending register is the one that has to shout. */
function SectionTile({ row, date }: { row: RegisterRow; date: string }) {
  const state = stateOf(row);
  const base =
    'flex min-h-16 flex-col justify-between gap-1 rounded-lg border px-2.5 py-2 text-left transition-all';

  if (state === 'empty') {
    return (
      <div className={cn(base, 'cursor-default border-line bg-surface-inset')}>
        <span className="text-[12.5px] font-semibold text-ink-faint">{row.sectionName}</span>
        <span className="text-[11px] text-ink-faint">No students</span>
      </div>
    );
  }

  if (state === 'settled') {
    return (
      <div className={cn(base, 'border-accent-info-edge bg-accent-info-tint')}>
        <span className="text-[12.5px] font-semibold text-accent-info-deep">{row.sectionName}</span>
        <span className="truncate text-[11px] text-accent-info-deep/80" title={stateLabel(row)}>
          {stateLabel(row)}
        </span>
      </div>
    );
  }

  if (state === 'pending') {
    return (
      <Link
        href={`/dashboard/attendance?classId=${row.classId}&sectionId=${row.sectionId}&date=${date}`}
        className={cn(
          base,
          'border-accent-warn-edge bg-accent-warn-tint hover:-translate-y-0.5 hover:shadow-raised focus-visible:ring-2 focus-visible:ring-accent-warn/50 focus-visible:outline-none',
        )}
      >
        <span className="text-[12.5px] font-semibold text-accent-warn-deep">{row.sectionName}</span>
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-accent-warn-deep">
          <AlertCircle className="size-3" />
          Not taken
        </span>
      </Link>
    );
  }

  // taken
  return (
    <div className={cn(base, 'border-line bg-surface')}>
      <div className="flex items-center justify-between gap-1">
        <span className="text-[12.5px] font-semibold text-ink">{row.sectionName}</span>
        <span aria-hidden className="size-1.5 shrink-0 rounded-full bg-accent-success" />
      </div>
      <span className="tabular text-[11px] text-ink-muted">
        {row.present}/{row.strength} present
      </span>
      {row.takenBy && (
        <span className="truncate text-[10.5px] text-ink-faint" title={row.takenBy.name}>
          {initials(row.takenBy.name)}
        </span>
      )}
    </div>
  );
}

/** The board pages by CLASS, not by row: a class's sections belong together, and
 *  splitting 3-A and 3-B across a page break would break the thing the board is
 *  for. Details pages by row, since there the row is the unit. */
const CLASSES_PER_PAGE = 6;
const ROWS_PER_PAGE = 25;

export default function DailyAttendanceRegister() {
  const router = useRouter();
  const [date, setDate] = React.useState(todayLocalDate());
  const [onlyPending, setOnlyPending] = React.useState(false);
  const [view, setView] = React.useState<'board' | 'details'>('board');
  const [page, setPage] = React.useState(1);

  // Anything that changes the contents of the list sends you back to page 1 —
  // otherwise you keep a page number that no longer exists and see nothing.
  // Done in the handlers rather than an effect: resetting in an effect renders
  // the stale page first and then corrects it.
  const changeDate = (v: string) => { setDate(v); setPage(1); };
  const changeOnlyPending = (v: boolean) => { setOnlyPending(v); setPage(1); };
  const changeView = (v: 'board' | 'details') => { setView(v); setPage(1); };

  const { data, error, isLoading } = useSWR<RegisterResponse>(
    `/attendance/daily-register?date=${date}`,
    fetcher,
  );

  const visibleRows = React.useMemo(() => {
    if (!data) return [];
    return onlyPending ? data.rows.filter((r) => stateOf(r) === 'pending') : data.rows;
  }, [data, onlyPending]);

  const groups = React.useMemo(() => {
    const byClass = new Map<number, { classId: number; className: string; rows: RegisterRow[] }>();
    for (const row of visibleRows) {
      const g = byClass.get(row.classId) ?? { classId: row.classId, className: row.className, rows: [] };
      g.rows.push(row);
      byClass.set(row.classId, g);
    }
    return Array.from(byClass.values());
  }, [visibleRows]);

  const columns: Column<RegisterRow>[] = [
    {
      key: 'className',
      header: 'Class',
      accessor: (r) => r.className,
      sortable: true,
      card: 'title',
    },
    {
      key: 'sectionName',
      header: 'Section',
      accessor: (r) => r.sectionName,
      sortable: true,
      card: 'meta',
    },
    {
      key: 'status',
      header: 'Status',
      render: (r) => <StatusChip label={stateLabel(r)} pigment={STATE_PIGMENT[stateOf(r)]} />,
      card: 'trailing',
    },
    {
      key: 'strength',
      header: 'Strength',
      accessor: (r) => r.strength,
      sortable: true,
      align: 'right',
    },
    {
      key: 'present',
      header: 'Present',
      accessor: (r) => (r.marked ? r.present : '—'),
      sortValue: (r) => r.present,
      sortable: true,
      align: 'right',
      hideBelow: 'sm',
    },
    {
      key: 'absent',
      header: 'Absent',
      accessor: (r) => (r.marked ? r.absent : '—'),
      sortValue: (r) => r.absent,
      sortable: true,
      align: 'right',
      hideBelow: 'sm',
    },
    {
      key: 'late',
      header: 'Late',
      accessor: (r) => (r.marked ? r.late : '—'),
      sortValue: (r) => r.late,
      sortable: true,
      align: 'right',
      hideBelow: 'md',
    },
    {
      key: 'halfDay',
      header: 'Half day',
      accessor: (r) => (r.marked ? r.halfDay : '—'),
      sortValue: (r) => r.halfDay,
      sortable: true,
      align: 'right',
      hideBelow: 'md',
    },
    {
      key: 'leave',
      header: 'Leave',
      accessor: (r) => (r.marked ? r.leave : '—'),
      sortValue: (r) => r.leave,
      sortable: true,
      align: 'right',
      hideBelow: 'lg',
    },
    {
      key: 'percentage',
      header: '%',
      accessor: (r) => (r.marked ? `${r.percentage}%` : '—'),
      sortValue: (r) => r.percentage,
      sortable: true,
      align: 'right',
    },
    {
      key: 'takenBy',
      header: 'Taken by',
      accessor: (r) => r.takenBy?.name ?? '—',
      hideBelow: 'md',
    },
  ];

  // The meter counts only registers that were actually DUE — a working day
  // with someone enrolled. Measuring against every row would report a Sunday
  // as "0 of 20 taken" with an empty bar, which reads as a school-wide miss
  // when in fact nothing was owed.
  const due = React.useMemo(
    () => (data?.rows ?? []).filter((r) => r.dayType === 'WORKING' && r.strength > 0),
    [data],
  );
  const takenDue = due.filter((r) => r.marked).length;
  const takenPct = due.length > 0 ? Math.round((takenDue / due.length) * 100) : 0;

  // Page over classes on the board and over rows in Details — different units,
  // so the count in the footer is honest about which one it's showing.
  const pageCount =
    view === 'board'
      ? Math.max(1, Math.ceil(groups.length / CLASSES_PER_PAGE))
      : Math.max(1, Math.ceil(visibleRows.length / ROWS_PER_PAGE));
  const safePage = Math.min(page, pageCount);
  const pagedGroups = React.useMemo(
    () => groups.slice((safePage - 1) * CLASSES_PER_PAGE, safePage * CLASSES_PER_PAGE),
    [groups, safePage],
  );

  return (
    <Panel>
      <PanelHeader
        title="Daily register"
        description="Which classes have taken attendance for the selected date"
      />
      <PanelBody className="space-y-4">
        <FilterBar
          actions={
            <SegmentedControl
              value={view}
              onValueChange={changeView}
              size="sm"
              options={[
                { value: 'board', label: 'Board' },
                { value: 'details', label: 'Details' },
              ]}
            />
          }
        >
          <FilterField label="Date" width="md">
            <AppDatePicker value={date} onChange={changeDate} max={todayLocalDate()} />
          </FilterField>
          <Checkbox
            label="Only pending"
            checked={onlyPending}
            onChange={(e) => changeOnlyPending(e.target.checked)}
            className="py-0"
          />
        </FilterBar>

        {isLoading && <PanelSkeleton rows={3} title={false} />}

        {error && (
          <ErrorState description="The register for this date couldn't be loaded." />
        )}

        {data && !data.academicSession && (
          <EmptyState
            compact
            title="No academic session covers this date"
            description="Set up a session that spans this date to see its register."
          />
        )}

        {data && data.academicSession && data.rows.length === 0 && (
          <EmptyState
            compact
            title="No classes to report on"
            description="No class has any actively enrolled students this session."
          />
        )}

        {data && data.academicSession && data.rows.length > 0 && (
          <>
            {due.length === 0 ? (
              <p className="text-[13.5px] text-ink-muted">
                {data.isSunday
                  ? 'Sunday — no registers were due.'
                  : 'No registers were due on this date.'}
              </p>
            ) : (
              <div>
                <p className="text-[13.5px] text-ink">
                  <span className="tabular font-semibold">{takenDue}</span> of{' '}
                  <span className="tabular font-semibold">{due.length}</span> registers taken
                  {data.summary.pending > 0 && (
                    <span className="ml-1.5 font-medium text-accent-warn-deep">
                      — {data.summary.pending} pending
                    </span>
                  )}
                </p>
                <div
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={due.length}
                  aria-valuenow={takenDue}
                  aria-label="Registers taken"
                  className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface-inset"
                >
                  <div
                    className="h-full rounded-full bg-accent-success transition-all"
                    style={{ width: `${takenPct}%` }}
                  />
                </div>
              </div>
            )}

            {onlyPending && visibleRows.length === 0 ? (
              <EmptyState
                compact
                icon={<CalendarCheck />}
                title="All registers taken"
                description="Every class has recorded attendance for this date."
              />
            ) : view === 'board' ? (
              <div className="space-y-3">
                {pagedGroups.map((g, i) => (
                  <div
                    key={g.classId}
                    className={cn(
                      'grid gap-2 lg:grid-cols-[9rem_1fr] lg:items-start lg:gap-3',
                      i > 0 && 'border-t border-line pt-3',
                    )}
                  >
                    <div className="text-[13px] font-semibold text-ink lg:pt-2">{g.className}</div>
                    {/* Steps up with the viewport so tiles stay a readable size
                        rather than stretching to fill a wide monitor. */}
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8">
                      {g.rows.map((row) => (
                        <SectionTile key={row.sectionId} row={row} date={data.date} />
                      ))}
                    </div>
                  </div>
                ))}

                <Pagination
                  page={safePage}
                  pageCount={pageCount}
                  onPageChange={setPage}
                  total={groups.length}
                  pageSize={CLASSES_PER_PAGE}
                  className="pt-1"
                />
              </div>
            ) : (
              <DataTable
                columns={columns}
                data={visibleRows}
                pageSize={ROWS_PER_PAGE}
                page={safePage}
                onPageChange={setPage}
                rowKey={(r) => `${r.classId}-${r.sectionId}`}
                defaultSort={{ key: 'className', direction: 'asc' }}
                isRowFlagged={(r) => stateOf(r) === 'pending'}
                // Every row navigates, not just pending ones — DataTable paints
                // the same hover/pointer affordance on all of them, and opening
                // an already-taken register to check it is just as useful.
                onRowClick={(r) =>
                  router.push(
                    `/dashboard/attendance?classId=${r.classId}&sectionId=${r.sectionId}&date=${data.date}`,
                  )
                }
                emptyMessage="No classes to report on"
              />
            )}
          </>
        )}
      </PanelBody>
    </Panel>
  );
}
