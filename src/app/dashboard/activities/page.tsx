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

const PAGE_SIZE = 20;

export default function ActivitiesPage() {
  const router = useRouter();
  const rbac = useRbac();
  const readOnly = useReadOnlySession();
  const [status, setStatus] = React.useState<ActivityStatus | ''>('');
  const [category, setCategory] = React.useState<ActivityCategory | ''>('');
  const [search, setSearch] = React.useState('');
  const [page, setPage] = React.useState(1);
  const [creating, setCreating] = React.useState(false);

  const query = { status: status || undefined, category: category || undefined, search: search || undefined, page, limit: PAGE_SIZE };
  const { data, isLoading, mutate } = useSWR(`/activities?${JSON.stringify(query)}`, () => fetchActivities(query));

  const columns: Column<Activity>[] = [
    { key: 'title', header: 'Activity', accessor: (r) => r.title, card: 'title' },
    { key: 'category', header: 'Category', accessor: (r) => ACTIVITY_CATEGORY_LABELS[r.category], card: 'meta' },
    { key: 'date', header: 'Date', accessor: (r) => r.startDate, card: 'field' },
    { key: 'participants', header: 'Participants', align: 'right', accessor: (r) => r.participantCount, card: 'field' },
    { key: 'photos', header: 'Photos', align: 'right', accessor: (r) => r.photoCount, card: 'field' },
    { key: 'status', header: 'Status', align: 'right', accessor: (r) => <StatusChip status={r.status} />, card: 'trailing' },
  ];

  return (
    <PageShell>
      <Toaster position="top-center" />
      <PageHeader
        section="Campus"
        title="Activities"
        description="School events — publish to the whole school, track participants and winners, and share photos."
        actions={
          rbac.canManageActivities ? (
            <Button
              onClick={() => setCreating(true)}
              disabled={readOnly}
              title={readOnly ? READ_ONLY_TITLE : undefined}
            >
              <Plus /> New activity
            </Button>
          ) : undefined
        }
      />

      <PageBody>
        <FilterBar>
          <SearchInput value={search} onValueChange={(v) => { setSearch(v); setPage(1); }} placeholder="Search title or venue…" />
          <FilterField label="Status" width="sm">
            <Select value={status} onChange={(e) => { setStatus(e.target.value as ActivityStatus | ''); setPage(1); }}>
              <option value="">All</option>
              <option value="DRAFT">Draft</option>
              <option value="PUBLISHED">Published</option>
              <option value="ARCHIVED">Archived</option>
            </Select>
          </FilterField>
          <FilterField label="Category" width="sm">
            <Select value={category} onChange={(e) => { setCategory(e.target.value as ActivityCategory | ''); setPage(1); }}>
              <option value="">All</option>
              {ACTIVITY_CATEGORIES.map((c) => (
                <option key={c} value={c}>{ACTIVITY_CATEGORY_LABELS[c]}</option>
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
          emptyMessage="No activities yet"
          toolbar={
            <>
              <PartyPopper className="size-4 text-ink-faint" />
              <span className="font-display text-[15px] font-semibold text-ink">Activities</span>
              {data && <TableCount>{data.total}</TableCount>}
            </>
          }
        />
        {data && data.total > PAGE_SIZE && (
          <div className="mt-3 flex justify-end gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</Button>
            <Button variant="outline" size="sm" disabled={page * PAGE_SIZE >= data.total} onClick={() => setPage((p) => p + 1)}>Next</Button>
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
      toast.error('Title, description and start date are required');
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
      toast.success('Draft created');
      onSaved(activity);
    } catch (err) {
      toast.error(errorMessage(err, 'Could not create the activity'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={submit}>
          <DialogHeader><DialogTitle>New activity</DialogTitle></DialogHeader>
          <div className="mt-3 space-y-3">
            <Field label="Title" required>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Annual Sports Day" required />
            </Field>
            <Field label="Description" required>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} required />
            </Field>
            <FieldGrid columns={2}>
              <Field label="Category">
                <Select value={category} onChange={(e) => setCategory(e.target.value as ActivityCategory)}>
                  {ACTIVITY_CATEGORIES.map((c) => (
                    <option key={c} value={c}>{ACTIVITY_CATEGORY_LABELS[c]}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Venue">
                <Input value={venue} onChange={(e) => setVenue(e.target.value)} />
              </Field>
            </FieldGrid>
            <FieldGrid columns={2}>
              <Field label="Start date" required>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
              </Field>
              <Field label="End date" hint="Optional">
                <Input type="date" value={endDate} min={startDate || undefined} onChange={(e) => setEndDate(e.target.value)} />
              </Field>
            </FieldGrid>
            <p className="text-[12px] text-ink-muted">
              Saved as a draft. Nothing is announced until you publish it from the activity page.
            </p>
          </div>
          <DialogFooter className="mt-4">
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Create draft'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
