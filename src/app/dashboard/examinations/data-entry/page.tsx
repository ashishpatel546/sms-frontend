"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import useSWR from "swr";
import { API_BASE_URL, fetcher } from "@/lib/api";
import toast, { Toaster } from "react-hot-toast";
import { authFetch } from "@/lib/auth";
import { useRbac } from "@/lib/rbac";

export default function ExaminationsDataEntryPage() {
    const rbac = useRbac();
    const [classes, setClasses] = useState<any[]>([]);
    const [sections, setSections] = useState<any[]>([]);
    const [loadingSections, setLoadingSections] = useState(false);
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

    const selectedSubject = subjects.find(s => s.id === parseInt(selectedSubjectId));
    const isSplit = selectedSubject?.hasTheory && selectedSubject?.hasPractical;

    const [studentsMarks, setStudentsMarks] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    // Row IDs that admin has explicitly unlocked for editing
    const [editingRows, setEditingRows] = useState<Set<number>>(new Set());
    const [auditCard, setAuditCard] = useState<any | null>(null);
    const [sortConfig, setSortConfig] = useState<{ column: string; direction: 'asc' | 'desc' }>({ column: 'rollNo', direction: 'asc' });

    const sortedStudentsMarks = useMemo(() => {
        if (!sortConfig.column || studentsMarks.length === 0) return studentsMarks;
        const numericCols = new Set(['theoryTotalMarks', 'theoryObtainedMarks', 'practicalTotalMarks', 'practicalObtainedMarks', 'totalMarks', 'obtainedMarks']);
        return [...studentsMarks].sort((a, b) => {
            const aVal = a[sortConfig.column];
            const bVal = b[sortConfig.column];
            if (aVal == null && bVal == null) return 0;
            if (aVal == null) return 1;
            if (bVal == null) return -1;
            let cmp: number;
            if (numericCols.has(sortConfig.column)) {
                cmp = Number(aVal) - Number(bVal);
            } else if (sortConfig.column === 'rollNo') {
                // alphanumeric roll number comparison
                cmp = String(aVal).localeCompare(String(bVal), undefined, { numeric: true, sensitivity: 'base' });
            } else {
                cmp = String(aVal).localeCompare(String(bVal));
            }
            return sortConfig.direction === 'asc' ? cmp : -cmp;
        });
    }, [studentsMarks, sortConfig]);

    const handleSortClick = (column: string) => {
        setSortConfig(prev => ({
            column,
            direction: prev.column === column && prev.direction === 'asc' ? 'desc' : 'asc',
        }));
    };

    /** Whether a row's inputs are editable: new marks always yes; saved marks only if admin has clicked Edit */
    const isRowEditable = (m: any) => !m.markId || editingRows.has(m.studentId);

    const toggleEditRow = (studentId: number) => {
        setEditingRows(prev => {
            const next = new Set(prev);
            if (next.has(studentId)) next.delete(studentId); else next.add(studentId);
            return next;
        });
    };

    const SortIcon = ({ col }: { col: string }) => {
        if (sortConfig.column !== col) return <span className="ml-1 opacity-30 text-[10px]">↕</span>;
        return <span className="ml-1 text-blue-600 text-[10px]">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>;
    };

    useEffect(() => {
        Promise.all([
            authFetch(`${API_BASE_URL}/classes/names-only`).then(r => r.json()),
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

    const handleClassChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
        const val = e.target.value;
        setSelectedClassId(val);
        setSelectedSectionId("");
        setSections([]);
        if (!val) return;
        setLoadingSections(true);
        try {
            const res = await authFetch(`${API_BASE_URL}/classes/${val}/sections`);
            if (res.ok) setSections(await res.json());
        } catch (_e) {
            console.error('Failed to fetch sections');
        } finally {
            setLoadingSections(false);
        }
    };

    const handleFetchStudents = async () => {
        if (!selectedClassId || !selectedSectionId || !selectedSessionId || !selectedSubjectId || !selectedExamCategoryId) {
            toast.error("Please select all required fields to fetch students.");
            return;
        }
        setEditingRows(new Set());

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
        } catch (_err) {
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

    const handleApplyAllTotalMarks = (field: string = 'totalMarks') => {
        if (studentsMarks.length === 0) return;
        const firstTotal = studentsMarks[0][field];
        if (firstTotal === '' || firstTotal === null || firstTotal === undefined) return;
        setStudentsMarks(prev => prev.map(m => ({ ...m, [field]: firstTotal })));
    };

    const handleSaveBulkMarks = async () => {
        if (studentsMarks.length === 0) return;

        const invalidStudent = studentsMarks.find(m => {
            if (isSplit) {
                const invalidTh = m.theoryTotalMarks != null && m.theoryTotalMarks !== '' && m.theoryObtainedMarks != null && m.theoryObtainedMarks !== '' && Number(m.theoryObtainedMarks) > Number(m.theoryTotalMarks);
                const invalidPr = m.practicalTotalMarks != null && m.practicalTotalMarks !== '' && m.practicalObtainedMarks != null && m.practicalObtainedMarks !== '' && Number(m.practicalObtainedMarks) > Number(m.practicalTotalMarks);
                return invalidTh || invalidPr;
            } else {
                if (m.totalMarks == null || m.totalMarks === '' || m.obtainedMarks == null || m.obtainedMarks === '') return false;
                return Number(m.obtainedMarks) > Number(m.totalMarks);
            }
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
                theoryTotalMarks: m.theoryTotalMarks !== '' && m.theoryTotalMarks !== null ? Number(m.theoryTotalMarks) : undefined,
                theoryObtainedMarks: m.theoryObtainedMarks !== '' && m.theoryObtainedMarks !== null ? Number(m.theoryObtainedMarks) : undefined,
                practicalTotalMarks: m.practicalTotalMarks !== '' && m.practicalTotalMarks !== null ? Number(m.practicalTotalMarks) : undefined,
                practicalObtainedMarks: m.practicalObtainedMarks !== '' && m.practicalObtainedMarks !== null ? Number(m.practicalObtainedMarks) : undefined,
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
        } catch (_err) {
            toast.error("Network error");
        }
    };

    return (
        <main className="p-4 bg-slate-50 min-h-screen">
            <Toaster position="top-right" />

            {/* Audit info card */}
            {auditCard && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30" onClick={() => setAuditCard(null)}>
                    <div className="bg-white rounded-xl shadow-2xl border border-gray-200 p-5 w-full max-w-xs" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center mb-4">
                            <h4 className="text-sm font-bold text-slate-800">Marks Audit Info</h4>
                            <button onClick={() => setAuditCard(null)} className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                        <p className="text-xs text-gray-500 mb-3 font-medium">{auditCard.studentName}</p>
                        {auditCard.createdByName && (
                            <div className="mb-3 p-3 bg-green-50 rounded-lg">
                                <p className="text-[10px] font-semibold uppercase tracking-wider text-green-600 mb-1">Entered by</p>
                                <p className="text-sm font-semibold text-slate-800">{auditCard.createdByName}</p>
                                {auditCard.createdAt && (
                                    <p className="text-xs text-gray-400 mt-0.5">{new Date(auditCard.createdAt).toLocaleString()}</p>
                                )}
                            </div>
                        )}
                        {auditCard.updatedByName && (
                            <div className="p-3 bg-amber-50 rounded-lg">
                                <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-600 mb-1">Last modified by</p>
                                <p className="text-sm font-semibold text-slate-800">{auditCard.updatedByName}</p>
                                {auditCard.updatedAt && (
                                    <p className="text-xs text-gray-400 mt-0.5">{new Date(auditCard.updatedAt).toLocaleString()}</p>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}
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
                            <select value={selectedSectionId} onChange={e => setSelectedSectionId(e.target.value)} disabled={!selectedClassId || loadingSections} className="bg-gray-50 border border-gray-300 text-sm rounded-lg w-full p-2 disabled:opacity-50 disabled:cursor-not-allowed" required>
                                <option value="" disabled>{loadingSections ? 'Loading sections...' : 'Select Section'}</option>
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
                                        <th
                                            className="px-4 py-3 cursor-pointer hover:bg-gray-100 select-none"
                                            onClick={() => handleSortClick('studentName')}
                                        >
                                            Student Name<SortIcon col="studentName" />
                                        </th>
                                        <th
                                            className="px-4 py-3 text-center cursor-pointer hover:bg-gray-100 select-none"
                                            onClick={() => handleSortClick('rollNo')}
                                        >
                                            Roll No<SortIcon col="rollNo" />
                                        </th>
                                        <th className="px-4 py-3 min-w-[120px]">
                                            <div className="flex items-center justify-between">
                                                <span
                                                    className="cursor-pointer hover:text-blue-600 select-none"
                                                    onClick={() => handleSortClick(isSplit ? 'theoryTotalMarks' : 'totalMarks')}
                                                >
                                                    {isSplit ? 'Th. Total' : 'Total Marks'}
                                                    <SortIcon col={isSplit ? 'theoryTotalMarks' : 'totalMarks'} />
                                                </span>
                                                <button onClick={() => handleApplyAllTotalMarks(isSplit ? 'theoryTotalMarks' : 'totalMarks')} title="Apply first value to all" className="text-blue-600 hover:text-blue-800 focus:outline-none">
                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                                                </button>
                                            </div>
                                        </th>
                                        <th
                                            className="px-4 py-3 min-w-[120px] cursor-pointer hover:bg-gray-100 select-none"
                                            onClick={() => handleSortClick(isSplit ? 'theoryObtainedMarks' : 'obtainedMarks')}
                                        >
                                            {isSplit ? 'Th. Obtained' : 'Obtained'}
                                            <SortIcon col={isSplit ? 'theoryObtainedMarks' : 'obtainedMarks'} />
                                        </th>
                                        
                                        {isSplit && (
                                            <>
                                                <th className="px-4 py-3 min-w-[120px] bg-purple-50">
                                                    <div className="flex items-center justify-between text-purple-900">
                                                        <span
                                                            className="cursor-pointer hover:text-purple-700 select-none"
                                                            onClick={() => handleSortClick('practicalTotalMarks')}
                                                        >
                                                            Pr. Total (Opt.)<SortIcon col="practicalTotalMarks" />
                                                        </span>
                                                        <button onClick={() => handleApplyAllTotalMarks('practicalTotalMarks')} title="Apply first value to all" className="text-purple-600 hover:text-purple-800 focus:outline-none">
                                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                                                        </button>
                                                    </div>
                                                </th>
                                                <th
                                                    className="px-4 py-3 min-w-[120px] bg-purple-50 text-purple-900 cursor-pointer hover:bg-purple-100 select-none"
                                                    onClick={() => handleSortClick('practicalObtainedMarks')}
                                                >
                                                    Pr. Obtained (Opt.)<SortIcon col="practicalObtainedMarks" />
                                                </th>
                                                <th className="px-4 py-3 w-24 text-center bg-gray-100 font-bold">Overall</th>
                                            </>
                                        )}

                                        <th className="px-4 py-3 w-32 text-center text-blue-600 font-bold">Percentage</th>
                                        <th className="px-4 py-3 w-24 text-center">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sortedStudentsMarks.map((m: any, idx: number) => {
                                        const isInvalidTh = isSplit && m.theoryTotalMarks != null && m.theoryTotalMarks !== '' && m.theoryObtainedMarks != null && m.theoryObtainedMarks !== '' && Number(m.theoryObtainedMarks) > Number(m.theoryTotalMarks);
                                        const isInvalidPr = isSplit && m.practicalTotalMarks != null && m.practicalTotalMarks !== '' && m.practicalObtainedMarks != null && m.practicalObtainedMarks !== '' && Number(m.practicalObtainedMarks) > Number(m.practicalTotalMarks);
                                        const isInvalidBase = !isSplit && m.totalMarks != null && m.totalMarks !== '' && m.obtainedMarks != null && m.obtainedMarks !== '' && Number(m.obtainedMarks) > Number(m.totalMarks);
                                        const isInvalid = isInvalidTh || isInvalidPr || isInvalidBase;
                                        
                                        const calculatedTotal = isSplit ? (Number(m.theoryTotalMarks || 0) + Number(m.practicalTotalMarks || 0)) : Number(m.totalMarks || 0);
                                        const calculatedObtained = isSplit ? (Number(m.theoryObtainedMarks || 0) + Number(m.practicalObtainedMarks || 0)) : Number(m.obtainedMarks || 0);

                                        return (
                                            <tr key={m.studentId} className={`border-b ${isInvalid ? 'bg-red-50 hover:bg-red-100' : (idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50')} hover:bg-slate-100`}>
                                                <td className="px-4 py-2 font-medium text-slate-700 text-center">{m.studentId}</td>
                                                <td className="px-4 py-2 font-semibold text-slate-800">{m.studentName}</td>
                                                <td className="px-4 py-2 text-center text-slate-600">{m.rollNo || '-'}</td>
                                                <td className="px-4 py-2">
                                                    {isRowEditable(m) ? (
                                                        <input type="number" min="0" value={(isSplit ? m.theoryTotalMarks : m.totalMarks) ?? ''} onChange={e => handleMarkChange(m.studentId, isSplit ? 'theoryTotalMarks' : 'totalMarks', e.target.value)} className="w-full text-sm border-gray-300 rounded focus:ring-blue-500 focus:border-blue-500 p-1.5" placeholder="Total" />
                                                    ) : (
                                                        <span className="text-sm text-slate-600">{(isSplit ? m.theoryTotalMarks : m.totalMarks) ?? '-'}</span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-2">
                                                    {isRowEditable(m) ? (
                                                        <>
                                                            <input type="number" min="0" max={(isSplit ? m.theoryTotalMarks : m.totalMarks) ?? ''} value={(isSplit ? m.theoryObtainedMarks : m.obtainedMarks) ?? ''} onChange={e => handleMarkChange(m.studentId, isSplit ? 'theoryObtainedMarks' : 'obtainedMarks', e.target.value)} className={`w-full text-sm rounded p-1.5 ${(isSplit ? isInvalidTh : isInvalidBase) ? 'border-red-500 ring-1 ring-red-500 focus:ring-red-500 focus:border-red-500 bg-red-50 text-red-700' : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'}`} placeholder="Obtained" title={(isSplit ? isInvalidTh : isInvalidBase) ? "Obtained marks cannot exceed Total marks" : ""} />
                                                            {(isSplit ? isInvalidTh : isInvalidBase) && <p className="text-[10px] text-red-600 font-bold mt-1 text-center">Exceeds Total</p>}
                                                        </>
                                                    ) : (
                                                        <div className="flex items-center gap-1">
                                                            <button
                                                                type="button"
                                                                onClick={() => m.markId && (m.createdByName || m.updatedByName) && setAuditCard(m)}
                                                                className={`text-sm font-semibold text-slate-800 ${
                                                                    m.markId && (m.createdByName || m.updatedByName)
                                                                        ? 'underline decoration-dotted decoration-blue-400 cursor-pointer'
                                                                        : 'cursor-default'
                                                                }`}
                                                                title={m.markId && (m.createdByName || m.updatedByName) ? 'Tap to see who entered this' : undefined}
                                                            >
                                                                {(isSplit ? m.theoryObtainedMarks : m.obtainedMarks) ?? '-'}
                                                            </button>
                                                        </div>
                                                    )}
                                                </td>

                                                {isSplit && (
                                                    <>
                                                        <td className="px-4 py-2 bg-purple-50/30">
                                                            {isRowEditable(m) ? (
                                                                <input type="number" min="0" value={m.practicalTotalMarks ?? ''} onChange={e => handleMarkChange(m.studentId, 'practicalTotalMarks', e.target.value)} className="w-full text-sm border-gray-300 rounded focus:ring-purple-500 focus:border-purple-500 p-1.5" placeholder="Total" />
                                                            ) : (
                                                                <span className="text-sm text-slate-600">{m.practicalTotalMarks ?? '-'}</span>
                                                            )}
                                                        </td>
                                                        <td className="px-4 py-2 bg-purple-50/30">
                                                            {isRowEditable(m) ? (
                                                                <>
                                                                    <input type="number" min="0" max={m.practicalTotalMarks ?? ''} value={m.practicalObtainedMarks ?? ''} onChange={e => handleMarkChange(m.studentId, 'practicalObtainedMarks', e.target.value)} className={`w-full text-sm rounded p-1.5 ${isInvalidPr ? 'border-red-500 ring-1 ring-red-500 focus:ring-red-500 focus:border-red-500 bg-red-50 text-red-700' : 'border-gray-300 focus:ring-purple-500 focus:border-purple-500'}`} placeholder="Obtained" title={isInvalidPr ? "Obtained marks cannot exceed Total marks" : ""} />
                                                                    {isInvalidPr && <p className="text-[10px] text-red-600 font-bold mt-1 text-center">Exceeds Total</p>}
                                                                </>
                                                            ) : (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => m.markId && (m.createdByName || m.updatedByName) && setAuditCard(m)}
                                                                    className={`text-sm font-semibold text-purple-900 ${
                                                                        m.markId && (m.createdByName || m.updatedByName)
                                                                            ? 'underline decoration-dotted decoration-blue-400 cursor-pointer'
                                                                            : 'cursor-default'
                                                                    }`}
                                                                    title={m.markId && (m.createdByName || m.updatedByName) ? 'Tap to see who entered this' : undefined}
                                                                >
                                                                    {m.practicalObtainedMarks ?? '-'}
                                                                </button>
                                                            )}
                                                        </td>
                                                        <td className="px-4 py-2 text-center bg-gray-100 font-bold text-gray-800 text-sm">
                                                            {calculatedTotal > 0 ? `${calculatedObtained}/${calculatedTotal}` : '-'}
                                                        </td>
                                                    </>
                                                )}

                                                <td className={`px-4 py-2 text-center font-bold ${isInvalid ? 'text-red-600 bg-red-100' : 'text-slate-700 bg-slate-50/50'}`}>
                                                    {calculatedTotal > 0 ?
                                                        `${((calculatedObtained * 100) / calculatedTotal).toFixed(1)}%`
                                                        : '-'}
                                                </td>
                                                <td className="px-4 py-2 text-center">
                                                    {m.markId ? (
                                                        rbac.isAdmin ? (
                                                            <button
                                                                type="button"
                                                                onClick={() => toggleEditRow(m.studentId)}
                                                                className={`px-3 py-1 text-xs font-medium rounded-lg transition-colors ${
                                                                    editingRows.has(m.studentId)
                                                                        ? 'bg-amber-100 text-amber-700 hover:bg-amber-200'
                                                                        : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                                                                }`}
                                                            >
                                                                {editingRows.has(m.studentId) ? 'Lock' : 'Edit'}
                                                            </button>
                                                        ) : (
                                                            <span className="px-2 py-0.5 text-[10px] font-medium rounded bg-gray-100 text-gray-500">Saved</span>
                                                        )
                                                    ) : null}
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
