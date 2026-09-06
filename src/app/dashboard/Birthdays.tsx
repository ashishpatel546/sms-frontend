'use client';

import { useEffect, useState } from 'react';
import { Cake, User as UserIcon } from 'lucide-react';
import { authFetch } from '@/lib/auth';
import { getEnv } from '@/lib/env';
import { Skeleton } from '@/components/ui/skeleton';

interface BirthdayStudent {
    id: number;
    firstName: string;
    lastName: string;
    className: string | null;
    sectionName: string | null;
    photoUrl: string | null;
    date?: string;
}

interface BirthdayStaff {
    id: number;
    firstName: string;
    lastName: string;
    designation: string | null;
    photoUrl: string | null;
    date?: string;
}

interface BirthdaysResponse {
    date: string;
    students: BirthdayStudent[];
    staff: BirthdayStaff[];
    upcoming: { students: BirthdayStudent[]; staff: BirthdayStaff[] };
}

function Avatar({ photoUrl, name }: { photoUrl: string | null; name: string }) {
    if (photoUrl) {
        // eslint-disable-next-line @next/next/no-img-element -- presigned S3 URL, not an app asset
        return <img src={photoUrl} alt={name} className="size-9 shrink-0 rounded-full object-cover" />;
    }
    return (
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-surface-inset text-ink-faint">
            <UserIcon className="size-4" aria-hidden />
        </span>
    );
}

function formatUpcomingDate(iso: string): string {
    return new Date(`${iso}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

function StudentRow({ s }: { s: BirthdayStudent }) {
    const classSection = [s.className, s.sectionName].filter(Boolean).join(' - ');
    return (
        <li className="flex items-center gap-2.5 py-2">
            <Avatar photoUrl={s.photoUrl} name={`${s.firstName} ${s.lastName}`} />
            <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold text-ink">{s.firstName} {s.lastName}</p>
                <p className="truncate text-[11.5px] text-ink-muted">
                    {classSection || '—'}
                    {s.date && <span className="ml-1.5 text-ink-faint">· {formatUpcomingDate(s.date)}</span>}
                </p>
            </div>
        </li>
    );
}

function StaffRow({ s }: { s: BirthdayStaff }) {
    return (
        <li className="flex items-center gap-2.5 py-2">
            <Avatar photoUrl={s.photoUrl} name={`${s.firstName} ${s.lastName}`} />
            <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold text-ink">{s.firstName} {s.lastName}</p>
                <p className="truncate text-[11.5px] text-ink-muted">
                    {s.designation || '—'}
                    {s.date && <span className="ml-1.5 text-ink-faint">· {formatUpcomingDate(s.date)}</span>}
                </p>
            </div>
        </li>
    );
}

function Panel({
    title,
    loading,
    today,
    upcoming,
    renderRow,
    emptyLabel,
}: {
    title: string;
    loading: boolean;
    today: (BirthdayStudent | BirthdayStaff)[];
    upcoming: (BirthdayStudent | BirthdayStaff)[];
    renderRow: (row: any) => React.ReactNode;
    emptyLabel: string;
}) {
    const showingUpcoming = !loading && today.length === 0 && upcoming.length > 0;
    const rows = today.length > 0 ? today : upcoming;

    return (
        <div className="rounded-xl border border-line bg-surface p-4 shadow-soft">
            <div className="flex items-center gap-2">
                <div className="grid size-7 shrink-0 place-items-center rounded-md bg-accent-warn-tint text-accent-warn-deep [&_svg]:size-3.5">
                    <Cake aria-hidden />
                </div>
                <p className="text-[13px] font-semibold text-ink">
                    {title}
                    {showingUpcoming && <span className="ml-1.5 font-normal text-ink-muted">(upcoming)</span>}
                </p>
            </div>

            {loading ? (
                <div className="mt-3 space-y-2">
                    {Array.from({ length: 3 }).map((_, i) => (
                        <Skeleton key={i} className="h-9 w-full rounded-lg" />
                    ))}
                </div>
            ) : rows.length === 0 ? (
                <p className="mt-3 text-[12px] text-ink-faint">{emptyLabel}</p>
            ) : (
                <ul className="mt-1 divide-y divide-line">
                    {rows.map(renderRow)}
                </ul>
            )}
        </div>
    );
}

/**
 * Student/staff birthday panels for the main dashboard. Follows whatever date
 * the dashboard's date picker is set to (not necessarily today), and falls
 * back to the nearest upcoming birthdays when nobody has one on that date —
 * see `dashboard.service.ts#getBirthdays` for the server-side fallback logic.
 */
export default function Birthdays({ selectedDate }: { selectedDate: string }) {
    const [data, setData] = useState<BirthdaysResponse | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        async function fetchBirthdays() {
            try {
                const url = getEnv('API_URL') || 'http://localhost:3000';
                const res = await authFetch(`${url}/dashboard/birthdays${selectedDate ? `?date=${selectedDate}` : ''}`);
                if (res.ok && !cancelled) setData(await res.json());
            } catch {
                // panel just stays empty — not worth a toast on the main dashboard
            } finally {
                if (!cancelled) setLoading(false);
            }
        }
        fetchBirthdays();
        return () => { cancelled = true; };
    }, [selectedDate]);

    return (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Panel
                title="Student birthdays"
                loading={loading}
                today={data?.students ?? []}
                upcoming={data?.upcoming.students ?? []}
                renderRow={(s: BirthdayStudent) => <StudentRow key={s.id} s={s} />}
                emptyLabel="No birthdays coming up."
            />
            <Panel
                title="Staff birthdays"
                loading={loading}
                today={data?.staff ?? []}
                upcoming={data?.upcoming.staff ?? []}
                renderRow={(s: BirthdayStaff) => <StaffRow key={s.id} s={s} />}
                emptyLabel="No birthdays coming up."
            />
        </div>
    );
}
