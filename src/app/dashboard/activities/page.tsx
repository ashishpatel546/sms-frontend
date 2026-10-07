'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import toast, { Toaster } from 'react-hot-toast';
import { PartyPopper, Plus } from 'lucide-react';

import {
  ACTIVITY_CATEGORIES,
  ACTIVITY_CATEGORY_LABELS,
  createActivity,
  errorMessage,
  fetchActivities,
  type Activity,
  type ActivityCategory,
  type ActivityStatus,
  type CreateActivityInput,
} from '@/lib/activities-api';
import { PageBody, PageHeader, PageShell } from '@/components/ui/PageHeader';
import { Column, DataTable, TableCount } from '@/components/ui/DataTable';
import { FilterBar, FilterField, SearchInput } from '@/components/ui/FilterBar';
import { Field, FieldGrid, Input, Select, Textarea } from '@/components/ui/Field';
import { Button } from '@/components/ui/button';
import { StatusChip } from '@/components/ui/StatusChip';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useRbac } from '@/lib/rbac';
import { READ_ONLY_TITLE, useReadOnlySession } from '@/lib/support-session';
import { useTranslations } from 'next-intl';

const PAGE_SIZE = 20;

export default function ActivitiesPage() {
  const router = useRouter();
  const rbac = useRbac();
  const readOnly = useReadOnlySession();
  const t = useTranslations('activities');
  const tc = useTranslations('common');
  const [status, setStatus] = React.useState<ActivityStatus | ''>('');
  const [category, setCategory] = React.useState<ActivityCategory | ''>('');
  const [search, setSearch] = React.useState('');
  const [page, setPage] = React.useState(1);
  const [creating, setCreating] = React.useState(false);

  const query = { status: status || undefined, category: category || undefined, search: search || undefined, page, limit: PAGE_SIZE };
  const { data, isLoading, mutate } = useSWR(`/activities?${JSON.stringify(query)}`, () => fetchActivities(query));

  const columns: Column<Activity>[] = [
    { key: 'title', header: t('list.colActivity'), accessor: (r) => r.title, card: 'title' },
    { key: 'category', header: t('field.category'), accessor: (r) => (r.category in ACTIVITY_CATEGORY_LABELS ? t(`category.${r.category}`) : r.category), card: 'meta' },
    { key: 'date', header: tc('field.date'), accessor: (r) => r.startDate, card: 'field' },
    { key: 'participants', header: t('list.colParticipants'), align: 'right', accessor: (r) => r.participantCount, card: 'field' },
    { key: 'photos', header: t('list.colPhotos'), align: 'right', accessor: (r) => r.photoCount, card: 'field' },
    { key: 'status', header: tc('field.status'), align: 'right', accessor: (r) => <StatusChip status={r.status} label={t(`status.${r.status}`)} />, card: 'trailing' },
  ];

  return (
    <PageShell>
      <Toaster position="top-center" />
      <PageHeader
        section={t('list.section')}
        title={t('list.title')}
        description={t('list.description')}
        actions={
          rbac.canManageActivities ? (
            <Button
              onClick={() => setCreating(true)}
              disabled={readOnly}
              title={readOnly ? READ_ONLY_TITLE : undefined}
            >
              <Plus /> {t('list.new')}
            </Button>
          ) : undefined
        }
      />

      <PageBody>
        <FilterBar>
          <SearchInput value={search} onValueChange={(v) => { setSearch(v); setPage(1); }} placeholder={t('list.searchPlaceholder')} />
          <FilterField label={tc('field.status')} width="sm">
            <Select value={status} onChange={(e) => { setStatus(e.target.value as ActivityStatus | ''); setPage(1); }}>
              <option value="">{tc('field.all')}</option>
              <option value="DRAFT">{t('status.DRAFT')}</option>
              <option value="PUBLISHED">{t('status.PUBLISHED')}</option>
              <option value="ARCHIVED">{t('status.ARCHIVED')}</option>
            </Select>
          </FilterField>
          <FilterField label={t('field.category')} width="sm">
            <Select value={category} onChange={(e) => { setCategory(e.target.value as ActivityCategory | ''); setPage(1); }}>
              <option value="">{tc('field.all')}</option>
              {ACTIVITY_CATEGORIES.map((c) => (
                <option key={c} value={c}>{t(`category.${c}`)}</option>
              ))}
            </Select>
          </FilterField>
        </FilterBar>

        <DataTable
          className="mt-4"
          columns={columns}
          data={data?.data}
          loading={isLoading}
          rowKey={(r) => r.id}
          onRowClick={(r) => router.push(`/dashboard/activities/${r.id}`)}
          emptyMessage={t('list.empty')}
          toolbar={
            <>
              <PartyPopper className="size-4 text-ink-faint" />
              <span className="font-display text-[15px] font-semibold text-ink">{t('list.title')}</span>
              {data && <TableCount>{data.total}</TableCount>}
            </>
          }
        />
        {data && data.total > PAGE_SIZE && (
          <div className="mt-3 flex justify-end gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>{tc('action.previous')}</Button>
            <Button variant="outline" size="sm" disabled={page * PAGE_SIZE >= data.total} onClick={() => setPage((p) => p + 1)}>{tc('action.next')}</Button>
          </div>
        )}
      </PageBody>

      {creating && (
        <CreateActivityDialog
          onClose={() => setCreating(false)}
          onSaved={(activity) => {
            setCreating(false);
            void mutate();
            router.push(`/dashboard/activities/${activity.id}`);
          }}
        />
      )}
    </PageShell>
  );
}

function CreateActivityDialog({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: (activity: Activity) => void;
}) {
  const t = useTranslations('activities');
  const tc = useTranslations('common');
  const [title, setTitle] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [category, setCategory] = React.useState<ActivityCategory>('OTHER');
  const [startDate, setStartDate] = React.useState('');
  const [endDate, setEndDate] = React.useState('');
  const [venue, setVenue] = React.useState('');
  const [saving, setSaving] = React.useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim() || !startDate) {
      toast.error(t('create.required'));
      return;
    }
    setSaving(true);
    try {
      const dto: CreateActivityInput = {
        title: title.trim(),
        description: description.trim(),
        category,
        startDate,
        endDate: endDate || undefined,
        venue: venue.trim() || undefined,
      };
      const activity = await createActivity(dto);
      toast.success(t('create.created'));
      onSaved(activity);
    } catch (err) {
      toast.error(errorMessage(err, t('create.failed')));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={submit}>
          <DialogHeader><DialogTitle>{t('list.new')}</DialogTitle></DialogHeader>
          <div className="mt-3 space-y-3">
            <Field label={t('field.title')} required>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('create.titlePlaceholder')} required />
            </Field>
            <Field label={tc('field.description')} required>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} required />
            </Field>
            <FieldGrid columns={2}>
              <Field label={t('field.category')}>
                <Select value={category} onChange={(e) => setCategory(e.target.value as ActivityCategory)}>
                  {ACTIVITY_CATEGORIES.map((c) => (
                    <option key={c} value={c}>{t(`category.${c}`)}</option>
                  ))}
                </Select>
              </Field>
              <Field label={t('field.venue')}>
                <Input value={venue} onChange={(e) => setVenue(e.target.value)} />
              </Field>
            </FieldGrid>
            <FieldGrid columns={2}>
              <Field label={tc('field.startDate')} required>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
              </Field>
              <Field label={tc('field.endDate')} hint={tc('state.optional')}>
                <Input type="date" value={endDate} min={startDate || undefined} onChange={(e) => setEndDate(e.target.value)} />
              </Field>
            </FieldGrid>
            <p className="text-[12px] text-ink-muted">
              {t('create.draftHint')}
            </p>
          </div>
          <DialogFooter className="mt-4">
            <Button type="button" variant="ghost" onClick={onClose}>{tc('action.cancel')}</Button>
            <Button type="submit" disabled={saving}>{saving ? tc('action.saving') : t('create.submit')}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
