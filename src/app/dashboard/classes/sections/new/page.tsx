"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { API_BASE_URL } from "@/lib/api";
import { authFetch } from "@/lib/auth";
import toast from "react-hot-toast";
import { useTranslations } from "next-intl";

export default function AddSectionPage() {
    const router = useRouter();
    const t = useTranslations("classes");
    const tc = useTranslations("common");
    const [name, setName] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError("");

        try {
            const res = await authFetch(`${API_BASE_URL}/classes/sections`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: name.trim() }),
            });

            if (!res.ok) {
                const errBody = await res.json().catch(() => ({}));
                throw new Error(errBody?.message ?? t("sectionForm.createFailed"));
            }

            toast.success(t("sectionForm.created", { name }));
            router.push("/dashboard/classes");
            router.refresh();
        } catch (err: any) {
            setError(err.message ?? t("sectionForm.createFailedRetry"));
        } finally {
            setLoading(false);
        }
    };

    return (
        <main className="p-4">
            <div className="max-w-2xl mx-auto bg-white p-8 rounded-lg shadow-sm border border-slate-200">
                <h2 className="text-2xl font-bold mb-2 text-slate-800">{t("sectionForm.title")}</h2>
                <p className="text-sm text-slate-500 mb-6">
                    {t("sectionForm.description")}
                </p>

                {error && (
                    <div className="p-4 mb-4 text-sm text-red-800 rounded-lg bg-red-50" role="alert">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit}>
                    <div className="mb-6">
                        <label htmlFor="name" className="block mb-2 text-sm font-medium text-gray-900">{t("sectionForm.name")}</label>
                        <input
                            type="text"
                            id="name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-brand/40 focus:border-brand block w-full p-2.5"
                            placeholder={t("list.sectionPlaceholder")}
                            required
                        />
                        <p className="mt-1 text-xs text-gray-500">{t("sectionForm.uniqueHint")}</p>
                    </div>

                    <div className="flex items-center space-x-4">
                        <button
                            type="submit"
                            disabled={loading}
                            className="text-white bg-blue-700 hover:bg-blue-800 focus:ring-4 focus:outline-none focus:ring-brand/40 font-medium rounded-lg text-sm w-full sm:w-auto px-5 py-2.5 text-center disabled:opacity-50"
                        >
                            {loading ? t("form.creating") : t("sectionForm.create")}
                        </button>
                        <Link href="/dashboard/classes" className="text-gray-900 bg-white border border-gray-300 focus:outline-none hover:bg-gray-100 focus:ring-4 focus:ring-line-strong font-medium rounded-lg text-sm px-5 py-2.5">
                            {tc("action.cancel")}
                        </Link>
                    </div>
                </form>
            </div>
        </main>
    );
}

