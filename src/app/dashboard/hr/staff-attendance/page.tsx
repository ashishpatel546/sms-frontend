"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { hrApi, StaffAttendanceRecord, AttendanceBypassWindow, StaffBiometric, WebauthnRegistrationPermit, DailyAttendanceSummary, DailyAttendanceStatus, HrPendingCheckoutItem, AttendanceMethod, AttendanceReportInclude } from "@/lib/hr-api";
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
  attendanceSettingsProblem,
  DEFAULT_ATTENDANCE_SETTINGS,
  type AttendanceSettings,
} from "@/lib/attendance-settings-api";
import { useHelperMessage } from "@/i18n/useHelperMessage";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
import { useLocale, useTranslations } from "next-intl";
import { INTL_LOCALE, type Locale } from "@/i18n/config";
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

type StaffAttT = ReturnType<typeof useTranslations<"hr.staffAtt">>;

/** Keys under `hr.staffAtt.methodLabel` — the label is translated where it is rendered. */
const METHOD_LABEL_KEYS = ["GEOFENCE", "WEBAUTHN", "BYPASS", "MANUAL", "UNKNOWN"] as const;
type MethodLabelKey = (typeof METHOD_LABEL_KEYS)[number];

/** How a check-in / check-out was proven: the word, the glyph, the ink. */
const METHOD_META: Record<AttendanceMethod, { label: string; Icon: typeof MapPin; tint: string }> = {
  GEOFENCE: { label: "GEOFENCE", Icon: MapPin, tint: "text-emerald-600" },
  WEBAUTHN: { label: "WEBAUTHN", Icon: Fingerprint, tint: "text-indigo-600" },
  BYPASS: { label: "BYPASS", Icon: ShieldAlert, tint: "text-amber-600" },
  MANUAL: { label: "MANUAL", Icon: PenLine, tint: "text-slate-500" },
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
  const base = meta ?? { label: method ?? "UNKNOWN", Icon: PenLine, tint: "text-gray-400" };
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
function formatSpan(minutes: number, t: StaffAttT): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h <= 0) return t("spanM", { m });
  return m === 0 ? t("spanH", { h }) : t("spanHM", { h, m });
}

/** Same wording as the backend's 400, so client and server feedback match. */
function checkOutOrderingMessage(checkIn: dayjs.Dayjs, checkOut: dayjs.Dayjs, date: string, t: StaffAttT): string {
  return t("orderingError", { checkOut: checkOut.format("hh:mm A"), checkIn: checkIn.format("hh:mm A"), date });
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
  const t = useTranslations("hr.staffAtt");
  const { Icon } = source;
  const label = (METHOD_LABEL_KEYS as readonly string[]).includes(source.label)
    ? t(`methodLabel.${source.label as MethodLabelKey}`)
    : source.label;
  return (
    <span className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] leading-tight">
      <span className="inline-flex items-center gap-1 text-gray-500">
        <Icon aria-hidden className={`h-3 w-3 shrink-0 ${source.tint}`} />
        {label}
      </span>
      {source.actorName && (
        <span className="inline-flex items-center gap-1 font-medium text-amber-700">
          <UserCog aria-hidden className="h-3 w-3 shrink-0" />
          {t("byActor", { name: source.actorName })}
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
  const t = useTranslations("hr.staffAtt");
  if (!time) {
    return <span className="text-xs text-gray-400">{emptyLabel}</span>;
  }
  return (
    <span className="flex flex-col gap-1">
      <span className="flex items-center gap-1.5">
        <span className="tabular-nums text-gray-900">{time}</span>
        {nextDay && (
          <span className="rounded bg-amber-100 px-1 py-px text-[10px] font-semibold text-amber-700">{t("nextDay")}</span>
        )}
        {late && (
          <span
            title={t("lateTitle")}
            className="inline-flex items-center gap-0.5 rounded-full bg-amber-100 px-1.5 py-px text-[10px] font-semibold text-amber-700"
          >
            <Clock3 aria-hidden className="h-2.5 w-2.5" />
            {t("late")}
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
  const t = useTranslations("hr.staffAtt");
  return (
    <div
      role="group"
      aria-label={t("filterAria")}
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
  const helperText = useHelperMessage();
  const rbac = useRbac();
  const t = useTranslations("hr");
  const ts = useTranslations("hr.staffAtt");
  const tc = useTranslations("common");
  const locale = useLocale() as Locale;
  const today = todayLocalDate();
  const nameOf = (r: AttendanceRow) =>
    r.staff?.user ? `${r.staff.user.firstName} ${r.staff.user.lastName}` : t("overview.staffNo", { id: r.staffId });

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
  /**
   * "month" picks a whole calendar month (so February is 28/29 days and January
   * 31, without the user doing the arithmetic); "custom" is a free from/to
   * range, capped at REPORT_MAX_DAYS.
   */
  const [reportMode, setReportMode] = useState<"month" | "custom">("month");
  const [reportMonth, setReportMonth] = useState(today.slice(0, 7)); // YYYY-MM
  const [reportForm, setReportForm] = useState<{ from: string; to: string; staffId: number | null }>({
    from: `${today.slice(0, 8)}01`,
    to: today,
    staffId: null,
  });
  /**
   * Which blocks to download. Summary alone is answered by a single grouped
   * query on the server, so leaving Detail off on a whole-school report is the
   * difference between ~200 rows and ~6,000 — hence Detail defaults to off.
   */
  const [reportSummary, setReportSummary] = useState(true);
  const [reportDetail, setReportDetail] = useState(false);
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
    } catch { toast.error(t("myAttendance.loadFailed")); }
    finally { setLoading(false); }
  }, [date, queryArgs, t]);

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
    } catch { toast.error(ts("loadMoreFailed")); }
    finally { setLoadingMore(false); }
  }, [date, queryArgs, currentPage, totalPages, loading, loadingMore, ts]);

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
      ? checkOutOrderingMessage(markCheckIn, markCheckOut, markDate, ts)
      : null;
  const markPreview =
    !markError && markCheckIn?.isValid() && markCheckOut?.isValid()
      ? formatSpan(markCheckOut.diff(markCheckIn, "minute"), ts)
      : null;

  const handleMark = async () => {
    if (!markStaffId) { toast.error(ts("selectStaff")); return; }
    if (!markDate) { toast.error(ts("selectDate")); return; }
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
      toast.success(ts("marked"));
      setShowMark(false);
      // If the marked date matches the page's currently-viewed date, refresh the daily list.
      if (markDate === date) {
        loadRecords();
      }
    } catch (e: any) { toast.error(e?.info?.message ?? t("failed")); }
  };

  const handleBypass = async () => {
    try {
      const bp = await hrApi.attendance.bypass.create({ ...bypassForm, durationHours: Math.min(Math.max(Number(bypassForm.durationHours) || 1, 1), 24) });
      setBypass(bp);
      toast.success(ts("bypassCreated"));
      setShowBypass(false);
    } catch (e: any) { toast.error(e?.info?.message ?? t("failed")); }
  };

  const handleCloseBypass = async () => {
    if (!confirm(ts("closeBypassConfirm"))) return;
    try {
      await hrApi.attendance.bypass.close();
      setBypass(null);
      toast.success(ts("bypassClosed"));
    } catch (e: any) { toast.error(e?.info?.message ?? ts("closeBypassFailed")); }
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
    } catch { toast.error(ts("bioLoadFailed")); }
    finally { setBioLoading(false); }
  }, [ts]);

  const handleGrantPermit = async () => {
    if (!permitTargetId) { toast.error(ts("selectStaff")); return; }
    try {
      await hrApi.attendance.webauthn.grantPermit(permitTargetId);
      toast.success(ts("permitGranted"));
      setPermitTargetId(null);
      loadBiometrics();
    } catch (e: any) { toast.error(e?.info?.message ?? t("failed")); }
  };

  const handleRevokePermit = async (staffId: number) => {
    try {
      await hrApi.attendance.webauthn.revokePermitByStaff(staffId);
      toast.success(ts("permitRevoked"));
      loadBiometrics();
    } catch { toast.error(ts("revokeFailed")); }
  };

  const handleDeleteCredential = async (id: number) => {
    if (!confirm(ts("deleteCredConfirm"))) return;
    try {
      await hrApi.attendance.webauthn.deleteCredential(id);
      toast.success(ts("credDeleted"));
      loadBiometrics();
    } catch { toast.error(ts("deleteFailed")); }
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
      ? checkOutOrderingMessage(resolveCheckIn, resolveCheckOut, resolveTarget.date, ts)
      : null;
  const resolvePreview =
    !resolveError && resolveCheckIn && resolveCheckOut?.isValid()
      ? formatSpan(resolveCheckOut.diff(resolveCheckIn, "minute"), ts)
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
      toast.success(ts("checkoutClosed", { name: resolveTarget.name }));
      setResolveTarget(null);
      loadPendingCheckouts();
      if (resolveTarget.date === date) loadRecords();
    } catch (e: any) {
      toast.error(e?.info?.message ?? ts("resolveFailed"));
    } finally { setResolving(false); }
  };

  const openSettings = () => {
    setShowSettings(true);
    setSettingsLoading(true);
    attendanceSettingsApi
      .get()
      .then((s) => setSettingsForm(s))
      .catch(() => toast.error(ts("settingsLoadFailed")))
      .finally(() => setSettingsLoading(false));
  };

  /** Mirrors the server's rule (half-day threshold < full-day threshold) so the error lands before the request does. */
  const settingsProblem = attendanceSettingsProblem(settingsForm);
  const settingsError = settingsProblem ? helperText(settingsProblem) : null;

  const handleSaveSettings = async () => {
    if (settingsError) { toast.error(settingsError); return; }
    setSettingsSaving(true);
    try {
      const updated = await attendanceSettingsApi.update(settingsForm);
      setSettingsForm(updated);
      toast.success(ts("settingsUpdated"));
      setShowSettings(false);
    } catch (e) {
      const info = (e as { info?: { message?: string } } | undefined)?.info;
      toast.error(info?.message ?? ts("settingsUpdateFailed"));
    } finally {
      setSettingsSaving(false);
    }
  };

  /**
   * One month, matching the backend cap. 31 rather than 30 so a custom range
   * covering a 31-day month is allowed — capping at 30 would reject a whole
   * calendar month, which the Month mode offers.
   */
  const REPORT_MAX_DAYS = 31;

  /**
   * The range actually requested. Month mode derives it from the picked month
   * and clamps the end to today, so "this month" never asks for future dates.
   */
  const reportRange = (): { from: string; to: string } => {
    if (reportMode === "custom") return { from: reportForm.from, to: reportForm.to };
    const start = dayjs(`${reportMonth}-01`);
    const end = start.endOf("month");
    const to = end.format("YYYY-MM-DD");
    return { from: start.format("YYYY-MM-DD"), to: to > today ? today : to };
  };

  /** Null when the form is valid, else the reason to show the user. */
  const reportError = (): string | null => {
    if (!reportSummary && !reportDetail) return ts("pickSection");
    // Cleared month input: guard before dayjs turns it into "Invalid Date" and
    // the range checks below silently pass on NaN.
    if (reportMode === "month" && !reportMonth) return ts("selectMonth");
    const { from, to } = reportRange();
    if (!from || !to) return ts("selectBothDates");
    if (from > to) return ts("fromBeforeTo");
    if (dayjs(to).diff(dayjs(from), "day") + 1 > REPORT_MAX_DAYS) {
      return ts("rangeTooLarge", { max: REPORT_MAX_DAYS });
    }
    return null;
  };

  /** 'summary' | 'detail' | 'both' from the two checkboxes. */
  const reportInclude = (): AttendanceReportInclude =>
    reportSummary && reportDetail ? "both" : reportDetail ? "detail" : "summary";

  const handleReportCsv = async () => {
    const err = reportError();
    if (err) return toast.error(err);
    setReportBusy("csv");
    try {
      await hrApi.attendance.exportReportCsv({
        ...reportRange(),
        staffId: reportForm.staffId ?? undefined,
        include: reportInclude(),
      });
      toast.success(ts("reportDownloaded"));
    } catch (e: any) {
      toast.error(e?.info?.message ?? ts("reportFailed"));
    } finally {
      setReportBusy(null);
    }
  };

  const handleReportPdf = async () => {
    const err = reportError();
    if (err) return toast.error(err);
    setReportBusy("pdf");
    try {
      const report = await hrApi.attendance.getReport({
        ...reportRange(),
        staffId: reportForm.staffId ?? undefined,
        include: reportInclude(),
      });
      const { buildAttendanceReportPdf } = await import("@/lib/attendance-report-pdf");
      buildAttendanceReportPdf(report);
      toast.success(ts("reportDownloaded"));
    } catch (e: any) {
      toast.error(e?.info?.message ?? ts("reportFailed"));
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
    { key: null, label: ts("tally.all"), count: rosterTotal },
    { key: "NOT_MARKED", label: ts("tally.notMarked"), count: notMarked },
    { key: "PRESENT", label: ts("tally.present"), count: present },
    { key: "LATE", label: ts("tally.late"), count: lateArrivals },
    { key: "HALF_DAY", label: ts("tally.halfDay"), count: summary.HALF_DAY },
    { key: "ON_LEAVE", label: ts("tally.onLeave"), count: summary.ON_LEAVE },
    { key: "ABSENT", label: ts("tally.absent"), count: summary.ABSENT },
    // Holidays are rare and a zero here says nothing — the button appears on
    // the days it means something, rather than sitting at 0 all year.
    ...(summary.HOLIDAY > 0 || statusFilter === "HOLIDAY"
      ? [{ key: "HOLIDAY" as StatusFilter, label: ts("tally.holiday"), count: summary.HOLIDAY }]
      : []),
  ];

  const activeTallyLabel = tallies.find((tally) => tally.key === statusFilter)?.label ?? "";

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
      toast(ts("enterSearchField"));
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
        <h1 className="font-display text-[22px] sm:text-[26px] font-semibold tracking-[-0.02em] text-ink">{ts("title")}</h1>
        <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2">
          <Link href="/dashboard/hr/staff-attendance/kiosk" className="bg-slate-700 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-slate-800 text-center">
            {ts("kioskMode")}
          </Link>
          <Link href="/dashboard/hr/staff-attendance/zones" className="bg-teal-600 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-teal-700 text-center">
            {ts("geoZones")}
          </Link>
          <Link href="/dashboard/hr/staff-attendance/devices" className="bg-violet-600 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-violet-700 text-center">
            {t("devices.title")}
          </Link>
          {rbac.canManageHR && (
            <>
              <button
                onClick={openSettings}
                className="inline-flex items-center justify-center gap-1.5 bg-slate-800 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-slate-900"
              >
                <Settings2 aria-hidden className="h-4 w-4" />
                {ts("settings")}
              </button>
              <button
                onClick={() => { setShowBiometrics((v) => !v); if (!showBiometrics) loadBiometrics(); }}
                className="bg-indigo-600 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700"
              >
                {ts("biometrics")}
              </button>
              <button
                onClick={() => setShowPendingCheckouts((v) => !v)}
                className={`relative px-3 py-2 rounded-lg text-sm font-medium text-white ${
                  pendingCheckoutsList.length > 0
                    ? "bg-red-600 hover:bg-red-700"
                    : "bg-orange-500 hover:bg-orange-600"
                }`}
              >
                {ts("pendingCheckouts")}
                {pendingCheckoutsList.length > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 bg-white text-red-600 text-[10px] font-bold leading-none rounded-full w-5 h-5 flex items-center justify-center border border-red-200">
                    {pendingCheckoutsList.length}
                  </span>
                )}
              </button>
              <button onClick={() => setShowReport(true)} className="bg-emerald-600 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700">
                {ts("downloadReport")}
              </button>
              <button onClick={() => setShowBypass(true)} className="bg-amber-500 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-amber-600">
                {bypass ? ts("bypassActiveNew") : ts("openBypass")}
              </button>
              {bypass && (
                <button onClick={handleCloseBypass} className="bg-red-600 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-red-700">
                  {ts("closeBypass")}
                </button>
              )}
              <button onClick={() => { setMarkDate(today); setShowMark(true); }} className="bg-blue-600 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 col-span-2 sm:col-auto">
                {ts("markManuallyButton")}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Info Banner */}
      <InfoBanner title={ts("aboutTitle")}>
        {t.rich("staffAtt.aboutBody", { strong: (c) => <strong>{c}</strong> })}
      </InfoBanner>

      {/* Bypass info */}
      {bypass && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
          {ts("bypassActiveBanner", { date: new Date(bypass.expiresAt).toLocaleString(INTL_LOCALE[locale]) })}
        </div>
      )}

      {/* Biometric management panel */}
      {showBiometrics && rbac.canManageHR && (
        <div className="border border-indigo-200 rounded-xl overflow-hidden">
          <div className="bg-indigo-50 px-5 py-3 flex items-center justify-between">
            <p className="text-sm font-semibold text-indigo-900">{ts("bioTitle")}</p>
            <button onClick={() => setShowBiometrics(false)} className="text-indigo-400 hover:text-indigo-700 text-xs">{tc("action.close")} ✕</button>
          </div>
          <div className="p-5 space-y-5 bg-white">
            {bioLoading ? <p className="text-sm text-gray-500">{tc("state.loading")}</p> : (
              <>
                {/* Grant registration permission */}
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">{ts("allowReg")}</p>
                  <p className="text-xs text-gray-500">{ts("allowRegHint")}</p>
                  <div className="flex gap-2 items-end">
                    <div className="flex-1">
                      <StaffPicker label={t("leaves.staffMember")} value={permitTargetId} onChange={(id) => setPermitTargetId(id)} />
                    </div>
                    <button onClick={handleGrantPermit} className="bg-indigo-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-indigo-700 whitespace-nowrap">
                      {ts("grantPermission")}
                    </button>
                  </div>
                </div>

                {/* Active permits */}
                {permits.filter((p) => !p.usedAt && new Date(p.expiresAt) > new Date()).length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">{ts("activePermissions")}</p>
                    <div className="space-y-1.5">
                      {permits
                        .filter((p) => !p.usedAt && new Date(p.expiresAt) > new Date())
                        .map((p) => (
                          <div key={p.id} className="flex items-center justify-between bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                            <div>
                              <p className="text-xs font-medium text-amber-800">{ts("staffIdNo", { id: p.staffId })}</p>
                              <p className="text-xs text-amber-600">{ts("expires", { date: new Date(p.expiresAt).toLocaleString(INTL_LOCALE[locale]) })}</p>
                            </div>
                            <button onClick={() => handleRevokePermit(p.staffId)} className="text-red-500 hover:text-red-700 text-xs">{ts("revoke")}</button>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {/* Registered credentials */}
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
                    {ts("registeredDevices", { count: allCredentials.length })}
                  </p>
                  {allCredentials.length === 0 ? (
                    <p className="text-xs text-gray-400">{ts("noDevices")}</p>
                  ) : (
                    <div className="space-y-1.5">
                      {allCredentials.map((c) => (
                        <div key={c.id} className="flex items-center justify-between border border-gray-200 rounded-lg px-3 py-2">
                          <div>
                            <p className="text-sm font-medium text-gray-800">
                              {c.staff?.user
                                ? `${c.staff.user.firstName} ${c.staff.user.lastName} (#${c.staff.employeeCode})`
                                : t("overview.staffNo", { id: String(c.staffId) })}
                            </p>
                            <p className="text-xs text-gray-400">
                              {ts("deviceRegistered", { name: c.deviceName || ts("unnamed"), date: new Date(c.registeredAt).toLocaleDateString(INTL_LOCALE[locale]) })}
                            </p>
                          </div>
                          <button onClick={() => handleDeleteCredential(c.id)} className="text-red-500 hover:text-red-700 text-xs ml-4">{tc("action.delete")}</button>
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
              {ts("pendingCheckouts")}{pendingCheckoutsList.length > 0 ? ` (${pendingCheckoutsList.length})` : ""}
            </p>
            <button onClick={() => setShowPendingCheckouts(false)} className="text-orange-400 hover:text-orange-700 text-xs">{tc("action.close")} ✕</button>
          </div>
          <div className="p-5 bg-white">
            {pendingCheckoutsLoading ? (
              <p className="text-sm text-gray-500">{tc("state.loading")}</p>
            ) : pendingCheckoutsList.length === 0 ? (
              <p className="text-sm text-gray-500">{ts("noPending")}</p>
            ) : (
              <div className="space-y-4">
                <p className="text-xs text-gray-500">
                  {ts("pendingCount", { count: pendingCheckoutsList.length })}
                </p>
                {/* Desktop table */}
                <div className="hidden sm:block overflow-x-auto rounded-lg border border-gray-200">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
                      <tr>
                        <th className="px-4 py-2.5 text-left">{t("leaves.staff")}</th>
                        <th className="px-4 py-2.5 text-left">{tc("field.date")}</th>
                        <th className="px-4 py-2.5 text-left">{ts("checkedInAt")}</th>
                        <th className="px-4 py-2.5 text-left">{ts("daysOpen")}</th>
                        <th className="px-4 py-2.5 text-left">{t("mySalary.action")}</th>
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
                              {t("overview.daysShort", { count: item.daysAgo })}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <button
                              onClick={() => openResolve(item)}
                              className="text-xs bg-orange-600 hover:bg-orange-700 text-white px-3 py-1.5 rounded-lg font-medium"
                            >
                              {ts("closeCheckout")}
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
                        <span className={`text-xs font-semibold shrink-0 ${item.daysAgo > 1 ? "text-red-600" : "text-amber-600"}`}>{ts("daysAgo", { count: item.daysAgo })}</span>
                      </div>
                      <p className="text-xs text-gray-600">{ts("dateCheckedIn", { date: item.date, time: dayjs(item.checkInTime).format('HH:mm:ss') })}</p>
                      <button
                        onClick={() => openResolve(item)}
                        className="text-xs bg-orange-600 hover:bg-orange-700 text-white px-3 py-1.5 rounded-lg font-medium"
                      >
                        {ts("closeCheckout")}
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
            {ts("registerFor")}
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
              {ts("searchResults", { count: totalRecords })}
            </span>
          )}
        </div>

        <TallyStrip tallies={tallies} active={statusFilter} onChange={chooseStatus} />

        <p className="text-ink-muted text-xs">
          {t.rich("staffAtt.allExplainer", { strong: (c) => <strong className="text-ink-soft font-semibold">{c}</strong>, total: rosterTotal })}{" "}
          {notMarked > 0
            ? ts("noRecordYet", { count: notMarked })
            : ts("everyoneHasRecord")}{" "}
          {ts("lateExplainer")}
        </p>
      </div>

      {/* Multi-field search — fill any one or more, then click Search */}
      <form
        onSubmit={(e) => { e.preventDefault(); void applySearch(); }}
        className="bg-white border border-gray-200 rounded-xl p-3 sm:p-4"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">{tc("field.name")}</label>
            <input
              type="text"
              value={draftSearch.name}
              onChange={(e) => setDraftSearch({ ...draftSearch, name: e.target.value })}
              placeholder={t("devices.namePlaceholder")}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">{t("devices.mobileNumber")}</label>
            <input
              type="tel"
              value={draftSearch.mobile}
              onChange={(e) => setDraftSearch({ ...draftSearch, mobile: e.target.value })}
              placeholder={t("devices.mobilePlaceholder")}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">{t("devices.employeeCode")}</label>
            <input
              type="number"
              value={draftSearch.employeeCode}
              onChange={(e) => setDraftSearch({ ...draftSearch, employeeCode: e.target.value })}
              placeholder={t("devices.codePlaceholder")}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">{t("devices.staffId")}</label>
            <input
              type="number"
              value={draftSearch.staffId}
              onChange={(e) => setDraftSearch({ ...draftSearch, staffId: e.target.value })}
              placeholder={t("devices.staffIdPlaceholder")}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 mt-3">
          <button
            type="submit"
            className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-lg"
          >
            {tc("action.search")}
          </button>
          <button
            type="button"
            onClick={clearSearch}
            className="border border-gray-300 hover:bg-gray-50 text-gray-700 text-sm font-medium px-4 py-2 rounded-lg"
          >
            {tc("action.clear")}
          </button>
          <span className="text-xs text-gray-500">{ts("searchHint")}</span>
        </div>
      </form>

      {/* Records table */}
      {loading ? (
        <p className="text-sm text-gray-500">{tc("state.loading")}</p>
      ) : records.length === 0 ? (
        <p className="text-ink-muted text-sm">
          {hasActiveSearch
            ? ts("noMatch")
            : statusFilter === "NOT_MARKED"
              ? ts("everyoneOnRoster")
              : statusFilter
                ? ts("nobodyIs", { label: activeTallyLabel.toLowerCase() })
                : ts("noRecordsDate")}
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
                      <p className="font-medium text-gray-900 text-sm truncate">{nameOf(r)}</p>
                      <p className="text-[11px] text-gray-500">
                        {r.staff?.employeeCode ? `EMP-${r.staff.employeeCode}` : t("overview.staffNo", { id: r.staffId })}
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
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">{ts("checkIn")}</p>
                      <EventCell time={inTime} source={inTime ? checkInSource(r) : null} late={r.isLate} emptyLabel={unmarked ? "—" : ts("notCheckedIn")} />
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">{ts("checkOut")}</p>
                      <EventCell
                        time={outTime}
                        source={outSource}
                        nextDay={Boolean(r.checkOutTime) && dayjs(r.checkOutTime).format("YYYY-MM-DD") !== r.date}
                        emptyLabel={unmarked ? "—" : ts("stillOpen")}
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-2 border-t border-gray-100 pt-2">
                    {dur.text ? (
                      <span className={`text-xs tabular-nums ${DURATION_TEXT[r.status] ?? "text-gray-600"}`}>⏱ {dur.text}</span>
                    ) : dur.invalid ? (
                      <span className="inline-flex items-center gap-1 text-xs text-red-600">
                        <TriangleAlert aria-hidden className="h-3.5 w-3.5" /> {ts("outBeforeIn")}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400">{unmarked ? ts("nothingRecorded") : ts("noDurationYet")}</span>
                    )}
                    <div className="flex items-center gap-3">
                      {unmarked && rbac.canManageHR && (
                        <button
                          onClick={() => openMarkFor(r.staffId, nameOf(r))}
                          className="text-accent-warn-deep hover:underline text-xs font-semibold"
                        >
                          {ts("markAttendance")}
                        </button>
                      )}
                      <button
                        onClick={() => setViewStaff({ id: r.staffId, label: nameOf(r) })}
                        className="text-blue-600 hover:underline text-xs font-medium"
                      >
                        {ts("viewMonth")}
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
                  <th className="px-4 py-3 text-left">{t("leaves.staff")}</th>
                  <th className="px-4 py-3 text-left">{tc("field.status")}</th>
                  <th className="px-4 py-3 text-left">{ts("checkIn")}</th>
                  <th className="px-4 py-3 text-left">{ts("checkOut")}</th>
                  <th className="px-4 py-3 text-left">{t("myAttendance.duration")}</th>
                  <th className="px-4 py-3 text-left">{tc("action.view")}</th>
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
                        <div className="font-medium text-gray-900">{nameOf(r)}</div>
                        <div className="text-[11px] text-gray-500">
                          {r.staff?.employeeCode ? `EMP-${r.staff.employeeCode}` : t("overview.staffNo", { id: r.staffId })}
                          {r.staff?.user?.mobile ? ` · ${r.staff.user.mobile}` : ""}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <StatusChip status={r.status} />
                      </td>
                      <td className="px-4 py-3">
                        <EventCell time={inTime} source={inTime ? checkInSource(r) : null} late={r.isLate} emptyLabel={unmarked ? "—" : ts("notCheckedIn")} />
                      </td>
                      <td className="px-4 py-3">
                        <EventCell
                          time={outTime}
                          source={checkOutSource(r)}
                          nextDay={Boolean(r.checkOutTime) && dayjs(r.checkOutTime).format("YYYY-MM-DD") !== r.date}
                          emptyLabel={unmarked ? "—" : ts("stillOpen")}
                        />
                      </td>
                      <td className="px-4 py-3">
                        {dur.text ? (
                          <span className={`tabular-nums ${DURATION_TEXT[r.status] ?? "text-gray-600"}`}>{dur.text}</span>
                        ) : dur.invalid ? (
                          <span
                            className="inline-flex items-center gap-1 text-xs text-red-600"
                            title={ts("outOfOrderTitle")}
                          >
                            <TriangleAlert aria-hidden className="h-3.5 w-3.5 shrink-0" /> {ts("outOfOrder")}
                          </span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col items-start gap-1">
                          <button
                            onClick={() => setViewStaff({ id: r.staffId, label: nameOf(r) })}
                            className="text-blue-600 hover:underline text-xs font-medium"
                          >
                            {tc("action.view")}
                          </button>
                          {unmarked && rbac.canManageHR && (
                            <button
                              onClick={() => openMarkFor(r.staffId, nameOf(r))}
                              className="text-accent-warn-deep hover:underline text-xs font-semibold"
                            >
                              {ts("mark")}
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
              {statusFilter
                ? ts("showingFiltered", { shown: records.length, total: totalRecords, label: activeTallyLabel.toLowerCase() })
                : ts("showing", { shown: records.length, total: totalRecords })}
            </p>
            {hasMore && (
              <button
                onClick={() => void loadMore()}
                disabled={loadingMore}
                className="border-line text-ink-soft hover:bg-surface-secondary hover:border-line-strong min-h-11 rounded-full border px-5 text-sm font-medium disabled:opacity-60"
              >
                {loadingMore ? tc("state.loading") : ts("loadMore", { count: Math.min(PAGE_SIZE, totalRecords - records.length) })}
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
            <h2 className="font-semibold text-lg">{ts("closePendingTitle")}</h2>
            <div className="bg-orange-50 border border-orange-100 rounded-lg p-3">
              <p className="text-sm font-medium text-orange-900">{resolveTarget.name}</p>
              <p className="text-xs text-orange-700 mt-0.5">
                {resolveTarget.daysAgo > 0
                  ? ts("openSinceAgo", { date: resolveTarget.date, count: resolveTarget.daysAgo })
                  : ts("openSince", { date: resolveTarget.date })}
              </p>
              {/* The check-in stays on screen while the checkout is chosen: the
                  time being typed is only correct relative to this one. */}
              <div className="mt-2.5 flex items-center gap-3 border-t border-orange-100 pt-2.5">
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-orange-500">{ts("checkedIn")}</p>
                  <p className="text-sm font-semibold tabular-nums text-orange-900">
                    {dayjs(resolveTarget.checkInTime).format("HH:mm:ss")}
                  </p>
                </div>
                <span aria-hidden className="text-orange-300">→</span>
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-orange-500">{ts("checkingOut")}</p>
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
                <label className="text-sm font-medium">{ts("checkoutDate")}</label>
                <div className="mt-1">
                  <AppDatePicker value={resolveForm.checkOutDate} onChange={(v) => setResolveForm((f) => ({ ...f, checkOutDate: v }))} />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">{ts("checkoutTime")}</label>
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
                {ts("defaultsTo")}{" "}
                {resolvePreview ? ts("recordsWork", { span: resolvePreview }) : ts("adjustHint")}
              </p>
            )}
            <div>
              <label className="text-sm font-medium">{t("myLeaves.reason")}</label>
              <select
                value={resolveForm.reason}
                onChange={(e) => setResolveForm((f) => ({ ...f, reason: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm mt-1"
              >
                <option value="FORGOT">{t("checkoutReason.FORGOT")}</option>
                <option value="REGULAR">{t("checkoutReason.REGULAR")}</option>
                <option value="EARLY_LEAVE">{t("checkoutReason.EARLY_LEAVE")}</option>
                <option value="OVERTIME">{t("checkoutReason.OVERTIME")}</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">{ts("hrNote")} <span className="text-gray-400 font-normal">({tc("state.optional")})</span></label>
              <input
                value={resolveForm.hrNote}
                onChange={(e) => setResolveForm((f) => ({ ...f, hrNote: e.target.value }))}
                placeholder={ts("hrNotePlaceholder")}
                className="w-full border rounded-lg px-3 py-2 text-sm mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">{ts("attendanceStatus")}</label>
              <select
                value={resolveForm.status}
                onChange={(e) => setResolveForm((f) => ({ ...f, status: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm mt-1"
              >
                <option value="PRESENT">{t("attendanceStatus.PRESENT")}</option>
                <option value="HALF_DAY">{t("attendanceStatus.HALF_DAY")}</option>
                <option value="LATE">{t("attendanceStatus.LATE")}</option>
                <option value="ABSENT">{t("attendanceStatus.ABSENT")}</option>
              </select>
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setResolveTarget(null)} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">{tc("action.cancel")}</button>
              <button
                onClick={handleHrResolve}
                disabled={resolving || Boolean(resolveError)}
                className="px-4 py-2 text-sm bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-60"
              >
                {resolving ? ts("closing") : ts("closeCheckout")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manual mark modal */}
      {showMark && (
        <div className="fixed inset-0 bg-walnut-950/55 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm space-y-4 max-h-[90vh] overflow-y-auto">
            <h2 className="font-semibold text-lg">{ts("markManuallyTitle")}</h2>

            {/* Search mode toggle */}
            <div className="flex gap-1 bg-gray-100 rounded-lg p-1 text-xs">
              <button
                type="button"
                onClick={() => setMarkSearchMode("quick")}
                className={`flex-1 py-1.5 rounded-md font-medium ${markSearchMode === "quick" ? "bg-white shadow text-gray-900" : "text-gray-500"}`}
              >
                {ts("quickSearch")}
              </button>
              <button
                type="button"
                onClick={() => setMarkSearchMode("explicit")}
                className={`flex-1 py-1.5 rounded-md font-medium ${markSearchMode === "explicit" ? "bg-white shadow text-gray-900" : "text-gray-500"}`}
              >
                {ts("byCode")}
              </button>
            </div>

            {markSearchMode === "quick" ? (
              <StaffPicker
                label={t("leaves.staffMember")}
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
              <label className="text-sm font-medium">{tc("field.date")}</label>
              <input
                type="date"
                value={markDate}
                max={today}
                onChange={(e) => setMarkDate(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm mt-1"
              />
              <p className="text-[11px] text-gray-500 mt-1">{ts("defaultsToday")}</p>
            </div>
            <div>
              <label className="text-sm font-medium">{tc("field.status")}</label>
              <select value={markForm.status} onChange={(e) => setMarkForm((f) => ({ ...f, status: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm mt-1">
                {(["PRESENT","ABSENT","LATE","HALF_DAY","ON_LEAVE"] as const).map((s) => <option key={s} value={s}>{t(`attendanceStatus.${s}`)}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">{t("myAttendance.checkIn")}</label>
                <div className="mt-1">
                  <AppTimePicker value={markForm.checkInTime} onChange={(v) => setMarkForm((f) => ({ ...f, checkInTime: v }))} />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium">{t("myAttendance.checkOut")}</label>
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
              <p className="text-[11px] text-gray-500">{ts("recordsWorkOn", { span: markPreview, date: markDate })}</p>
            ) : null}
            <div>
              <label className="text-sm font-medium">{ts("overrideReason")}</label>
              <input value={markForm.overrideReason} onChange={(e) => setMarkForm((f) => ({ ...f, overrideReason: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm mt-1" />
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowMark(false)} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">{tc("action.cancel")}</button>
              <button
                onClick={handleMark}
                disabled={Boolean(markError)}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-60"
              >
                {ts("mark")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Working-hours report modal */}
      {showReport && (
        <div className="fixed inset-0 bg-walnut-950/55 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm space-y-4 max-h-[90vh] overflow-y-auto">
            <h2 className="font-semibold text-lg">{ts("reportTitle")}</h2>
            <p className="text-sm text-gray-600">
              {ts("reportHint", { max: REPORT_MAX_DAYS })}
            </p>

            <div className="flex gap-1 bg-gray-100 rounded-lg p-1 text-xs">
              <button
                type="button"
                onClick={() => setReportMode("month")}
                className={`flex-1 py-1.5 rounded-md font-medium ${reportMode === "month" ? "bg-white shadow text-gray-900" : "text-gray-500"}`}
              >
                {ts("byMonth")}
              </button>
              <button
                type="button"
                onClick={() => setReportMode("custom")}
                className={`flex-1 py-1.5 rounded-md font-medium ${reportMode === "custom" ? "bg-white shadow text-gray-900" : "text-gray-500"}`}
              >
                {ts("customRange")}
              </button>
            </div>

            {reportMode === "month" ? (
              <div>
                <label className="text-sm font-medium" htmlFor="report-month">{t("payroll.month")}</label>
                <input
                  id="report-month"
                  type="month"
                  value={reportMonth}
                  max={today.slice(0, 7)}
                  onChange={(e) => setReportMonth(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm mt-1"
                />
                <p className="text-[11px] text-gray-500 mt-1">
                  {(() => {
                    const { from, to } = reportRange();
                    return ts("covers", { from, to });
                  })()}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">{tc("field.from")}</label>
                  <div className="mt-1">
                    <AppDatePicker value={reportForm.from} max={today} onChange={(v) => setReportForm((f) => ({ ...f, from: v }))} />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium">{tc("field.to")}</label>
                  <div className="mt-1">
                    <AppDatePicker value={reportForm.to} max={today} onChange={(v) => setReportForm((f) => ({ ...f, to: v }))} />
                  </div>
                </div>
              </div>
            )}

            <StaffPicker
              label={ts("reportStaff")}
              value={reportForm.staffId}
              onChange={(id) => setReportForm((f) => ({ ...f, staffId: id }))}
            />

            {/* Sections: leaving Detail off keeps a whole-school download small. */}
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">{ts("include")}</legend>
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={reportSummary}
                  onChange={(e) => setReportSummary(e.target.checked)}
                  className="mt-1"
                />
                <span>
                  {ts("summary")}
                  <span className="block text-[11px] text-gray-500">
                    {ts("summaryHint")}
                  </span>
                </span>
              </label>
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={reportDetail}
                  onChange={(e) => setReportDetail(e.target.checked)}
                  className="mt-1"
                />
                <span>
                  {ts("detail")}
                  <span className="block text-[11px] text-gray-500">
                    {ts("detailHint")}
                  </span>
                </span>
              </label>
            </fieldset>

            {reportError() ? (
              <p role="alert" className="flex items-start gap-1.5 rounded-lg bg-red-50 px-3 py-2 text-[11px] text-red-700">
                <TriangleAlert aria-hidden className="mt-px h-3.5 w-3.5 shrink-0" />
                {reportError()}
              </p>
            ) : null}

            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowReport(false)} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">{tc("action.close")}</button>
              <button
                onClick={handleReportCsv}
                disabled={reportBusy !== null || reportError() !== null}
                className="px-4 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-60"
              >
                {reportBusy === "csv" ? ts("preparing") : ts("downloadCsv")}
              </button>
              <button
                onClick={handleReportPdf}
                disabled={reportBusy !== null || reportError() !== null}
                className="px-4 py-2 text-sm bg-slate-700 text-white rounded-lg hover:bg-slate-800 disabled:opacity-60"
              >
                {reportBusy === "pdf" ? ts("preparing") : t("mySalary.downloadPdf")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bypass window modal */}
      {showBypass && (
        <div className="fixed inset-0 bg-walnut-950/55 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm space-y-4">
            <h2 className="font-semibold text-lg">{ts("openBypass")}</h2>
            <p className="text-sm text-gray-600">{ts("bypassHint")}</p>
            <div>
              <label className="text-sm font-medium">{ts("durationHours")}</label>
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
              <label className="text-sm font-medium">{ts("reasonOptional")}</label>
              <input value={bypassForm.reason} onChange={(e) => setBypassForm((f) => ({ ...f, reason: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm mt-1" />
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowBypass(false)} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">{tc("action.cancel")}</button>
              <button onClick={handleBypass} className="px-4 py-2 text-sm bg-amber-600 text-white rounded-lg hover:bg-amber-700">{ts("activate")}</button>
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
              <h2 className="font-semibold text-lg">{ts("settingsTitle")}</h2>
            </div>
            <p className="text-xs text-gray-500">
              {t.rich("staffAtt.settingsBody", { strong: (c) => <strong>{c}</strong> })}
            </p>
            {settingsLoading ? (
              <p className="text-sm text-gray-500 py-4 text-center">{tc("state.loading")}</p>
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
                      {ts("fullDayHrs")}
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
                      {ts("halfDayHrs")}
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
                  {ts("minHoursHint")}
                </p>
                <div>
                  <label className="text-sm font-medium">{ts("lateCutoff")}</label>
                  <div className="mt-1">
                    <AppTimePicker
                      value={settingsForm.lateCutoffTime}
                      onChange={(v) => setSettingsForm((f) => ({ ...f, lateCutoffTime: v }))}
                    />
                  </div>
                  <p className="text-[11px] text-gray-500 mt-1">{ts("lateCutoffHint")}</p>
                </div>
                {settingsError && (
                  <p role="alert" className="flex items-start gap-1.5 rounded-lg bg-red-50 px-3 py-2 text-[11px] text-red-700">
                    <TriangleAlert aria-hidden className="mt-px h-3.5 w-3.5 shrink-0" />
                    {settingsError}
                  </p>
                )}
                <div className="flex gap-2 justify-end pt-1">
                  <button onClick={() => setShowSettings(false)} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">{tc("action.cancel")}</button>
                  <button
                    onClick={handleSaveSettings}
                    disabled={settingsSaving || Boolean(settingsError)}
                    className="px-4 py-2 text-sm bg-slate-800 text-white rounded-lg hover:bg-slate-900 disabled:opacity-60"
                  >
                    {settingsSaving ? tc("action.saving") : ts("saveSettings")}
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
