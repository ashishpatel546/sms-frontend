"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { hrApi, StaffAttendanceRecord, AttendanceBypassWindow, StaffBiometric, WebauthnRegistrationPermit, DailyAttendanceSummary, DailyAttendanceStatus, HrPendingCheckoutItem, AttendanceMethod } from "@/lib/hr-api";
import { useRbac } from "@/lib/rbac";
import { cn, todayLocalDate } from "@/lib/utils";
import { StatusChip } from "@/components/ui/StatusChip";
import { PIGMENT_CLASS, pigmentFor } from "@/components/ui/pigment";
import toast, { Toaster } from "react-hot-toast";
import Link from "next/link";
import StaffPicker from "@/components/StaffPicker";
import StaffLookupForm from "@/components/StaffLookupForm";
import StaffAttendanceModal from "@/components/StaffAttendanceModal";
import { InfoBanner } from "@/components/ui/InfoBanner";
import { AppTimePicker, AppDatePicker } from "@/components/ui/AppDatePicker";
import { MapPin, Fingerprint, ShieldAlert, PenLine, UserCog, TriangleAlert, Settings2, Clock3 } from "lucide-react";
import {
  attendanceSettingsApi,
  validateAttendanceSettings,
  DEFAULT_ATTENDANCE_SETTINGS,
  type AttendanceSettings,
} from "@/lib/attendance-settings-api";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
dayjs.extend(duration);

/**
 * `StaffAttendanceRecord` (in `hr-api.ts`) predates the `isLate` column —
 * extending it locally here avoids touching that shared file. Every record
 * the daily/monthly endpoints return now carries `isLate` alongside `status`.
 */
type AttendanceRow = Omit<StaffAttendanceRecord, "status"> & {
  isLate?: boolean;
  /** `NOT_MARKED` only ever arrives on the synthetic roster rows. */
  status: DailyAttendanceStatus;
};

const PAGE_SIZE = 20;

/** `null` is "everything on the register", not a status of its own. */
type StatusFilter = DailyAttendanceStatus | null;

/** `7.53` hours → `07:31:48`. */
function formatHoursAsHms(hours: number): string {
  const totalSeconds = Math.round(hours * 3600);
  const hh = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
  const mm = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
  const ss = String(totalSeconds % 60).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

/**
 * Worked duration for a record. The daily endpoint now computes `workedHours`
 * server-side (same helper the CSV/PDF report uses), so the table, the export
 * and the API can never disagree — subtracting the timestamps here is only the
 * fallback for payloads that predate that field.
 */
function calcDuration(record: Pick<AttendanceRow, "checkInTime" | "checkOutTime" | "workedHours">): string | null {
  const { checkInTime, checkOutTime, workedHours } = record;
  if (typeof workedHours === "number" && workedHours > 0) return formatHoursAsHms(workedHours);
  if (!checkInTime || !checkOutTime) return null;
  const inMs = dayjs(checkInTime).valueOf();
  const outMs = dayjs(checkOutTime).valueOf();
  if (outMs <= inMs) return null;
  const dur = dayjs.duration(outMs - inMs);
  const hh = String(Math.floor(dur.asHours())).padStart(2, "0");
  const mm = String(dur.minutes()).padStart(2, "0");
  const ss = String(dur.seconds()).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

/**
 * Duration for one row, plus the reason it can't be shown. A row with both
 * timestamps always renders something: the elapsed time, or a flag when the
 * stored checkout precedes the check-in (rows written before the backend
 * started rejecting that ordering). Silence was the original bug.
 */
function durationOf(r: AttendanceRow): { text: string | null; invalid: boolean } {
  const text = calcDuration(r);
  if (text) return { text, invalid: false };
  const bothPresent = Boolean(r.checkInTime && r.checkOutTime);
  return { text: null, invalid: bothPresent };
}

/** `HH:mm:ss` — the clock format the rest of this page already uses. */
function clock(iso?: string | null): string | null {
  if (!iso) return null;
  const d = dayjs(iso);
  return d.isValid() ? d.format("HH:mm:ss") : null;
}

/** How a check-in / check-out was proven: the word, the glyph, the ink. */
const METHOD_META: Record<AttendanceMethod, { label: string; Icon: typeof MapPin; tint: string }> = {
  GEOFENCE: { label: "Self (geo)", Icon: MapPin, tint: "text-emerald-600" },
  WEBAUTHN: { label: "Biometric", Icon: Fingerprint, tint: "text-indigo-600" },
  BYPASS: { label: "Bypass", Icon: ShieldAlert, tint: "text-amber-600" },
  MANUAL: { label: "Manual", Icon: PenLine, tint: "text-slate-500" },
};

/**
 * Mirrors the backend's `defaultResolvedCheckOut`:
 * `max(17:00 on the pending day, checkIn + 1h)`. The plain 17:00 default used
 * to store a checkout *before* an evening check-in, which is what blanked the
 * Duration column. `checkIn + 1h` can roll past midnight, so the date is
 * returned alongside the time.
 */
function defaultResolvedCheckOut(pendingDate: string, checkInTime: string): { checkOutDate: string; checkOutTime: string } {
  const endOfDay = dayjs(`${pendingDate}T17:00`);
  const minimum = dayjs(checkInTime).add(1, "hour");
  const chosen = endOfDay.isValid() && endOfDay.isAfter(minimum) ? endOfDay : minimum;
  return { checkOutDate: chosen.format("YYYY-MM-DD"), checkOutTime: chosen.format("HH:mm") };
}

const staffNameOf = (r: AttendanceRow) =>
  r.staff?.user ? `${r.staff.user.firstName} ${r.staff.user.lastName}` : `Staff #${r.staffId}`;

interface Provenance {
  label: string;
  Icon: typeof MapPin;
  tint: string;
  /** The person who recorded it — only set when that isn't the staff member. */
  actorName: string | null;
}

/**
 * "How, and by whom" for ONE side of a record. `method`/`markedBy` describe the
 * check-in, `checkOutMethod`/`checkOutBy` the check-out: a record can be
 * self-checked-in and admin-checked-out, and keeping the two sides apart is
 * what stops an HR-closed row from claiming "Self check-in (geo)".
 *
 * The actor is named only when it isn't the staff member themselves — every
 * self check-in stamps `markedById` with the staff member's own user, so
 * printing it unconditionally would put a name on every row and make the one
 * row an admin touched invisible. Ids are compared when the joined user id is
 * in the payload, names otherwise.
 */
function describeSource(
  method: AttendanceMethod | null | undefined,
  actor: { id: number; firstName: string; lastName: string } | undefined,
  staffUserId: number | undefined,
  staffName: string,
): Provenance {
  const meta = method ? METHOD_META[method] : undefined;
  const base = meta ?? { label: method ?? "Unknown", Icon: PenLine, tint: "text-gray-400" };
  if (!actor) return { ...base, actorName: null };
  const actorName = `${actor.firstName} ${actor.lastName}`.trim();
  const isSelf = staffUserId != null ? actor.id === staffUserId : actorName === staffName;
  return { ...base, actorName: isSelf || !actorName ? null : actorName };
}

const checkInSource = (r: AttendanceRow): Provenance =>
  describeSource(r.method, r.markedBy, r.staff?.user?.id, staffNameOf(r));

/** Null while the record is still open — there is no check-out to describe. */
const checkOutSource = (r: AttendanceRow): Provenance | null =>
  r.checkOutTime ? describeSource(r.checkOutMethod, r.checkOutBy, r.staff?.user?.id, staffNameOf(r)) : null;

/** `475` minutes → `7h 55m`. Used for the "that's how long they worked" preview. */
function formatSpan(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h <= 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

/** Same wording as the backend's 400, so client and server feedback match. */
function checkOutOrderingMessage(checkIn: dayjs.Dayjs, checkOut: dayjs.Dayjs, date: string): string {
  return (
    `Check-out time (${checkOut.format("hh:mm A")}) cannot be earlier than ` +
    `check-in time (${checkIn.format("hh:mm A")}) on ${date}. ` +
    `Please choose a time after check-in.`
  );
}

const DURATION_TEXT: Record<string, string> = {
  PRESENT: "text-green-700 font-medium",
  LATE: "text-amber-700 font-medium",
  HALF_DAY: "text-blue-700 font-medium",
  ON_LEAVE: "text-purple-700",
  ABSENT: "text-red-500",
};

/**
 * The provenance line under a timestamp: glyph, method, and — only when
 * somebody other than the staff member recorded it — their name in amber, so a
 * row an admin touched is the one that catches the eye while a page of
 * ordinary self check-ins stays quiet.
 *
 * Purely presentational and prop-driven: no refs, no effects, safe to render
 * twice (the shared DataTable does exactly that to every cell).
 */
function SourceStamp({ source }: { source: Provenance }) {
  const { Icon } = source;
  return (
    <span className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] leading-tight">
      <span className="inline-flex items-center gap-1 text-gray-500">
        <Icon aria-hidden className={`h-3 w-3 shrink-0 ${source.tint}`} />
        {source.label}
      </span>
      {source.actorName && (
        <span className="inline-flex items-center gap-1 font-medium text-amber-700">
          <UserCog aria-hidden className="h-3 w-3 shrink-0" />
          by {source.actorName}
        </span>
      )}
    </span>
  );
}

/**
 * One side of the register entry — the time it happened stacked over how it
 * was proven. Merging the two into a single column is what lets the table
 * carry the new audit trail without growing wider than a tablet.
 */
function EventCell({
  time,
  source,
  nextDay,
  late,
  emptyLabel,
}: {
  time: string | null;
  source: Provenance | null;
  /** Set when a check-out landed on a later calendar day than the record. */
  nextDay?: boolean;
  /**
   * `record.isLate` — a check-in-time fact, independent of `status`. Only
   * meaningful on the check-in side; callers rendering a check-out cell
   * simply omit this prop.
   */
  late?: boolean;
  emptyLabel: string;
}) {
  if (!time) {
    return <span className="text-xs text-gray-400">{emptyLabel}</span>;
  }
  return (
    <span className="flex flex-col gap-1">
      <span className="flex items-center gap-1.5">
        <span className="tabular-nums text-gray-900">{time}</span>
        {nextDay && (
          <span className="rounded bg-amber-100 px-1 py-px text-[10px] font-semibold text-amber-700">+1d</span>
        )}
        {late && (
          <span
            title="Checked in after the school's late cutoff time"
            className="inline-flex items-center gap-0.5 rounded-full bg-amber-100 px-1.5 py-px text-[10px] font-semibold text-amber-700"
          >
            <Clock3 aria-hidden className="h-2.5 w-2.5" />
            Late
          </span>
        )}
      </span>
      {source && <SourceStamp source={source} />}
    </span>
  );
}

interface Tally {
  key: StatusFilter;
  label: string;
  count: number;
}

/**
 * The day's totals, and the filter, as one control — the tally line at the
 * foot of a paper register, made clickable. Colour comes from the shared
 * pigment map, so a "Present" tally, the "Present" chip in the table and a
 * "Present" badge anywhere else in the app are the same green by construction.
 *
 * These are toggle buttons (`aria-pressed`), not ARIA tabs: below them is one
 * table whose contents change, not eight panels, and toggles get correct
 * keyboard behaviour without a hand-rolled roving tabindex. Every button is
 * 44px tall and the strip scrolls inside itself on a phone rather than
 * widening the page.
 */
function TallyStrip({
  tallies,
  active,
  onChange,
}: {
  tallies: Tally[];
  active: StatusFilter;
  onChange: (next: StatusFilter) => void;
}) {
  return (
    <div
      role="group"
      aria-label="Filter the register by status"
      /* `overflow-x-auto` forces overflow-y to `auto` too (CSS resolves a
         `visible` axis to `auto` when the other axis is not visible), so any
         emphasis painted OUTSIDE a button box — a box-shadow ring, an outline —
         gets sliced off at the strip's top and bottom edges. Hence `ring-inset`
         on the active pill below and `ring-inset` on focus: everything stays
         inside the button. `py-1` keeps the pills off the scroll edges. */
      className="-mx-3 flex gap-2 overflow-x-auto px-3 py-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0"
    >
      {tallies.map(({ key, label, count }) => {
        const p = PIGMENT_CLASS[key ? pigmentFor(key) : "neutral"];
        const isActive = active === key;
        return (
          <button
            key={label}
            type="button"
            aria-pressed={isActive}
            onClick={() => onChange(isActive ? null : key)}
            className={cn(
              "inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border px-3.5 text-sm transition-colors",
              "focus-visible:ring-brand focus-visible:ring-2 focus-visible:ring-inset focus-visible:outline-none",
              isActive
                ? cn(p.chip, "ring-brand/45 font-semibold ring-2 ring-inset")
                : "border-line bg-surface text-ink-soft hover:border-line-strong hover:bg-surface-secondary",
            )}
          >
            <span aria-hidden className={cn("size-2 shrink-0 rounded-full", p.dot)} />
            <span className="whitespace-nowrap">{label}</span>
            <span className={cn("tabular text-[13px] font-semibold", !isActive && "text-ink")}>
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export default function StaffAttendancePage() {
  const rbac = useRbac();
  const today = todayLocalDate();

  const [date, setDate] = useState(today);
  const [records, setRecords] = useState<AttendanceRow[]>([]);
  const [bypass, setBypass] = useState<AttendanceBypassWindow | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  /** Watched by an IntersectionObserver to pull the next page into view. */
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  // Pagination + server-side search
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [summary, setSummary] = useState<DailyAttendanceSummary>({ PRESENT: 0, LATE: 0, ABSENT: 0, HALF_DAY: 0, ON_LEAVE: 0, HOLIDAY: 0 });
  // Real "checked in after the cutoff today" count — see the field doc on
  // PaginatedDailyAttendance.lateArrivals for why this isn't summary.LATE.
  const [lateArrivals, setLateArrivals] = useState(0);
  /** Everyone on the register for the date — people, not attendance records. */
  const [totalStaff, setTotalStaff] = useState(0);
  const [draftSearch, setDraftSearch] = useState({ name: "", mobile: "", employeeCode: "", staffId: "" });
  const [activeSearch, setActiveSearch] = useState({ name: "", mobile: "", employeeCode: "", staffId: "" });
  /** Which tally is open. Narrows the table only — the counts stay whole-day. */
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(null);

  // Manual mark form
  const [showMark, setShowMark] = useState(false);
  const [markStaffId, setMarkStaffId] = useState<number | null>(null);
  const [markStaffLabel, setMarkStaffLabel] = useState<string>("");
  const [markSearchMode, setMarkSearchMode] = useState<"quick" | "explicit">("quick");
  const [markDate, setMarkDate] = useState<string>(today);
  const [markForm, setMarkForm] = useState({ status: "PRESENT", method: "MANUAL", checkInTime: "", checkOutTime: "", overrideReason: "" });

  // View-month modal
  const [viewStaff, setViewStaff] = useState<{ id: number; label: string } | null>(null);

  // Bypass form
  const [showBypass, setShowBypass] = useState(false);
  const [bypassForm, setBypassForm] = useState<{ reason: string; durationHours: number | string }>({ reason: "", durationHours: 8 });

  // Biometric management
  const [showBiometrics, setShowBiometrics] = useState(false);
  const [allCredentials, setAllCredentials] = useState<StaffBiometric[]>([]);
  const [permits, setPermits] = useState<WebauthnRegistrationPermit[]>([]);
  const [permitTargetId, setPermitTargetId] = useState<number | null>(null);
  const [bioLoading, setBioLoading] = useState(false);

  // Working-hours report download
  const [showReport, setShowReport] = useState(false);
  const [reportForm, setReportForm] = useState<{ from: string; to: string; staffId: number | null }>({
    from: `${today.slice(0, 8)}01`,
    to: today,
    staffId: null,
  });
  const [reportBusy, setReportBusy] = useState<null | "csv" | "pdf">(null);

  // Pending checkouts
  const [showPendingCheckouts, setShowPendingCheckouts] = useState(false);
  const [pendingCheckoutsList, setPendingCheckoutsList] = useState<HrPendingCheckoutItem[]>([]);
  const [pendingCheckoutsLoading, setPendingCheckoutsLoading] = useState(false);
  const [resolveTarget, setResolveTarget] = useState<HrPendingCheckoutItem | null>(null);
  const [resolveForm, setResolveForm] = useState({ checkOutDate: "", checkOutTime: "17:00", reason: "FORGOT", hrNote: "", status: "PRESENT" });
  const [resolving, setResolving] = useState(false);

  // Attendance settings (thresholds + late cutoff) — HR_ADMIN+ only
  const [showSettings, setShowSettings] = useState(false);
  const [settingsForm, setSettingsForm] = useState<AttendanceSettings>(DEFAULT_ATTENDANCE_SETTINGS);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);

  /** The query the list is currently showing — everything except the page. */
  const queryArgs = useMemo(
    () => ({
      search: [activeSearch.name, activeSearch.mobile].filter(Boolean).join(" ").trim() || undefined,
      employeeCode: activeSearch.employeeCode || undefined,
      staffId: activeSearch.staffId || undefined,
      status: statusFilter ?? undefined,
    }),
    [activeSearch, statusFilter],
  );

  /**
   * Page 1: replaces the list. Runs whenever the date, the search or the open
   * tally changes. The bypass window rides along because it is the only other
   * thing this screen needs on first paint.
   */
  const loadRecords = useCallback(async () => {
    setLoading(true);
    try {
      const [recs, bp] = await Promise.allSettled([
        hrApi.attendance.daily(date, { page: 1, limit: PAGE_SIZE, ...queryArgs }),
        hrApi.attendance.bypass.getActive(),
      ]);
      if (recs.status === "fulfilled") {
        setRecords(recs.value.data as AttendanceRow[]);
        setCurrentPage(1);
        setTotalPages(recs.value.totalPages);
        setTotalRecords(recs.value.total);
        setSummary(recs.value.summary);
        setLateArrivals(recs.value.lateArrivals ?? 0);
        setTotalStaff(recs.value.totalStaff ?? recs.value.total);
      }
      if (bp.status === "fulfilled") setBypass(bp.value);
    } catch { toast.error("Failed to load attendance"); }
    finally { setLoading(false); }
  }, [date, queryArgs]);

  useEffect(() => { loadRecords(); }, [loadRecords]);

  const hasMore = currentPage < totalPages;

  /**
   * Appends the next page. The register now lists every staff member rather
   * than only the marked ones, so a large school runs to hundreds of rows —
   * they arrive as you scroll instead of behind numbered page links.
   */
  const loadMore = useCallback(async () => {
    if (loading || loadingMore || currentPage >= totalPages) return;
    setLoadingMore(true);
    try {
      const next = currentPage + 1;
      const res = await hrApi.attendance.daily(date, { page: next, limit: PAGE_SIZE, ...queryArgs });
      // Guard against a row arriving twice if a record was written between
      // pages and shifted the offset.
      setRecords((prev) => {
        const seen = new Set(prev.map((r) => r.id));
        return [...prev, ...(res.data as AttendanceRow[]).filter((r) => !seen.has(r.id))];
      });
      setCurrentPage(next);
      setTotalPages(res.totalPages);
      setTotalRecords(res.total);
    } catch { toast.error("Failed to load more staff"); }
    finally { setLoadingMore(false); }
  }, [date, queryArgs, currentPage, totalPages, loading, loadingMore]);

  /**
   * Auto-loads when the sentinel nears the viewport. The Load more button
   * below it stays in the DOM and does the same job — an IntersectionObserver
   * alone would leave keyboard and screen-reader users with no way to reach
   * page two.
   */
  useEffect(() => {
    const el = loadMoreRef.current;
    if (!el || !hasMore) return;
    const io = new IntersectionObserver(
      (entries) => { if (entries[0]?.isIntersecting) void loadMore(); },
      { rootMargin: "300px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, loadMore]);

  /**
   * The manual form can set both sides at once, so it needs the same ordering
   * check the resolve dialog and the backend apply — caught here purely for
   * immediate feedback; the server still has the last word.
   */
  const markCheckIn = markForm.checkInTime ? dayjs(`${markDate}T${markForm.checkInTime}`) : null;
  const markCheckOut = markForm.checkOutTime ? dayjs(`${markDate}T${markForm.checkOutTime}`) : null;
  const markError =
    markCheckIn?.isValid() && markCheckOut?.isValid() && !markCheckOut.isAfter(markCheckIn)
      ? checkOutOrderingMessage(markCheckIn, markCheckOut, markDate)
      : null;
  const markPreview =
    !markError && markCheckIn?.isValid() && markCheckOut?.isValid()
      ? formatSpan(markCheckOut.diff(markCheckIn, "minute"))
      : null;

  const handleMark = async () => {
    if (!markStaffId) { toast.error("Please select a staff member"); return; }
    if (!markDate) { toast.error("Please select a date"); return; }
    if (markError) { toast.error(markError); return; }
    try {
      const checkInIso = markForm.checkInTime ? dayjs(`${markDate}T${markForm.checkInTime}`).toISOString() : undefined;
      const checkOutIso = markForm.checkOutTime ? dayjs(`${markDate}T${markForm.checkOutTime}`).toISOString() : undefined;

      await hrApi.attendance.submit({
        staffId: markStaffId,
        date: markDate,
        method: markForm.method as any,
        status: markForm.status as any,
        checkInTime: checkInIso,
        checkOutTime: checkOutIso,
        overrideReason: markForm.overrideReason || undefined,
      });
      toast.success("Attendance marked");
      setShowMark(false);
      // If the marked date matches the page's currently-viewed date, refresh the daily list.
      if (markDate === date) {
        loadRecords();
      }
    } catch (e: any) { toast.error(e?.info?.message ?? "Failed"); }
  };

  const handleBypass = async () => {
    try {
      const bp = await hrApi.attendance.bypass.create({ ...bypassForm, durationHours: Math.min(Math.max(Number(bypassForm.durationHours) || 1, 1), 24) });
      setBypass(bp);
      toast.success("Bypass window created");
      setShowBypass(false);
    } catch (e: any) { toast.error(e?.info?.message ?? "Failed"); }
  };

  const handleCloseBypass = async () => {
    if (!confirm("Close the active bypass window? Geofence enforcement will resume immediately.")) return;
    try {
      await hrApi.attendance.bypass.close();
      setBypass(null);
      toast.success("Bypass window closed");
    } catch (e: any) { toast.error(e?.info?.message ?? "Failed to close bypass window"); }
  };

  const loadBiometrics = useCallback(async () => {
    setBioLoading(true);
    try {
      const [creds, perms] = await Promise.all([
        hrApi.attendance.webauthn.allCredentials(),
        hrApi.attendance.webauthn.listPermits(),
      ]);
      setAllCredentials(creds);
      setPermits(perms);
    } catch { toast.error("Failed to load biometric data"); }
    finally { setBioLoading(false); }
  }, []);

  const handleGrantPermit = async () => {
    if (!permitTargetId) { toast.error("Select a staff member"); return; }
    try {
      await hrApi.attendance.webauthn.grantPermit(permitTargetId);
      toast.success("Registration permission granted (48 hours)");
      setPermitTargetId(null);
      loadBiometrics();
    } catch (e: any) { toast.error(e?.info?.message ?? "Failed"); }
  };

  const handleRevokePermit = async (staffId: number) => {
    try {
      await hrApi.attendance.webauthn.revokePermitByStaff(staffId);
      toast.success("Permission revoked");
      loadBiometrics();
    } catch { toast.error("Failed to revoke"); }
  };

  const handleDeleteCredential = async (id: number) => {
    if (!confirm("Delete this biometric credential? The staff member will need to re-register.")) return;
    try {
      await hrApi.attendance.webauthn.deleteCredential(id);
      toast.success("Credential deleted");
      loadBiometrics();
    } catch { toast.error("Failed to delete"); }
  };

  const loadPendingCheckouts = useCallback(async () => {
    setPendingCheckoutsLoading(true);
    try {
      const items = await hrApi.attendance.pendingCheckouts();
      setPendingCheckoutsList(items);
    } catch { /* non-HR users receive 403 — silently ignore */ }
    finally { setPendingCheckoutsLoading(false); }
  }, []);

  useEffect(() => { loadPendingCheckouts(); }, [loadPendingCheckouts]);

  /**
   * Opens the resolve dialog with the same default the backend would apply —
   * `max(17:00, checkIn + 1h)` — instead of a flat 17:00 that silently lands
   * before an evening check-in.
   */
  const openResolve = (item: HrPendingCheckoutItem) => {
    const { checkOutDate, checkOutTime } = defaultResolvedCheckOut(item.date, item.checkInTime);
    setResolveTarget(item);
    setResolveForm({ checkOutDate, checkOutTime, reason: "FORGOT", hrNote: "", status: "PRESENT" });
  };

  const resolveCheckIn = resolveTarget ? dayjs(resolveTarget.checkInTime) : null;
  const resolveCheckOut =
    resolveForm.checkOutDate && resolveForm.checkOutTime
      ? dayjs(`${resolveForm.checkOutDate}T${resolveForm.checkOutTime}`)
      : null;
  /** Client-side echo of the backend's ordering rule, so the error lands before the request does. */
  const resolveError =
    resolveTarget && resolveCheckIn && resolveCheckOut?.isValid() && !resolveCheckOut.isAfter(resolveCheckIn)
      ? checkOutOrderingMessage(resolveCheckIn, resolveCheckOut, resolveTarget.date)
      : null;
  const resolvePreview =
    !resolveError && resolveCheckIn && resolveCheckOut?.isValid()
      ? formatSpan(resolveCheckOut.diff(resolveCheckIn, "minute"))
      : null;

  const handleHrResolve = async () => {
    if (!resolveTarget) return;
    if (resolveError) { toast.error(resolveError); return; }
    setResolving(true);
    try {
      const checkOutTime = resolveForm.checkOutTime && resolveForm.checkOutDate
        ? dayjs(`${resolveForm.checkOutDate}T${resolveForm.checkOutTime}`).toISOString()
        : undefined;
      await hrApi.attendance.hrResolvePending({
        staffId: resolveTarget.staffId,
        pendingDate: resolveTarget.date,
        checkOutTime,
        reason: resolveForm.reason,
        hrNote: resolveForm.hrNote || undefined,
        status: resolveForm.status as any,
      });
      toast.success(`Checkout closed for ${resolveTarget.name}`);
      setResolveTarget(null);
      loadPendingCheckouts();
      if (resolveTarget.date === date) loadRecords();
    } catch (e: any) {
      toast.error(e?.info?.message ?? "Failed to resolve checkout");
    } finally { setResolving(false); }
  };

  const openSettings = () => {
    setShowSettings(true);
    setSettingsLoading(true);
    attendanceSettingsApi
      .get()
      .then((s) => setSettingsForm(s))
      .catch(() => toast.error("Failed to load attendance settings"))
      .finally(() => setSettingsLoading(false));
  };

  /** Mirrors the server's rule (half-day threshold < full-day threshold) so the error lands before the request does. */
  const settingsError = validateAttendanceSettings(settingsForm);

  const handleSaveSettings = async () => {
    if (settingsError) { toast.error(settingsError); return; }
    setSettingsSaving(true);
    try {
      const updated = await attendanceSettingsApi.update(settingsForm);
      setSettingsForm(updated);
      toast.success("Attendance settings updated");
      setShowSettings(false);
    } catch (e) {
      const info = (e as { info?: { message?: string } } | undefined)?.info;
      toast.error(info?.message ?? "Failed to update attendance settings");
    } finally {
      setSettingsSaving(false);
    }
  };

  const REPORT_MAX_DAYS = 92;

  const validateReportRange = (): boolean => {
    if (!reportForm.from || !reportForm.to) {
      toast.error("Select both dates");
      return false;
    }
    if (reportForm.from > reportForm.to) {
      toast.error("'From' must be on or before 'To'");
      return false;
    }
    const span = dayjs(reportForm.to).diff(dayjs(reportForm.from), "day") + 1;
    if (span > REPORT_MAX_DAYS) {
      toast.error(`Date range too large — maximum ${REPORT_MAX_DAYS} days`);
      return false;
    }
    return true;
  };

  const handleReportCsv = async () => {
    if (!validateReportRange()) return;
    setReportBusy("csv");
    try {
      await hrApi.attendance.exportReportCsv({
        from: reportForm.from,
        to: reportForm.to,
        staffId: reportForm.staffId ?? undefined,
      });
      toast.success("Report downloaded");
    } catch (e: any) {
      toast.error(e?.info?.message ?? "Failed to download report");
    } finally {
      setReportBusy(null);
    }
  };

  const handleReportPdf = async () => {
    if (!validateReportRange()) return;
    setReportBusy("pdf");
    try {
      const report = await hrApi.attendance.getReport({
        from: reportForm.from,
        to: reportForm.to,
        staffId: reportForm.staffId ?? undefined,
      });
      const { buildAttendanceReportPdf } = await import("@/lib/attendance-report-pdf");
      buildAttendanceReportPdf(report);
      toast.success("Report downloaded");
    } catch (e: any) {
      toast.error(e?.info?.message ?? "Failed to download report");
    } finally {
      setReportBusy(null);
    }
  };

  /**
   * Legacy `status === 'LATE'` rows fold into Present, the same way the
   * working-hours report and the backend's `status=PRESENT` filter do — so the
   * number on the button and the rows behind it always match.
   */
  const present = summary.PRESENT + summary.LATE;
  const notMarked = summary.NOT_MARKED ?? 0;
  /**
   * Everyone the register covers, marked or not — `totalStaff` now counts
   * people rather than records. "All" used to be the record count, which at a
   * school that never marks anyone absent made it a synonym for "Present".
   */
  const rosterTotal = totalStaff;

  const tallies: Tally[] = [
    { key: null, label: "All", count: rosterTotal },
    { key: "NOT_MARKED", label: "Not marked", count: notMarked },
    { key: "PRESENT", label: "Present", count: present },
    { key: "LATE", label: "Late", count: lateArrivals },
    { key: "HALF_DAY", label: "Half day", count: summary.HALF_DAY },
    { key: "ON_LEAVE", label: "On leave", count: summary.ON_LEAVE },
    { key: "ABSENT", label: "Absent", count: summary.ABSENT },
    // Holidays are rare and a zero here says nothing — the button appears on
    // the days it means something, rather than sitting at 0 all year.
    ...(summary.HOLIDAY > 0 || statusFilter === "HOLIDAY"
      ? [{ key: "HOLIDAY" as StatusFilter, label: "Holiday", count: summary.HOLIDAY }]
      : []),
  ];

  const activeTallyLabel = tallies.find((t) => t.key === statusFilter)?.label ?? "";

  /** Changing the filter re-runs page 1 via `loadRecords`; no reset needed here. */
  const chooseStatus = (next: StatusFilter) => setStatusFilter(next);

  const hasActiveSearch = Boolean(activeSearch.name || activeSearch.mobile || activeSearch.employeeCode || activeSearch.staffId);

  /**
   * Opens "Mark Manually" already pointed at one person on the date being
   * viewed — the action a "Not marked" row exists to prompt.
   */
  const openMarkFor = (staffId: number, label: string) => {
    setMarkSearchMode("quick");
    setMarkStaffId(staffId);
    setMarkStaffLabel(label);
    setMarkDate(date);
    setMarkForm({ status: "PRESENT", method: "MANUAL", checkInTime: "", checkOutTime: "", overrideReason: "" });
    setShowMark(true);
  };

  const applySearch = () => {
    const next = { ...draftSearch };
    if (!next.name && !next.mobile && !next.employeeCode && !next.staffId) {
      toast("Enter at least one search field.");
      return;
    }
    setActiveSearch(next);
  };

  const clearSearch = () => {
    const empty = { name: "", mobile: "", employeeCode: "", staffId: "" };
    setDraftSearch(empty);
    setActiveSearch(empty);
  };

  return (
    <div className="p-3 sm:p-6 space-y-4">
      <Toaster />
      <div className="space-y-2 sm:space-y-0 sm:flex sm:flex-wrap sm:items-center sm:justify-between sm:gap-2">
        <h1 className="font-display text-[22px] sm:text-[26px] font-semibold tracking-[-0.02em] text-ink">Staff Attendance</h1>
        <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2">
          <Link href="/dashboard/hr/staff-attendance/kiosk" className="bg-slate-700 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-slate-800 text-center">
            Kiosk Mode
          </Link>
          <Link href="/dashboard/hr/staff-attendance/zones" className="bg-teal-600 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-teal-700 text-center">
            Geo-Zones
          </Link>
          <Link href="/dashboard/hr/staff-attendance/devices" className="bg-violet-600 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-violet-700 text-center">
            Device Registrations
          </Link>
          {rbac.canManageHR && (
            <>
              <button
                onClick={openSettings}
                className="inline-flex items-center justify-center gap-1.5 bg-slate-800 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-slate-900"
              >
                <Settings2 aria-hidden className="h-4 w-4" />
                Settings
              </button>
              <button
                onClick={() => { setShowBiometrics((v) => !v); if (!showBiometrics) loadBiometrics(); }}
                className="bg-indigo-600 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700"
              >
                Biometrics
              </button>
              <button
                onClick={() => setShowPendingCheckouts((v) => !v)}
                className={`relative px-3 py-2 rounded-lg text-sm font-medium text-white ${
                  pendingCheckoutsList.length > 0
                    ? "bg-red-600 hover:bg-red-700"
                    : "bg-orange-500 hover:bg-orange-600"
                }`}
              >
                Pending Checkouts
                {pendingCheckoutsList.length > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 bg-white text-red-600 text-[10px] font-bold leading-none rounded-full w-5 h-5 flex items-center justify-center border border-red-200">
                    {pendingCheckoutsList.length}
                  </span>
                )}
              </button>
              <button onClick={() => setShowReport(true)} className="bg-emerald-600 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700">
                Download Report
              </button>
              <button onClick={() => setShowBypass(true)} className="bg-amber-500 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-amber-600">
                {bypass ? "Bypass Active — New" : "Open Bypass Window"}
              </button>
              {bypass && (
                <button onClick={handleCloseBypass} className="bg-red-600 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-red-700">
                  Close Bypass Window
                </button>
              )}
              <button onClick={() => { setMarkDate(today); setShowMark(true); }} className="bg-blue-600 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 col-span-2 sm:col-auto">
                + Mark Manually
              </button>
            </>
          )}
        </div>
      </div>

      {/* Info Banner */}
      <InfoBanner title="About Staff Attendance">
        View daily attendance records for all staff. Staff can mark attendance via the <strong>WebAuthn Kiosk</strong> (fingerprint/face at main entrance) or through <strong>Geo-Fence check-in</strong> from their mobile.
        Use <strong>Mark Manually</strong> to record or override attendance (e.g., for a field visit).
        Open a <strong>Bypass Window</strong> to temporarily allow PIN-based marking when biometric devices are offline.
        Configure the allowed campus geo-zones via <strong>Geo-Zones</strong>.
        The tallies under the date are also the filter: tap <strong>Not marked</strong> to list the staff who have no
        record for the day yet and mark them from there, or any other tally to see just those people.
        The <strong>Check-in</strong> and <strong>Check-out</strong> columns each show how that half was recorded, and name the
        admin when someone other than the staff member recorded it. A small <strong>Late</strong> badge on a check-in means
        that staff member arrived after the late cutoff — it is tracked separately from Status, which is now decided purely
        by hours worked (PRESENT / HALF_DAY / ABSENT). Use <strong>Settings</strong> to change the full/half-day hour
        thresholds and the late cutoff time.
      </InfoBanner>

      {/* Bypass info */}
      {bypass && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
          Bypass window active — expires {new Date(bypass.expiresAt).toLocaleString()}. Staff can mark attendance without biometrics.
        </div>
      )}

      {/* Biometric management panel */}
      {showBiometrics && rbac.canManageHR && (
        <div className="border border-indigo-200 rounded-xl overflow-hidden">
          <div className="bg-indigo-50 px-5 py-3 flex items-center justify-between">
            <p className="text-sm font-semibold text-indigo-900">Biometric Device Management</p>
            <button onClick={() => setShowBiometrics(false)} className="text-indigo-400 hover:text-indigo-700 text-xs">Close ✕</button>
          </div>
          <div className="p-5 space-y-5 bg-white">
            {bioLoading ? <p className="text-sm text-gray-500">Loading…</p> : (
              <>
                {/* Grant registration permission */}
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Allow Device Registration</p>
                  <p className="text-xs text-gray-500">Select a staff member to allow them to register their device for 48 hours. Once they register, the permission is consumed automatically.</p>
                  <div className="flex gap-2 items-end">
                    <div className="flex-1">
                      <StaffPicker label="Staff Member" value={permitTargetId} onChange={(id) => setPermitTargetId(id)} />
                    </div>
                    <button onClick={handleGrantPermit} className="bg-indigo-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-indigo-700 whitespace-nowrap">
                      Grant Permission
                    </button>
                  </div>
                </div>

                {/* Active permits */}
                {permits.filter((p) => !p.usedAt && new Date(p.expiresAt) > new Date()).length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Active Permissions</p>
                    <div className="space-y-1.5">
                      {permits
                        .filter((p) => !p.usedAt && new Date(p.expiresAt) > new Date())
                        .map((p) => (
                          <div key={p.id} className="flex items-center justify-between bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                            <div>
                              <p className="text-xs font-medium text-amber-800">Staff ID #{p.staffId}</p>
                              <p className="text-xs text-amber-600">Expires {new Date(p.expiresAt).toLocaleString()}</p>
                            </div>
                            <button onClick={() => handleRevokePermit(p.staffId)} className="text-red-500 hover:text-red-700 text-xs">Revoke</button>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {/* Registered credentials */}
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
                    Registered Devices ({allCredentials.length})
                  </p>
                  {allCredentials.length === 0 ? (
                    <p className="text-xs text-gray-400">No devices registered yet. Grant permission to a staff member so they can register from My Attendance.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {allCredentials.map((c) => (
                        <div key={c.id} className="flex items-center justify-between border border-gray-200 rounded-lg px-3 py-2">
                          <div>
                            <p className="text-sm font-medium text-gray-800">
                              {c.staff?.user
                                ? `${c.staff.user.firstName} ${c.staff.user.lastName} (#${c.staff.employeeCode})`
                                : `Staff #${c.staffId}`}
                            </p>
                            <p className="text-xs text-gray-400">
                              {c.deviceName || "Unnamed"} — registered {new Date(c.registeredAt).toLocaleDateString()}
                            </p>
                          </div>
                          <button onClick={() => handleDeleteCredential(c.id)} className="text-red-500 hover:text-red-700 text-xs ml-4">Delete</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
      {/* Pending checkouts panel */}
      {showPendingCheckouts && rbac.canManageHR && (
        <div className="border border-orange-200 rounded-xl overflow-hidden">
          <div className="bg-orange-50 px-5 py-3 flex items-center justify-between">
            <p className="text-sm font-semibold text-orange-900">
              Pending Checkouts{pendingCheckoutsList.length > 0 ? ` (${pendingCheckoutsList.length})` : ""}
            </p>
            <button onClick={() => setShowPendingCheckouts(false)} className="text-orange-400 hover:text-orange-700 text-xs">Close ✕</button>
          </div>
          <div className="p-5 bg-white">
            {pendingCheckoutsLoading ? (
              <p className="text-sm text-gray-500">Loading…</p>
            ) : pendingCheckoutsList.length === 0 ? (
              <p className="text-sm text-gray-500">No pending checkouts — all staff check-ins are resolved.</p>
            ) : (
              <div className="space-y-4">
                <p className="text-xs text-gray-500">
                  {pendingCheckoutsList.length} staff member{pendingCheckoutsList.length !== 1 ? "s" : ""} have an open check-in with no checkout recorded.
                </p>
                {/* Desktop table */}
                <div className="hidden sm:block overflow-x-auto rounded-lg border border-gray-200">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
                      <tr>
                        <th className="px-4 py-2.5 text-left">Staff</th>
                        <th className="px-4 py-2.5 text-left">Date</th>
                        <th className="px-4 py-2.5 text-left">Checked In At</th>
                        <th className="px-4 py-2.5 text-left">Days Open</th>
                        <th className="px-4 py-2.5 text-left">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {pendingCheckoutsList.map((item) => (
                        <tr key={`${item.staffId}-${item.date}`} className="hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <p className="font-medium text-gray-900">{item.name}</p>
                            {item.employeeCode && <p className="text-xs text-gray-500">EMP-{item.employeeCode}</p>}
                          </td>
                          <td className="px-4 py-3 tabular-nums text-gray-700">{item.date}</td>
                          <td className="px-4 py-3 tabular-nums text-gray-700">{dayjs(item.checkInTime).format('HH:mm:ss')}</td>
                          <td className="px-4 py-3">
                            <span className={`text-xs font-semibold ${item.daysAgo > 1 ? "text-red-600" : "text-amber-600"}`}>
                              {item.daysAgo}d
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <button
                              onClick={() => openResolve(item)}
                              className="text-xs bg-orange-600 hover:bg-orange-700 text-white px-3 py-1.5 rounded-lg font-medium"
                            >
                              Close Checkout
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {/* Mobile cards */}
                <div className="sm:hidden space-y-2">
                  {pendingCheckoutsList.map((item) => (
                    <div key={`${item.staffId}-${item.date}`} className="border border-gray-200 rounded-xl p-3 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-medium text-gray-900 text-sm">{item.name}</p>
                          {item.employeeCode && <p className="text-xs text-gray-500">EMP-{item.employeeCode}</p>}
                        </div>
                        <span className={`text-xs font-semibold shrink-0 ${item.daysAgo > 1 ? "text-red-600" : "text-amber-600"}`}>{item.daysAgo}d ago</span>
                      </div>
                      <p className="text-xs text-gray-600">{item.date} · checked in {dayjs(item.checkInTime).format('HH:mm:ss')}</p>
                      <button
                        onClick={() => openResolve(item)}
                        className="text-xs bg-orange-600 hover:bg-orange-700 text-white px-3 py-1.5 rounded-lg font-medium"
                      >
                        Close Checkout
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      {/* The day's register: pick a date, then read — or open — its tallies. */}
      <div className="bg-surface border-line space-y-3 rounded-xl border p-3 sm:p-4">
        <div className="flex flex-wrap items-center gap-3">
          <label htmlFor="register-date" className="text-ink-soft text-sm font-medium">
            Register for
          </label>
          <input
            id="register-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="border-line min-h-11 rounded-lg border px-3 py-2 text-sm"
          />
          {hasActiveSearch && (
            <span className="bg-accent-info-tint text-accent-info-deep border-accent-info-edge rounded-full border px-2.5 py-1 text-xs">
              {totalRecords} result{totalRecords === 1 ? "" : "s"} for your search
            </span>
          )}
        </div>

        <TallyStrip tallies={tallies} active={statusFilter} onChange={chooseStatus} />

        <p className="text-ink-muted text-xs">
          <strong className="text-ink-soft font-semibold">All</strong> lists every one of the{" "}
          {rosterTotal} staff on the register for this date, marked or not.{" "}
          {notMarked > 0
            ? `${notMarked} ${notMarked === 1 ? "has" : "have"} no record yet.`
            : "Everyone has a record."}{" "}
          A late arrival still counts under Present or Half day: Late counts check-in
          time, not the day&apos;s outcome.
        </p>
      </div>

      {/* Multi-field search — fill any one or more, then click Search */}
      <form
        onSubmit={(e) => { e.preventDefault(); void applySearch(); }}
        className="bg-white border border-gray-200 rounded-xl p-3 sm:p-4"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Name</label>
            <input
              type="text"
              value={draftSearch.name}
              onChange={(e) => setDraftSearch({ ...draftSearch, name: e.target.value })}
              placeholder="e.g. Rahul"
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Mobile Number</label>
            <input
              type="tel"
              value={draftSearch.mobile}
              onChange={(e) => setDraftSearch({ ...draftSearch, mobile: e.target.value })}
              placeholder="e.g. 9876543210"
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Employee Code</label>
            <input
              type="number"
              value={draftSearch.employeeCode}
              onChange={(e) => setDraftSearch({ ...draftSearch, employeeCode: e.target.value })}
              placeholder="e.g. 1024"
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Staff ID</label>
            <input
              type="number"
              value={draftSearch.staffId}
              onChange={(e) => setDraftSearch({ ...draftSearch, staffId: e.target.value })}
              placeholder="e.g. 17"
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 mt-3">
          <button
            type="submit"
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg"
          >
            Search
          </button>
          <button
            type="button"
            onClick={clearSearch}
            className="border border-gray-300 hover:bg-gray-50 text-gray-700 text-sm font-medium px-4 py-2 rounded-lg"
          >
            Clear
          </button>
          <span className="text-xs text-gray-500">Fill any combination of fields and click Search.</span>
        </div>
      </form>

      {/* Records table */}
      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : records.length === 0 ? (
        <p className="text-ink-muted text-sm">
          {hasActiveSearch
            ? "No staff match your search."
            : statusFilter === "NOT_MARKED"
              ? "Everyone on the roster has a record for this date."
              : statusFilter
                ? `Nobody is ${activeTallyLabel.toLowerCase()} on this date.`
                : "No attendance records for this date."}
        </p>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="sm:hidden space-y-3">
            {records.map((r) => {
              const dur = durationOf(r);
              const inTime = clock(r.checkInTime);
              const outTime = clock(r.checkOutTime);
              const outSource = checkOutSource(r);
              const unmarked = r.status === "NOT_MARKED";
              return (
                <div key={r.id} className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900 text-sm truncate">{staffNameOf(r)}</p>
                      <p className="text-[11px] text-gray-500">
                        {r.staff?.employeeCode ? `EMP-${r.staff.employeeCode}` : `Staff #${r.staffId}`}
                        {r.staff?.user?.mobile ? ` · ${r.staff.user.mobile}` : ""}
                      </p>
                    </div>
                    <StatusChip status={r.status} className="shrink-0" />
                  </div>
                  {/* Check-in and check-out side by side: the whole point of the
                      audit split is comparing the two, so they stay adjacent
                      even on the narrowest phone. */}
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="space-y-1">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Check-in</p>
                      <EventCell time={inTime} source={inTime ? checkInSource(r) : null} late={r.isLate} emptyLabel={unmarked ? "—" : "Not checked in"} />
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Check-out</p>
                      <EventCell
                        time={outTime}
                        source={outSource}
                        nextDay={Boolean(r.checkOutTime) && dayjs(r.checkOutTime).format("YYYY-MM-DD") !== r.date}
                        emptyLabel={unmarked ? "—" : "Still open"}
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-2 border-t border-gray-100 pt-2">
                    {dur.text ? (
                      <span className={`text-xs tabular-nums ${DURATION_TEXT[r.status] ?? "text-gray-600"}`}>⏱ {dur.text}</span>
                    ) : dur.invalid ? (
                      <span className="inline-flex items-center gap-1 text-xs text-red-600">
                        <TriangleAlert aria-hidden className="h-3.5 w-3.5" /> Check-out is before check-in
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400">{unmarked ? "Nothing recorded" : "No duration yet"}</span>
                    )}
                    <div className="flex items-center gap-3">
                      {unmarked && rbac.canManageHR && (
                        <button
                          onClick={() => openMarkFor(r.staffId, staffNameOf(r))}
                          className="text-accent-warn-deep hover:underline text-xs font-semibold"
                        >
                          Mark attendance
                        </button>
                      )}
                      <button
                        onClick={() => setViewStaff({ id: r.staffId, label: staffNameOf(r) })}
                        className="text-blue-600 hover:underline text-xs font-medium"
                      >
                        View month →
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Tablet+ table. The check-in and check-out columns each carry the
              time AND its provenance, so the audit trail arrives without a
              seventh and eighth column — the table is narrower than before and
              still scrolls inside its own box rather than the page. */}
          <div className="hidden sm:block overflow-x-auto rounded-xl border border-gray-200">
            <table className="min-w-180 w-full text-sm">
              <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
                <tr>
                  <th className="px-4 py-3 text-left">Staff</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Check-in</th>
                  <th className="px-4 py-3 text-left">Check-out</th>
                  <th className="px-4 py-3 text-left">Duration</th>
                  <th className="px-4 py-3 text-left">View</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {records.map((r) => {
                  const dur = durationOf(r);
                  const inTime = clock(r.checkInTime);
                  const outTime = clock(r.checkOutTime);
                  const unmarked = r.status === "NOT_MARKED";
                  return (
                    <tr key={r.id} className="hover:bg-gray-50 align-top">
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{staffNameOf(r)}</div>
                        <div className="text-[11px] text-gray-500">
                          {r.staff?.employeeCode ? `EMP-${r.staff.employeeCode}` : `Staff #${r.staffId}`}
                          {r.staff?.user?.mobile ? ` · ${r.staff.user.mobile}` : ""}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <StatusChip status={r.status} />
                      </td>
                      <td className="px-4 py-3">
                        <EventCell time={inTime} source={inTime ? checkInSource(r) : null} late={r.isLate} emptyLabel={unmarked ? "—" : "Not checked in"} />
                      </td>
                      <td className="px-4 py-3">
                        <EventCell
                          time={outTime}
                          source={checkOutSource(r)}
                          nextDay={Boolean(r.checkOutTime) && dayjs(r.checkOutTime).format("YYYY-MM-DD") !== r.date}
                          emptyLabel={unmarked ? "—" : "Still open"}
                        />
                      </td>
                      <td className="px-4 py-3">
                        {dur.text ? (
                          <span className={`tabular-nums ${DURATION_TEXT[r.status] ?? "text-gray-600"}`}>{dur.text}</span>
                        ) : dur.invalid ? (
                          <span
                            className="inline-flex items-center gap-1 text-xs text-red-600"
                            title="The stored check-out is not after the check-in, so no duration can be computed. Re-mark this record to correct it."
                          >
                            <TriangleAlert aria-hidden className="h-3.5 w-3.5 shrink-0" /> Times out of order
                          </span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col items-start gap-1">
                          <button
                            onClick={() => setViewStaff({ id: r.staffId, label: staffNameOf(r) })}
                            className="text-blue-600 hover:underline text-xs font-medium"
                          >
                            View
                          </button>
                          {unmarked && rbac.canManageHR && (
                            <button
                              onClick={() => openMarkFor(r.staffId, staffNameOf(r))}
                              className="text-accent-warn-deep hover:underline text-xs font-semibold"
                            >
                              Mark
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Progressive loading. The sentinel sits above the button so the
              observer fires a screenful early and the list usually extends
              before anyone reaches the end of it. */}
          <div ref={loadMoreRef} aria-hidden className="h-px" />
          <div className="flex flex-col items-center gap-2 pt-1" aria-live="polite">
            <p className="text-ink-muted text-xs">
              Showing {records.length} of {totalRecords}
              {statusFilter ? ` ${activeTallyLabel.toLowerCase()}` : ""} staff
            </p>
            {hasMore && (
              <button
                onClick={() => void loadMore()}
                disabled={loadingMore}
                className="border-line text-ink-soft hover:bg-surface-secondary hover:border-line-strong min-h-11 rounded-full border px-5 text-sm font-medium disabled:opacity-60"
              >
                {loadingMore ? "Loading…" : `Load ${Math.min(PAGE_SIZE, totalRecords - records.length)} more`}
              </button>
            )}
          </div>
        </>
      )}

      {/* Monthly view modal */}
      {viewStaff && (
        <StaffAttendanceModal
          staffId={viewStaff.id}
          staffLabel={viewStaff.label}
          onClose={() => setViewStaff(null)}
        />
      )}

      {/* HR resolve pending checkout modal */}
      {resolveTarget && (
        <div className="fixed inset-0 bg-walnut-950/55 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm space-y-4 max-h-[90vh] overflow-y-auto">
            <h2 className="font-semibold text-lg">Close Pending Checkout</h2>
            <div className="bg-orange-50 border border-orange-100 rounded-lg p-3">
              <p className="text-sm font-medium text-orange-900">{resolveTarget.name}</p>
              <p className="text-xs text-orange-700 mt-0.5">
                Open since {resolveTarget.date}
                {resolveTarget.daysAgo > 0 ? ` (${resolveTarget.daysAgo} day${resolveTarget.daysAgo !== 1 ? "s" : ""} ago)` : ""} — never checked out.
              </p>
              {/* The check-in stays on screen while the checkout is chosen: the
                  time being typed is only correct relative to this one. */}
              <div className="mt-2.5 flex items-center gap-3 border-t border-orange-100 pt-2.5">
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-orange-500">Checked in</p>
                  <p className="text-sm font-semibold tabular-nums text-orange-900">
                    {dayjs(resolveTarget.checkInTime).format("HH:mm:ss")}
                  </p>
                </div>
                <span aria-hidden className="text-orange-300">→</span>
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-orange-500">Checking out</p>
                  <p className={`text-sm font-semibold tabular-nums ${resolveError ? "text-red-600" : "text-orange-900"}`}>
                    {resolveCheckOut?.isValid() ? resolveCheckOut.format("HH:mm") : "—"}
                    {resolveCheckOut?.isValid() && resolveForm.checkOutDate !== resolveTarget.date && (
                      <span className="ml-1.5 rounded bg-orange-200 px-1 py-px text-[10px] font-semibold text-orange-800">
                        {resolveForm.checkOutDate}
                      </span>
                    )}
                  </p>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Checkout Date</label>
                <div className="mt-1">
                  <AppDatePicker value={resolveForm.checkOutDate} onChange={(v) => setResolveForm((f) => ({ ...f, checkOutDate: v }))} />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Checkout Time</label>
                <div className="mt-1">
                  <AppTimePicker value={resolveForm.checkOutTime} onChange={(v) => setResolveForm((f) => ({ ...f, checkOutTime: v }))} />
                </div>
              </div>
            </div>
            {resolveError ? (
              <p role="alert" className="flex items-start gap-1.5 rounded-lg bg-red-50 px-3 py-2 text-[11px] text-red-700">
                <TriangleAlert aria-hidden className="mt-px h-3.5 w-3.5 shrink-0" />
                {resolveError}
              </p>
            ) : (
              <p className="text-[11px] text-gray-500">
                Defaults to 5:00 PM, or an hour after check-in when that is later.
                {resolvePreview ? ` Records ${resolvePreview} of work.` : " Adjust if you know the actual departure time."}
              </p>
            )}
            <div>
              <label className="text-sm font-medium">Reason</label>
              <select
                value={resolveForm.reason}
                onChange={(e) => setResolveForm((f) => ({ ...f, reason: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm mt-1"
              >
                <option value="FORGOT">Forgot to check out</option>
                <option value="REGULAR">Regular checkout</option>
                <option value="EARLY_LEAVE">Early leave</option>
                <option value="OVERTIME">Overtime</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">HR Note <span className="text-gray-400 font-normal">(optional)</span></label>
              <input
                value={resolveForm.hrNote}
                onChange={(e) => setResolveForm((f) => ({ ...f, hrNote: e.target.value }))}
                placeholder="e.g. Staff reported leaving early due to illness"
                className="w-full border rounded-lg px-3 py-2 text-sm mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Attendance Status</label>
              <select
                value={resolveForm.status}
                onChange={(e) => setResolveForm((f) => ({ ...f, status: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm mt-1"
              >
                <option value="PRESENT">Present</option>
                <option value="HALF_DAY">Half Day</option>
                <option value="LATE">Late</option>
                <option value="ABSENT">Absent</option>
              </select>
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setResolveTarget(null)} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">Cancel</button>
              <button
                onClick={handleHrResolve}
                disabled={resolving || Boolean(resolveError)}
                className="px-4 py-2 text-sm bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-60"
              >
                {resolving ? "Closing…" : "Close Checkout"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manual mark modal */}
      {showMark && (
        <div className="fixed inset-0 bg-walnut-950/55 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm space-y-4 max-h-[90vh] overflow-y-auto">
            <h2 className="font-semibold text-lg">Mark Attendance Manually</h2>

            {/* Search mode toggle */}
            <div className="flex gap-1 bg-gray-100 rounded-lg p-1 text-xs">
              <button
                type="button"
                onClick={() => setMarkSearchMode("quick")}
                className={`flex-1 py-1.5 rounded-md font-medium ${markSearchMode === "quick" ? "bg-white shadow text-gray-900" : "text-gray-500"}`}
              >
                Quick search
              </button>
              <button
                type="button"
                onClick={() => setMarkSearchMode("explicit")}
                className={`flex-1 py-1.5 rounded-md font-medium ${markSearchMode === "explicit" ? "bg-white shadow text-gray-900" : "text-gray-500"}`}
              >
                By code / ID / mobile
              </button>
            </div>

            {markSearchMode === "quick" ? (
              <StaffPicker
                label="Staff Member"
                value={markStaffId}
                onChange={(id, staff) => {
                  setMarkStaffId(id);
                  setMarkStaffLabel(staff ? `${staff.firstName} ${staff.lastName}` : "");
                }}
                required
              />
            ) : (
              <StaffLookupForm
                onResolved={(staff) => {
                  setMarkStaffId(staff.id);
                  setMarkStaffLabel(`${staff.firstName} ${staff.lastName}`);
                }}
                onClear={() => { setMarkStaffId(null); setMarkStaffLabel(""); }}
                selectedLabel={markStaffId && markStaffLabel ? markStaffLabel : null}
              />
            )}

            <div>
              <label className="text-sm font-medium">Date</label>
              <input
                type="date"
                value={markDate}
                max={today}
                onChange={(e) => setMarkDate(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm mt-1"
              />
              <p className="text-[11px] text-gray-500 mt-1">Defaults to today. Pick another date to back-date attendance.</p>
            </div>
            <div>
              <label className="text-sm font-medium">Status</label>
              <select value={markForm.status} onChange={(e) => setMarkForm((f) => ({ ...f, status: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm mt-1">
                {["PRESENT","ABSENT","LATE","HALF_DAY","ON_LEAVE"].map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Check-In</label>
                <div className="mt-1">
                  <AppTimePicker value={markForm.checkInTime} onChange={(v) => setMarkForm((f) => ({ ...f, checkInTime: v }))} />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">Check-Out</label>
                <div className="mt-1">
                  <AppTimePicker value={markForm.checkOutTime} onChange={(v) => setMarkForm((f) => ({ ...f, checkOutTime: v }))} />
                </div>
              </div>
            </div>
            {markError ? (
              <p role="alert" className="flex items-start gap-1.5 rounded-lg bg-red-50 px-3 py-2 text-[11px] text-red-700">
                <TriangleAlert aria-hidden className="mt-px h-3.5 w-3.5 shrink-0" />
                {markError}
              </p>
            ) : markPreview ? (
              <p className="text-[11px] text-gray-500">Records {markPreview} of work on {markDate}.</p>
            ) : null}
            <div>
              <label className="text-sm font-medium">Override Reason (optional)</label>
              <input value={markForm.overrideReason} onChange={(e) => setMarkForm((f) => ({ ...f, overrideReason: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm mt-1" />
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowMark(false)} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">Cancel</button>
              <button
                onClick={handleMark}
                disabled={Boolean(markError)}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60"
              >
                Mark
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Working-hours report modal */}
      {showReport && (
        <div className="fixed inset-0 bg-walnut-950/55 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm space-y-4 max-h-[90vh] overflow-y-auto">
            <h2 className="font-semibold text-lg">Download Attendance Report</h2>
            <p className="text-sm text-gray-600">
              Working-hours report with per-staff totals (present/absent/not-marked days, worked hours) and a
              day-by-day detail — for one staff member or everyone. Maximum range: {REPORT_MAX_DAYS} days.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">From</label>
                <div className="mt-1">
                  <AppDatePicker value={reportForm.from} max={today} onChange={(v) => setReportForm((f) => ({ ...f, from: v }))} />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">To</label>
                <div className="mt-1">
                  <AppDatePicker value={reportForm.to} max={today} onChange={(v) => setReportForm((f) => ({ ...f, to: v }))} />
                </div>
              </div>
            </div>
            <StaffPicker
              label="Staff Member (leave empty for all staff)"
              value={reportForm.staffId}
              onChange={(id) => setReportForm((f) => ({ ...f, staffId: id }))}
            />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowReport(false)} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">Close</button>
              <button
                onClick={handleReportCsv}
                disabled={reportBusy !== null}
                className="px-4 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-60"
              >
                {reportBusy === "csv" ? "Preparing…" : "Download CSV"}
              </button>
              <button
                onClick={handleReportPdf}
                disabled={reportBusy !== null}
                className="px-4 py-2 text-sm bg-slate-700 text-white rounded-lg hover:bg-slate-800 disabled:opacity-60"
              >
                {reportBusy === "pdf" ? "Preparing…" : "Download PDF"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bypass window modal */}
      {showBypass && (
        <div className="fixed inset-0 bg-walnut-950/55 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm space-y-4">
            <h2 className="font-semibold text-lg">Open Bypass Window</h2>
            <p className="text-sm text-gray-600">During a bypass window, staff can mark attendance without biometrics (e.g., device maintenance).</p>
            <div>
              <label className="text-sm font-medium">Duration (hours)</label>
              <input
                type="number"
                min={1}
                max={24}
                value={bypassForm.durationHours}
                onChange={(e) => {
                  const raw = e.target.value;
                  if (raw === "") {
                    setBypassForm((f) => ({ ...f, durationHours: "" }));
                  } else {
                    const num = parseInt(raw, 10);
                    if (!isNaN(num)) setBypassForm((f) => ({ ...f, durationHours: num }));
                  }
                }}
                onBlur={() => {
                  const num = Number(bypassForm.durationHours);
                  setBypassForm((f) => ({ ...f, durationHours: Math.min(Math.max(num || 1, 1), 24) }));
                }}
                className="w-full border rounded-lg px-3 py-2 text-sm mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Reason (optional)</label>
              <input value={bypassForm.reason} onChange={(e) => setBypassForm((f) => ({ ...f, reason: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm mt-1" />
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowBypass(false)} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">Cancel</button>
              <button onClick={handleBypass} className="px-4 py-2 text-sm bg-amber-600 text-white rounded-lg hover:bg-amber-700">Activate</button>
            </div>
          </div>
        </div>
      )}

      {/* Attendance settings modal — thresholds that decide PRESENT/HALF_DAY/ABSENT + isLate */}
      {showSettings && (
        <div className="fixed inset-0 bg-walnut-950/55 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center gap-2">
              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-700">
                <Settings2 aria-hidden className="h-4 w-4" />
              </span>
              <h2 className="font-semibold text-lg">Attendance Settings</h2>
            </div>
            <p className="text-xs text-gray-500">
              These thresholds decide the day&apos;s status on every checkout: <strong>PRESENT</strong> at or above the
              full-day hours, <strong>HALF_DAY</strong> at or above the half-day hours, otherwise <strong>ABSENT</strong>{" "}
              (staff marked ON_LEAVE or HOLIDAY are never touched). The late cutoff only sets the <strong>Late</strong>{" "}
              badge on check-in — it never changes the day&apos;s status. Changes apply to future check-ins/checkouts only;
              existing records are not recomputed.
            </p>
            {settingsLoading ? (
              <p className="text-sm text-gray-500 py-4 text-center">Loading…</p>
            ) : (
              <>
                {/* The two thresholds are read against each other, so they stay
                    side by side down to the narrowest phone.
                    "Min hours — Full Day" used to wrap to two lines in a
                    half-width column while "Min hours — Half Day" did not,
                    which pushed one input a line below the other. The unit now
                    rides in the label instead of a second word ("Full day
                    (hrs)"), so neither wraps — and `items-end` bottom-aligns
                    the row so the inputs stay level even if one ever does. */}
                <div className="grid grid-cols-2 items-end gap-3">
                  <div>
                    <label htmlFor="min-full-day" className="block text-sm font-medium">
                      Full day (hrs)
                    </label>
                    <input
                      id="min-full-day"
                      type="number"
                      inputMode="decimal"
                      step={0.5}
                      min={0.5}
                      max={24}
                      value={settingsForm.minFullDayHours}
                      onChange={(e) => setSettingsForm((f) => ({ ...f, minFullDayHours: Number(e.target.value) }))}
                      className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label htmlFor="min-half-day" className="block text-sm font-medium">
                      Half day (hrs)
                    </label>
                    <input
                      id="min-half-day"
                      type="number"
                      inputMode="decimal"
                      step={0.5}
                      min={0.5}
                      max={24}
                      value={settingsForm.minHalfDayHours}
                      onChange={(e) => setSettingsForm((f) => ({ ...f, minHalfDayHours: Number(e.target.value) }))}
                      className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                    />
                  </div>
                </div>
                <p className="text-ink-muted -mt-2 text-[11px]">
                  Minimum hours worked for a day to count as full or half.
                </p>
                <div>
                  <label className="text-sm font-medium">Late cutoff time</label>
                  <div className="mt-1">
                    <AppTimePicker
                      value={settingsForm.lateCutoffTime}
                      onChange={(v) => setSettingsForm((f) => ({ ...f, lateCutoffTime: v }))}
                    />
                  </div>
                  <p className="text-[11px] text-gray-500 mt-1">Check-ins after this time are flagged Late.</p>
                </div>
                {settingsError && (
                  <p role="alert" className="flex items-start gap-1.5 rounded-lg bg-red-50 px-3 py-2 text-[11px] text-red-700">
                    <TriangleAlert aria-hidden className="mt-px h-3.5 w-3.5 shrink-0" />
                    {settingsError}
                  </p>
                )}
                <div className="flex gap-2 justify-end pt-1">
                  <button onClick={() => setShowSettings(false)} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">Cancel</button>
                  <button
                    onClick={handleSaveSettings}
                    disabled={settingsSaving || Boolean(settingsError)}
                    className="px-4 py-2 text-sm bg-slate-800 text-white rounded-lg hover:bg-slate-900 disabled:opacity-60"
                  >
                    {settingsSaving ? "Saving…" : "Save Settings"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
