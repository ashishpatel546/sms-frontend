"use client";

import { useState, useEffect } from "react";
import toast, { Toaster } from "react-hot-toast";
import useSWR from "swr";
import { API_BASE_URL, fetcher } from "@/lib/api";
import { Loader } from "@/components/ui/Loader";
import { Plus, Trash2, Edit2, CheckCircle2, XCircle, Settings2, GraduationCap, CalendarDays, Eye } from "lucide-react";
import { useRbac } from "@/lib/rbac";
import { authFetch } from "@/lib/auth";
import { useReadOnlySession, READ_ONLY_TITLE } from "@/lib/support-session";
import { SchoolLanguageCard } from "./SchoolLanguageCard";
import { useLocale, useTranslations } from "next-intl";
import { INTL_LOCALE } from "@/i18n/config";

type SettingsTab = 'system' | 'examination' | 'holidays';

/** Deep link from a holiday push notification (`?tab=holidays`) — holidays have no route of their own, just this tab. Mount-only, matching /dashboard/attendance's read to avoid a Suspense boundary around this page. */
function initialSettingsTab(): SettingsTab {
    if (typeof window === "undefined") return 'system';
    const tab = new URLSearchParams(window.location.search).get('tab');
    return tab === 'examination' || tab === 'holidays' ? tab : 'system';
}

export default function SettingsPage() {
    const t = useTranslations("settings");
    const tc = useTranslations("common");
    const locale = useLocale();
    const [activeTab, setActiveTab] = useState<SettingsTab>(initialSettingsTab);
    const rbac = useRbac();
    const readOnly = useReadOnlySession();

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
            if (e.target instanceof Element &&
                (e.target.closest('.action-dropdown-btn') ||
                e.target.closest('.action-dropdown-menu'))) {
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
                toast.success(editingHolidayId ? t("holidays.updated") : t("holidays.created"));
                setShowHolidayModal(false);
                mutateHolidays();
            } else {
                const data = await res.json();
                toast.error(data.message || t("holidays.saveFailed"));
            }
        } catch {
            toast.error(t("page.networkError"));
        } finally {
            setIsSavingHoliday(false);
        }
    };

    const handleDeleteHoliday = async (id: number) => {
        if (!confirm(t("holidays.deleteConfirm"))) return;
        try {
            const res = await authFetch(`${API_BASE_URL}/holidays/${id}`, { method: "DELETE" });
            if (res.ok) {
                toast.success(t("holidays.deleted"));
                mutateHolidays();
            } else {
                toast.error(t("holidays.deleteFailed"));
            }
        } catch (_err) {
            toast.error(t("page.networkError"));
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
                toast.success(t("sessions.created"));
                setNewSessionName("");
                setNewSessionStart("");
                setNewSessionEnd("");
                mutate();
            } else {
                const data = await res.json();
                toast.error(data.message || t("sessions.createFailed"));
            }
        } catch (_err) {
            toast.error(t("page.networkError"));
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
                toast.success(t("sessions.activeUpdated"));
                mutate();
            }
        } catch (_err) {
            toast.error(t("page.networkError"));
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
                toast.success(t("designations.created"));
                setNewDesigTitle("");
                setNewDesigDesc("");
                mutateDesignations();
            } else {
                const data = await res.json();
                toast.error(data.message || t("designations.createFailed"));
            }
        } catch (_err) {
            toast.error(t("page.networkError"));
        }
    };

    const handleDeleteDesignation = async (id: number) => {
        if (!confirm(t("designations.deleteConfirm"))) return;
        try {
            const res = await authFetch(`${API_BASE_URL}/designations/${id}`, { method: "DELETE" });
            if (res.ok) {
                toast.success(t("designations.deleted"));
                mutateDesignations();
            } else {
                const data = await res.json();
                toast.error(data.message || t("designations.deleteFailed"));
            }
        } catch (_err) {
            toast.error(t("page.networkError"));
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
                toast.success(t("designations.updated"));
                setEditingDesig(null);
                mutateDesignations();
            } else {
                const data = await res.json();
                toast.error(data.message || t("designations.updateFailed"));
            }
        } catch (_err) {
            toast.error(t("page.networkError"));
        }
    };

    // --- Examination Setting Handlers ---
    const handleCreateCategory = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedExamSessionId) return toast.error(t("page.selectSessionFirst"));

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
                toast.success(t("exam.categoryCreated"));
                setNewCategoryName("");
                setNewCategoryDesc("");
                mutateCategories();
            } else {
                const data = await res.json();
                toast.error(data.message || t("exam.categoryCreateFailed"));
            }
        } catch (_err) {
            toast.error(t("page.networkError"));
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
                toast.success(t("exam.categoryStatusUpdated"));
                mutateCategories();
            }
        } catch (_err) {
            toast.error(t("page.networkError"));
        }
    };

    const toggleFinalResultCategory = (id: number) => {
        if (id === selectedTargetCategoryId) {
            toast.error(t("exam.targetCannotContribute"));
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
        if (!selectedExamSessionId) return toast.error(t("page.selectSessionFirst"));

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
                toast.success(t("exam.settingsUpdated"));
                mutateSettings();
            }
        } catch (_err) {
            toast.error(t("page.networkError"));
        }
    };

    const handleCreateGrading = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedGradingSessionId) return toast.error(t("page.selectSessionFirst"));

        const parsedMin = parseFloat(newGradeMin);
        const parsedMax = parseFloat(newGradeMax);
        if (isNaN(parsedMin) || isNaN(parsedMax)) return toast.error(t("grading.invalidPercent"));
        if (parsedMin < 0 || parsedMax < 0) return toast.error(t("grading.negativePercent"));
        if (parsedMax > 100) return toast.error(t("grading.over100"));
        if (parsedMin >= parsedMax) return toast.error(t("grading.minBelowMax"));

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
                toast.success(t("grading.created"));
                setNewGradeName("");
                setNewGradeMin("");
                setNewGradeMax("");
                setNewGradeIsFail(false);
                mutateGradingSystems();
            } else {
                const data = await res.json();
                const errMsg = Array.isArray(data.message) ? data.message[0] : (data.message || t("grading.createFailed"));
                toast.error(errMsg);
            }
        } catch (_err) {
            toast.error(t("page.networkError"));
        }
    };

    const handleDeleteGrading = async (id: number) => {
        if (!confirm(t("grading.deleteConfirm"))) return;
        try {
            const res = await authFetch(`${API_BASE_URL}/exams/grading-system/${id}`, { method: "DELETE" });
            if (res.ok) {
                toast.success(t("grading.deleted"));
                mutateGradingSystems();
            }
        } catch (_err) {
            toast.error(t("page.networkError"));
        }
    };


    // Settings is ADMIN+. Below SUPER_ADMIN it is a reading room with one
    // working desk: `canEditSettings` withholds sessions, designations, exam
    // categories and grading, while the holiday calendar stays editable —
    // that one is routine upkeep, the rest rewrite what every other page
    // reports.
    if (!rbac.canAccessSettings) {
        return (
            <main className="p-8 text-center">
                <p className="text-sm text-ink-muted">
                    {t("page.accessDenied")}
                </p>
            </main>
        );
    }

    const viewOnlyNotice = !rbac.canEditSettings && activeTab !== 'holidays' && (
        <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-accent-edge bg-accent-tint px-4 py-3">
            <Eye className="w-4 h-4 mt-0.5 shrink-0 text-accent-deep" aria-hidden />
            <div className="min-w-0">
                <p className="text-[13.5px] font-semibold text-accent-deep">{t("page.viewOnly")}</p>
                <p className="mt-0.5 text-[12.5px] leading-relaxed text-accent-deep/90">
                    {t.rich("page.viewOnlyBody", {
                        link: (c) => <button type="button" onClick={() => setActiveTab('holidays')} className="underline underline-offset-2 font-semibold cursor-pointer">{c}</button>,
                    })}
                </p>
            </div>
        </div>
    );

    return (
        <main className="p-4 flex-1 h-full overflow-y-auto w-full max-w-7xl mx-auto">
            {error && <div className="p-4 text-red-600 mb-4 bg-red-50 rounded">{t("page.loadSessionsError")}</div>}
            <Toaster position="top-right" />
            <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-6 gap-4 border-b pb-4 border-gray-200">
                <h1 className="font-display text-[22px] sm:text-[26px] font-semibold tracking-[-0.02em] text-ink">{t("page.title")}</h1>
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
                        {t("page.tab.system")}
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
                        {t("page.tab.examination")}
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
                        {t("page.tab.holidays")}
                    </button>
                </div>
            </div>

            {viewOnlyNotice}

            {activeTab === 'system' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <SchoolLanguageCard canEdit={rbac.canEditSettings} readOnly={readOnly} />

                    {/* Academic Sessions panel */}
                    <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
                        <h2 className="text-xl font-bold mb-4 text-slate-800">{t("sessions.title")}</h2>

                        {/* Create Session form — SUPER_ADMIN only; an ADMIN reads the table. */}
                        {rbac.canEditSettings && (
                            <form onSubmit={handleCreateSession} className="mb-8 p-4 bg-slate-50 border border-slate-200 rounded-lg">
                                <h3 className="text-sm font-semibold text-slate-700 mb-3">{t("sessions.addNew")}</h3>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                                    <div>
                                        <label className="block mb-1 text-xs font-medium text-gray-700">{t("sessions.name")}</label>
                                        <input type="text" placeholder={t("sessions.namePlaceholder")} value={newSessionName} onChange={(e) => setNewSessionName(e.target.value)} required className="w-full text-sm border-gray-300 rounded-md shadow-sm focus:ring-brand/40 focus:border-brand" />
                                    </div>
                                    <div>
                                        <label className="block mb-1 text-xs font-medium text-gray-700">{tc("field.startDate")}</label>
                                        <input type="date" value={newSessionStart} onChange={(e) => setNewSessionStart(e.target.value)} required className="w-full text-sm border-gray-300 rounded-md shadow-sm focus:ring-brand/40 focus:border-brand" />
                                    </div>
                                    <div>
                                        <label className="block mb-1 text-xs font-medium text-gray-700">{tc("field.endDate")}</label>
                                        <input type="date" value={newSessionEnd} onChange={(e) => setNewSessionEnd(e.target.value)} required className="w-full text-sm border-gray-300 rounded-md shadow-sm focus:ring-brand/40 focus:border-brand" />
                                    </div>
                                </div>
                                <button type="submit" disabled={readOnly} title={readOnly ? READ_ONLY_TITLE : undefined} className="w-full px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed">{t("sessions.create")}</button>
                            </form>
                        )}

                        {loading ? (
                            <Loader text={t("sessions.loading")} />
                        ) : (
                            <div className="relative overflow-x-auto rounded-lg border border-gray-200">
                                <table className="w-full text-sm text-left text-gray-500">
                                    <thead className="text-xs text-gray-700 uppercase bg-gray-50 border-b">
                                        <tr>
                                            <th scope="col" className="px-4 py-3">{t("page.id")}</th>
                                            <th scope="col" className="px-4 py-3">{tc("field.name")}</th>
                                            <th scope="col" className="px-4 py-3">{t("sessions.period")}</th>
                                            <th scope="col" className="px-4 py-3 text-center">{tc("field.status")}</th>
                                            <th scope="col" className="px-4 py-3 text-right">{t("page.action")}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {sessions.map((s: any) => (
                                            <tr key={s.id} className="bg-white border-b hover:bg-gray-50">
                                                <td className="px-4 py-3 font-mono text-xs text-gray-500">{s.id}</td>
                                                <td className="px-4 py-3 font-semibold text-slate-800">{s.name}</td>
                                                <td className="px-4 py-3 text-xs">
                                                    {t("sessions.periodRange", { start: new Date(s.startDate).toLocaleDateString(INTL_LOCALE[locale]), end: new Date(s.endDate).toLocaleDateString(INTL_LOCALE[locale]) })}
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    {s.isActive ? (
                                                        <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-bold rounded uppercase">{tc("status.active")}</span>
                                                    ) : (
                                                        <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs font-bold rounded uppercase">{tc("status.inactive")}</span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    {!s.isActive && rbac.canEditSettings && (
                                                        <button onClick={() => handleSetActive(s.id)} className="text-blue-600 hover:underline font-medium text-xs">
                                                            {t("sessions.setActive")}
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                        {sessions.length === 0 && (
                                            <tr><td colSpan={4} className="px-4 py-6 text-center text-gray-500 italic">{t("sessions.empty")}</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    {/* Staff Designations panel */}
                    <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
                        <h2 className="text-xl font-bold mb-4 text-slate-800">{t("designations.title")}</h2>

                        {rbac.canEditSettings && (
                            <form onSubmit={handleCreateDesignation} className="mb-8 p-4 bg-slate-50 border border-slate-200 rounded-lg">
                                <h3 className="text-sm font-semibold text-slate-700 mb-3">{t("designations.add")}</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                    <div>
                                        <label className="block mb-1 text-xs font-medium text-gray-700">{t("designations.titleLabel")}</label>
                                        <input type="text" value={newDesigTitle} onChange={(e) => setNewDesigTitle(e.target.value)} required className="w-full text-sm border-gray-300 rounded-md shadow-sm focus:ring-brand/40 focus:border-brand" />
                                    </div>
                                    <div>
                                        <label className="block mb-1 text-xs font-medium text-gray-700">{tc("field.description")}</label>
                                        <input type="text" value={newDesigDesc} onChange={(e) => setNewDesigDesc(e.target.value)} className="w-full text-sm border-gray-300 rounded-md shadow-sm focus:ring-brand/40 focus:border-brand" />
                                    </div>
                                </div>
                                <button type="submit" disabled={readOnly} title={readOnly ? READ_ONLY_TITLE : undefined} className="w-full px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed">{t("designations.create")}</button>
                            </form>
                        )}

                        {/* Edit Designation Modal */}
                        {editingDesig && (
                            <div className="fixed inset-0 z-60 flex items-center justify-center bg-walnut-950/55 backdrop-blur-sm">
                                <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md animate-in zoom-in-95 duration-200">
                                    <h3 className="text-lg font-bold mb-4 text-slate-800">{t("designations.editTitle")}</h3>
                                    <form onSubmit={handleUpdateDesignation}>
                                        <div className="mb-4">
                                            <label className="block mb-2 text-sm font-medium text-gray-900">{t("designations.titleField")}</label>
                                            <input
                                                type="text"
                                                value={editDesigTitle}
                                                onChange={(e) => setEditDesigTitle(e.target.value)}
                                                className="bg-gray-50 border border-gray-300 text-sm rounded-lg block w-full p-2.5 focus:ring-brand/40 focus:border-brand"
                                                required
                                            />
                                        </div>
                                        <div className="mb-6">
                                            <label className="block mb-2 text-sm font-medium text-gray-900">{tc("field.description")}</label>
                                            <input
                                                type="text"
                                                value={editDesigDesc}
                                                onChange={(e) => setEditDesigDesc(e.target.value)}
                                                className="bg-gray-50 border border-gray-300 text-sm rounded-lg block w-full p-2.5 focus:ring-brand/40 focus:border-brand"
                                            />
                                        </div>
                                        <div className="flex gap-3 justify-end">
                                            <button
                                                type="button"
                                                onClick={() => setEditingDesig(null)}
                                                className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                                            >
                                                {tc("action.cancel")}
                                            </button>
                                            <button
                                                type="submit"
                                                disabled={readOnly}
                                                title={readOnly ? READ_ONLY_TITLE : undefined}
                                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                {t("designations.saveChanges")}
                                            </button>
                                        </div>
                                    </form>
                                </div>
                            </div>
                        )}

                        {loadingDesignations ? (
                            <Loader text={t("designations.loading")} />
                        ) : (
                            <div className="relative overflow-x-auto rounded-lg border border-gray-200">
                                <table className="w-full text-sm text-left text-gray-500">
                                    <thead className="text-xs text-gray-700 uppercase bg-gray-50 border-b">
                                        <tr>
                                            <th scope="col" className="px-4 py-3">{t("designations.titleField")}</th>
                                            <th scope="col" className="px-4 py-3">{tc("field.description")}</th>
                                            <th scope="col" className="px-4 py-3 text-right">{t("page.action")}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {designations.map((d: any) => (
                                            <tr key={d.id} className="bg-white border-b hover:bg-gray-50">
                                                <td className="px-4 py-3 font-semibold text-slate-800">{d.title}</td>
                                                <td className="px-4 py-3 text-xs">{d.description || '-'}</td>
                                                <td className="px-4 py-3 text-right">
                                                    {rbac.canEditSettings && (
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
                                                                    className="action-dropdown-menu fixed w-32 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-9999 border border-gray-100"
                                                                    style={{ top: dropdownPosition.top, left: dropdownPosition.left }}
                                                                >
                                                                    <div className="py-1">
                                                                        <button type="button" onClick={(e) => { e.stopPropagation(); setEditingDesig(d); setEditDesigTitle(d.title); setEditDesigDesc(d.description || ""); setOpenDropdownId(null); }} className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">{tc("action.edit")}</button>
                                                                        <button type="button" onClick={(e) => { e.stopPropagation(); handleDeleteDesignation(d.id); setOpenDropdownId(null); }} className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100">{tc("action.delete")}</button>
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                        {designations.length === 0 && (
                                            <tr><td colSpan={3} className="px-4 py-6 text-center text-gray-500 italic">{t("designations.empty")}</td></tr>
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
                                <h2 className="text-xl font-bold text-slate-800">{t("exam.categoriesTitle")}</h2>
                                <div className="mt-2 sm:mt-0">
                                    <label className="text-xs text-slate-500 mr-2 uppercase font-semibold">{t("exam.forSession")}</label>
                                    <select
                                        className="text-sm border-gray-300 rounded-md shadow-sm focus:ring-brand/40 focus:border-brand p-1"
                                        value={selectedExamSessionId || ''}
                                        onChange={(e) => setSelectedExamSessionId(Number(e.target.value))}
                                    >
                                        <option value="">{t("exam.selectSession")}</option>
                                        {sessions.map((s: any) => (
                                            <option key={s.id} value={s.id}>{s.isActive ? t("exam.sessionOption", { name: s.name }) : s.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Create category form — ADMIN+ only */}
                            {rbac.canEditSettings && (
                                <form onSubmit={handleCreateCategory} className="mb-8 p-4 bg-slate-50 border border-slate-200 rounded-lg">
                                    <h3 className="text-sm font-semibold text-slate-700 mb-3">{t("exam.addCategory")}</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                        <div>
                                            <label className="block mb-1 text-xs font-medium text-gray-700">{t("exam.categoryName")}</label>
                                            <input type="text" value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} required className="w-full text-sm border-gray-300 rounded-md shadow-sm focus:ring-brand/40 focus:border-brand" />
                                        </div>
                                        <div>
                                            <label className="block mb-1 text-xs font-medium text-gray-700">{tc("field.description")}</label>
                                            <input type="text" value={newCategoryDesc} onChange={(e) => setNewCategoryDesc(e.target.value)} className="w-full text-sm border-gray-300 rounded-md shadow-sm focus:ring-brand/40 focus:border-brand" />
                                        </div>
                                    </div>
                                    <button type="submit" disabled={readOnly} title={readOnly ? READ_ONLY_TITLE : undefined} className="w-full px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed">{t("exam.createCategory")}</button>
                                </form>
                            )}

                            <div className="relative overflow-x-auto rounded-lg border border-gray-200">
                                <table className="w-full text-sm text-left text-gray-500">
                                    <thead className="text-xs text-gray-700 uppercase bg-gray-50 border-b">
                                        <tr>
                                            <th className="px-4 py-3">{tc("field.name")}</th>
                                            <th className="px-4 py-3 text-center">{tc("field.status")}</th>
                                            <th className="px-4 py-3 text-right">{t("page.action")}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {examCategories.map((c: any) => (
                                            <tr key={c.id} className="bg-white border-b hover:bg-gray-50">
                                                <td className="px-4 py-3 font-semibold text-slate-800">{c.name}</td>
                                                <td className="px-4 py-3 text-center">
                                                    {c.isActive ? (
                                                        <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-bold rounded uppercase">{tc("status.active")}</span>
                                                    ) : (
                                                        <span className="px-2 py-1 bg-gray-100 text-gray-600 text-xs font-bold rounded uppercase">{tc("status.inactive")}</span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    {rbac.canEditSettings && (
                                                        <button onClick={() => handleToggleCategory(c.id, c.isActive)} className="text-blue-600 hover:underline font-medium text-xs">
                                                            {c.isActive ? t("exam.deactivate") : t("exam.activate")}
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                        {examCategories.length === 0 && (
                                            <tr><td colSpan={3} className="px-4 py-6 text-center text-gray-500 italic">{t("exam.noCategories")}</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Final Result Settings panel */}
                        <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
                                <h2 className="text-xl font-bold text-slate-800">{t("exam.finalResultTitle")}</h2>
                                <div className="mt-2 sm:mt-0">
                                    <label className="text-xs text-slate-500 mr-2 uppercase font-semibold">{t("exam.forSession")}</label>
                                    <select
                                        className="text-sm border-gray-300 rounded-md shadow-sm focus:ring-brand/40 focus:border-brand p-1"
                                        value={selectedExamSessionId || ''}
                                        onChange={(e) => setSelectedExamSessionId(Number(e.target.value))}
                                    >
                                        <option value="">{t("exam.selectSession")}</option>
                                        {sessions.map((s: any) => (
                                            <option key={s.id} value={s.id}>{s.isActive ? t("exam.sessionOption", { name: s.name }) : s.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="mb-6">
                                <label className="block mb-2 text-sm font-semibold text-slate-700">{t("exam.targetCategory")}</label>
                                <select
                                    className="w-full text-sm border-gray-300 rounded-md shadow-sm focus:ring-brand/40 focus:border-brand p-2"
                                    value={selectedTargetCategoryId || ''}
                                    onChange={handleTargetCategoryChange}
                                >
                                    <option value="">{t("exam.noneConfigured")}</option>
                                    {examCategories.filter((c: any) => c.isActive).map((c: any) => (
                                        <option key={c.id} value={c.id}>{c.name}</option>
                                    ))}
                                </select>
                                <p className="text-xs text-slate-500 mt-1">{t("exam.targetHint")}</p>
                            </div>

                            <p className="text-sm font-semibold text-slate-700 mb-3">{t("exam.contributing")}</p>
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
                                                className={`rounded ${isTarget ? 'text-gray-400 focus:ring-gray-400 cursor-not-allowed' : 'text-blue-600 focus:ring-brand/40'}`}
                                            />
                                            <span>{c.name} {isTarget && <span className="text-xs italic font-normal text-slate-400">{t("exam.selectedAsTarget")}</span>}</span>
                                        </label>
                                    );
                                })}
                                {examCategories.filter((c: any) => c.isActive).length === 0 && (
                                    <span className="text-sm text-slate-500 italic">{t("exam.createCategoriesFirst")}</span>
                                )}
                            </div>
                            {rbac.canEditSettings && (
                                <button onClick={handleSaveSettings} className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 transition">{t("exam.saveResultSettings")}</button>
                            )}
                        </div>
                    </div>


                    {/* Grading System Engine */}
                    <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
                            <h2 className="text-xl font-bold text-slate-800">{t("grading.title")}</h2>
                            <div className="mt-2 sm:mt-0">
                                <label className="text-xs text-slate-500 mr-2 uppercase font-semibold">{t("exam.forSession")}</label>
                                <select
                                    className="text-sm border-gray-300 rounded-md shadow-sm focus:ring-brand/40 focus:border-brand p-1"
                                    value={selectedGradingSessionId || ''}
                                    onChange={(e) => setSelectedGradingSessionId(Number(e.target.value))}
                                >
                                    <option value="">{t("exam.selectSession")}</option>
                                    {sessions.map((s: any) => (
                                        <option key={s.id} value={s.id}>{s.isActive ? t("exam.sessionOption", { name: s.name }) : s.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Add grading band form — ADMIN+ only */}
                        {rbac.canEditSettings && (
                            <form onSubmit={handleCreateGrading} className="mb-8 p-4 bg-slate-50 border border-slate-200 rounded-lg">
                                <h3 className="text-sm font-semibold text-slate-700 mb-3">{t("grading.addBand")}</h3>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                                    <div>
                                        <label className="block mb-1 text-[10px] uppercase font-bold text-gray-500">{t("grading.gradeLabel")}</label>
                                        <input type="text" value={newGradeName} onChange={(e) => setNewGradeName(e.target.value)} required className="w-full text-sm border-gray-300 rounded-md shadow-sm py-1.5 px-3 focus:ring-brand/40" />
                                    </div>
                                    <div>
                                        <label className="block mb-1 text-[10px] uppercase font-bold text-gray-500">{t("grading.minPercent")}</label>
                                        <input type="number" step="0.01" min="0" max="100" value={newGradeMin} onChange={(e) => setNewGradeMin(e.target.value)} required className="w-full text-sm border-gray-300 rounded-md shadow-sm py-1.5 px-3 focus:ring-brand/40" />
                                    </div>
                                    <div>
                                        <label className="block mb-1 text-[10px] uppercase font-bold text-gray-500">{t("grading.maxPercent")} <span className="text-[9px] font-normal lowercase">{t("grading.excluding")}</span></label>
                                        <input type="number" step="0.01" min="0" max="100" value={newGradeMax} onChange={(e) => setNewGradeMax(e.target.value)} required className="w-full text-sm border-gray-300 rounded-md shadow-sm py-1.5 px-3 focus:ring-brand/40" />
                                    </div>
                                    <div className="flex items-center pt-5">
                                        <label className="flex items-center space-x-2 text-sm font-medium text-slate-800 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={newGradeIsFail}
                                                onChange={(e) => setNewGradeIsFail(e.target.checked)}
                                                className="rounded text-red-600 focus:ring-red-500 h-4 w-4"
                                            />
                                            <span className="text-red-600 font-bold">{t("grading.isFail")}</span>
                                        </label>
                                    </div>
                                </div>
                                <button type="submit" disabled={!selectedGradingSessionId || readOnly} title={readOnly ? READ_ONLY_TITLE : undefined} className="w-full px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 transition disabled:bg-blue-300">{t("grading.addBandButton")}</button>
                            </form>
                        )}

                        {!selectedGradingSessionId ? (
                            <div className="py-8 text-center text-slate-500 italic">{t("grading.selectSession")}</div>
                        ) : (
                            <div className="relative overflow-x-auto rounded-lg border border-gray-200">
                                <table className="w-full text-sm text-left text-gray-500">
                                    <thead className="text-xs text-gray-700 uppercase bg-gray-50 border-b">
                                        <tr>
                                            <th className="px-4 py-3">{t("grading.grade")}</th>
                                            <th className="px-4 py-3 text-center">{t("grading.minPercent")}</th>
                                            <th className="px-4 py-3 text-center">{t("grading.maxPercent")} <span className="text-[10px] font-normal normal-case">{t("grading.excluding")}</span></th>
                                            <th className="px-4 py-3 text-center">{t("grading.effect")}</th>
                                            <th className="px-4 py-3 text-right">{t("page.action")}</th>
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
                                                        <span className="px-2 py-1 bg-red-100 text-red-700 text-xs font-bold rounded uppercase">{t("grading.fail")}</span>
                                                    ) : (
                                                        <span className="px-2 py-1 bg-green-100 text-green-700 text-xs font-bold rounded uppercase">{t("grading.pass")}</span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    {rbac.canEditSettings && (
                                                        <button onClick={() => handleDeleteGrading(g.id)} className="text-red-500 hover:text-red-700 hover:underline font-medium text-xs">
                                                            {tc("action.delete")}
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                        {gradingSystems.length === 0 && (
                                            <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-500 italic">{t("grading.empty")}</td></tr>
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
                        <h2 className="text-xl font-bold text-slate-800">{t("holidays.title")}</h2>
                        {rbac.canManageHolidays && (
                            <button
                                onClick={() => handleOpenHolidayModal()}
                                className="bg-sky-600 hover:bg-sky-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                            >
                                <Plus className="w-4 h-4" /> {t("holidays.add")}
                            </button>
                        )}
                    </div>

                    {loadingHolidays ? (
                        <div className="py-12"><Loader text={t("holidays.loading")} /></div>
                    ) : (
                        <div className="relative overflow-x-auto rounded-lg border border-gray-200">
                            <table className="w-full text-sm text-left text-gray-500">
                                <thead className="text-xs text-gray-700 uppercase bg-gray-50 border-b">
                                    <tr>
                                        <th className="px-4 py-3">{tc("field.description")}</th>
                                        <th className="px-4 py-3">{t("holidays.dateRange")}</th>
                                        <th className="px-4 py-3">{t("holidays.applicability")}</th>
                                        <th className="px-4 py-3 text-right">{tc("action.actions")}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {holidays.map((h: any) => (
                                        <tr key={h.id} className="bg-white border-b hover:bg-gray-50">
                                            <td className="px-4 py-3 font-semibold text-slate-800">{h.description}</td>
                                            <td className="px-4 py-3 whitespace-nowrap">
                                                {new Date(h.startDate).toLocaleDateString(INTL_LOCALE[locale])}
                                                {h.startDate !== h.endDate && ` - ${new Date(h.endDate).toLocaleDateString(INTL_LOCALE[locale])}`}
                                            </td>
                                            <td className="px-4 py-3">
                                                {h.isEntireSchool ? (
                                                    <span className="flex items-center gap-1 text-green-700 text-xs font-bold bg-green-100 px-2 py-1 rounded-full w-max">
                                                        <CheckCircle2 className="w-3 h-3" /> {t("holidays.entireSchool")}
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
                                                        <span className="text-xs text-slate-400 italic">{t("holidays.viewOnly")}</span>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    {holidays.length === 0 && (
                                        <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-500 italic">{t("holidays.empty")}</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* Holiday Modal */}
            {showHolidayModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-walnut-950/55 backdrop-blur-sm">
                    <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
                        <div className="flex justify-between items-center mb-6 border-b pb-4">
                            <h2 className="text-2xl font-bold text-slate-800">{editingHolidayId ? t("holidays.editTitle") : t("holidays.addTitle")}</h2>
                            <button
                                onClick={() => setShowHolidayModal(false)}
                                className="text-gray-400 hover:text-gray-600 transition-colors"
                            >
                                <XCircle className="w-6 h-6" />
                            </button>
                        </div>

                        <form onSubmit={handleSaveHoliday} className="space-y-5">
                            <div>
                                <label className="block mb-1.5 text-sm font-semibold text-gray-900">{tc("field.description")}</label>
                                <input
                                    type="text"
                                    value={holidayDesc}
                                    onChange={(e) => setHolidayDesc(e.target.value)}
                                    placeholder={t("holidays.descriptionPlaceholder")}
                                    className="bg-white border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-sky-500 focus:border-sky-500 block w-full p-2.5"
                                    required
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block mb-1.5 text-sm font-semibold text-gray-900">{tc("field.startDate")}</label>
                                    <input
                                        type="date"
                                        value={holidayStart}
                                        onChange={(e) => setHolidayStart(e.target.value)}
                                        className="bg-white border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-sky-500 focus:border-sky-500 block w-full p-2.5"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block mb-1.5 text-sm font-semibold text-gray-900">{tc("field.endDate")}</label>
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
                                        <span className="text-sm font-bold text-slate-800 block">{t("holidays.entireSchoolQuestion")}</span>
                                        <span className="text-xs text-slate-500 block">{t("holidays.entireSchoolHint")}</span>
                                    </div>
                                </label>
                            </div>

                            {!holidayIsEntireSchool && (
                                <div className="mt-4 p-4 border border-gray-200 rounded-lg bg-gray-50">
                                    <div className="flex justify-between items-center mb-3">
                                        <label className="block text-sm font-semibold text-gray-900">{t("holidays.selectClasses")}</label>
                                        <button
                                            type="button"
                                            onClick={handleHolidaySelectAllClasses}
                                            className="text-xs text-sky-600 hover:text-sky-800 font-bold hover:underline"
                                        >
                                            {holidayClassIds.length === classes.length ? t("holidays.deselectAll") : t("holidays.selectAll")}
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
                                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:ring-4 focus:outline-none focus:ring-line-strong"
                                >
                                    {tc("action.cancel")}
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSavingHoliday || readOnly || (!holidayIsEntireSchool && holidayClassIds.length === 0)}
                                    title={readOnly ? READ_ONLY_TITLE : undefined}
                                    className="px-5 py-2 text-sm font-medium text-white bg-sky-600 rounded-lg hover:bg-sky-700 focus:ring-4 focus:outline-none focus:ring-sky-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                >
                                    {isSavingHoliday ? tc("action.saving") : (editingHolidayId ? t("holidays.update") : t("holidays.create"))}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </main>
    );
}
