"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { API_BASE_URL } from "@/lib/api";
import { authFetch } from "@/lib/auth";

type SectionRow = {
    /** undefined = newly added in this session (not yet saved) */
    id?: number;
    name: string;
    teacherId: string;
};

type PendingSection = {
    mode: "existing" | "new";
    sectionId?: number;
    name: string;
    teacherId: string;
};

export default function EditClassPage() {
    const router = useRouter();
    const params = useParams();
    const id = params?.id as string;

    const [formData, setFormData] = useState({ name: "" });
    const [originalClassName, setOriginalClassName] = useState("");

    const [sections, setSections] = useState<SectionRow[]>([]);
    const [originalTeacherMap, setOriginalTeacherMap] = useState<Record<number, string>>({});
    const [toRemoveSectionIds, setToRemoveSectionIds] = useState<number[]>([]);

    // Section picker state (for the "Add Section" panel)
    const [showAddPanel, setShowAddPanel] = useState(false);
    const [existingSections, setExistingSections] = useState<any[]>([]);
    const [pending, setPending] = useState<PendingSection>({ mode: "existing", name: "", teacherId: "" });

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [teachers, setTeachers] = useState<any[]>([]);

    const fetchClass = async () => {
        if (!id) return;
        setLoading(true);
        try {
            const [classesRes, teachersRes, sectionsRes] = await Promise.all([
                authFetch(`${API_BASE_URL}/classes`),
                authFetch(`${API_BASE_URL}/staff?staffCategory=Teaching+Staff`),
                authFetch(`${API_BASE_URL}/classes/sections`),
            ]);

            if (!classesRes.ok) throw new Error("Failed to fetch classes");
            const classes = await classesRes.json();
            const cls = classes.find((c: any) => c.id === parseInt(id));

            if (teachersRes.ok) {
                const td = await teachersRes.json();
                setTeachers(Array.isArray(td) ? td : td.data ?? []);
            }

            if (sectionsRes.ok) {
                const sd = await sectionsRes.json();
                setExistingSections(Array.isArray(sd) ? sd : []);
            }

            if (cls) {
                setFormData({ name: cls.name });
                setOriginalClassName(cls.name);

                const mapped: SectionRow[] = (cls.sections || []).map((s: any) => ({
                    id: s.id,
                    name: s.name,
                    teacherId: s.classStaff?.id?.toString() || "",
                }));
                setSections(mapped);

                const tMap: Record<number, string> = {};
                mapped.forEach((s) => { if (s.id) tMap[s.id] = s.teacherId; });
                setOriginalTeacherMap(tMap);
            } else {
                setError("Class not found");
            }
        } catch (err) {
            setError("Failed to load data");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchClass();
    }, [id]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleTeacherChange = (index: number, teacherId: string) => {
        const updated = [...sections];
        updated[index] = { ...updated[index], teacherId };
        setSections(updated);
    };

    const handleRemoveSection = (index: number) => {
        const sec = sections[index];
        if (sec.id) {
            setToRemoveSectionIds((prev) => [...prev, sec.id!]);
        }
        setSections(sections.filter((_, i) => i !== index));
    };

    // Sections already linked (should not appear in the "add" dropdown again)
    const availableToAdd = existingSections.filter(
        (es) => !sections.find((s) => s.id === es.id)
    );

    const handleAddSection = async () => {
        if (pending.mode === "existing" && !pending.sectionId) {
            setError("Please select an existing section or switch to 'Create new'.");
            return;
        }
        if (pending.mode === "new" && !pending.name.trim()) {
            setError("Please enter a name for the new section.");
            return;
        }
        setError("");

        // Optimistically add to UI; will save on form submit
        const newRow: SectionRow = {
            id: pending.sectionId,
            name: pending.mode === "existing"
                ? (existingSections.find((s) => s.id === pending.sectionId)?.name ?? "")
                : pending.name.trim(),
            teacherId: pending.teacherId,
        };
        setSections([...sections, newRow]);
        setPending({ mode: "existing", name: "", teacherId: "", sectionId: undefined });
        setShowAddPanel(false);
    };

    const handleClassSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setError("");

        try {
            // 1. Update class name if changed
            if (formData.name !== originalClassName) {
                const res = await authFetch(`${API_BASE_URL}/classes/${id}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(formData),
                });
                if (!res.ok) throw new Error("Failed to update class name");
            }

            // 2. Remove unlinked sections (M2M unlink, not delete)
            for (const secId of toRemoveSectionIds) {
                const res = await authFetch(`${API_BASE_URL}/classes/${id}/sections/${secId}`, {
                    method: "DELETE",
                });
                if (!res.ok) console.error("Failed to remove section", secId);
            }

            // 3. Add new sections or handle teacher assignments
            for (const sec of sections) {
                if (!sec.id) {
                    // Brand-new section (no id yet) — link to class via the new endpoint
                    const payload = pending.mode === "existing" && sec.id
                        ? { sectionId: sec.id }
                        : { name: sec.name };
                    const createRes = await authFetch(`${API_BASE_URL}/classes/${id}/sections`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(payload),
                    });
                    if (!createRes.ok) {
                        throw new Error("Failed to link section to class");
                    }
                    const linked = await createRes.json();
                    if (sec.teacherId && linked?.id) {
                        await authFetch(`${API_BASE_URL}/classes/sections/${linked.id}/staff`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ staffId: parseInt(sec.teacherId), classId: parseInt(id) }),
                        });
                    }
                } else {
                    // Existing section — only update teacher if changed
                    const originalTeacherId = originalTeacherMap[sec.id] ?? "";
                    if (sec.teacherId !== originalTeacherId && sec.teacherId) {
                        await authFetch(`${API_BASE_URL}/classes/sections/${sec.id}/staff`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ staffId: parseInt(sec.teacherId), classId: parseInt(id) }),
                        });
                    }
                }
            }

            setToRemoveSectionIds([]);
            await fetchClass();
            router.push("/dashboard/classes");
            router.refresh();
        } catch (err: any) {
            console.error(err);
            setError(err?.message ?? "Failed to update class. Please try again.");
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="p-4">Loading...</div>;

    return (
        <main className="p-4 space-y-6">
            <div className="max-w-4xl mx-auto bg-white p-8 rounded-lg shadow-sm border border-slate-200">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold text-slate-800">Edit Class</h2>
                    <Link href="/dashboard/classes" className="text-blue-600 hover:underline">
                        &larr; Back to Classes
                    </Link>
                </div>

                {error && <div className="p-4 mb-4 text-sm text-red-800 rounded-lg bg-red-50">{error}</div>}

                <form onSubmit={handleClassSubmit} className="mb-8">
                    {/* Class name */}
                    <div className="mb-6">
                        <label htmlFor="name" className="block mb-2 text-sm font-medium text-gray-900">Class Name</label>
                        <input
                            type="text"
                            id="name"
                            name="name"
                            value={formData.name}
                            onChange={handleChange}
                            className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5"
                            required
                        />
                    </div>

                    {/* Sections */}
                    <div className="border-t pt-6 mb-6">
                        <h3 className="text-lg font-bold mb-1 text-slate-800">Sections &amp; Class Teachers</h3>
                        <p className="text-xs text-slate-500 mb-4">
                            Section names are shared across classes. Remove a section to unlink it from this class without deleting it.
                        </p>

                        <div className="space-y-4 mb-6">
                            {sections.length === 0 ? (
                                <p className="text-gray-500 italic">No sections linked to this class yet.</p>
                            ) : (
                                sections.map((section, index) => (
                                    <div key={section.id ?? `new-${index}`} className="flex gap-4 items-end p-4 bg-gray-50 rounded border border-gray-100">
                                        {/* Section name (read-only) */}
                                        <div className="w-1/4">
                                            <label className="block mb-1 text-xs text-gray-500">Section</label>
                                            <div className="bg-white border border-gray-200 text-gray-800 text-sm rounded-lg p-2.5 font-medium">
                                                {section.name}
                                            </div>
                                        </div>

                                        {/* Teacher picker */}
                                        <div className="flex-1">
                                            <label className="block mb-1 text-xs text-gray-500">Class Teacher</label>
                                            <select
                                                value={section.teacherId}
                                                onChange={(e) => handleTeacherChange(index, e.target.value)}
                                                className="bg-white border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5"
                                            >
                                                <option value="">Select Teacher</option>
                                                {teachers.map((t: any) => (
                                                    <option key={t.id} value={t.id}>{t.firstName} {t.lastName}</option>
                                                ))}
                                            </select>
                                        </div>

                                        {/* Remove from class */}
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveSection(index)}
                                            className="text-red-500 hover:text-red-700 p-2.5"
                                            title="Remove section from this class"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                                            </svg>
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>

                        {/* Add section panel */}
                        {!showAddPanel ? (
                            <button
                                type="button"
                                onClick={() => setShowAddPanel(true)}
                                className="text-white bg-green-600 hover:bg-green-700 focus:ring-4 focus:outline-none focus:ring-green-300 font-medium rounded-lg text-sm px-5 py-2.5"
                            >
                                + Add Section
                            </button>
                        ) : (
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
                                <p className="text-sm font-medium text-blue-800">Add a section to this class</p>

                                {/* Mode toggle */}
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setPending({ ...pending, mode: "existing", sectionId: undefined, name: "" })}
                                        className={`text-xs px-3 py-1.5 rounded ${pending.mode === "existing" ? "bg-blue-600 text-white" : "bg-white border border-gray-300 text-gray-600"}`}
                                    >
                                        Select existing
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setPending({ ...pending, mode: "new", sectionId: undefined, name: "" })}
                                        className={`text-xs px-3 py-1.5 rounded ${pending.mode === "new" ? "bg-blue-600 text-white" : "bg-white border border-gray-300 text-gray-600"}`}
                                    >
                                        Create new
                                    </button>
                                </div>

                                <div className="flex gap-3 items-end">
                                    {/* Section input */}
                                    <div className="w-1/3">
                                        {pending.mode === "existing" ? (
                                            <>
                                                <label className="block mb-1 text-xs text-gray-500">Section</label>
                                                <select
                                                    value={pending.sectionId ?? ""}
                                                    onChange={(e) => {
                                                        const sec = availableToAdd.find((s) => s.id === parseInt(e.target.value));
                                                        setPending({ ...pending, sectionId: sec?.id, name: sec?.name ?? "" });
                                                    }}
                                                    className="bg-white border border-gray-300 text-gray-900 text-sm rounded-lg block w-full p-2.5"
                                                >
                                                    <option value="">Select section…</option>
                                                    {availableToAdd.map((s) => (
                                                        <option key={s.id} value={s.id}>{s.name}</option>
                                                    ))}
                                                </select>
                                            </>
                                        ) : (
                                            <>
                                                <label className="block mb-1 text-xs text-gray-500">New Section Name</label>
                                                <input
                                                    type="text"
                                                    value={pending.name}
                                                    onChange={(e) => setPending({ ...pending, name: e.target.value })}
                                                    className="bg-white border border-gray-300 text-gray-900 text-sm rounded-lg block w-full p-2.5"
                                                    placeholder="e.g. D"
                                                />
                                            </>
                                        )}
                                    </div>

                                    {/* Teacher */}
                                    <div className="flex-1">
                                        <label className="block mb-1 text-xs text-gray-500">Class Teacher (optional)</label>
                                        <select
                                            value={pending.teacherId}
                                            onChange={(e) => setPending({ ...pending, teacherId: e.target.value })}
                                            className="bg-white border border-gray-300 text-gray-900 text-sm rounded-lg block w-full p-2.5"
                                        >
                                            <option value="">Select Teacher</option>
                                            {teachers.map((t: any) => (
                                                <option key={t.id} value={t.id}>{t.firstName} {t.lastName}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={handleAddSection}
                                        className="text-white bg-green-600 hover:bg-green-700 font-medium rounded-lg text-sm px-4 py-2"
                                    >
                                        Add
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => { setShowAddPanel(false); setPending({ mode: "existing", name: "", teacherId: "" }); }}
                                        className="text-gray-700 bg-white border border-gray-300 hover:bg-gray-100 font-medium rounded-lg text-sm px-4 py-2"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="flex items-center space-x-4 border-t pt-6">
                        <button
                            type="submit"
                            disabled={saving}
                            className="text-white bg-blue-700 hover:bg-blue-800 focus:ring-4 focus:outline-none focus:ring-blue-300 font-medium rounded-lg text-sm px-5 py-2.5 text-center disabled:opacity-50"
                        >
                            {saving ? 'Saving...' : 'Save Changes'}
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
