"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import QRCode from "react-qr-code";
import { API_BASE_URL } from "@/lib/api";
import { authFetch } from "@/lib/auth";
import toast from "react-hot-toast";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import { TimePicker } from "@mui/x-date-pickers/TimePicker";
import { renderTimeViewClock } from "@mui/x-date-pickers/timeViewRenderers";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import dayjs from "dayjs";

interface PickupQRGeneratorProps {
  studentId: number | string;
  studentName?: string;
}

type PickupStatus = "PENDING" | "CONFIRMED" | "CANCELLED" | "EXPIRED";

interface PickupRecord {
  id: string;
  token: string;
  pin: string;
  status: PickupStatus;
  authorizedPersonName: string;
  authorizedPersonMobile: string | null;
  notes: string | null;
  expiresAt: string;
  createdAt: string;
  confirmedAt: string | null;
  confirmedByName: string | null;
  studentName: string;
  className: string;
  sectionName: string;
}

interface GeneratedToken {
  id: string;
  token: string;
  pin: string;
  expiresAt: string;
  studentName: string;
}

const STATUS_BADGE: Record<PickupStatus, { label: string; cls: string }> = {
  PENDING:   { label: "Active",     cls: "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" },
  CONFIRMED: { label: "Picked Up",  cls: "bg-green-500/20  text-green-400  border border-green-500/30"   },
  CANCELLED: { label: "Cancelled",  cls: "bg-red-500/20    text-red-400    border border-red-500/30"     },
  EXPIRED:   { label: "Not Used",   cls: "bg-amber-500/20  text-amber-400  border border-amber-500/30"   },
};

function Countdown({ expiresAt }: { expiresAt: string }) {
  const [remaining, setRemaining] = useState("");

  useEffect(() => {
    const tick = () => {
      const diff = new Date(expiresAt).getTime() - Date.now();
      if (diff <= 0) { setRemaining("Expired"); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setRemaining(h > 0 ? `${h}h ${m}m ${s}s` : `${m}m ${s}s`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);

  const isExpired = remaining === "Expired";
  return (
    <span className={isExpired ? "text-red-400" : "text-amber-400"}>
      {remaining}
    </span>
  );
}

// ── MUI dark theme for the clock picker ─────────────────────────────────────
const muiDarkTheme = createTheme({
  palette: {
    mode: "dark",
    primary: { main: "#6366f1" },
    background: { paper: "#1e293b", default: "#0f172a" },
    text: { primary: "#f1f5f9", secondary: "#94a3b8" },
  },
  components: {
    MuiPaper:      { styleOverrides: { root: { backgroundImage: "none" } } },
    MuiDialog:     { styleOverrides: { paper: { backgroundColor: "#1e293b", backgroundImage: "none" } } },
  },
});

export default function PickupQRGenerator({ studentId, studentName }: PickupQRGeneratorProps) {
  const [view, setView] = useState<"form" | "qr" | "history">("form");
  const [generated, setGenerated] = useState<GeneratedToken | null>(null);
  const [history, setHistory] = useState<PickupRecord[]>([]);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [viewingToken, setViewingToken] = useState<PickupRecord | null>(null);

  // QR container refs (for SVG → PNG → share/download)
  const qrRef = useRef<HTMLDivElement>(null);
  const overlayQrRef = useRef<HTMLDivElement>(null);

  // Default expiry = 30 minutes from now
  const default30Min = () => {
    const d = new Date(Date.now() + 30 * 60 * 1000);
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  };

  // Form state
  const [form, setForm] = useState({
    authorizedPersonName: "",
    authorizedPersonMobile: "",
    expiryTime: default30Min(),
    notes: "",
  });

  const BLANK_FORM = { authorizedPersonName: "", authorizedPersonMobile: "", expiryTime: default30Min(), notes: "" };

  // Build expiresAt from today + chosen HH:MM
  const buildExpiresAt = (): string | null => {
    if (!form.expiryTime) return null;
    const [h, m] = form.expiryTime.split(":").map(Number);
    if (isNaN(h) || isNaN(m)) return null;
    const d = new Date();
    d.setHours(h, m, 0, 0);
    // If chosen time is in the past, move to tomorrow
    if (d <= new Date()) d.setDate(d.getDate() + 1);
    return d.toISOString();
  };



  const fetchHistoryPage = useCallback(async (pg: number) => {
    setHistoryPage(pg);
    setHistoryLoading(true);
    try {
      const res = await authFetch(
        `${API_BASE_URL}/pickup/my-tokens?studentId=${studentId}&limit=5&page=${pg}`
      );
      if (res.ok) {
        const data = await res.json();
        setHistory(data.items ?? []);
        setHistoryTotal(data.total ?? 0);
      }
    } catch { /* noop */ }
    finally { setHistoryLoading(false); }
  }, [studentId]);

  useEffect(() => { fetchHistoryPage(1); }, [fetchHistoryPage]);

  // Re-check generated token expiry while in QR view
  useEffect(() => {
    if (view !== "qr" || !generated) return;
    const id = setInterval(() => {
      if (new Date(generated.expiresAt) <= new Date()) {
        setView("form");
        setGenerated(null);
        toast.error("Your pickup QR code has expired.");
        fetchHistoryPage(1);
      }
    }, 10000);
    return () => clearInterval(id);
  }, [view, generated, fetchHistoryPage]);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.authorizedPersonName.trim()) {
      toast.error("Please enter the authorized person's name");
      return;
    }
    const expiresAt = buildExpiresAt();
    if (!expiresAt) {
      toast.error("Please select a valid expiry time");
      return;
    }

    setSubmitting(true);
    try {
      const res = await authFetch(`${API_BASE_URL}/pickup/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: Number(studentId),
          authorizedPersonName: form.authorizedPersonName.trim(),
          authorizedPersonMobile: form.authorizedPersonMobile.trim() || undefined,
          expiresAt,
          notes: form.notes.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to generate QR");
      }

      const data: GeneratedToken = await res.json();
      setGenerated(data);
      setForm(BLANK_FORM);   // clear form after success
      setView("qr");
      fetchHistoryPage(1);
    } catch (err: any) {
      toast.error(err.message || "Failed to generate QR code");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async (id: string) => {
    setCancelling(id);
    try {
      const res = await authFetch(`${API_BASE_URL}/pickup/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Failed to cancel");
      }
      toast.success("Pickup token cancelled");
      if (generated?.id === id) { setGenerated(null); setView("form"); setForm(BLANK_FORM); }
      fetchHistoryPage(1);
    } catch (err: any) {
      toast.error(err.message || "Failed to cancel token");
    } finally {
      setCancelling(null); }
  };

  // ─── Share / Download QR ──────────────────────────────────────────────────
  const downloadQRBlob = (blob: Blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "pickup-qr.png";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const shareOrDownloadQR = async (
    containerRef: React.RefObject<HTMLDivElement | null>,
    pin: string,
    personName: string,
    sName: string | undefined,
    expiresAt: string,
  ) => {
    const svgEl = containerRef.current?.querySelector("svg");
    if (!svgEl) { toast.error("Could not find QR image"); return; }

    try {
      const svgData = new XMLSerializer().serializeToString(svgEl);
      const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
      const svgUrl = URL.createObjectURL(svgBlob);

      await new Promise<void>((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          const size = 400;
          const pad = 40;
          const canvas = document.createElement("canvas");
          canvas.width = size;
          canvas.height = size;
          const ctx = canvas.getContext("2d")!;
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, size, size);
          ctx.drawImage(img, pad, pad, size - pad * 2, size - pad * 2);
          URL.revokeObjectURL(svgUrl);

          canvas.toBlob(async (blob) => {
            if (!blob) { reject(new Error("Canvas conversion failed")); return; }
            const expiryStr = new Date(expiresAt).toLocaleTimeString("en-IN", {
              hour: "2-digit", minute: "2-digit", hour12: true,
            });
            const shareText =
              `🚗 Pickup QR for ${sName ?? "your child"}\n` +
              `👤 Authorized: ${personName}\n` +
              `🔢 PIN: ${pin}\n` +
              `⏰ Valid until: ${expiryStr}\n\n` +
              `Show this QR code at the school reception for student handover.`;
            const file = new File([blob], "pickup-qr.png", { type: "image/png" });

            if (navigator.canShare && navigator.canShare({ files: [file] })) {
              // Mobile: opens native share sheet (WhatsApp, Messages, etc.)
              try {
                await navigator.share({
                  files: [file],
                  title: `Pickup QR — ${sName ?? "Student"}`,
                  text: shareText,
                });
              } catch (e: any) {
                if (e?.name !== "AbortError") downloadQRBlob(blob);
              }
            } else if (navigator.share) {
              // Share text only (no file support)
              try {
                await navigator.share({ title: `Pickup QR — ${sName ?? "Student"}`, text: shareText });
              } catch (e: any) {
                if (e?.name !== "AbortError") downloadQRBlob(blob);
              }
            } else {
              // Desktop fallback: download the PNG
              downloadQRBlob(blob);
              toast.success("QR image saved!");
            }
            resolve();
          }, "image/png");
        };
        img.onerror = reject;
        img.src = svgUrl;
      });
    } catch {
      toast.error("Could not prepare QR for sharing");
    }
  };

  return (
    <div className="space-y-5">
      {/* ── Retention warning ── */}
      <div className="flex items-start gap-2 px-4 py-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-300 text-xs">
        <svg className="w-4 h-4 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span>Pickup history is automatically deleted after 30 days.</span>
      </div>

      {/* ── Tab switcher ── */}
      <div className="flex gap-1 bg-slate-900 border border-slate-800 rounded-xl p-1">
        {(["form", "history"] as const).map((t) => (
          <button
            key={t}
            onClick={() => { if (t === "history") fetchHistoryPage(1); setView(t); }}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${view === t || (view === "qr" && t === "form")
              ? "bg-indigo-600 text-white shadow"
              : "text-slate-400 hover:text-white"
              }`}
          >
            {t === "form" ? "🚗 Generate QR" : `📋 History${historyTotal > 0 ? ` (${historyTotal})` : ""}`}
          </button>
        ))}
      </div>

      {/* ══════════════ GENERATE FORM ══════════════ */}
      {view === "form" && (
        <form onSubmit={handleGenerate} className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
            <h3 className="text-white font-semibold text-base flex items-center gap-2">
              <span className="text-xl">🚗</span> Authorise Pickup
            </h3>

            {/* Authorized person name */}
            <div>
              <label className="block text-slate-400 text-xs mb-1.5">
                Authorized Person&apos;s Full Name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={form.authorizedPersonName}
                onChange={(e) => setForm((f) => ({ ...f, authorizedPersonName: e.target.value }))}
                placeholder="e.g. Rahul Sharma (father)"
                className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-slate-600"
                required
              />
            </div>

            {/* Mobile (optional) */}
            <div>
              <label className="block text-slate-400 text-xs mb-1.5">
                Mobile Number <span className="text-slate-600">(optional)</span>
              </label>
              <input
                type="tel"
                value={form.authorizedPersonMobile}
                onChange={(e) => setForm((f) => ({ ...f, authorizedPersonMobile: e.target.value }))}
                placeholder="e.g. 9876543210"
                className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-slate-600"
              />
            </div>

            {/* Expiry time — MUI Time Picker (analog clock view on all devices) */}
            <div>
              <label className="block text-slate-400 text-xs mb-1.5">
                Valid Until (time today) <span className="text-red-400">*</span>
              </label>
              <LocalizationProvider dateAdapter={AdapterDayjs}>
                <ThemeProvider theme={muiDarkTheme}>
                  <TimePicker
                    value={form.expiryTime ? dayjs(`2000-01-01T${form.expiryTime}`) : null}
                    onChange={(newVal) => {
                      if (newVal && newVal.isValid()) {
                        setForm((f) => ({ ...f, expiryTime: newVal.format("HH:mm") }));
                      } else {
                        setForm((f) => ({ ...f, expiryTime: "" }));
                      }
                    }}
                    ampm={true}
                    viewRenderers={{
                      hours: renderTimeViewClock,
                      minutes: renderTimeViewClock,
                      meridiem: renderTimeViewClock,
                    }}
                    slotProps={{
                      textField: {
                        size: "small",
                        sx: {
                          width: "100%",
                          "& .MuiOutlinedInput-root": {
                            backgroundColor: "#1e293b",
                            borderRadius: "0.75rem",
                            "& fieldset": { borderColor: "#334155" },
                            "&:hover fieldset": { borderColor: "#475569" },
                            "&.Mui-focused fieldset": { borderColor: "#6366f1", borderWidth: 2 },
                          },
                          "& .MuiInputBase-input": {
                            color: "#f1f5f9",
                            fontSize: "0.875rem",
                            padding: "10px 16px",
                          },
                          "& .MuiSvgIcon-root": { color: "#6366f1" },
                          "& .MuiInputAdornment-root button:hover": { backgroundColor: "rgba(99,102,241,0.1)" },
                        },
                      },
                    }}
                  />
                </ThemeProvider>
              </LocalizationProvider>
              <p className="text-slate-600 text-xs mt-1">Click the clock icon — maximum 8 hours from now</p>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-slate-400 text-xs mb-1.5">
                Notes for staff <span className="text-slate-600">(optional)</span>
              </label>
              <textarea
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="e.g. Doctor appointment at 3 PM"
                rows={2}
                className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-slate-600 resize-none"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold rounded-xl transition-all text-sm flex items-center justify-center gap-2"
            >
              {submitting ? (
                <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Generating…</>
              ) : (
                <><span>🔑</span> Generate Pickup QR</>
              )}
            </button>
          </div>
        </form>
      )}

      {/* ══════════════ QR DISPLAY ══════════════ */}
      {view === "qr" && generated && (
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-5">
            {/* QR Code */}
            <div className="flex justify-center">
              <div ref={qrRef} className="bg-white p-4 rounded-2xl shadow-lg">
                <QRCode value={generated.token} size={200} />
              </div>
            </div>

            {/* PIN */}
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 text-center">
              <p className="text-amber-300 text-xs font-medium mb-1">
                Share this PIN with {generated.studentName ? `${generated.studentName}'s` : "the"} pickup person
              </p>
              <div className="flex justify-center gap-2 mt-2">
                {generated.pin.split("").map((digit, i) => (
                  <span
                    key={i}
                    className="w-10 h-12 bg-amber-500/20 border border-amber-500/40 rounded-lg flex items-center justify-center text-amber-300 text-2xl font-bold"
                  >
                    {digit}
                  </span>
                ))}
              </div>
            </div>

            {/* Expiry countdown */}
            <div className="flex items-center justify-between bg-slate-800 rounded-xl px-4 py-3 text-sm">
              <span className="text-slate-400">Expires in</span>
              <Countdown expiresAt={generated.expiresAt} />
            </div>

            {/* Details */}
            <div className="text-sm text-slate-400 space-y-1">
              <p><span className="text-slate-500">Authorised for:</span> <span className="text-white">{generated.studentName || "—"}</span></p>
              <p><span className="text-slate-500">Pickup by:</span> <span className="text-white">{form.authorizedPersonName}</span></p>
              {form.authorizedPersonMobile && (
                <p><span className="text-slate-500">Mobile:</span> <span className="text-white">{form.authorizedPersonMobile}</span></p>
              )}
            </div>

            {/* Actions */}
            <button
              onClick={() => shareOrDownloadQR(qrRef, generated.pin, form.authorizedPersonName, generated.studentName, generated.expiresAt)}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl text-sm transition-all flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
              Share QR via WhatsApp / Other Apps
            </button>
            <div className="flex gap-2">
              <button
                onClick={() => { setView("form"); setForm(BLANK_FORM); }}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-sm font-medium transition-all"
              >
                ← New QR
              </button>
              <button
                onClick={() => handleCancel(generated.id)}
                disabled={cancelling === generated.id}
                className="flex-1 py-2.5 bg-red-900/40 hover:bg-red-900/60 disabled:opacity-50 text-red-400 rounded-xl text-sm font-medium transition-all border border-red-800/40"
              >
                {cancelling === generated.id ? "Cancelling…" : "🚫 Cancel QR"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════ HISTORY ══════════════ */}
      {view === "history" && (
        <div className="space-y-3">
          {historyLoading ? (
            <div className="flex justify-center py-12">
              <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-sm">No pickup history yet</div>
          ) : (
            history.map((r) => {
              const isExpired = r.status === "PENDING" && new Date(r.expiresAt) <= new Date();
              const badge = isExpired ? STATUS_BADGE.EXPIRED : STATUS_BADGE[r.status];
              const isPending = r.status === "PENDING" && !isExpired;
              // Only show View QR if token + pin were returned (PENDING records from backend)
              const canViewQR = isPending && !!r.token && !!r.pin;
              return (
                <div key={r.id} className="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-white text-sm font-medium">{r.authorizedPersonName}</p>
                      {r.authorizedPersonMobile && (
                        <p className="text-slate-500 text-xs">{r.authorizedPersonMobile}</p>
                      )}
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${badge.cls}`}>
                      {badge.label}
                    </span>
                  </div>

                  <div className="text-xs text-slate-500 space-y-0.5">
                    <p>Created: {new Date(r.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</p>
                    <p>Expires: {new Date(r.expiresAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</p>
                    {r.confirmedAt && (
                      <p className="text-blue-400">
                        Confirmed at {new Date(r.confirmedAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                        {r.confirmedByName ? ` by ${r.confirmedByName}` : ""}
                      </p>
                    )}
                    {r.notes && <p className="text-slate-400 italic">Note: {r.notes}</p>}
                  </div>

                  {isPending && (
                    <div className="flex gap-2 mt-1">
                      {canViewQR && (
                        <button
                          onClick={() => setViewingToken(r)}
                          className="flex-1 py-1.5 bg-indigo-900/30 hover:bg-indigo-900/50 text-indigo-400 rounded-lg text-xs font-medium transition-all border border-indigo-800/30"
                        >
                          👁 View QR
                        </button>
                      )}
                      <button
                        onClick={() => handleCancel(r.id)}
                        disabled={cancelling === r.id}
                        className="flex-1 py-1.5 bg-red-900/30 hover:bg-red-900/50 disabled:opacity-50 text-red-400 rounded-lg text-xs font-medium transition-all border border-red-800/30"
                      >
                        {cancelling === r.id ? "Cancelling…" : "🚫 Cancel"}
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}

          {/* ── Pagination ── */}
          {Math.ceil(historyTotal / 5) > 1 && !historyLoading && (
            <div className="flex items-center justify-between pt-2">
              <button
                onClick={() => fetchHistoryPage(historyPage - 1)}
                disabled={historyPage === 1}
                className="flex items-center gap-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300 text-xs rounded-lg transition-all"
              >
                ← Prev
              </button>
              <span className="text-slate-500 text-xs">
                Page <span className="text-slate-300 font-medium">{historyPage}</span> of {Math.ceil(historyTotal / 5)}
              </span>
              <button
                onClick={() => fetchHistoryPage(historyPage + 1)}
                disabled={historyPage >= Math.ceil(historyTotal / 5)}
                className="flex items-center gap-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300 text-xs rounded-lg transition-all"
              >
                Next →
              </button>
            </div>
          )}
        </div>
      )}

      {/* ══════════════ VIEW QR OVERLAY ══════════════ */}
      {viewingToken && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={() => setViewingToken(null)}>
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 w-full max-w-sm space-y-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-white font-semibold text-base">🚗 Active Pickup QR</h3>
              <button onClick={() => setViewingToken(null)} className="text-slate-500 hover:text-white text-xl leading-none">✕</button>
            </div>

            {/* QR Code */}
            <div className="flex justify-center">
              <div ref={overlayQrRef} className="bg-white p-4 rounded-2xl shadow-lg">
                <QRCode value={viewingToken.token} size={192} />
              </div>
            </div>

            {/* PIN */}
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 text-center">
              <p className="text-amber-300 text-xs font-medium mb-1">
                Share this PIN with {viewingToken.authorizedPersonName}
              </p>
              <div className="flex justify-center gap-2 mt-2">
                {(viewingToken.pin ?? "----").split("").map((digit, i) => (
                  <span key={i} className="w-10 h-12 bg-amber-500/20 border border-amber-500/40 rounded-lg flex items-center justify-center text-amber-300 text-2xl font-bold">
                    {digit}
                  </span>
                ))}
              </div>
            </div>

            {/* Expiry */}
            <div className="flex items-center justify-between bg-slate-800 rounded-xl px-4 py-3 text-sm">
              <span className="text-slate-400">Expires in</span>
              <Countdown expiresAt={viewingToken.expiresAt} />
            </div>

            {/* Details */}
            <div className="text-sm text-slate-400 space-y-1">
              <p><span className="text-slate-500">Pickup by:</span> <span className="text-white">{viewingToken.authorizedPersonName}</span></p>
              {viewingToken.authorizedPersonMobile && (
                <p><span className="text-slate-500">Mobile:</span> <span className="text-white">{viewingToken.authorizedPersonMobile}</span></p>
              )}
              {viewingToken.notes && (
                <p><span className="text-slate-500">Notes:</span> <span className="text-white">{viewingToken.notes}</span></p>
              )}
            </div>

            <div className="space-y-2">
              <button
                onClick={() => shareOrDownloadQR(overlayQrRef, viewingToken.pin ?? "", viewingToken.authorizedPersonName, viewingToken.studentName, viewingToken.expiresAt)}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl text-sm transition-all flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                </svg>
                Share QR via WhatsApp / Other Apps
              </button>
              <button
                onClick={() => { handleCancel(viewingToken.id); setViewingToken(null); }}
                disabled={cancelling === viewingToken.id}
                className="w-full py-2.5 bg-red-900/40 hover:bg-red-900/60 disabled:opacity-50 text-red-400 rounded-xl text-sm font-medium transition-all border border-red-800/40"
              >
                {cancelling === viewingToken.id ? "Cancelling…" : "🚫 Cancel this QR"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
