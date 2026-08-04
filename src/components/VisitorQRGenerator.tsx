"use client";

import React, { useState, useEffect } from "react";
import QRCode from "react-qr-code";
import { API_BASE_URL } from "@/lib/api";
import { authFetch, getUser } from "@/lib/auth";
import NumberInput from "@/components/ui/NumberInput";
import {
    UserRound, Users, Car, IdCard, QrCode, RefreshCw, Clock, AlertTriangle, Info,
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

interface QrResult {
    token: string;
    validityMinutes: number;
    expiresAt: string;
}

/**
 * Visiting-QR generator for logged-in users (parent portal "QR Codes" tab).
 * Same stateless flow as the public /visit page — the QR is signed form
 * data, nothing is stored until the gate staff allows the entry, so there
 * is deliberately NO history here (unlike Pickup QR).
 * Name and mobile are auto-filled from the logged-in account.
 */
export default function VisitorQRGenerator() {
    const user = getUser();
    const [form, setForm] = useState({
        visitorName: user ? `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() : "",
        mobile: (user?.mobile ?? "").replace(/\D/g, "").slice(-10),
        purpose: "" as string,
        description: "",
        toMeet: "",
        personsCount: 1,
        vehicleNumber: "",
        idProofType: "",
        idProofNumber: "",
    });
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState("");
    const [qr, setQr] = useState<QrResult | null>(null);
    const [remaining, setRemaining] = useState(0);

    useEffect(() => {
        if (!qr) return;
        const tick = () => setRemaining(Math.max(0, Math.floor((new Date(qr.expiresAt).getTime() - Date.now()) / 1000)));
        tick();
        const t = setInterval(tick, 1000);
        return () => clearInterval(t);
    }, [qr]);

    const valid =
        form.visitorName.trim().length > 1 &&
        /^[6-9]\d{9}$/.test(form.mobile) &&
        PURPOSES.includes(form.purpose as any) &&
        Number(form.personsCount) >= 1;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!valid) return;
        setSubmitting(true);
        setError("");
        try {
            const res = await authFetch(`${API_BASE_URL}/visitors/qr-token`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    visitorName: form.visitorName.trim(),
                    mobile: form.mobile,
                    purpose: form.purpose,
                    description: form.description.trim() || undefined,
                    toMeet: form.toMeet.trim() || undefined,
                    personsCount: Number(form.personsCount) || 1,
                    vehicleNumber: form.vehicleNumber.trim() || undefined,
                    idProofType: form.idProofType || undefined,
                    idProofNumber: form.idProofNumber.trim() || undefined,
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(Array.isArray(data.message) ? data.message[0] : data.message || "Failed to generate visiting QR");
            setQr(data);
        } catch (err: any) {
            setError(err.message || "Failed to generate visiting QR");
        } finally {
            setSubmitting(false);
        }
    };

    const inputCls = "w-full bg-white dark:bg-white/5 border border-slate-300 dark:border-white/10 text-ink placeholder:text-ink-muted rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand/60";
    const labelCls = "block text-xs font-medium text-ink-muted mb-1";
    const fmtRemaining = `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, "0")}`;

    if (qr) {
        return (
            <div className="bg-surface border border-slate-200 dark:border-white/10 rounded-2xl p-5 sm:p-6 space-y-5">
                <div className="flex flex-col items-center text-center">
                    <p className="text-ink font-semibold mb-3">Show this QR at the school gate</p>
                    <div className="bg-white p-4 rounded-2xl border border-slate-200 max-w-full">
                        <QRCode
                            value={`V1:${qr.token}`}
                            size={200}
                            style={{ width: "100%", maxWidth: 200, height: "auto" }}
                        />
                    </div>
                    <div className={`mt-3 flex items-center gap-1.5 text-sm ${remaining > 0 ? "text-ink-muted" : "text-red-500"}`}>
                        <Clock className="w-4 h-4" />
                        {remaining > 0
                            ? <>Valid for entry: <span className="font-mono font-semibold text-ink">{fmtRemaining}</span></>
                            : <>Expired — generate a new QR</>}
                    </div>
                </div>

                <div className="border border-slate-200 dark:border-white/10 rounded-xl divide-y divide-slate-100 dark:divide-white/5 text-sm">
                    {[
                        ["Name", form.visitorName],
                        ["Mobile", form.mobile],
                        ["Purpose", form.purpose],
                        ["Persons", String(form.personsCount)],
                        ...(form.toMeet ? [["To Meet", form.toMeet]] : []),
                    ].map(([k, v]) => (
                        <div key={k} className="flex justify-between px-4 py-2">
                            <span className="text-ink-muted">{k}</span>
                            <span className="text-ink font-medium text-right">{v}</span>
                        </div>
                    ))}
                </div>

                <div className="flex items-start gap-2 text-xs text-ink-muted bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl p-3">
                    <Info className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>This QR is not saved anywhere — no history is kept. Your visit is recorded only when the gate staff scans and allows it. Each QR works once.</span>
                </div>

                <button onClick={() => setQr(null)}
                    className="w-full py-2.5 rounded-xl font-semibold text-ink border border-slate-300 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/5 transition-all flex items-center justify-center gap-2">
                    <RefreshCw className="w-4 h-4" /> Generate Another QR
                </button>
            </div>
        );
    }

    return (
        <form onSubmit={handleSubmit} className="bg-surface border border-slate-200 dark:border-white/10 rounded-2xl p-5 sm:p-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                    <label className={labelCls}><UserRound className="w-3.5 h-3.5 inline mr-1 -mt-0.5" />Visitor Name *</label>
                    <input type="text" value={form.visitorName} onChange={e => setForm(p => ({ ...p, visitorName: e.target.value }))} maxLength={150} className={inputCls} required />
                </div>
                <div>
                    <label className={labelCls}>Mobile *</label>
                    <input type="tel" value={form.mobile} onChange={e => setForm(p => ({ ...p, mobile: e.target.value.replace(/\D/g, "").slice(0, 10) }))} maxLength={10} className={inputCls} required />
                </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
                <div>
                    <label className={labelCls}>Purpose *</label>
                    <select value={form.purpose} onChange={e => setForm(p => ({ ...p, purpose: e.target.value }))} className={inputCls} required>
                        <option value="" disabled>Select…</option>
                        {PURPOSES.map(p => <option key={p} value={p}>{p.charAt(0) + p.slice(1).toLowerCase()}</option>)}
                    </select>
                </div>
                <div>
                    <label className={labelCls}><Users className="w-3.5 h-3.5 inline mr-1 -mt-0.5" />No. of Persons *</label>
                    <NumberInput min={1} max={50} value={form.personsCount} emptyValue={1} onChange={v => setForm(p => ({ ...p, personsCount: v ?? 1 }))} className={inputCls} required />
                </div>
            </div>

            <div>
                <label className={labelCls}>Whom to Meet (optional)</label>
                <input type="text" value={form.toMeet} onChange={e => setForm(p => ({ ...p, toMeet: e.target.value }))} maxLength={150} placeholder="e.g. Principal, Class Teacher of 5-A" className={inputCls} />
            </div>

            <div>
                <label className={labelCls}>Description (optional)</label>
                <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} maxLength={500} rows={2} placeholder="Briefly describe the purpose of your visit" className={inputCls} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                    <label className={labelCls}><Car className="w-3.5 h-3.5 inline mr-1 -mt-0.5" />Vehicle No. (optional)</label>
                    <input type="text" value={form.vehicleNumber} onChange={e => setForm(p => ({ ...p, vehicleNumber: e.target.value }))} maxLength={20} placeholder="GJ01AB1234" className={inputCls} />
                </div>
                <div>
                    <label className={labelCls}><IdCard className="w-3.5 h-3.5 inline mr-1 -mt-0.5" />ID Proof (optional)</label>
                    <select value={form.idProofType} onChange={e => setForm(p => ({ ...p, idProofType: e.target.value }))} className={inputCls}>
                        {ID_PROOFS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                    </select>
                </div>
                <div>
                    <label className={labelCls}>ID Number</label>
                    <input type="text" value={form.idProofNumber} onChange={e => setForm(p => ({ ...p, idProofNumber: e.target.value }))} maxLength={30} className={inputCls} disabled={!form.idProofType} />
                </div>
            </div>

            {error && (
                <div className="flex items-start gap-2 text-red-600 dark:text-red-400 text-sm p-3 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{error}</span>
                </div>
            )}

            <button type="submit" disabled={!valid || submitting}
                className="w-full py-3 rounded-xl font-semibold text-white bg-teal-600 hover:bg-teal-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2">
                {submitting ? <><RefreshCw className="w-4 h-4 animate-spin" /> Generating…</> : <><QrCode className="w-4 h-4" /> Get Visiting QR</>}
            </button>

            <p className="text-ink-muted text-xs text-center">
                Nothing is saved until the gate staff scans and allows your entry — so there is no visiting history.
            </p>
        </form>
    );
}
