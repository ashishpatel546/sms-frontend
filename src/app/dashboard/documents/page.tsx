'use client';

import * as React from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import Papa from 'papaparse';
import { Download, FileSearch, RotateCcw } from 'lucide-react';
import { API_BASE_URL } from '@/lib/api';
import { authFetch } from '@/lib/auth';
import { sortByName } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { DataTable, TableCount, TableTitle, type Column } from '@/components/ui/DataTable';
import { EmptyState } from '@/components/ui/EmptyState';
import { FilterBar, FilterField, Pagination } from '@/components/ui/FilterBar';
import { Select } from '@/components/ui/Field';
import { PageBody, PageHeader, PageShell } from '@/components/ui/PageHeader';
import { StatTile } from '@/components/ui/StatTile';
import { StatusChip } from '@/components/ui/StatusChip';
import {
  DOCUMENT_STATUS_LABEL,
  DOCUMENT_TYPES,
  DOCUMENT_TYPE_LABEL,
  OWNER_LABEL,
  getPersonDocumentReport,
  type PersonDocumentOwner,
  type PersonDocumentReportRow,
  type PersonDocumentStatus,
  type PersonDocumentType,
} from '@/lib/person-documents-api';

/* ═══════════════════════════════════════════════════════════════════════════
   THE DOCUMENT TRACE

   One question, asked across the whole school: which papers are we still
   waiting for? The office chases these by class and by family, so the filters
   are class and role first, document type second.

   Pending leads the sort because a settled row is not why anyone opens this.
   ═══════════════════════════════════════════════════════════════════════════ */

const PAGE_SIZE = 25;

const ROLE_OPTIONS = [
  { value: 'STUDENT', label: 'Students' },
  { value: 'TEACHER', label: 'Teachers' },
  { value: 'SUB_ADMIN', label: 'Sub admins' },
  { value: 'ADMIN', label: 'Admins' },
  { value: 'HR_ADMIN', label: 'HR admins' },
  { value: 'LIBRARIAN', label: 'Librarians' },
  { value: 'GUARD', label: 'Guards' },
];

const OWNER_OPTIONS: PersonDocumentOwner[] = ['SELF', 'FATHER', 'MOTHER', 'GUARDIAN'];

interface ClassOption {
  id: number;
  name: string;
}

export default function DocumentTracePage() {
  const [status, setStatus] = React.useState<PersonDocumentStatus | ''>('PENDING');
  const [docType, setDocType] = React.useState<PersonDocumentType | ''>('');
  const [owner, setOwner] = React.useState<PersonDocumentOwner | ''>('');
  const [role, setRole] = React.useState('');
  const [classId, setClassId] = React.useState('');
  const [page, setPage] = React.useState(1);

  const [rows, setRows] = React.useState<PersonDocumentReportRow[]>([]);
  const [total, setTotal] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [classes, setClasses] = React.useState<ClassOption[]>([]);
  const [tally, setTally] = React.useState<Record<PersonDocumentStatus, number> | null>(
    null,
  );

  /* Classes power the "chase this section" filter the office actually uses. */
  React.useEffect(() => {
    let cancelled = false;
    authFetch(`${API_BASE_URL}/classes`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data: ClassOption[]) => {
        if (!cancelled) setClasses(sortByName(Array.isArray(data) ? data : []));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  /* Filters other than status — shared by the table and the tally. */
  const scope = React.useMemo(
    () => ({
      docType: docType || undefined,
      owner: owner || undefined,
      role: role || undefined,
      classId: classId ? Number(classId) : undefined,
    }),
    [classId, docType, owner, role],
  );

  React.useEffect(() => {
    setPage(1);
  }, [scope, status]);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    getPersonDocumentReport({
      ...scope,
      status: status || undefined,
      page,
      limit: PAGE_SIZE,
    })
      .then((result) => {
        if (cancelled) return;
        setRows(result.data);
        setTotal(result.total);
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setRows([]);
        setTotal(0);
        setError(err.message || 'The trace did not load.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [page, scope, status]);

  /**
   * The tally asks for one row per status purely to read `total` back — three
   * cheap counts rather than a fourth endpoint.
   */
  React.useEffect(() => {
    let cancelled = false;
    const statuses: PersonDocumentStatus[] = ['PENDING', 'COLLECTED', 'UPLOADED'];

    Promise.all(
      statuses.map((s) =>
        getPersonDocumentReport({ ...scope, status: s, page: 1, limit: 1 })
          .then((r) => r.total)
          .catch(() => 0),
      ),
    ).then(([pending, collected, uploaded]) => {
      if (cancelled) return;
      setTally({ PENDING: pending, COLLECTED: collected, UPLOADED: uploaded });
    });

    return () => {
      cancelled = true;
    };
  }, [scope]);

  const resetFilters = () => {
    setStatus('PENDING');
    setDocType('');
    setOwner('');
    setRole('');
    setClassId('');
    setPage(1);
  };

  const exportPage = () => {
    if (rows.length === 0) return;
    const csv = Papa.unparse(
      rows.map((row) => ({
        Person: personName(row),
        Role: humanRole(row.role),
        Class: className(classes, row.classId),
        Document: DOCUMENT_TYPE_LABEL[row.docType] ?? row.docType,
        Belongs_to: OWNER_LABEL[row.owner] ?? row.owner,
        Status: DOCUMENT_STATUS_LABEL[row.status] ?? row.status,
        File: row.fileName ?? '',
        Note: row.notes ?? '',
        Updated: new Date(row.updatedAt).toLocaleDateString('en-IN'),
      })),
    );
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `document-trace-page-${page}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success(`${rows.length} rows exported.`);
  };

  const columns: Column<PersonDocumentReportRow>[] = [
    {
      key: 'person',
      header: 'Person',
      card: 'title',
      sortable: true,
      sortValue: (row) => personName(row),
      render: (row) =>
        row.studentId ? (
          <Link
            href={`/dashboard/students/${row.studentId}`}
            className="font-semibold text-brand hover:underline"
          >
            {personName(row)}
          </Link>
        ) : (
          <span className="font-semibold text-ink">{personName(row)}</span>
        ),
    },
    {
      key: 'role',
      header: 'Role',
      card: 'meta',
      hideBelow: 'lg',
      accessor: (row) => humanRole(row.role),
    },
    {
      key: 'class',
      header: 'Class',
      card: 'meta',
      hideBelow: 'lg',
      accessor: (row) => className(classes, row.classId) || '—',
    },
    {
      key: 'docType',
      header: 'Document',
      card: 'field',
      sortable: true,
      sortValue: (row) => DOCUMENT_TYPE_LABEL[row.docType] ?? row.docType,
      accessor: (row) => DOCUMENT_TYPE_LABEL[row.docType] ?? row.docType,
    },
    {
      key: 'owner',
      header: 'Belongs to',
      card: 'field',
      accessor: (row) => OWNER_LABEL[row.owner] ?? row.owner,
    },
    {
      key: 'status',
      header: 'Status',
      card: 'trailing',
      render: (row) => (
        <StatusChip status={row.status} label={DOCUMENT_STATUS_LABEL[row.status]} />
      ),
    },
    {
      key: 'notes',
      header: 'Note',
      card: 'field',
      hideBelow: 'xl',
      render: (row) =>
        row.notes ? (
          <span className="line-clamp-2 text-ink-muted">{row.notes}</span>
        ) : row.fileName ? (
          <span className="text-ink-faint">{row.fileName}</span>
        ) : (
          <span className="text-ink-faint">—</span>
        ),
    },
    {
      key: 'updatedAt',
      header: 'Updated',
      card: 'field',
      align: 'right',
      sortable: true,
      sortValue: (row) => row.updatedAt,
      accessor: (row) => new Date(row.updatedAt).toLocaleDateString('en-IN'),
    },
  ];

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <PageShell>
      <PageHeader
        section="Records · Documents"
        title="Document trace"
        description="Every document the school has asked for, and whether it has arrived."
        actions={
          <Button variant="outline" onClick={exportPage} disabled={rows.length === 0}>
            <Download />
            Export this page
          </Button>
        }
      />

      <PageBody>
        {/* ── The three figures worth reading before the list ── */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <StatTile
            label="Still to collect"
            value={tally ? tally.PENDING.toLocaleString('en-IN') : '—'}
            hint="Listed as pending"
            pigment="attn"
            onClick={() => setStatus('PENDING')}
          />
          <StatTile
            label="Held on paper"
            value={tally ? tally.COLLECTED.toLocaleString('en-IN') : '—'}
            hint="Collected, no scan stored"
            pigment="success"
            onClick={() => setStatus('COLLECTED')}
          />
          <StatTile
            label="Scanned"
            value={tally ? tally.UPLOADED.toLocaleString('en-IN') : '—'}
            hint="A file is on file"
            pigment="info"
            onClick={() => setStatus('UPLOADED')}
          />
        </div>

        <FilterBar
          actions={
            <Button variant="ghost" size="sm" onClick={resetFilters}>
              <RotateCcw />
              Reset
            </Button>
          }
        >
          <FilterField label="Status" width="md">
            <Select
              value={status}
              onChange={(e) => setStatus(e.target.value as PersonDocumentStatus | '')}
              aria-label="Status"
            >
              <option value="">Any status</option>
              <option value="PENDING">Pending</option>
              <option value="COLLECTED">Collected</option>
              <option value="UPLOADED">On file</option>
            </Select>
          </FilterField>

          <FilterField label="Document" width="lg">
            <Select
              value={docType}
              onChange={(e) => setDocType(e.target.value as PersonDocumentType | '')}
              aria-label="Document type"
            >
              <option value="">Any document</option>
              {DOCUMENT_TYPES.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </Select>
          </FilterField>

          <FilterField label="Belongs to" width="md">
            <Select
              value={owner}
              onChange={(e) => setOwner(e.target.value as PersonDocumentOwner | '')}
              aria-label="Belongs to"
            >
              <option value="">Anyone</option>
              {OWNER_OPTIONS.map((o) => (
                <option key={o} value={o}>
                  {OWNER_LABEL[o]}
                </option>
              ))}
            </Select>
          </FilterField>

          <FilterField label="Role" width="md">
            <Select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              aria-label="Role"
            >
              <option value="">Everyone</option>
              {ROLE_OPTIONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </Select>
          </FilterField>

          <FilterField label="Class" width="md">
            <Select
              value={classId}
              onChange={(e) => setClassId(e.target.value)}
              aria-label="Class"
            >
              <option value="">All classes</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </FilterField>
        </FilterBar>

        <DataTable
          columns={columns}
          data={rows}
          loading={loading}
          error={error}
          rowKey={(row) => row.id}
          toolbar={
            <>
              <TableTitle>Documents</TableTitle>
              <TableCount>{total.toLocaleString('en-IN')}</TableCount>
            </>
          }
          empty={
            <EmptyState
              icon={<FileSearch />}
              title="Nothing outstanding here"
              description={
                status === 'PENDING'
                  ? 'No documents are listed as pending for these filters. Documents appear here once someone lists them on a student or staff record.'
                  : 'No documents match these filters.'
              }
              action={
                <Button variant="outline" onClick={resetFilters}>
                  Reset filters
                </Button>
              }
            />
          }
          footer={
            total > 0 && (
              <Pagination
                page={page}
                pageCount={pageCount}
                onPageChange={setPage}
                total={total}
                pageSize={PAGE_SIZE}
              />
            )
          }
        />
      </PageBody>
    </PageShell>
  );
}

/* ── Cell helpers ───────────────────────────────────────────────────────── */

function personName(row: PersonDocumentReportRow): string {
  const name = [row.firstName, row.lastName].filter(Boolean).join(' ').trim();
  return name || `User ${row.userId}`;
}

function humanRole(role: string | null): string {
  if (!role) return '—';
  const spaced = role.replace(/_/g, ' ').toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function className(classes: ClassOption[], classId: number | null): string {
  if (!classId) return '';
  return classes.find((c) => c.id === classId)?.name ?? `Class ${classId}`;
}
