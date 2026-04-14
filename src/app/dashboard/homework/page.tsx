"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import toast, { Toaster } from "react-hot-toast";
import { API_BASE_URL } from "@/lib/api";
import { getToken, authFetch, getUser } from "@/lib/auth";

const todayStr = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const formatDate = (dateStr: string) => {
    if (!dateStr) return "";
    const [y, m, d] = dateStr.split("-");
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return `${d} ${months[parseInt(m) - 1]} ${y}`;
};

type HomeworkEntry = {
    id: string;
    subject: string | null;
    message: string;
    homeworkDate: string;
    createdBy: { id: number; firstName: string; lastName: string } | null;
    updatedBy: { id: number; firstName: string; lastName: string } | null;
    createdAt: string;
    updatedAt: string;
};

type ModalRow = { subject: string; message: string };

export default function HomeworkPage() {
    const router = useRouter();
    const authHeaders = { Authorization: `Bearer ${getToken()}` };

    const [classes, setClasses] = useState<any[]>([]);
    const [sections, setSections] = useState<any[]>([]);
    const [selectedClassId, setSelectedClassId] = useState<number | null>(null);
    const [selectedSectionId, setSelectedSectionId] = useState<number | null>(null);
    const [selectedClassName, setSelectedClassName] = useState("");
    const [selectedSectionName, setSelectedSectionName] = useState("");

    const [homework, setHomework] = useState<HomeworkEntry[]>([]);
    const [listLoading, setListLoading] = useState(false);
    const [filterDate, setFilterDate] = useState(todayStr());

    const dateInputRef = useRef<HTMLInputElement>(null);
    const filterDateInputRef = useRef<HTMLInputElement>(null);

    // Send modal
    const [showSendModal, setShowSendModal] = useState(false);
    const [modalDate, setModalDate] = useState(todayStr());
    const [modalRows, setModalRows] = useState<ModalRow[]>([{ subject: "", message: "" }]);
    const [sending, setSending] = useState(false);

    // Edit modal
    const [editEntry, setEditEntry] = useState<HomeworkEntry | null>(null);
    const [editSubject, setEditSubject] = useState("");
    const [editMessage, setEditMessage] = useState("");
    const [editSaving, setEditSaving] = useState(false);

    // Redirect non-teacher/admin users
    useEffect(() => {
        const u = getUser();
        if (u && u.role === "PARENT") router.replace("/parent-dashboard");
    }, [router]);

    // Load classes on mount — use the lightweight endpoint (id+name only) to avoid
    // the N+1 staff-history queries and the eager sections.students join in findAllClasses()
    useEffect(() => {
        authFetch(`${API_BASE_URL}/classes/names-only`, { headers: authHeaders })
            .then((r) => r.json())
            .then((data) => setClasses(Array.isArray(data) ? data : data.data || []))
            .catch(console.error);
    }, []);

    // Load sections when class changes
    useEffect(() => {
        if (!selectedClassId) { setSections([]); setSelectedSectionId(null); return; }
        authFetch(`${API_BASE_URL}/classes/${selectedClassId}/sections`, { headers: authHeaders })
            .then((r) => r.json())
            .then((data) => { setSections(Array.isArray(data) ? data : data.data || []); setSelectedSectionId(null); setSelectedSectionName(""); })
            .catch(console.error);
    }, [selectedClassId]);

    const fetchHomework = useCallback(async () => {
        if (!selectedClassId || !selectedSectionId) { setHomework([]); return; }
        setListLoading(true);
        try {
            const url = filterDate
                ? `${API_BASE_URL}/homework?classId=${selectedClassId}&sectionId=${selectedSectionId}&date=${filterDate}`
                : `${API_BASE_URL}/homework?classId=${selectedClassId}&sectionId=${selectedSectionId}`;
            const res = await authFetch(url, { headers: authHeaders });
            if (res.ok) setHomework(await res.json());
            else setHomework([]);
        } catch { setHomework([]); }
        finally { setListLoading(false); }
    }, [selectedClassId, selectedSectionId, filterDate]);

    useEffect(() => { fetchHomework(); }, [fetchHomework]);

    // ── Send modal helpers ──
    const addRow = () => setModalRows((prev) => [...prev, { subject: "", message: "" }]);
    const removeRow = (i: number) => setModalRows((prev) => prev.filter((_, idx) => idx !== i));
    const updateRow = (i: number, field: keyof ModalRow, value: string) => {
        setModalRows((prev) => { const next = [...prev]; next[i] = { ...next[i], [field]: value }; return next; });
    };

    const openSendModal = () => {
        setModalDate(todayStr());
        setModalRows([{ subject: "", message: "" }]);
        setShowSendModal(true);
    };

    const handleSend = async () => {
        const validEntries = modalRows
            .filter((r) => r.message.trim())
            .map((r) => ({ subject: r.subject.trim() || undefined, message: r.message.trim() }));

        if (!validEntries.length) { toast.error("Add at least one homework entry with a message."); return; }
        if (!selectedClassId || !selectedSectionId) return;

        setSending(true);
        try {
            const res = await authFetch(`${API_BASE_URL}/homework/bulk`, {
                method: "POST",
                headers: { ...authHeaders, "Content-Type": "application/json" },
                body: JSON.stringify({
                    classId: selectedClassId,
                    sectionId: selectedSectionId,
                    homeworkDate: modalDate,
                    entries: validEntries,
                }),
            });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.message || "Failed to send homework");
            }
            toast.success("Homework sent successfully!");
            setShowSendModal(false);
            fetchHomework();
        } catch (e: any) {
            toast.error(e.message || "Something went wrong");
        } finally {
            setSending(false);
        }
    };

    // ── Edit modal helpers ──
    const openEdit = (entry: HomeworkEntry) => {
        setEditEntry(entry);
        setEditSubject(entry.subject || "");
        setEditMessage(entry.message);
    };

    const handleUpdate = async () => {
        if (!editEntry) return;
        if (!editMessage.trim()) { toast.error("Message cannot be empty."); return; }
        setEditSaving(true);
        try {
            const res = await authFetch(`${API_BASE_URL}/homework/${editEntry.id}`, {
                method: "PATCH",
                headers: { ...authHeaders, "Content-Type": "application/json" },
                body: JSON.stringify({ subject: editSubject.trim() || undefined, message: editMessage.trim() }),
            });
            if (!res.ok) throw new Error("Failed to update");
            toast.success("Homework updated.");
            setEditEntry(null);
            fetchHomework();
        } catch (e: any) {
            toast.error(e.message || "Update failed");
        } finally {
            setEditSaving(false);
        }
    };

    const handleDelete = async (entry: HomeworkEntry) => {
        if (!confirm(`Delete "${entry.subject || "homework"}" for ${formatDate(entry.homeworkDate)}?`)) return;
        try {
            await authFetch(`${API_BASE_URL}/homework/${entry.id}`, { method: "DELETE", headers: authHeaders });
            toast.success("Deleted.");
            setHomework((prev) => prev.filter((h) => h.id !== entry.id));
        } catch {
            toast.error("Delete failed");
        }
    };

    // Group homework by date
    const grouped = homework.reduce<Record<string, HomeworkEntry[]>>((acc, h) => {
        (acc[h.homeworkDate] = acc[h.homeworkDate] || []).push(h);
        return acc;
    }, {});
    const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

    return (
        <div className="p-4 sm:p-6 max-w-5xl mx-auto">
            <Toaster position="top-right" />

            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">📚 Homework</h1>
                    <p className="text-slate-500 text-sm mt-0.5">Manage and send homework to students by class and section.</p>
                </div>
                <button
                    onClick={openSendModal}
                    disabled={!selectedClassId || !selectedSectionId}
                    className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-semibold rounded-xl text-sm transition-colors shrink-0"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                    Send Homework
                </button>
            </div>

            {/* Class + Section + Date Filters */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 mb-6 shadow-sm">
                <div className="flex flex-col sm:flex-row gap-4">
                    <div className="flex-1">
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Class</label>
                        <select
                            value={selectedClassId || ""}
                            onChange={(e) => {
                                const id = Number(e.target.value);
                                const cls = classes.find((c) => c.id === id);
                                setSelectedClassId(id || null);
                                setSelectedClassName(cls?.name || "");
                                setHomework([]);
                            }}
                            className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                            <option value="">— Select Class —</option>
                            {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    </div>
                    <div className="flex-1">
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Section</label>
                        <select
                            value={selectedSectionId || ""}
                            disabled={!selectedClassId || !sections.length}
                            onChange={(e) => {
                                const id = Number(e.target.value);
                                const sec = sections.find((s) => s.id === id);
                                setSelectedSectionId(id || null);
                                setSelectedSectionName(sec?.name || "");
                            }}
                            className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-800 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <option value="">— Select Section —</option>
                            {sections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                    </div>
                    <div className="flex-1">
                        <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Date</label>
                        <div className="relative">
                            <button
                                type="button"
                                onClick={() => filterDateInputRef.current?.showPicker()}
                                disabled={!selectedClassId || !selectedSectionId}
                                className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                                    filterDate
                                        ? "bg-indigo-50 border-indigo-400 text-indigo-700 font-medium"
                                        : "bg-slate-50 border-slate-200 text-slate-500 hover:border-indigo-400 hover:text-indigo-600"
                                }`}
                            >
                                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                <span className="flex-1 text-left">{filterDate ? formatDate(filterDate) : "All dates"}</span>
                                {filterDate && (
                                    <span
                                        role="button"
                                        onClick={(e) => { e.stopPropagation(); setFilterDate(""); }}
                                        className="ml-auto text-indigo-400 hover:text-indigo-700"
                                        title="Clear date"
                                    >✕</span>
                                )}
                            </button>
                            <input
                                ref={filterDateInputRef}
                                type="date"
                                value={filterDate}
                                onChange={(e) => setFilterDate(e.target.value)}
                                className="absolute bottom-0 left-1/2 -translate-x-1/2 w-px h-px opacity-0 pointer-events-none"
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* Homework List */}
            {!selectedClassId || !selectedSectionId ? (
                <div className="text-center py-20 bg-white border border-dashed border-slate-200 rounded-2xl">
                    <div className="text-5xl mb-3 opacity-40">📚</div>
                    <p className="text-slate-500 font-medium">Select a class and section to view homework.</p>
                </div>
            ) : listLoading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-3">
                    <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                    <p className="text-slate-400 text-sm">Loading homework...</p>
                </div>
            ) : sortedDates.length === 0 ? (
                <div className="text-center py-20 bg-white border border-dashed border-slate-200 rounded-2xl">
                    <div className="text-5xl mb-3 opacity-40">🗒️</div>
                    {filterDate ? (
                        <>
                            <p className="text-slate-500 font-medium">No homework for {formatDate(filterDate)}.</p>
                            <p className="text-slate-400 text-sm mt-1">
                                <button onClick={() => setFilterDate("")} className="underline hover:text-indigo-600">Clear filter</button> to see all dates, or send homework for this date.
                            </p>
                        </>
                    ) : (
                        <>
                            <p className="text-slate-500 font-medium">No homework found for {selectedClassName} — {selectedSectionName}.</p>
                            <p className="text-slate-400 text-sm mt-1">Click "Send Homework" to add the first entry.</p>
                        </>
                    )}
                </div>
            ) : (
                <div className="space-y-5">
                    {sortedDates.map((date) => (
                        <div key={date} className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                            <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
                                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">📅 {formatDate(date)}</span>
                            </div>
                            <div className="divide-y divide-slate-100">
                                {grouped[date].map((h) => (
                                    <div key={h.id} className="px-5 py-4 flex items-start gap-4 hover:bg-slate-50 transition-colors">
                                        <div className="flex-1 min-w-0">
                                            {h.subject && (
                                                <span className="inline-block px-2.5 py-0.5 bg-indigo-50 text-indigo-700 text-xs font-semibold rounded-full border border-indigo-100 mb-1.5">
                                                    {h.subject}
                                                </span>
                                            )}
                                            <p className="text-slate-800 text-sm leading-relaxed whitespace-pre-line">{h.message}</p>
                                            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-slate-400">
                                                {h.createdBy && (
                                                    <span>Sent by {h.createdBy.firstName} {h.createdBy.lastName} · {new Date(h.createdAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                                                )}
                                                {h.updatedBy && (
                                                    <span className="text-amber-500">Edited by {h.updatedBy.firstName} {h.updatedBy.lastName} · {new Date(h.updatedAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex gap-1 shrink-0">
                                            <button
                                                onClick={() => openEdit(h)}
                                                className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                                title="Edit"
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                            </button>
                                            <button
                                                onClick={() => handleDelete(h)}
                                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                title="Delete"
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* ── Send Homework Modal ── */}
            {showSendModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh]">
                        {/* Modal Header */}
                        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0">
                            <div>
                                <h2 className="text-lg font-bold text-slate-900">📝 Send Homework</h2>
                                <p className="text-xs text-slate-500 mt-0.5">{selectedClassName} — Section {selectedSectionName}</p>
                            </div>
                            <button onClick={() => setShowSendModal(false)} className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="px-6 py-4 overflow-y-auto flex-1">
                            {/* Date */}
                            <div className="mb-5">
                                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Date</label>
                                <div className="flex items-center gap-2 flex-wrap">
                                    {/* Quick chips */}
                                    {[
                                        { label: "Yesterday", offset: -1 },
                                        { label: "Today", offset: 0 },
                                        { label: "Tomorrow", offset: 1 },
                                    ].map(({ label, offset }) => {
                                        const d = new Date();
                                        d.setDate(d.getDate() + offset);
                                        const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
                                        const active = modalDate === val;
                                        return (
                                            <button
                                                key={label}
                                                type="button"
                                                onClick={() => setModalDate(val)}
                                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                                                    active
                                                        ? "bg-indigo-600 text-white border-indigo-600"
                                                        : "bg-white text-slate-600 border-slate-200 hover:border-indigo-400 hover:text-indigo-600"
                                                }`}
                                            >
                                                {label}
                                            </button>
                                        );
                                    })}
                                    {/* Styled calendar trigger */}
                                    <div className="relative">
                                        <button
                                            type="button"
                                            onClick={() => dateInputRef.current?.showPicker()}
                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-slate-200 bg-white text-slate-600 hover:border-indigo-400 hover:text-indigo-600 transition-colors"
                                        >
                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                                            {formatDate(modalDate)}
                                        </button>
                                        <input
                                            ref={dateInputRef}
                                            type="date"
                                            value={modalDate}
                                            max={new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]}
                                            onChange={(e) => setModalDate(e.target.value)}
                                            className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                                            tabIndex={-1}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Rows */}
                            <div className="mb-4">
                                <div className="grid grid-cols-[180px_1fr_32px] gap-2 mb-2 text-xs font-semibold text-slate-400 uppercase tracking-wide px-1">
                                    <span>Subject (optional)</span>
                                    <span>Homework</span>
                                    <span />
                                </div>
                                <div className="space-y-3">
                                    {modalRows.map((row, i) => (
                                        <div key={i} className="grid grid-cols-[180px_1fr_32px] gap-2 items-start">
                                            <input
                                                type="text"
                                                placeholder="e.g. Mathematics"
                                                value={row.subject}
                                                onChange={(e) => updateRow(i, "subject", e.target.value)}
                                                className="border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                                            />
                                            <textarea
                                                placeholder="Describe the homework task..."
                                                value={row.message}
                                                onChange={(e) => updateRow(i, "message", e.target.value)}
                                                rows={2}
                                                className="border border-slate-200 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400"
                                            />
                                            <button
                                                onClick={() => removeRow(i)}
                                                disabled={modalRows.length === 1}
                                                className="mt-1 p-1.5 text-slate-300 hover:text-red-500 disabled:opacity-0 rounded-lg transition-colors"
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <button onClick={addRow} className="flex items-center gap-1.5 text-indigo-600 hover:text-indigo-800 text-sm font-medium transition-colors">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                                Add Subject
                            </button>

                            <div className="mt-4 p-3 bg-indigo-50 rounded-xl border border-indigo-100 text-xs text-indigo-700">
                                📣 A push notification will be sent to all parents of <strong>{selectedClassName} — Section {selectedSectionName}</strong>.
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="px-6 py-4 border-t border-slate-100 flex gap-3 justify-end shrink-0">
                            <button onClick={() => setShowSendModal(false)} className="px-4 py-2 text-slate-600 hover:text-slate-900 text-sm font-medium transition-colors">
                                Cancel
                            </button>
                            <button
                                onClick={handleSend}
                                disabled={sending}
                                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-semibold rounded-xl text-sm transition-colors"
                            >
                                {sending ? "Sending..." : "Send Homework"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Edit Modal ── */}
            {editEntry && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
                        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                            <h2 className="text-lg font-bold text-slate-900">✏️ Edit Homework</h2>
                            <button onClick={() => setEditEntry(null)} className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
                        <div className="px-6 py-5 space-y-4">
                            <p className="text-xs text-slate-400">{formatDate(editEntry.homeworkDate)} · {selectedClassName} — {selectedSectionName}</p>
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Subject (optional)</label>
                                <input
                                    type="text"
                                    value={editSubject}
                                    onChange={(e) => setEditSubject(e.target.value)}
                                    placeholder="e.g. Mathematics"
                                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Homework</label>
                                <textarea
                                    value={editMessage}
                                    onChange={(e) => setEditMessage(e.target.value)}
                                    rows={4}
                                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>
                        </div>
                        <div className="px-6 py-4 border-t border-slate-100 flex gap-3 justify-end">
                            <button onClick={() => setEditEntry(null)} className="px-4 py-2 text-slate-600 text-sm font-medium">
                                Cancel
                            </button>
                            <button
                                onClick={handleUpdate}
                                disabled={editSaving}
                                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-semibold rounded-xl text-sm transition-colors"
                            >
                                {editSaving ? "Saving..." : "Save Changes"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
