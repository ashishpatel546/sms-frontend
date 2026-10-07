"use client";
// React Compiler opt-out: this page is too large and complex for the compiler
// to analyse without crashing (OOM in babel-plugin-react-compiler worker).
"use no memo";

import { useState, useEffect } from "react";
import { hrApi, StaffAttendanceRecord, StaffBiometric, WebauthnPermitStatus, CheckOutReason, TodayAttendanceStatus, type StaffAttendanceStatus, type AttendanceMethod } from "@/lib/hr-api";
import { useLocale, useTranslations } from "next-intl";
import { INTL_LOCALE, type Locale } from "@/i18n/config";
import {
  attendanceSettingsApi,
  previewCheckoutStatus,
  type AttendanceSettings,
  type CheckoutPreviewStatus,
} from "@/lib/attendance-settings-api";
import toast, { Toaster } from "react-hot-toast";
import { startRegistration, startAuthentication } from "@simplewebauthn/browser";
import { getOrCreateDeviceKeyPair, signChallenge, getDevicePublicKey, clearDeviceKeyPair } from "@/lib/device-crypto";
import { todayLocalDate, formatTime } from "@/lib/utils";
import {
  acquirePreciseFix,
  describeAccuracy,
  fixErrorMessage,
  GeolocationFixError,
  DEFAULT_TARGET_ACCURACY_M,
  type PreciseFix,
} from "@/lib/geolocation";
import { useHelperMessage } from "@/i18n/useHelperMessage";
import { PieChart, Pie, ResponsiveContainer, Tooltip } from "recharts";
import { ATTENDANCE_TONE, attendanceCellClass } from "@/lib/attendanceColors";
import { CHART_TOOLTIP } from "@/lib/chartTokens";
import { CheckCircle2, Clock3, TriangleAlert } from "lucide-react";
import { API_BASE_URL } from "@/lib/api";
import { authFetch } from "@/lib/auth";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
dayjs.extend(duration);

/**
 * `StaffAttendanceRecord` (in `hr-api.ts`) predates the `isLate` column —
 * extending it locally avoids touching that shared file. Every record the
 * today-status/monthly endpoints return now carries `isLate` alongside `status`.
 */
type AttendanceRow = StaffAttendanceRecord & { isLate?: boolean };

const MONTH_NUMBERS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const WEEKDAYS = ["su", "mo", "tu", "we", "th", "fr", "sa"] as const;
const STATUS_STYLES: Record<string, string> = {
  PRESENT: "bg-green-100 text-green-700 border-green-200",
  LATE: "bg-amber-100 text-amber-700 border-amber-200",
  ABSENT: "bg-red-100 text-red-700 border-red-200",
  HALF_DAY: "bg-blue-100 text-blue-700 border-blue-200",
  ON_LEAVE: "bg-purple-100 text-purple-700 border-purple-200",
  HOLIDAY: "bg-sky-100 text-sky-700 border-sky-200",
};

interface HolidayInfo {
  id: number;
  description: string;
  startDate: string;
  endDate: string;
  isEntireSchool: boolean;
}

/** Returns the holiday description if `dateStr` (YYYY-MM-DD) falls within a school-wide holiday range. */
function findHolidayFor(dateStr: string, holidays: HolidayInfo[]): HolidayInfo | null {
  for (const h of holidays) {
    if (!h.isEntireSchool) continue;
    const start = (h.startDate || "").slice(0, 10);
    const end = (h.endDate || "").slice(0, 10);
    if (start && end && dateStr >= start && dateStr <= end) return h;
  }
  return null;
}

/** Calculates duration between two HH:mm:ss strings. Returns "HH:MM:SS" or null. */
function calcDuration(checkIn?: string, checkOut?: string): string | null {
  if (!checkIn || !checkOut) return null;
  const inMs = checkIn.includes("T") ? dayjs(checkIn).valueOf() : dayjs("1970-01-01T" + checkIn).valueOf();
  const outMs = checkOut.includes("T") ? dayjs(checkOut).valueOf() : dayjs("1970-01-01T" + checkOut).valueOf();
  if (outMs <= inMs) return null;
  const dur = dayjs.duration(outMs - inMs);
  const hh = String(Math.floor(dur.asHours())).padStart(2, "0");
  const mm = String(dur.minutes()).padStart(2, "0");
  const ss = String(dur.seconds()).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

const DURATION_STYLES: Record<string, string> = {
  PRESENT: "text-green-700 font-medium",
  LATE: "text-amber-700 font-medium",
  HALF_DAY: "text-blue-700 font-medium",
  ON_LEAVE: "text-purple-700 font-medium",
  ABSENT: "text-red-500",
  HOLIDAY: "text-sky-600",
};
const now = new Date();
const todayStr = todayLocalDate();

type CheckInState = "idle" | "locating" | "authenticating" | "submitting" | "done" | "error";

/**
 * Live readout of how precisely the device has located itself.
 *
 * Shown during acquisition rather than only on failure, because the number is
 * the explanation. A teacher told "±1200m" understands immediately that the
 * phone is guessing from the network and that turning GPS on is the fix —
 * where "you are outside the school zone", the message this replaces, sent
 * people standing at the gate walking in circles looking for a better spot.
 */
function GpsPrecision({ accuracy, settling }: { accuracy: number | null; settling: boolean }) {
  const t = useTranslations("hr.myAttendance");
  if (accuracy === null) return null;

  const good = accuracy <= DEFAULT_TARGET_ACCURACY_M;
  const usable = accuracy <= DEFAULT_TARGET_ACCURACY_M * 4;
  // Fills as the fix converges on the target; a wildly coarse fix barely
  // registers, which is the honest picture.
  const filled = Math.max(2, Math.min(100, (DEFAULT_TARGET_ACCURACY_M / accuracy) * 100));

  return (
    <div className="mt-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] text-gray-500">
          {settling ? t("improvingPrecision") : t("precision")}
        </span>
        <span
          className={`text-[11px] font-medium tabular-nums ${
            good ? "text-green-700" : usable ? "text-amber-700" : "text-red-700"
          }`}
        >
          {describeAccuracy(accuracy)}
        </span>
      </div>
      <div
        role="progressbar"
        aria-label={t("precision")}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(filled)}
        aria-valuetext={t("accurateTo", { accuracy: describeAccuracy(accuracy) })}
        className="mt-1 h-1 w-full rounded-full bg-gray-200 overflow-hidden"
      >
        <div
          className={`h-full rounded-full transition-[width] duration-500 ${
            good ? "bg-green-500" : usable ? "bg-amber-500" : "bg-red-500"
          }`}
          style={{ width: `${filled}%` }}
        />
      </div>
      {!usable && !settling && (
        <p className="text-[11px] text-red-700 mt-1">
          {t("turnOnGps")}
        </p>
      )}
    </div>
  );
}

export default function MyAttendancePage() {
  const helperText = useHelperMessage();
  const t = useTranslations("hr");
  const tm = useTranslations("hr.myAttendance");
  const tc = useTranslations("common");
  const locale = useLocale() as Locale;
  const [records, setRecords] = useState<AttendanceRow[]>([]);
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [loading, setLoading] = useState(false);
  const [holidays, setHolidays] = useState<HolidayInfo[]>([]);

  // Today's check-in state
  const [checkInState, setCheckInState] = useState<CheckInState>("idle");
  const [checkInMsg, setCheckInMsg] = useState("");
  /**
   * Best accuracy seen so far while locating, in metres. Surfaced live because
   * it is the one number that explains a refusal: "±1300m" tells someone their
   * phone is guessing from the network far better than any wording can.
   */
  const [checkInAccuracy, setCheckInAccuracy] = useState<number | null>(null);
  const [todayRecord, setTodayRecord] = useState<AttendanceRow | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<"PRESENT" | "LATE" | "HALF_DAY">("PRESENT");

  // Checkout state
  const [checkOutState, setCheckOutState] = useState<CheckInState>("idle");
  const [checkOutMsg, setCheckOutMsg] = useState("");
  const [checkOutAccuracy, setCheckOutAccuracy] = useState<number | null>(null);
  const [checkOutReason, setCheckOutReason] = useState<CheckOutReason>("REGULAR");
  const [refreshKey, setRefreshKey] = useState(0);

  // Attendance settings — fetched once so a checkout can be previewed client-side
  // before it fires. TEACHER+ (all staff) can read this endpoint.
  const [attendanceSettings, setAttendanceSettings] = useState<AttendanceSettings | null>(null);
  useEffect(() => {
    let cancelled = false;
    attendanceSettingsApi
      .get()
      .then((s) => { if (!cancelled) setAttendanceSettings(s); })
      .catch(() => { /* preview just won't be shown — checkout itself is unaffected */ });
    return () => { cancelled = true; };
  }, []);

  // Checkout confirmation — shown only when the preview says this checkout
  // would land as HALF_DAY or ABSENT. A PRESENT preview proceeds with no friction.
  const [checkoutPreview, setCheckoutPreview] = useState<{ status: CheckoutPreviewStatus; hours: number } | null>(null);
  const [showCheckoutConfirm, setShowCheckoutConfirm] = useState(false);

  // Pending prior-day checkout
  const [pendingCheckOut, setPendingCheckOut] = useState<TodayAttendanceStatus["pendingCheckOut"]>(null);


  // Biometric registration state
  const [biometrics, setBiometrics] = useState<StaffBiometric[]>([]);
  const [biometricsLoading, setBiometricsLoading] = useState(true);
  const [permitStatus, setPermitStatus] = useState<WebauthnPermitStatus>({ allowed: false });
  const [regState, setRegState] = useState<"idle" | "registering" | "done" | "error">("idle");
  const [regMsg, setRegMsg] = useState("");
  const [deviceName, setDeviceName] = useState("");
  const [showRegPanel, setShowRegPanel] = useState(false);
  const [inPwa, setInPwa] = useState<boolean | null>(null); // null = not yet detected

  // Detect PWA mode on client only (avoids SSR mismatch)
  useEffect(() => {
    const standalone =
      (window.navigator as any).standalone === true ||
      window.matchMedia('(display-mode: standalone)').matches ||
      window.matchMedia('(display-mode: fullscreen)').matches ||
      window.matchMedia('(display-mode: minimal-ui)').matches;
    setInPwa(standalone);
  }, []);

  // null  = indeterminate (no biometrics yet, or biometric has no devicePublicKey stored)
  // true  = this device's key matches the registered biometric
  // false = this device is NOT the registered device
  const [isOwnDevice, setIsOwnDevice] = useState<boolean | null>(null);

  useEffect(() => {
    const registeredKey = biometrics[0]?.devicePublicKey;
    if (!registeredKey) {
      setIsOwnDevice(null); // can't determine without a stored key (old credential)
      return;
    }
    getDevicePublicKey().then((currentKey) => {
      setIsOwnDevice(currentKey === registeredKey);
    });
  }, [biometrics]);

  async function refreshBiometrics() {
    try {
      const [creds, permit] = await Promise.all([
        hrApi.attendance.webauthn.myCredentials(),
        hrApi.attendance.webauthn.myPermitStatus(),
      ]);
      setBiometrics(creds);
      setPermitStatus(permit);
    } catch { /* silently ignore — biometrics section is optional */ }
  }

  // Load today's status (todayRecord + pending checkout) on mount
  useEffect(() => {
    let cancelled = false;
    hrApi.attendance.todayStatus()
      .then((s) => {
        if (cancelled) return;
        setTodayRecord(s.todayRecord);
        setPendingCheckOut(s.pendingCheckOut);
      })
      .catch(() => { /* no staff profile — ignore */ });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const doLoad = async () => {
      setLoading(true);
      try {
        const recs = await hrApi.attendance.myMonthly(month, year);
        if (cancelled) return;
        setRecords(recs);
        // Sync todayRecord from monthly only if todayStatus hasn't loaded it yet
        if (month === now.getMonth() + 1 && year === now.getFullYear()) {
          setTodayRecord((prev) => prev ?? recs.find((r) => r.date === todayStr) ?? null);
        }
      } catch (e: any) {
        if (cancelled) return;
        if (e?.status === 404 || e?.status === 403) {
          setRecords([]);
        } else {
          toast.error(tm("loadFailed"));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    doLoad();
    return () => { cancelled = true; };
  }, [month, year, refreshKey]);

  useEffect(() => {
    let cancelled = false;
    const doLoad = async () => {
      // Run both calls independently so one failure doesn't block the other
      try {
        const creds = await hrApi.attendance.webauthn.myCredentials();
        if (!cancelled) setBiometrics(creds);
      } catch { /* no staff profile or API error — credentials stay empty */ }
      try {
        const permit = await hrApi.attendance.webauthn.myPermitStatus();
        if (!cancelled) setPermitStatus(permit);
      } catch { /* ignore — permit status stays at default { allowed: false } */ }
      if (!cancelled) setBiometricsLoading(false);
    };
    doLoad();
    return () => { cancelled = true; };
  }, []);

  // Load school holidays once — used to mark HOLIDAY days in the calendar
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await authFetch(`${API_BASE_URL}/holidays`);
        if (!res.ok) return;
        const list = await res.json();
        if (!cancelled) setHolidays(Array.isArray(list) ? list : []);
      } catch { /* ignore — holidays optional */ }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleRegisterDevice = async () => {
    setRegState("registering");
    setRegMsg(tm("regFollowPrompt"));
    try {
      // Get or generate the device's ECDSA key pair from IndexedDB.
      // The private key is non-extractable — it never leaves this browser.
      const { publicKeySpki, privateKey } = await getOrCreateDeviceKeyPair();

      // Check for cross-user device conflict and obtain the WebAuthn challenge.
      const options = await hrApi.attendance.webauthn.selfGetRegOptions(publicKeySpki);

      // Sign the WebAuthn challenge with the device private key.
      // The server verifies this signature to confirm we own the private key.
      const deviceSignature = await signChallenge(options.challenge, privateKey);

      // Run the actual WebAuthn registration (biometric prompt).
      const regResponse = await startRegistration({ optionsJSON: options });

      // Submit everything: WebAuthn response + device public key + signature.
      await hrApi.attendance.webauthn.selfVerifyReg(
        regResponse,
        deviceName || undefined,
        publicKeySpki,
        deviceSignature,
      );
      setRegState("done");
      setRegMsg(tm("regSuccess"));
      toast.success(tm("regToast"));
      refreshBiometrics();
    } catch (e: any) {
      const info = e?.info ?? {};
      if (info.code === 'DEVICE_TAKEN' || info.statusCode === 409) {
        setRegState("error");
        setRegMsg(
          info.message ??
          tm("deviceTaken")
        );
        return;
      }
      const msg = info.message ?? e?.message ?? tm("regFailed");
      setRegState("error");
      setRegMsg(msg);
    }
  };

  const handleDeleteBiometric = async (id: number) => {
    if (!confirm(tm("removeConfirm"))) return;
    try {
      await hrApi.attendance.webauthn.deleteMyCredential(id);
      // Wipe the local ECDSA key pair — old identity is now invalid
      await clearDeviceKeyPair().catch(() => {});
      toast.success(tm("removed"));
      refreshBiometrics();
    } catch { toast.error(t("devices.removeFailed")); }
  };

  const handleCheckIn = async () => {
    if (!navigator.geolocation) { toast.error(tm("noGps")); return; }

    setCheckInState("locating");
    setCheckInMsg(tm("finding"));
    setCheckInAccuracy(null);

    // Location and auth challenge in parallel — both are needed before the
    // biometric prompt, and the challenge fetch is free while GPS settles.
    // Ordering matters beyond speed: a failed fix must never reach the prompt,
    // or the user scans a fingerprint only to be told their GPS was no good.
    let fix: PreciseFix;
    let challengeOpts: any;
    try {
      [fix, challengeOpts] = await Promise.all([
        acquirePreciseFix({
          // Live feedback while the fix tightens. Without it a 20s wait looks
          // like the app has hung, which is what pushes people to give up and
          // ask HR to mark them manually.
          onProgress: ({ accuracy }) => setCheckInAccuracy(accuracy),
        }),
        hrApi.attendance.webauthn.selfGetAuthChallenge(),
      ]);
      setCheckInAccuracy(fix.accuracy);
    } catch (e: any) {
      setCheckInState("error");
      setCheckInMsg(
        e instanceof GeolocationFixError
          ? helperText(fixErrorMessage(e))
          : e?.info?.message ?? e?.message ?? tm("prepFailed")
      );
      return;
    }

    // Biometric prompt — proves this browser holds the enrolled private key
    setCheckInState("authenticating");
    setCheckInMsg(tm("confirmIdentity"));
    let assertion: any;
    try {
      assertion = await startAuthentication({ optionsJSON: challengeOpts });
    } catch (e: any) {
      setCheckInState("error");
      setCheckInMsg(tm("bioFailed"));
      return;
    }

    // Submit with GPS + WebAuthn assertion together
    setCheckInState("submitting");
    setCheckInMsg(tm("verifyingMarking"));
    try {
      const localTime = new Date().toTimeString().slice(0, 8);
      const isoTime = new Date().toISOString();
      const record = await hrApi.attendance.selfCheckIn({
        lat: fix.lat,
        lng: fix.lng,
        accuracy: fix.accuracy,
        clientTimestamp: isoTime,
        checkInTime: isoTime,
        status: selectedStatus,
        webauthnAssertion: assertion,
      });
      setTodayRecord(record as any);
      setCheckInState("done");
      setCheckInMsg(tm("checkedInAs", { status: t(`attendanceStatus.${(record as any).status as StaffAttendanceStatus}`), time: formatTime((record as any).checkInTime, localTime) }));
      setRefreshKey((k) => k + 1);
    } catch (e: any) {
      const info = e?.info;
      if (info?.code === "PENDING_CHECKOUT") {
        setPendingCheckOut({ date: info.pendingDate, checkInTime: "—", daysAgo: 1 });
      }
      setCheckInState("error");
      // The server distinguishes "you are elsewhere" from "your phone cannot
      // tell where you are", and its message already says which. The old
      // fallback asserted the first for every failure, so someone standing at
      // the gate with a weak fix was told to move closer.
      setCheckInMsg(info?.message ?? tm("checkInFailed"));
    }
  };

  const handleCheckOut = async () => {
    if (!navigator.geolocation) { toast.error(tm("noGps")); return; }

    setCheckOutState("locating");
    setCheckOutMsg(tm("finding"));
    setCheckOutAccuracy(null);

    let fix: PreciseFix;
    let challengeOpts: any;
    try {
      [fix, challengeOpts] = await Promise.all([
        acquirePreciseFix({
          onProgress: ({ accuracy }) => setCheckOutAccuracy(accuracy),
        }),
        hrApi.attendance.webauthn.selfGetAuthChallenge(),
      ]);
      setCheckOutAccuracy(fix.accuracy);
    } catch (e: any) {
      setCheckOutState("error");
      setCheckOutMsg(
        e instanceof GeolocationFixError
          ? helperText(fixErrorMessage(e))
          : e?.info?.message ?? e?.message ?? tm("prepFailed")
      );
      return;
    }

    setCheckOutState("authenticating");
    setCheckOutMsg(tm("confirmIdentity"));
    let assertion: any;
    try {
      assertion = await startAuthentication({ optionsJSON: challengeOpts });
    } catch {
      setCheckOutState("error");
      setCheckOutMsg(tm("bioFailed"));
      return;
    }

    setCheckOutState("submitting");
    setCheckOutMsg(tm("recordingCheckout"));
    try {
      const localTime = new Date().toTimeString().slice(0, 8);
      const isoTime = new Date().toISOString();
      // `statusOverride` is deliberately not sent: the backend now always
      // recomputes PRESENT/HALF_DAY/ABSENT from worked hours on checkout, so
      // a client-supplied status would be silently ignored. The preview
      // shown before this call (see `initiateCheckOut`) is the honest signal.
      const record = await hrApi.attendance.selfCheckOut({
        lat: fix.lat,
        lng: fix.lng,
        accuracy: fix.accuracy,
        clientTimestamp: isoTime,
        checkOutTime: isoTime,
        reason: checkOutReason,
        webauthnAssertion: assertion,
      });
      setTodayRecord(record as any);
      setCheckOutState("done");
      setCheckOutMsg(tm("checkedOutAt", { time: formatTime((record as any).checkOutTime, localTime) }));
      setRefreshKey((k) => k + 1);
    } catch (e: any) {
      const msg = e?.info?.message ?? tm("checkOutFailed");
      setCheckOutState("error");
      setCheckOutMsg(msg);
    }
  };

  /**
   * Entry point for the "Check Out Now" button. Computes what status the
   * checkout WOULD land as (client-side preview, mirroring the backend's
   * `statusFromWorkedHours`) and interrupts with a confirmation only when
   * that would be HALF_DAY or ABSENT — a PRESENT preview proceeds straight
   * to `handleCheckOut` with no extra friction.
   *
   * This is only ever a preview: if settings haven't loaded yet, or there's
   * no check-in time to compute from, it falls through to the normal
   * checkout — the backend is authoritative and recomputes for real on
   * submit, so a missed preview is a lost convenience, not a lost safeguard.
   */
  const initiateCheckOut = () => {
    if (!attendanceSettings || !todayRecord?.checkInTime) {
      handleCheckOut();
      return;
    }
    const preview = previewCheckoutStatus(todayRecord.checkInTime, new Date(), attendanceSettings);
    if (preview.status === "PRESENT") {
      handleCheckOut();
      return;
    }
    setCheckoutPreview(preview);
    setShowCheckoutConfirm(true);
  };

  const confirmCheckOut = () => {
    setShowCheckoutConfirm(false);
    handleCheckOut();
  };

  // ── Compute month-level stats including auto-derived holidays (Sundays + school-wide holidays) ──
  const daysInMonth = new Date(year, month, 0).getDate();
  const recordByDate = new Map(records.map((r) => [r.date, r]));
  let holidayCount = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    if (recordByDate.has(dateStr)) continue; // an explicit record (PRESENT/LATE/etc.) overrides
    const isSunday = new Date(year, month - 1, d).getDay() === 0;
    if (isSunday || findHolidayFor(dateStr, holidays)) holidayCount++;
  }

  // Five disjoint status buckets — every record falls into exactly one, which
  // is what makes them safe to sum for a percentage or draw as pie slices.
  // Legacy status="LATE" rows (the check-in dropdown still offers it) fold
  // into PRESENT, same as the backend's register buckets — late is a kind of
  // present, not a sixth bucket.
  const counts = {
    PRESENT: records.filter((r) => r.status === "PRESENT" || r.status === "LATE").length,
    HALF_DAY: records.filter((r) => r.status === "HALF_DAY").length,
    ON_LEAVE: records.filter((r) => r.status === "ON_LEAVE").length,
    ABSENT: records.filter((r) => r.status === "ABSENT").length,
    HOLIDAY: records.filter((r) => r.status === "HOLIDAY").length + holidayCount,
  };
  // isLate is an INDEPENDENT overlay, not a 6th status bucket — a record can
  // be isLate=true and still status=PRESENT (arrived late, worked a full
  // day). Counting it alongside PRESENT/HALF_DAY here would double-count
  // those days, and it can't be a pie slice for the same reason.
  const lateArrivalsCount = records.filter((r) => r.isLate || r.status === "LATE").length;

  const presentish = counts.PRESENT + counts.HALF_DAY;
  const workingMarked = counts.PRESENT + counts.HALF_DAY + counts.ON_LEAVE + counts.ABSENT;
  const presentPct = workingMarked > 0 ? Math.round((presentish / workingMarked) * 100) : 0;

  const pieData = [
    { name: t("attendanceStatus.PRESENT"), value: counts.PRESENT, fill: ATTENDANCE_TONE.PRESENT.fill },
    { name: t("attendanceStatus.HALF_DAY"), value: counts.HALF_DAY, fill: ATTENDANCE_TONE.HALF_DAY.fill },
    { name: t("calendar.leave"), value: counts.ON_LEAVE, fill: ATTENDANCE_TONE.LEAVE.fill },
    { name: t("attendanceStatus.ABSENT"), value: counts.ABSENT, fill: ATTENDANCE_TONE.ABSENT.fill },
    { name: t("attendanceStatus.HOLIDAY"), value: counts.HOLIDAY, fill: ATTENDANCE_TONE.HOLIDAY.fill },
  ].filter((d) => d.value > 0);

  return (
    <div className="p-3 sm:p-6 space-y-4">
      <Toaster />
      <h1 className="font-display text-[22px] sm:text-[26px] font-semibold tracking-[-0.02em] text-ink">{tm("title")}</h1>

      {/* ── Pending checkout banner — blocks new check-in ── */}
      {pendingCheckOut && (
        <div className="rounded-xl border-2 border-red-300 bg-red-50 p-4 flex flex-col gap-3">
          <div>
            <p className="text-sm font-bold text-red-800">{tm("unclosedTitle", { date: pendingCheckOut.date })}</p>
            <p className="text-xs text-red-600 mt-0.5">
              {tm("unclosedBody", { time: dayjs(pendingCheckOut.checkInTime).format('YYYY-MM-DD HH:mm:ss') })}
            </p>
          </div>

          <div className="flex items-start gap-2 bg-red-100 border border-red-300 rounded-lg px-3 py-2.5 text-xs text-red-800">
            <span className="shrink-0 mt-0.5">📞</span>
            <p>
              {t.rich("myAttendance.contactHr", { strong: (c) => <strong>{c}</strong>, date: pendingCheckOut.date })}
            </p>
          </div>
        </div>
      )}

      {/* ── Today's Check-In / Check-Out Card ── */}
      <div className={`rounded-xl border-2 p-5 flex flex-col gap-4 transition-colors ${
        todayRecord?.checkOutTime ? "border-green-300 bg-green-50"
        : checkInState === "error" || checkOutState === "error" ? "border-red-300 bg-red-50"
        : "border-blue-200 bg-blue-50"
      }`}>
        <div className="flex flex-col sm:flex-row sm:items-start gap-4">
          <div className="flex-1">
            <p className="text-sm font-semibold text-gray-800 mb-0.5">{tm("today", { date: new Date().toLocaleDateString(INTL_LOCALE[locale], { weekday: "long", day: "numeric", month: "long" }) })}</p>
            {todayRecord ? (
              <div className="flex flex-wrap items-center gap-2 mt-1">
                <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${STATUS_STYLES[todayRecord.status] ?? "bg-gray-100"}`}>{t(`attendanceStatus.${todayRecord.status as StaffAttendanceStatus}`)}</span>
                {todayRecord.isLate && (
                  <span
                    title={tm("lateTitle")}
                    className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700"
                  >
                    <Clock3 aria-hidden className="h-3 w-3" />
                    {tm("markedLate")}
                  </span>
                )}
                <span className="text-xs text-gray-500">{tm("via", { method: t(`method.${todayRecord.method as AttendanceMethod}`) })}</span>
                {todayRecord.checkInTime && <span className="text-xs text-gray-500">· {tm("inTime", { time: formatTime(todayRecord.checkInTime) })}</span>}
                {todayRecord.checkOutTime && <span className="text-xs text-gray-500">{tm("outTime", { time: formatTime(todayRecord.checkOutTime) })}</span>}
              </div>
            ) : null}
            {todayRecord?.isLate && (
              <p className="text-xs text-amber-700 mt-1">
                {tm("lateNote")}
              </p>
            )}
            {!todayRecord && (
              <p className="text-xs text-gray-500 mt-1">
                {checkInState === "idle" ? tm("notCheckedIn") : checkInMsg}
              </p>
            )}
            {checkInState === "error" && <p className="text-xs text-red-600 mt-1">{checkInMsg}</p>}
            {(checkInState === "locating" || checkInState === "authenticating" || checkInState === "submitting") && <p className="text-xs text-blue-600 mt-1">{checkInMsg}</p>}
            {checkOutState === "error" && <p className="text-xs text-red-600 mt-1">{checkOutMsg}</p>}
            {(checkOutState === "locating" || checkOutState === "authenticating" || checkOutState === "submitting") && <p className="text-xs text-amber-600 mt-1">{checkOutMsg}</p>}
            <GpsPrecision
              accuracy={checkInState !== "idle" ? checkInAccuracy : checkOutAccuracy}
              settling={checkInState === "locating" || checkOutState === "locating"}
            />
          </div>
        </div>

        {/* Wrong-device warning — shown whenever a different device is registered */}
        {!biometricsLoading && isOwnDevice === false && (
          <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-xs text-red-800">
            <span className="text-base shrink-0 mt-0.5">🚫</span>
            <div>
              <p className="font-semibold">{tm("wrongDevice")}</p>
              <p className="mt-0.5 text-red-700">
                {t.rich("myAttendance.wrongDeviceBody", { strong: (c) => <strong>{c}</strong>, em: (c) => <em>{c}</em>, device: biometrics[0]?.deviceName || tm("anotherDevice") })}
              </p>
            </div>
          </div>
        )}

        {/* Check-In row — shown when device registered, not yet checked in, no pending block */}
        {!biometricsLoading && biometrics.length > 0 && !todayRecord && !pendingCheckOut && (
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-gray-600">{tm("statusLabel")}</label>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value as typeof selectedStatus)}
                className="text-sm border border-gray-300 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-brand/40"
              >
                <option value="PRESENT">{t("attendanceStatus.PRESENT")}</option>
                <option value="LATE">{t("attendanceStatus.LATE")}</option>
                <option value="HALF_DAY">{t("attendanceStatus.HALF_DAY")}</option>
              </select>
            </div>
            <button
              onClick={handleCheckIn}
              disabled={isOwnDevice === false || checkInState === "locating" || checkInState === "authenticating" || checkInState === "submitting"}
              className="shrink-0 flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-semibold px-5 py-2.5 rounded-xl shadow transition-colors"
            >
              {(checkInState === "locating" || checkInState === "authenticating" || checkInState === "submitting") ? <span className="animate-spin">⏳</span> : <span>📍</span>}
              {checkInState === "locating" ? tm("gettingLocation") : checkInState === "authenticating" ? tm("scanning") : checkInState === "submitting" ? tm("marking") : checkInState === "error" ? tm("retryCheckIn") : tm("checkInNow")}
            </button>
          </div>
        )}

        {/* Not-registered notice — shown while loading is done but no device is enrolled */}
        {!biometricsLoading && biometrics.length === 0 && !todayRecord && !pendingCheckOut && (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            {tm("notRegisteredNotice")}
          </p>
        )}

        {/* Check-Out row — shown when device registered, checked in but not yet checked out */}
        {!biometricsLoading && biometrics.length > 0 && todayRecord && !["ON_LEAVE", "HOLIDAY"].includes(todayRecord.status) && !todayRecord.checkOutTime && (
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-gray-600">{tm("reasonLabel")}</label>
              <select
                value={checkOutReason}
                onChange={(e) => setCheckOutReason(e.target.value as CheckOutReason)}
                className="text-sm border border-gray-300 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
              >
                <option value="REGULAR">{t("checkoutReason.REGULAR")}</option>
                <option value="HALF_DAY">{t("checkoutReason.HALF_DAY")}</option>
                <option value="EARLY_LEAVE">{t("checkoutReason.EARLY_LEAVE")}</option>
                <option value="OVERTIME">{t("checkoutReason.OVERTIME")}</option>
              </select>
            </div>
            <button
              onClick={initiateCheckOut}
              disabled={isOwnDevice === false || checkOutState === "locating" || checkOutState === "authenticating" || checkOutState === "submitting"}
              className="shrink-0 flex items-center gap-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-60 text-white text-sm font-semibold px-5 py-2.5 rounded-xl shadow transition-colors"
            >
              {(checkOutState === "locating" || checkOutState === "authenticating" || checkOutState === "submitting") ? <span className="animate-spin">⏳</span> : <span>📍</span>}
              {checkOutState === "locating" ? tm("gettingLocation") : checkOutState === "authenticating" ? tm("scanning") : checkOutState === "submitting" ? tm("recording") : checkOutState === "error" ? tm("retryCheckOut") : tm("checkOutNow")}
            </button>
            <p className="text-[11px] text-gray-500 w-full sm:w-auto">
              {tm("statusAuto")}
            </p>
          </div>
        )}

        {/* Fully checked out */}
        {todayRecord?.checkOutTime && (
          <div className="flex items-center gap-2 text-sm font-semibold text-accent-success-deep">
            <CheckCircle2 className="size-4" aria-hidden /> {tm("checkedOut")}
          </div>
        )}
      </div>

      <div className="text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 leading-relaxed">
        {t.rich("myAttendance.howCheckIn", { strong: (c) => <strong>{c}</strong>, em: (c) => <em>{c}</em> })}
      </div>

      {/* ── Kiosk Device Registration ── */}
      <div className={`rounded-xl overflow-hidden border-2 ${
        biometrics.length > 0 ? "border-green-200" : permitStatus.allowed ? "border-indigo-300" : "border-amber-200"
      }`}>
        <button
          onClick={() => setShowRegPanel((v) => !v)}
          className={`w-full flex items-center justify-between px-5 py-3.5 transition-colors text-left ${
            biometrics.length > 0 ? "bg-green-50 hover:bg-green-100"
            : permitStatus.allowed ? "bg-indigo-50 hover:bg-indigo-100"
            : "bg-amber-50 hover:bg-amber-100"
          }`}
        >
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-base shrink-0 ${
              biometrics.length > 0 ? "bg-green-100 text-green-600"
              : permitStatus.allowed ? "bg-indigo-100 text-indigo-600"
              : "bg-amber-100 text-amber-600"
            }`}>
              {biometrics.length > 0 ? "✓" : "🔑"}
            </div>
            <div>
              <p className={`text-sm font-semibold ${
                biometrics.length > 0 ? "text-green-900" : permitStatus.allowed ? "text-indigo-900" : "text-amber-900"
              }`}>
                {biometrics.length > 0 ? tm("kioskDevice", { name: biometrics[0].deviceName || t("devices.registered") }) : tm("registerForKiosk")}
              </p>
              <p className={`text-xs mt-0.5 ${
                biometrics.length > 0 ? "text-green-700"
                : permitStatus.allowed ? "text-indigo-600"
                : "text-amber-700"
              }`}>
                {biometrics.length > 0
                  ? tm("registeredActive", { date: new Date(biometrics[0].registeredAt).toLocaleDateString(INTL_LOCALE[locale]) })
                  : permitStatus.allowed
                  ? tm("regPermittedTap")
                  : tm("notSetUp")}
              </p>
            </div>
          </div>
          <span className={`text-sm shrink-0 ml-2 ${
            biometrics.length > 0 ? "text-green-400" : permitStatus.allowed ? "text-indigo-400" : "text-amber-400"
          }`}>{showRegPanel ? "▲" : "▼"}</span>
        </button>

        {showRegPanel && (
          <div className="p-5 space-y-4 bg-white">
            <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-3 text-xs text-indigo-800 space-y-1">
              <p>{t.rich("myAttendance.howItWorks", { strong: (c) => <strong>{c}</strong> })}</p>
              <p>{t.rich("myAttendance.oneDevice", { strong: (c) => <strong>{c}</strong> })}</p>
            </div>

            {/* Registered device — shown on ALL devices including ones not registered */}
            {biometrics.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">{tm("yourDevice")}</p>
                {biometrics.map((b) => (
                  <div key={b.id} className="flex items-center justify-between border border-green-200 bg-green-50 rounded-xl px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center text-green-600 text-lg shrink-0">✓</div>
                      <div>
                        <p className="text-sm font-semibold text-gray-800">{b.deviceName || t("devices.unnamedDevice")}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{tm("registeredKioskActive", { date: new Date(b.registeredAt).toLocaleDateString(INTL_LOCALE[locale]) })}</p>
                      </div>
                    </div>
                    <button onClick={() => handleDeleteBiometric(b.id)} className="text-red-500 hover:text-red-700 text-xs shrink-0 ml-3 border border-red-200 rounded px-2 py-1">{tc("action.remove")}</button>
                  </div>
                ))}
                {!permitStatus.allowed && (
                  <p className="text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                    {tm("differentDevice")}
                  </p>
                )}
              </div>
            )}

            {/* No staff profile */}
            {permitStatus.hasStaffProfile === false && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-xs text-gray-700">
                <p className="font-semibold">{tm("notAvailable")}</p>
                <p className="mt-1">{tm("staffOnly")}</p>
              </div>
            )}

            {/* No device registered and no permit — prompt to ask HR */}
            {biometrics.length === 0 && permitStatus.hasStaffProfile !== false && !permitStatus.allowed && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-xs text-amber-800">
                <p className="font-semibold">{tm("notPermitted")}</p>
                <p className="mt-1">{t.rich("myAttendance.askHr", { strong: (c) => <strong>{c}</strong> })}</p>
              </div>
            )}

            {/* Registration form — permit granted by HR */}
            {permitStatus.allowed && (
              <div className="space-y-3 border-t border-gray-100 pt-4">
                <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                  {biometrics.length > 0 ? tm("replaceDevice") : tm("registerThis")}
                </p>

                {/* PWA-only restriction banner */}
                {inPwa === false && (
                  <div className="bg-amber-50 border border-amber-300 rounded-lg px-4 py-3 text-xs text-amber-900 space-y-2">
                    <p className="font-semibold">{tm("installTitle")}</p>
                    <p>
                      {t.rich("myAttendance.installBody", { strong: (c) => <strong>{c}</strong> })}
                    </p>
                    <div className="space-y-1 pt-1">
                      <p className="font-semibold text-amber-800">{tm("howInstall")}</p>
                      <p>{t.rich("myAttendance.installAndroid", { strong: (c) => <strong>{c}</strong>, em: (c) => <em>{c}</em> })}</p>
                      <p>{t.rich("myAttendance.installIos", { strong: (c) => <strong>{c}</strong>, em: (c) => <em>{c}</em> })}</p>
                    </div>
                    <p className="text-amber-700">{tm("onceInstalled")}</p>
                  </div>
                )}
                {biometrics.length > 0 && (
                  <div className="bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 text-xs text-amber-800">
                    {t.rich("myAttendance.willReplace", { strong: (c) => <strong>{c}</strong>, device: biometrics[0]?.deviceName || tm("currentDevice") })}
                  </div>
                )}
                <p className="text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                  {permitStatus.expiresAt
                    ? tm("hrPermittedExpires", { date: new Date(permitStatus.expiresAt).toLocaleString(INTL_LOCALE[locale]) })
                    : tm("hrPermitted")}
                </p>
                <input
                  type="text"
                  placeholder={tm("deviceNamePlaceholder")}
                  value={deviceName}
                  onChange={(e) => setDeviceName(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                />
                <button
                  onClick={handleRegisterDevice}
                  disabled={regState === "registering" || inPwa === false}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-semibold px-4 py-2.5 rounded-lg transition-colors"
                >
                  {regState === "registering" ? tm("followBrowser") : biometrics.length > 0 ? tm("replaceRegister") : tm("registerThis")}
                </button>
                {regMsg && (
                  <p className={`text-xs ${regState === "done" ? "text-green-600" : regState === "error" ? "text-red-600" : "text-blue-600"}`}>
                    {regMsg}
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Month/Year selector */}
      <div className="flex gap-3 items-center">
        <select value={month} onChange={(e) => setMonth(Number(e.target.value))} className="border rounded-lg px-3 py-2 text-sm">
          {MONTH_NUMBERS.map((m) => <option key={m} value={m}>{new Date(2000, m - 1, 1).toLocaleDateString(INTL_LOCALE[locale], { month: "short" })}</option>)}
        </select>
        <select value={year} onChange={(e) => setYear(Number(e.target.value))} className="border rounded-lg px-3 py-2 text-sm">
          {[now.getFullYear() - 1, now.getFullYear()].map((y) => <option key={y}>{y}</option>)}
        </select>
      </div>

      {/* Calendar + Donut chart panel (matches student attendance style) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        <CalendarBlock month={month} year={year} records={records} holidays={holidays} />

        <div className="flex flex-col gap-4">
          <div className="flex justify-center flex-col items-center bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            {pieData.length > 0 ? (
              <div className="relative">
                <ResponsiveContainer width={240} height={240}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={70} outerRadius={100} paddingAngle={3} dataKey="value" />
                    <Tooltip
                      formatter={(val: any, name: any) => [t("calendar.daysCount", { count: Number(val) }), name]}
                      wrapperStyle={{ zIndex: 10 }}
                      contentStyle={{ borderRadius: "8px", border: "none", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex items-center justify-center flex-col pointer-events-none">
                  <span className="text-slate-800 text-4xl font-black">{presentPct}%</span>
                  <span className="text-slate-500 text-xs mt-1 uppercase tracking-widest font-bold">{t("attendanceStatus.PRESENT")}</span>
                </div>
              </div>
            ) : (
              <div className="py-10 text-center">
                <p className="text-slate-500 text-sm">{tm("noData")}</p>
              </div>
            )}
          </div>

          <div className="grid grid-cols-3 gap-3">
            {[
              { label: t("attendanceStatus.PRESENT"), value: counts.PRESENT, color: "text-green-600", bg: "bg-green-50 border-green-100" },
              // Overlay count (isLate), not one of the five status buckets above —
              // can overlap with Present/Half Day, so it won't sum to the month total.
              { label: t("calendar.lateArrivals"), value: lateArrivalsCount, color: "text-yellow-600", bg: "bg-yellow-50 border-yellow-100" },
              { label: t("attendanceStatus.HALF_DAY"), value: counts.HALF_DAY, color: "text-purple-600", bg: "bg-purple-50 border-purple-100" },
              { label: t("calendar.leave"), value: counts.ON_LEAVE, color: "text-blue-600", bg: "bg-blue-50 border-blue-100" },
              { label: t("attendanceStatus.ABSENT"), value: counts.ABSENT, color: "text-red-600", bg: "bg-red-50 border-red-100" },
              { label: t("attendanceStatus.HOLIDAY"), value: counts.HOLIDAY, color: "text-sky-600", bg: "bg-sky-50 border-sky-100" },
            ].map((item) => (
              <div key={item.label} className={`border rounded-xl p-3 text-center shadow-sm ${item.bg}`}>
                <div className={`text-2xl font-black ${item.color} mb-1`}>{item.value}</div>
                <div className="text-slate-500 font-bold text-[10px] uppercase tracking-wider">{item.label}</div>
              </div>
            ))}
          </div>

          <div className="bg-slate-800 rounded-xl p-4 flex items-center justify-between text-white shadow-md">
            <div className="font-medium text-sm text-slate-300 uppercase tracking-wider">{t("calendar.workingMarked")}</div>
            <div className="text-2xl font-bold">{workingMarked}</div>
          </div>
        </div>
      </div>

      {/* Records list */}
      {loading ? (
        <p className="text-sm text-gray-500">{tc("state.loading")}</p>
      ) : records.length === 0 ? (
        <p className="text-sm text-gray-500">{tm("noRecords")}</p>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="sm:hidden space-y-3">
            {records.map((r) => {
              const dur = calcDuration(r.checkInTime, r.checkOutTime);
              return (
                <div key={r.date} className="bg-white border border-gray-200 rounded-xl p-4 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-gray-900 text-sm">{r.date}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_STYLES[r.status] ?? "bg-gray-100"}`}>{t(`attendanceStatus.${r.status as StaffAttendanceStatus}`)}</span>
                  </div>
                  <div className="text-xs text-gray-600 flex gap-4 flex-wrap items-center">
                    <span><span className="text-gray-400">{tm("inLabel")} </span>{formatTime(r.checkInTime)}</span>
                    <span><span className="text-gray-400">{tm("outLabel")} </span>{formatTime(r.checkOutTime)}</span>
                    {dur && <span className={DURATION_STYLES[r.status] ?? "text-gray-600"}>⏱ {dur}</span>}
                    <span className="text-gray-400">{t(`method.${r.method as AttendanceMethod}`)}</span>
                    {r.isLate && (
                      <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-100 px-1.5 py-px text-[10px] font-semibold text-amber-700">
                        <Clock3 aria-hidden className="h-2.5 w-2.5" /> {t("attendanceStatus.LATE")}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Tablet+ table */}
          <div className="hidden sm:block overflow-x-auto rounded-xl border border-gray-200">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
                <tr>
                  <th className="px-4 py-3 text-left">{tc("field.date")}</th>
                  <th className="px-4 py-3 text-left">{tc("field.status")}</th>
                  <th className="px-4 py-3 text-left">{tm("method")}</th>
                  <th className="px-4 py-3 text-left">{tm("checkIn")}</th>
                  <th className="px-4 py-3 text-left">{tm("checkOut")}</th>
                  <th className="px-4 py-3 text-left">{tm("duration")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {records.map((r) => {
                  const dur = calcDuration(r.checkInTime, r.checkOutTime);
                  return (
                    <tr key={r.date} className="hover:bg-gray-50">
                      <td className="px-4 py-3">{r.date}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_STYLES[r.status] ?? "bg-gray-100"}`}>{t(`attendanceStatus.${r.status as StaffAttendanceStatus}`)}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-500">{t(`method.${r.method as AttendanceMethod}`)}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1.5">
                          {formatTime(r.checkInTime)}
                          {r.isLate && (
                            <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-100 px-1.5 py-px text-[10px] font-semibold text-amber-700">
                              <Clock3 aria-hidden className="h-2.5 w-2.5" /> {t("attendanceStatus.LATE")}
                            </span>
                          )}
                        </span>
                      </td>
                      <td className="px-4 py-3">{formatTime(r.checkOutTime)}</td>
                      <td className={`px-4 py-3 tabular-nums ${dur ? (DURATION_STYLES[r.status] ?? "text-gray-600") : "text-gray-400"}`}>
                        {dur ?? "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Checkout preview confirmation — only shown when the client-side
          preview says this checkout would land as HALF_DAY or ABSENT. */}
      {showCheckoutConfirm && checkoutPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-walnut-950/55 p-4">
          <div className="w-full max-w-sm space-y-4 rounded-xl bg-white p-6">
            <div className="flex items-start gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-amber-100 text-amber-600">
                <TriangleAlert aria-hidden className="h-4.5 w-4.5" />
              </span>
              <div>
                <h2 className="font-semibold text-gray-900">
                  {checkoutPreview.status === "HALF_DAY" ? tm("willMarkHalf") : tm("willMarkAbsent")}
                </h2>
                <p className="mt-1 text-sm text-gray-600">
                  {t.rich("myAttendance.onlyHours", {
                    hours: (c) => <strong className="tabular-nums">{c}</strong>,
                    strong: (c) => <strong>{c}</strong>,
                    value: checkoutPreview.hours.toFixed(1),
                    count: checkoutPreview.hours,
                    status: checkoutPreview.status === "HALF_DAY" ? t("attendanceStatus.HALF_DAY") : t("attendanceStatus.ABSENT"),
                  })}
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowCheckoutConfirm(false)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                {tc("action.cancel")}
              </button>
              <button
                onClick={confirmCheckOut}
                className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700"
              >
                {tm("checkOutAnyway")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Calendar block ─────────────────────────────────────────────────────────
function CalendarBlock({ month, year, records, holidays }: { month: number; year: number; records: StaffAttendanceRecord[]; holidays: HolidayInfo[] }) {
  const t = useTranslations("hr");
  const locale = useLocale() as Locale;
  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDayOfMonth = new Date(year, month - 1, 1).getDay();
  const recordByDate = new Map(records.map((r) => [r.date, r]));

  const cells = Array.from({ length: 42 }, (_, i) => {
    const day = i - firstDayOfMonth + 1;
    if (day < 1 || day > daysInMonth) return { day: null as number | null, status: null as string | null, date: null as string | null, label: "", record: undefined as StaffAttendanceRecord | undefined };
    const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const rec = recordByDate.get(dateStr);
    if (rec) {
      const late = (rec as AttendanceRow).isLate === true || rec.status === "LATE";
      return { day, status: rec.status, date: dateStr, label: t(late ? "myAttendance.cellLate" : "myAttendance.cell", { date: dateStr, status: t(`attendanceStatus.${rec.status as StaffAttendanceStatus}`) }), record: rec };
    }
    const isSunday = new Date(year, month - 1, day).getDay() === 0;
    if (isSunday) return { day, status: "SUNDAY", date: dateStr, label: t("myAttendance.cellSunday", { date: dateStr }), record: undefined };
    const hol = findHolidayFor(dateStr, holidays);
    if (hol) return { day, status: "HOLIDAY", date: dateStr, label: `${dateStr}: ${hol.description}`, record: undefined };
    return { day, status: null, date: dateStr, label: dateStr, record: undefined };
  });

  // Staff records say ON_LEAVE where student records say LEAVE; normalising it
  // here lets this calendar share the app's one attendance colour table.
  const colorFor = (status: string | null) =>
    attendanceCellClass(status === "ON_LEAVE" ? "LEAVE" : status);

  const STATUS_HEX: Record<string, string> = {
    PRESENT: ATTENDANCE_TONE.PRESENT.fill,
    LATE: ATTENDANCE_TONE.LATE.fill,
    HALF_DAY: ATTENDANCE_TONE.HALF_DAY.fill,
  };

  /**
   * `isLate` is an overlay fact independent of `status` — a PRESENT or HALF_DAY day can
   * also be late. Split the cell diagonally (base color + late yellow) so both show at
   * once instead of the late flag being silently swallowed by the status color.
   */
  const cellStyleFor = (status: string | null, rec: StaffAttendanceRecord | undefined) => {
    const late = !!rec && ((rec as AttendanceRow).isLate === true || rec.status === "LATE");
    if (late && (status === "PRESENT" || status === "HALF_DAY")) {
      return {
        className: "text-white border-slate-300 shadow-sm",
        style: { background: `linear-gradient(135deg, ${STATUS_HEX[status]} 50%, ${STATUS_HEX.LATE} 50%)` } as { background: string } | undefined,
      };
    }
    return { className: colorFor(status), style: undefined as { background: string } | undefined };
  };

  return (
    <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200">
      <h4 className="text-slate-800 font-bold text-center mb-4">{new Date(year, month - 1, 1).toLocaleDateString(INTL_LOCALE[locale], { month: "long", year: "numeric" })}</h4>
      <div className="grid grid-cols-7 gap-1 text-center mb-2">
        {WEEKDAYS.map((d) => (
          <div key={d} className="text-slate-500 text-[10px] font-bold py-1 uppercase">{t(`weekdays.${d}`)}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {cells.map((c, i) => {
          const { className, style } = c.day ? cellStyleFor(c.status, c.record) : { className: "bg-transparent border-transparent", style: undefined };
          return (
            <div
              key={i}
              title={c.day ? c.label : ""}
              style={style}
              className={`aspect-square flex items-center justify-center rounded-lg text-xs font-bold border ${className}`}
            >
              {c.day ?? ""}
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap justify-center gap-2 mt-4 text-[10px] font-medium text-slate-600">
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-green-500" /> {t("attendanceStatus.PRESENT")}</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-yellow-400" /> {t("attendanceStatus.LATE")}</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-purple-500" /> {t("calendar.half")}</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-blue-500" /> {t("calendar.leave")}</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-red-500" /> {t("attendanceStatus.ABSENT")}</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-sky-500" /> {t("attendanceStatus.HOLIDAY")}</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-orange-100 border border-orange-200" /> {t("myAttendance.sunday")}</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full" style={{ background: `linear-gradient(135deg, ${ATTENDANCE_TONE.PRESENT.fill} 50%, ${ATTENDANCE_TONE.LATE.fill} 50%)` }} /> {t("calendar.presentLate")}</span>
      </div>
    </div>
  );
}
