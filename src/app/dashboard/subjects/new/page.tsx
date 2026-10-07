"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import useSWR from "swr";
import { fetcher, API_BASE_URL } from "@/lib/api";
import toast from "react-hot-toast";
import { useRbac } from "@/lib/rbac";
import { authFetch } from "@/lib/auth";
import { useReadOnlySession, READ_ONLY_TITLE } from "@/lib/support-session";
import { useTranslations } from "next-intl";

export default function AddSubjectPage() {
    const readOnly = useReadOnlySession();
    const router = useRouter();
    const rbac = useRbac();
    const t = useTranslations("subjects");
    const tc = useTranslations("common");

    // Route guard — only SUB_ADMIN and above can add subjects
    useEffect(() => {
        if (!rbac.canManageSubjects) {
            toast.error(t("form.noPermission"));
            router.replace('/dashboard/subjects');
        }
    }, [rbac.canManageSubjects, router, t]);

    const [name, setName] = useState("");
    const [subjectCategory, setSubjectCategory] = useState("BASE");
    const [hasTheory, setHasTheory] = useState(true);
    const [hasPractical, setHasPractical] = useState(false);
    const [feeCategoryId, setFeeCategoryId] = useState("");
    const { data: feeCategories = [] } = useSWR('/fees/categories', fetcher);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError("");

        try {
            const res = await authFetch(`${API_BASE_URL}/subjects`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    name,
                    subjectCategory,
                    hasTheory,
                    hasPractical,
                    feeCategoryId: feeCategoryId ? parseInt(feeCategoryId) : undefined
                }),
            });

            if (!res.ok) {
                throw new Error("Failed to create subject");
            }

            router.push("/dashboard/subjects");
            router.refresh();
        } catch {
            setError(t("form.createFailed"));
        } finally {
            setLoading(false);
        }
    };

    return (
        <main className="p-4">
            <div className="max-w-2xl mx-auto bg-white p-8 rounded-lg shadow-sm border border-slate-200">
                <h2 className="text-2xl font-bold mb-6 text-slate-800">{t("form.addTitle")}</h2>

                {error && (
                    <div className="p-4 mb-4 text-sm text-red-800 rounded-lg bg-red-50" role="alert">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit}>
                    <div className="mb-6">
                        <label htmlFor="name" className="block mb-2 text-sm font-medium text-gray-900">{t("form.name")}</label>
                        <input
                            type="text"
                            id="name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-brand/40 focus:border-brand block w-full p-2.5"
                            placeholder={t("form.namePlaceholder")}
                            required
                        />
                    </div>

                    <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block mb-2 text-sm font-medium text-gray-900">{t("form.category")}</label>
                            <select
                                value={subjectCategory}
                                onChange={(e) => setSubjectCategory(e.target.value)}
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
                                value={feeCategoryId}
                                onChange={(e) => setFeeCategoryId(e.target.value)}
                                className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-brand/40 focus:border-brand block w-full p-2.5"
                            >
                                <option value="">{t("form.feeNone")}</option>
                                {feeCategories.map((c: any) => (
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
                                checked={hasTheory}
                                onChange={(e) => setHasTheory(e.target.checked)}
                                className="w-4 h-4 text-blue-600 bg-white border-gray-300 rounded focus:ring-brand/40"
                            />
                            <label htmlFor="hasTheory" className="text-sm font-medium text-gray-900">{t("form.hasTheory")}</label>
                        </div>
                        <div className="flex items-center space-x-2">
                            <input
                                type="checkbox"
                                id="hasPractical"
                                checked={hasPractical}
                                onChange={(e) => setHasPractical(e.target.checked)}
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
                            disabled={loading || readOnly}
                            title={readOnly ? READ_ONLY_TITLE : undefined}
                            className="text-white bg-blue-700 hover:bg-blue-800 focus:ring-4 focus:outline-none focus:ring-brand/40 font-medium rounded-lg text-sm w-full sm:w-auto px-5 py-2.5 text-center disabled:opacity-50"
                        >
                            {loading ? t("form.creating") : t("form.create")}
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
