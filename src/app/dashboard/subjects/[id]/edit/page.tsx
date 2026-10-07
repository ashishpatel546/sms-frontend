"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { API_BASE_URL, fetcher } from "@/lib/api";
import { authFetch } from "@/lib/auth";
import { useReadOnlySession, READ_ONLY_TITLE } from "@/lib/support-session";
import { useTranslations } from "next-intl";

export default function EditSubjectPage() {
    const readOnly = useReadOnlySession();
    const router = useRouter();
    const t = useTranslations("subjects");
    const tc = useTranslations("common");
    const params = useParams();
    const id = params?.id as string;
    const [formData, setFormData] = useState({
        name: "",
        subjectCategory: "BASE",
        hasTheory: true,
        hasPractical: false,
        feeCategoryId: ""
    });
    const [feeCategories, setFeeCategories] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        // Fetch fee categories
        fetcher(`${API_BASE_URL}/fees/categories`)
            .then(data => setFeeCategories(Array.isArray(data) ? data : []))
            .catch(err => console.error("Failed to fetch fee categories", err));

        if (!id) return;
        const fetchSubject = async () => {
            try {
                const res = await authFetch(`${API_BASE_URL}/subjects`); // Ideally fetch single subject
                if (!res.ok) throw new Error("Failed to fetch subjects");
                const subjects = await res.json();
                const subject = subjects.find((s: any) => s.id === parseInt(id));

                if (subject) {
                    setFormData({
                        name: subject.name,
                        subjectCategory: subject.subjectCategory || "BASE",
                        hasTheory: subject.hasTheory !== undefined ? subject.hasTheory : true,
                        hasPractical: subject.hasPractical || false,
                        feeCategoryId: subject.feeCategory ? subject.feeCategory.id.toString() : ""
                    });
                } else {
                    setError(t("form.notFound"));
                }
            } catch (_err) {
                setError(t("form.loadFailed"));
            } finally {
                setLoading(false);
            }
        };

        fetchSubject();
    }, [id, t]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const value = e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value;
        setFormData({ ...formData, [e.target.name]: value });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setError("");
        try {
            const payload: any = {
                name: formData.name,
                subjectCategory: formData.subjectCategory,
                hasTheory: formData.hasTheory,
                hasPractical: formData.hasPractical
            };
            if (formData.feeCategoryId) {
                payload.feeCategoryId = parseInt(formData.feeCategoryId);
            } else {
                payload.feeCategoryId = null;
            }

            const res = await authFetch(`${API_BASE_URL}/subjects/${id}`, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(payload),
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.message || "Failed to update subject");
            }

            router.push("/dashboard/subjects");
            router.refresh();
        } catch (err) {
            console.error(err);
            setError(t("form.updateFailed"));
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="p-4">{tc("state.loading")}</div>;
    if (error) return <div className="p-4 text-red-600">{error}</div>;

    return (
        <main className="p-4">
            <div className="max-w-2xl mx-auto bg-white p-8 rounded-lg shadow-sm border border-slate-200">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold text-slate-800">{t("form.editTitle")}</h2>
                    <Link href="/dashboard/subjects" className="text-blue-600 hover:underline">
                        {t("form.back")}
                    </Link>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="mb-6">
                        <label htmlFor="name" className="block mb-2 text-sm font-medium text-gray-900">{t("form.name")}</label>
                        <input
                            type="text"
                            id="name"
                            name="name"
                            value={formData.name}
                            onChange={handleChange}
                            className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-brand/40 focus:border-brand block w-full p-2.5"
                            required
                        />
                    </div>

                    <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block mb-2 text-sm font-medium text-gray-900">{t("form.category")}</label>
                            <select
                                name="subjectCategory"
                                value={formData.subjectCategory}
                                onChange={handleChange}
                                className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-brand/40 focus:border-brand block w-full p-2.5"
                            >
                                <option value="BASE">{t("category.BASE")}</option>
                                <option value="OPTIONAL">{t("category.OPTIONAL")}</option>
                                <option value="VOCATIONAL">{t("category.VOCATIONAL")}</option>
                                <option value="ACTIVITY">{t("category.ACTIVITY")}</option>
                            </select>
                        </div>

                        <div>
                            <label className="block mb-2 text-sm font-medium text-gray-900">{t("form.feeCategory")}</label>
                            <select
                                name="feeCategoryId"
                                value={formData.feeCategoryId}
                                onChange={handleChange}
                                className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-brand/40 focus:border-brand block w-full p-2.5"
                            >
                                <option value="">{t("form.feeNone")}</option>
                                {feeCategories.map(c => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>
                            <p className="mt-1 text-xs text-gray-500">{t("form.feeHint")}</p>
                        </div>
                    </div>

                    <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-6 bg-gray-50 p-4 rounded-lg border border-gray-200">
                        <div className="flex items-center space-x-2">
                            <input
                                type="checkbox"
                                id="hasTheory"
                                name="hasTheory"
                                checked={formData.hasTheory}
                                onChange={handleChange}
                                className="w-4 h-4 text-blue-600 bg-white border-gray-300 rounded focus:ring-brand/40"
                            />
                            <label htmlFor="hasTheory" className="text-sm font-medium text-gray-900">{t("form.hasTheory")}</label>
                        </div>
                        <div className="flex items-center space-x-2">
                            <input
                                type="checkbox"
                                id="hasPractical"
                                name="hasPractical"
                                checked={formData.hasPractical}
                                onChange={handleChange}
                                className="w-4 h-4 text-blue-600 bg-white border-gray-300 rounded focus:ring-brand/40"
                            />
                            <label htmlFor="hasPractical" className="text-sm font-medium text-gray-900">{t("form.hasPractical")}</label>
                        </div>
                        <div className="col-span-1 md:col-span-2">
                            <p className="text-xs text-gray-500">{t("form.bothHint")}</p>
                        </div>
                    </div>

                    <div className="flex items-center space-x-4">
                        <button
                            type="submit"
                            disabled={saving || readOnly}
                            title={readOnly ? READ_ONLY_TITLE : undefined}
                            className="text-white bg-blue-700 hover:bg-blue-800 focus:ring-4 focus:outline-none focus:ring-brand/40 font-medium rounded-lg text-sm w-full sm:w-auto px-5 py-2.5 text-center disabled:opacity-50"
                        >
                            {saving ? tc("action.saving") : t("form.saveChanges")}
                        </button>
                        <Link href="/dashboard/subjects" className="text-gray-900 bg-white border border-gray-300 focus:outline-none hover:bg-gray-100 focus:ring-4 focus:ring-line-strong font-medium rounded-lg text-sm px-5 py-2.5">
                            {tc("action.cancel")}
                        </Link>
                    </div>
                </form>
            </div>
        </main>
    );
}
