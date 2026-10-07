'use client';

import * as React from 'react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import Papa from 'papaparse';
import { useLocale, useTranslations } from 'next-intl';
import { INTL_LOCALE, type Locale } from '@/i18n/config';
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
  DOCUMENT_OWNERS,
  DOCUMENT_TYPES,
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
  'STUDENT',
  'TEACHER',
  'SUB_ADMIN',
  'ADMIN',
  'HR_ADMIN',
  'LIBRARIAN',
  'GUARD',
] as const;

const OWNER_OPTIONS: PersonDocumentOwner[] = DOCUMENT_OWNERS;

interface ClassOption {
  id: number;
  name: string;
}

export default function DocumentTracePage() {
  const t = useTranslations('students.trace');
  const td = useTranslations('students.doc');
  const tc = useTranslations('common');
  const tr = useTranslations('nav.role');
  const locale = useLocale() as Locale;
  const intl = INTL_LOCALE[locale];
  const docLabel = (v: PersonDocumentType) => td(`type.${v}`);
  const ownerLabel = (v: PersonDocumentOwner) => td(`owner.${v}`);
  const statusLabel = (v: PersonDocumentStatus) => td(`status.${v}`);
  const humanRole = (role: string | null): string => {
    if (!role) return '—';
    const key = role as Parameters<typeof tr>[0];
    if (tr.has(key)) return tr(key);
    const spaced = role.replace(/_/g, ' ').toLowerCase();
    return spaced.charAt(0).toUpperCase() + spaced.slice(1);
  };
  const className = (list: ClassOption[], classId: number | null): string => {
    if (!classId) return '';
    return list.find((c) => c.id === classId)?.name ?? t('classFallback', { id: classId });
  };
  const personName = (row: PersonDocumentReportRow): string => {
    const name = [row.firstName, row.lastName].filter(Boolean).join(' ').trim();
    return name || t('userFallback', { id: row.userId });
  };
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
        setError(err.message || t('loadFailed'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [page, scope, status, t]);

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
        [t('col.person')]: personName(row),
        [t('col.role')]: humanRole(row.role),
        [tc('field.class')]: className(classes, row.classId),
        [t('col.document')]: docLabel(row.docType),
        [t('col.belongsTo')]: ownerLabel(row.owner),
        [tc('field.status')]: statusLabel(row.status),
        [t('col.file')]: row.fileName ?? '',
        [t('col.note')]: row.notes ?? '',
        [t('col.updated')]: new Date(row.updatedAt).toLocaleDateString(intl),
      })),
    );
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `document-trace-page-${page}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success(t('exported', { count: rows.length }));
  };

  const columns: Column<PersonDocumentReportRow>[] = [
    {
      key: 'person',
      header: t('col.person'),
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
      header: t('col.role'),
      card: 'meta',
      hideBelow: 'lg',
      accessor: (row) => humanRole(row.role),
    },
    {
      key: 'class',
      header: tc('field.class'),
      card: 'meta',
      hideBelow: 'lg',
      accessor: (row) => className(classes, row.classId) || '—',
    },
    {
      key: 'docType',
      header: t('col.document'),
      card: 'field',
      sortable: true,
      sortValue: (row) => docLabel(row.docType),
      accessor: (row) => docLabel(row.docType),
    },
    {
      key: 'owner',
      header: t('col.belongsTo'),
      card: 'field',
      accessor: (row) => ownerLabel(row.owner),
    },
    {
      key: 'status',
      header: tc('field.status'),
      card: 'trailing',
      render: (row) => (
        <StatusChip status={row.status} label={statusLabel(row.status)} />
      ),
    },
    {
      key: 'notes',
      header: t('col.note'),
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
      header: t('col.updated'),
      card: 'field',
      align: 'right',
      sortable: true,
      sortValue: (row) => row.updatedAt,
      accessor: (row) => new Date(row.updatedAt).toLocaleDateString(intl),
    },
  ];

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <PageShell>
      <PageHeader
        section={t('section')}
        title={t('title')}
        description={t('description')}
        actions={
          <Button variant="outline" onClick={exportPage} disabled={rows.length === 0}>
            <Download />
            {t('exportPage')}
          </Button>
        }
      />

      <PageBody>
        {/* ── The three figures worth reading before the list ── */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <StatTile
            label={t('tile.pending')}
            value={tally ? tally.PENDING.toLocaleString(intl) : '—'}
            hint={t('tile.pendingHint')}
            pigment="attn"
            onClick={() => setStatus('PENDING')}
          />
          <StatTile
            label={t('tile.collected')}
            value={tally ? tally.COLLECTED.toLocaleString(intl) : '—'}
            hint={t('tile.collectedHint')}
            pigment="success"
            onClick={() => setStatus('COLLECTED')}
          />
          <StatTile
            label={t('tile.uploaded')}
            value={tally ? tally.UPLOADED.toLocaleString(intl) : '—'}
            hint={t('tile.uploadedHint')}
            pigment="info"
            onClick={() => setStatus('UPLOADED')}
          />
        </div>

        <FilterBar
          actions={
            <Button variant="ghost" size="sm" onClick={resetFilters}>
              <RotateCcw />
              {tc('action.reset')}
            </Button>
          }
        >
          <FilterField label={tc('field.status')} width="md">
            <Select
              value={status}
              onChange={(e) => setStatus(e.target.value as PersonDocumentStatus | '')}
              aria-label={tc('field.status')}
            >
              <option value="">{t('filter.anyStatus')}</option>
              <option value="PENDING">{statusLabel('PENDING')}</option>
              <option value="COLLECTED">{statusLabel('COLLECTED')}</option>
              <option value="UPLOADED">{statusLabel('UPLOADED')}</option>
            </Select>
          </FilterField>

          <FilterField label={t('col.document')} width="lg">
            <Select
              value={docType}
              onChange={(e) => setDocType(e.target.value as PersonDocumentType | '')}
              aria-label={t('filter.documentType')}
            >
              <option value="">{t('filter.anyDocument')}</option>
              {DOCUMENT_TYPES.map((d) => (
                <option key={d.value} value={d.value}>
                  {docLabel(d.value)}
                </option>
              ))}
            </Select>
          </FilterField>

          <FilterField label={t('col.belongsTo')} width="md">
            <Select
              value={owner}
              onChange={(e) => setOwner(e.target.value as PersonDocumentOwner | '')}
              aria-label={t('col.belongsTo')}
            >
              <option value="">{t('filter.anyone')}</option>
              {OWNER_OPTIONS.map((o) => (
                <option key={o} value={o}>
                  {ownerLabel(o)}
                </option>
              ))}
            </Select>
          </FilterField>

          <FilterField label={t('col.role')} width="md">
            <Select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              aria-label={t('col.role')}
            >
              <option value="">{t('filter.everyone')}</option>
              {ROLE_OPTIONS.map((r) => (
                <option key={r} value={r}>
                  {t(`roleOption.${r}`)}
                </option>
              ))}
            </Select>
          </FilterField>

          <FilterField label={tc('field.class')} width="md">
            <Select
              value={classId}
              onChange={(e) => setClassId(e.target.value)}
              aria-label={tc('field.class')}
            >
              <option value="">{t('filter.allClasses')}</option>
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
              <TableTitle>{t('tableTitle')}</TableTitle>
              <TableCount>{total.toLocaleString(intl)}</TableCount>
            </>
          }
          empty={
            <EmptyState
              icon={<FileSearch />}
              title={t('empty.title')}
              description={
                status === 'PENDING'
                  ? t('empty.pending')
                  : t('empty.filtered')
              }
              action={
                <Button variant="outline" onClick={resetFilters}>
                  {t('empty.reset')}
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
