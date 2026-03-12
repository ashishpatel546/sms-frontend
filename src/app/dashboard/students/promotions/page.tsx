"use client";

import { useState, useEffect } from "react";
import { toast } from "react-hot-toast";
import { useRouter } from "next/navigation";
import { API_BASE_URL } from "@/lib/api";
import { authFetch } from "@/lib/auth";

export default function BulkPromotionsPage() {
    const router = useRouter();
    const [sessions, setSessions] = useState<any[]>([]);
    const [classes, setClasses] = useState<any[]>([]);
    const [fromSections, setFromSections] = useState<any[]>([]);
    const [toSections, setToSections] = useState<any[]>([]);
    const [students, setStudents] = useState<any[]>([]);

    // Search Params
    const [fromSessionId, setFromSessionId] = useState("");
    const [fromClassId, setFromClassId] = useState("");
    const [fromSectionId, setFromSectionId] = useState("");

    // Action Params
    const [actionType, setActionType] = useState<"PROMOTE" | "EXIT">("PROMOTE");
    const [toSessionId, setToSessionId] = useState("");
    const [toClassId, setToClassId] = useState("");
    const [toSectionId, setToSectionId] = useState("");
    const [exitReason, setExitReason] = useState<"ALUMNI" | "WITHDRAWN">("ALUMNI");
    const [actionErrors, setActionErrors] = useState<string[]>([]);

    const [selectedStudentIds, setSelectedStudentIds] = useState<number[]>([]);
    const [loading, setLoading] = useState(false);

    // History Modal State
    const [historyModalStudent, setHistoryModalStudent] = useState<any | null>(null);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const [sessRes, classRes] = await Promise.all([
                authFetch(`${API_BASE_URL}/academic-sessions`),
                authFetch(`${API_BASE_URL}/classes`)
            ]);

            if (sessRes.ok) setSessions(await sessRes.json());
            if (classRes.ok) setClasses(await classRes.json());
        } catch (error) {
            toast.error("Failed to load initial data");
        }
    };

    const handleFromClassChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const val = e.target.value;
        setFromClassId(val);
        setFromSectionId("");
        if (val) {
            const cls = classes.find((c: any) => c.id === parseInt(val));
            setFromSections(cls?.sections || []);
        } else {
            setFromSections([]);
        }
    };

    const handleToClassChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const val = e.target.value;
        setToClassId(val);
        setToSectionId("");
        if (val) {
            const cls = classes.find((c: any) => c.id === parseInt(val));
            setToSections(cls?.sections || []);
        } else {
            setToSections([]);
        }
    };

    const handleSearch = async () => {
        if (!fromSessionId || !fromClassId) {
            toast.error("Please select a Source Session and Class");
            return;
        }

        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (fromClassId) params.append("classId", fromClassId);
            if (fromSectionId) params.append("sectionId", fromSectionId);
            if (fromSessionId) params.append("academicSessionId", fromSessionId);

            const res = await authFetch(`${API_BASE_URL}/students?${params.toString()}`);
            if (res.ok) {
                const allStudents = await res.json();
                // Backend already filters by ACTIVE enrollment in fromClass+fromSession,
                // so we can use the results directly without a client-side fallback.
                setStudents(allStudents);
                setSelectedStudentIds([]); // reset selection
            }
        } catch (error) {
            toast.error("Failed to search students");
        } finally {
            setLoading(false);
        }
    };

    const toggleStudent = (id: number) => {
        if (selectedStudentIds.includes(id)) {
            setSelectedStudentIds(selectedStudentIds.filter(sId => sId !== id));
        } else {
            setSelectedStudentIds([...selectedStudentIds, id]);
        }
    };

    const toggleAll = () => {
        if (selectedStudentIds.length === students.length) {
            setSelectedStudentIds([]);
        } else {
            setSelectedStudentIds(students.map(s => s.id));
        }
    };

    const handleAction = async () => {
        setActionErrors([]);

        if (selectedStudentIds.length === 0) {
            toast.error("Please select at least one student");
            return;
        }

        if (actionType === "PROMOTE") {
            if (!toSessionId || !toClassId || !toSectionId) {
                toast.error("Please fill out all Destination fields");
                return;
            }

            const payload = {
                studentIds: selectedStudentIds,
                fromSessionId: parseInt(fromSessionId),
                toSessionId: parseInt(toSessionId),
                targetClassId: parseInt(toClassId),
                targetSectionId: parseInt(toSectionId)
            };

            try {
                setLoading(true);
                const res = await authFetch(`${API_BASE_URL}/students/promotions/bulk`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload)
                });

                if (res.ok) {
                    const result = await res.json();
                    toast.success(`Successfully promoted ${result.successful} students!`);
                    if (result.failed > 0) {
                        toast.error(`Failed to promote ${result.failed} students.`);
                        if (result.errors && result.errors.length > 0) {
                            setActionErrors(result.errors);
                        }
                    }
                    handleSearch();
                } else {
                    toast.error("Failed to execute bulk promotion");
                }
            } catch (error) {
                toast.error("An error occurred during promotion");
            } finally {
                setLoading(false);
            }
        } else {
            // EXIT Action
            const payload = {
                studentIds: selectedStudentIds,
                sessionId: parseInt(fromSessionId),
                exitType: exitReason
            };

            try {
                setLoading(true);
                const res = await authFetch(`${API_BASE_URL}/students/exits/bulk`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload)
                });

                if (res.ok) {
                    const result = await res.json();
                    toast.success(`Successfully processed exits for ${result.successful} students!`);
                    if (result.failed > 0) {
                        toast.error(`Failed to process exits for ${result.failed} students.`);
                        if (result.errors && result.errors.length > 0) {
                            setActionErrors(result.errors);
                        }
                    }
                    handleSearch();
                } else {
                    toast.error("Failed to execute bulk exit");
                }
            } catch (error) {
                toast.error("An error occurred during exit processing");
            } finally {
                setLoading(false);
            }
        }
    };

    return (
        <main className="p-4 max-w-7xl mx-auto">
            <h1 className="text-2xl font-bold text-slate-800 mb-6">Bulk Student Promotions</h1>

            {/* Top Bar: Source Filters & Destination Settings */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">

                {/* Source Config */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                    <h2 className="text-lg font-semibold text-slate-800 mb-4 flex items-center">
                        <span className="bg-slate-100 text-slate-600 w-6 h-6 rounded-full flex items-center justify-center text-sm mr-2">1</span>
                        Select Source Class
                    </h2>
                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <label className="block mb-2 text-sm font-medium text-gray-900">Academic Session</label>
                            <select
                                value={fromSessionId}
                                onChange={(e) => setFromSessionId(e.target.value)}
                                className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5"
                            >
                                <option value="">Select Session...</option>
                                {sessions.map(s => <option key={s.id} value={s.id}>{s.name} {s.isActive ? '(Active)' : ''}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block mb-2 text-sm font-medium text-gray-900">Class</label>
                            <select
                                value={fromClassId}
                                onChange={handleFromClassChange}
                                className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5"
                            >
                                <option value="">Select Class...</option>
                                {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block mb-2 text-sm font-medium text-gray-900">Section</label>
                            <select
                                value={fromSectionId}
                                onChange={(e) => setFromSectionId(e.target.value)}
                                disabled={!fromClassId}
                                className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <option value="">Select Section...</option>
                                {fromSections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                        </div>
                    </div>
                    <button
                        onClick={handleSearch}
                        className="mt-4 w-full text-white bg-slate-800 hover:bg-slate-900 focus:ring-4 focus:ring-slate-300 font-medium rounded-lg text-sm px-5 py-2.5"
                    >
                        Load Students
                    </button>
                </div>

                {/* Destination Config */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 border-l-4 border-l-amber-500">
                    <div className="flex justify-between items-center mb-4">
                        <h2 className="text-lg font-semibold text-slate-800 flex items-center">
                            <span className="bg-amber-100 text-amber-700 w-6 h-6 rounded-full flex items-center justify-center text-sm mr-2">2</span>
                            Action Settings
                        </h2>
                        <div className="flex bg-slate-100 p-1 rounded-lg">
                            <button
                                onClick={() => setActionType("PROMOTE")}
                                className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${actionType === "PROMOTE" ? "bg-white text-amber-700 shadow-sm" : "text-slate-600 hover:text-slate-900"}`}
                            >
                                Promote
                            </button>
                            <button
                                onClick={() => setActionType("EXIT")}
                                className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${actionType === "EXIT" ? "bg-white text-red-600 shadow-sm" : "text-slate-600 hover:text-slate-900"}`}
                            >
                                Process Exits
                            </button>
                        </div>
                    </div>

                    {actionType === "PROMOTE" ? (
                        <div className="grid grid-cols-3 gap-4">
                            <div>
                                <label className="block mb-2 text-sm font-medium text-gray-900">Target Session</label>
                                <select
                                    value={toSessionId}
                                    onChange={(e) => setToSessionId(e.target.value)}
                                    className="bg-amber-50 border border-amber-300 text-gray-900 text-sm rounded-lg focus:ring-amber-500 focus:border-amber-500 block w-full p-2.5"
                                >
                                    <option value="">Select Session...</option>
                                    {sessions.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block mb-2 text-sm font-medium text-gray-900">Promote To Class</label>
                                <select
                                    value={toClassId}
                                    onChange={handleToClassChange}
                                    className="bg-amber-50 border border-amber-300 text-gray-900 text-sm rounded-lg focus:ring-amber-500 focus:border-amber-500 block w-full p-2.5"
                                >
                                    <option value="">Select Class...</option>
                                    {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block mb-2 text-sm font-medium text-gray-900">Assign Section</label>
                                <select
                                    value={toSectionId}
                                    onChange={(e) => setToSectionId(e.target.value)}
                                    disabled={!toClassId}
                                    className="bg-amber-50 border border-amber-300 text-gray-900 text-sm rounded-lg focus:ring-amber-500 focus:border-amber-500 block w-full p-2.5 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <option value="">Select Section...</option>
                                    {toSections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                </select>
                            </div>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-4">
                            <div>
                                <label className="block mb-2 text-sm font-medium text-gray-900">Exit Reason</label>
                                <select
                                    value={exitReason}
                                    onChange={(e) => setExitReason(e.target.value as any)}
                                    className="bg-red-50 border border-red-300 text-gray-900 text-sm rounded-lg focus:ring-red-500 focus:border-red-500 block w-full p-2.5"
                                >
                                    <option value="ALUMNI">Graduated (Alumni)</option>
                                    <option value="WITHDRAWN">Left School (Withdrawn)</option>
                                </select>
                                <p className="mt-2 text-xs text-slate-500">This will mark the selected active students as inactive and set their enrollment status in the source session accordingly.</p>
                            </div>
                        </div>
                    )}
                    <button
                        onClick={handleAction}
                        disabled={loading || selectedStudentIds.length === 0}
                        className={`mt-4 w-full text-white ${actionType === "PROMOTE" ? "bg-amber-600 hover:bg-amber-700 disabled:bg-amber-300 focus:ring-amber-300" : "bg-red-600 hover:bg-red-700 disabled:bg-red-300 focus:ring-red-300"} disabled:cursor-not-allowed focus:ring-4 font-medium rounded-lg text-sm px-5 py-2.5 transition-colors`}
                    >
                        {loading ? 'Processing...' : `Execute ${actionType === "PROMOTE" ? "Promotion" : "Exit"} for ${selectedStudentIds.length} Students`}
                    </button>
                    {actionErrors.length > 0 && (
                        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg max-h-48 overflow-y-auto">
                            <h3 className="text-sm font-semibold text-red-800 mb-2">The following issues occurred:</h3>
                            <ul className="list-disc list-inside text-xs text-red-700 space-y-1">
                                {actionErrors.map((err, idx) => (
                                    <li key={idx}>{err}</li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            </div>

            {/* Student Selection Grid */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
                    <h2 className="text-lg font-semibold text-slate-800 flex items-center">
                        <span className="bg-slate-200 text-slate-700 w-6 h-6 rounded-full flex items-center justify-center text-sm mr-2">3</span>
                        Select Students
                    </h2>
                    <span className="text-sm text-slate-500 font-medium">{students.length} students loaded</span>
                </div>

                <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                    <table className="w-full text-sm text-left text-gray-500 relative">
                        <thead className="text-xs text-gray-700 uppercase bg-gray-100 sticky top-0 shadow-sm z-10">
                            <tr>
                                <th scope="col" className="p-4 w-4">
                                    <div className="flex items-center">
                                        <input
                                            type="checkbox"
                                            className="w-4 h-4 text-amber-600 bg-gray-100 border-gray-300 rounded focus:ring-amber-500 focus:ring-2 cursor-pointer"
                                            checked={students.length > 0 && selectedStudentIds.length === students.length}
                                            onChange={toggleAll}
                                        />
                                    </div>
                                </th>
                                <th scope="col" className="px-6 py-3">ID</th>
                                <th scope="col" className="px-6 py-3">Student Name</th>
                                <th scope="col" className="px-6 py-3">Class / Section</th>
                                <th scope="col" className="px-6 py-3">Current Status</th>
                                <th scope="col" className="px-6 py-3 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {students.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="px-6 py-8 text-center text-slate-500">
                                        Please select a source session and class, then click "Load Students".
                                    </td>
                                </tr>
                            ) : (
                                students.map((student) => {
                                    const isSelected = selectedStudentIds.includes(student.id);

                                    // Find current enrollment status for display
                                    const currentEnrollment = student.enrollments?.find((e: any) => e.academicSession?.id === parseInt(fromSessionId));

                                    return (
                                        <tr
                                            key={student.id}
                                            className={`border-b hover:bg-slate-50 cursor-pointer transition-colors ${isSelected ? 'bg-amber-50 hover:bg-amber-100' : 'bg-white'}`}
                                            onClick={() => toggleStudent(student.id)}
                                        >
                                            <td className="p-4 w-4">
                                                <div className="flex items-center">
                                                    <input
                                                        type="checkbox"
                                                        className="w-4 h-4 text-amber-600 bg-gray-100 border-gray-300 rounded focus:ring-amber-500 focus:ring-2 cursor-pointer pt-1"
                                                        checked={isSelected}
                                                        onChange={() => { }} // Handled by tr onClick
                                                    />
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 font-medium text-gray-900">#{student.id}</td>
                                            <td className="px-6 py-4 font-semibold text-slate-800">
                                                {student.firstName} {student.lastName}
                                            </td>
                                            <td className="px-6 py-4">
                                                {student.class ? `${student.class.name} ${student.section ? '- ' + student.section.name : ''}` : '-'}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${currentEnrollment?.status === 'ACTIVE' ? 'bg-green-100 text-green-800' :
                                                    currentEnrollment?.status === 'PROMOTED' ? 'bg-blue-100 text-blue-800' :
                                                        currentEnrollment?.status === 'ALUMNI' ? 'bg-purple-100 text-purple-800' :
                                                            currentEnrollment?.status === 'WITHDRAWN' ? 'bg-red-100 text-red-800' :
                                                                'bg-slate-100 text-slate-800'
                                                    }`}>
                                                    {currentEnrollment?.status || 'UNKNOWN'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        setHistoryModalStudent(student);
                                                    }}
                                                    className="text-blue-600 hover:text-blue-800 font-medium text-sm transition-colors"
                                                >
                                                    History
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* History Modal */}
            {historyModalStudent && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 overflow-y-auto">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
                        <div className="flex justify-between items-center p-6 border-b border-slate-200">
                            <div>
                                <h3 className="text-xl font-bold text-slate-800">
                                    Promotion History
                                </h3>
                                <p className="text-sm text-slate-500 mt-1">
                                    {historyModalStudent.firstName} {historyModalStudent.lastName} (ID: #{historyModalStudent.id})
                                </p>
                            </div>
                            <button
                                onClick={() => setHistoryModalStudent(null)}
                                className="text-slate-400 hover:text-slate-600 transition-colors"
                            >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                        <div className="p-6 overflow-y-auto">
                            {!historyModalStudent.enrollments || historyModalStudent.enrollments.length === 0 ? (
                                <div className="text-center py-8 text-slate-500">
                                    No enrollment history found for this student.
                                </div>
                            ) : (
                                <div className="space-y-4 relative before:absolute before:inset-0 before:ml-5 before:translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-linear-to-b before:from-transparent before:via-slate-300 before:to-transparent">
                                    {[...historyModalStudent.enrollments].sort((a, b) => b.academicSession?.name.localeCompare(a.academicSession?.name)).map((enrollment: any, index) => (
                                        <div key={enrollment.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                                            {/* Icon */}
                                            <div className={`flex items-center justify-center w-10 h-10 rounded-full border-4 border-white shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow-sm ${enrollment.status === 'ACTIVE' ? 'bg-green-500' :
                                                    enrollment.status === 'PROMOTED' ? 'bg-blue-500' :
                                                        enrollment.status === 'ALUMNI' ? 'bg-purple-500' :
                                                            enrollment.status === 'WITHDRAWN' ? 'bg-red-500' :
                                                                'bg-slate-400'
                                                }`}>
                                                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                                                </svg>
                                            </div>

                                            {/* Card */}
                                            <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] p-4 rounded-xl border border-slate-200 bg-white shadow-sm">
                                                <div className="flex items-center justify-between mb-1">
                                                    <span className="font-bold text-slate-800">{enrollment.academicSession?.name}</span>
                                                    <span className={`px-2 py-0.5 text-[10px] uppercase font-bold tracking-wider rounded-full ${enrollment.status === 'ACTIVE' ? 'bg-green-100 text-green-700' :
                                                            enrollment.status === 'PROMOTED' ? 'bg-blue-100 text-blue-700' :
                                                                enrollment.status === 'ALUMNI' ? 'bg-purple-100 text-purple-700' :
                                                                    enrollment.status === 'WITHDRAWN' ? 'bg-red-100 text-red-700' :
                                                                        'bg-slate-100 text-slate-700'
                                                        }`}>
                                                        {enrollment.status}
                                                    </span>
                                                </div>
                                                <div className="text-sm text-slate-600">
                                                    <p><span className="font-medium">Class:</span> {enrollment.class?.name || 'N/A'}</p>
                                                    <p><span className="font-medium">Section:</span> {enrollment.section?.name || 'N/A'}</p>
                                                    <p><span className="font-medium">Roll No:</span> {enrollment.rollNo || 'N/A'}</p>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </main>
    );
}
