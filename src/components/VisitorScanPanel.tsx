"use client";

import React, { useState, useEffect } from "react";
import { API_BASE_URL } from "@/lib/api";
import { authFetch } from "@/lib/auth";
import toast from "react-hot-toast";
import {
    UserRound, Phone, Users, Car, IdCard, LogIn, LogOut,
    CheckCircle2, XCircle, Clock, AlertTriangle, MessageSquareText,
} from "lucide-react";

type QrStatus = "VALID" | "EXPIRED" | "ENTERED" | "EXITED";

interface VerifyResponse {
    status: QrStatus;
    visitor: {
        visitorName: string;
        mobile: string;
        purpose: string;
        description: string | null;
        toMeet: string | null;
        personsCount: number;
        vehicleNumber: string | null;
        idProofType: string | null;
        idProofNumber: string | null;
    };
    issuedAt: string;
    expiresAt: string;
    entry: {
        id: string;
        entryAt: string;
        exitAt: string | null;
        allowedByName: string | null;
    } | null;
    exitTrackingEnabled: boolean;
}

interface VisitorScanPanelProps {
    /** The signed token WITHOUT the V1: prefix */
    token: string;
    /** Called after entry allowed / exit marked / user wants next scan */
    onDone: () => void;
    /** Called on reject / cancel */
    onCancel: () => void;
}

const fmtIST = (iso: string) =>
    new Date(iso).toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata",
        day: "2-digit", month: "short",
        hour: "2-digit", minute: "2-digit", hour12: true,
    });

/**
 * Rendered by the unified scanner when a `V1:`-prefixed visitor QR is
 * decoded. Verifies the stateless token and drives the single-use
 * lifecycle: allow entry (once), mark exit (once), then fully consumed.
 */
export default function VisitorScanPanel({ token, onDone, onCancel }: VisitorScanPanelProps) {
    const [data, setData] = useState<VerifyResponse | null>(null);
    const [error, setError] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [result, setResult] = useState<{ kind: "entry" | "exit"; at: string } | null>(null);

    useEffect(() => {
        (async () => {
            try {
                const res = await authFetch(`${API_BASE_URL}/visitors/verify/${encodeURIComponent(token)}`);
                const body = await res.json();
                if (!res.ok) throw new Error(body.message || "Could not verify visitor QR");
                setData(body);
            } catch (e: any) {
                setError(e.message || "Could not verify visitor QR");
            }
        })();
    }, [token]);

    const allowEntry = async () => {
        setSubmitting(true);
        try {
            const res = await authFetch(`${API_BASE_URL}/visitors/allow`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token }),
            });
            const body = await res.json();
            if (!res.ok) throw new Error(body.message || "Failed to allow entry");
            setResult({ kind: "entry", at: body.entryAt });
        } catch (e: any) {
            toast.error(e.message || "Failed to allow entry");
        } finally {
            setSubmitting(false);
        }
    };

    const markExit = async () => {
        if (!data?.entry) return;
        setSubmitting(true);
        try {
            const res = await authFetch(`${API_BASE_URL}/visitors/${data.entry.id}/exit`, { method: "POST" });
            const body = await res.json();
            if (!res.ok) throw new Error(body.message || "Failed to mark exit");
            setResult({ kind: "exit", at: body.exitAt });
        } catch (e: any) {
            toast.error(e.message || "Failed to mark exit");
        } finally {
            setSubmitting(false);
        }
    };

    // ── Terminal success screen ──
    if (result) {
        return (
            <div className="flex flex-col items-center gap-5 py-8 text-center">
                <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center">
                    {result.kind === "entry"
                        ? <LogIn className="w-10 h-10 text-emerald-400" />
                        : <LogOut className="w-10 h-10 text-emerald-400" />}
                </div>
                <div>
                    <h2 className="text-white font-bold text-xl mb-1">
                        {result.kind === "entry" ? "Entry Allowed" : "Exit Marked"}
                    </h2>
                    <p className="text-emerald-400 text-sm font-medium">{fmtIST(result.at)}</p>
                </div>
                {data && (
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 w-full text-left space-y-1.5 text-sm">
                        <p className="text-slate-400"><span className="text-slate-500">Visitor:</span> <span className="text-white">{data.visitor.visitorName}</span></p>
                        <p className="text-slate-400"><span className="text-slate-500">Mobile:</span> <span className="text-white">{data.visitor.mobile}</span></p>
                        <p className="text-slate-400"><span className="text-slate-500">Persons:</span> <span className="text-white">{data.visitor.personsCount}</span></p>
                    </div>
                )}
                <button onClick={onDone}
                    className="px-8 py-3 bg-teal-600 hover:bg-teal-500 text-white font-semibold rounded-xl transition-all">
                    📷 Scan Another QR
                </button>
            </div>
        );
    }

    // ── Error / loading ──
    if (error) {
        return (
            <div className="flex flex-col items-center gap-5 py-8 text-center">
                <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center">
                    <XCircle className="w-10 h-10 text-red-400" />
                </div>
                <div>
                    <h2 className="text-white font-bold text-xl mb-1">Invalid Visitor QR</h2>
                    <p className="text-red-400 text-sm">{error}</p>
                </div>
                <button onClick={onCancel}
                    className="px-8 py-3 bg-teal-600 hover:bg-teal-500 text-white font-semibold rounded-xl transition-all">
                    Try Again
                </button>
            </div>
        );
    }
    if (!data) {
        return (
            <div className="flex flex-col items-center gap-4 py-12">
                <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-slate-400 text-sm">Verifying visitor QR…</p>
            </div>
        );
    }

    const { status, visitor, entry } = data;

    const visitorCard = (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
            <div className="flex items-start gap-3">
                <div className="w-10 h-10 bg-teal-500/20 rounded-xl flex items-center justify-center shrink-0">
                    <UserRound className="w-5 h-5 text-teal-400" />
                </div>
                <div>
                    <h3 className="text-white font-bold text-base">{visitor.visitorName}</h3>
                    <p className="text-slate-400 text-sm capitalize">{visitor.purpose.toLowerCase()} visit</p>
                </div>
            </div>
            <div className="border-t border-slate-800 pt-3 space-y-1.5 text-sm">
                <p className="text-slate-400 flex items-center gap-1.5"><Phone className="w-3.5 h-3.5 text-slate-500" /><span className="text-white">{visitor.mobile}</span></p>
                <p className="text-slate-400 flex items-center gap-1.5"><Users className="w-3.5 h-3.5 text-slate-500" /><span className="text-white">{visitor.personsCount} person{visitor.personsCount > 1 ? "s" : ""}</span></p>
                {visitor.toMeet && (
                    <p className="text-slate-400"><span className="text-slate-500">To meet:</span> <span className="text-emerald-300 font-medium">{visitor.toMeet}</span></p>
                )}
                {visitor.description && (
                    <p className="text-slate-400 flex items-start gap-1.5"><MessageSquareText className="w-3.5 h-3.5 text-slate-500 mt-0.5 shrink-0" /><span className="text-white">{visitor.description}</span></p>
                )}
                {visitor.vehicleNumber && (
                    <p className="text-slate-400 flex items-center gap-1.5"><Car className="w-3.5 h-3.5 text-slate-500" /><span className="text-white">{visitor.vehicleNumber}</span></p>
                )}
                {visitor.idProofType && (
                    <p className="text-slate-400 flex items-center gap-1.5"><IdCard className="w-3.5 h-3.5 text-slate-500" /><span className="text-white">{visitor.idProofType}{visitor.idProofNumber ? ` — ${visitor.idProofNumber}` : ""}</span></p>
                )}
            </div>
        </div>
    );

    // ── VALID: accept or reject ──
    if (status === "VALID") {
        return (
            <div className="space-y-4">
                <div className="flex items-center gap-2 px-4 py-2.5 bg-teal-500/10 border border-teal-500/20 rounded-xl">
                    <CheckCircle2 className="w-4 h-4 text-teal-400 shrink-0" />
                    <span className="text-teal-300 text-sm font-medium">Valid visitor QR — verify details and allow entry</span>
                </div>
                {visitorCard}
                <p className="text-slate-500 text-xs flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" /> Valid until {fmtIST(data.expiresAt)}. Nothing is recorded unless you allow.
                </p>
                <div className="flex gap-2">
                    <button onClick={onCancel} disabled={submitting}
                        className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-sm font-medium transition-all">
                        ✕ Reject
                    </button>
                    <button onClick={allowEntry} disabled={submitting}
                        className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2">
                        {submitting
                            ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            : <><LogIn className="w-4 h-4" /> Allow Entry</>}
                    </button>
                </div>
            </div>
        );
    }

    // ── EXPIRED (never used) ──
    if (status === "EXPIRED") {
        return (
            <div className="space-y-4">
                <div className="flex items-center gap-2 px-4 py-2.5 bg-red-500/10 border border-red-500/20 rounded-xl">
                    <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                    <span className="text-red-300 text-sm font-medium">QR expired — entry not allowed. Ask the visitor to generate a new QR.</span>
                </div>
                {visitorCard}
                <button onClick={onCancel}
                    className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-sm font-medium transition-all">
                    Back to Scanner
                </button>
            </div>
        );
    }

    // ── ENTERED: only exit possible ──
    if (status === "ENTERED" && entry) {
        return (
            <div className="space-y-4">
                <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-500/10 border border-amber-500/20 rounded-xl">
                    <LogIn className="w-4 h-4 text-amber-400 shrink-0" />
                    <span className="text-amber-300 text-sm font-medium">
                        Already entered at {fmtIST(entry.entryAt)}
                        {entry.allowedByName ? ` (allowed by ${entry.allowedByName})` : ""}. Entry cannot be granted again.
                    </span>
                </div>
                {visitorCard}
                <div className="flex gap-2">
                    <button onClick={onCancel} disabled={submitting}
                        className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-sm font-medium transition-all">
                        Back
                    </button>
                    {data.exitTrackingEnabled && (
                        <button onClick={markExit} disabled={submitting}
                            className="flex-1 py-3 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2">
                            {submitting
                                ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                : <><LogOut className="w-4 h-4" /> Mark Exit</>}
                        </button>
                    )}
                </div>
            </div>
        );
    }

    // ── EXITED: fully consumed ──
    return (
        <div className="space-y-4">
            <div className="flex items-start gap-2 px-4 py-2.5 bg-slate-500/10 border border-slate-600/40 rounded-xl">
                <CheckCircle2 className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                <span className="text-slate-300 text-sm">
                    QR already used.
                    {entry && <> Entry {fmtIST(entry.entryAt)} · Exit {entry.exitAt ? fmtIST(entry.exitAt) : "—"}.</>} No further action possible.
                </span>
            </div>
            {visitorCard}
            <button onClick={onDone}
                className="w-full py-3 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-sm font-semibold transition-all">
                📷 Scan Another QR
            </button>
        </div>
    );
}
