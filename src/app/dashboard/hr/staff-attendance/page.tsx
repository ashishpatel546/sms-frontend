"use client";

import { useState, useEffect, useCallback } from "react";
import { hrApi, StaffAttendanceRecord, AttendanceBypassWindow, StaffBiometric, WebauthnRegistrationPermit, DailyAttendanceSummary, HrPendingCheckoutItem, AttendanceMethod } from "@/lib/hr-api";
import { useRbac } from "@/lib/rbac";
import { todayLocalDate } from "@/lib/utils";
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
type AttendanceRow = StaffAttendanceRecord & { isLate?: boolean };

const PAGE_SIZE = 20;

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
function calcDuration(record: Pick<StaffAttendanceRecord, "checkInTime" | "checkOutTime" | "workedHours">): string | null {
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
function durationOf(r: StaffAttendanceRecord): { text: string | null; invalid: boolean } {
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

const staffNameOf = (r: StaffAttendanceRecord) =>
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

const checkInSource = (r: StaffAttendanceRecord): Provenance =>
  describeSource(r.method, r.markedBy, r.staff?.user?.id, staffNameOf(r));

/** Null while the record is still open — there is no check-out to describe. */
const checkOutSource = (r: StaffAttendanceRecord): Provenance | null =>
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

const STATUS_STYLES: Record<string, string> = {
  PRESENT: "bg-green-100 text-green-700",
  LATE: "bg-amber-100 text-amber-700",
  ABSENT: "bg-red-100 text-red-700",
  HALF_DAY: "bg-blue-100 text-blue-700",
  ON_LEAVE: "bg-purple-100 text-purple-700",
  HOLIDAY: "bg-gray-100 text-gray-600",
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

export default function StaffAttendancePage() {
  const rbac = useRbac();
  const today = todayLocalDate();

  const [date, setDate] = useState(today);
  const [records, setRecords] = useState<AttendanceRow[]>([]);
  const [bypass, setBypass] = useState<AttendanceBypassWindow | null>(null);
  const [loading, setLoading] = useState(true);

  // Pagination + server-side search
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [summary, setSummary] = useState<DailyAttendanceSummary>({ PRESENT: 0, LATE: 0, ABSENT: 0, HALF_DAY: 0, ON_LEAVE: 0, HOLIDAY: 0 });
  // Real "checked in after the cutoff today" count — see the field doc on
  // PaginatedDailyAttendance.lateArrivals for why this isn't summary.LATE.
  const [lateArrivals, setLateArrivals] = useState(0);
  const [draftSearch, setDraftSearch] = useState({ name: "", mobile: "", employeeCode: "", staffId: "" });
  const [activeSearch, setActiveSearch] = useState({ name: "", mobile: "", employeeCode: "", staffId: "" });

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

  const loadRecords = useCallback(async () => {
    setLoading(true);
    try {
      const search = [activeSearch.name, activeSearch.mobile].filter(Boolean).join(" ").trim() || undefined;
      const [recs, bp] = await Promise.allSettled([
        hrApi.attendance.daily(date, {
          page: currentPage,
          limit: PAGE_SIZE,
          search,
          employeeCode: activeSearch.employeeCode || undefined,
          staffId: activeSearch.staffId || undefined,
        }),
        hrApi.attendance.bypass.getActive(),
      ]);
      if (recs.status === "fulfilled") {
        setRecords(recs.value.data);
        setTotalPages(recs.value.totalPages);
        setTotalRecords(recs.value.total);
        setSummary(recs.value.summary);
        setLateArrivals(recs.value.lateArrivals ?? 0);
      }
      if (bp.status === "fulfilled") setBypass(bp.value);
    } catch { toast.error("Failed to load attendance"); }
    finally { setLoading(false); }
  }, [date, currentPage, activeSearch]);

  useEffect(() => { loadRecords(); }, [loadRecords]);
  // Reset to page 1 when date changes
  useEffect(() => { setCurrentPage(1); }, [date]);

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

  const present = summary.PRESENT + summary.LATE;
  const absent = summary.ABSENT;
  const hasActiveSearch = Boolean(activeSearch.name || activeSearch.mobile || activeSearch.employeeCode || activeSearch.staffId);

  const applySearch = () => {
    const next = { ...draftSearch };
    if (!next.name && !next.mobile && !next.employeeCode && !next.staffId) {
      toast("Enter at least one search field.");
      return;
    }
    setActiveSearch(next);
    setCurrentPage(1);
  };

  const clearSearch = () => {
    const empty = { name: "", mobile: "", employeeCode: "", staffId: "" };
    setDraftSearch(empty);
    setActiveSearch(empty);
    setCurrentPage(1);
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
      {/* Date picker + stats */}
      <div className="flex flex-wrap items-center gap-3">
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="border rounded-lg px-3 py-2 text-sm" />
        <span className="text-sm text-gray-600">Present: <strong className="text-green-700">{present}</strong></span>
        <span className="text-sm text-gray-600">Late: <strong className="text-amber-700">{lateArrivals}</strong></span>
        <span className="text-sm text-gray-600">Absent: <strong className="text-red-700">{absent}</strong></span>
        <span className="text-sm text-gray-600" title="Active staff with no attendance record for this date">
          Not Marked: <strong className="text-orange-600">{summary.NOT_MARKED ?? 0}</strong>
        </span>
        <span className="text-sm text-gray-600">Total: <strong>{totalRecords}</strong></span>
        {hasActiveSearch && (
          <span className="text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded px-2 py-0.5">{totalRecords} result{totalRecords === 1 ? "" : "s"} for search</span>
        )}
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
        <p className="text-sm text-gray-500">{hasActiveSearch ? "No staff match your search." : "No attendance records for this date."}</p>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="sm:hidden space-y-3">
            {records.map((r) => {
              const dur = durationOf(r);
              const inTime = clock(r.checkInTime);
              const outTime = clock(r.checkOutTime);
              const outSource = checkOutSource(r);
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
                    <span className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[r.status] ?? "bg-gray-100"}`}>{r.status}</span>
                  </div>
                  {/* Check-in and check-out side by side: the whole point of the
                      audit split is comparing the two, so they stay adjacent
                      even on the narrowest phone. */}
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="space-y-1">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Check-in</p>
                      <EventCell time={inTime} source={inTime ? checkInSource(r) : null} late={r.isLate} emptyLabel="Not checked in" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Check-out</p>
                      <EventCell
                        time={outTime}
                        source={outSource}
                        nextDay={Boolean(r.checkOutTime) && dayjs(r.checkOutTime).format("YYYY-MM-DD") !== r.date}
                        emptyLabel="Still open"
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
                      <span className="text-xs text-gray-400">No duration yet</span>
                    )}
                    <button
                      onClick={() => setViewStaff({ id: r.staffId, label: staffNameOf(r) })}
                      className="text-blue-600 hover:underline text-xs font-medium"
                    >
                      View month →
                    </button>
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
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLES[r.status] ?? "bg-gray-100"}`}>{r.status}</span>
                      </td>
                      <td className="px-4 py-3">
                        <EventCell time={inTime} source={inTime ? checkInSource(r) : null} late={r.isLate} emptyLabel="Not checked in" />
                      </td>
                      <td className="px-4 py-3">
                        <EventCell
                          time={outTime}
                          source={checkOutSource(r)}
                          nextDay={Boolean(r.checkOutTime) && dayjs(r.checkOutTime).format("YYYY-MM-DD") !== r.date}
                          emptyLabel="Still open"
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
                        <button
                          onClick={() => setViewStaff({ id: r.staffId, label: staffNameOf(r) })}
                          className="text-blue-600 hover:underline text-xs font-medium"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination controls */}
          {totalPages > 1 && (
            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <p className="text-xs text-gray-500">
                Page {currentPage} of {totalPages} &mdash; {totalRecords} record{totalRecords === 1 ? "" : "s"} total
              </p>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  className="px-2.5 py-1.5 text-xs border rounded-lg disabled:opacity-40 hover:bg-gray-50"
                  aria-label="First page"
                >
                  «
                </button>
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 text-xs border rounded-lg disabled:opacity-40 hover:bg-gray-50"
                >
                  Prev
                </button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const start = Math.max(1, Math.min(currentPage - 2, totalPages - 4));
                  const pg = start + i;
                  return pg <= totalPages ? (
                    <button
                      key={pg}
                      onClick={() => setCurrentPage(pg)}
                      className={`px-3 py-1.5 text-xs border rounded-lg ${
                        pg === currentPage ? "bg-blue-600 text-white border-blue-600" : "hover:bg-gray-50"
                      }`}
                    >
                      {pg}
                    </button>
                  ) : null;
                })}
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1.5 text-xs border rounded-lg disabled:opacity-40 hover:bg-gray-50"
                >
                  Next
                </button>
                <button
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                  className="px-2.5 py-1.5 text-xs border rounded-lg disabled:opacity-40 hover:bg-gray-50"
                  aria-label="Last page"
                >
                  »
                </button>
              </div>
            </div>
          )}
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
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-sm font-medium">Min hours — Full Day</label>
                    <input
                      type="number"
                      step={0.5}
                      min={0.5}
                      max={24}
                      value={settingsForm.minFullDayHours}
                      onChange={(e) => setSettingsForm((f) => ({ ...f, minFullDayHours: Number(e.target.value) }))}
                      className="w-full border rounded-lg px-3 py-2 text-sm mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Min hours — Half Day</label>
                    <input
                      type="number"
                      step={0.5}
                      min={0.5}
                      max={24}
                      value={settingsForm.minHalfDayHours}
                      onChange={(e) => setSettingsForm((f) => ({ ...f, minHalfDayHours: Number(e.target.value) }))}
                      className="w-full border rounded-lg px-3 py-2 text-sm mt-1"
                    />
                  </div>
                </div>
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
