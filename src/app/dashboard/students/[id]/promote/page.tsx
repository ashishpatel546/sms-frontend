"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { API_BASE_URL } from "@/lib/api";
import { authFetch } from "@/lib/auth";

export default function PromoteStudentPage() {
    const router = useRouter();
    const params = useParams();
    const id = params?.id as string;
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

                if (!resStudent.ok) throw new Error("Failed to fetch student");

                const foundStudent = await resStudent.json();

                // Fetch Classes (which should include sections)
                const resClasses = await authFetch(`${API_BASE_URL}/classes`);
                const classesData = await resClasses.json();

                if (foundStudent) {
                    setStudent(foundStudent);
                    // Pre-select current values if needed, or leave blank to force choice
                } else {
                    setError("Student not found");
                }
                setClasses(classesData);
            } catch (err) {
                setError("Failed to load data");
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [id]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!selectedClassId || !selectedSectionId) {
            setError("Please select both a class and a section.");
            return;
        }

        if (student && student.class?.id === selectedClassId && student.section?.id === selectedSectionId) {
            setError("Student is already in this class and section. Please select a different one to promote/move.");
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
                throw new Error(data.message || "Failed to promote student");
            }

            router.push("/dashboard/students");
            router.refresh();
        } catch (err: any) {
            console.error(err);
            setError(err.message || "Failed to promote student. Please try again.");
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="p-4">Loading...</div>;
    if (error && !student) return <div className="p-4 text-red-600">{error}</div>; // Show error if load failed
    if (!student) return <div className="p-4">Student not found</div>;

    const sections = classes.find(c => c.id === selectedClassId)?.sections || [];

    return (
        <main className="p-4">
            <div className="max-w-2xl mx-auto bg-white p-8 rounded-lg shadow-sm border border-slate-200">
                <h2 className="text-2xl font-bold mb-6 text-slate-800">Promote Student</h2>

                {error && student && (
                    <div className="p-4 mb-4 text-sm text-red-800 rounded-lg bg-red-50" role="alert">
                        {error}
                    </div>
                )}

                <div className="mb-6 bg-slate-50 p-4 rounded text-sm text-slate-700 space-y-2">
                    <p><strong>Name:</strong> {student.firstName} {student.lastName}</p>
                    <p><strong>Email:</strong> {student.email}</p>
                    <p><strong>Current Class:</strong> {student.class ? student.class.name : 'N/A'}</p>
                    <p><strong>Current Section:</strong> {student.section ? student.section.name : 'N/A'}</p>
                    <p><strong>Status:</strong> {student.isActive ? 'Active' : 'Inactive'}</p>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="mb-6">
                        <label htmlFor="class" className="block mb-2 text-sm font-medium text-gray-900">New Class</label>
                        <select
                            id="class"
                            className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5"
                            value={selectedClassId || ""}
                            onChange={(e) => {
                                setSelectedClassId(parseInt(e.target.value));
                                setSelectedSectionId(null); // Reset section when class changes
                            }}
                            required
                        >
                            <option value="">Select Class</option>
                            {classes.map((cls) => (
                                <option key={cls.id} value={cls.id}>{cls.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="mb-6">
                        <label htmlFor="section" className="block mb-2 text-sm font-medium text-gray-900">New Section</label>
                        <select
                            id="section"
                            className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5"
                            value={selectedSectionId || ""}
                            onChange={(e) => setSelectedSectionId(parseInt(e.target.value))}
                            required
                            disabled={!selectedClassId}
                        >
                            <option value="">Select Section</option>
                            {sections.map((sec: any) => (
                                <option key={sec.id} value={sec.id}>{sec.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="flex items-center space-x-4">
                        <button
                            type="submit"
                            disabled={saving}
                            className="text-white bg-amber-600 hover:bg-amber-700 focus:ring-4 focus:outline-none focus:ring-amber-300 font-medium rounded-lg text-sm w-full sm:w-auto px-5 py-2.5 text-center disabled:opacity-50"
                        >
                            {saving ? 'Promoting...' : 'Promote Student'}
                        </button>
                        <Link href="/dashboard/students" className="text-gray-900 bg-white border border-gray-300 focus:outline-none hover:bg-gray-100 focus:ring-4 focus:ring-gray-200 font-medium rounded-lg text-sm px-5 py-2.5">
                            Cancel
                        </Link>
                    </div>
                </form>
            </div>
        </main>
    );
}
