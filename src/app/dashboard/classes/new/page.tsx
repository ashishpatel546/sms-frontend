"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { API_BASE_URL } from "@/lib/api";
import { Loader } from "@/components/ui/Loader";
import toast from "react-hot-toast";
import { useRbac } from "@/lib/rbac";
import { authFetch } from "@/lib/auth";

type SectionEntry = {
    /** "existing" = picked from dropdown; "new" = user is typing a new name */
    mode: "existing" | "new";
    sectionId?: number;   // populated when mode === "existing"
    name: string;         // display name (existing) or input value (new)
    teacherId: string;
};

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
    const [existingSections, setExistingSections] = useState<any[]>([]);
    const [fetchError, setFetchError] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [sections, setSections] = useState<SectionEntry[]>([
        { mode: "existing", sectionId: undefined, name: "", teacherId: "" }
    ]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        Promise.all([
            authFetch(`${API_BASE_URL}/staff?staffCategory=Teaching+Staff`),
            authFetch(`${API_BASE_URL}/classes/sections`),
        ])
            .then(async ([staffRes, sectionsRes]) => {
                if (!staffRes.ok) throw new Error();
                const staffData = await staffRes.json();
                setTeachers(Array.isArray(staffData) ? staffData : staffData.data ?? []);

                if (sectionsRes.ok) {
                    const secData = await sectionsRes.json();
                    setExistingSections(Array.isArray(secData) ? secData : []);
                }
            })
            .catch(() => setFetchError(true))
            .finally(() => setIsLoading(false));
    }, []);

    const handleSectionChange = (index: number, field: keyof SectionEntry, value: any) => {
        const updated = [...sections];
        updated[index] = { ...updated[index], [field]: value };
        setSections(updated);
    };

    const handleSectionModeChange = (index: number, mode: "existing" | "new") => {
        const updated = [...sections];
        updated[index] = { mode, sectionId: undefined, name: "", teacherId: updated[index].teacherId };
        setSections(updated);
    };

    const handleExistingSectionSelect = (index: number, sectionId: string) => {
        const sec = existingSections.find((s) => s.id === parseInt(sectionId));
        const updated = [...sections];
        updated[index] = {
            ...updated[index],
            sectionId: sec?.id,
            name: sec?.name ?? "",
        };
        setSections(updated);
    };

    const addSection = () => {
        setSections([...sections, { mode: "existing", sectionId: undefined, name: "", teacherId: "" }]);
    };

    const removeSection = (index: number) => {
        setSections(sections.filter((_, i) => i !== index));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError("");

        // Validate each section has either an existing selection or a new name
        for (const sec of sections) {
            if (sec.mode === "existing" && !sec.sectionId) {
                setError("Please select a section or choose 'Create new' for each section row.");
                setLoading(false);
                return;
            }
            if (sec.mode === "new" && !sec.name.trim()) {
                setError("Please enter a name for each new section.");
                setLoading(false);
                return;
            }
        }

        try {
            const payload = {
                name,
                sections: sections.map((s) => ({
                    ...(s.mode === "existing" ? { sectionId: s.sectionId } : { name: s.name.trim() }),
                    staffId: s.teacherId ? parseInt(s.teacherId) : undefined,
                })),
            };

            const res = await authFetch(`${API_BASE_URL}/classes`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            if (!res.ok) {
                const errBody = await res.json().catch(() => ({}));
                throw new Error(errBody?.message ?? "Failed to create class");
            }

            toast.success("Class created successfully!");
            router.push("/dashboard/classes");
            router.refresh();
        } catch (err: any) {
            setError(err.message ?? "Failed to create class. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    if (isLoading) return <Loader fullScreen text="Loading data..." />;
    if (fetchError) return <div className="p-4 text-red-500">Failed to load required data</div>;

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
                            placeholder="e.g. Class 10"
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
                                <div key={index} className="bg-gray-50 p-4 rounded-lg border border-gray-200 space-y-3">
                                    {/* Mode toggle */}
                                    <div className="flex gap-2 items-center">
                                        <span className="text-xs font-medium text-gray-500">Section:</span>
                                        <button
                                            type="button"
                                            onClick={() => handleSectionModeChange(index, "existing")}
                                            className={`text-xs px-2 py-1 rounded ${section.mode === "existing" ? "bg-blue-600 text-white" : "bg-white border border-gray-300 text-gray-600"}`}
                                        >
                                            Select existing
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleSectionModeChange(index, "new")}
                                            className={`text-xs px-2 py-1 rounded ${section.mode === "new" ? "bg-blue-600 text-white" : "bg-white border border-gray-300 text-gray-600"}`}
                                        >
                                            Create new
                                        </button>
                                    </div>

                                    <div className="flex gap-4 items-end">
                                        {/* Section picker */}
                                        <div className="w-1/3">
                                            {section.mode === "existing" ? (
                                                <>
                                                    <label className="block mb-1 text-xs text-gray-500">Section</label>
                                                    <select
                                                        value={section.sectionId ?? ""}
                                                        onChange={(e) => handleExistingSectionSelect(index, e.target.value)}
                                                        className="bg-white border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5"
                                                        required
                                                    >
                                                        <option value="">Select section…</option>
                                                        {existingSections.map((s) => (
                                                            <option key={s.id} value={s.id}>{s.name}</option>
                                                        ))}
                                                    </select>
                                                </>
                                            ) : (
                                                <>
                                                    <label className="block mb-1 text-xs text-gray-500">New Section Name</label>
                                                    <input
                                                        type="text"
                                                        value={section.name}
                                                        onChange={(e) => handleSectionChange(index, "name", e.target.value)}
                                                        className="bg-white border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5"
                                                        placeholder="e.g. A"
                                                        required
                                                    />
                                                </>
                                            )}
                                        </div>

                                        {/* Teacher picker */}
                                        <div className="flex-1">
                                            <label className="block mb-1 text-xs text-gray-500">Class Teacher (optional)</label>
                                            <select
                                                value={section.teacherId}
                                                onChange={(e) => handleSectionChange(index, "teacherId", e.target.value)}
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
                                </div>
                            ))}
                        </div>

                        {existingSections.length === 0 && (
                            <p className="mt-2 text-xs text-amber-600">
                                No sections exist yet. Use &quot;Create new&quot; to add the first ones (e.g. A, B, C).
                            </p>
                        )}
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

