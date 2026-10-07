"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { API_BASE_URL } from "@/lib/api";
import { authFetch } from "@/lib/auth";
import { useReadOnlySession, READ_ONLY_TITLE } from '@/lib/support-session';
import { sortByName } from "@/lib/utils";

export default function PromoteStudentPage() {
    const t = useTranslations("students.promote");
    const tc = useTranslations("common");
    const router = useRouter();
    const params = useParams();
    const id = params?.id as string;
    const readOnly = useReadOnlySession();
    const [student, setStudent] = useState<any>(null);
    const [classes, setClasses] = useState<any[]>([]);
    const [selectedClassId, setSelectedClassId] = useState<number | null>(null);
    const [selectedSectionId, setSelectedSectionId] = useState<number | null>(null);

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        if (!id) return;
        const fetchData = async () => {
            try {
                // Fetch Student
                const resStudent = await authFetch(`${API_BASE_URL}/students/${id}`);

                if (!resStudent.ok) throw new Error(t("fetchFailed"));

                const foundStudent = await resStudent.json();

                // Fetch Classes (which should include sections)
                const resClasses = await authFetch(`${API_BASE_URL}/classes`);
                const classesData = await resClasses.json();

                if (foundStudent) {
                    setStudent(foundStudent);
                    // Pre-select current values if needed, or leave blank to force choice
                } else {
                    setError(t("notFound"));
                }
                setClasses(sortByName(classesData));
            } catch (_err) {
                setError(t("loadFailed"));
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [id, t]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (readOnly) return;

        if (!selectedClassId || !selectedSectionId) {
            setError(t("selectBoth"));
            return;
        }

        if (student && student.class?.id === selectedClassId && student.section?.id === selectedSectionId) {
            setError(t("sameClass"));
            return;
        }

        setSaving(true);
        setError("");

        try {
            const res = await authFetch(`${API_BASE_URL}/students/${id}/promote`, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    classId: selectedClassId,
                    sectionId: selectedSectionId
                }),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.message || t("failed"));
            }

            router.push("/dashboard/students");
            router.refresh();
        } catch (err: any) {
            console.error(err);
            setError(err.message || t("failedRetry"));
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="p-4">{tc("state.loading")}</div>;
    if (error && !student) return <div className="p-4 text-red-600">{error}</div>; // Show error if load failed
    if (!student) return <div className="p-4">{t("notFound")}</div>;

    const sections = classes.find(c => c.id === selectedClassId)?.sections || [];

    return (
        <main className="p-4">
            <div className="max-w-2xl mx-auto bg-white p-8 rounded-lg shadow-sm border border-slate-200">
                <h2 className="text-2xl font-bold mb-6 text-slate-800">{t("title")}</h2>

                {error && student && (
                    <div className="p-4 mb-4 text-sm text-red-800 rounded-lg bg-red-50" role="alert">
                        {error}
                    </div>
                )}

                <div className="mb-6 bg-slate-50 p-4 rounded text-sm text-slate-700 space-y-2">
                    <p><strong>{t("nameLabel")}</strong> {student.firstName} {student.lastName}</p>
                    <p><strong>{t("emailLabel")}</strong> {student.email}</p>
                    <p><strong>{t("currentClass")}</strong> {student.class ? student.class.name : t("na")}</p>
                    <p><strong>{t("currentSection")}</strong> {student.section ? student.section.name : t("na")}</p>
                    <p><strong>{t("statusLabel")}</strong> {student.isActive ? tc("status.active") : tc("status.inactive")}</p>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="mb-6">
                        <label htmlFor="class" className="block mb-2 text-sm font-medium text-gray-900">{t("newClass")}</label>
                        <select
                            id="class"
                            className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-brand/40 focus:border-brand block w-full p-2.5"
                            value={selectedClassId || ""}
                            onChange={(e) => {
                                setSelectedClassId(parseInt(e.target.value));
                                setSelectedSectionId(null); // Reset section when class changes
                            }}
                            required
                        >
                            <option value="">{t("selectClass")}</option>
                            {classes.map((cls) => (
                                <option key={cls.id} value={cls.id}>{cls.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="mb-6">
                        <label htmlFor="section" className="block mb-2 text-sm font-medium text-gray-900">{t("newSection")}</label>
                        <select
                            id="section"
                            className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-brand/40 focus:border-brand block w-full p-2.5"
                            value={selectedSectionId || ""}
                            onChange={(e) => setSelectedSectionId(parseInt(e.target.value))}
                            required
                            disabled={!selectedClassId}
                        >
                            <option value="">{t("selectSection")}</option>
                            {sections.map((sec: any) => (
                                <option key={sec.id} value={sec.id}>{sec.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="flex items-center space-x-4">
                        <button
                            type="submit"
                            disabled={saving || readOnly}
                            title={readOnly ? READ_ONLY_TITLE : undefined}
                            className="text-white bg-amber-600 hover:bg-amber-700 focus:ring-4 focus:outline-none focus:ring-amber-300 font-medium rounded-lg text-sm w-full sm:w-auto px-5 py-2.5 text-center disabled:opacity-50"
                        >
                            {saving ? t("promoting") : t("title")}
                        </button>
                        <Link href="/dashboard/students" className="text-gray-900 bg-white border border-gray-300 focus:outline-none hover:bg-gray-100 focus:ring-4 focus:ring-line-strong font-medium rounded-lg text-sm px-5 py-2.5">
                            {tc("action.cancel")}
                        </Link>
                    </div>
                </form>
            </div>
        </main>
    );
}
