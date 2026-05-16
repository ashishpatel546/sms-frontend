"use client";

import { useState, useEffect } from "react";
import { hrApi, StaffAttendanceRecord, StaffBiometric, WebauthnPermitStatus } from "@/lib/hr-api";
import toast, { Toaster } from "react-hot-toast";
import { startRegistration } from "@simplewebauthn/browser";

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const STATUS_STYLES: Record<string, string> = {
  PRESENT: "bg-green-100 text-green-700 border-green-200",
  LATE: "bg-amber-100 text-amber-700 border-amber-200",
  ABSENT: "bg-red-100 text-red-700 border-red-200",
  HALF_DAY: "bg-blue-100 text-blue-700 border-blue-200",
  ON_LEAVE: "bg-purple-100 text-purple-700 border-purple-200",
  HOLIDAY: "bg-gray-100 text-gray-500 border-gray-200",
};
const now = new Date();
const todayStr = now.toISOString().slice(0, 10);

type CheckInState = "idle" | "locating" | "submitting" | "done" | "error";

export default function MyAttendancePage() {
  const [records, setRecords] = useState<StaffAttendanceRecord[]>([]);
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [loading, setLoading] = useState(false);

  // Today's check-in state
  const [checkInState, setCheckInState] = useState<CheckInState>("idle");
  const [checkInMsg, setCheckInMsg] = useState("");
  const [todayRecord, setTodayRecord] = useState<StaffAttendanceRecord | null>(null);

  // Biometric registration state
  const [biometrics, setBiometrics] = useState<StaffBiometric[]>([]);
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

  useEffect(() => {
    let cancelled = false;
    const doLoad = async () => {
      setLoading(true);
      try {
        const recs = await hrApi.attendance.myMonthly(month, year);
        if (cancelled) return;
        setRecords(recs);
        if (month === now.getMonth() + 1 && year === now.getFullYear()) {
          setTodayRecord(recs.find((r) => r.date === todayStr) ?? null);
        }
      } catch (e: any) {
        if (cancelled) return;
        // 404 = route not ready or no staff record → treat as empty, not an error
        // 403 = no access → treat as empty silently
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
  }, [month, year]);

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
    };
    doLoad();
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

  const handleCheckIn = () => {
    if (!navigator.geolocation) { toast.error("Your browser does not support GPS location"); return; }

    setCheckInState("locating");
    setCheckInMsg("Getting your location…");

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        setCheckInState("submitting");
        setCheckInMsg("Verifying location and marking attendance…");
        try {
          const record = await hrApi.attendance.selfCheckIn({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            clientTimestamp: new Date().toISOString(),
          });
          setTodayRecord(record as any);
          setCheckInState("done");
          setCheckInMsg(`Marked as ${(record as any).status} at ${new Date().toLocaleTimeString()}`);
          // Refresh month view after successful check-in (state change triggers useEffect)
          setMonth(now.getMonth() + 1); setYear(now.getFullYear());
        } catch (e: any) {
          const msg = e?.info?.message ?? "Check-in failed. You may be outside the school zone.";
          setCheckInState("error");
          setCheckInMsg(msg);
        }
      },
      (err) => {
        setCheckInState("error");
        if (err.code === 1) setCheckInMsg("Location permission denied. Please allow location access and try again.");
        else if (err.code === 2) setCheckInMsg("Location unavailable. Please check your GPS.");
        else setCheckInMsg("Could not get location. Please try again.");
      },
      { enableHighAccuracy: true, timeout: 15000 },
    );
  };

  const counts = {
    PRESENT: records.filter((r) => r.status === "PRESENT").length,
    LATE: records.filter((r) => r.status === "LATE").length,
    ABSENT: records.filter((r) => r.status === "ABSENT").length,
    ON_LEAVE: records.filter((r) => r.status === "ON_LEAVE").length,
  };

  return (
    <div className="p-6 space-y-4">
      <Toaster />
      <h1 className="text-xl font-bold text-gray-900">My Attendance</h1>

      {/* ── Today's Check-In Card ── */}
      <div className={`rounded-xl border-2 p-5 flex flex-col sm:flex-row sm:items-center gap-4 transition-colors ${
        checkInState === "done" || todayRecord ? "border-green-300 bg-green-50"
        : checkInState === "error" ? "border-red-300 bg-red-50"
        : "border-blue-200 bg-blue-50"
      }`}>
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
          {checkInState === "error" && (
            <p className="text-xs text-red-600 mt-1">{checkInMsg}</p>
          )}
          {(checkInState === "locating" || checkInState === "submitting") && (
            <p className="text-xs text-blue-600 mt-1">{checkInMsg}</p>
          )}
        </div>

        {!todayRecord && (
          <button
            onClick={handleCheckIn}
            disabled={checkInState === "locating" || checkInState === "submitting"}
            className="shrink-0 flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-semibold px-5 py-2.5 rounded-xl shadow transition-colors"
          >
            {(checkInState === "locating" || checkInState === "submitting") ? (
              <span className="animate-spin">⏳</span>
            ) : (
              <span>📍</span>
            )}
            {checkInState === "locating" ? "Getting Location…"
            : checkInState === "submitting" ? "Marking…"
            : checkInState === "error" ? "Retry Check-In"
            : "Check In Now"}
          </button>
        )}
        {todayRecord && todayRecord.status !== "ON_LEAVE" && todayRecord.status !== "HOLIDAY" && (
          <div className="shrink-0 flex items-center gap-2 text-green-700 font-semibold text-sm">
            <span>✅</span> Attendance recorded
          </div>
        )}
      </div>

      <div className="text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 leading-relaxed">
        <strong>How check-in works:</strong> Click <em>Check In Now</em> and allow location access. The system verifies you are within the school's geo-fence zone and records your attendance. If your school has opened a bypass window, location check is skipped. You can also check in at the <strong>biometric kiosk</strong> — register your device below first.
      </div>

      {/* ── Kiosk Device Registration ── */}
      <div className="border border-indigo-200 rounded-xl overflow-hidden">
        <button
          onClick={() => setShowRegPanel((v) => !v)}
          className="w-full flex items-center justify-between px-5 py-3.5 bg-indigo-50 hover:bg-indigo-100 transition-colors text-left"
        >
          <div>
            <p className="text-sm font-semibold text-indigo-900">Register Device for Kiosk</p>
            <p className="text-xs text-indigo-600 mt-0.5">
              {biometrics.length === 0
                ? "Not registered — set up this device for kiosk attendance"
                : "Device registered — use the kiosk from where it was set up"}
            </p>
          </div>
          <span className="text-indigo-400 text-sm">{showRegPanel ? "▲" : "▼"}</span>
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
                  <div key={b.id} className="flex items-center justify-between border border-green-200 bg-green-50 rounded-lg px-3 py-2.5">
                    <div>
                      <p className="text-sm font-medium text-gray-800 flex items-center gap-1.5">
                        <span className="text-green-600">✓</span> {b.deviceName || "Unnamed Device"}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">Registered {new Date(b.registeredAt).toLocaleDateString()} · Only usable at the kiosk from that device</p>
                    </div>
                    <button onClick={() => handleDeleteBiometric(b.id)} className="text-red-500 hover:text-red-700 text-xs shrink-0 ml-3">Remove</button>
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

      {/* Summary chips */}
      <div className="flex flex-wrap gap-3">
        {Object.entries(counts).map(([status, count]) => (
          <div key={status} className={`px-3 py-1.5 rounded-full text-xs font-medium border ${STATUS_STYLES[status] ?? "bg-gray-100 text-gray-600"}`}>
            {status}: {count}
          </div>
        ))}
      </div>

      {/* Records list */}
      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : records.length === 0 ? (
        <p className="text-sm text-gray-500">No attendance records for this period.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
              <tr>
                <th className="px-4 py-3 text-left">Date</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Method</th>
                <th className="px-4 py-3 text-left">Check-In</th>
                <th className="px-4 py-3 text-left">Check-Out</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {records.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">{r.date}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${STATUS_STYLES[r.status] ?? "bg-gray-100"}`}>{r.status}</span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{r.method}</td>
                  <td className="px-4 py-3">{r.checkInTime ?? "—"}</td>
                  <td className="px-4 py-3">{r.checkOutTime ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
