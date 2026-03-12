"use client";

import React, { useState, useEffect } from "react";
import useSWR from "swr";
import { API_BASE_URL, fetcher } from "@/lib/api";
import { authFetch } from "@/lib/auth";
import { Loader } from "@/components/ui/Loader";
import toast from "react-hot-toast";

interface Props {
    studentId: number | null;
    sessionId: number | null;
    onClose: () => void;
    onSave?: () => void;
}

export default function StudentResultModal({ studentId, sessionId, onClose, onSave }: Props) {
    const { data: categories = [], isLoading: catsLoading } = useSWR(API_BASE_URL + '/exams/categories/active', fetcher);
    // Fetch marks for student
    const { data: marks = [], isLoading: marksLoading, mutate: mutateMarks } = useSWR(
        studentId && sessionId ? `${API_BASE_URL}/exams/marks/${sessionId}/${studentId}` : null,
        fetcher
    );
    const { data: student, isLoading: studentLoading } = useSWR(
        studentId ? `${API_BASE_URL}/students/${studentId}` : null,
        fetcher
    );

    // Fetch Exam Settings to know the target category
    const { data: examSettings, isLoading: settingsLoading } = useSWR(
        `${API_BASE_URL}/exams/settings`,
        fetcher
    );

    // Fetch Grading Systems to calculate overall grades dynamically
    const { data: gradingSystems = [], isLoading: gradingLoading } = useSWR(
        sessionId ? `${API_BASE_URL}/exams/grading-system/session/${sessionId}` : null,
        fetcher
    );

    const [isEditMode, setIsEditMode] = useState(false);
    // We'll store editable marks in a local state
    const [editedMarks, setEditedMarks] = useState<any[]>([]);

    useEffect(() => {
        if (marks.length && student) {
            // copy from fetched data
            setEditedMarks(JSON.parse(JSON.stringify(marks)));
        } else if (student && student.studentSubjects) {
            // Initialize empty marks map if none exists
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

    // Helper to get mark for a subject + category
    const getMark = (subjectId: number, catId: number) => {
        return editedMarks.find(m => m.subjectId === subjectId && m.examCategoryId === catId) || {};
    };

    const handleMarkChange = (subjectId: number, catId: number, field: string, value: any) => {
        setEditedMarks(prev => {
            const next = [...prev];
            const idx = next.findIndex(m => m.subjectId === subjectId && m.examCategoryId === catId);
            if (idx !== -1) {
                next[idx] = { ...next[idx], [field]: value };
            } else {
                // Should not happen if initialized properly, but safely push
                next.push({
                    subjectId, examCategoryId: catId,
                    totalMarks: '', obtainedMarks: '', grade: '', isPass: null,
                    [field]: value
                });
            }
            return next;
        });
    };

    const handleSave = async () => {
        try {
            const invalidMark = editedMarks.find(m => {
                if (m.totalMarks == null || m.totalMarks === '' || m.obtainedMarks == null || m.obtainedMarks === '') return false;
                return Number(m.obtainedMarks) > Number(m.totalMarks);
            });

            if (invalidMark) {
                toast.error("Obtained marks cannot exceed Total marks.");
                return;
            }

            for (const mark of editedMarks) {
                if (mark.totalMarks !== '' || mark.obtainedMarks !== '' || mark.grade !== '' || mark.isPass !== null) {
                    await authFetch(`${API_BASE_URL}/exams/marks/student/${studentId}`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            classId: student.class?.id,
                            sectionId: student.section?.id,
                            sessionId: sessionId,
                            subjectId: mark.subjectId,
                            examCategoryId: mark.examCategoryId,
                            totalMarks: mark.totalMarks !== '' && mark.totalMarks !== null ? Number(mark.totalMarks) : null,
                            obtainedMarks: mark.obtainedMarks !== '' && mark.obtainedMarks !== null ? Number(mark.obtainedMarks) : null,
                            grade: mark.grade || null,
                            isPass: mark.isPass
                        })
                    });
                }
            }
            toast.success("Marks updated successfully!");
            setIsEditMode(false);
            mutateMarks();
            onSave?.();
        } catch (err) {
            toast.error("Failed to update marks");
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/50 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-6xl max-h-[95vh] flex flex-col overflow-hidden">
                <div className="px-4 sm:px-6 py-4 border-b border-slate-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-0 bg-slate-50">
                    <h3 className="text-lg sm:text-xl font-bold text-slate-800 break-words w-full sm:w-auto">
                        Exam Results {student ? ` - ${student.firstName} ${student.lastName}` : ''}
                    </h3>
                    <div className="flex items-center gap-2 sm:gap-3 self-end sm:self-auto">
                        {!isEditMode ? (
                            <button onClick={() => setIsEditMode(true)} className="px-3 sm:px-4 py-1.5 sm:py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700">
                                Edit Marks
                            </button>
                        ) : (
                            <button onClick={handleSave} className="px-3 sm:px-4 py-1.5 sm:py-2 bg-green-600 text-white rounded text-sm font-medium hover:bg-green-700">
                                Save Changes
                            </button>
                        )}
                        <button onClick={onClose} className="text-slate-500 hover:text-slate-800 p-1 sm:p-2">
                            <span className="sr-only">Close</span>
                            <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    </div>
                </div>

                <div className="p-4 sm:p-6 overflow-y-auto flex-1">
                    {isLoading ? (
                        <div className="py-12"><Loader text="Loading result data..." /></div>
                    ) : (
                        <div className="relative overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
                            <table className="w-full text-sm text-left text-gray-500 min-w-[600px] md:min-w-max">
                                <thead className="text-xs text-gray-700 uppercase bg-gray-50 border-b">
                                    <tr>
                                        <th className="px-4 py-3 bg-gray-100 sticky left-0 z-10 w-48 align-bottom" rowSpan={2}>Subject</th>
                                        {categories.map((cat: any) => (
                                            <th key={cat.id} className="px-4 py-3 text-center border-l border-gray-300 bg-gray-100" colSpan={4}>
                                                {cat.name}
                                            </th>
                                        ))}
                                    </tr>
                                    <tr>
                                        {categories.map((cat: any) => (
                                            <React.Fragment key={`sub-${cat.id}`}>
                                                <th className="px-2 py-2 text-center text-[10px] text-gray-500 border-l border-gray-300 bg-gray-50">Total</th>
                                                <th className="px-2 py-2 text-center text-[10px] text-gray-500 border-l border-gray-200 bg-gray-50">Obtained</th>
                                                <th className="px-2 py-2 text-center text-[10px] text-blue-600 border-l border-gray-200 bg-blue-50/50">Percentage</th>
                                                <th className="px-2 py-2 text-center text-[10px] text-gray-500 border-l border-gray-200 bg-gray-50">Grade</th>
                                                <th className="px-2 py-2 text-center text-[10px] text-gray-500 border-l border-gray-200 bg-gray-50">Status</th>
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
                                                <td className="px-4 py-3 font-semibold text-slate-800 bg-white sticky left-0 z-10">
                                                    {subject.name}
                                                </td>
                                                {categories.map((cat: any) => {
                                                    const m = getMark(subject.id, cat.id);
                                                    const isTargetCategory = examSettings?.finalTargetCategoryId === cat.id;
                                                    const isInvalid = m.totalMarks != null && m.totalMarks !== '' && m.obtainedMarks != null && m.obtainedMarks !== '' && Number(m.obtainedMarks) > Number(m.totalMarks);

                                                    return (
                                                        <React.Fragment key={`td-${cat.id}`}>
                                                            <td className="px-2 py-2 border-l border-gray-300 text-center">
                                                                {isEditMode ? (
                                                                    <input type="number" min="0"
                                                                        className={`w-16 p-1 text-center border rounded text-xs focus:ring-blue-500 focus:border-blue-500 ${isTargetCategory ? 'bg-gray-200 cursor-not-allowed text-gray-500 border-gray-300' : 'border-gray-300'}`}
                                                                        value={m.totalMarks ?? ''}
                                                                        onChange={e => handleMarkChange(subject.id, cat.id, 'totalMarks', e.target.value)}
                                                                        disabled={isTargetCategory}
                                                                        title={isTargetCategory ? "Auto-calculated" : ""}
                                                                    />
                                                                ) : (m.totalMarks ?? '-')}
                                                            </td>
                                                            <td className={`px-2 py-2 border-l border-gray-200 text-center ${isInvalid ? 'bg-red-50' : ''}`}>
                                                                {isEditMode ? (
                                                                    <div className="flex flex-col items-center">
                                                                        <input type="number" min="0" max={m.totalMarks ?? ''}
                                                                            className={`w-16 p-1 text-center border rounded text-xs ${isTargetCategory ? 'bg-gray-200 cursor-not-allowed text-gray-500 border-gray-300' : (isInvalid ? 'border-red-500 ring-1 ring-red-500 focus:ring-red-500 focus:border-red-500 bg-red-50 text-red-700' : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500')}`}
                                                                            value={m.obtainedMarks ?? ''}
                                                                            onChange={e => handleMarkChange(subject.id, cat.id, 'obtainedMarks', e.target.value)}
                                                                            disabled={isTargetCategory}
                                                                            title={isTargetCategory ? "Auto-calculated" : (isInvalid ? "Obtained marks cannot exceed Total marks" : "")}
                                                                        />
                                                                        {isInvalid && <span className="text-[9px] text-red-600 font-bold mt-0.5 leading-tight">Exceeds Total</span>}
                                                                    </div>
                                                                ) : (
                                                                    <span className={isInvalid ? 'text-red-600 font-bold' : ''}>{m.obtainedMarks ?? '-'}</span>
                                                                )}
                                                            </td>
                                                            <td className="px-2 py-2 border-l border-gray-200 text-center font-bold text-slate-700 bg-blue-50/10">
                                                                {m.totalMarks && m.obtainedMarks ?
                                                                    `${((Number(m.obtainedMarks) * 100) / Number(m.totalMarks)).toFixed(1)}%`
                                                                    : '-'}
                                                            </td>
                                                            <td className="px-2 py-2 border-l border-gray-200 text-center font-bold text-slate-600">
                                                                {m.grade || '-'}
                                                            </td>
                                                            <td className="px-2 py-2 border-l border-gray-200 text-center">
                                                                {m.isPass === true ? (
                                                                    <span className="px-2 py-1 text-[9px] font-bold rounded uppercase bg-green-100 text-green-700">Pass</span>
                                                                ) : m.isPass === false ? (
                                                                    <span className="px-2 py-1 text-[9px] font-bold rounded uppercase bg-red-100 text-red-700">Fail</span>
                                                                ) : (
                                                                    <span className="text-gray-400">-</span>
                                                                )}
                                                            </td>
                                                        </React.Fragment>
                                                    );
                                                })}
                                            </tr>
                                        );
                                    })}
                                    {(!student?.studentSubjects || student.studentSubjects.length === 0) && (
                                        <tr><td colSpan={categories.length * 4 + 1} className="p-6 text-center text-gray-500 italic">No subjects enrolled for this student.</td></tr>
                                    )}
                                </tbody>
                                <tfoot className="bg-gray-100 font-bold border-t-2 border-gray-300 shadow-inner">
                                    <tr>
                                        <td className="px-4 py-4 sticky left-0 z-10 bg-slate-200 text-slate-800 uppercase tracking-wider">Overall / Total</td>
                                        {categories.map((cat: any) => {
                                            let sumTotal = 0;
                                            let sumObtained = 0;

                                            student?.studentSubjects?.forEach((ss: any) => {
                                                const subject = ss.subject || ss.extraSubject;
                                                const m = getMark(subject?.id, cat.id);
                                                if (m.totalMarks) sumTotal += Number(m.totalMarks);
                                                if (m.obtainedMarks) sumObtained += Number(m.obtainedMarks);
                                            });

                                            let perc = 0;
                                            let percStr = '-';
                                            let overallGrade = '-';
                                            let isPassText = '-';
                                            let isPassColor = 'text-gray-500 bg-gray-50';

                                            if (sumTotal > 0) {
                                                perc = (sumObtained * 100) / sumTotal;
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
                                                    if (assignedGrade.isFailGrade) {
                                                        isPassText = 'FAIL';
                                                        isPassColor = 'text-red-800 bg-red-200';
                                                    } else {
                                                        isPassText = 'PASS';
                                                        isPassColor = 'text-green-800 bg-green-200';
                                                    }
                                                }
                                            }

                                            return (
                                                <React.Fragment key={`tfoot-${cat.id}`}>
                                                    <td className="px-2 py-3 border-l border-gray-300 text-center text-slate-700">{sumTotal || '-'}</td>
                                                    <td className="px-2 py-3 border-l border-gray-200 text-center text-slate-700">{sumObtained || '-'}</td>
                                                    <td className="px-2 py-3 border-l border-gray-200 text-center text-blue-800 bg-blue-100">{percStr}</td>
                                                    <td className="px-2 py-3 border-l border-gray-200 text-center text-slate-700">{overallGrade}</td>
                                                    <td className={`px-2 py-3 border-l border-gray-200 text-center text-[10px] uppercase ${isPassColor}`}>{isPassText}</td>
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
