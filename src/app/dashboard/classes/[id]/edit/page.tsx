"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { API_BASE_URL } from "@/lib/api";
import { authFetch } from "@/lib/auth";

export default function EditClassPage() {
    const router = useRouter();
    const params = useParams();
    const id = params?.id as string;

    const [formData, setFormData] = useState({ name: "" });
    const [originalClassName, setOriginalClassName] = useState("");

    // We will keep sections in a flat state array for easy editing
    const [sections, setSections] = useState<any[]>([]);
    const [originalSections, setOriginalSections] = useState<any[]>([]);
    const [deletedSectionIds, setDeletedSectionIds] = useState<number[]>([]);

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    const [teachers, setTeachers] = useState<any[]>([]);

    // Helper to fetch class data
    const fetchClass = async () => {
        if (!id) return;
        setLoading(true);
        try {
            const [classesRes, teachersRes] = await Promise.all([
                authFetch(`${API_BASE_URL}/classes`),
                authFetch(`${API_BASE_URL}/staff?staffCategory=Teaching+Staff`)
            ]);

            if (!classesRes.ok) throw new Error("Failed to fetch classes");
            const classes = await classesRes.json();
            const cls = classes.find((c: any) => c.id === parseInt(id));

            if (teachersRes.ok) {
                const teachersData = await teachersRes.json();
                setTeachers(Array.isArray(teachersData) ? teachersData : teachersData.data ?? []);
            }

            if (cls) {
                setFormData({
                    name: cls.name,
                });
                setOriginalClassName(cls.name);

                // Map the nested class data to a flat structure for UI binding
                const mappedSections = (cls.sections || []).map((s: any) => ({
                    id: s.id,
                    name: s.name,
                    teacherId: s.classStaff?.id?.toString() || ""
                }));

                setSections(mappedSections);
                setOriginalSections(JSON.parse(JSON.stringify(mappedSections))); // deep copy
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

    const handleSectionChange = (index: number, field: string, value: string) => {
        const newSections = [...sections];
        newSections[index] = { ...newSections[index], [field]: value };
        setSections(newSections);
    };

    const handleAddSection = () => {
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

    const handleDeleteSection = (index: number) => {
        const sec = sections[index];
        // If it's an existing section from backend, record its ID to delete on save
        if (sec.id) {
            setDeletedSectionIds([...deletedSectionIds, sec.id]);
        }

        // Remove from UI state immediately
        const newSections = [...sections];
        newSections.splice(index, 1);
        setSections(newSections);
    };

    const handleClassSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setError("");

        try {
            // 1. Update Class name if changed
            if (formData.name !== originalClassName) {
                const res = await authFetch(`${API_BASE_URL}/classes/${id}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(formData),
                });
                if (!res.ok) throw new Error("Failed to update class");
            }

            // 2. Delete sections that were removed in UI
            for (const delId of deletedSectionIds) {
                const resDelete = await authFetch(`${API_BASE_URL}/classes/sections/${delId}`, { method: "DELETE" });
                if (!resDelete.ok) console.error("Failed to delete section", delId);
            }

            // 3. Process each section currently in UI state
            for (const sec of sections) {
                if (sec.id) {
                    // Existing section - update name if changed
                    const orig = originalSections.find(o => o.id === sec.id);
                    if (orig && orig.name !== sec.name) {
                        await authFetch(`${API_BASE_URL}/classes/sections/${sec.id}`, {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ name: sec.name })
                        });
                    }
                    // Update teacher if changed
                    if (orig && orig.teacherId !== sec.teacherId) {
                        if (sec.teacherId) {
                            await authFetch(`${API_BASE_URL}/classes/sections/${sec.id}/staff`, {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ staffId: parseInt(sec.teacherId) })
                            });
                        }
                    }
                } else {
                    // New section
                    const createRes = await authFetch(`${API_BASE_URL}/classes/sections`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ classId: parseInt(id), name: sec.name })
                    });
                    if (createRes.ok) {
                        const newSec = await createRes.json();
                        // Assign teacher to the newly created section if one was selected
                        if (sec.teacherId) {
                            await authFetch(`${API_BASE_URL}/classes/sections/${newSec.id}/staff`, {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ staffId: parseInt(sec.teacherId) })
                            });
                        }
                    } else {
                        throw new Error("Failed to add new section");
                    }
                }
            }

            // Refresh data and reset deleted IDs state
            setDeletedSectionIds([]);
            await fetchClass();

            router.push("/dashboard/classes");
            router.refresh();

        } catch (err) {
            console.error(err);
            setError("Failed to update class. Please try again.");
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

                    {/* Sections Management */}
                    <div className="border-t pt-6 mb-6">
                        <h3 className="text-lg font-bold mb-4 text-slate-800">Manage Sections & Teachers</h3>

                        <div className="space-y-4 mb-6">
                            {sections.length === 0 ? (
                                <p className="text-gray-500 italic">No sections found for this class.</p>
                            ) : (
                                sections.map((section: any, index: number) => (
                                    <div key={section.id || `new-${index}`} className="flex gap-4 items-end p-4 bg-gray-50 rounded border border-gray-100">
                                        <div className="w-1/4">
                                            <label className="block mb-1 text-xs text-gray-500">Section Name</label>
                                            <input
                                                type="text"
                                                value={section.name}
                                                onChange={(e) => handleSectionChange(index, 'name', e.target.value)}
                                                className="bg-white border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5"
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
                                                    <option key={t.id} value={t.id}>{t.firstName} {t.lastName}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => handleDeleteSection(index)}
                                            className="text-red-500 hover:text-red-700 p-2.5"
                                            title="Delete Section"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                                            </svg>
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>

                        {/* Add Section */}
                        <div className="border-t pt-6">
                            <button
                                type="button"
                                onClick={handleAddSection}
                                className="text-white bg-green-600 hover:bg-green-700 focus:ring-4 focus:outline-none focus:ring-green-300 font-medium rounded-lg text-sm px-5 py-2.5"
                            >
                                + Add Section
                            </button>
                        </div>
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
