"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import QRCode from "react-qr-code";
import toast, { Toaster } from "react-hot-toast";
import { API_BASE_URL, fetcher } from "@/lib/api";
import { getSchoolLogoDataUrl } from "@/lib/useSchoolInfo";
import { useRbac } from "@/lib/rbac";
import useSWR from "swr";
import { ArrowLeft, Download, Printer, RefreshCw } from "lucide-react";

/**
 * Printable poster with the public visitor-form QR. The QR encodes the
 * school's public /visit URL — scanning opens the form in the browser
 * (or the installed PWA, since /visit is inside the PWA scope).
 */
export default function VisitorQrPosterPage() {
    const router = useRouter();
    const rbac = useRbac();
    const posterRef = useRef<HTMLDivElement>(null);
    const [visitUrl, setVisitUrl] = useState("");
    const [downloading, setDownloading] = useState(false);
    // Base64 logo for the poster: html-to-image / print need a data URL — a
    // cross-origin S3 image would taint the canvas. Fetched lazily via the
    // API's /school/logo proxy (no longer part of /school/info).
    const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null);

    const { data: school } = useSWR(`${API_BASE_URL}/school/info`, fetcher);

    useEffect(() => {
        if (!rbac.isAdmin) router.replace("/dashboard");
        setVisitUrl(`${window.location.origin}/visit`);
        void getSchoolLogoDataUrl().then(setLogoDataUrl);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const downloadPng = async () => {
        if (!posterRef.current) return;
        setDownloading(true);
        try {
            const { toPng } = await import("html-to-image");
            const dataUrl = await toPng(posterRef.current, { pixelRatio: 3, backgroundColor: "#ffffff" });
            const a = document.createElement("a");
            a.href = dataUrl;
            a.download = "visitor-entry-qr.png";
            a.click();
        } catch {
            toast.error("Failed to generate image");
        } finally {
            setDownloading(false);
        }
    };

    return (
        <div className="p-4 sm:p-6 max-w-2xl mx-auto space-y-4">
            <Toaster position="top-center" />

            {/* Toolbar — hidden when printing */}
            <div className="flex items-center justify-between gap-2 print:hidden">
                <Link href="/dashboard/visitors" className="flex items-center gap-1.5 text-ink-muted hover:text-ink text-sm">
                    <ArrowLeft className="w-4 h-4" /> Visitors
                </Link>
                <div className="flex gap-2">
                    <button onClick={downloadPng} disabled={downloading || !visitUrl}
                        className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-300 dark:border-white/10 text-ink text-sm hover:bg-surface-secondary disabled:opacity-50">
                        {downloading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} Download PNG
                    </button>
                    <button onClick={() => window.print()} disabled={!visitUrl}
                        className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-sm disabled:opacity-50">
                        <Printer className="w-4 h-4" /> Print
                    </button>
                </div>
            </div>

            {/* Poster — white background always, so print/PNG look identical */}
            <div ref={posterRef} data-poster className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-10 text-center print:border-0 print:rounded-none">
                {logoDataUrl || school?.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={logoDataUrl || school.logoUrl} alt="School logo" className="w-20 h-20 mx-auto object-contain mb-3" />
                ) : null}
                <h1 className="font-display text-[22px] sm:text-[26px] font-semibold tracking-[-0.02em] text-ink">{school?.name || "Our School"}</h1>
                <p className="text-slate-500 text-sm mt-1 mb-6">Visitor Entry Registration</p>

                <div className="inline-block bg-white p-3 sm:p-4 rounded-2xl border-4 border-slate-900 max-w-full">
                    {visitUrl && (
                        <QRCode
                            value={visitUrl}
                            size={260}
                            style={{ width: "100%", maxWidth: 260, height: "auto" }}
                        />
                    )}
                </div>

                <div className="mt-6 space-y-1.5">
                    <p className="text-slate-900 font-bold text-lg">Scan to register your visit</p>
                    <ol className="text-slate-600 text-sm text-left max-w-sm mx-auto space-y-1 list-decimal list-inside">
                        <li>Scan this QR with your phone camera</li>
                        <li>Fill the short visitor form</li>
                        <li>Show the generated QR to security at the gate</li>
                    </ol>
                    <p className="text-slate-400 text-xs pt-3 break-all">{visitUrl}</p>
                </div>
            </div>

            <style jsx global>{`
                @media print {
                    body * { visibility: hidden; }
                    [data-poster], [data-poster] * { visibility: visible; }
                    [data-poster] { position: absolute; left: 0; top: 0; width: 100%; }
                }
            `}</style>
        </div>
    );
}
