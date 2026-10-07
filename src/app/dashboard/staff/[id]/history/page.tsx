"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { API_BASE_URL } from "@/lib/api";
import { authFetch } from "@/lib/auth";
import { useLocale, useTranslations } from "next-intl";
import { INTL_LOCALE } from "@/i18n/config";

export default function TeacherHistoryPage() {
    const t = useTranslations("staff");
    const tc = useTranslations("common");
    const locale = useLocale();
    const params = useParams();
    const id = params?.id as string;
    const [history, setHistory] = useState<{ subjectHistory: any[], classTeacherHistory: any[] }>({ subjectHistory: [], classTeacherHistory: [] });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        if (!id) return;
        const fetchHistory = async () => {
            try {
                const res = await authFetch(`${API_BASE_URL}/staff/${id}/history`);
                if (!res.ok) throw new Error(t("history.fetchFailed"));
                const data = await res.json();
                // Handle legacy response or new object structure
                if (Array.isArray(data)) {
                    setHistory({ subjectHistory: data, classTeacherHistory: [] });
                } else {
                    setHistory(data);
                }
            } catch (err: any) {
                setError(err.message || t("history.loadFailed"));
            } finally {
                setLoading(false);
            }
        };

        fetchHistory();
    }, [id, t]);

    if (loading) return <div className="p-4">{tc("state.loading")}</div>;
    if (error) return <div className="p-4 text-red-600">{error}</div>;

    return (
        <main className="p-4 space-y-8">
            <div className="flex justify-between items-center mb-6">
                <h1 className="font-display text-[22px] sm:text-[26px] font-semibold tracking-[-0.02em] text-ink">{t("history.title")}</h1>
                <Link href="/dashboard/staff" className="text-blue-600 hover:underline">
                    &larr; {t("history.back")}
                </Link>
            </div>

            {/* Subject Assignments */}
            <div>
                <h2 className="text-xl font-bold mb-4 text-slate-700">{t("history.subjectAssignments")}</h2>
                <div className="relative overflow-x-auto shadow-md sm:rounded-lg">
                    <table className="w-full text-sm text-left text-gray-500">
                        <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                            <tr>
                                <th scope="col" className="px-6 py-3">{tc("field.subject")}</th>
                                <th scope="col" className="px-6 py-3">{tc("field.class")}</th>
                                <th scope="col" className="px-6 py-3">{tc("field.section")}</th>
                                <th scope="col" className="px-6 py-3">{tc("field.startDate")}</th>
                                <th scope="col" className="px-6 py-3">{tc("field.endDate")}</th>
                                <th scope="col" className="px-6 py-3">{tc("field.status")}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {history.subjectHistory.length === 0 ? (
                                <tr className="bg-white border-b hover:bg-gray-50">
                                    <td colSpan={6} className="px-6 py-4 text-center">{t("history.noSubjectHistory")}</td>
                                </tr>
                            ) : (
                                history.subjectHistory.map((item: any) => (
                                    <tr key={item.id} className="bg-white border-b hover:bg-gray-50">
                                        <td className="px-6 py-4 font-medium text-gray-900">{item.subject.name}</td>
                                        <td className="px-6 py-4">{item.class.name}</td>
                                        <td className="px-6 py-4">{item.section.name}</td>
                                        <td className="px-6 py-4">{new Date(item.startDate).toLocaleDateString(INTL_LOCALE[locale])}</td>
                                        <td className="px-6 py-4">{item.endDate ? new Date(item.endDate).toLocaleDateString(INTL_LOCALE[locale]) : '-'}</td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-1 font-semibold leading-tight ${item.isActive ? 'text-green-700 bg-green-100' : 'text-gray-700 bg-gray-100'} rounded-full`}>
                                                {item.isActive ? tc('status.active') : t('history.ended')}
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Class Teacher History */}
            <div>
                <h2 className="text-xl font-bold mb-4 text-slate-700">{t("history.classTeacherRoles")}</h2>
                <div className="relative overflow-x-auto shadow-md sm:rounded-lg">
                    <table className="w-full text-sm text-left text-gray-500">
                        <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                            <tr>
                                <th scope="col" className="px-6 py-3">{tc("field.class")}</th>
                                <th scope="col" className="px-6 py-3">{tc("field.startDate")}</th>
                                <th scope="col" className="px-6 py-3">{tc("field.endDate")}</th>
                                <th scope="col" className="px-6 py-3">{tc("field.status")}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {history.classTeacherHistory.length === 0 ? (
                                <tr className="bg-white border-b hover:bg-gray-50">
                                    <td colSpan={4} className="px-6 py-4 text-center">{t("history.noClassTeacherHistory")}</td>
                                </tr>
                            ) : (
                                history.classTeacherHistory.map((item: any) => (
                                    <tr key={item.id} className="bg-white border-b hover:bg-gray-50">
                                        <td className="px-6 py-4 font-medium text-gray-900">{item.class.name}</td>
                                        <td className="px-6 py-4">{new Date(item.startDate).toLocaleDateString(INTL_LOCALE[locale])}</td>
                                        <td className="px-6 py-4">{item.endDate ? new Date(item.endDate).toLocaleDateString(INTL_LOCALE[locale]) : '-'}</td>
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-1 font-semibold leading-tight ${item.isActive ? 'text-green-700 bg-green-100' : 'text-gray-700 bg-gray-100'} rounded-full`}>
                                                {item.isActive ? tc('status.active') : t('history.ended')}
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </main>
    );
}
