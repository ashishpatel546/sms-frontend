"use client";

import React, { useState, useEffect, useRef } from "react";
import useSWR from "swr";
import { API_BASE_URL, fetcher } from "@/lib/api";
import { authFetch } from "@/lib/auth";
import { Loader } from "@/components/ui/Loader";
import toast from "react-hot-toast";

interface Props {
    studentId: number | null;
    sessionId: number | null;
    mode?: 'view' | 'enter' | 'admin-edit';
    defaultCategoryId?: number;
    onClose: () => void;
    onSave?: () => void;
}

export default function StudentResultModal({ studentId, sessionId, mode = 'view', defaultCategoryId, onClose, onSave }: Props) {
    const { data: categories = [], isLoading: catsLoading } = useSWR(
        sessionId ? `${API_BASE_URL}/exams/categories/active?sessionId=${sessionId}` : null,
        fetcher
    );
    const { data: marks = [], isLoading: marksLoading, mutate: mutateMarks } = useSWR(
        studentId && sessionId ? `${API_BASE_URL}/exams/marks/${sessionId}/${studentId}` : null,
        fetcher
    );
    const { data: student, isLoading: studentLoading } = useSWR(
        studentId ? `${API_BASE_URL}/students/${studentId}` : null,
        fetcher
    );
    const { data: examSettings, isLoading: settingsLoading } = useSWR(
        sessionId ? `${API_BASE_URL}/exams/settings?sessionId=${sessionId}` : null,
        fetcher
    );
    const { data: gradingSystems = [], isLoading: gradingLoading } = useSWR(
        sessionId ? `${API_BASE_URL}/exams/grading-system/session/${sessionId}` : null,
        fetcher
    );

    const [selectedCategoryIds, setSelectedCategoryIds] = useState<Set<number>>(new Set());
    const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
    const categoryDropdownRef = useRef<HTMLDivElement>(null);
    const [editedMarks, setEditedMarks] = useState<any[]>([]);
    const [auditCard, setAuditCard] = useState<any | null>(null);

    // Initialise selected categories whenever the category list or defaultCategoryId changes
    useEffect(() => {
        if (categories.length === 0) return;
        if (defaultCategoryId) {
            setSelectedCategoryIds(new Set([defaultCategoryId]));
        } else {
            setSelectedCategoryIds(new Set(categories.map((c: any) => c.id)));
        }
    }, [categories, defaultCategoryId]);

    // Close category dropdown on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (categoryDropdownRef.current && !categoryDropdownRef.current.contains(e.target as Node)) {
                setShowCategoryDropdown(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    useEffect(() => {
        if (marks.length && student) {
            setEditedMarks(JSON.parse(JSON.stringify(marks)));
        } else if (student && student.studentSubjects) {
            const initialMarks: any[] = [];
            student.studentSubjects.forEach((ss: any) => {
                const subject = ss.subject || ss.extraSubject;
                categories.forEach((cat: any) => {
                    initialMarks.push({
                        subjectId: subject.id,
                        subjectName: subject.name,
                        examCategoryId: cat.id,
                        examCategoryName: cat.name,
                        totalMarks: '',
                        obtainedMarks: '',
                        grade: '',
                        isPass: null
                    });
                });
            });
            setEditedMarks(initialMarks);
        }
    }, [marks, student, categories]);

    if (!studentId || !sessionId) return null;

    const isLoading = catsLoading || marksLoading || studentLoading || gradingLoading || settingsLoading;

    const allCategoriesSelected = categories.length > 0 && selectedCategoryIds.size === categories.length;

    const toggleCategory = (id: number) => {
        setSelectedCategoryIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) {
                if (next.size === 1) return prev; // always keep at least one
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    };

    const toggleAllCategories = () => {
        if (allCategoriesSelected) {
            // Collapse to first category only
            if (categories.length > 0) setSelectedCategoryIds(new Set([categories[0].id]));
        } else {
            setSelectedCategoryIds(new Set(categories.map((c: any) => c.id)));
        }
    };

    const visibleCategories: any[] = categories.filter((c: any) => selectedCategoryIds.has(c.id));

    const getMark = (subjectId: number, catId: number) =>
        editedMarks.find(m => m.subjectId === subjectId && m.examCategoryId === catId) || {};

    /** Whether a category column has editable inputs */
    const isCatEditable = (catId: number): boolean => {
        if (mode === 'view') return false;
        if (defaultCategoryId && catId !== defaultCategoryId) return false;
        return true;
    };

    /** Whether a specific cell's input should be interactable (not just editable column) */
    const isCellInputActive = (catId: number, markRecord: any): boolean => {
        if (!isCatEditable(catId)) return false;
        if (mode === 'admin-edit') return true;
        // 'enter' mode: editable only if no saved record yet
        return !markRecord.id;
    };

    const getAuditTooltip = (markRecord: any): string => {
        if (!markRecord.id) return '';
        const parts: string[] = [];
        if (markRecord.createdByName) {
            const date = markRecord.createdAt ? new Date(markRecord.createdAt).toLocaleDateString() : '';
            parts.push(`Entered by: ${markRecord.createdByName}${date ? ` on ${date}` : ''}`);
        }
        if (markRecord.updatedByName) {
            const date = markRecord.updatedAt ? new Date(markRecord.updatedAt).toLocaleDateString() : '';
            parts.push(`Last modified by: ${markRecord.updatedByName}${date ? ` on ${date}` : ''}`);
        }
        return parts.join('\n');
    };

    const handleMarkChange = (subjectId: number, catId: number, field: string, value: any) => {
        setEditedMarks(prev => {
            const next = [...prev];
            const idx = next.findIndex(m => m.subjectId === subjectId && m.examCategoryId === catId);
            if (idx !== -1) {
                next[idx] = { ...next[idx], [field]: value };
            } else {
                next.push({
                    subjectId, examCategoryId: catId,
                    theoryTotalMarks: '', theoryObtainedMarks: '', practicalTotalMarks: '', practicalObtainedMarks: '',
                    totalMarks: '', obtainedMarks: '', grade: '', isPass: null, [field]: value
                });
            }
            return next;
        });
    };

    const handleSave = async () => {
        try {
            // Only save marks for categories that are actually editable
            const marksToSave = editedMarks.filter(m => {
                if (!isCatEditable(m.examCategoryId)) return false;
                const markRecord = getMark(m.subjectId, m.examCategoryId);
                if (!isCellInputActive(m.examCategoryId, markRecord)) return false;
                // Skip if no data entered
                return (m.totalMarks ?? '') !== '' || (m.obtainedMarks ?? '') !== '' ||
                    (m.theoryTotalMarks ?? '') !== '' || (m.theoryObtainedMarks ?? '') !== '' ||
                    (m.practicalTotalMarks ?? '') !== '' || (m.practicalObtainedMarks ?? '') !== '';
            });

            // Validate
            const invalidMark = marksToSave.find(m => {
                const ss = student?.studentSubjects?.find((s: any) => (s.subject?.id || s.extraSubject?.id) === m.subjectId);
                const isSplit = ss?.subject?.hasTheory && ss?.subject?.hasPractical;
                if (isSplit) {
                    const invalidTh = m.theoryTotalMarks != null && m.theoryTotalMarks !== '' && m.theoryObtainedMarks != null && m.theoryObtainedMarks !== '' && Number(m.theoryObtainedMarks) > Number(m.theoryTotalMarks);
                    const invalidPr = m.practicalTotalMarks != null && m.practicalTotalMarks !== '' && m.practicalObtainedMarks != null && m.practicalObtainedMarks !== '' && Number(m.practicalObtainedMarks) > Number(m.practicalTotalMarks);
                    return invalidTh || invalidPr;
                } else {
                    if (m.totalMarks == null || m.totalMarks === '' || m.obtainedMarks == null || m.obtainedMarks === '') return false;
                    return Number(m.obtainedMarks) > Number(m.totalMarks);
                }
            });

            if (invalidMark) {
                toast.error("Obtained marks cannot exceed Total marks.");
                return;
            }

            for (const mark of marksToSave) {
                await authFetch(`${API_BASE_URL}/exams/marks/student/${studentId}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        classId: student.class?.id,
                        sectionId: student.section?.id,
                        sessionId,
                        subjectId: mark.subjectId,
                        examCategoryId: mark.examCategoryId,
                        totalMarks: mark.totalMarks !== '' && mark.totalMarks !== null ? Number(mark.totalMarks) : undefined,
                        obtainedMarks: mark.obtainedMarks !== '' && mark.obtainedMarks !== null ? Number(mark.obtainedMarks) : undefined,
                        theoryTotalMarks: mark.theoryTotalMarks !== '' && mark.theoryTotalMarks !== null ? Number(mark.theoryTotalMarks) : undefined,
                        theoryObtainedMarks: mark.theoryObtainedMarks !== '' && mark.theoryObtainedMarks !== null ? Number(mark.theoryObtainedMarks) : undefined,
                        practicalTotalMarks: mark.practicalTotalMarks !== '' && mark.practicalTotalMarks !== null ? Number(mark.practicalTotalMarks) : undefined,
                        practicalObtainedMarks: mark.practicalObtainedMarks !== '' && mark.practicalObtainedMarks !== null ? Number(mark.practicalObtainedMarks) : undefined,
                    })
                });
            }
            toast.success("Marks saved successfully!");
            mutateMarks();
            onSave?.();
            onClose();
        } catch (_err) {
            toast.error("Failed to save marks. You may not have permission to edit existing marks.");
        }
    };

    const canSave = mode !== 'view';

    /** Opens the audit info card for a saved mark record */
    const openAuditCard = (markRecord: any) => {
        if (!markRecord.id) return;
        if (!markRecord.createdByName && !markRecord.updatedByName) return;
        setAuditCard(markRecord);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center p-0 sm:p-4 bg-slate-900/50 backdrop-blur-sm">
            {/* Audit info card */}
            {auditCard && (
                <div className="fixed inset-0 z-60 flex items-center justify-center p-4" onClick={() => setAuditCard(null)}>
                    <div className="bg-white rounded-xl shadow-2xl border border-gray-200 p-5 w-full max-w-xs" onClick={e => e.stopPropagation()}>
                        <div className="flex justify-between items-center mb-4">
                            <h4 className="text-sm font-bold text-slate-800">Marks Audit Info</h4>
                            <button onClick={() => setAuditCard(null)} className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                        </div>
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
            <div className="bg-white rounded-none sm:rounded-xl shadow-xl w-full sm:max-w-6xl h-full sm:h-auto sm:max-h-[95vh] flex flex-col overflow-hidden">
                {/* Header */}
                <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 bg-slate-50 shrink-0">
                    <h3 className="text-base sm:text-xl font-bold text-slate-800">
                        Exam Results{student ? ` — ${student.firstName} ${student.lastName}` : ''}
                    </h3>
                    <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                        {/* Category multi-select dropdown */}
                        <div className="relative" ref={categoryDropdownRef}>
                            <button
                                type="button"
                                onClick={() => setShowCategoryDropdown(prev => !prev)}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-300 rounded-lg bg-white hover:bg-gray-50 text-slate-600 min-h-9"
                            >
                                <span>Categories ({selectedCategoryIds.size}/{categories.length})</span>
                                <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                            </button>
                            {showCategoryDropdown && (
                                <div className="absolute right-0 z-30 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg py-1.5 min-w-[180px]">
                                    <label className="flex items-center gap-2 px-4 py-2 text-sm cursor-pointer hover:bg-gray-50 border-b border-gray-100">
                                        <input
                                            type="checkbox"
                                            checked={allCategoriesSelected}
                                            onChange={toggleAllCategories}
                                            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                        />
                                        <span className="font-medium text-slate-700">Show All Categories</span>
                                    </label>
                                    {categories.map((cat: any) => (
                                        <label key={cat.id} className="flex items-center gap-2 px-4 py-2 text-sm cursor-pointer hover:bg-gray-50">
                                            <input
                                                type="checkbox"
                                                checked={selectedCategoryIds.has(cat.id)}
                                                onChange={() => toggleCategory(cat.id)}
                                                className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                            />
                                            <span className="text-slate-600">{cat.name}</span>
                                        </label>
                                    ))}
                                </div>
                            )}
                        </div>
                        {canSave && (
                            <button
                                onClick={handleSave}
                                className="px-3 sm:px-4 py-1.5 sm:py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 min-h-9"
                            >
                                Save Changes
                            </button>
                        )}
                        <button onClick={onClose} className="text-slate-500 hover:text-slate-800 p-1.5 rounded-lg hover:bg-slate-100">
                            <span className="sr-only">Close</span>
                            <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>
                </div>

                {/* Mode badge */}
                {mode !== 'view' && (
                    <div className={`px-4 sm:px-6 py-2 text-xs font-medium shrink-0 ${mode === 'admin-edit' ? 'bg-amber-50 text-amber-700 border-b border-amber-200' : 'bg-blue-50 text-blue-700 border-b border-blue-200'}`}>
                        {mode === 'admin-edit'
                            ? '⚙ Admin Edit Mode — all marks for the selected category are editable'
                            : '✏ Enter Marks Mode — only subjects without saved marks can be entered'}
                        {defaultCategoryId && categories.find((c: any) => c.id === defaultCategoryId)
                            ? ` · Category: ${categories.find((c: any) => c.id === defaultCategoryId).name}`
                            : ''}
                    </div>
                )}

                {/* Body */}
                <div className="p-3 sm:p-6 overflow-y-auto flex-1">
                    {isLoading ? (
                        <div className="py-12"><Loader text="Loading result data..." /></div>
                    ) : (
                        <div className="relative overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
                            <table className="w-full text-sm text-left text-gray-500 min-w-[500px]">
                                <thead className="text-xs text-gray-700 uppercase bg-gray-50 border-b">
                                    <tr>
                                        <th className="px-4 py-3 bg-gray-100 sticky left-0 z-10 w-40 sm:w-48 align-bottom" rowSpan={2}>Subject</th>
                                        {visibleCategories.map((cat: any) => (
                                            <th key={cat.id} className={`px-4 py-3 text-center border-l border-gray-300 ${isCatEditable(cat.id) ? 'bg-blue-50' : 'bg-gray-100'}`} colSpan={6}>
                                                {cat.name}
                                                {isCatEditable(cat.id) && <span className="ml-1 text-[9px] text-blue-500 normal-case">(editable)</span>}
                                            </th>
                                        ))}
                                    </tr>
                                    <tr>
                                        {visibleCategories.map((cat: any) => (
                                            <React.Fragment key={`sub-${cat.id}`}>
                                                <th className="px-2 py-2 text-center text-[10px] text-gray-500 border-l border-gray-300 bg-gray-50">Th. Marks</th>
                                                <th className="px-2 py-2 text-center text-[10px] text-gray-500 border-l border-gray-200 bg-purple-50">Pr. Marks</th>
                                                <th className="px-2 py-2 text-center text-[10px] text-gray-500 border-l border-gray-200 bg-gray-50">Total</th>
                                                <th className="px-2 py-2 text-center text-[10px] text-gray-500 border-l border-gray-200 bg-gray-50">Obtained</th>
                                                <th className="px-2 py-2 text-center text-[10px] text-blue-600 border-l border-gray-200 bg-blue-50/50">%</th>
                                                <th className="px-2 py-2 text-center text-[10px] text-gray-500 border-l border-gray-200 bg-gray-50">Grade / Status</th>
                                            </React.Fragment>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {student?.studentSubjects?.map((ss: any) => {
                                        const subject = ss.subject || ss.extraSubject;
                                        if (!subject) return null;
                                        return (
                                            <tr key={subject.id} className="bg-white border-b hover:bg-gray-50">
                                                <td className="px-4 py-3 font-semibold text-slate-800 bg-white sticky left-0 z-10 text-xs sm:text-sm">
                                                    {subject.name}
                                                </td>
                                                {visibleCategories.map((cat: any) => {
                                                    const m = getMark(subject.id, cat.id);
                                                    const isTargetCategory = examSettings?.finalTargetCategoryId === cat.id;
                                                    const isSplit = subject.hasTheory && subject.hasPractical;
                                                    const canEdit = isCellInputActive(cat.id, m) && !isTargetCategory;

                                                    const isInvalidTh = isSplit && m.theoryTotalMarks != null && m.theoryTotalMarks !== '' && m.theoryObtainedMarks != null && m.theoryObtainedMarks !== '' && Number(m.theoryObtainedMarks) > Number(m.theoryTotalMarks);
                                                    const isInvalidPr = isSplit && m.practicalTotalMarks != null && m.practicalTotalMarks !== '' && m.practicalObtainedMarks != null && m.practicalObtainedMarks !== '' && Number(m.practicalObtainedMarks) > Number(m.practicalTotalMarks);
                                                    const isInvalidBase = !isSplit && m.totalMarks != null && m.totalMarks !== '' && m.obtainedMarks != null && m.obtainedMarks !== '' && Number(m.obtainedMarks) > Number(m.totalMarks);

                                                    const calculatedTotal = isSplit ? (Number(m.theoryTotalMarks || 0) + Number(m.practicalTotalMarks || 0)) : Number(m.totalMarks || 0);
                                                    const calculatedObtained = isSplit ? (Number(m.theoryObtainedMarks || 0) + Number(m.practicalObtainedMarks || 0)) : Number(m.obtainedMarks || 0);
                                                    const auditTooltip = getAuditTooltip(m);

                                                    // Locked style: existing mark in enter mode for non-focused or already-saved
                                                    const isLockedEnter = isCatEditable(cat.id) && mode === 'enter' && m.id;

                                                    return (
                                                        <React.Fragment key={`td-${cat.id}`}>
                                                            {/* Theory Marks */}
                                                            <td className="px-2 py-2 border-l border-gray-300 text-center">
                                                                {isSplit ? (
                                                                    canEdit ? (
                                                                        <div className="flex flex-col items-center gap-1">
                                                                            <input type="number" min="0" placeholder="Tot"
                                                                                className="w-14 p-1 text-center border border-gray-300 rounded text-[10px] focus:ring-blue-500 focus:border-blue-500"
                                                                                value={m.theoryTotalMarks ?? ''}
                                                                                onChange={e => handleMarkChange(subject.id, cat.id, 'theoryTotalMarks', e.target.value)} />
                                                                            <input type="number" min="0" placeholder="Obt"
                                                                                className={`w-14 p-1 text-center border rounded text-[10px] ${isInvalidTh ? 'border-red-500 bg-red-50 text-red-700' : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'}`}
                                                                                value={m.theoryObtainedMarks ?? ''}
                                                                                onChange={e => handleMarkChange(subject.id, cat.id, 'theoryObtainedMarks', e.target.value)} />
                                                                        </div>
                                                                    ) : (m.theoryTotalMarks ? <div className="text-[10px]">Obt: <span className="font-bold">{m.theoryObtainedMarks ?? '-'}</span><br />Tot: {m.theoryTotalMarks}</div> : '-')
                                                                ) : <span className="text-gray-300">—</span>}
                                                            </td>
                                                            {/* Practical Marks */}
                                                            <td className="px-2 py-2 border-l border-gray-300 text-center bg-purple-50/50">
                                                                {isSplit ? (
                                                                    canEdit ? (
                                                                        <div className="flex flex-col items-center gap-1">
                                                                            <input type="number" min="0" placeholder="Tot"
                                                                                className="w-14 p-1 text-center border border-gray-300 rounded text-[10px] focus:ring-purple-500 focus:border-purple-500"
                                                                                value={m.practicalTotalMarks ?? ''}
                                                                                onChange={e => handleMarkChange(subject.id, cat.id, 'practicalTotalMarks', e.target.value)} />
                                                                            <input type="number" min="0" placeholder="Obt"
                                                                                className={`w-14 p-1 text-center border rounded text-[10px] ${isInvalidPr ? 'border-red-500 bg-red-50 text-red-700' : 'border-gray-300 focus:ring-purple-500 focus:border-purple-500'}`}
                                                                                value={m.practicalObtainedMarks ?? ''}
                                                                                onChange={e => handleMarkChange(subject.id, cat.id, 'practicalObtainedMarks', e.target.value)} />
                                                                        </div>
                                                                    ) : (m.practicalTotalMarks ? <div className="text-[10px] text-purple-900">Obt: <span className="font-bold">{m.practicalObtainedMarks ?? '-'}</span><br />Tot: {m.practicalTotalMarks}</div> : '-')
                                                                ) : <span className="text-gray-300">—</span>}
                                                            </td>
                                                            {/* Total Marks */}
                                                            <td className="px-2 py-2 border-l border-gray-300 text-center">
                                                                {isSplit ? (
                                                                    <span className="font-bold text-slate-600">{calculatedTotal > 0 ? calculatedTotal : '-'}</span>
                                                                ) : (
                                                                    canEdit ? (
                                                                        <input type="number" min="0"
                                                                            className="w-16 p-1 text-center border border-gray-300 rounded text-xs focus:ring-blue-500 focus:border-blue-500"
                                                                            value={m.totalMarks ?? ''}
                                                                            onChange={e => handleMarkChange(subject.id, cat.id, 'totalMarks', e.target.value)} />
                                                                    ) : (isLockedEnter
                                                                        ? <span className="text-gray-400 text-xs" title="Marks already saved">{m.totalMarks ?? '-'}</span>
                                                                        : <span>{m.totalMarks ?? '-'}</span>
                                                                    )
                                                                )}
                                                            </td>
                                                            {/* Obtained Marks */}
                                                            <td className={`px-2 py-2 border-l border-gray-200 text-center ${isInvalidBase ? 'bg-red-50' : ''}`}>
                                                                {isSplit ? (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => openAuditCard(m)}
                                                                        className={`font-bold ${isInvalidTh || isInvalidPr ? 'text-red-600' : 'text-slate-800'} ${m.id && (m.createdByName || m.updatedByName) ? 'underline decoration-dotted decoration-blue-400 cursor-pointer' : 'cursor-default'}`}
                                                                        title={m.id && (m.createdByName || m.updatedByName) ? 'Tap to see who entered this' : undefined}
                                                                    >
                                                                        {calculatedTotal > 0 ? calculatedObtained : '-'}
                                                                    </button>
                                                                ) : (
                                                                    canEdit ? (
                                                                        <input type="number" min="0"
                                                                            className={`w-16 p-1 text-center border rounded text-xs ${isInvalidBase ? 'border-red-500 ring-1 ring-red-500 bg-red-50 text-red-700' : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'}`}
                                                                            value={m.obtainedMarks ?? ''}
                                                                            onChange={e => handleMarkChange(subject.id, cat.id, 'obtainedMarks', e.target.value)} />
                                                                    ) : (
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => openAuditCard(m)}
                                                                            className={`${isInvalidBase ? 'text-red-600 font-bold' : ''} ${isLockedEnter ? 'text-gray-400 text-xs' : ''} ${m.id && (m.createdByName || m.updatedByName) ? 'underline decoration-dotted decoration-blue-400 cursor-pointer' : 'cursor-default'}`}
                                                                            title={m.id && (m.createdByName || m.updatedByName) ? 'Tap to see who entered this' : undefined}
                                                                        >
                                                                            {m.obtainedMarks ?? '-'}
                                                                        </button>
                                                                    )
                                                                )}
                                                            </td>
                                                            {/* Percentage */}
                                                            <td className="px-2 py-2 border-l border-gray-200 text-center font-bold text-slate-700 bg-blue-50/10">
                                                                {calculatedTotal > 0
                                                                    ? `${((Number(calculatedObtained) * 100) / Number(calculatedTotal)).toFixed(1)}%`
                                                                    : '-'}
                                                            </td>
                                                            {/* Grade / Status */}
                                                            <td className="px-2 py-2 border-l border-gray-200 text-center font-bold text-slate-600">
                                                                <div className="flex flex-col items-center gap-1">
                                                                    <span>{m.grade || '-'}</span>
                                                                    {m.isPass === true ? (
                                                                        <span className="px-2 py-0.5 text-[9px] font-bold rounded uppercase bg-green-100 text-green-700">Pass</span>
                                                                    ) : m.isPass === false ? (
                                                                        <span className="px-2 py-0.5 text-[9px] font-bold rounded uppercase bg-red-100 text-red-700">Fail</span>
                                                                    ) : null}
                                                                    {isLockedEnter && (
                                                                        <span className="text-[9px] text-gray-400 font-normal">saved</span>
                                                                    )}
                                                                </div>
                                                            </td>
                                                        </React.Fragment>
                                                    );
                                                })}
                                            </tr>
                                        );
                                    })}
                                    {(!student?.studentSubjects || student.studentSubjects.length === 0) && (
                                        <tr>
                                            <td colSpan={visibleCategories.length * 6 + 1} className="p-6 text-center text-gray-500 italic">
                                                No subjects enrolled for this student.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                                <tfoot className="bg-gray-100 font-bold border-t-2 border-gray-300 shadow-inner">
                                    <tr>
                                        <td className="px-4 py-4 sticky left-0 z-10 bg-slate-200 text-slate-800 uppercase tracking-wider text-xs">Overall / Total</td>
                                        {visibleCategories.map((cat: any) => {
                                            let sumTotal = 0;
                                            let sumObtained = 0;
                                            student?.studentSubjects?.forEach((ss: any) => {
                                                const subject = ss.subject || ss.extraSubject;
                                                const m = getMark(subject?.id, cat.id);
                                                if (m.totalMarks) sumTotal += Number(m.totalMarks);
                                                if (m.obtainedMarks) sumObtained += Number(m.obtainedMarks);
                                            });

                                            let percStr = '-';
                                            let overallGrade = '-';
                                            let isPassText = '-';
                                            let isPassColor = 'text-gray-500 bg-gray-50';

                                            if (sumTotal > 0) {
                                                const perc = (sumObtained * 100) / sumTotal;
                                                percStr = `${perc.toFixed(2)}%`;
                                                let assignedGrade: any = null;
                                                for (const g of gradingSystems) {
                                                    if (perc >= g.minPercentage && (perc < g.maxPercentage || (g.maxPercentage === 100 && perc <= 100))) {
                                                        assignedGrade = g;
                                                        break;
                                                    }
                                                }
                                                if (assignedGrade) {
                                                    overallGrade = assignedGrade.gradeName;
                                                    isPassText = assignedGrade.isFailGrade ? 'FAIL' : 'PASS';
                                                    isPassColor = assignedGrade.isFailGrade ? 'text-red-800 bg-red-200' : 'text-green-800 bg-green-200';
                                                }
                                            }

                                            return (
                                                <React.Fragment key={`tfoot-${cat.id}`}>
                                                    <td className="px-2 py-3 border-l border-gray-300 text-center text-gray-400" colSpan={2}>—</td>
                                                    <td className="px-2 py-3 border-l border-gray-200 text-center text-slate-700">{sumTotal || '-'}</td>
                                                    <td className="px-2 py-3 border-l border-gray-200 text-center text-slate-700">{sumObtained || '-'}</td>
                                                    <td className="px-2 py-3 border-l border-gray-200 text-center text-blue-800 bg-blue-100">{percStr}</td>
                                                    <td className="px-2 py-3 border-l border-gray-200 text-center">
                                                        <div className="flex flex-col items-center gap-1">
                                                            <span className="font-bold text-slate-700">{overallGrade}</span>
                                                            {isPassText !== '-' && (
                                                                <span className={`px-2 py-0.5 text-[9px] font-bold rounded uppercase ${isPassColor}`}>{isPassText}</span>
                                                            )}
                                                        </div>
                                                    </td>
                                                </React.Fragment>
                                            );
                                        })}
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

