"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import toast, { Toaster } from "react-hot-toast";
import { API_BASE_URL } from "@/lib/api";
import { authFetch } from "@/lib/auth";
import { useRbac } from "@/lib/rbac";
import { useReadOnlySession, READ_ONLY_TITLE } from "@/lib/support-session";
import NumberInput from "@/components/ui/NumberInput";
import {
    Download, LogOut, Plus, QrCode, Search, Settings2, X, Users, RefreshCw, Archive,
} from "lucide-react";

const PURPOSES = ["ADMISSION", "OFFICIAL", "INQUIRY", "PTM", "OTHERS"] as const;
const ID_PROOFS = [
    { value: "", label: "None" },
    { value: "AADHAAR", label: "Aadhaar" },
    { value: "DL", label: "Driving License" },
    { value: "VOTER_ID", label: "Voter ID" },
    { value: "PAN", label: "PAN" },
    { value: "OTHER", label: "Other" },
];
const LIMIT = 20;

interface VisitorRow {
    id: string;
    visitorName: string;
    mobile: string;
    purpose: string;
    description: string | null;
    toMeet: string | null;
    personsCount: number;
    vehicleNumber: string | null;
    source: string;
    entryAt: string;
    exitAt: string | null;
    allowedByName: string | null;
    exitMarkedByName: string | null;
}

const fmtIST = (iso: string) =>
    new Date(iso).toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata",
        day: "2-digit", month: "short",
        hour: "2-digit", minute: "2-digit", hour12: true,
    });

const emptyManualForm = {
    visitorName: "", mobile: "", purpose: "", description: "", toMeet: "",
    personsCount: 1, vehicleNumber: "", idProofType: "", idProofNumber: "",
};

export default function VisitorsPage() {
    const router = useRouter();
    const rbac = useRbac();
    const readOnly = useReadOnlySession();

    // Filters — individual entry boxes as required
    const [fName, setFName] = useState("");
    const [fMobile, setFMobile] = useState("");
    const [fPurpose, setFPurpose] = useState("");
    const [fFrom, setFFrom] = useState("");
    const [fTo, setFTo] = useState("");

    const [rows, setRows] = useState<VisitorRow[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [exporting, setExporting] = useState(false);
    const [markingExit, setMarkingExit] = useState<string | null>(null);

    // Manual entry modal
    const [manualOpen, setManualOpen] = useState(false);
    const [manualForm, setManualForm] = useState({ ...emptyManualForm });
    const [manualSubmitting, setManualSubmitting] = useState(false);

    // Settings (SUPER_ADMIN)
    const [settings, setSettings] = useState<{ qrValidityMinutes: number; exitTrackingEnabled: boolean } | null>(null);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [settingsSaving, setSettingsSaving] = useState(false);

    // Archived history (SUB_ADMIN+)
    const [archivesOpen, setArchivesOpen] = useState(false);
    const [archives, setArchives] = useState<{ id: string; fromDate: string; toDate: string; rowCount: number; createdAt: string }[] | null>(null);
    const [downloadingArchive, setDownloadingArchive] = useState<string | null>(null);

    useEffect(() => {
        if (!rbac.canManageVisitors) router.replace("/dashboard");
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const buildQuery = useCallback((p: number, forCsv = false) => {
        const q = new URLSearchParams();
        if (fName.trim()) q.set("name", fName.trim());
        if (fMobile.trim()) q.set("mobile", fMobile.trim());
        if (fPurpose) q.set("purpose", fPurpose);
        if (fFrom) q.set("fromDate", fFrom);
        if (fTo) q.set("toDate", fTo);
        if (forCsv) {
            q.set("export", "csv");
        } else {
            q.set("page", String(p));
            q.set("limit", String(LIMIT));
        }
        return q;
    }, [fName, fMobile, fPurpose, fFrom, fTo]);

    const load = useCallback(async (p = 1) => {
        setLoading(true);
        try {
            const res = await authFetch(`${API_BASE_URL}/visitors?${buildQuery(p)}`);
            if (!res.ok) throw new Error();
            const data = await res.json();
            setRows(data.items || []);
            setTotal(data.total || 0);
            setPage(p);
        } catch {
            // Stable id — React StrictMode double-mounts effects in dev, and
            // react-hot-toast dedupes by id so the user sees one toast, not two.
            toast.error("Failed to load visitors", { id: "visitors-load-error" });
        } finally {
            setLoading(false);
        }
    }, [buildQuery]);

    useEffect(() => { load(1); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

    useEffect(() => {
        authFetch(`${API_BASE_URL}/visitors/settings`)
            .then(r => (r.ok ? r.json() : null))
            .then(s => s && setSettings({ qrValidityMinutes: s.qrValidityMinutes, exitTrackingEnabled: s.exitTrackingEnabled }))
            .catch(() => { /* settings stay null — exit column still shown */ });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Downloads the WHOLE filtered dataset, not just the current page
    const downloadCsv = async () => {
        setExporting(true);
        try {
            const res = await authFetch(`${API_BASE_URL}/visitors?${buildQuery(1, true)}`);
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.message || "Export failed");
            }
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `Visitors_Report_${new Date().toISOString().split("T")[0]}.csv`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (e: any) {
            toast.error(e.message || "Export failed");
        } finally {
            setExporting(false);
        }
    };

    const markExit = async (id: string) => {
        setMarkingExit(id);
        try {
            const res = await authFetch(`${API_BASE_URL}/visitors/${id}/exit`, { method: "POST" });
            const body = await res.json();
            if (!res.ok) throw new Error(body.message || "Failed to mark exit");
            toast.success("Exit marked");
            load(page);
        } catch (e: any) {
            toast.error(e.message || "Failed to mark exit");
        } finally {
            setMarkingExit(null);
        }
    };

    const submitManual = async (e: React.FormEvent) => {
        e.preventDefault();
        setManualSubmitting(true);
        try {
            const res = await authFetch(`${API_BASE_URL}/visitors/manual`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    visitorName: manualForm.visitorName.trim(),
                    mobile: manualForm.mobile,
                    purpose: manualForm.purpose,
                    description: manualForm.description.trim() || undefined,
                    toMeet: manualForm.toMeet.trim() || undefined,
                    personsCount: Number(manualForm.personsCount) || 1,
                    vehicleNumber: manualForm.vehicleNumber.trim() || undefined,
                    idProofType: manualForm.idProofType || undefined,
                    idProofNumber: manualForm.idProofNumber.trim() || undefined,
                }),
            });
            const body = await res.json();
            if (!res.ok) throw new Error(Array.isArray(body.message) ? body.message[0] : body.message || "Failed to add entry");
            toast.success("Visitor entry added");
            setManualOpen(false);
            setManualForm({ ...emptyManualForm });
            load(1);
        } catch (e: any) {
            toast.error(e.message || "Failed to add entry");
        } finally {
            setManualSubmitting(false);
        }
    };

    const openArchives = async () => {
        setArchivesOpen(true);
        if (archives !== null) return; // already loaded this session
        try {
            const res = await authFetch(`${API_BASE_URL}/visitors/archives`);
            if (!res.ok) throw new Error();
            setArchives(await res.json());
        } catch {
            toast.error("Failed to load archives", { id: "archives-load-error" });
            setArchives([]);
        }
    };

    const downloadArchive = async (id: string) => {
        setDownloadingArchive(id);
        try {
            const res = await authFetch(`${API_BASE_URL}/visitors/archives/${id}/download`);
            const body = await res.json();
            if (!res.ok) throw new Error(body.message || "Download failed");
            // Presigned S3 URL, valid 15 minutes
            const a = document.createElement("a");
            a.href = body.url;
            a.target = "_blank";
            a.rel = "noopener";
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        } catch (e: any) {
            toast.error(e.message || "Download failed");
        } finally {
            setDownloadingArchive(null);
        }
    };

    const saveSettings = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!settings) return;
        setSettingsSaving(true);
        try {
            const res = await authFetch(`${API_BASE_URL}/visitors/settings`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(settings),
            });
            const body = await res.json();
            if (!res.ok) throw new Error(body.message || "Failed to save settings");
            toast.success("Settings saved");
            setSettingsOpen(false);
        } catch (e: any) {
            toast.error(e.message || "Failed to save settings");
        } finally {
            setSettingsSaving(false);
        }
    };

    const manualValid =
        manualForm.visitorName.trim().length > 1 &&
        /^[6-9]\d{9}$/.test(manualForm.mobile) &&
        PURPOSES.includes(manualForm.purpose as any);

    const inputCls = "border border-slate-300 dark:border-white/10 rounded-lg text-sm p-2 bg-gray-50 dark:bg-white/5 text-ink placeholder:text-ink-muted";
    const totalPages = Math.ceil(total / LIMIT) || 1;
    const exitEnabled = settings?.exitTrackingEnabled !== false;

    return (
        <div className="p-4 sm:p-6 space-y-4">
            <Toaster position="top-center" />

            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-teal-500/15 text-teal-600 dark:text-teal-300 flex items-center justify-center shrink-0">
                        <Users className="w-5 h-5" />
                    </div>
                    <div>
                        <h1 className="font-display text-[22px] sm:text-[26px] font-semibold tracking-[-0.02em] text-ink">Visitor Management</h1>
                        <p className="text-ink-muted text-sm">Gate entries, exits and reports</p>
                    </div>
                </div>
                <div className="flex flex-wrap gap-2">
                    <button onClick={() => setManualOpen(true)}
                        className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-sm font-medium">
                        <Plus className="w-4 h-4" /> Manual Entry
                    </button>
                    {rbac.isAdmin && (
                        <Link href="/dashboard/visitors/qr"
                            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-300 dark:border-white/10 text-ink text-sm hover:bg-surface-secondary">
                            <QrCode className="w-4 h-4" /> Entry QR Poster
                        </Link>
                    )}
                    {rbac.canExportVisitors && (
                        <button onClick={openArchives}
                            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-300 dark:border-white/10 text-ink text-sm hover:bg-surface-secondary">
                            <Archive className="w-4 h-4" /> Archives
                        </button>
                    )}
                    {rbac.canManageVisitorSettings && (
                        <button onClick={() => setSettingsOpen(true)}
                            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-300 dark:border-white/10 text-ink text-sm hover:bg-surface-secondary">
                            <Settings2 className="w-4 h-4" /> Settings
                        </button>
                    )}
                </div>
            </div>

            {/* Filters — individual boxes per field */}
            <div className="flex flex-wrap items-end gap-2">
                <input type="text" value={fName} onChange={e => setFName(e.target.value)} placeholder="Name" className={`${inputCls} w-36`} />
                <input type="text" value={fMobile} onChange={e => setFMobile(e.target.value.replace(/\D/g, "").slice(0, 10))} placeholder="Mobile" className={`${inputCls} w-32`} />
                <select value={fPurpose} onChange={e => setFPurpose(e.target.value)} className={`${inputCls} w-32`}>
                    <option value="">All purposes</option>
                    {PURPOSES.map(p => <option key={p} value={p}>{p.charAt(0) + p.slice(1).toLowerCase()}</option>)}
                </select>
                <input type="date" value={fFrom} onChange={e => setFFrom(e.target.value)} className={inputCls} title="From date" />
                <input type="date" value={fTo} onChange={e => setFTo(e.target.value)} className={inputCls} title="To date" />
                <button onClick={() => load(1)}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm">
                    <Search className="w-4 h-4" /> Search
                </button>
                {rbac.canExportVisitors && (
                    <button onClick={downloadCsv} disabled={exporting}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-slate-300 dark:border-white/10 text-ink text-sm hover:bg-surface-secondary disabled:opacity-50">
                        {exporting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} Export CSV
                    </button>
                )}
            </div>

            {loading ? (
                <div className="flex justify-center py-12">
                    <div className="w-6 h-6 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
                </div>
            ) : rows.length === 0 ? (
                <div className="text-center py-16 text-ink-muted text-sm">No visitor entries found for the selected filters.</div>
            ) : (
                <>
                    {/* Desktop table */}
                    <div className="hidden md:block bg-surface rounded-xl shadow-sm border border-slate-200 dark:border-white/10 overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-surface-secondary">
                                <tr className="text-ink-muted text-left">
                                    <th className="px-4 py-3">Visitor</th>
                                    <th className="px-4 py-3">Purpose</th>
                                    <th className="px-4 py-3">To Meet</th>
                                    <th className="px-4 py-3 text-center">Persons</th>
                                    <th className="px-4 py-3">Entry</th>
                                    <th className="px-4 py-3">Exit</th>
                                    <th className="px-4 py-3">Allowed By</th>
                                    {exitEnabled && <th className="px-4 py-3 text-right">Action</th>}
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map(r => (
                                    <tr key={r.id} className="border-t border-slate-100 dark:border-white/5 hover:bg-surface-secondary/60">
                                        <td className="px-4 py-3">
                                            <div className="font-medium text-ink">{r.visitorName}</div>
                                            <div className="text-xs text-ink-muted">{r.mobile}{r.vehicleNumber ? ` · ${r.vehicleNumber}` : ""}</div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 capitalize">{r.purpose.toLowerCase()}</span>
                                            {r.source === "MANUAL" && <span className="ml-1 px-1.5 py-0.5 rounded text-[10px] bg-amber-500/10 text-amber-600 dark:text-amber-300">manual</span>}
                                        </td>
                                        <td className="px-4 py-3 text-ink">{r.toMeet || "—"}</td>
                                        <td className="px-4 py-3 text-center text-ink">{r.personsCount}</td>
                                        <td className="px-4 py-3 text-xs text-ink">{fmtIST(r.entryAt)}</td>
                                        <td className="px-4 py-3 text-xs">
                                            {r.exitAt
                                                ? <span className="text-ink">{fmtIST(r.exitAt)}{r.exitMarkedByName ? <span className="text-ink-muted"> · {r.exitMarkedByName}</span> : null}</span>
                                                : <span className="text-emerald-600 dark:text-emerald-400 font-medium">Inside</span>}
                                        </td>
                                        <td className="px-4 py-3 text-xs text-ink">{r.allowedByName || "—"}</td>
                                        {exitEnabled && (
                                            <td className="px-4 py-3 text-right">
                                                {!r.exitAt && (
                                                    <button onClick={() => markExit(r.id)} disabled={markingExit === r.id}
                                                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-xs font-medium disabled:opacity-50">
                                                        <LogOut className="w-3.5 h-3.5" /> Mark Exit
                                                    </button>
                                                )}
                                            </td>
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile cards */}
                    <div className="md:hidden space-y-2">
                        {rows.map(r => (
                            <div key={r.id} className="bg-surface border border-slate-200 dark:border-white/10 rounded-xl p-3.5 space-y-2">
                                <div className="flex items-start justify-between gap-2">
                                    <div>
                                        <div className="font-semibold text-ink text-sm">{r.visitorName} <span className="text-ink-muted font-normal">({r.personsCount})</span></div>
                                        <div className="text-xs text-ink-muted">{r.mobile}{r.toMeet ? ` · meets ${r.toMeet}` : ""}</div>
                                    </div>
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 capitalize shrink-0">{r.purpose.toLowerCase()}</span>
                                </div>
                                <div className="text-xs text-ink-muted">
                                    In: <span className="text-ink">{fmtIST(r.entryAt)}</span>
                                    {r.exitAt
                                        ? <> · Out: <span className="text-ink">{fmtIST(r.exitAt)}</span></>
                                        : <span className="ml-1 text-emerald-600 dark:text-emerald-400 font-medium">· Inside</span>}
                                </div>
                                {exitEnabled && !r.exitAt && (
                                    <button onClick={() => markExit(r.id)} disabled={markingExit === r.id}
                                        className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-xs font-medium disabled:opacity-50">
                                        <LogOut className="w-3.5 h-3.5" /> Mark Exit
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Pagination */}
                    <div className="flex items-center justify-center gap-1 pt-1">
                        <button disabled={page === 1} onClick={() => load(page - 1)}
                            className="px-2.5 py-1 rounded border border-slate-300 dark:border-white/10 text-sm text-ink disabled:opacity-40">‹</button>
                        <span className="text-sm text-ink-muted px-2">Page {page} of {totalPages} · {total} entries</span>
                        <button disabled={page >= totalPages} onClick={() => load(page + 1)}
                            className="px-2.5 py-1 rounded border border-slate-300 dark:border-white/10 text-sm text-ink disabled:opacity-40">›</button>
                    </div>
                </>
            )}

            {/* ── Manual entry modal ── */}
            {manualOpen && (
                <div className="fixed inset-0 z-80 flex items-end sm:items-center justify-center bg-walnut-950/55 backdrop-blur-sm p-0 sm:p-4" onClick={() => setManualOpen(false)}>
                    <div className="bg-surface w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl p-5 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-ink font-semibold text-base">Manual Visitor Entry</h3>
                            <button onClick={() => setManualOpen(false)} className="p-1.5 rounded-lg text-ink-muted hover:bg-surface-secondary"><X className="w-5 h-5" /></button>
                        </div>
                        <form onSubmit={submitManual} className="space-y-3">
                            <input type="text" value={manualForm.visitorName} onChange={e => setManualForm(p => ({ ...p, visitorName: e.target.value }))} maxLength={150} placeholder="Visitor name *" className={`${inputCls} w-full`} required />
                            <div className="grid grid-cols-2 gap-2">
                                <input type="tel" value={manualForm.mobile} onChange={e => setManualForm(p => ({ ...p, mobile: e.target.value.replace(/\D/g, "").slice(0, 10) }))} maxLength={10} placeholder="Mobile *" className={`${inputCls} w-full`} required />
                                <NumberInput min={1} max={50} value={manualForm.personsCount} emptyValue={1} onChange={v => setManualForm(p => ({ ...p, personsCount: v ?? 1 }))} placeholder="Persons" className={`${inputCls} w-full`} />
                            </div>
                            <select value={manualForm.purpose} onChange={e => setManualForm(p => ({ ...p, purpose: e.target.value }))} className={`${inputCls} w-full`} required>
                                <option value="" disabled>Purpose *</option>
                                {PURPOSES.map(p => <option key={p} value={p}>{p.charAt(0) + p.slice(1).toLowerCase()}</option>)}
                            </select>
                            <input type="text" value={manualForm.toMeet} onChange={e => setManualForm(p => ({ ...p, toMeet: e.target.value }))} maxLength={150} placeholder="Whom to meet (optional)" className={`${inputCls} w-full`} />
                            <textarea value={manualForm.description} onChange={e => setManualForm(p => ({ ...p, description: e.target.value }))} maxLength={500} rows={2} placeholder="Description (optional)" className={`${inputCls} w-full`} />
                            <div className="grid grid-cols-2 gap-2">
                                <input type="text" value={manualForm.vehicleNumber} onChange={e => setManualForm(p => ({ ...p, vehicleNumber: e.target.value }))} maxLength={20} placeholder="Vehicle no. (optional)" className={`${inputCls} w-full`} />
                                <select value={manualForm.idProofType} onChange={e => setManualForm(p => ({ ...p, idProofType: e.target.value }))} className={`${inputCls} w-full`}>
                                    {ID_PROOFS.map(p => <option key={p.value} value={p.value}>{p.value ? p.label : "ID proof (optional)"}</option>)}
                                </select>
                            </div>
                            {manualForm.idProofType && (
                                <input type="text" value={manualForm.idProofNumber} onChange={e => setManualForm(p => ({ ...p, idProofNumber: e.target.value }))} maxLength={30} placeholder="ID proof number" className={`${inputCls} w-full`} />
                            )}
                            <button type="submit" disabled={!manualValid || manualSubmitting || readOnly}
                                title={readOnly ? READ_ONLY_TITLE : undefined}
                                className="w-full py-2.5 rounded-xl font-semibold text-white bg-teal-600 hover:bg-teal-500 disabled:opacity-40 flex items-center justify-center gap-2">
                                {manualSubmitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Allow Entry Now
                            </button>
                            <p className="text-ink-muted text-xs text-center">Entry time is recorded automatically when you submit.</p>
                        </form>
                    </div>
                </div>
            )}

            {/* ── Archived history modal (SUB_ADMIN+) ── */}
            {archivesOpen && (
                <div className="fixed inset-0 z-80 flex items-end sm:items-center justify-center bg-walnut-950/55 backdrop-blur-sm p-0 sm:p-4" onClick={() => setArchivesOpen(false)}>
                    <div className="bg-surface w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl p-5 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-1">
                            <h3 className="text-ink font-semibold text-base flex items-center gap-2"><Archive className="w-4 h-4 text-teal-600 dark:text-teal-400" /> Archived Visitor History</h3>
                            <button onClick={() => setArchivesOpen(false)} className="p-1.5 rounded-lg text-ink-muted hover:bg-surface-secondary"><X className="w-5 h-5" /></button>
                        </div>
                        <p className="text-xs text-ink-muted mb-4">Entries older than 90 days are archived nightly to secure storage and removed from the live list. Download links are valid for 15 minutes.</p>

                        {archives === null ? (
                            <div className="flex justify-center py-10"><div className="w-5 h-5 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" /></div>
                        ) : archives.length === 0 ? (
                            <div className="text-center py-10 text-ink-muted text-sm">No archives yet. They appear once visitor entries cross the 90-day retention window.</div>
                        ) : (
                            <div className="space-y-2">
                                {archives.map(a => (
                                    <div key={a.id} className="flex items-center justify-between gap-3 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3">
                                        <div className="min-w-0">
                                            <div className="text-sm font-medium text-ink truncate">{a.fromDate} → {a.toDate}</div>
                                            <div className="text-xs text-ink-muted">{a.rowCount.toLocaleString("en-IN")} entries · archived {new Date(a.createdAt).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric" })}</div>
                                        </div>
                                        <button onClick={() => downloadArchive(a.id)} disabled={downloadingArchive === a.id}
                                            className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-xs font-medium disabled:opacity-50">
                                            {downloadingArchive === a.id ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />} Download
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ── Settings modal (SUPER_ADMIN) ── */}
            {settingsOpen && settings && (
                <div className="fixed inset-0 z-80 flex items-center justify-center bg-walnut-950/55 backdrop-blur-sm p-4" onClick={() => setSettingsOpen(false)}>
                    <div className="bg-surface w-full max-w-sm rounded-2xl p-5" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-ink font-semibold text-base">Visitor Management Settings</h3>
                            <button onClick={() => setSettingsOpen(false)} className="p-1.5 rounded-lg text-ink-muted hover:bg-surface-secondary"><X className="w-5 h-5" /></button>
                        </div>
                        <form onSubmit={saveSettings} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-ink mb-1.5">QR validity for entry (minutes)</label>
                                <NumberInput min={5} max={720} value={settings.qrValidityMinutes} emptyValue={30}
                                    onChange={v => setSettings(s => s && ({ ...s, qrValidityMinutes: v ?? 30 }))}
                                    className={`${inputCls} w-full`} />
                                <p className="text-xs text-ink-muted mt-1">Default 30. Applies immediately, even to already-generated QRs.</p>
                            </div>
                            <label className="flex items-center justify-between gap-3 text-sm text-ink">
                                <span>Exit tracking</span>
                                <input type="checkbox" checked={settings.exitTrackingEnabled}
                                    onChange={e => setSettings(s => s && ({ ...s, exitTrackingEnabled: e.target.checked }))}
                                    className="w-4 h-4 accent-teal-600" />
                            </label>
                            <button type="submit" disabled={settingsSaving || readOnly}
                                title={readOnly ? READ_ONLY_TITLE : undefined}
                                className="w-full py-2.5 rounded-xl font-semibold text-white bg-teal-600 hover:bg-teal-500 disabled:opacity-40">
                                {settingsSaving ? "Saving…" : "Save Settings"}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
