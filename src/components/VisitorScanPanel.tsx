"use client";

import React, { useState, useEffect } from "react";
import { API_BASE_URL } from "@/lib/api";
import { authFetch } from "@/lib/auth";
import toast from "react-hot-toast";
import { useLocale, useTranslations } from "next-intl";
import { INTL_LOCALE } from "@/i18n/config";
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

const fmtISTIn = (intlLocale: string, iso: string) =>
    new Date(iso).toLocaleString(intlLocale, {
        timeZone: "Asia/Kolkata",
        day: "2-digit", month: "short",
        hour: "2-digit", minute: "2-digit", hour12: true,
    });

/**
 * Rendered by the unified scanner when a `V1:`-prefixed visitor QR is
 * decoded. Verifies the stateless token and drives the single-use
 * lifecycle: allow entry (once), mark exit (once), then fully consumed.
 */
const PURPOSES = ["ADMISSION", "OFFICIAL", "INQUIRY", "PTM", "OTHERS"] as const;
const ID_PROOF_TYPES = ["AADHAAR", "DL", "VOTER_ID", "PAN", "OTHER"] as const;

export default function VisitorScanPanel({ token, onDone, onCancel }: VisitorScanPanelProps) {
    const t = useTranslations("visitors");
    const tc = useTranslations("common");
    const locale = useLocale();
    const fmtIST = (iso: string) => fmtISTIn(INTL_LOCALE[locale], iso);
    const [data, setData] = useState<VerifyResponse | null>(null);
    const [error, setError] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [result, setResult] = useState<{ kind: "entry" | "exit"; at: string } | null>(null);

    useEffect(() => {
        (async () => {
            try {
                const res = await authFetch(`${API_BASE_URL}/visitors/verify/${encodeURIComponent(token)}`);
                const body = await res.json();
                if (!res.ok) throw new Error(body.message || t("scan.verifyFailed"));
                setData(body);
            } catch (e: any) {
                setError(e.message || t("scan.verifyFailed"));
            }
        })();
    }, [token, t]);

    const allowEntry = async () => {
        setSubmitting(true);
        try {
            const res = await authFetch(`${API_BASE_URL}/visitors/allow`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token }),
            });
            const body = await res.json();
            if (!res.ok) throw new Error(body.message || t("scan.allowFailed"));
            setResult({ kind: "entry", at: body.entryAt });
        } catch (e: any) {
            toast.error(e.message || t("scan.allowFailed"));
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
            if (!res.ok) throw new Error(body.message || t("scan.markExitFailed"));
            setResult({ kind: "exit", at: body.exitAt });
        } catch (e: any) {
            toast.error(e.message || t("scan.markExitFailed"));
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
                        {result.kind === "entry" ? t("scan.entryAllowed") : t("scan.exitMarked")}
                    </h2>
                    <p className="text-emerald-400 text-sm font-medium">{fmtIST(result.at)}</p>
                </div>
                {data && (
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 w-full text-left space-y-1.5 text-sm">
                        <p className="text-slate-400"><span className="text-slate-500">{t("scan.visitorLabel")}</span> <span className="text-white">{data.visitor.visitorName}</span></p>
                        <p className="text-slate-400"><span className="text-slate-500">{t("scan.mobileLabel")}</span> <span className="text-white">{data.visitor.mobile}</span></p>
                        <p className="text-slate-400"><span className="text-slate-500">{t("scan.personsLabel")}</span> <span className="text-white">{data.visitor.personsCount}</span></p>
                    </div>
                )}
                <button onClick={onDone}
                    className="px-8 py-3 bg-teal-600 hover:bg-teal-500 text-white font-semibold rounded-xl transition-all">
                    📷 {t("scan.scanAnother")}
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
                    <h2 className="text-white font-bold text-xl mb-1">{t("scan.invalidTitle")}</h2>
                    <p className="text-red-400 text-sm">{error}</p>
                </div>
                <button onClick={onCancel}
                    className="px-8 py-3 bg-teal-600 hover:bg-teal-500 text-white font-semibold rounded-xl transition-all">
                    {tc("action.retry")}
                </button>
            </div>
        );
    }
    if (!data) {
        return (
            <div className="flex flex-col items-center gap-4 py-12">
                <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-slate-400 text-sm">{t("scan.verifying")}</p>
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
                    <p className="text-slate-400 text-sm capitalize">{t("scan.purposeVisit", { purpose: (PURPOSES as readonly string[]).includes(visitor.purpose) ? t(`purpose.${visitor.purpose as (typeof PURPOSES)[number]}`) : visitor.purpose.toLowerCase() })}</p>
                </div>
            </div>
            <div className="border-t border-slate-800 pt-3 space-y-1.5 text-sm">
                <p className="text-slate-400 flex items-center gap-1.5"><Phone className="w-3.5 h-3.5 text-slate-500" /><span className="text-white">{visitor.mobile}</span></p>
                <p className="text-slate-400 flex items-center gap-1.5"><Users className="w-3.5 h-3.5 text-slate-500" /><span className="text-white">{t("scan.persons", { count: visitor.personsCount, n: String(visitor.personsCount) })}</span></p>
                {visitor.toMeet && (
                    <p className="text-slate-400"><span className="text-slate-500">{t("scan.toMeetLabel")}</span> <span className="text-emerald-300 font-medium">{visitor.toMeet}</span></p>
                )}
                {visitor.description && (
                    <p className="text-slate-400 flex items-start gap-1.5"><MessageSquareText className="w-3.5 h-3.5 text-slate-500 mt-0.5 shrink-0" /><span className="text-white">{visitor.description}</span></p>
                )}
                {visitor.vehicleNumber && (
                    <p className="text-slate-400 flex items-center gap-1.5"><Car className="w-3.5 h-3.5 text-slate-500" /><span className="text-white">{visitor.vehicleNumber}</span></p>
                )}
                {visitor.idProofType && (
                    <p className="text-slate-400 flex items-center gap-1.5"><IdCard className="w-3.5 h-3.5 text-slate-500" /><span className="text-white">{(ID_PROOF_TYPES as readonly string[]).includes(visitor.idProofType) ? t(`idProof.${visitor.idProofType as (typeof ID_PROOF_TYPES)[number]}`) : visitor.idProofType}{visitor.idProofNumber ? ` — ${visitor.idProofNumber}` : ""}</span></p>
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
                    <span className="text-teal-300 text-sm font-medium">{t("scan.validBanner")}</span>
                </div>
                {visitorCard}
                <p className="text-slate-500 text-xs flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" /> {t("scan.validUntil", { time: fmtIST(data.expiresAt) })}
                </p>
                <div className="flex gap-2">
                    <button onClick={onCancel} disabled={submitting}
                        className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-sm font-medium transition-all">
                        ✕ {tc("action.reject")}
                    </button>
                    <button onClick={allowEntry} disabled={submitting}
                        className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2">
                        {submitting
                            ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            : <><LogIn className="w-4 h-4" /> {t("scan.allowEntry")}</>}
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
                    <span className="text-red-300 text-sm font-medium">{t("scan.expiredBanner")}</span>
                </div>
                {visitorCard}
                <button onClick={onCancel}
                    className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-sm font-medium transition-all">
                    {t("scan.backToScanner")}
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
                        {entry.allowedByName
                            ? t("scan.alreadyEnteredBy", { time: fmtIST(entry.entryAt), name: entry.allowedByName })
                            : t("scan.alreadyEntered", { time: fmtIST(entry.entryAt) })}
                    </span>
                </div>
                {visitorCard}
                <div className="flex gap-2">
                    <button onClick={onCancel} disabled={submitting}
                        className="flex-1 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-sm font-medium transition-all">
                        {tc("action.back")}
                    </button>
                    {data.exitTrackingEnabled && (
                        <button onClick={markExit} disabled={submitting}
                            className="flex-1 py-3 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2">
                            {submitting
                                ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                : <><LogOut className="w-4 h-4" /> {t("scan.markExit")}</>}
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
                    {entry
                        ? t("scan.usedWithTimes", { entry: fmtIST(entry.entryAt), exit: entry.exitAt ? fmtIST(entry.exitAt) : "—" })
                        : t("scan.used")}
                </span>
            </div>
            {visitorCard}
            <button onClick={onDone}
                className="w-full py-3 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-sm font-semibold transition-all">
                📷 {t("scan.scanAnother")}
            </button>
        </div>
    );
}
