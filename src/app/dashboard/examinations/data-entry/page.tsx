"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import useSWR from "swr";
import { API_BASE_URL, fetcher } from "@/lib/api";
import toast, { Toaster } from "react-hot-toast";
import { authFetch } from "@/lib/auth";

export default function ExaminationsDataEntryPage() {
    const [classes, setClasses] = useState<any[]>([]);
    const [sections, setSections] = useState<any[]>([]);
    const [sessions, setSessions] = useState<any[]>([]);
    const [subjects, setSubjects] = useState<any[]>([]);
    const [examCategories, setExamCategories] = useState<any[]>([]);

    const [selectedSessionId, setSelectedSessionId] = useState("");
    
    const { data: examSettings, isLoading: settingsLoading } = useSWR(
        selectedSessionId ? `${API_BASE_URL}/exams/settings?sessionId=${selectedSessionId}` : null,
        fetcher
    );
    const [selectedClassId, setSelectedClassId] = useState("");
    const [selectedSectionId, setSelectedSectionId] = useState("");
    const [selectedSubjectId, setSelectedSubjectId] = useState("");
    const [selectedExamCategoryId, setSelectedExamCategoryId] = useState("");

    const [studentsMarks, setStudentsMarks] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        Promise.all([
            authFetch(`${API_BASE_URL}/classes`).then(r => r.json()),
            authFetch(`${API_BASE_URL}/academic-sessions`).then(r => r.json()),
            authFetch(`${API_BASE_URL}/subjects`).then(r => r.json()),
        ]).then(([classesData, sessionsData, subjectsData]) => {
            setClasses(Array.isArray(classesData) ? classesData : []);
            setSessions(Array.isArray(sessionsData) ? sessionsData : []);
            setSubjects(Array.isArray(subjectsData) ? subjectsData : []);
            const activeSession = sessionsData.find((s: any) => s.isActive);
            if (activeSession) setSelectedSessionId(activeSession.id.toString());
        }).catch(() => { });
    }, []);

    useEffect(() => {
        if (!selectedSessionId) {
            setExamCategories([]);
            return;
        }
        authFetch(`${API_BASE_URL}/exams/categories/active?sessionId=${selectedSessionId}`)
            .then(r => r.json())
            .then(data => {
                setExamCategories(Array.isArray(data) ? data : []);
                setSelectedExamCategoryId("");
            })
            .catch(() => setExamCategories([]));
    }, [selectedSessionId]);

    const handleClassChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const val = e.target.value;
        setSelectedClassId(val);
        setSelectedSectionId("");
        if (val) {
            const cls = classes.find((c: any) => c.id === parseInt(val));
            setSections(cls?.sections || []);
        } else {
            setSections([]);
        }
    };

    const handleFetchStudents = async () => {
        if (!selectedClassId || !selectedSectionId || !selectedSessionId || !selectedSubjectId || !selectedExamCategoryId) {
            toast.error("Please select all required fields to fetch students.");
            return;
        }

        setLoading(true);
        try {
            const params = new URLSearchParams({
                classId: selectedClassId,
                sectionId: selectedSectionId,
                sessionId: selectedSessionId,
                subjectId: selectedSubjectId,
                examCategoryId: selectedExamCategoryId
            });
            const res = await authFetch(`${API_BASE_URL}/exams/marks/bulk?${params.toString()}`);
            if (res.ok) {
                const data = await res.json();
                setStudentsMarks(data);
                if (data.length === 0) toast("No students enrolled for this selection.");
            } else {
                toast.error("Failed to fetch students");
            }
        } catch (err) {
            toast.error("Network error");
        } finally {
            setLoading(false);
        }
    };

    const handleMarkChange = (studentId: number, field: string, value: any) => {
        setStudentsMarks(prev => prev.map(m => {
            if (m.studentId === studentId) {
                return { ...m, [field]: value };
            }
            return m;
        }));
    };

    const handleApplyAllTotalMarks = () => {
        if (studentsMarks.length === 0) return;
        const firstTotal = studentsMarks[0].totalMarks;
        if (firstTotal === '' || firstTotal === null || firstTotal === undefined) return;
        setStudentsMarks(prev => prev.map(m => ({ ...m, totalMarks: firstTotal })));
    };

    const handleSaveBulkMarks = async () => {
        if (studentsMarks.length === 0) return;

        const invalidStudent = studentsMarks.find(m => {
            if (m.totalMarks == null || m.totalMarks === '' || m.obtainedMarks == null || m.obtainedMarks === '') return false;
            return Number(m.obtainedMarks) > Number(m.totalMarks);
        });

        if (invalidStudent) {
            toast.error(`Obtained marks cannot exceed Total marks for ${invalidStudent.studentName}`);
            return;
        }

        // Prepare payload
        const payload = {
            classId: parseInt(selectedClassId),
            sectionId: parseInt(selectedSectionId),
            sessionId: parseInt(selectedSessionId),
            subjectId: parseInt(selectedSubjectId),
            examCategoryId: parseInt(selectedExamCategoryId),
            marks: studentsMarks.map(m => ({
                studentId: m.studentId,
                totalMarks: m.totalMarks !== '' && m.totalMarks !== null ? Number(m.totalMarks) : undefined,
                obtainedMarks: m.obtainedMarks !== '' && m.obtainedMarks !== null ? Number(m.obtainedMarks) : undefined,
            }))
        };

        try {
            const res = await authFetch(`${API_BASE_URL}/exams/marks/bulk`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                toast.success("Marks saved successfully!");
                handleFetchStudents();
            } else {
                toast.error("Failed to save marks");
            }
        } catch (err) {
            toast.error("Network error");
        }
    };

    return (
        <main className="p-4 bg-slate-50 min-h-screen">
            <Toaster position="top-right" />
            <div className="max-w-7xl mx-auto">
                <div className="flex justify-between items-center mb-6">
                    <h1 className="text-2xl font-bold text-slate-800">Bulk Data Entry</h1>
                    <Link href="/dashboard/examinations" className="text-sm text-blue-600 hover:underline flex items-center gap-1">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
                        Back to Examinations
                    </Link>
                </div>

                <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200 mb-6">
                    <h2 className="text-lg font-semibold text-slate-700 mb-4">Selection Criteria</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-4">
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Academic Session *</label>
                            <select value={selectedSessionId} onChange={e => setSelectedSessionId(e.target.value)} className="bg-gray-50 border border-gray-300 text-sm rounded-lg w-full p-2" required>
                                <option value="" disabled>Select Session</option>
                                {sessions.map((s: any) => (
                                    <option key={s.id} value={s.id}>{s.name} {s.isActive ? '(Active)' : ''}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Class *</label>
                            <select value={selectedClassId} onChange={handleClassChange} className="bg-gray-50 border border-gray-300 text-sm rounded-lg w-full p-2" required>
                                <option value="" disabled>Select Class</option>
                                {classes.map((c: any) => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Section *</label>
                            <select value={selectedSectionId} onChange={e => setSelectedSectionId(e.target.value)} disabled={!selectedClassId} className="bg-gray-50 border border-gray-300 text-sm rounded-lg w-full p-2 disabled:opacity-50 disabled:cursor-not-allowed" required>
                                <option value="" disabled>Select Section</option>
                                {sections.map((s: any) => (
                                    <option key={s.id} value={s.id}>{s.name}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Subject *</label>
                            <select value={selectedSubjectId} onChange={e => setSelectedSubjectId(e.target.value)} className="bg-gray-50 border border-gray-300 text-sm rounded-lg w-full p-2" required>
                                <option value="" disabled>Select Subject</option>
                                {subjects.map((s: any) => (
                                    <option key={s.id} value={s.id}>{s.name}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">Exam Category *</label>
                            <select value={selectedExamCategoryId} onChange={e => setSelectedExamCategoryId(e.target.value)} className="bg-gray-50 border border-gray-300 text-sm rounded-lg w-full p-2" required>
                                <option value="" disabled>Select Exam</option>
                                {examCategories.filter(c => c.id !== examSettings?.finalTargetCategoryId).map((c: any) => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <div className="flex justify-end">
                        <button onClick={handleFetchStudents} disabled={loading} className="px-5 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:ring-4 focus:ring-blue-300 disabled:opacity-75 disabled:cursor-not-allowed">
                            {loading ? 'Fetching...' : 'Fetch Students'}
                        </button>
                    </div>
                </div>

                {studentsMarks.length > 0 && (
                    <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-lg font-semibold text-slate-700">Enter Student Marks</h2>
                            <button onClick={handleSaveBulkMarks} className="px-5 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 shadow flex items-center gap-2 transition-transform transform active:scale-95">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                Save All Marks
                            </button>
                        </div>
                        <div className="relative overflow-x-auto rounded border border-gray-200">
                            <table className="w-full text-sm text-left text-gray-500">
                                <thead className="text-xs text-gray-700 uppercase bg-gray-50 border-b">
                                    <tr>
                                        <th className="px-4 py-3 w-16 text-center">ID</th>
                                        <th className="px-4 py-3">Student Name</th>
                                        <th className="px-4 py-3 text-center">Roll No</th>
                                        <th className="px-4 py-3 min-w-[120px]">
                                            <div className="flex items-center justify-between">
                                                <span>Total Marks</span>
                                                <button onClick={handleApplyAllTotalMarks} title="Apply first value to all" className="text-blue-600 hover:text-blue-800 focus:outline-none">
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                                                </button>
                                            </div>
                                        </th>
                                        <th className="px-4 py-3 min-w-[120px]">Obtained</th>
                                        <th className="px-4 py-3 w-32 text-center text-blue-600 font-bold">Percentage</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {studentsMarks.map((m: any, idx: number) => {
                                        const isInvalid = m.totalMarks != null && m.totalMarks !== '' && m.obtainedMarks != null && m.obtainedMarks !== '' && Number(m.obtainedMarks) > Number(m.totalMarks);

                                        return (
                                            <tr key={m.studentId} className={`border-b ${isInvalid ? 'bg-red-50 hover:bg-red-100' : (idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50')} hover:bg-slate-100`}>
                                                <td className="px-4 py-2 font-medium text-slate-700 text-center">{m.studentId}</td>
                                                <td className="px-4 py-2 font-semibold text-slate-800">{m.studentName}</td>
                                                <td className="px-4 py-2 text-center text-slate-600">{m.rollNo || '-'}</td>
                                                <td className="px-4 py-2">
                                                    <input type="number" min="0" value={m.totalMarks ?? ''} onChange={e => handleMarkChange(m.studentId, 'totalMarks', e.target.value)} className="w-full text-sm border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500 p-1.5" placeholder="Total" />
                                                </td>
                                                <td className="px-4 py-2">
                                                    <input type="number" min="0" max={m.totalMarks ?? ''} value={m.obtainedMarks ?? ''} onChange={e => handleMarkChange(m.studentId, 'obtainedMarks', e.target.value)} className={`w-full text-sm rounded p-1.5 ${isInvalid ? 'border-red-500 ring-1 ring-red-500 focus:ring-red-500 focus:border-red-500 bg-red-50 text-red-700' : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'}`} placeholder="Obtained" title={isInvalid ? "Obtained marks cannot exceed Total marks" : ""} />
                                                    {isInvalid && <p className="text-[10px] text-red-600 font-bold mt-1 text-center">Exceeds Total</p>}
                                                </td>
                                                <td className={`px-4 py-2 text-center font-bold ${isInvalid ? 'text-red-600 bg-red-100' : 'text-slate-700 bg-slate-50/50'}`}>
                                                    {m.totalMarks && m.obtainedMarks ?
                                                        `${((Number(m.obtainedMarks) * 100) / Number(m.totalMarks)).toFixed(1)}%`
                                                        : '-'}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        </main>
    );
}
