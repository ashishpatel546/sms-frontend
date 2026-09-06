'use client';

import * as React from 'react';
import { useParams, useRouter } from 'next/navigation';
import useSWR from 'swr';
import toast, { Toaster } from 'react-hot-toast';
import {
  ArrowLeft, Star, Trash2, Plus, Download, Bell, Archive, ArchiveRestore,
  ImagePlus, ChevronUp, ChevronDown, ImageOff, Star as StarFilled,
} from 'lucide-react';

import {
  ACTIVITY_CATEGORIES,
  ACTIVITY_CATEGORY_LABELS,
  archiveActivity,
  deleteActivity,
  deleteActivityPhoto,
  downloadParticipantsCsv,
  errorMessage,
  fetchActivity,
  fetchActivityPhotoUrls,
  fetchActivityPhotos,
  notifyAgainActivity,
  publishActivity,
  reorderActivityPhotos,
  setCoverPhoto,
  setParticipants,
  unarchiveActivity,
  updateActivity,
  updateActivityPhoto,
  uploadActivityPhoto,
  type Activity,
  type ActivityCategory,
  type ActivityParticipant,
  type ActivityPhoto,
  type ParticipantEntryInput,
} from '@/lib/activities-api';
import { loadImageFromFile, prepareGalleryPhoto, isImageFile } from '@/components/person/photo-pipeline';
import { API_BASE_URL } from '@/lib/api';
import { authFetch } from '@/lib/auth';
import { PageBody, PageHeader, PageShell } from '@/components/ui/PageHeader';
import { Panel, PanelHeader, PanelBody, PanelFooter } from '@/components/ui/Panel';
import { Field, FieldGrid, Input, Select, Textarea } from '@/components/ui/Field';
import { Button } from '@/components/ui/button';
import { StatusChip } from '@/components/ui/StatusChip';
import { Skeleton } from '@/components/ui/skeleton';
import { useRbac } from '@/lib/rbac';
import { READ_ONLY_TITLE, useReadOnlySession } from '@/lib/support-session';

interface ClassOption {
  id: number;
  name: string;
  sections?: { id: number; name: string }[];
}

interface StudentHit {
  id: number;
  firstName: string;
  lastName: string;
  admissionNumber?: string | null;
  enrollments?: { status: string; class?: { name: string }; section?: { name: string } }[];
}

export default function ActivityDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const rbac = useRbac();
  const readOnly = useReadOnlySession();
  const { data: activity, isLoading, mutate } = useSWR(id ? `/activities/${id}` : null, () => fetchActivity(id));

  const canManage = rbac.canManageActivities && !readOnly;

  if (isLoading || !activity) {
    return (
      <PageShell>
        <PageHeader section="Campus" title="Activity" actions={<Skeleton className="h-9 w-24" />} />
        <PageBody>
          <Skeleton className="h-48 w-full rounded-xl" />
        </PageBody>
      </PageShell>
    );
  }

  const runAction = async (label: string, fn: () => Promise<unknown>) => {
    try {
      await fn();
      toast.success(label);
      void mutate();
    } catch (err) {
      toast.error(errorMessage(err, `Could not ${label.toLowerCase()}`));
    }
  };

  return (
    <PageShell>
      <Toaster position="top-center" />
      <PageHeader
        section="Campus"
        title={activity.title}
        description={
          <span className="inline-flex items-center gap-2">
            <StatusChip status={activity.status} />
            <span>{ACTIVITY_CATEGORY_LABELS[activity.category]} · {activity.startDate}{activity.endDate ? ` – ${activity.endDate}` : ''}</span>
          </span>
        }
        actions={
          <>
            <Button variant="ghost" onClick={() => router.push('/dashboard/activities')}>
              <ArrowLeft /> Back
            </Button>
            {canManage && activity.status === 'DRAFT' && (
              <Button onClick={() => runAction('Published', () => publishActivity(activity.id))}>
                Publish
              </Button>
            )}
            {canManage && activity.status === 'PUBLISHED' && (
              <>
                <Button variant="outline" onClick={() => runAction('Notified again', () => notifyAgainActivity(activity.id))} title={readOnly ? READ_ONLY_TITLE : undefined}>
                  <Bell /> Notify again
                </Button>
                <Button variant="outline" onClick={() => runAction('Archived', () => archiveActivity(activity.id))} title={readOnly ? READ_ONLY_TITLE : undefined}>
                  <Archive /> Archive
                </Button>
              </>
            )}
            {canManage && activity.status === 'ARCHIVED' && (
              <Button variant="outline" onClick={() => runAction('Unarchived', () => unarchiveActivity(activity.id))} title={readOnly ? READ_ONLY_TITLE : undefined}>
                <ArchiveRestore /> Unarchive
              </Button>
            )}
            {canManage && activity.status === 'DRAFT' && activity.photoCount === 0 && (
              <Button
                variant="destructive"
                onClick={async () => {
                  if (!confirm('Delete this draft activity? This cannot be undone.')) return;
                  try {
                    await deleteActivity(activity.id);
                    toast.success('Draft deleted');
                    router.push('/dashboard/activities');
                  } catch (err) {
                    toast.error(errorMessage(err, 'Could not delete'));
                  }
                }}
              >
                <Trash2 /> Delete
              </Button>
            )}
          </>
        }
      />

      <PageBody>
        <DetailsPanel activity={activity} canManage={canManage} readOnly={readOnly} onSaved={() => void mutate()} />
        <ParticipantsPanel activity={activity} canManage={canManage} readOnly={readOnly} onSaved={() => void mutate()} />
        <PhotosPanel activity={activity} canManage={canManage} readOnly={readOnly} onSaved={() => void mutate()} />
      </PageBody>
    </PageShell>
  );
}

/* ── Details ───────────────────────────────────────────────────────────── */

function DetailsPanel({
  activity,
  canManage,
  readOnly,
  onSaved,
}: {
  activity: Activity;
  canManage: boolean;
  readOnly: boolean;
  onSaved: () => void;
}) {
  const [editing, setEditing] = React.useState(false);
  const [title, setTitle] = React.useState(activity.title);
  const [description, setDescription] = React.useState(activity.description);
  const [category, setCategory] = React.useState<ActivityCategory>(activity.category);
  const [startDate, setStartDate] = React.useState(activity.startDate);
  const [endDate, setEndDate] = React.useState(activity.endDate ?? '');
  const [venue, setVenue] = React.useState(activity.venue ?? '');
  const [remarks, setRemarks] = React.useState(activity.remarks ?? '');
  const [resultSummary, setResultSummary] = React.useState(activity.resultSummary ?? '');
  const [saving, setSaving] = React.useState(false);

  const startEdit = () => {
    setTitle(activity.title);
    setDescription(activity.description);
    setCategory(activity.category);
    setStartDate(activity.startDate);
    setEndDate(activity.endDate ?? '');
    setVenue(activity.venue ?? '');
    setRemarks(activity.remarks ?? '');
    setResultSummary(activity.resultSummary ?? '');
    setEditing(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      await updateActivity(activity.id, {
        title, description, category, startDate,
        endDate: endDate || undefined,
        venue: venue || undefined,
        remarks: remarks || undefined,
        resultSummary: resultSummary || undefined,
      });
      toast.success('Saved');
      setEditing(false);
      onSaved();
    } catch (err) {
      toast.error(errorMessage(err, 'Could not save'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Panel>
      <PanelHeader
        title="Details"
        action={canManage && !editing ? <Button size="sm" variant="outline" onClick={startEdit} title={readOnly ? READ_ONLY_TITLE : undefined} disabled={readOnly}>Edit</Button> : undefined}
      />
      <PanelBody>
        {editing ? (
          <div className="space-y-3">
            <Field label="Title" required><Input value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
            <Field label="Description" required><Textarea rows={4} value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
            <FieldGrid columns={2}>
              <Field label="Category">
                <Select value={category} onChange={(e) => setCategory(e.target.value as ActivityCategory)}>
                  {ACTIVITY_CATEGORIES.map((c) => <option key={c} value={c}>{ACTIVITY_CATEGORY_LABELS[c]}</option>)}
                </Select>
              </Field>
              <Field label="Venue"><Input value={venue} onChange={(e) => setVenue(e.target.value)} /></Field>
            </FieldGrid>
            <FieldGrid columns={2}>
              <Field label="Start date"><Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></Field>
              <Field label="End date"><Input type="date" value={endDate} min={startDate || undefined} onChange={(e) => setEndDate(e.target.value)} /></Field>
            </FieldGrid>
            <Field label="Remarks" hint="Internal, staff-only"><Textarea rows={2} value={remarks} onChange={(e) => setRemarks(e.target.value)} /></Field>
            <Field label="Result summary" hint="Shown to parents once the activity is published"><Textarea rows={2} value={resultSummary} onChange={(e) => setResultSummary(e.target.value)} /></Field>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="whitespace-pre-wrap text-[13.5px] text-ink">{activity.description}</p>
            {activity.venue && <p className="text-[12.5px] text-ink-muted">Venue: {activity.venue}</p>}
            {activity.remarks && <p className="text-[12.5px] text-ink-muted">Remarks: {activity.remarks}</p>}
            {activity.resultSummary && <p className="text-[12.5px] text-ink-muted">Result: {activity.resultSummary}</p>}
          </div>
        )}
      </PanelBody>
      {editing && (
        <PanelFooter>
          <Button variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
          <Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</Button>
        </PanelFooter>
      )}
    </Panel>
  );
}

/* ── Participants ──────────────────────────────────────────────────────── */

type DraftParticipant = ParticipantEntryInput & {
  name: string;
  admissionNumber?: string | null;
};

function participantsToDraft(activity: Activity): DraftParticipant[] {
  return (activity.participants ?? []).map((p: ActivityParticipant) => ({
    studentId: p.studentId,
    isWinner: p.isWinner,
    position: p.position ?? undefined,
    award: p.award ?? undefined,
    remark: p.remark ?? undefined,
    name: p.student?.user ? `${p.student.user.firstName} ${p.student.user.lastName}` : (p.student ? `${p.student.firstName ?? ''} ${p.student.lastName ?? ''}`.trim() : `Student #${p.studentId}`),
    admissionNumber: p.student?.admissionNumber,
  }));
}

function ParticipantsPanel({
  activity,
  canManage,
  readOnly,
  onSaved,
}: {
  activity: Activity;
  canManage: boolean;
  readOnly: boolean;
  onSaved: () => void;
}) {
  const [draft, setDraft] = React.useState<DraftParticipant[]>(() => participantsToDraft(activity));
  const [dirty, setDirty] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [search, setSearch] = React.useState('');
  const [results, setResults] = React.useState<StudentHit[]>([]);
  const [searching, setSearching] = React.useState(false);
  const [classes, setClasses] = React.useState<ClassOption[]>([]);
  const [pickClass, setPickClass] = React.useState('');
  const [pickSection, setPickSection] = React.useState('');
  const [addingClass, setAddingClass] = React.useState(false);

  React.useEffect(() => {
    setDraft(participantsToDraft(activity));
    setDirty(false);
  }, [activity]);

  React.useEffect(() => {
    if (!canManage) return;
    authFetch(`${API_BASE_URL}/classes`).then((r) => r.ok && r.json()).then((data) => data && setClasses(data)).catch(() => undefined);
  }, [canManage]);

  React.useEffect(() => {
    if (!search) { setResults([]); return; }
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        const res = await authFetch(`${API_BASE_URL}/students?${new URLSearchParams({ search, page: '1', limit: '8' })}`);
        if (res.ok) {
          const data = await res.json();
          setResults(data?.data ?? (Array.isArray(data) ? data : []));
        }
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const existingIds = new Set(draft.map((d) => d.studentId));

  const addStudent = (s: StudentHit) => {
    if (existingIds.has(s.id)) return;
    setDraft((prev) => [...prev, {
      studentId: s.id,
      isWinner: false,
      name: `${s.firstName} ${s.lastName}`.trim(),
      admissionNumber: s.admissionNumber,
    }]);
    setDirty(true);
    setSearch('');
    setResults([]);
  };

  const addWholeClass = async () => {
    if (!pickClass || !pickSection) { toast.error('Pick a class and section first'); return; }
    setAddingClass(true);
    try {
      const res = await authFetch(`${API_BASE_URL}/students?${new URLSearchParams({ classId: pickClass, sectionId: pickSection, page: '1', limit: '200' })}`);
      if (!res.ok) throw new Error('Could not load the roster');
      const data = await res.json();
      const rows: StudentHit[] = data?.data ?? (Array.isArray(data) ? data : []);
      const toAdd = rows.filter((s) => !existingIds.has(s.id));
      if (!toAdd.length) { toast('Everyone in that section is already added'); return; }
      setDraft((prev) => [...prev, ...toAdd.map((s) => ({
        studentId: s.id,
        isWinner: false,
        name: `${s.firstName} ${s.lastName}`.trim(),
        admissionNumber: s.admissionNumber,
      }))]);
      setDirty(true);
      toast.success(`Added ${toAdd.length} student${toAdd.length === 1 ? '' : 's'}`);
    } catch (err) {
      toast.error(errorMessage(err, 'Could not add the class'));
    } finally {
      setAddingClass(false);
    }
  };

  const updateRow = (studentId: number, patch: Partial<DraftParticipant>) => {
    setDraft((prev) => prev.map((p) => (p.studentId === studentId ? { ...p, ...patch } : p)));
    setDirty(true);
  };

  const removeRow = (studentId: number) => {
    setDraft((prev) => prev.filter((p) => p.studentId !== studentId));
    setDirty(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      await setParticipants(activity.id, draft.map(({ studentId, isWinner, position, award, remark }) => ({ studentId, isWinner, position, award, remark })));
      toast.success('Participants saved');
      setDirty(false);
      onSaved();
    } catch (err) {
      toast.error(errorMessage(err, 'Could not save participants'));
    } finally {
      setSaving(false);
    }
  };

  const selectedClassSections = classes.find((c) => String(c.id) === pickClass)?.sections ?? [];
  const winners = draft.filter((d) => d.isWinner);
  const others = draft.filter((d) => !d.isWinner);

  return (
    <Panel>
      <PanelHeader
        title="Participants & winners"
        description={`${draft.length} participant${draft.length === 1 ? '' : 's'}, ${winners.length} winner${winners.length === 1 ? '' : 's'}`}
        action={
          <Button size="sm" variant="outline" onClick={() => downloadParticipantsCsv(activity.id, activity.title).catch(() => toast.error('Could not export'))}>
            <Download /> Export CSV
          </Button>
        }
      />
      <PanelBody className="space-y-4">
        {canManage && (
          <div className="space-y-2 rounded-lg border border-line bg-surface-secondary p-3">
            <div className="relative">
              <Input placeholder="Search a student by name or admission no…" value={search} onChange={(e) => setSearch(e.target.value)} />
              {search && (
                <ul className="absolute z-20 mt-1 w-full max-h-56 overflow-y-auto rounded-lg border border-line bg-surface shadow-raised">
                  {searching ? (
                    <li className="px-3 py-2 text-[12.5px] text-ink-muted">Searching…</li>
                  ) : results.length ? (
                    results.map((s) => (
                      <li key={s.id} className="cursor-pointer px-3 py-2 text-[13px] hover:bg-surface-secondary" onClick={() => addStudent(s)}>
                        {s.firstName} {s.lastName} {s.admissionNumber ? <span className="text-ink-muted">· {s.admissionNumber}</span> : null}
                      </li>
                    ))
                  ) : (
                    <li className="px-3 py-2 text-[12.5px] text-ink-muted">No students found</li>
                  )}
                </ul>
              )}
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <FieldGrid columns={2} className="flex-1 min-w-[240px]">
                <Field label="Class">
                  <Select value={pickClass} onChange={(e) => { setPickClass(e.target.value); setPickSection(''); }}>
                    <option value="">Select class</option>
                    {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </Select>
                </Field>
                <Field label="Section">
                  <Select value={pickSection} onChange={(e) => setPickSection(e.target.value)} disabled={!pickClass}>
                    <option value="">Select section</option>
                    {selectedClassSections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </Select>
                </Field>
              </FieldGrid>
              <Button type="button" variant="outline" size="sm" onClick={addWholeClass} disabled={addingClass || !pickClass || !pickSection}>
                <Plus className="size-3.5" /> Add whole class
              </Button>
            </div>
          </div>
        )}

        {draft.length === 0 ? (
          <p className="text-[12.5px] text-ink-muted">No participants added yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead className="text-[11.5px] uppercase tracking-wide text-ink-faint">
                <tr>
                  <th className="pb-2 pr-2">Student</th>
                  <th className="pb-2 pr-2">Winner</th>
                  <th className="pb-2 pr-2">Position</th>
                  <th className="pb-2 pr-2">Award</th>
                  {canManage && <th className="pb-2" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {[...winners, ...others].map((p) => (
                  <tr key={p.studentId}>
                    <td className="py-1.5 pr-2">
                      <div className="font-medium text-ink">{p.name}</div>
                      {p.admissionNumber && <div className="text-[11.5px] text-ink-muted">{p.admissionNumber}</div>}
                    </td>
                    <td className="py-1.5 pr-2">
                      {canManage ? (
                        <button type="button" onClick={() => updateRow(p.studentId, { isWinner: !p.isWinner, position: p.isWinner ? undefined : p.position })}>
                          <Star className={p.isWinner ? 'size-4 fill-accent-warn text-accent-warn' : 'size-4 text-ink-faint'} />
                        </button>
                      ) : p.isWinner ? (
                        <Star className="size-4 fill-accent-warn text-accent-warn" />
                      ) : null}
                    </td>
                    <td className="py-1.5 pr-2">
                      {canManage && p.isWinner ? (
                        <Input type="number" min={1} className="h-8 w-16" value={p.position ?? ''} onChange={(e) => updateRow(p.studentId, { position: e.target.value ? Number(e.target.value) : undefined })} />
                      ) : (p.isWinner ? (p.position ?? '—') : '')}
                    </td>
                    <td className="py-1.5 pr-2">
                      {canManage && p.isWinner ? (
                        <Input className="h-8" value={p.award ?? ''} onChange={(e) => updateRow(p.studentId, { award: e.target.value })} placeholder="e.g. Gold medal" />
                      ) : (p.award ?? '')}
                    </td>
                    {canManage && (
                      <td className="py-1.5 text-right">
                        <button type="button" onClick={() => removeRow(p.studentId)} title="Remove">
                          <Trash2 className="size-3.5 text-ink-faint hover:text-accent-danger" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </PanelBody>
      {canManage && dirty && (
        <PanelFooter>
          <Button variant="ghost" onClick={() => { setDraft(participantsToDraft(activity)); setDirty(false); }}>Discard changes</Button>
          <Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save participants'}</Button>
        </PanelFooter>
      )}
    </Panel>
  );
}

/* ── Photos ────────────────────────────────────────────────────────────── */

function PhotosPanel({
  activity,
  canManage,
  readOnly,
  onSaved,
}: {
  activity: Activity;
  canManage: boolean;
  readOnly: boolean;
  onSaved: () => void;
}) {
  const [loaded, setLoaded] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [photos, setPhotos] = React.useState<ActivityPhoto[]>([]);
  const [urls, setUrls] = React.useState<Record<number, string>>({});
  const [uploading, setUploading] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const load = async () => {
    setLoading(true);
    try {
      const rows = await fetchActivityPhotos(activity.id);
      setPhotos(rows);
      const u = await fetchActivityPhotoUrls(activity.id, rows.map((r) => r.id), 'thumb');
      setUrls(u);
      setLoaded(true);
    } catch (err) {
      toast.error(errorMessage(err, 'Could not load photos'));
    } finally {
      setLoading(false);
    }
  };

  const handleFile = async (file: File) => {
    if (!isImageFile(file)) { toast.error('Only image files are allowed'); return; }
    setUploading(true);
    try {
      const { image } = await loadImageFromFile(file);
      const prepared = await prepareGalleryPhoto(image);
      const photo = await uploadActivityPhoto(activity.id, prepared.full, file.name, prepared.thumb);
      setPhotos((prev) => [...prev, photo]);
      const u = await fetchActivityPhotoUrls(activity.id, [photo.id], 'thumb');
      setUrls((prev) => ({ ...prev, ...u }));
      toast.success('Photo uploaded');
      onSaved();
    } catch (err) {
      toast.error(errorMessage(err, 'Could not upload the photo'));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removePhoto = async (photoId: number) => {
    if (!confirm('Delete this photo?')) return;
    try {
      await deleteActivityPhoto(activity.id, photoId);
      setPhotos((prev) => prev.filter((p) => p.id !== photoId));
      toast.success('Photo deleted');
      onSaved();
    } catch (err) {
      toast.error(errorMessage(err, 'Could not delete the photo'));
    }
  };

  const move = async (index: number, dir: -1 | 1) => {
    const next = [...photos];
    const swapWith = index + dir;
    if (swapWith < 0 || swapWith >= next.length) return;
    [next[index], next[swapWith]] = [next[swapWith], next[index]];
    setPhotos(next);
    try {
      await reorderActivityPhotos(activity.id, next.map((p, i) => ({ id: p.id, sortOrder: i })));
    } catch (err) {
      toast.error(errorMessage(err, 'Could not reorder photos'));
    }
  };

  const makeCover = async (photoId: number) => {
    try {
      await setCoverPhoto(activity.id, photoId);
      toast.success('Cover photo set');
      onSaved();
    } catch (err) {
      toast.error(errorMessage(err, 'Could not set cover photo'));
    }
  };

  return (
    <Panel>
      <PanelHeader
        title="Photos"
        description={`${activity.photoCount} photo${activity.photoCount === 1 ? '' : 's'}`}
        action={
          <div className="flex items-center gap-2">
            {canManage && loaded && (
              <>
                <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
                <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={uploading} title={readOnly ? READ_ONLY_TITLE : undefined}>
                  <ImagePlus className="size-3.5" /> {uploading ? 'Uploading…' : 'Add photo'}
                </Button>
              </>
            )}
            {!loaded && (
              <Button size="sm" variant="outline" onClick={load} disabled={loading}>
                {loading ? 'Loading…' : `Load photos (${activity.photoCount})`}
              </Button>
            )}
          </div>
        }
      />
      {loaded && (
        <PanelBody>
          {photos.length === 0 ? (
            <p className="flex items-center gap-2 text-[12.5px] text-ink-muted"><ImageOff className="size-4" /> No photos yet.</p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {photos.map((p, i) => (
                <div key={p.id} className="group relative overflow-hidden rounded-lg border border-line bg-surface-secondary">
                  {urls[p.id] ? (
                    // eslint-disable-next-line @next/next/no-img-element -- presigned S3 URL
                    <img src={urls[p.id]} alt={p.caption ?? p.fileName} className="aspect-square w-full object-cover" />
                  ) : (
                    <div className="aspect-square w-full animate-pulse bg-surface-inset" />
                  )}
                  {activity.coverPhotoId === p.id && (
                    <span className="absolute top-1.5 left-1.5 rounded-full bg-accent-warn px-1.5 py-0.5 text-[10px] font-semibold text-white">Cover</span>
                  )}
                  {canManage && (
                    <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-black/55 px-1.5 py-1 opacity-0 transition-opacity group-hover:opacity-100">
                      <div className="flex gap-0.5">
                        <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="text-white/90 hover:text-white disabled:opacity-30"><ChevronUp className="size-3.5" /></button>
                        <button type="button" onClick={() => move(i, 1)} disabled={i === photos.length - 1} className="text-white/90 hover:text-white disabled:opacity-30"><ChevronDown className="size-3.5" /></button>
                      </div>
                      <div className="flex gap-1.5">
                        <button type="button" onClick={() => makeCover(p.id)} title="Set as cover"><StarFilled className="size-3.5 text-white/90 hover:text-accent-warn" /></button>
                        <button type="button" onClick={() => removePhoto(p.id)} title="Delete"><Trash2 className="size-3.5 text-white/90 hover:text-accent-danger" /></button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </PanelBody>
      )}
    </Panel>
  );
}
