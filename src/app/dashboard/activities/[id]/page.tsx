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
import { loadImageFromFile, prepareGalleryPhoto, isImageFile, PhotoError } from '@/components/person/photo-pipeline';
import { useHelperMessage } from '@/i18n/useHelperMessage';
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
import { useTranslations } from 'next-intl';

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
  const t = useTranslations('activities');
  const tc = useTranslations('common');
  const { data: activity, isLoading, mutate } = useSWR(id ? `/activities/${id}` : null, () => fetchActivity(id));

  const canManage = rbac.canManageActivities && !readOnly;

  if (isLoading || !activity) {
    return (
      <PageShell>
        <PageHeader section={t('list.section')} title={t('detail.title')} actions={<Skeleton className="h-9 w-24" />} />
        <PageBody>
          <Skeleton className="h-48 w-full rounded-xl" />
        </PageBody>
      </PageShell>
    );
  }

  const runAction = async (action: 'publish' | 'notify' | 'archive' | 'unarchive', fn: () => Promise<unknown>) => {
    try {
      await fn();
      toast.success(t(`detail.run.${action}.done`));
      void mutate();
    } catch (err) {
      toast.error(errorMessage(err, t(`detail.run.${action}.failed`)));
    }
  };

  return (
    <PageShell>
      <Toaster position="top-center" />
      <PageHeader
        section={t('list.section')}
        title={activity.title}
        description={
          <span className="inline-flex items-center gap-2">
            <StatusChip status={activity.status} label={t(`status.${activity.status}`)} />
            <span>{activity.category in ACTIVITY_CATEGORY_LABELS ? t(`category.${activity.category}`) : activity.category} · {activity.startDate}{activity.endDate ? ` – ${activity.endDate}` : ''}</span>
          </span>
        }
        actions={
          <>
            <Button variant="ghost" onClick={() => router.push('/dashboard/activities')}>
              <ArrowLeft /> {tc('action.back')}
            </Button>
            {canManage && activity.status === 'DRAFT' && (
              <Button onClick={() => runAction('publish', () => publishActivity(activity.id))}>
                {t('detail.publish')}
              </Button>
            )}
            {canManage && activity.status === 'PUBLISHED' && (
              <>
                <Button variant="outline" onClick={() => runAction('notify', () => notifyAgainActivity(activity.id))} title={readOnly ? READ_ONLY_TITLE : undefined}>
                  <Bell /> {t('detail.notifyAgain')}
                </Button>
                <Button variant="outline" onClick={() => runAction('archive', () => archiveActivity(activity.id))} title={readOnly ? READ_ONLY_TITLE : undefined}>
                  <Archive /> {t('detail.archive')}
                </Button>
              </>
            )}
            {canManage && activity.status === 'ARCHIVED' && (
              <Button variant="outline" onClick={() => runAction('unarchive', () => unarchiveActivity(activity.id))} title={readOnly ? READ_ONLY_TITLE : undefined}>
                <ArchiveRestore /> {t('detail.unarchive')}
              </Button>
            )}
            {canManage && activity.status === 'DRAFT' && activity.photoCount === 0 && (
              <Button
                variant="destructive"
                onClick={async () => {
                  if (!confirm(t('detail.deleteConfirm'))) return;
                  try {
                    await deleteActivity(activity.id);
                    toast.success(t('detail.deleted'));
                    router.push('/dashboard/activities');
                  } catch (err) {
                    toast.error(errorMessage(err, t('detail.deleteFailed')));
                  }
                }}
              >
                <Trash2 /> {tc('action.delete')}
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
  const t = useTranslations('activities');
  const tc = useTranslations('common');
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
      toast.success(tc('state.saved'));
      setEditing(false);
      onSaved();
    } catch (err) {
      toast.error(errorMessage(err, t('details.saveFailed')));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Panel>
      <PanelHeader
        title={t('details.title')}
        action={canManage && !editing ? <Button size="sm" variant="outline" onClick={startEdit} title={readOnly ? READ_ONLY_TITLE : undefined} disabled={readOnly}>{tc('action.edit')}</Button> : undefined}
      />
      <PanelBody>
        {editing ? (
          <div className="space-y-3">
            <Field label={t('field.title')} required><Input value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
            <Field label={tc('field.description')} required><Textarea rows={4} value={description} onChange={(e) => setDescription(e.target.value)} /></Field>
            <FieldGrid columns={2}>
              <Field label={t('field.category')}>
                <Select value={category} onChange={(e) => setCategory(e.target.value as ActivityCategory)}>
                  {ACTIVITY_CATEGORIES.map((c) => <option key={c} value={c}>{t(`category.${c}`)}</option>)}
                </Select>
              </Field>
              <Field label={t('field.venue')}><Input value={venue} onChange={(e) => setVenue(e.target.value)} /></Field>
            </FieldGrid>
            <FieldGrid columns={2}>
              <Field label={tc('field.startDate')}><Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} /></Field>
              <Field label={tc('field.endDate')}><Input type="date" value={endDate} min={startDate || undefined} onChange={(e) => setEndDate(e.target.value)} /></Field>
            </FieldGrid>
            <Field label={tc('field.remarks')} hint={t('details.remarksHint')}><Textarea rows={2} value={remarks} onChange={(e) => setRemarks(e.target.value)} /></Field>
            <Field label={t('details.resultSummary')} hint={t('details.resultSummaryHint')}><Textarea rows={2} value={resultSummary} onChange={(e) => setResultSummary(e.target.value)} /></Field>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="whitespace-pre-wrap text-[13.5px] text-ink">{activity.description}</p>
            {activity.venue && <p className="text-[12.5px] text-ink-muted">{t('details.venueLine', { venue: activity.venue })}</p>}
            {activity.remarks && <p className="text-[12.5px] text-ink-muted">{t('details.remarksLine', { remarks: activity.remarks })}</p>}
            {activity.resultSummary && <p className="text-[12.5px] text-ink-muted">{t('details.resultLine', { result: activity.resultSummary })}</p>}
          </div>
        )}
      </PanelBody>
      {editing && (
        <PanelFooter>
          <Button variant="ghost" onClick={() => setEditing(false)}>{tc('action.cancel')}</Button>
          <Button onClick={save} disabled={saving}>{saving ? tc('action.saving') : t('details.saveChanges')}</Button>
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

function participantsToDraft(activity: Activity, unnamed: (studentId: number) => string): DraftParticipant[] {
  return (activity.participants ?? []).map((p: ActivityParticipant) => ({
    studentId: p.studentId,
    isWinner: p.isWinner,
    position: p.position ?? undefined,
    award: p.award ?? undefined,
    remark: p.remark ?? undefined,
    name: p.student?.user ? `${p.student.user.firstName} ${p.student.user.lastName}` : (p.student ? `${p.student.firstName ?? ''} ${p.student.lastName ?? ''}`.trim() : unnamed(p.studentId)),
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
  const t = useTranslations('activities');
  const tc = useTranslations('common');
  const unnamed = (studentId: number) => t('participants.unnamed', { id: studentId });
  const [draft, setDraft] = React.useState<DraftParticipant[]>(() => participantsToDraft(activity, unnamed));
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
    setDraft(participantsToDraft(activity, unnamed));
    setDirty(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `unnamed` only formats a fallback label
  }, [activity]);

  React.useEffect(() => {
    if (!canManage) return;
    authFetch(`${API_BASE_URL}/classes`).then((r) => r.ok && r.json()).then((data) => data && setClasses(data)).catch(() => undefined);
  }, [canManage]);

  React.useEffect(() => {
    if (!search) { setResults([]); return; }
    setSearching(true);
    const timer = setTimeout(async () => {
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
    return () => clearTimeout(timer);
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
    if (!pickClass || !pickSection) { toast.error(t('participants.pickFirst')); return; }
    setAddingClass(true);
    try {
      const res = await authFetch(`${API_BASE_URL}/students?${new URLSearchParams({ classId: pickClass, sectionId: pickSection, page: '1', limit: '200' })}`);
      if (!res.ok) throw new Error(t('participants.rosterFailed'));
      const data = await res.json();
      const rows: StudentHit[] = data?.data ?? (Array.isArray(data) ? data : []);
      const toAdd = rows.filter((s) => !existingIds.has(s.id));
      if (!toAdd.length) { toast(t('participants.allAdded')); return; }
      setDraft((prev) => [...prev, ...toAdd.map((s) => ({
        studentId: s.id,
        isWinner: false,
        name: `${s.firstName} ${s.lastName}`.trim(),
        admissionNumber: s.admissionNumber,
      }))]);
      setDirty(true);
      toast.success(t('participants.added', { count: toAdd.length }));
    } catch (err) {
      toast.error(errorMessage(err, t('participants.addClassFailed')));
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
      toast.success(t('participants.saved'));
      setDirty(false);
      onSaved();
    } catch (err) {
      toast.error(errorMessage(err, t('participants.saveFailed')));
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
        title={t('participants.title')}
        description={t('participants.summary', { participants: draft.length, winners: winners.length })}
        action={
          <Button size="sm" variant="outline" onClick={() => downloadParticipantsCsv(activity.id, activity.title).catch(() => toast.error(t('participants.exportFailed')))}>
            <Download /> {t('participants.exportCsv')}
          </Button>
        }
      />
      <PanelBody className="space-y-4">
        {canManage && (
          <div className="space-y-2 rounded-lg border border-line bg-surface-secondary p-3">
            <div className="relative">
              <Input placeholder={t('participants.searchPlaceholder')} value={search} onChange={(e) => setSearch(e.target.value)} />
              {search && (
                <ul className="absolute z-20 mt-1 w-full max-h-56 overflow-y-auto rounded-lg border border-line bg-surface shadow-raised">
                  {searching ? (
                    <li className="px-3 py-2 text-[12.5px] text-ink-muted">{t('participants.searching')}</li>
                  ) : results.length ? (
                    results.map((s) => (
                      <li key={s.id} className="cursor-pointer px-3 py-2 text-[13px] hover:bg-surface-secondary" onClick={() => addStudent(s)}>
                        {s.firstName} {s.lastName} {s.admissionNumber ? <span className="text-ink-muted">· {s.admissionNumber}</span> : null}
                      </li>
                    ))
                  ) : (
                    <li className="px-3 py-2 text-[12.5px] text-ink-muted">{t('participants.noStudents')}</li>
                  )}
                </ul>
              )}
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <FieldGrid columns={2} className="flex-1 min-w-[240px]">
                <Field label={tc('field.class')}>
                  <Select value={pickClass} onChange={(e) => { setPickClass(e.target.value); setPickSection(''); }}>
                    <option value="">{t('participants.selectClass')}</option>
                    {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </Select>
                </Field>
                <Field label={tc('field.section')}>
                  <Select value={pickSection} onChange={(e) => setPickSection(e.target.value)} disabled={!pickClass}>
                    <option value="">{t('participants.selectSection')}</option>
                    {selectedClassSections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </Select>
                </Field>
              </FieldGrid>
              <Button type="button" variant="outline" size="sm" onClick={addWholeClass} disabled={addingClass || !pickClass || !pickSection}>
                <Plus className="size-3.5" /> {t('participants.addWholeClass')}
              </Button>
            </div>
          </div>
        )}

        {draft.length === 0 ? (
          <p className="text-[12.5px] text-ink-muted">{t('participants.none')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead className="text-[11.5px] uppercase tracking-wide text-ink-faint">
                <tr>
                  <th className="pb-2 pr-2">{tc('field.student')}</th>
                  <th className="pb-2 pr-2">{t('participants.winner')}</th>
                  <th className="pb-2 pr-2">{t('participants.position')}</th>
                  <th className="pb-2 pr-2">{t('participants.award')}</th>
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
                        <Input className="h-8" value={p.award ?? ''} onChange={(e) => updateRow(p.studentId, { award: e.target.value })} placeholder={t('participants.awardPlaceholder')} />
                      ) : (p.award ?? '')}
                    </td>
                    {canManage && (
                      <td className="py-1.5 text-right">
                        <button type="button" onClick={() => removeRow(p.studentId)} title={tc('action.remove')}>
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
          <Button variant="ghost" onClick={() => { setDraft(participantsToDraft(activity, unnamed)); setDirty(false); }}>{t('participants.discard')}</Button>
          <Button onClick={save} disabled={saving}>{saving ? tc('action.saving') : t('participants.save')}</Button>
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
  const helperText = useHelperMessage();
  const t = useTranslations('activities');
  const tc = useTranslations('common');
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
      toast.error(errorMessage(err, t('photos.loadFailed')));
    } finally {
      setLoading(false);
    }
  };

  const handleFile = async (file: File) => {
    if (!isImageFile(file)) { toast.error(t('photos.onlyImages')); return; }
    setUploading(true);
    try {
      const { image } = await loadImageFromFile(file);
      const prepared = await prepareGalleryPhoto(image);
      const photo = await uploadActivityPhoto(activity.id, prepared.full, file.name, prepared.thumb);
      setPhotos((prev) => [...prev, photo]);
      const u = await fetchActivityPhotoUrls(activity.id, [photo.id], 'thumb');
      setUrls((prev) => ({ ...prev, ...u }));
      toast.success(t('photos.uploaded'));
      onSaved();
    } catch (err) {
      toast.error(err instanceof PhotoError ? helperText({ key: err.key }) : errorMessage(err, t('photos.uploadFailed')));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removePhoto = async (photoId: number) => {
    if (!confirm(t('photos.deleteConfirm'))) return;
    try {
      await deleteActivityPhoto(activity.id, photoId);
      setPhotos((prev) => prev.filter((p) => p.id !== photoId));
      toast.success(t('photos.deleted'));
      onSaved();
    } catch (err) {
      toast.error(errorMessage(err, t('photos.deleteFailed')));
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
      toast.error(errorMessage(err, t('photos.reorderFailed')));
    }
  };

  const makeCover = async (photoId: number) => {
    try {
      await setCoverPhoto(activity.id, photoId);
      toast.success(t('photos.coverSet'));
      onSaved();
    } catch (err) {
      toast.error(errorMessage(err, t('photos.coverFailed')));
    }
  };

  return (
    <Panel>
      <PanelHeader
        title={t('photos.title')}
        description={t('photos.count', { count: activity.photoCount })}
        action={
          <div className="flex items-center gap-2">
            {canManage && loaded && (
              <>
                <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
                <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={uploading} title={readOnly ? READ_ONLY_TITLE : undefined}>
                  <ImagePlus className="size-3.5" /> {uploading ? t('photos.uploading') : t('photos.add')}
                </Button>
              </>
            )}
            {!loaded && (
              <Button size="sm" variant="outline" onClick={load} disabled={loading}>
                {loading ? tc('state.loading') : t('photos.load', { count: activity.photoCount })}
              </Button>
            )}
          </div>
        }
      />
      {loaded && (
        <PanelBody>
          {photos.length === 0 ? (
            <p className="flex items-center gap-2 text-[12.5px] text-ink-muted"><ImageOff className="size-4" /> {t('photos.none')}</p>
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
                    <span className="absolute top-1.5 left-1.5 rounded-full bg-accent-warn px-1.5 py-0.5 text-[10px] font-semibold text-white">{t('photos.cover')}</span>
                  )}
                  {canManage && (
                    <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-1 bg-black/55 px-1.5 py-1 opacity-0 transition-opacity group-hover:opacity-100">
                      <div className="flex gap-0.5">
                        <button type="button" onClick={() => move(i, -1)} disabled={i === 0} className="text-white/90 hover:text-white disabled:opacity-30"><ChevronUp className="size-3.5" /></button>
                        <button type="button" onClick={() => move(i, 1)} disabled={i === photos.length - 1} className="text-white/90 hover:text-white disabled:opacity-30"><ChevronDown className="size-3.5" /></button>
                      </div>
                      <div className="flex gap-1.5">
                        <button type="button" onClick={() => makeCover(p.id)} title={t('photos.setCover')}><StarFilled className="size-3.5 text-white/90 hover:text-accent-warn" /></button>
                        <button type="button" onClick={() => removePhoto(p.id)} title={tc('action.delete')}><Trash2 className="size-3.5 text-white/90 hover:text-accent-danger" /></button>
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
