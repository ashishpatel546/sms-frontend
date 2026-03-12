"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { API_BASE_URL } from "@/lib/api";
import { Loader } from "@/components/ui/Loader";
import toast from "react-hot-toast";
import { useRbac } from "@/lib/rbac";
import { authFetch } from "@/lib/auth";

export default function AddClassPage() {
    const router = useRouter();
    const rbac = useRbac();

    // Route guard — only ADMIN and above can create classes
    useEffect(() => {
        if (!rbac.canManageClasses) {
            toast.error("You don't have permission to create classes.");
            router.replace('/dashboard/classes');
        }
    }, [rbac.canManageClasses, router]);

    const [name, setName] = useState("");
    const [teachers, setTeachers] = useState<any[]>([]);
    const [fetchError, setFetchError] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [sections, setSections] = useState<{ name: string; teacherId: string }[]>([
        { name: "A", teacherId: "" } // Default first section
    ]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        authFetch(`${API_BASE_URL}/staff?staffCategory=Teaching+Staff`)
            .then(res => {
                if (!res.ok) throw new Error();
                return res.json();
            })
            .then(data => {
                // flattenUser returns firstName/lastName directly on each record
                setTeachers(Array.isArray(data) ? data : data.data ?? []);
            })
            .catch(() => setFetchError(true))
            .finally(() => setIsLoading(false));
    }, []);

    const handleSectionChange = (index: number, field: 'name' | 'teacherId', value: string) => {
        const newSections = [...sections];
        newSections[index] = { ...newSections[index], [field]: value };
        setSections(newSections);
    };

    const addSection = () => {
        // Auto-increment section name logic (A -> B -> C...)
        const lastSectionName = sections.length > 0 ? sections[sections.length - 1].name : "";
        let nextName = "A";
        if (lastSectionName && lastSectionName.length === 1) {
            const nextCharCode = lastSectionName.charCodeAt(0) + 1;
            if (nextCharCode <= 90) { // Z
                nextName = String.fromCharCode(nextCharCode);
            }
        }

        setSections([...sections, { name: nextName, teacherId: "" }]);
    };

    const removeSection = (index: number) => {
        setSections(sections.filter((_, i) => i !== index));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError("");

        try {
            const payload = {
                name,
                sections: sections.map(s => ({
                    name: s.name,
                    staffId: s.teacherId ? parseInt(s.teacherId) : undefined
                }))
            };

            const res = await authFetch(`${API_BASE_URL}/classes`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(payload),
            });

            if (!res.ok) {
                throw new Error("Failed to create class");
            }

            router.push("/dashboard/classes");
            router.refresh();
        } catch (err) {
            setError("Failed to create class. Please try again.");
        } finally {
            setLoading(false);
        }
    };
    if (isLoading) return <Loader fullScreen text="Loading teachers..." />;
    if (fetchError) return <div className="p-4 text-red-500">Failed to load teachers</div>;

    return (
        <main className="p-4">
            <div className="max-w-4xl mx-auto bg-white p-8 rounded-lg shadow-sm border border-slate-200">
                <h2 className="text-2xl font-bold mb-6 text-slate-800">Add New Class</h2>

                {error && (
                    <div className="p-4 mb-4 text-sm text-red-800 rounded-lg bg-red-50" role="alert">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit}>
                    <div className="mb-6">
                        <label htmlFor="name" className="block mb-2 text-sm font-medium text-gray-900">Class Name</label>
                        <input
                            type="text"
                            id="name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5"
                            placeholder="Class 10"
                            required
                        />
                    </div>

                    <div className="mb-6">
                        <div className="flex justify-between items-center mb-2">
                            <label className="block text-sm font-medium text-gray-900">Sections</label>
                            <button
                                type="button"
                                onClick={addSection}
                                className="text-xs text-blue-700 hover:underline font-medium"
                            >
                                + Add Section
                            </button>
                        </div>

                        <div className="space-y-3">
                            {sections.map((section, index) => (
                                <div key={index} className="flex gap-4 items-end bg-gray-50 p-4 rounded-lg border border-gray-200">
                                    <div className="w-1/4">
                                        <label className="block mb-1 text-xs text-gray-500">Section Name</label>
                                        <input
                                            type="text"
                                            value={section.name}
                                            onChange={(e) => handleSectionChange(index, 'name', e.target.value)}
                                            className="bg-white border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5"
                                            placeholder="A"
                                            required
                                        />
                                    </div>
                                    <div className="flex-1">
                                        <label className="block mb-1 text-xs text-gray-500">Class Teacher</label>
                                        <select
                                            value={section.teacherId}
                                            onChange={(e) => handleSectionChange(index, 'teacherId', e.target.value)}
                                            className="bg-white border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5"
                                        >
                                            <option value="">Select Teacher</option>
                                            {teachers.map((t: any) => (
                                                <option key={t.id} value={t.id}>
                                                    {t.firstName} {t.lastName}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    {sections.length > 1 && (
                                        <button
                                            type="button"
                                            onClick={() => removeSection(index)}
                                            className="text-red-500 hover:text-red-700 p-2.5"
                                            title="Remove Section"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                                            </svg>
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="flex items-center space-x-4">
                        <button
                            type="submit"
                            disabled={loading}
                            className="text-white bg-blue-700 hover:bg-blue-800 focus:ring-4 focus:outline-none focus:ring-blue-300 font-medium rounded-lg text-sm w-full sm:w-auto px-5 py-2.5 text-center disabled:opacity-50"
                        >
                            {loading ? 'Creating...' : 'Create Class'}
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
