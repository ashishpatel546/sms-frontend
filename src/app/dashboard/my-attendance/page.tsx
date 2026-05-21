"use client";

import { useState, useEffect } from "react";
import { hrApi, StaffAttendanceRecord, StaffBiometric, WebauthnPermitStatus, CheckOutReason, TodayAttendanceStatus } from "@/lib/hr-api";
import toast, { Toaster } from "react-hot-toast";
import { startRegistration, startAuthentication } from "@simplewebauthn/browser";
import { PieChart, Pie, ResponsiveContainer, Tooltip } from "recharts";
import { API_BASE_URL } from "@/lib/api";
import { authFetch } from "@/lib/auth";
import dayjs from "dayjs";
import duration from "dayjs/plugin/duration";
dayjs.extend(duration);

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
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
  const base = "1970-01-01T";
  const inMs = dayjs(base + checkIn).valueOf();
  const outMs = dayjs(base + checkOut).valueOf();
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
const todayStr = now.toISOString().slice(0, 10);

type CheckInState = "idle" | "locating" | "authenticating" | "submitting" | "done" | "error";

export default function MyAttendancePage() {
  const [records, setRecords] = useState<StaffAttendanceRecord[]>([]);
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [loading, setLoading] = useState(false);
  const [holidays, setHolidays] = useState<HolidayInfo[]>([]);

  // Today's check-in state
  const [checkInState, setCheckInState] = useState<CheckInState>("idle");
  const [checkInMsg, setCheckInMsg] = useState("");
  const [todayRecord, setTodayRecord] = useState<StaffAttendanceRecord | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<"PRESENT" | "LATE" | "HALF_DAY">("PRESENT");

  // Checkout state
  const [checkOutState, setCheckOutState] = useState<CheckInState>("idle");
  const [checkOutMsg, setCheckOutMsg] = useState("");
  const [checkOutReason, setCheckOutReason] = useState<CheckOutReason>("REGULAR");
  const [checkOutStatusOverride, setCheckOutStatusOverride] = useState<"PRESENT" | "LATE" | "HALF_DAY">("PRESENT");
  const [refreshKey, setRefreshKey] = useState(0);

  // Pending prior-day checkout
  const [pendingCheckOut, setPendingCheckOut] = useState<TodayAttendanceStatus["pendingCheckOut"]>(null);
  const [resolvingPending, setResolvingPending] = useState(false);

  // Biometric registration state
  const [biometrics, setBiometrics] = useState<StaffBiometric[]>([]);
  const [biometricsLoading, setBiometricsLoading] = useState(true);
  const [permitStatus, setPermitStatus] = useState<WebauthnPermitStatus>({ allowed: false });
  const [regState, setRegState] = useState<"idle" | "registering" | "done" | "error">("idle");
  const [regMsg, setRegMsg] = useState("");
  const [deviceName, setDeviceName] = useState("");
  const [showRegPanel, setShowRegPanel] = useState(false);

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

  // Sync checkOutStatusOverride whenever todayRecord changes
  useEffect(() => {
    if (todayRecord?.status && ["PRESENT", "LATE", "HALF_DAY"].includes(todayRecord.status)) {
      setCheckOutStatusOverride(todayRecord.status as "PRESENT" | "LATE" | "HALF_DAY");
    }
  }, [todayRecord]);

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
          toast.error("Failed to load attendance");
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
    setRegMsg("Follow the prompt to scan your fingerprint or face…");
    try {
      const options = await hrApi.attendance.webauthn.selfGetRegOptions();
      const regResponse = await startRegistration({ optionsJSON: options });
      await hrApi.attendance.webauthn.selfVerifyReg(regResponse, deviceName || undefined);
      setRegState("done");
      setRegMsg("Device registered successfully! You can now use the kiosk.");
      toast.success("Device registered for kiosk attendance");
      refreshBiometrics();
    } catch (e: any) {
      const msg = e?.info?.message ?? e?.message ?? "Registration failed";
      setRegState("error");
      setRegMsg(msg);
    }
  };

  const handleDeleteBiometric = async (id: number) => {
    if (!confirm("Remove this device?")) return;
    try {
      await hrApi.attendance.webauthn.deleteMyCredential(id);
      toast.success("Device removed");
      refreshBiometrics();
    } catch { toast.error("Failed to remove device"); }
  };

  const handleCheckIn = async () => {
    if (!navigator.geolocation) { toast.error("Your browser does not support GPS location"); return; }

    setCheckInState("locating");
    setCheckInMsg("Getting your location and preparing device check…");

    // Fetch GPS and auth challenge in parallel — both are needed before we can
    // show the biometric prompt; doing them in parallel saves ~1-2 seconds.
    let position: GeolocationPosition;
    let challengeOpts: any;
    try {
      [position, challengeOpts] = await Promise.all([
        new Promise<GeolocationPosition>((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 15000,
          })
        ),
        hrApi.attendance.webauthn.selfGetAuthChallenge(),
      ]);
    } catch (e: any) {
      setCheckInState("error");
      if (e?.code === 1) setCheckInMsg("Location permission denied. Please allow location access and try again.");
      else if (e?.code === 2) setCheckInMsg("Location unavailable. Please check your GPS.");
      else {
        const msg = e?.info?.message ?? e?.message ?? "Preparation failed. Please try again.";
        setCheckInMsg(msg);
      }
      return;
    }

    // Biometric prompt — proves this browser holds the enrolled private key
    setCheckInState("authenticating");
    setCheckInMsg("Confirm your identity with fingerprint or face…");
    let assertion: any;
    try {
      assertion = await startAuthentication({ optionsJSON: challengeOpts });
    } catch (e: any) {
      setCheckInState("error");
      setCheckInMsg("Biometric verification failed. Please use your registered device.");
      return;
    }

    // Submit with GPS + WebAuthn assertion together
    setCheckInState("submitting");
    setCheckInMsg("Verifying location and marking attendance…");
    try {
      const localTime = new Date().toTimeString().slice(0, 8);
      const record = await hrApi.attendance.selfCheckIn({
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        clientTimestamp: new Date().toISOString(),
        checkInTime: localTime,
        status: selectedStatus,
        webauthnAssertion: assertion,
      });
      setTodayRecord(record as any);
      setCheckInState("done");
      setCheckInMsg(`Checked in as ${(record as any).status} at ${(record as any).checkInTime ?? localTime}`);
      setRefreshKey((k) => k + 1);
    } catch (e: any) {
      const info = e?.info;
      if (info?.code === "PENDING_CHECKOUT") {
        setPendingCheckOut({ date: info.pendingDate, checkInTime: "—", daysAgo: 1 });
      }
      const msg = info?.message ?? "Check-in failed. You may be outside the school zone.";
      setCheckInState("error");
      setCheckInMsg(msg);
    }
  };

  const handleCheckOut = async () => {
    if (!navigator.geolocation) { toast.error("Your browser does not support GPS location"); return; }

    setCheckOutState("locating");
    setCheckOutMsg("Getting your location and preparing device check…");

    let position: GeolocationPosition;
    let challengeOpts: any;
    try {
      [position, challengeOpts] = await Promise.all([
        new Promise<GeolocationPosition>((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 15000,
          })
        ),
        hrApi.attendance.webauthn.selfGetAuthChallenge(),
      ]);
    } catch (e: any) {
      setCheckOutState("error");
      if (e?.code === 1) setCheckOutMsg("Location permission denied. Please allow location access and try again.");
      else {
        const msg = e?.info?.message ?? e?.message ?? "Preparation failed. Please try again.";
        setCheckOutMsg(msg);
      }
      return;
    }

    setCheckOutState("authenticating");
    setCheckOutMsg("Confirm your identity with fingerprint or face…");
    let assertion: any;
    try {
      assertion = await startAuthentication({ optionsJSON: challengeOpts });
    } catch {
      setCheckOutState("error");
      setCheckOutMsg("Biometric verification failed. Please use your registered device.");
      return;
    }

    setCheckOutState("submitting");
    setCheckOutMsg("Recording check-out…");
    try {
      const localTime = new Date().toTimeString().slice(0, 8);
      const record = await hrApi.attendance.selfCheckOut({
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        clientTimestamp: new Date().toISOString(),
        checkOutTime: localTime,
        reason: checkOutReason,
        statusOverride: checkOutStatusOverride,
        webauthnAssertion: assertion,
      });
      setTodayRecord(record as any);
      setCheckOutState("done");
      setCheckOutMsg(`Checked out at ${(record as any).checkOutTime ?? localTime}`);
      setRefreshKey((k) => k + 1);
    } catch (e: any) {
      const msg = e?.info?.message ?? "Check-out failed.";
      setCheckOutState("error");
      setCheckOutMsg(msg);
    }
  };

  const handleResolvePending = async () => {
    if (!pendingCheckOut) return;
    setResolvingPending(true);
    try {
      await hrApi.attendance.resolvePending({ pendingDate: pendingCheckOut.date });
      setPendingCheckOut(null);
      toast.success(`Checkout resolved for ${pendingCheckOut.date} (marked as end-of-day 17:00)`);
    } catch (e: any) {
      toast.error(e?.info?.message ?? "Failed to resolve pending checkout");
    } finally {
      setResolvingPending(false);
    }
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

  const counts = {
    PRESENT: records.filter((r) => r.status === "PRESENT").length,
    LATE: records.filter((r) => r.status === "LATE").length,
    HALF_DAY: records.filter((r) => r.status === "HALF_DAY").length,
    ON_LEAVE: records.filter((r) => r.status === "ON_LEAVE").length,
    ABSENT: records.filter((r) => r.status === "ABSENT").length,
    HOLIDAY: records.filter((r) => r.status === "HOLIDAY").length + holidayCount,
  };
  const presentish = counts.PRESENT + counts.LATE + counts.HALF_DAY;
  const workingMarked = counts.PRESENT + counts.LATE + counts.HALF_DAY + counts.ON_LEAVE + counts.ABSENT;
  const presentPct = workingMarked > 0 ? Math.round((presentish / workingMarked) * 100) : 0;

  const pieData = [
    { name: "Present", value: counts.PRESENT, fill: "#22c55e" },
    { name: "Late", value: counts.LATE, fill: "#facc15" },
    { name: "Half Day", value: counts.HALF_DAY, fill: "#a855f7" },
    { name: "Leave", value: counts.ON_LEAVE, fill: "#3b82f6" },
    { name: "Absent", value: counts.ABSENT, fill: "#ef4444" },
    { name: "Holiday", value: counts.HOLIDAY, fill: "#0ea5e9" },
  ].filter((d) => d.value > 0);

  return (
    <div className="p-3 sm:p-6 space-y-4">
      <Toaster />
      <h1 className="text-xl font-bold text-gray-900">My Attendance</h1>

      {/* ── Pending checkout banner — blocks new check-in ── */}
      {pendingCheckOut && (
        <div className="rounded-xl border-2 border-red-300 bg-red-50 p-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex-1">
            <p className="text-sm font-bold text-red-800">⚠️ Unclosed Check-In from {pendingCheckOut.date}</p>
            <p className="text-xs text-red-600 mt-0.5">
              You checked in at {pendingCheckOut.checkInTime} but never checked out.
              Please resolve this before checking in today.
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <button
              onClick={handleResolvePending}
              disabled={resolvingPending}
              className="flex items-center gap-1.5 bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white text-sm font-semibold px-4 py-2 rounded-lg shadow transition-colors"
            >
              {resolvingPending ? <span className="animate-spin">⏳</span> : <span>🔒</span>}
              {resolvingPending ? "Resolving…" : "Mark Checkout (End of Day)"}
            </button>
            <span className="text-xs text-red-700 bg-red-100 border border-red-200 rounded-lg px-3 py-2">
              Or contact HR to resolve manually.
            </span>
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
            <p className="text-sm font-semibold text-gray-800 mb-0.5">Today — {new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}</p>
            {todayRecord ? (
              <div className="flex items-center gap-2 mt-1">
                <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${STATUS_STYLES[todayRecord.status] ?? "bg-gray-100"}`}>{todayRecord.status}</span>
                <span className="text-xs text-gray-500">via {todayRecord.method}</span>
                {todayRecord.checkInTime && <span className="text-xs text-gray-500">· in {todayRecord.checkInTime}</span>}
                {todayRecord.checkOutTime && <span className="text-xs text-gray-500">out {todayRecord.checkOutTime}</span>}
              </div>
            ) : (
              <p className="text-xs text-gray-500 mt-1">
                {checkInState === "idle" ? "You have not checked in yet." : checkInMsg}
              </p>
            )}
            {checkInState === "error" && <p className="text-xs text-red-600 mt-1">{checkInMsg}</p>}
            {(checkInState === "locating" || checkInState === "authenticating" || checkInState === "submitting") && <p className="text-xs text-blue-600 mt-1">{checkInMsg}</p>}
            {checkOutState === "error" && <p className="text-xs text-red-600 mt-1">{checkOutMsg}</p>}
            {(checkOutState === "locating" || checkOutState === "authenticating" || checkOutState === "submitting") && <p className="text-xs text-amber-600 mt-1">{checkOutMsg}</p>}
          </div>
        </div>

        {/* Check-In row — shown when device registered, not yet checked in, no pending block */}
        {!biometricsLoading && biometrics.length > 0 && !todayRecord && !pendingCheckOut && (
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-gray-600">Status:</label>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value as typeof selectedStatus)}
                className="text-sm border border-gray-300 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-blue-400"
              >
                <option value="PRESENT">Present</option>
                <option value="LATE">Late</option>
                <option value="HALF_DAY">Half Day</option>
              </select>
            </div>
            <button
              onClick={handleCheckIn}
              disabled={checkInState === "locating" || checkInState === "authenticating" || checkInState === "submitting"}
              className="shrink-0 flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-semibold px-5 py-2.5 rounded-xl shadow transition-colors"
            >
              {(checkInState === "locating" || checkInState === "authenticating" || checkInState === "submitting") ? <span className="animate-spin">⏳</span> : <span>📍</span>}
              {checkInState === "locating" ? "Getting Location…" : checkInState === "authenticating" ? "Scanning…" : checkInState === "submitting" ? "Marking…" : checkInState === "error" ? "Retry Check-In" : "Check In Now"}
            </button>
          </div>
        )}

        {/* Not-registered notice — shown while loading is done but no device is enrolled */}
        {!biometricsLoading && biometrics.length === 0 && !todayRecord && !pendingCheckOut && (
          <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            📱 This device is not registered for your account. Register your device below to enable self check-in.
          </p>
        )}

        {/* Check-Out row — shown when device registered, checked in but not yet checked out */}
        {!biometricsLoading && biometrics.length > 0 && todayRecord && !["ON_LEAVE", "HOLIDAY"].includes(todayRecord.status) && !todayRecord.checkOutTime && (
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-gray-600">Status:</label>
              <select
                value={checkOutStatusOverride}
                onChange={(e) => {
                  const val = e.target.value as "PRESENT" | "LATE" | "HALF_DAY";
                  setCheckOutStatusOverride(val);
                  if (val === "HALF_DAY") setCheckOutReason("HALF_DAY");
                }}
                className="text-sm border border-gray-300 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
              >
                <option value="PRESENT">Present</option>
                <option value="LATE">Late</option>
                <option value="HALF_DAY">Half Day</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-gray-600">Reason:</label>
              <select
                value={checkOutReason}
                onChange={(e) => setCheckOutReason(e.target.value as CheckOutReason)}
                className="text-sm border border-gray-300 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
              >
                <option value="REGULAR">Regular checkout</option>
                <option value="HALF_DAY">Half day</option>
                <option value="EARLY_LEAVE">Early leave</option>
                <option value="OVERTIME">Overtime</option>
              </select>
            </div>
            <button
              onClick={handleCheckOut}
              disabled={checkOutState === "locating" || checkOutState === "authenticating" || checkOutState === "submitting"}
              className="shrink-0 flex items-center gap-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-60 text-white text-sm font-semibold px-5 py-2.5 rounded-xl shadow transition-colors"
            >
              {(checkOutState === "locating" || checkOutState === "authenticating" || checkOutState === "submitting") ? <span className="animate-spin">⏳</span> : <span>📍</span>}
              {checkOutState === "locating" ? "Getting Location…" : checkOutState === "authenticating" ? "Scanning…" : checkOutState === "submitting" ? "Recording…" : checkOutState === "error" ? "Retry Check-Out" : "Check Out Now"}
            </button>
          </div>
        )}

        {/* Fully checked out */}
        {todayRecord?.checkOutTime && (
          <div className="flex items-center gap-2 text-green-700 font-semibold text-sm">
            <span>✅</span> Checked out
          </div>
        )}
      </div>

      <div className="text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 leading-relaxed">
        <strong>How check-in works:</strong> Click <em>Check In Now</em> and allow location access. The system verifies you are within the school's geo-fence zone and records your attendance. If your school has opened a bypass window, location check is skipped. You can also check in at the <strong>biometric kiosk</strong> — register your device below first.
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
                {biometrics.length > 0 ? `Kiosk Device: ${biometrics[0].deviceName || "Registered"}` : "Register Device for Kiosk"}
              </p>
              <p className={`text-xs mt-0.5 ${
                biometrics.length > 0 ? "text-green-700"
                : permitStatus.allowed ? "text-indigo-600"
                : "text-amber-700"
              }`}>
                {biometrics.length > 0
                  ? `Registered ${new Date(biometrics[0].registeredAt).toLocaleDateString()} · Active for kiosk check-in`
                  : permitStatus.allowed
                  ? "Registration permitted — tap to set up this device"
                  : "Not set up — ask HR to grant registration permission"}
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
              <p><strong>How it works:</strong> Your biometric (fingerprint or face) is stored only on this device&apos;s secure chip — it never leaves. At the kiosk, enter your employee code and the device prompts your biometric to record attendance instantly.</p>
              <p><strong>One device per person:</strong> Registering a new device automatically replaces any previous one, so only your current device works at the kiosk. This prevents shared-device abuse.</p>
            </div>

            {/* Registered device — shown on ALL devices including ones not registered */}
            {biometrics.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Your Registered Device</p>
                {biometrics.map((b) => (
                  <div key={b.id} className="flex items-center justify-between border border-green-200 bg-green-50 rounded-xl px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-green-100 flex items-center justify-center text-green-600 text-lg shrink-0">✓</div>
                      <div>
                        <p className="text-sm font-semibold text-gray-800">{b.deviceName || "Unnamed Device"}</p>
                        <p className="text-xs text-gray-500 mt-0.5">Registered {new Date(b.registeredAt).toLocaleDateString()} · Kiosk check-in active</p>
                      </div>
                    </div>
                    <button onClick={() => handleDeleteBiometric(b.id)} className="text-red-500 hover:text-red-700 text-xs shrink-0 ml-3 border border-red-200 rounded px-2 py-1">Remove</button>
                  </div>
                ))}
                {!permitStatus.allowed && (
                  <p className="text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                    On a different device? Ask HR to grant a new registration permit — it will replace the entry above and make this device the active one.
                  </p>
                )}
              </div>
            )}

            {/* No staff profile */}
            {permitStatus.hasStaffProfile === false && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-xs text-gray-700">
                <p className="font-semibold">Not available for this account</p>
                <p className="mt-1">Biometric kiosk registration is for staff accounts only. Contact your administrator if this is incorrect.</p>
              </div>
            )}

            {/* No device registered and no permit — prompt to ask HR */}
            {biometrics.length === 0 && permitStatus.hasStaffProfile !== false && !permitStatus.allowed && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-xs text-amber-800">
                <p className="font-semibold">Registration not yet permitted</p>
                <p className="mt-1">Ask your HR admin to grant device registration permission. They can do this from <strong>HR → Staff Attendance → Biometrics</strong>.</p>
              </div>
            )}

            {/* Registration form — permit granted by HR */}
            {permitStatus.allowed && (
              <div className="space-y-3 border-t border-gray-100 pt-4">
                <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                  {biometrics.length > 0 ? "Replace Device" : "Register This Device"}
                </p>
                {biometrics.length > 0 && (
                  <div className="bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 text-xs text-amber-800">
                    ⚠ Registering will replace <strong>{biometrics[0]?.deviceName || "your current device"}</strong>. The old device will no longer work at the kiosk.
                  </div>
                )}
                <p className="text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
                  ✓ HR has permitted device registration
                  {permitStatus.expiresAt && ` — expires ${new Date(permitStatus.expiresAt).toLocaleString()}`}.
                </p>
                <input
                  type="text"
                  placeholder="Device name (e.g. My iPhone, Office Laptop)"
                  value={deviceName}
                  onChange={(e) => setDeviceName(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                />
                <button
                  onClick={handleRegisterDevice}
                  disabled={regState === "registering"}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-semibold px-4 py-2.5 rounded-lg transition-colors"
                >
                  {regState === "registering" ? "Follow browser prompt…" : biometrics.length > 0 ? "Replace & Register This Device" : "Register This Device"}
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
          {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
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
                      formatter={(val: any, name: any) => [`${val} days`, name]}
                      contentStyle={{ borderRadius: "8px", border: "none", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex items-center justify-center flex-col pointer-events-none">
                  <span className="text-slate-800 text-4xl font-black">{presentPct}%</span>
                  <span className="text-slate-500 text-xs mt-1 uppercase tracking-widest font-bold">Present</span>
                </div>
              </div>
            ) : (
              <div className="py-10 text-center">
                <p className="text-slate-500 text-sm">No attendance data for this month yet.</p>
              </div>
            )}
          </div>

          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Present", value: counts.PRESENT, color: "text-green-600", bg: "bg-green-50 border-green-100" },
              { label: "Late", value: counts.LATE, color: "text-yellow-600", bg: "bg-yellow-50 border-yellow-100" },
              { label: "Half Day", value: counts.HALF_DAY, color: "text-purple-600", bg: "bg-purple-50 border-purple-100" },
              { label: "Leave", value: counts.ON_LEAVE, color: "text-blue-600", bg: "bg-blue-50 border-blue-100" },
              { label: "Absent", value: counts.ABSENT, color: "text-red-600", bg: "bg-red-50 border-red-100" },
              { label: "Holiday", value: counts.HOLIDAY, color: "text-sky-600", bg: "bg-sky-50 border-sky-100" },
            ].map((item) => (
              <div key={item.label} className={`border rounded-xl p-3 text-center shadow-sm ${item.bg}`}>
                <div className={`text-2xl font-black ${item.color} mb-1`}>{item.value}</div>
                <div className="text-slate-500 font-bold text-[10px] uppercase tracking-wider">{item.label}</div>
              </div>
            ))}
          </div>

          <div className="bg-slate-800 rounded-xl p-4 flex items-center justify-between text-white shadow-md">
            <div className="font-medium text-sm text-slate-300 uppercase tracking-wider">Working Days Marked</div>
            <div className="text-2xl font-bold">{workingMarked}</div>
          </div>
        </div>
      </div>

      {/* Records list */}
      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : records.length === 0 ? (
        <p className="text-sm text-gray-500">No attendance records for this period.</p>
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
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_STYLES[r.status] ?? "bg-gray-100"}`}>{r.status}</span>
                  </div>
                  <div className="text-xs text-gray-600 flex gap-4 flex-wrap">
                    <span><span className="text-gray-400">In: </span>{r.checkInTime ?? "—"}</span>
                    <span><span className="text-gray-400">Out: </span>{r.checkOutTime ?? "—"}</span>
                    {dur && <span className={DURATION_STYLES[r.status] ?? "text-gray-600"}>⏱ {dur}</span>}
                    <span className="text-gray-400">{r.method}</span>
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
                  <th className="px-4 py-3 text-left">Date</th>
                  <th className="px-4 py-3 text-left">Status</th>
                  <th className="px-4 py-3 text-left">Method</th>
                  <th className="px-4 py-3 text-left">Check-In</th>
                  <th className="px-4 py-3 text-left">Check-Out</th>
                  <th className="px-4 py-3 text-left">Duration</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {records.map((r) => {
                  const dur = calcDuration(r.checkInTime, r.checkOutTime);
                  return (
                    <tr key={r.date} className="hover:bg-gray-50">
                      <td className="px-4 py-3">{r.date}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_STYLES[r.status] ?? "bg-gray-100"}`}>{r.status}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-500">{r.method}</td>
                      <td className="px-4 py-3">{r.checkInTime ?? "—"}</td>
                      <td className="px-4 py-3">{r.checkOutTime ?? "—"}</td>
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
    </div>
  );
}

// ── Calendar block ─────────────────────────────────────────────────────────
function CalendarBlock({ month, year, records, holidays }: { month: number; year: number; records: StaffAttendanceRecord[]; holidays: HolidayInfo[] }) {
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDayOfMonth = new Date(year, month - 1, 1).getDay();
  const recordByDate = new Map(records.map((r) => [r.date, r]));

  const cells = Array.from({ length: 42 }, (_, i) => {
    const day = i - firstDayOfMonth + 1;
    if (day < 1 || day > daysInMonth) return { day: null as number | null, status: null as string | null, date: null as string | null, label: "" };
    const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const rec = recordByDate.get(dateStr);
    if (rec) return { day, status: rec.status, date: dateStr, label: `${dateStr}: ${rec.status}` };
    const isSunday = new Date(year, month - 1, day).getDay() === 0;
    if (isSunday) return { day, status: "SUNDAY", date: dateStr, label: `${dateStr}: Sunday (Weekly Off)` };
    const hol = findHolidayFor(dateStr, holidays);
    if (hol) return { day, status: "HOLIDAY", date: dateStr, label: `${dateStr}: ${hol.description}` };
    return { day, status: null, date: dateStr, label: dateStr };
  });

  const colorFor = (status: string | null) => {
    switch (status) {
      case "PRESENT": return "bg-green-500 border-green-600 text-white shadow-sm shadow-green-500/20";
      case "LATE": return "bg-yellow-400 border-yellow-500 text-white shadow-sm shadow-yellow-400/20";
      case "HALF_DAY": return "bg-purple-500 border-purple-600 text-white shadow-sm shadow-purple-500/20";
      case "ON_LEAVE": return "bg-blue-500 border-blue-600 text-white shadow-sm shadow-blue-500/20";
      case "ABSENT": return "bg-red-500 border-red-600 text-white shadow-sm shadow-red-500/20";
      case "HOLIDAY": return "bg-sky-500 border-sky-600 text-white shadow-sm shadow-sky-500/20";
      case "SUNDAY": return "bg-orange-50 text-orange-400 border-orange-200";
      default: return "bg-slate-50 border-slate-200 text-slate-500";
    }
  };

  return (
    <div className="bg-slate-50 rounded-2xl p-5 border border-slate-200">
      <h4 className="text-slate-800 font-bold text-center mb-4">{monthNames[month - 1]} {year}</h4>
      <div className="grid grid-cols-7 gap-1 text-center mb-2">
        {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
          <div key={d} className="text-slate-500 text-[10px] font-bold py-1 uppercase">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {cells.map((c, i) => (
          <div
            key={i}
            title={c.day ? c.label : ""}
            className={`aspect-square flex items-center justify-center rounded-lg text-xs font-bold border ${c.day ? colorFor(c.status) : "bg-transparent border-transparent"}`}
          >
            {c.day ?? ""}
          </div>
        ))}
      </div>
      <div className="flex flex-wrap justify-center gap-2 mt-4 text-[10px] font-medium text-slate-600">
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-green-500" /> Present</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-yellow-400" /> Late</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-purple-500" /> Half</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-blue-500" /> Leave</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-red-500" /> Absent</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-sky-500" /> Holiday</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-orange-100 border border-orange-200" /> Sunday</span>
      </div>
    </div>
  );
}
