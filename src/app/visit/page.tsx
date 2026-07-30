"use client";

import { useState, useEffect } from "react";
import QRCode from "react-qr-code";
import { API_BASE_URL } from "@/lib/api";
import { getSchoolSlug } from "@/lib/env";
import {
    UserRound, Phone, Users, Car, IdCard, MessageSquareText,
    QrCode, RefreshCw, Clock, CheckCircle2, AlertTriangle,
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

const emptyForm = {
    visitorName: "",
    mobile: "",
    purpose: "" as string,
    description: "",
    toMeet: "",
    personsCount: 1,
    vehicleNumber: "",
    idProofType: "",
    idProofNumber: "",
};

export default function VisitorFormPage() {
    const [school, setSchool] = useState<{ name: string; logoUrl: string | null } | null>(null);
    // null = still checking; the form only renders once the feature is confirmed on
    const [featureEnabled, setFeatureEnabled] = useState<boolean | null>(null);
    const [form, setForm] = useState({ ...emptyForm });
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState("");
    const [qr, setQr] = useState<QrResult | null>(null);
    const [remaining, setRemaining] = useState<number>(0); // seconds

    const schoolHeaders = () => {
        const slug = getSchoolSlug();
        const h: Record<string, string> = {};
        if (slug) h["X-School-Slug"] = slug;
        return h;
    };

    useEffect(() => {
        fetch(`${API_BASE_URL}/school/info`, { headers: schoolHeaders() })
            .then(r => (r.ok ? r.json() : null))
            .then(d => d?.name && setSchool({ name: d.name, logoUrl: d.logoUrl }))
            .catch(() => { /* header still renders without school info */ });
        fetch(`${API_BASE_URL}/visitors/public-status`, { headers: schoolHeaders() })
            .then(r => (r.ok ? r.json() : { enabled: true }))
            .then(d => setFeatureEnabled(d?.enabled !== false))
            // Network hiccup — let the form render; submit still enforces server-side
            .catch(() => setFeatureEnabled(true));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Validity countdown for the generated QR
    useEffect(() => {
        if (!qr) return;
        const tick = () => {
            const left = Math.max(0, Math.floor((new Date(qr.expiresAt).getTime() - Date.now()) / 1000));
            setRemaining(left);
        };
        tick();
        const t = setInterval(tick, 1000);
        return () => clearInterval(t);
    }, [qr]);

    const set = (key: keyof typeof emptyForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
        setForm(prev => ({ ...prev, [key]: e.target.value }));

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
            const res = await fetch(`${API_BASE_URL}/visitors/qr-token`, {
                method: "POST",
                headers: { "Content-Type": "application/json", ...schoolHeaders() },
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
            if (!res.ok) throw new Error(Array.isArray(data.message) ? data.message[0] : data.message || "Failed to generate visitor QR");
            setQr(data);
        } catch (err: any) {
            setError(err.message || "Failed to generate visitor QR");
        } finally {
            setSubmitting(false);
        }
    };

    const resetAll = () => { setQr(null); setForm({ ...emptyForm }); setError(""); };

    const inputCls = "w-full bg-slate-800 border border-slate-700 text-white placeholder-slate-500 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-brand/40";
    const labelCls = "block text-sm font-medium text-slate-300 mb-1.5";

    const fmtRemaining = `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, "0")}`;

    return (
        <div className="min-h-screen bg-slate-950 flex justify-center p-4 py-8">
            <div className="w-full max-w-md">
                {/* Header */}
                <div className="flex flex-col items-center mb-6 text-center">
                    {school?.logoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={school.logoUrl} alt="School logo" className="w-14 h-14 rounded-2xl object-contain bg-white p-1 shadow-lg mb-3" />
                    ) : (
                        <div className="w-14 h-14 rounded-2xl bg-linear-to-br from-teal-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-teal-500/30 mb-3">
                            <QrCode className="w-7 h-7 text-white" />
                        </div>
                    )}
                    <h1 className="text-white text-2xl font-bold">{school?.name || "Visitor Entry"}</h1>
                    <p className="text-slate-400 text-sm mt-1">Fill this form to get your gate-entry QR code</p>
                </div>

                {featureEnabled === null ? (
                    <div className="flex justify-center py-16">
                        <div className="w-7 h-7 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                ) : !featureEnabled ? (
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl text-center space-y-3">
                        <div className="text-5xl">🛂</div>
                        <h2 className="text-white font-bold text-lg">Visitor registration is not available</h2>
                        <p className="text-slate-400 text-sm">
                            This school has not enabled online visitor registration. Please contact the staff at the school gate.
                        </p>
                    </div>
                ) : !qr ? (
                    <form onSubmit={handleSubmit} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
                        <div>
                            <label className={labelCls}><UserRound className="w-3.5 h-3.5 inline mr-1 -mt-0.5" />Full Name *</label>
                            <input type="text" value={form.visitorName} onChange={set("visitorName")} maxLength={150} placeholder="Your name" className={inputCls} required />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className={labelCls}><Phone className="w-3.5 h-3.5 inline mr-1 -mt-0.5" />Mobile *</label>
                                <input
                                    type="tel" value={form.mobile}
                                    onChange={e => setForm(p => ({ ...p, mobile: e.target.value.replace(/\D/g, "").slice(0, 10) }))}
                                    maxLength={10} placeholder="9876543210" className={inputCls} required
                                />
                            </div>
                            <div>
                                <label className={labelCls}><Users className="w-3.5 h-3.5 inline mr-1 -mt-0.5" />No. of Persons *</label>
                                <input type="number" min={1} max={50} value={form.personsCount} onChange={set("personsCount")} className={inputCls} required />
                            </div>
                        </div>

                        <div>
                            <label className={labelCls}>Purpose of Visit *</label>
                            <select value={form.purpose} onChange={set("purpose")} className={inputCls} required>
                                <option value="" disabled>Select purpose…</option>
                                {PURPOSES.map(p => <option key={p} value={p}>{p.charAt(0) + p.slice(1).toLowerCase()}</option>)}
                            </select>
                        </div>

                        <div>
                            <label className={labelCls}>Whom to Meet <span className="text-slate-500">(optional)</span></label>
                            <input type="text" value={form.toMeet} onChange={set("toMeet")} maxLength={150} placeholder="e.g. Principal, Class Teacher of 5-A" className={inputCls} />
                        </div>

                        <div>
                            <label className={labelCls}><MessageSquareText className="w-3.5 h-3.5 inline mr-1 -mt-0.5" />Description <span className="text-slate-500">(optional)</span></label>
                            <textarea value={form.description} onChange={set("description")} maxLength={500} rows={2} placeholder="Briefly describe the purpose of your visit" className={inputCls} />
                        </div>

                        <div>
                            <label className={labelCls}><Car className="w-3.5 h-3.5 inline mr-1 -mt-0.5" />Vehicle Number <span className="text-slate-500">(optional)</span></label>
                            <input type="text" value={form.vehicleNumber} onChange={set("vehicleNumber")} maxLength={20} placeholder="e.g. GJ01AB1234" className={inputCls} />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className={labelCls}><IdCard className="w-3.5 h-3.5 inline mr-1 -mt-0.5" />ID Proof <span className="text-slate-500">(optional)</span></label>
                                <select value={form.idProofType} onChange={set("idProofType")} className={inputCls}>
                                    {ID_PROOFS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className={labelCls}>ID Number</label>
                                <input type="text" value={form.idProofNumber} onChange={set("idProofNumber")} maxLength={30} placeholder="ID proof no." className={inputCls} disabled={!form.idProofType} />
                            </div>
                        </div>

                        {error && (
                            <div className="flex items-start gap-2 text-red-400 text-sm p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
                                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                                <span>{error}</span>
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={!valid || submitting}
                            className="w-full py-3 rounded-xl font-semibold text-white bg-linear-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                        >
                            {submitting ? (
                                <><RefreshCw className="w-4 h-4 animate-spin" /> Generating…</>
                            ) : (
                                <><QrCode className="w-4 h-4" /> Get My Entry QR</>
                            )}
                        </button>

                        <p className="text-slate-500 text-xs text-center">
                            Nothing is saved until the gate staff scans and allows your entry.
                        </p>
                    </form>
                ) : (
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-5">
                        <div className="flex flex-col items-center text-center">
                            <div className="flex items-center gap-2 text-emerald-400 mb-3">
                                <CheckCircle2 className="w-5 h-5" />
                                <span className="font-semibold">QR generated — show this at the gate</span>
                            </div>
                            <div className="bg-white p-4 rounded-2xl max-w-full">
                                <QRCode
                                    value={`V1:${qr.token}`}
                                    size={220}
                                    style={{ width: "100%", maxWidth: 220, height: "auto" }}
                                />
                            </div>
                            <div className={`mt-3 flex items-center gap-1.5 text-sm ${remaining > 0 ? "text-slate-300" : "text-red-400"}`}>
                                <Clock className="w-4 h-4" />
                                {remaining > 0
                                    ? <>Valid for entry: <span className="font-mono font-semibold">{fmtRemaining}</span></>
                                    : <>This QR has expired — please generate a new one</>}
                            </div>
                        </div>

                        {/* Summary */}
                        <div className="border border-slate-800 rounded-xl divide-y divide-slate-800 text-sm">
                            {[
                                ["Name", form.visitorName],
                                ["Mobile", form.mobile],
                                ["Purpose", form.purpose],
                                ["Persons", String(form.personsCount)],
                                ...(form.toMeet ? [["To Meet", form.toMeet]] : []),
                                ...(form.vehicleNumber ? [["Vehicle", form.vehicleNumber]] : []),
                            ].map(([k, v]) => (
                                <div key={k} className="flex justify-between px-4 py-2.5">
                                    <span className="text-slate-400">{k}</span>
                                    <span className="text-white font-medium text-right">{v}</span>
                                </div>
                            ))}
                        </div>

                        <button
                            onClick={resetAll}
                            className="w-full py-3 rounded-xl font-semibold text-slate-300 border border-slate-700 hover:bg-slate-800 transition-all flex items-center justify-center gap-2"
                        >
                            <RefreshCw className="w-4 h-4" /> New Visitor Entry
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
