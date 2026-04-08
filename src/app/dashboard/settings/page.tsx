"use client";

import { useState, useEffect } from "react";
import toast, { Toaster } from "react-hot-toast";
import useSWR from "swr";
import { API_BASE_URL, fetcher } from "@/lib/api";
import { Loader } from "@/components/ui/Loader";
import { Plus, Trash2, Edit2, CheckCircle2, XCircle, Settings2, GraduationCap, CalendarDays } from "lucide-react";
import { useRbac } from "@/lib/rbac";
import { authFetch } from "@/lib/auth";

export default function SettingsPage() {
    const [activeTab, setActiveTab] = useState<'system' | 'examination' | 'holidays'>('system');
    const rbac = useRbac();

    // --- System Settings State ---
    const { data: sessions = [], error, isLoading: loading, mutate } = useSWR('/academic-sessions', fetcher);
    const [newSessionName, setNewSessionName] = useState("");
    const [newSessionStart, setNewSessionStart] = useState("");
    const [newSessionEnd, setNewSessionEnd] = useState("");

    const { data: designations = [], mutate: mutateDesignations, isLoading: loadingDesignations } = useSWR('/designations', fetcher);
    const [newDesigTitle, setNewDesigTitle] = useState("");
    const [newDesigDesc, setNewDesigDesc] = useState("");

    const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
    const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });

    const [editingDesig, setEditingDesig] = useState<any>(null);
    const [editDesigTitle, setEditDesigTitle] = useState("");
    const [editDesigDesc, setEditDesigDesc] = useState("");

    // --- Examination Settings State ---
    const [selectedExamSessionId, setSelectedExamSessionId] = useState<number | null>(null);
    const { data: examCategories = [], mutate: mutateCategories } = useSWR(
        selectedExamSessionId ? `/exams/categories?sessionId=${selectedExamSessionId}` : null,
        fetcher
    );
    const { data: examSettings, mutate: mutateSettings } = useSWR(
        selectedExamSessionId ? `/exams/settings?sessionId=${selectedExamSessionId}` : null,
        fetcher
    );
    const [newCategoryName, setNewCategoryName] = useState("");
    const [newCategoryDesc, setNewCategoryDesc] = useState("");
    const [selectedCategoryIds, setSelectedCategoryIds] = useState<number[]>([]);
    const [selectedTargetCategoryId, setSelectedTargetCategoryId] = useState<number | null>(null);

    // Grading System Settings State
    const [selectedGradingSessionId, setSelectedGradingSessionId] = useState<number | null>(null);
    const { data: gradingSystems = [], mutate: mutateGradingSystems } = useSWR(
        selectedGradingSessionId ? `/exams/grading-system/session/${selectedGradingSessionId}` : null,
        fetcher
    );
    const [newGradeName, setNewGradeName] = useState("");
    const [newGradeMin, setNewGradeMin] = useState<string>("");
    const [newGradeMax, setNewGradeMax] = useState<string>("");
    const [newGradeIsFail, setNewGradeIsFail] = useState(false);


    useEffect(() => {
        const handleClose = (e: Event) => {
            if ((e.target as Element).closest('.action-dropdown-btn') || 
                (e.target as Element).closest('.action-dropdown-menu')) {
                return;
            }
            setOpenDropdownId(null);
        };
        document.addEventListener('click', handleClose);
        document.addEventListener('scroll', handleClose, true);
        return () => {
            document.removeEventListener('click', handleClose);
            document.removeEventListener('scroll', handleClose, true);
        }
    }, []);

    const handleDropdownClick = (e: React.MouseEvent, id: string) => {
        e.preventDefault();
        e.stopPropagation();

        if (openDropdownId === id) {
            setOpenDropdownId(null);
        } else {
            const button = e.currentTarget as HTMLElement;
            const rect = button.getBoundingClientRect();
            const menuHeight = 80;
            const menuWidth = 130;
            const viewportHeight = window.innerHeight;
            const viewportWidth = window.innerWidth;

            const spaceBelow = viewportHeight - rect.bottom;
            const top = spaceBelow >= menuHeight
                ? rect.bottom + 4
                : rect.top - menuHeight - 4;

            const left = Math.min(rect.right - menuWidth, viewportWidth - menuWidth - 8);

            setDropdownPosition({ top, left });
            setOpenDropdownId(id);
        }
    };

    useEffect(() => {
        if (examSettings && examSettings.hasOwnProperty('contributingCategoryIds')) {
            setSelectedCategoryIds(examSettings.contributingCategoryIds || []);
            setSelectedTargetCategoryId(examSettings.finalTargetCategoryId || null);
        }
    }, [examSettings]);

    // Handle initial session selection for grading
    useEffect(() => {
        if (activeTab === 'examination' && sessions.length > 0) {
            const activeSession = sessions.find((s: any) => s.isActive);
            const defaultId = activeSession ? activeSession.id : sessions[0].id;
            
            if (!selectedGradingSessionId) {
                setSelectedGradingSessionId(defaultId);
            }
            if (!selectedExamSessionId) {
                setSelectedExamSessionId(defaultId);
            }
        }
    }, [activeTab, sessions, selectedGradingSessionId, selectedExamSessionId]);


    // --- Holidays Settings State ---
    const { data: holidays = [], mutate: mutateHolidays, isLoading: loadingHolidays } = useSWR('/holidays', fetcher);
    const { data: classes = [] } = useSWR('/classes', fetcher);
    const [showHolidayModal, setShowHolidayModal] = useState(false);
    const [editingHolidayId, setEditingHolidayId] = useState<number | null>(null);
    const [holidayDesc, setHolidayDesc] = useState("");
    const [holidayStart, setHolidayStart] = useState("");
    const [holidayEnd, setHolidayEnd] = useState("");
    const [holidayIsEntireSchool, setHolidayIsEntireSchool] = useState(true);
    const [holidayClassIds, setHolidayClassIds] = useState<number[]>([]);
    const [isSavingHoliday, setIsSavingHoliday] = useState(false);

    const handleOpenHolidayModal = (holiday?: any) => {
        if (holiday) {
            setEditingHolidayId(holiday.id);
            setHolidayDesc(holiday.description);
            // Convert ISO dates to YYYY-MM-DD for input fields if they exist
            setHolidayStart(holiday.startDate ? new Date(holiday.startDate).toISOString().split('T')[0] : "");
            setHolidayEnd(holiday.endDate ? new Date(holiday.endDate).toISOString().split('T')[0] : "");
            setHolidayIsEntireSchool(holiday.isEntireSchool);
            setHolidayClassIds(holiday.classes ? holiday.classes.map((c: any) => c.id) : []);
        } else {
            setEditingHolidayId(null);
            setHolidayDesc("");
            setHolidayStart("");
            setHolidayEnd("");
            setHolidayIsEntireSchool(true);
            setHolidayClassIds([]);
        }
        setShowHolidayModal(true);
    };

    const handleSaveHoliday = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSavingHoliday(true);
        try {
            const payload: any = {
                description: holidayDesc,
                startDate: holidayStart,
                endDate: holidayEnd,
                isEntireSchool: holidayIsEntireSchool,
            };
            if (!holidayIsEntireSchool) {
                payload.classIds = holidayClassIds;
            }

            const url = editingHolidayId
                ? `${API_BASE_URL}/holidays/${editingHolidayId}`
                : `${API_BASE_URL}/holidays`;
            const method = editingHolidayId ? 'PATCH' : 'POST';

            const res = await authFetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                toast.success(`Holiday ${editingHolidayId ? 'updated' : 'created'} successfully!`);
                setShowHolidayModal(false);
                mutateHolidays();
            } else {
                const data = await res.json();
                toast.error(data.message || "Failed to save holiday");
            }
        } catch (err) {
            toast.error("Network error");
        } finally {
            setIsSavingHoliday(false);
        }
    };

    const handleDeleteHoliday = async (id: number) => {
        if (!confirm("Are you sure you want to delete this holiday? This will also remove the holiday status from student attendance records for those dates.")) return;
        try {
            const res = await authFetch(`${API_BASE_URL}/holidays/${id}`, { method: "DELETE" });
            if (res.ok) {
                toast.success("Holiday deleted");
                mutateHolidays();
            } else {
                toast.error("Failed to delete holiday");
            }
        } catch (err) {
            toast.error("Network error");
        }
    };

    const handleHolidaySelectAllClasses = () => {
        if (holidayClassIds.length === classes.length) {
            setHolidayClassIds([]);
        } else {
            setHolidayClassIds(classes.map((c: any) => c.id));
        }
    };

    // --- System Setting Handlers ---
    const handleCreateSession = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const res = await authFetch(`${API_BASE_URL}/academic-sessions`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: newSessionName,
                    startDate: newSessionStart,
                    endDate: newSessionEnd,
                    isActive: sessions.length === 0, // First session defaults to active
                })
            });
            if (res.ok) {
                toast.success("Academic Session created!");
                setNewSessionName("");
                setNewSessionStart("");
                setNewSessionEnd("");
                mutate();
            } else {
                const data = await res.json();
                toast.error(data.message || "Failed to create session");
            }
        } catch (err) {
            toast.error("Network error");
        }
    };

    const handleSetActive = async (id: number) => {
        try {
            // Unset all active
            for (const s of sessions) {
                if (s.isActive && s.id !== id) {
                    await authFetch(`${API_BASE_URL}/academic-sessions/${s.id}`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ isActive: false })
                    });
                }
            }
            // Set target active
            const res = await authFetch(`${API_BASE_URL}/academic-sessions/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ isActive: true })
            });
            if (res.ok) {
                toast.success("Active session updated!");
                mutate();
            }
        } catch (err) {
            toast.error("Network error");
        }
    };

    const handleCreateDesignation = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const res = await authFetch(`${API_BASE_URL}/designations`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ title: newDesigTitle, description: newDesigDesc, isActive: true })
            });
            if (res.ok) {
                toast.success("Designation created!");
                setNewDesigTitle("");
                setNewDesigDesc("");
                mutateDesignations();
            } else {
                const data = await res.json();
                toast.error(data.message || "Failed to create designation");
            }
        } catch (err) {
            toast.error("Network error");
        }
    };

    const handleDeleteDesignation = async (id: number) => {
        if (!confirm("Are you sure you want to delete this designation?")) return;
        try {
            const res = await authFetch(`${API_BASE_URL}/designations/${id}`, { method: "DELETE" });
            if (res.ok) {
                toast.success("Designation deleted");
                mutateDesignations();
            } else {
                const data = await res.json();
                toast.error(data.message || "Failed to delete designation");
            }
        } catch (err) {
            toast.error("Network error");
        }
    };

    const handleUpdateDesignation = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingDesig) return;
        try {
            const res = await authFetch(`${API_BASE_URL}/designations/${editingDesig.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ title: editDesigTitle, description: editDesigDesc })
            });
            if (res.ok) {
                toast.success("Designation updated!");
                setEditingDesig(null);
                mutateDesignations();
            } else {
                const data = await res.json();
                toast.error(data.message || "Failed to update designation");
            }
        } catch (err) {
            toast.error("Network error");
        }
    };

    // --- Examination Setting Handlers ---
    const handleCreateCategory = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedExamSessionId) return toast.error("Select a session first");

        try {
            const res = await authFetch(`${API_BASE_URL}/exams/categories`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ 
                    name: newCategoryName, 
                    description: newCategoryDesc,
                    sessionId: selectedExamSessionId
                })
            });
            if (res.ok) {
                toast.success("Exam Category created!");
                setNewCategoryName("");
                setNewCategoryDesc("");
                mutateCategories();
            } else {
                const data = await res.json();
                toast.error(data.message || "Failed to create category");
            }
        } catch (err) {
            toast.error("Network error");
        }
    };

    const handleToggleCategory = async (id: number, currentStatus: boolean) => {
        try {
            const res = await authFetch(`${API_BASE_URL}/exams/categories/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ isActive: !currentStatus })
            });
            if (res.ok) {
                toast.success("Category status updated!");
                mutateCategories();
            }
        } catch (err) {
            toast.error("Network error");
        }
    };

    const toggleFinalResultCategory = (id: number) => {
        if (id === selectedTargetCategoryId) {
            toast.error("The Target Final Category cannot also be a contributing category.");
            return;
        }
        setSelectedCategoryIds(prev =>
            prev.includes(id) ? prev.filter(cId => cId !== id) : [...prev, id]
        );
    };

    const handleTargetCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const val = e.target.value ? parseInt(e.target.value) : null;
        if (val && selectedCategoryIds.includes(val)) {
            // Remove from contributing if it was there
            setSelectedCategoryIds(prev => prev.filter(id => id !== val));
        }
        setSelectedTargetCategoryId(val);
    };

    const handleSaveSettings = async () => {
        if (!selectedExamSessionId) return toast.error("Select a session first");

        try {
            const res = await authFetch(`${API_BASE_URL}/exams/settings`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    sessionId: selectedExamSessionId,
                    contributingCategoryIds: selectedCategoryIds,
                    finalTargetCategoryId: selectedTargetCategoryId
                })
            });
            if (res.ok) {
                toast.success("Exam settings updated!");
                mutateSettings();
            }
        } catch (err) {
            toast.error("Network error");
        }
    };

    const handleCreateGrading = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedGradingSessionId) return toast.error("Select a session first");

        const parsedMin = parseFloat(newGradeMin);
        const parsedMax = parseFloat(newGradeMax);
        if (isNaN(parsedMin) || isNaN(parsedMax)) return toast.error("Enter valid percentage values");
        if (parsedMin < 0 || parsedMax < 0) return toast.error("Percentages cannot be negative");
        if (parsedMax > 100) return toast.error("Percentages cannot exceed 100");
        if (parsedMin >= parsedMax) return toast.error("Min % must be strictly less than Max %");

        try {
            const res = await authFetch(`${API_BASE_URL}/exams/grading-system`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    sessionId: selectedGradingSessionId,
                    gradeName: newGradeName,
                    minPercentage: parsedMin,
                    maxPercentage: parsedMax,
                    isFailGrade: newGradeIsFail
                })
            });
            if (res.ok) {
                toast.success("Grading band created!");
                setNewGradeName("");
                setNewGradeMin("");
                setNewGradeMax("");
                setNewGradeIsFail(false);
                mutateGradingSystems();
            } else {
                const data = await res.json();
                const errMsg = Array.isArray(data.message) ? data.message[0] : (data.message || "Failed to create grading");
                toast.error(errMsg);
            }
        } catch (err) {
            toast.error("Network error");
        }
    };

    const handleDeleteGrading = async (id: number) => {
        if (!confirm("Are you sure you want to delete this grading band?")) return;
        try {
            const res = await authFetch(`${API_BASE_URL}/exams/grading-system/${id}`, { method: "DELETE" });
            if (res.ok) {
                toast.success("Grading band deleted");
                mutateGradingSystems();
            }
        } catch (err) {
            toast.error("Network error");
        }
    };


    return (
        <main className="p-4 flex-1 h-full overflow-y-auto w-full max-w-7xl mx-auto">
            {error && <div className="p-4 text-red-600 mb-4 bg-red-50 rounded">Error loading sessions</div>}
            <Toaster position="top-right" />
            <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-6 gap-4 border-b pb-4 border-gray-200">
                <h1 className="text-3xl font-bold text-slate-800 pb-2 md:pb-0">Settings</h1>
                <div className="flex p-1 bg-slate-100 rounded-xl w-full md:w-fit shadow-inner border border-slate-200/60 overflow-x-auto">
                    <button
                        onClick={() => setActiveTab('system')}
                        className={`flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-lg whitespace-nowrap transition-all duration-200 ${
                            activeTab === 'system'
                                ? "bg-white text-blue-700 shadow-sm ring-1 ring-black/5"
                                : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"
                        }`}
                    >
                        <Settings2 className="w-4 h-4" />
                        System Settings
                    </button>
                    <button
                        onClick={() => setActiveTab('examination')}
                        className={`flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-lg whitespace-nowrap transition-all duration-200 ${
                            activeTab === 'examination'
                                ? "bg-white text-blue-700 shadow-sm ring-1 ring-black/5"
                                : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"
                        }`}
                    >
                        <GraduationCap className="w-4 h-4" />
                        Examination Settings
                    </button>
                    <button
                        onClick={() => setActiveTab('holidays')}
                        className={`flex items-center gap-2 px-5 py-2.5 text-sm font-medium rounded-lg whitespace-nowrap transition-all duration-200 ${
                            activeTab === 'holidays'
                                ? "bg-white text-blue-700 shadow-sm ring-1 ring-black/5"
                                : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"
                        }`}
                    >
                        <CalendarDays className="w-4 h-4" />
                        Holidays
                    </button>
                </div>
            </div>

            {activeTab === 'system' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Academic Sessions panel */}
                    <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
                        <h2 className="text-xl font-bold mb-4 text-slate-800">Academic Sessions</h2>

                        {/* Create Session form — ADMIN+ only */}
                        {rbac.canManageSessions && (
                            <form onSubmit={handleCreateSession} className="mb-8 p-4 bg-slate-50 border border-slate-200 rounded-lg">
                                <h3 className="text-sm font-semibold text-slate-700 mb-3">Add New Session</h3>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                                    <div>
                                        <label className="block mb-1 text-xs font-medium text-gray-700">Name (e.g. 2026-2027)</label>
                                        <input type="text" value={newSessionName} onChange={(e) => setNewSessionName(e.target.value)} required className="w-full text-sm border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500" />
                                    </div>
                                    <div>
                                        <label className="block mb-1 text-xs font-medium text-gray-700">Start Date</label>
                                        <input type="date" value={newSessionStart} onChange={(e) => setNewSessionStart(e.target.value)} required className="w-full text-sm border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500" />
                                    </div>
                                    <div>
                                        <label className="block mb-1 text-xs font-medium text-gray-700">End Date</label>
                                        <input type="date" value={newSessionEnd} onChange={(e) => setNewSessionEnd(e.target.value)} required className="w-full text-sm border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500" />
                                    </div>
                                </div>
                                <button type="submit" className="w-full px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 transition">Create Session</button>
                            </form>
                        )}

                        {loading ? (
                            <Loader text="Loading sessions..." />
                        ) : (
                            <div className="relative overflow-x-auto rounded-lg border border-gray-200">
                                <table className="w-full text-sm text-left text-gray-500">
                                    <thead className="text-xs text-gray-700 uppercase bg-gray-50 border-b">
                                        <tr>
                                            <th scope="col" className="px-4 py-3">ID</th>
                                            <th scope="col" className="px-4 py-3">Name</th>
                                            <th scope="col" className="px-4 py-3">Period</th>
                                            <th scope="col" className="px-4 py-3 text-center">Status</th>
                                            <th scope="col" className="px-4 py-3 text-right">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {sessions.map((s: any) => (
                                            <tr key={s.id} className="bg-white border-b hover:bg-gray-50">
                                                <td className="px-4 py-3 font-mono text-xs text-gray-500">{s.id}</td>
                                                <td className="px-4 py-3 font-semibold text-slate-800">{s.name}</td>
                                                <td className="px-4 py-3 text-xs">
                                                    {new Date(s.startDate).toLocaleDateString()} to {new Date(s.endDate).toLocaleDateString()}
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    {s.isActive ? (
                                                        <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-bold rounded uppercase">Active</span>
                                                    ) : (
                                                        <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs font-bold rounded uppercase">Inactive</span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    {!s.isActive && rbac.canManageSessions && (
                                                        <button onClick={() => handleSetActive(s.id)} className="text-blue-600 hover:underline font-medium text-xs">
                                                            Set Active
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                        {sessions.length === 0 && (
                                            <tr><td colSpan={4} className="px-4 py-6 text-center text-gray-500 italic">No academic sessions found.</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    {/* Staff Designations panel */}
                    <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
                        <h2 className="text-xl font-bold mb-4 text-slate-800">Staff Designations</h2>

                        {rbac.isAdmin && (
                            <form onSubmit={handleCreateDesignation} className="mb-8 p-4 bg-slate-50 border border-slate-200 rounded-lg">
                                <h3 className="text-sm font-semibold text-slate-700 mb-3">Add Designation</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                    <div>
                                        <label className="block mb-1 text-xs font-medium text-gray-700">Title (e.g. Principal)</label>
                                        <input type="text" value={newDesigTitle} onChange={(e) => setNewDesigTitle(e.target.value)} required className="w-full text-sm border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500" />
                                    </div>
                                    <div>
                                        <label className="block mb-1 text-xs font-medium text-gray-700">Description</label>
                                        <input type="text" value={newDesigDesc} onChange={(e) => setNewDesigDesc(e.target.value)} className="w-full text-sm border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500" />
                                    </div>
                                </div>
                                <button type="submit" className="w-full px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 transition">Create Designation</button>
                            </form>
                        )}

                        {/* Edit Designation Modal */}
                        {editingDesig && (
                            <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black bg-opacity-50">
                                <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md animate-in zoom-in-95 duration-200">
                                    <h3 className="text-lg font-bold mb-4 text-slate-800">Edit Designation</h3>
                                    <form onSubmit={handleUpdateDesignation}>
                                        <div className="mb-4">
                                            <label className="block mb-2 text-sm font-medium text-gray-900">Title</label>
                                            <input
                                                type="text"
                                                value={editDesigTitle}
                                                onChange={(e) => setEditDesigTitle(e.target.value)}
                                                className="bg-gray-50 border border-gray-300 text-sm rounded-lg block w-full p-2.5 focus:ring-blue-500 focus:border-blue-500"
                                                required
                                            />
                                        </div>
                                        <div className="mb-6">
                                            <label className="block mb-2 text-sm font-medium text-gray-900">Description</label>
                                            <input
                                                type="text"
                                                value={editDesigDesc}
                                                onChange={(e) => setEditDesigDesc(e.target.value)}
                                                className="bg-gray-50 border border-gray-300 text-sm rounded-lg block w-full p-2.5 focus:ring-blue-500 focus:border-blue-500"
                                            />
                                        </div>
                                        <div className="flex gap-3 justify-end">
                                            <button
                                                type="button"
                                                onClick={() => setEditingDesig(null)}
                                                className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                                            >
                                                Cancel
                                            </button>
                                            <button
                                                type="submit"
                                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                                            >
                                                Save Changes
                                            </button>
                                        </div>
                                    </form>
                                </div>
                            </div>
                        )}

                        {loadingDesignations ? (
                            <Loader text="Loading designations..." />
                        ) : (
                            <div className="relative overflow-x-auto rounded-lg border border-gray-200">
                                <table className="w-full text-sm text-left text-gray-500">
                                    <thead className="text-xs text-gray-700 uppercase bg-gray-50 border-b">
                                        <tr>
                                            <th scope="col" className="px-4 py-3">Title</th>
                                            <th scope="col" className="px-4 py-3">Description</th>
                                            <th scope="col" className="px-4 py-3 text-right">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {designations.map((d: any) => (
                                            <tr key={d.id} className="bg-white border-b hover:bg-gray-50">
                                                <td className="px-4 py-3 font-semibold text-slate-800">{d.title}</td>
                                                <td className="px-4 py-3 text-xs">{d.description || '-'}</td>
                                                <td className="px-4 py-3 text-right">
                                                    {rbac.isAdmin && (
                                                        <div className="relative inline-block text-left">
                                                            <button
                                                                type="button"
                                                                onClick={(e) => handleDropdownClick(e, `desig-${d.id}`)}
                                                                className="action-dropdown-btn text-gray-500 hover:text-gray-700 p-1 rounded hover:bg-gray-100 focus:outline-none"
                                                            >
                                                                <svg className="w-5 h-5 pointer-events-none" fill="currentColor" viewBox="0 0 20 20"><path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z"></path></svg>
                                                            </button>
                                                            {openDropdownId === `desig-${d.id}` && (
                                                                <div
                                                                    className="action-dropdown-menu fixed w-32 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-[9999] border border-gray-100"
                                                                    style={{ top: dropdownPosition.top, left: dropdownPosition.left }}
                                                                >
                                                                    <div className="py-1">
                                                                        <button type="button" onClick={(e) => { e.stopPropagation(); setEditingDesig(d); setEditDesigTitle(d.title); setEditDesigDesc(d.description || ""); setOpenDropdownId(null); }} className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">Edit</button>
                                                                        <button type="button" onClick={(e) => { e.stopPropagation(); handleDeleteDesignation(d.id); setOpenDropdownId(null); }} className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100">Delete</button>
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                        {designations.length === 0 && (
                                            <tr><td colSpan={3} className="px-4 py-6 text-center text-gray-500 italic">No designations found.</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {activeTab === 'examination' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="space-y-6">
                        {/* Exam Categories panel */}
                        <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
                                <h2 className="text-xl font-bold text-slate-800">Exam Categories</h2>
                                <div className="mt-2 sm:mt-0">
                                    <label className="text-xs text-slate-500 mr-2 uppercase font-semibold">For Session:</label>
                                    <select
                                        className="text-sm border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 p-1"
                                        value={selectedExamSessionId || ''}
                                        onChange={(e) => setSelectedExamSessionId(Number(e.target.value))}
                                    >
                                        <option value="">Select Session</option>
                                        {sessions.map((s: any) => (
                                            <option key={s.id} value={s.id}>{s.name} {s.isActive && '(Active)'}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Create category form — ADMIN+ only */}
                            {rbac.canManageExamSettings && (
                                <form onSubmit={handleCreateCategory} className="mb-8 p-4 bg-slate-50 border border-slate-200 rounded-lg">
                                    <h3 className="text-sm font-semibold text-slate-700 mb-3">Add New Exam Category</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                        <div>
                                            <label className="block mb-1 text-xs font-medium text-gray-700">Name (e.g. SA1, Final)</label>
                                            <input type="text" value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} required className="w-full text-sm border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500" />
                                        </div>
                                        <div>
                                            <label className="block mb-1 text-xs font-medium text-gray-700">Description</label>
                                            <input type="text" value={newCategoryDesc} onChange={(e) => setNewCategoryDesc(e.target.value)} className="w-full text-sm border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500" />
                                        </div>
                                    </div>
                                    <button type="submit" className="w-full px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 transition">Create Category</button>
                                </form>
                            )}

                            <div className="relative overflow-x-auto rounded-lg border border-gray-200">
                                <table className="w-full text-sm text-left text-gray-500">
                                    <thead className="text-xs text-gray-700 uppercase bg-gray-50 border-b">
                                        <tr>
                                            <th className="px-4 py-3">Name</th>
                                            <th className="px-4 py-3 text-center">Status</th>
                                            <th className="px-4 py-3 text-right">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {examCategories.map((c: any) => (
                                            <tr key={c.id} className="bg-white border-b hover:bg-gray-50">
                                                <td className="px-4 py-3 font-semibold text-slate-800">{c.name}</td>
                                                <td className="px-4 py-3 text-center">
                                                    {c.isActive ? (
                                                        <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-bold rounded uppercase">Active</span>
                                                    ) : (
                                                        <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs font-bold rounded uppercase">Inactive</span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    {rbac.canManageExamSettings && (
                                                        <button onClick={() => handleToggleCategory(c.id, c.isActive)} className="text-blue-600 hover:underline font-medium text-xs">
                                                            {c.isActive ? 'Deactivate' : 'Activate'}
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                        {examCategories.length === 0 && (
                                            <tr><td colSpan={3} className="px-4 py-6 text-center text-gray-500 italic">No exam categories found.</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Final Result Settings panel */}
                        <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
                                <h2 className="text-xl font-bold text-slate-800">Final Result Settings</h2>
                                <div className="mt-2 sm:mt-0">
                                    <label className="text-xs text-slate-500 mr-2 uppercase font-semibold">For Session:</label>
                                    <select
                                        className="text-sm border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 p-1"
                                        value={selectedExamSessionId || ''}
                                        onChange={(e) => setSelectedExamSessionId(Number(e.target.value))}
                                    >
                                        <option value="">Select Session</option>
                                        {sessions.map((s: any) => (
                                            <option key={s.id} value={s.id}>{s.name} {s.isActive && '(Active)'}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="mb-6">
                                <label className="block mb-2 text-sm font-semibold text-slate-700">Target Final Category</label>
                                <select
                                    className="w-full text-sm border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 p-2"
                                    value={selectedTargetCategoryId || ''}
                                    onChange={handleTargetCategoryChange}
                                >
                                    <option value="">-- None Configured --</option>
                                    {examCategories.filter((c: any) => c.isActive).map((c: any) => (
                                        <option key={c.id} value={c.id}>{c.name}</option>
                                    ))}
                                </select>
                                <p className="text-xs text-slate-500 mt-1">This category's marks will be automatically generated by summing the contributing components.</p>
                            </div>

                            <p className="text-sm font-semibold text-slate-700 mb-3">Contributing Categories:</p>
                            <div className="flex flex-col gap-2 mb-6">
                                {examCategories.filter((c: any) => c.isActive).map((c: any) => {
                                    const isTarget = c.id === selectedTargetCategoryId;
                                    return (
                                        <label key={c.id} className={`flex items-center space-x-2 text-sm font-medium ${isTarget ? 'text-slate-400 cursor-not-allowed' : 'text-slate-800 cursor-pointer'}`}>
                                            <input
                                                type="checkbox"
                                                checked={selectedCategoryIds.includes(c.id)}
                                                onChange={() => toggleFinalResultCategory(c.id)}
                                                disabled={isTarget}
                                                className={`rounded ${isTarget ? 'text-gray-400 focus:ring-gray-400 cursor-not-allowed' : 'text-blue-600 focus:ring-blue-500'}`}
                                            />
                                            <span>{c.name} {isTarget && <span className="text-xs italic font-normal text-slate-400">(Selected as Target)</span>}</span>
                                        </label>
                                    );
                                })}
                                {examCategories.filter((c: any) => c.isActive).length === 0 && (
                                    <span className="text-sm text-slate-500 italic">Please create and activate exam categories first.</span>
                                )}
                            </div>
                            {rbac.canManageExamSettings && (
                                <button onClick={handleSaveSettings} className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 transition">Save Result Settings</button>
                            )}
                        </div>
                    </div>


                    {/* Grading System Engine */}
                    <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
                            <h2 className="text-xl font-bold text-slate-800">Grading System Rules</h2>
                            <div className="mt-2 sm:mt-0">
                                <label className="text-xs text-slate-500 mr-2 uppercase font-semibold">For Session:</label>
                                <select
                                    className="text-sm border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 p-1"
                                    value={selectedGradingSessionId || ''}
                                    onChange={(e) => setSelectedGradingSessionId(Number(e.target.value))}
                                >
                                    <option value="">Select Session</option>
                                    {sessions.map((s: any) => (
                                        <option key={s.id} value={s.id}>{s.name} {s.isActive && '(Active)'}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Add grading band form — ADMIN+ only */}
                        {rbac.canManageExamSettings && (
                            <form onSubmit={handleCreateGrading} className="mb-8 p-4 bg-slate-50 border border-slate-200 rounded-lg">
                                <h3 className="text-sm font-semibold text-slate-700 mb-3">Add Grading Band</h3>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                                    <div>
                                        <label className="block mb-1 text-[10px] uppercase font-bold text-gray-500">Grade (e.g. A+)</label>
                                        <input type="text" value={newGradeName} onChange={(e) => setNewGradeName(e.target.value)} required className="w-full text-sm border-gray-300 rounded-md shadow-sm py-1.5 px-3 focus:ring-blue-500" />
                                    </div>
                                    <div>
                                        <label className="block mb-1 text-[10px] uppercase font-bold text-gray-500">Min %</label>
                                        <input type="number" step="0.01" min="0" max="100" value={newGradeMin} onChange={(e) => setNewGradeMin(e.target.value)} required className="w-full text-sm border-gray-300 rounded-md shadow-sm py-1.5 px-3 focus:ring-blue-500" />
                                    </div>
                                    <div>
                                        <label className="block mb-1 text-[10px] uppercase font-bold text-gray-500">Max % <span className="text-[9px] font-normal lowercase">(excluding)</span></label>
                                        <input type="number" step="0.01" min="0" max="100" value={newGradeMax} onChange={(e) => setNewGradeMax(e.target.value)} required className="w-full text-sm border-gray-300 rounded-md shadow-sm py-1.5 px-3 focus:ring-blue-500" />
                                    </div>
                                    <div className="flex items-center pt-5">
                                        <label className="flex items-center space-x-2 text-sm font-medium text-slate-800 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={newGradeIsFail}
                                                onChange={(e) => setNewGradeIsFail(e.target.checked)}
                                                className="rounded text-red-600 focus:ring-red-500 h-4 w-4"
                                            />
                                            <span className="text-red-600 font-bold">Is Fail?</span>
                                        </label>
                                    </div>
                                </div>
                                <button type="submit" disabled={!selectedGradingSessionId} className="w-full px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 transition disabled:bg-blue-300">Add Grade Band</button>
                            </form>
                        )}

                        {!selectedGradingSessionId ? (
                            <div className="py-8 text-center text-slate-500 italic">Please select an academic session above.</div>
                        ) : (
                            <div className="relative overflow-x-auto rounded-lg border border-gray-200">
                                <table className="w-full text-sm text-left text-gray-500">
                                    <thead className="text-xs text-gray-700 uppercase bg-gray-50 border-b">
                                        <tr>
                                            <th className="px-4 py-3">Grade</th>
                                            <th className="px-4 py-3 text-center">Min %</th>
                                            <th className="px-4 py-3 text-center">Max % <span className="text-[10px] font-normal normal-case">(excluding)</span></th>
                                            <th className="px-4 py-3 text-center">Effect</th>
                                            <th className="px-4 py-3 text-right">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {gradingSystems.map((g: any) => (
                                            <tr key={g.id} className="bg-white border-b hover:bg-gray-50">
                                                <td className="px-4 py-3 font-bold text-slate-800">{g.gradeName}</td>
                                                <td className="px-4 py-3 text-center font-medium">{g.minPercentage}%</td>
                                                <td className="px-4 py-3 text-center font-medium">{g.maxPercentage}%</td>
                                                <td className="px-4 py-3 text-center">
                                                    {g.isFailGrade ? (
                                                        <span className="px-2 py-1 bg-red-100 text-red-700 text-xs font-bold rounded uppercase">Fail</span>
                                                    ) : (
                                                        <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-bold rounded uppercase">Pass</span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    {rbac.canManageExamSettings && (
                                                        <button onClick={() => handleDeleteGrading(g.id)} className="text-red-500 hover:text-red-700 hover:underline font-medium text-xs">
                                                            Delete
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                        {gradingSystems.length === 0 && (
                                            <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-500 italic">No grading systems defined for this session.</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                </div>
            )}

            {activeTab === 'holidays' && (
                <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-xl font-bold text-slate-800">School Holidays</h2>
                        {rbac.canManageHolidays && (
                            <button
                                onClick={() => handleOpenHolidayModal()}
                                className="bg-sky-600 hover:bg-sky-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                            >
                                <Plus className="w-4 h-4" /> Add Holiday
                            </button>
                        )}
                    </div>

                    {loadingHolidays ? (
                        <div className="py-12"><Loader text="Loading holidays..." /></div>
                    ) : (
                        <div className="relative overflow-x-auto rounded-lg border border-gray-200">
                            <table className="w-full text-sm text-left text-gray-500">
                                <thead className="text-xs text-gray-700 uppercase bg-gray-50 border-b">
                                    <tr>
                                        <th className="px-4 py-3">Description</th>
                                        <th className="px-4 py-3">Date Range</th>
                                        <th className="px-4 py-3">Applicability</th>
                                        <th className="px-4 py-3 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {holidays.map((h: any) => (
                                        <tr key={h.id} className="bg-white border-b hover:bg-gray-50">
                                            <td className="px-4 py-3 font-semibold text-slate-800">{h.description}</td>
                                            <td className="px-4 py-3 whitespace-nowrap">
                                                {new Date(h.startDate).toLocaleDateString()}
                                                {h.startDate !== h.endDate && ` - ${new Date(h.endDate).toLocaleDateString()}`}
                                            </td>
                                            <td className="px-4 py-3">
                                                {h.isEntireSchool ? (
                                                    <span className="flex items-center gap-1 text-green-700 text-xs font-bold bg-green-100 px-2 py-1 rounded-full w-max">
                                                        <CheckCircle2 className="w-3 h-3" /> Entire School
                                                    </span>
                                                ) : (
                                                    <div className="flex flex-wrap gap-1">
                                                        {h.classes?.map((c: any) => (
                                                            <span key={c.id} className="text-xs font-medium bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                                                                {c.name}
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <div className="flex items-center justify-end space-x-2">
                                                    {rbac.canManageHolidays && (
                                                        <button onClick={() => handleOpenHolidayModal(h)} className="text-blue-600 hover:text-blue-800 p-1">
                                                            <Edit2 className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                    {rbac.canDeleteHolidays && (
                                                        <button onClick={() => handleDeleteHoliday(h.id)} className="text-red-500 hover:text-red-700 p-1">
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                    {!rbac.canManageHolidays && (
                                                        <span className="text-xs text-slate-400 italic">View only</span>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    {holidays.length === 0 && (
                                        <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-500 italic">No holidays declared yet.</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* Holiday Modal */}
            {showHolidayModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center mb-6 border-b pb-4">
                            <h2 className="text-2xl font-bold text-slate-800">{editingHolidayId ? 'Edit Holiday' : 'Add New Holiday'}</h2>
                            <button
                                onClick={() => setShowHolidayModal(false)}
                                className="text-gray-400 hover:text-gray-600 transition-colors"
                            >
                                <XCircle className="w-6 h-6" />
                            </button>
                        </div>

                        <form onSubmit={handleSaveHoliday} className="space-y-5">
                            <div>
                                <label className="block mb-1.5 text-sm font-semibold text-gray-900">Description</label>
                                <input
                                    type="text"
                                    value={holidayDesc}
                                    onChange={(e) => setHolidayDesc(e.target.value)}
                                    placeholder="e.g. Summer Vacation, Diwali"
                                    className="bg-white border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-sky-500 focus:border-sky-500 block w-full p-2.5"
                                    required
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block mb-1.5 text-sm font-semibold text-gray-900">Start Date</label>
                                    <input
                                        type="date"
                                        value={holidayStart}
                                        onChange={(e) => setHolidayStart(e.target.value)}
                                        className="bg-white border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-sky-500 focus:border-sky-500 block w-full p-2.5"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block mb-1.5 text-sm font-semibold text-gray-900">End Date</label>
                                    <input
                                        type="date"
                                        value={holidayEnd}
                                        onChange={(e) => setHolidayEnd(e.target.value)}
                                        className="bg-white border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-sky-500 focus:border-sky-500 block w-full p-2.5"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="pt-2">
                                <label className="flex items-center space-x-3 cursor-pointer p-3 bg-slate-50 border border-slate-200 rounded-lg h-auto hover:bg-slate-100 transition-colors">
                                    <input
                                        type="checkbox"
                                        checked={holidayIsEntireSchool}
                                        onChange={(e) => setHolidayIsEntireSchool(e.target.checked)}
                                        className="w-5 h-5 text-sky-600 bg-white border-gray-300 rounded focus:ring-sky-500"
                                    />
                                    <div>
                                        <span className="text-sm font-bold text-slate-800 block">Is this holiday for the Entire School?</span>
                                        <span className="text-xs text-slate-500 block">Uncheck to select specific classes only.</span>
                                    </div>
                                </label>
                            </div>

                            {!holidayIsEntireSchool && (
                                <div className="mt-4 p-4 border border-gray-200 rounded-lg bg-gray-50">
                                    <div className="flex justify-between items-center mb-3">
                                        <label className="block text-sm font-semibold text-gray-900">Select Classes</label>
                                        <button
                                            type="button"
                                            onClick={handleHolidaySelectAllClasses}
                                            className="text-xs text-sky-600 hover:text-sky-800 font-bold hover:underline"
                                        >
                                            {holidayClassIds.length === classes.length ? 'Deselect All' : 'Select All'}
                                        </button>
                                    </div>
                                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 overflow-y-auto max-h-40">
                                        {classes.map((c: any) => (
                                            <label key={c.id} className="flex items-center space-x-2 cursor-pointer p-2 hover:bg-white rounded-md transition-colors border border-transparent hover:border-gray-200">
                                                <input
                                                    type="checkbox"
                                                    checked={holidayClassIds.includes(c.id)}
                                                    onChange={(e) => {
                                                        if (e.target.checked) setHolidayClassIds([...holidayClassIds, c.id]);
                                                        else setHolidayClassIds(holidayClassIds.filter(id => id !== c.id));
                                                    }}
                                                    className="w-4 h-4 text-sky-600 bg-white border-gray-300 rounded focus:ring-sky-500"
                                                />
                                                <span className="text-sm font-medium text-gray-700">{c.name}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="flex justify-end gap-3 pt-5 border-t mt-6">
                                <button
                                    type="button"
                                    onClick={() => setShowHolidayModal(false)}
                                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:ring-4 focus:outline-none focus:ring-gray-200"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSavingHoliday || (!holidayIsEntireSchool && holidayClassIds.length === 0)}
                                    className="px-5 py-2 text-sm font-medium text-white bg-sky-600 rounded-lg hover:bg-sky-700 focus:ring-4 focus:outline-none focus:ring-sky-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                >
                                    {isSavingHoliday ? "Saving..." : (editingHolidayId ? "Update Holiday" : "Create Holiday")}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </main>
    );
}
