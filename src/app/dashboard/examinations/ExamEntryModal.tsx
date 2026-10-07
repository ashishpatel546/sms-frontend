"use client";

import { useState, useEffect } from "react";
import useSWR from "swr";
import { API_BASE_URL, fetcher } from "@/lib/api";
import { authFetch } from "@/lib/auth";
import { toast } from "react-hot-toast";
import { useReadOnlySession, READ_ONLY_TITLE } from '@/lib/support-session';
import { useLocale, useTranslations } from "next-intl";
import { INTL_LOCALE, type Locale } from "@/i18n/config";

interface ExamEntryModalProps {
    scheduleId: number;
    classId: number;
    className: string;
    date: string;
    existingEntry: any | null;
    isHoliday: boolean;
    holidayName?: string;
    isSunday: boolean;
    onClose: () => void;
    onSaved: () => void;
}

export default function ExamEntryModal({
    scheduleId, classId, className, date,
    existingEntry, isHoliday, holidayName, isSunday,
    onClose, onSaved
}: ExamEntryModalProps) {
    const { data: subjects } = useSWR(`${API_BASE_URL}/subjects`, fetcher);
    const readOnly = useReadOnlySession();
    const t = useTranslations("exams");
    const tc = useTranslations("common");
    const intlLocale = INTL_LOCALE[useLocale() as Locale];

    const isRestrictedDay = isHoliday || isSunday;

    const [useCustomName, setUseCustomName] = useState(false);
    const [subjectId, setSubjectId] = useState(existingEntry?.subject?.id?.toString() ?? "");
    const [subjectName, setSubjectName] = useState(existingEntry?.subjectName ?? "");
    const [startTime, setStartTime] = useState(() => existingEntry?.startTime ?? localStorage.getItem("examPrefStartTime") ?? "");
    const [endTime, setEndTime] = useState(() => existingEntry?.endTime ?? localStorage.getItem("examPrefEndTime") ?? "");
    const [notes, setNotes] = useState(existingEntry?.notes ?? "");
    const [saveTimePreference, setSaveTimePreference] = useState(!existingEntry);
    const [loading, setLoading] = useState(false);
    const [deleteLoading, setDeleteLoading] = useState(false);

    // If existing entry has a custom subject name (not a subject relation), toggle custom
    useEffect(() => {
        if (existingEntry && existingEntry.subjectName && !existingEntry.subject) {
            setUseCustomName(true);
        }
    }, [existingEntry]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (readOnly) return;

        setLoading(true);
        try {
            const body: any = { date, classId, startTime, endTime, notes };

            if (useCustomName) {
                if (!subjectName.trim()) { toast.error(t("entry.enterSubjectName")); setLoading(false); return; }
                body.subjectName = subjectName;
            } else {
                if (!subjectId) { toast.error(t("entry.selectSubjectToast")); setLoading(false); return; }
                body.subjectId = parseInt(subjectId);
            }

            // If editing, DELETE then recreate (simpler than PATCH since key fields change)
            if (existingEntry) {
                const delRes = await authFetch(`${API_BASE_URL}/exam-schedules/${scheduleId}/entries/${existingEntry.id}`, { method: "DELETE" });
                if (!delRes.ok) { toast.error(t("entry.updateFailed")); setLoading(false); return; }
            }

            const res = await authFetch(`${API_BASE_URL}/exam-schedules/${scheduleId}/entries`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });

            if (res.ok) {
                toast.success(existingEntry ? t("entry.updated") : t("entry.added"));
                if (saveTimePreference) {
                    localStorage.setItem("examPrefStartTime", startTime);
                    localStorage.setItem("examPrefEndTime", endTime);
                }
                onSaved();
            } else {
                const STATUS_MESSAGES: Record<number, string> = {
                    400: t("entry.error400"),
                    409: t("entry.error409"),
                    403: t("entry.error403"),
                    404: t("entry.error404"),
                    500: t("entry.error500"),
                };
                let errorMessage = STATUS_MESSAGES[res.status] ?? t("entry.saveFailed");
                try {
                    const text = await res.text();
                    if (text) {
                        const err = JSON.parse(text);
                        // NestJS can return message as a string, array, or nested object
                        if (typeof err.message === "string" && err.message) {
                            errorMessage = err.message;
                        } else if (Array.isArray(err.message) && err.message.length) {
                            errorMessage = err.message.join(", ");
                        } else if (typeof err.message === "object" && err.message?.message) {
                            errorMessage = err.message.message;
                        } else if (typeof err.error === "string" && err.error) {
                            errorMessage = err.error;
                        }
                    }
                } catch {
                    // body was not JSON — use the status-based message above
                }
                toast.error(errorMessage);
            }
        } catch (error: any) {
            toast.error(error?.message || t("shared.networkError"));
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!existingEntry) return;
        if (!confirm(t("entry.confirmDelete"))) return;
        setDeleteLoading(true);
        try {
            const res = await authFetch(`${API_BASE_URL}/exam-schedules/${scheduleId}/entries/${existingEntry.id}`, { method: "DELETE" });
            if (res.ok) { toast.success(t("entry.deleted")); onSaved(); }
            else toast.error(t("entry.deleteFailed"));
        } catch {
            toast.error(tc("state.error"));
        } finally {
            setDeleteLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-walnut-950/55 backdrop-blur-sm">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
                <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center bg-gray-50 shrink-0">
                    <div>
                        <h3 className="text-lg font-semibold text-gray-800">{existingEntry ? t("entry.editTitle") : t("entry.addTitle")}</h3>
                        <p className="text-sm text-gray-500">
                            <span className="font-medium text-slate-700">{className}</span>
                            {" · "}
                            {new Date(date + "T00:00:00").toLocaleDateString(intlLocale, { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
                        </p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                <div className="p-6 overflow-y-auto flex-1">
                    {/* Holiday / Sunday warning — scheduling blocked */}
                    {isRestrictedDay && (
                        <div className="mb-5 bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
                            <div className="flex items-start gap-2">
                                <svg className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                <div>
                                    <p className="font-semibold">
                                        {isSunday ? t("entry.sundayWarning") : t("entry.holidayWarning", { name: holidayName ?? "" })}
                                    </p>
                                    <p className="mt-1 text-amber-700">{t("entry.blockedDay")}</p>
                                </div>
                            </div>
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <label className="block text-sm font-medium text-gray-700">{tc("field.subject")}</label>
                                <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                                    <input type="checkbox" checked={useCustomName} onChange={e => setUseCustomName(e.target.checked)} className="rounded border-gray-300 text-blue-600 focus:ring-brand/40" />
                                    {t("entry.useCustomName")}
                                </label>
                            </div>
                            {useCustomName ? (
                                <input type="text" required value={subjectName} onChange={e => setSubjectName(e.target.value)} placeholder={t("entry.subjectNamePlaceholder")} className="w-full p-2 border border-gray-300 rounded-md focus:ring-brand/40 focus:border-brand text-sm" />
                            ) : (
                                <select required value={subjectId} onChange={e => setSubjectId(e.target.value)} className="w-full p-2 border border-gray-300 rounded-md focus:ring-brand/40 focus:border-brand text-sm">
                                    <option value="">{t("shared.selectSubject")}</option>
                                    {subjects?.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                                </select>
                            )}
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">{t("entry.startTime")}</label>
                                <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className="w-full p-2 border border-gray-300 rounded-md focus:ring-brand/40 focus:border-brand text-sm" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">{t("entry.endTime")}</label>
                                <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} className="w-full p-2 border border-gray-300 rounded-md focus:ring-brand/40 focus:border-brand text-sm" />
                            </div>
                        </div>

                        {!existingEntry && (
                            <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                                <input type="checkbox" checked={saveTimePreference} onChange={e => setSaveTimePreference(e.target.checked)} className="rounded border-gray-300 text-blue-600 focus:ring-brand/40" />
                                {t("entry.saveTimes")}
                            </label>
                        )}

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">{t("entry.notesOptional")}</label>
                            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className="w-full p-2 border border-gray-300 rounded-md focus:ring-brand/40 focus:border-brand text-sm" placeholder={t("entry.notesPlaceholder")} />
                        </div>

                        <div className="flex justify-between items-center pt-4 border-t border-gray-200">
                            {existingEntry ? (
                                <button type="button" onClick={handleDelete} disabled={deleteLoading || readOnly} title={readOnly ? READ_ONLY_TITLE : undefined} className="px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-md border border-red-200 transition-colors disabled:opacity-50">
                                    {deleteLoading ? t("entry.deleting") : t("entry.deleteEntry")}
                                </button>
                            ) : (
                                <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50">
                                    {tc("action.cancel")}
                                </button>
                            )}
                            <button type="submit" disabled={loading || isRestrictedDay || readOnly} title={readOnly ? READ_ONLY_TITLE : undefined} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2">
                                {loading ? tc("action.saving") : (existingEntry ? t("entry.updateEntry") : t("entry.addEntry"))}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}

