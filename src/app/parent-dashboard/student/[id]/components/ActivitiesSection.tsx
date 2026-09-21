'use client';

import * as React from 'react';
import { Star, ImageOff, MapPin, CalendarDays } from 'lucide-react';

import FeatureNotAvailableNotice from '@/components/parent/FeatureNotAvailableNotice';
import {
  ACTIVITY_CATEGORY_LABELS,
  ActivitiesApiError,
  fetchStudentActivities,
  fetchStudentActivity,
  fetchStudentActivityPhotoUrls,
  fetchStudentActivityPhotos,
  type Activity,
  type ActivityParticipant,
  type ActivityPhoto,
} from '@/lib/activities-api';

/**
 * A parent's read of the school's activities feed — published (and archived,
 * closed-out) events, each with the full winners list and photos loaded only
 * when the parent actually opens them. Not filtered to "did my child take
 * part": a school event is addressed to the whole school, the same way the
 * admin dashboard's list is.
 */
export function ActivitiesSection({
  studentId,
  initialActivityId,
}: {
  studentId: string | number;
  /** Auto-opens this activity's card — the target of a "new activity" push notification. */
  initialActivityId?: string | null;
}) {
  const [state, setState] = React.useState<'loading' | 'ready' | 'off' | 'error'>('loading');
  const [message, setMessage] = React.useState('');
  const [activities, setActivities] = React.useState<Activity[]>([]);
  const [openId, setOpenId] = React.useState<string | null>(initialActivityId ?? null);

  React.useEffect(() => {
    let cancelled = false;
    setState('loading');
    fetchStudentActivities(studentId, 1, 20)
      .then((res) => {
        if (cancelled) return;
        setActivities(res.data);
        setState('ready');
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        if (e instanceof ActivitiesApiError && e.featureDisabled) {
          setState('off');
          return;
        }
        setMessage(e instanceof Error ? e.message : 'We could not load activities just now.');
        setState('error');
      });
    return () => { cancelled = true; };
  }, [studentId]);

  if (state === 'off') {
    return (
      <FeatureNotAvailableNotice
        title="Activities"
        description="You would see the school's events, results and photos here."
      />
    );
  }

  if (state === 'loading') {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="skeleton h-20 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (state === 'error') {
    return (
      <div className="rounded-xl border border-accent-danger-edge bg-accent-danger-tint p-4">
        <p className="text-[13.5px] font-medium text-accent-danger-deep">{message}</p>
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="rounded-xl border border-line bg-surface-secondary p-4 text-center">
        <p className="text-[13px] text-ink-muted">Nothing published yet. Check back after the next school event.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {activities.map((a) => (
        <ActivityCard
          key={a.id}
          activity={a}
          studentId={studentId}
          open={openId === a.id}
          onToggle={() => setOpenId(openId === a.id ? null : a.id)}
        />
      ))}
    </div>
  );
}

function ActivityCard({
  activity,
  studentId,
  open,
  onToggle,
}: {
  activity: Activity;
  studentId: string | number;
  open: boolean;
  onToggle: () => void;
}) {
  const [detail, setDetail] = React.useState<Activity | null>(null);
  const [loadingDetail, setLoadingDetail] = React.useState(false);
  const [photos, setPhotos] = React.useState<ActivityPhoto[] | null>(null);
  const [photoUrls, setPhotoUrls] = React.useState<Record<number, string>>({});
  const [loadingPhotos, setLoadingPhotos] = React.useState(false);

  React.useEffect(() => {
    if (!open || detail) return;
    setLoadingDetail(true);
    fetchStudentActivity(studentId, activity.id)
      .then((d) => setDetail(d))
      .catch(() => undefined)
      .finally(() => setLoadingDetail(false));
  }, [open, detail, studentId, activity.id]);

  const loadPhotos = async () => {
    setLoadingPhotos(true);
    try {
      const rows = await fetchStudentActivityPhotos(studentId, activity.id);
      setPhotos(rows);
      const urls = await fetchStudentActivityPhotoUrls(studentId, activity.id, rows.map((r) => r.id), 'thumb');
      setPhotoUrls(urls);
    } catch {
      setPhotos([]);
    } finally {
      setLoadingPhotos(false);
    }
  };

  const winners = (detail?.participants ?? []).filter((p: ActivityParticipant) => p.isWinner);

  return (
    <div className="overflow-hidden rounded-xl border border-line bg-surface">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
      >
        <div className="min-w-0">
          <p className="truncate text-[14px] font-semibold text-ink">{activity.title}</p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px] text-ink-muted">
            <span className="inline-flex items-center gap-1"><CalendarDays className="size-3.5" /> {activity.startDate}{activity.endDate ? ` – ${activity.endDate}` : ''}</span>
            <span>· {ACTIVITY_CATEGORY_LABELS[activity.category]}</span>
            {activity.venue && <span className="inline-flex items-center gap-1"><MapPin className="size-3.5" /> {activity.venue}</span>}
          </p>
        </div>
        {activity.winnerCount > 0 && (
          <span className="flex shrink-0 items-center gap-1 rounded-full bg-accent-warn-tint px-2 py-0.5 text-[11px] font-semibold text-accent-warn-deep">
            <Star className="size-3 fill-current" /> {activity.winnerCount}
          </span>
        )}
      </button>

      {open && (
        <div className="border-t border-line px-4 py-3">
          {loadingDetail || !detail ? (
            <div className="skeleton h-16 w-full rounded-lg" />
          ) : (
            <div className="space-y-3">
              <p className="whitespace-pre-wrap text-[13px] text-ink">{detail.description}</p>
              {detail.resultSummary && (
                <p className="rounded-lg bg-surface-secondary p-2.5 text-[12.5px] text-ink-muted">{detail.resultSummary}</p>
              )}

              {winners.length > 0 && (
                <div>
                  <p className="eyebrow mb-1.5">Winners</p>
                  <ul className="space-y-1">
                    {winners
                      .sort((a, b) => (a.position ?? 99) - (b.position ?? 99))
                      .map((w) => (
                        <li key={w.studentId} className="flex items-center gap-2 text-[13px] text-ink">
                          <Star className="size-3.5 shrink-0 fill-accent-warn text-accent-warn" />
                          <span className="font-medium">
                            {w.student?.user ? `${w.student.user.firstName} ${w.student.user.lastName}` : `Student #${w.studentId}`}
                          </span>
                          {w.position && <span className="text-ink-muted">· #{w.position}</span>}
                          {w.award && <span className="text-ink-muted">· {w.award}</span>}
                        </li>
                      ))}
                  </ul>
                </div>
              )}

              <div>
                {photos === null ? (
                  activity.photoCount > 0 ? (
                    <button
                      type="button"
                      onClick={loadPhotos}
                      disabled={loadingPhotos}
                      className="text-[12.5px] font-semibold text-brand hover:text-brand-deep"
                    >
                      {loadingPhotos ? 'Loading…' : `Load photos (${activity.photoCount})`}
                    </button>
                  ) : (
                    <p className="flex items-center gap-1.5 text-[12px] text-ink-faint"><ImageOff className="size-3.5" /> No photos</p>
                  )
                ) : photos.length === 0 ? (
                  <p className="text-[12px] text-ink-faint">No photos</p>
                ) : (
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                    {photos.map((p) => (
                      <div key={p.id} className="aspect-square overflow-hidden rounded-lg bg-surface-secondary">
                        {photoUrls[p.id] ? (
                          // eslint-disable-next-line @next/next/no-img-element -- presigned S3 URL
                          <img src={photoUrls[p.id]} alt={p.caption ?? ''} className="size-full object-cover" />
                        ) : (
                          <div className="size-full animate-pulse bg-surface-inset" />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default ActivitiesSection;
