'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import useSWR from 'swr';
import toast, { Toaster } from 'react-hot-toast';
import {
  Download,
  GraduationCap,
  IdCard as IdCardIcon,
  ImageOff,
  Lock,
  Printer,
  ScanLine,
  Users,
  X,
} from 'lucide-react';

import { fetcher } from '@/lib/api';
import { useRbac } from '@/lib/rbac';
import {
  ID_CARD_PAGE_SIZES,
  IdCardApiError,
  fetchStaffIdCards,
  fetchStudentIdCards,
  idCardKey,
  idCardRoleLine,
  type IdCardBatch,
  type IdCardRow,
} from '@/lib/id-card-api';
import { CARDS_PER_SHEET, downloadIdCardBatchPdf } from '@/lib/id-card-pdf';
import IdCardPreview from '@/components/id-cards/IdCardPreview';

import { PageBody, PageHeader, PageShell } from '@/components/ui/PageHeader';
import { Note, Panel, PanelBody, PanelHeader } from '@/components/ui/Panel';
import { Column, DataTable, TableCount } from '@/components/ui/DataTable';
import {
  FilterBar,
  FilterField,
  PageTabs,
  Pagination,
  SearchInput,
} from '@/components/ui/FilterBar';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/Field';
import { StatusChip } from '@/components/ui/StatusChip';
import { EmptyState } from '@/components/ui/EmptyState';

/* ═══════════════════════════════════════════════════════════════════════════
   ID CARDS

   One screen for a job that happens twice a year and has to go right the
   first time: pick a class, look at the card, print the sheet.

   The preview is not a nicety. A print run is a stack of PVC blanks that
   cannot be un-printed, so the operator sees the actual artifact — at actual
   size, both faces — before anything is committed.
   ═══════════════════════════════════════════════════════════════════════════ */

type Tab = 'students' | 'staff';

interface NamedRecord {
  id: number;
  name: string;
}

/** Photo links are presigned for 15 minutes; warn a little before they lapse. */
const PHOTO_LINK_WARN_MS = 12 * 60 * 1000;

interface SelectedCard {
  row: IdCardRow;
  /** When this row was fetched — its photo link ages from here. */
  at: number;
}

export default function IdCardsPage() {
  const router = useRouter();
  const rbac = useRbac();

  const [tab, setTab] = React.useState<Tab>('students');

  // Filters
  const [classId, setClassId] = React.useState<number | null>(null);
  const [sectionId, setSectionId] = React.useState<number | null>(null);
  const [departmentInput, setDepartmentInput] = React.useState('');
  const [department, setDepartment] = React.useState('');
  const [nameFilter, setNameFilter] = React.useState('');

  // Paging
  const [page, setPage] = React.useState(1);
  const [limit, setLimit] = React.useState<number>(50);

  // Selection and preview
  const [selected, setSelected] = React.useState<Record<string, SelectedCard>>({});
  const [previewKey, setPreviewKey] = React.useState<string | null>(null);
  const [progress, setProgress] = React.useState<{ done: number; total: number } | null>(
    null,
  );

  const previewRef = React.useRef<HTMLDivElement | null>(null);

  /* ── Access ──────────────────────────────────────────────────────────── */
  React.useEffect(() => {
    if (rbac.role && !rbac.isSubAdmin) router.replace('/dashboard');
  }, [rbac.role, rbac.isSubAdmin, router]);

  /* ── Filter options ──────────────────────────────────────────────────── */
  const { data: classes } = useSWR<NamedRecord[]>('/classes/names-only', fetcher);
  const { data: sections } = useSWR<NamedRecord[]>(
    classId ? `/classes/${classId}/sections` : null,
    fetcher,
  );

  /* The department filter runs on the server (ILIKE), so it is debounced —
     one request per pause, not one per keystroke. */
  React.useEffect(() => {
    const id = setTimeout(() => {
      setDepartment(departmentInput.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(id);
  }, [departmentInput]);

  /* ── The batch ───────────────────────────────────────────────────────── */
  const {
    data: batch,
    error: batchError,
    isLoading,
  } = useSWR<IdCardBatch>(
    ['id-cards', tab, classId, sectionId, department, page, limit] as const,
    () =>
      tab === 'students'
        ? fetchStudentIdCards({ classId, sectionId, page, limit })
        : fetchStaffIdCards({ department, page, limit }),
    // Paging should not blank the register out from under the operator.
    { keepPreviousData: true },
  );

  const featureOff =
    batchError instanceof IdCardApiError && batchError.featureDisabled;
  const errorMessage =
    batchError && !featureOff
      ? batchError instanceof Error
        ? batchError.message
        : 'Could not load ID cards'
      : null;

  /* ── A clock, only precise enough to age a 15-minute link ────────────── */
  const [now, setNow] = React.useState(0);
  React.useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  /* ── Derived ─────────────────────────────────────────────────────────── */
  const rows = React.useMemo(() => {
    const all = batch?.rows ?? [];
    const q = nameFilter.trim().toLowerCase();
    if (!q) return all;
    return all.filter((r) => r.name.toLowerCase().includes(q));
  }, [batch, nameFilter]);

  const school = batch?.school ?? null;
  const total = batch?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / limit));

  const selectedList = React.useMemo(
    () => Object.values(selected).map((s) => s.row),
    [selected],
  );
  const selectedCount = selectedList.length;

  const printList = selectedCount > 0 ? selectedList : rows;
  const sheetCount = Math.ceil(printList.length / CARDS_PER_SHEET);
  const withoutPhoto = printList.filter((r) => !r.photoUrl).length;

  const oldestSelection = React.useMemo(() => {
    const times = Object.values(selected).map((s) => s.at);
    return times.length > 0 ? Math.min(...times) : null;
  }, [selected]);
  const linksMayHaveLapsed =
    oldestSelection !== null && now - oldestSelection > PHOTO_LINK_WARN_MS;

  // The preview follows the register: whatever was last tapped, else the top
  // of the list — so it is never an empty box while rows are on screen.
  const previewRow =
    rows.find((r) => idCardKey(r) === previewKey) ??
    selectedList.find((r) => idCardKey(r) === previewKey) ??
    rows[0] ??
    null;

  const pageAllSelected =
    rows.length > 0 && rows.every((r) => selected[idCardKey(r)] !== undefined);

  /* ── Selection ───────────────────────────────────────────────────────── */
  const toggleRow = React.useCallback((row: IdCardRow) => {
    const key = idCardKey(row);
    setSelected((current) => {
      const next = { ...current };
      if (next[key]) delete next[key];
      else next[key] = { row, at: Date.now() };
      return next;
    });
  }, []);

  const toggleAllOnPage = React.useCallback(() => {
    setSelected((current) => {
      const next = { ...current };
      const everySelected = rows.every((r) => next[idCardKey(r)] !== undefined);
      for (const row of rows) {
        const key = idCardKey(row);
        if (everySelected) delete next[key];
        else next[key] = { row, at: Date.now() };
      }
      return next;
    });
  }, [rows]);

  /* ── Print ───────────────────────────────────────────────────────────── */
  const buildPdf = async (cards: IdCardRow[]) => {
    if (!school || cards.length === 0) return;
    setProgress({ done: 0, total: cards.length });
    try {
      const sheets = await downloadIdCardBatchPdf(cards, school, {
        onProgress: (done, totalRows) => setProgress({ done, total: totalRows }),
      });
      toast.success(
        `${cards.length} card${cards.length === 1 ? '' : 's'} on ${sheets} sheet${
          sheets === 1 ? '' : 's'
        } — fronts and backs`,
      );
    } catch {
      toast.error('Could not build the PDF. Try a smaller batch.');
    } finally {
      setProgress(null);
    }
  };

  const openPreview = React.useCallback((row: IdCardRow) => {
    setPreviewKey(idCardKey(row));
    // On a phone the preview sits below the register — take the operator to it.
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      previewRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, []);

  const changeTab = (next: Tab) => {
    setTab(next);
    setPage(1);
    setNameFilter('');
    setPreviewKey(null);
  };

  /* ── Columns ─────────────────────────────────────────────────────────── */
  const selectColumn: Column<IdCardRow> = {
    key: 'select',
    header: '',
    width: 'w-10',
    card: 'trailing',
    render: (row) => (
      <input
        type="checkbox"
        checked={selected[idCardKey(row)] !== undefined}
        onChange={() => toggleRow(row)}
        onClick={(e) => e.stopPropagation()}
        aria-label={`Include ${row.name} in the print run`}
        className="size-4 cursor-pointer align-middle"
      />
    ),
  };

  const nameColumn: Column<IdCardRow> = {
    key: 'name',
    header: 'Name',
    sortable: true,
    card: 'title',
    sortValue: (row) => row.name,
    render: (row) => (
      <div className="flex min-w-0 items-center gap-2.5">
        <PhotoDot row={row} />
        <span className="truncate font-semibold text-ink">{row.name}</span>
      </div>
    ),
  };

  const roleColumn: Column<IdCardRow> = {
    key: 'role',
    header: tab === 'students' ? 'Class' : 'Designation',
    card: 'meta',
    sortable: true,
    sortValue: (row) => idCardRoleLine(row),
    accessor: (row) => idCardRoleLine(row),
  };

  const bloodColumn: Column<IdCardRow> = {
    key: 'blood',
    header: 'Blood',
    align: 'center',
    hideBelow: 'lg',
    render: (row) =>
      row.bloodGroup ? (
        <span className="tabular text-[12.5px] font-semibold text-ink">
          {row.bloodGroup}
        </span>
      ) : (
        <span className="text-[12.5px] text-ink-faint">—</span>
      ),
  };

  const photoColumn: Column<IdCardRow> = {
    key: 'photo',
    header: 'Photo',
    align: 'center',
    render: (row) =>
      row.photoUrl ? (
        <StatusChip status="On file" pigment="success" />
      ) : (
        <StatusChip status="Missing" pigment="attn" />
      ),
  };

  const columns: Column<IdCardRow>[] =
    tab === 'students'
      ? [
          selectColumn,
          nameColumn,
          roleColumn,
          {
            key: 'roll',
            header: 'Roll',
            align: 'right',
            hideBelow: 'md',
            sortable: true,
            sortValue: (row) => row.rollNo ?? null,
            render: (row) => <span className="tabular text-ink">{row.rollNo ?? '—'}</span>,
          },
          {
            key: 'guardian',
            header: 'Guardian',
            hideBelow: 'xl',
            accessor: (row) => row.fathersName ?? row.guardianName ?? '—',
          },
          bloodColumn,
          photoColumn,
        ]
      : [
          selectColumn,
          nameColumn,
          roleColumn,
          {
            key: 'department',
            header: 'Department',
            hideBelow: 'md',
            sortable: true,
            sortValue: (row) => row.department ?? '',
            accessor: (row) => row.department ?? '—',
          },
          {
            key: 'code',
            header: 'Emp code',
            align: 'right',
            hideBelow: 'lg',
            sortable: true,
            sortValue: (row) => row.employeeCode ?? null,
            render: (row) => (
              <span className="tabular text-ink">{row.employeeCode ?? '—'}</span>
            ),
          },
          bloodColumn,
          photoColumn,
        ];

  /* ── Not on this school's plan ───────────────────────────────────────── */
  if (featureOff) {
    return (
      <PageShell>
        <PageHeader section="Identity" title="ID cards" />
        <PageBody>
          <Panel>
            <PanelBody>
              <EmptyState
                icon={<Lock />}
                title="ID cards are switched off for your school"
                description="The module exists but nobody has enabled it yet. Your super admin can turn it on from Billing, or write to support@appme.in and we will do it."
              />
            </PanelBody>
          </Panel>
        </PageBody>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <Toaster position="top-center" />

      <PageHeader
        section="Identity"
        title="ID cards"
        description="Pick who needs a card, check the artwork, print the sheet."
        actions={
          <>
            <Button variant="outline" size="md" render={<Link href="/dashboard/pickup/scan" />}>
              <ScanLine className="size-4" aria-hidden />
              Verify a card
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={() => void buildPdf(printList)}
              disabled={!school || printList.length === 0 || progress !== null}
            >
              {progress ? (
                <>
                  <span className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  {progress.done}/{progress.total}
                </>
              ) : (
                <>
                  <Download className="size-4" aria-hidden />
                  Download PDF
                </>
              )}
            </Button>
          </>
        }
        meta={
          <>
            <span className="eyebrow">
              {selectedCount > 0 ? `${selectedCount} selected` : `${rows.length} on this page`}
            </span>
            {printList.length > 0 && (
              <span className="tabular rounded-full border border-line bg-surface px-2 py-0.5 text-[11.5px] text-ink-muted">
                {sheetCount} A4 sheet{sheetCount === 1 ? '' : 's'} · {sheetCount * 2} sides
              </span>
            )}
            {selectedCount > 0 && (
              <button
                type="button"
                onClick={() => setSelected({})}
                className="inline-flex cursor-pointer items-center gap-1 text-[12px] font-medium text-ink-muted underline-offset-4 hover:text-brand hover:underline"
              >
                <X className="size-3" aria-hidden />
                Clear selection
              </button>
            )}
          </>
        }
        tabs={
          <PageTabs<Tab>
            value={tab}
            onValueChange={changeTab}
            options={[
              { value: 'students', label: 'Students', icon: <GraduationCap /> },
              { value: 'staff', label: 'Staff', icon: <Users /> },
            ]}
          />
        }
      />

      <PageBody>
        <FilterBar>
          {tab === 'students' ? (
            <>
              <FilterField label="Class" width="md">
                <Select
                  value={classId ?? ''}
                  onChange={(e) => {
                    setClassId(e.target.value ? Number(e.target.value) : null);
                    setSectionId(null);
                    setPage(1);
                  }}
                >
                  <option value="">All classes</option>
                  {(classes ?? []).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </FilterField>
              <FilterField label="Section" width="sm">
                <Select
                  value={sectionId ?? ''}
                  disabled={!classId}
                  onChange={(e) => {
                    setSectionId(e.target.value ? Number(e.target.value) : null);
                    setPage(1);
                  }}
                >
                  <option value="">All</option>
                  {(sections ?? []).map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </Select>
              </FilterField>
            </>
          ) : (
            <FilterField label="Department" width="lg">
              <input
                type="text"
                value={departmentInput}
                onChange={(e) => setDepartmentInput(e.target.value)}
                placeholder="Any department"
                list="id-card-departments"
                className="h-11 w-full rounded-md border border-line-strong bg-surface px-3 text-[14px] text-ink transition-colors placeholder:text-ink-faint focus:border-brand focus:ring-3 focus:ring-brand/16 focus:outline-none sm:h-10"
              />
              {/* Suggestions come from what this school actually uses — there
                  is no departments endpoint, and inventing a fixed list would
                  be wrong for most schools. */}
              <datalist id="id-card-departments">
                {Array.from(
                  new Set(
                    (batch?.rows ?? [])
                      .map((r) => r.department)
                      .filter((d): d is string => Boolean(d)),
                  ),
                ).map((d) => (
                  <option key={d} value={d} />
                ))}
              </datalist>
            </FilterField>
          )}

          <FilterField label="Rows per page" width="sm">
            <Select
              value={limit}
              onChange={(e) => {
                setLimit(Number(e.target.value));
                setPage(1);
              }}
            >
              {ID_CARD_PAGE_SIZES.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </Select>
          </FilterField>

          <FilterField label="Find on this page" width="lg">
            <SearchInput
              value={nameFilter}
              onValueChange={setNameFilter}
              placeholder="Name…"
              className="sm:max-w-none"
            />
          </FilterField>
        </FilterBar>

        {/* 100 a page is the server's cap: every row costs one signed photo
            link. Saying so beats letting somebody wonder why it stops there. */}
        {limit === 100 && (
          <Note pigment="info">
            100 cards a page is the maximum — each one needs a fresh, signed
            photo link. Select across pages to build a longer run.
          </Note>
        )}

        {linksMayHaveLapsed && (
          <Note pigment="attn" title="Some photo links may have expired">
            Photo links last about fifteen minutes. Reload the page and select
            again if you want portraits rather than initials.
          </Note>
        )}

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px] xl:grid-cols-[minmax(0,1fr)_430px]">
          <div className="min-w-0">
            <DataTable<IdCardRow>
              columns={columns}
              data={rows}
              loading={isLoading}
              error={errorMessage}
              rowKey={(row) => idCardKey(row)}
              onRowClick={openPreview}
              isRowSelected={(row) => selected[idCardKey(row)] !== undefined}
              isRowFlagged={(row) => !row.photoUrl}
              emptyMessage={
                tab === 'students'
                  ? 'No students match these filters'
                  : 'No staff match this department'
              }
              toolbar={
                <>
                  <label className="flex cursor-pointer items-center gap-2 text-[13px] font-medium text-ink">
                    <input
                      type="checkbox"
                      checked={pageAllSelected}
                      onChange={toggleAllOnPage}
                      disabled={rows.length === 0}
                      className="size-4 cursor-pointer"
                    />
                    Select this page
                  </label>
                  <TableCount>{rows.length}</TableCount>
                  {withoutPhoto > 0 && (
                    <span className="inline-flex items-center gap-1.5 text-[12px] text-accent-warn-deep">
                      <ImageOff className="size-3.5" aria-hidden />
                      {withoutPhoto} without a photo — these print with initials
                    </span>
                  )}
                </>
              }
              footer={
                <Pagination
                  page={page}
                  pageCount={pageCount}
                  onPageChange={setPage}
                  total={total}
                  pageSize={limit}
                />
              }
            />
          </div>

          {/* ── The artifact ───────────────────────────────────────────── */}
          <aside ref={previewRef} className="min-w-0 lg:sticky lg:top-4 lg:self-start">
            <Panel>
              <PanelHeader
                title="Card preview"
                description={
                  previewRow
                    ? 'Exactly what gets printed, at actual size.'
                    : 'Choose someone from the register.'
                }
              />
              <PanelBody className="space-y-3">
                {previewRow && school ? (
                  <>
                    <IdCardPreview
                      key={idCardKey(previewRow)}
                      row={previewRow}
                      school={school}
                    />
                    <div className="flex flex-wrap gap-2 border-t border-line pt-3">
                      <Button variant="outline" size="sm" onClick={() => toggleRow(previewRow)}>
                        {selected[idCardKey(previewRow)] ? 'Remove from run' : 'Add to run'}
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => void buildPdf([previewRow])}
                        disabled={progress !== null}
                      >
                        <Printer className="size-3.5" aria-hidden />
                        Just this one
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="py-8">
                    <EmptyState
                      icon={<IdCardIcon />}
                      title="Nothing to preview"
                      description="Pick a class, then tap anyone in the list."
                    />
                  </div>
                )}
              </PanelBody>
            </Panel>

            <Panel className="mt-4">
              <PanelHeader title="Before you print" />
              <PanelBody>
                <ul className="space-y-2 text-[12.5px] text-ink-muted">
                  <li className="flex gap-2">
                    <span className="mt-1.5 size-1 shrink-0 rounded-full bg-brand" />
                    Ten cards to an A4 sheet, butted edge to edge — one cut serves
                    the two cards either side of it.
                  </li>
                  <li className="flex gap-2">
                    <span className="mt-1.5 size-1 shrink-0 rounded-full bg-brand" />
                    Fronts and backs alternate as whole pages. Print double sided,
                    flipping on the <strong className="text-ink">long edge</strong>.
                  </li>
                  <li className="flex gap-2">
                    <span className="mt-1.5 size-1 shrink-0 rounded-full bg-brand" />
                    Set scaling to 100%. &quot;Fit to page&quot; shrinks the cards
                    out of standard size.
                  </li>
                </ul>
              </PanelBody>
            </Panel>
          </aside>
        </div>
      </PageBody>
    </PageShell>
  );
}

/**
 * A thumbnail in the register. Deliberately tiny — it answers "is there a
 * photo, and is it the right person", nothing more; the preview does the rest.
 */
function PhotoDot({ row }: { row: IdCardRow }) {
  const [failed, setFailed] = React.useState(false);

  if (row.photoUrl && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={row.photoUrl}
        alt=""
        onError={() => setFailed(true)}
        className="size-7 shrink-0 rounded-md border border-line object-cover"
      />
    );
  }

  return (
    <span className="grid size-7 shrink-0 place-items-center rounded-md border border-dashed border-line-strong bg-surface-secondary text-[9px] font-semibold text-ink-faint">
      {row.name
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part[0] ?? '')
        .join('')
        .toUpperCase() || '?'}
    </span>
  );
}
