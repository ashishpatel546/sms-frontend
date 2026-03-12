"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import useSWR from "swr";
import { fetcher, API_BASE_URL } from "@/lib/api";
import { Loader } from "@/components/ui/Loader";
import { authFetch } from "@/lib/auth";

export default function AddSectionPage() {
    const router = useRouter();
    const { data: classes, error: fetchError, isLoading } = useSWR('/classes', fetcher);
    const [name, setName] = useState("");
    const [classId, setClassId] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError("");

        if (!classId) {
            setError("Please select a class.");
            setLoading(false);
            return;
        }

        try {
            const res = await authFetch(`${API_BASE_URL}/classes/sections`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ name, classId: parseInt(classId) }),
            });

            if (!res.ok) {
                throw new Error("Failed to create section");
            }

            router.push("/dashboard/classes");
            router.refresh();
        } catch (err) {
            setError("Failed to create section. Please try again.");
        } finally {
            setLoading(false);
        }
    };
    if (isLoading) return <Loader fullScreen text="Loading classes..." />;
    if (fetchError) return <div className="p-4 text-red-500">Failed to load classes</div>;

    return (
        <main className="p-4">
            <div className="max-w-2xl mx-auto bg-white p-8 rounded-lg shadow-sm border border-slate-200">
                <h2 className="text-2xl font-bold mb-6 text-slate-800">Add New Section</h2>

                {error && (
                    <div className="p-4 mb-4 text-sm text-red-800 rounded-lg bg-red-50" role="alert">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit}>
                    <div className="mb-6">
                        <label htmlFor="class" className="block mb-2 text-sm font-medium text-gray-900">Select Class</label>
                        <select
                            id="class"
                            value={classId}
                            onChange={(e) => setClassId(e.target.value)}
                            className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5"
                            required
                        >
                            <option value="">Choose a class</option>
                            {classes?.map((cls: any) => (
                                <option key={cls.id} value={cls.id}>
                                    {cls.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="mb-6">
                        <label htmlFor="name" className="block mb-2 text-sm font-medium text-gray-900">Section Name</label>
                        <input
                            type="text"
                            id="name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5"
                            placeholder="Section A"
                            required
                        />
                    </div>

                    <div className="flex items-center space-x-4">
                        <button
                            type="submit"
                            disabled={loading}
                            className="text-white bg-blue-700 hover:bg-blue-800 focus:ring-4 focus:outline-none focus:ring-blue-300 font-medium rounded-lg text-sm w-full sm:w-auto px-5 py-2.5 text-center disabled:opacity-50"
                        >
                            {loading ? 'Creating...' : 'Create Section'}
                        </button>
                        <Link href="/dashboard/classes" className="text-gray-900 bg-white border border-gray-300 focus:outline-none hover:bg-gray-100 focus:ring-4 focus:ring-gray-200 font-medium rounded-lg text-sm px-5 py-2.5">
                            Cancel
                        </Link>
                    </div>
                </form>
            </div>
        </main>
    );
}
