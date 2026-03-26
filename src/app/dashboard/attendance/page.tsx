"use client";

import { useState, useEffect } from "react";
import { API_BASE_URL } from "@/lib/api";
import { getUser, authFetch } from "@/lib/auth";
import { useRbac } from "@/lib/rbac";
import { Loader } from "@/components/ui/Loader";
import { StudentDetailsModal } from "@/components/StudentDetailsModal";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";

interface Student {
    id: number;
    firstName: string;
    lastName: string;
    rollNo?: number;
}

interface Section {
    id: number;
    name: string;
}

interface ClassData {
    id: number;
    name: string;
}

export default function AttendancePage() {
    const user = getUser();
    const { isSubAdmin } = useRbac();

    // Lightweight class list (id + name only) — loaded once on mount
    const [classes, setClasses] = useState<ClassData[]>([]);
    const [loadingClasses, setLoadingClasses] = useState(true);

    // Sections loaded lazily when a class is chosen
    const [sections, setSections] = useState<Section[]>([]);
    const [loadingSections, setLoadingSections] = useState(false);

    const [selectedClassId, setSelectedClassId] = useState("");
    const [selectedSectionId, setSelectedSectionId] = useState("");
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [activeSession, setActiveSession] = useState<any>(null);
    const [loadingSession, setLoadingSession] = useState(true);

    const [students, setStudents] = useState<Student[]>([]);
    const [loadingStudents, setLoadingStudents] = useState(false);

    const [attendanceRecords, setAttendanceRecords] = useState<Record<number, { status: string, remarks: string }>>({});
    const [existingAttendance, setExistingAttendance] = useState<any>(null);

    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState({ text: "", type: "" });

    // For Modal
    const [selectedStudentId, setSelectedStudentId] = useState<number | null>(null);
    const [studentDetails, setStudentDetails] = useState<any>(null);
    const [loadingStudentDetails, setLoadingStudentDetails] = useState(false);

    // Holiday State Check
    const [activeHolidayInfo, setActiveHolidayInfo] = useState<{ description: string } | null>(null);

    // Fetch lightweight class list on mount
    useEffect(() => {
        const fetchClasses = async () => {
            setLoadingClasses(true);
            try {
                const res = await authFetch(`${API_BASE_URL}/classes/names-only`);
                if (res.ok) {
                    const data = await res.json();
                    setClasses(data);
                }
            } catch (err) {
                console.error("Failed to fetch classes", err);
            } finally {
                setLoadingClasses(false);
            }
        };
        fetchClasses();
    }, []);

    // Fetch relevant academic session based on date
    useEffect(() => {
        const fetchSession = async () => {
            setLoadingSession(true);
            try {
                const res = await authFetch(`${API_BASE_URL}/academic-sessions/by-date?date=${selectedDate}`);
                if (res.ok) {
                    const sessionData = await res.json();
                    setActiveSession(sessionData);
                } else {
                    setActiveSession(null);
                }
            } catch (err) {
                console.error("Failed to fetch active session for date", err);
                setActiveSession(null);
            } finally {
                setLoadingSession(false);
            }
        };
        fetchSession();
    }, [selectedDate]);

    // When class changes: reset section/students and fetch sections for chosen class
    useEffect(() => {
        setSelectedSectionId("");
        setSections([]);
        setStudents([]);
        setAttendanceRecords({});
        setExistingAttendance(null);

        if (!selectedClassId) return;

        const fetchSections = async () => {
            setLoadingSections(true);
            try {
                const res = await authFetch(`${API_BASE_URL}/classes/${selectedClassId}/sections`);
                if (res.ok) {
                    const data = await res.json();
                    setSections(data);
                }
            } catch (err) {
                console.error("Failed to fetch sections", err);
            } finally {
                setLoadingSections(false);
            }
        };
        fetchSections();
    }, [selectedClassId]);



    // Handle Section Selection Change and Student Fetching
    useEffect(() => {
        const fetchStudents = async () => {
            if (selectedClassId && selectedSectionId && activeSession) {
                setLoadingStudents(true);
                try {
                    const res = await authFetch(`${API_BASE_URL}/students?classId=${selectedClassId}&sectionId=${selectedSectionId}&academicSessionId=${activeSession.id}`);
                    if (res.ok) {
                        const data = await res.json();
                        setStudents(data);
                    } else {
                        setStudents([]);
                    }
                } catch (err) {
                    console.error("Failed to fetch enrolled students", err);
                    setStudents([]);
                } finally {
                    setLoadingStudents(false);
                }
            } else {
                setStudents([]);
            }
        };
        fetchStudents();
    }, [selectedClassId, selectedSectionId, activeSession]);

    // Fetch existing attendance for selected date and section
    useEffect(() => {
        const fetchAttendance = async () => {
            if (!selectedClassId || !selectedSectionId || !selectedDate) return;

            try {
                setLoading(true);
                const res = await authFetch(`${API_BASE_URL}/attendance/class/${selectedClassId}/section/${selectedSectionId}?date=${selectedDate}`);
                
                if (!res.ok) {
                    throw new Error("Attendance not found");
                }

                const data = await res.json();

                if (data && data.id) {
                    setExistingAttendance(data);
                    // Populate records
                    const records: Record<number, { status: string, remarks: string }> = {};
                    data.studentAttendances.forEach((sa: any) => {
                        records[sa.student.id] = { status: sa.status, remarks: sa.remarks || "" };
                    });

                    // Fill in any students missing from the record
                    students.forEach(s => {
                        if (!records[s.id]) {
                            records[s.id] = { status: "PRESENT", remarks: "" };
                        }
                    });

                    setAttendanceRecords(records);
                }
            } catch (err) {
                // If 404 or error, reset state properly
                setExistingAttendance(null);
                const targetDate = new Date(selectedDate);
                targetDate.setHours(0, 0, 0, 0);
                const isSunday = targetDate.getDay() === 0;

                const records: Record<number, { status: string, remarks: string }> = {};
                students.forEach(s => {
                    records[s.id] = { status: isSunday ? "HOLIDAY" : "PRESENT", remarks: "" };
                });
                setAttendanceRecords(records);
            } finally {
                setLoading(false);
            }
        };

        const fetchHolidayForDate = async () => {
            if (!selectedClassId || !selectedDate) {
                setActiveHolidayInfo(null);
                return;
            }
            try {
                // Fetch all applicable holidays or via an endpoint filtered by date
                const res = await authFetch(`${API_BASE_URL}/holidays`);
                if (res.ok) {
                    const holidays = await res.json();

                    const targetDate = new Date(selectedDate);
                    targetDate.setHours(0, 0, 0, 0);

                    if (targetDate.getDay() === 0) {
                        setActiveHolidayInfo({ description: "Sunday Weekly Off" });
                        return;
                    }

                    const foundHoliday = holidays.find((h: any) => {
                        const start = new Date(h.startDate);
                        start.setHours(0, 0, 0, 0);
                        const end = new Date(h.endDate);
                        end.setHours(0, 0, 0, 0);

                        // Check if current date falls within holiday bounds
                        const isDateInRange = targetDate >= start && targetDate <= end;
                        if (!isDateInRange) return false;

                        // Check if it's entire school or matches our class id
                        if (h.isEntireSchool) return true;

                        return h.classes?.some((c: any) => c.id.toString() === selectedClassId);
                    });

                    if (foundHoliday) {
                        setActiveHolidayInfo({ description: foundHoliday.description });
                        // Update UI default state explicitly to HOLIDAY if not already saved to DB differently
                        setAttendanceRecords(prev => {
                            const updated = { ...prev };
                            Object.keys(updated).forEach(id => {
                                if (updated[Number(id)].status === 'PRESENT') {
                                    updated[Number(id)].status = 'HOLIDAY';
                                }
                            });
                            return updated;
                        });
                    } else {
                        setActiveHolidayInfo(null);
                    }
                }
            } catch (e) {
                console.error("Failed to fetch holidays", e);
            }
        };

        if (students.length > 0) {
            fetchAttendance();
            fetchHolidayForDate();
        }
    }, [selectedClassId, selectedSectionId, selectedDate, students.length]);

    const handleStatusChange = (studentId: number, status: string) => {
        setAttendanceRecords(prev => ({
            ...prev,
            [studentId]: { ...prev[studentId], status }
        }));
    };

    const handleRemarksChange = (studentId: number, remarks: string) => {
        setAttendanceRecords(prev => ({
            ...prev,
            [studentId]: { ...prev[studentId], remarks }
        }));
    };

    const openStudentModal = async (studentId: number) => {
        setSelectedStudentId(studentId);
        setLoadingStudentDetails(true);
        try {
            const res = await authFetch(`${API_BASE_URL}/students/${studentId}`);
            if (res.ok) {
                const data = await res.json();
                setStudentDetails(data);
            }
        } catch (err) {
            console.error("Failed to fetch student details", err);
        } finally {
            setLoadingStudentDetails(false);
        }
    };

    const closeStudentModal = () => {
        setSelectedStudentId(null);
        setStudentDetails(null);
    };

    const markAll = (status: string) => {
        const newRecords = { ...attendanceRecords };
        students.forEach(s => {
            if (newRecords[s.id]) {
                newRecords[s.id].status = status;
            } else {
                newRecords[s.id] = { status, remarks: "" };
            }
        });
        setAttendanceRecords(newRecords);
    };

    // Calculate chart data
    const getChartData = () => {
        if (!existingAttendance || students.length === 0) return [];
        const stats = { PRESENT: 0, ABSENT: 0, LEAVE: 0, LATE: 0, HALF_DAY: 0, HOLIDAY: 0 };
        Object.values(attendanceRecords).forEach(record => {
            if (record.status in stats) {
                stats[record.status as keyof typeof stats]++;
            }
        });

        return [
            { name: 'Present', value: stats.PRESENT, color: '#22c55e' }, // green-500
            { name: 'Absent', value: stats.ABSENT, color: '#ef4444' }, // red-500
            { name: 'Leave', value: stats.LEAVE, color: '#3b82f6' }, // blue-500
            { name: 'Late', value: stats.LATE, color: '#eab308' }, // yellow-500
            { name: 'Half Day', value: stats.HALF_DAY, color: '#a855f7' }, // purple-500
            { name: 'Holiday', value: stats.HOLIDAY, color: '#0ea5e9' } // sky-500
        ].filter(item => item.value > 0);
    };

    const getAbsentStudents = () => {
        if (!existingAttendance) return [];
        return students.filter(s => {
            const status = attendanceRecords[s.id]?.status;
            return status === 'ABSENT' || status === 'HALF_DAY';
        });
    };

    const disableEdit = !!activeHolidayInfo || (existingAttendance && !isSubAdmin);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setMessage({ text: "", type: "" });

        const payload = {
            date: selectedDate,
            classId: parseInt(selectedClassId),
            sectionId: parseInt(selectedSectionId),
            students: students.map(student => {
                const data = attendanceRecords[student.id] || { status: 'PRESENT', remarks: '' };
                return {
                    studentId: student.id,
                    status: data.status,
                    remarks: data.remarks
                };
            })
        };

        try {
            setLoading(true);
            const res = await authFetch(`${API_BASE_URL}/attendance`, {
                method: "POST",
                body: JSON.stringify(payload)
            });

            if (!res.ok) throw new Error("Failed to submit attendance");

            const savedData = await res.json();
            setExistingAttendance(savedData);
            setMessage({ text: "Attendance saved successfully!", type: "success" });

            // clear msg after 3s
            setTimeout(() => setMessage({ text: "", type: "" }), 3000);
        } catch (err) {
            setMessage({ text: "Failed to submit attendance. Please try again.", type: "error" });
        } finally {
            setLoading(false);
        }
    };

    const availableSections = sections;

    if (loadingClasses) return <Loader fullScreen text="Loading attendance dashboard..." />;

    return (
        <main className="p-4 flex-1 h-full overflow-y-auto w-full max-w-7xl mx-auto relative">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                <div className="flex items-center gap-4">
                    <h1 className="text-3xl font-bold text-slate-800">Attendance Dashboard</h1>
                </div>
                {activeSession && (
                    <div className="bg-indigo-50 border border-indigo-100 px-4 py-2 rounded-lg w-full sm:w-auto flex justify-between sm:justify-start items-center">
                        <span className="text-sm text-indigo-600 font-medium">Active Session:</span>
                        <span className="ml-2 text-indigo-900 font-bold">{activeSession.name}</span>
                    </div>
                )}
            </div>

            {loadingSession && <p className="text-sm text-gray-500 mb-4 animate-pulse">Loading academic session...</p>}

            {/* Error Message */}
            {message.text && (
                <div className={`p-4 mb-6 text-sm rounded-lg ${message.type === 'error' ? 'text-red-800 bg-red-100' : 'text-green-800 bg-green-100'}`}>
                    {message.text}
                </div>
            )}

            {/* Filters Form */}
            <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200 mb-6 relative z-10">
                <form className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <div>
                        <label className="block mb-2 text-sm font-medium text-gray-900">Date</label>
                        <input
                            type="date"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5"
                            required
                        />
                    </div>
                    <div>
                        <label className="block mb-2 text-sm font-medium text-gray-900">Taken By</label>
                        <input
                            type="text"
                            value={existingAttendance
                                ? (existingAttendance.takenBy ? `${existingAttendance.takenBy.firstName} ${existingAttendance.takenBy.lastName}` : 'Unknown')
                                : (user ? `${user.firstName} ${user.lastName}` : "Unknown")}
                            className="bg-gray-100 border border-gray-300 text-gray-500 text-sm rounded-lg block w-full p-2.5 cursor-not-allowed"
                            disabled
                        />
                    </div>
                    <div>
                        <label className="block mb-2 text-sm font-medium text-gray-900">Class</label>
                        <select
                            value={selectedClassId}
                            onChange={(e) => setSelectedClassId(e.target.value)}
                            className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5"
                            required
                        >
                            <option value="">Select Class</option>
                            {classes.map(c => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block mb-2 text-sm font-medium text-gray-900">Section</label>
                        <select
                            value={selectedSectionId}
                            onChange={(e) => setSelectedSectionId(e.target.value)}
                            className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5"
                            disabled={!selectedClassId || loadingSections}
                            required
                        >
                            <option value="">{loadingSections ? "Loading sections..." : "Select Section"}</option>
                            {availableSections.map((s: any) => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                        </select>
                    </div>
                </form>
            </div>

            {loadingStudents && (
                <div className="flex justify-center py-12">
                    <Loader text="Loading students..." />
                </div>
            )}

            {selectedClassId && selectedSectionId && !loadingStudents && (
                <div className="space-y-6 relative z-0">
                    {/* Insights Dashboard (Only show if attendance is existing) */}
                    {existingAttendance && students.length > 0 && (
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            {/* Consolidated Report & Chart */}
                            <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200 lg:col-span-2 flex flex-col md:flex-row items-center gap-8">
                                <div className="flex-1 w-full">
                                    <h3 className="text-lg font-bold text-slate-800 mb-4">Consolidated Report</h3>
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                        <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 text-center">
                                            <p className="text-xs text-blue-600 font-bold uppercase">Total</p>
                                            <p className="text-2xl font-black text-blue-900">{students.length}</p>
                                        </div>
                                        <div className="bg-green-50 p-4 rounded-lg border border-green-100 text-center">
                                            <p className="text-xs text-green-600 font-bold uppercase">Present</p>
                                            <p className="text-2xl font-black text-green-900">
                                                {Object.values(attendanceRecords).filter(r => r.status === 'PRESENT').length}
                                            </p>
                                        </div>
                                        <div className="bg-red-50 p-4 rounded-lg border border-red-100 text-center">
                                            <p className="text-xs text-red-600 font-bold uppercase">Absent</p>
                                            <p className="text-2xl font-black text-red-900">
                                                {Object.values(attendanceRecords).filter(r => r.status === 'ABSENT').length}
                                            </p>
                                        </div>
                                        <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-100 text-center">
                                            <p className="text-xs text-yellow-600 font-bold uppercase">Other</p>
                                            <p className="text-2xl font-black text-yellow-900">
                                                {Object.values(attendanceRecords).filter(r => r.status === 'LATE' || r.status === 'HALF_DAY' || r.status === 'LEAVE' || r.status === 'HOLIDAY').length}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                                <div className="w-48 h-48 md:w-64 md:h-64">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie
                                                data={getChartData()}
                                                cx="50%"
                                                cy="50%"
                                                innerRadius={60}
                                                outerRadius={80}
                                                paddingAngle={5}
                                                dataKey="value"
                                            >
                                                {getChartData().map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                                ))}
                                            </Pie>
                                            <Tooltip />
                                            <Legend verticalAlign="bottom" height={36} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            {activeHolidayInfo && (
                                <div className="mt-4 p-4 text-sm text-yellow-800 rounded-lg bg-yellow-50 border border-yellow-200" role="alert">
                                    <span className="font-bold mr-2">🏖️ Holiday Declared:</span>
                                    {activeHolidayInfo.description}. Attendance marking is disabled for this date.
                                </div>
                            )}

                            {/* Absentee List Widget */}
                            <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200 lg:col-span-1 h-full max-h-[300px] flex flex-col">
                                <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center justify-between">
                                    <span>Absent / On Leave</span>
                                    <span className="bg-red-100 text-red-700 text-xs px-2 py-1 rounded-full font-bold">
                                        {getAbsentStudents().length}
                                    </span>
                                </h3>
                                <div className="overflow-y-auto flex-1 pr-2 space-y-3 custom-scrollbar">
                                    {getAbsentStudents().length === 0 ? (
                                        <p className="text-sm text-gray-500 italic text-center py-8">Everyone is present!</p>
                                    ) : (
                                        getAbsentStudents().map(student => (
                                            <div key={student.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100 hover:bg-gray-100 transition-colors">
                                                <div className="flex flex-col">
                                                    <span className="font-semibold text-gray-800 text-sm">{student.firstName} {student.lastName}</span>
                                                    <span className="text-xs text-gray-500">Roll No: {student.rollNo || student.id}</span>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Main Attendance Table */}
                    <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                            <div>
                                <h2 className="text-xl font-bold text-slate-800">
                                    Student List ({students.length})
                                </h2>
                                {existingAttendance && (
                                    <div className="text-sm text-gray-600 mt-1">
                                        <p><span className="font-semibold">Initially saved by:</span> {existingAttendance.takenBy ? `${existingAttendance.takenBy.firstName} ${existingAttendance.takenBy.lastName}` : 'Unknown'}</p>
                                        {existingAttendance.updatedBy && (
                                            <p><span className="font-semibold">Last updated by:</span> {existingAttendance.updatedBy.firstName} {existingAttendance.updatedBy.lastName} at {new Date(existingAttendance.updatedAt).toLocaleString()}</p>
                                        )}
                                        {!existingAttendance.updatedBy && (
                                            <p><span className="font-semibold">Saved at:</span> {new Date(existingAttendance.timestamp).toLocaleString()}</p>
                                        )}                        </div>
                                )}
                            </div>
                            <div className="flex bg-gray-100 p-1 rounded-lg">
                                <button
                                    type="button"
                                    onClick={() => markAll('PRESENT')}
                                    disabled={disableEdit}
                                    className={`px-4 py-2 text-sm font-medium rounded-md border transition-colors ${disableEdit ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed shadow-none' : 'bg-white text-green-700 shadow-sm border-gray-200 hover:bg-gray-50'}`}
                                >
                                    Mark All Present
                                </button>
                                <button
                                    type="button"
                                    onClick={() => markAll('ABSENT')}
                                    disabled={disableEdit}
                                    className={`px-4 py-2 ml-2 text-sm font-medium rounded-md border transition-colors ${disableEdit ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed shadow-none' : 'bg-white text-red-700 shadow-sm border-gray-200 hover:bg-gray-50'}`}
                                >
                                    Mark All Absent
                                </button>
                            </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-gray-600 bg-gray-50 px-3 py-2 rounded-lg border border-gray-200 mb-4">
                            <span className="font-semibold text-gray-700">Legend:</span>
                            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-green-500"></span> P - Present</span>
                            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-red-500"></span> A - Absent</span>
                            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-blue-500"></span> L - Leave</span>
                            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-yellow-400"></span> LT - Late</span>
                            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-purple-500"></span> HD - Half Day</span>
                            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-sky-500"></span> HL - Holiday</span>
                        </div>

                        {students.length === 0 && !loading && (
                            <div className="text-center py-8 text-gray-500">No students enrolled in this section for the selected session.</div>
                        )}

                        {students.length > 0 && (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left text-gray-500">
                                    <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                                        <tr>
                                            <th scope="col" className="px-6 py-3">Roll No.</th>
                                            <th scope="col" className="px-6 py-3">Name</th>
                                            <th scope="col" className="px-6 py-3 text-center">Status</th>
                                            <th scope="col" className="px-6 py-3">Remarks</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {students.map((student) => {
                                            const record = attendanceRecords[student.id] || { status: 'PRESENT', remarks: '' };
                                            return (
                                                <tr key={student.id} className="bg-white border-b hover:bg-gray-50 transition-colors">
                                                    <td className="px-6 py-4 font-bold text-gray-600 whitespace-nowrap">
                                                        {student.rollNo || student.id}
                                                    </td>
                                                    <td className="px-6 py-4 font-medium text-gray-900">
                                                        <button
                                                            onClick={(e) => { e.preventDefault(); openStudentModal(student.id); }}
                                                            className="hover:underline text-blue-600 hover:text-blue-800 text-left"
                                                        >
                                                            {student.firstName} {student.lastName}
                                                        </button>
                                                    </td>
                                                    <td className="px-6 py-4 text-center">
                                                        <div className="inline-flex rounded-md shadow-sm" role="group">
                                                            <button
                                                                type="button"
                                                                disabled={disableEdit}
                                                                onClick={() => handleStatusChange(student.id, 'PRESENT')}
                                                                className={`px-3 py-1.5 text-xs font-medium border border-gray-200 rounded-s-lg focus:z-10 focus:ring-2 ${record.status === 'PRESENT' ? 'bg-green-500 text-white border-green-500' : 'bg-white text-gray-900 hover:bg-gray-100 hover:text-blue-700'
                                                                    } ${disableEdit ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                            >
                                                                P
                                                            </button>
                                                            <button
                                                                type="button"
                                                                disabled={disableEdit}
                                                                onClick={() => handleStatusChange(student.id, 'ABSENT')}
                                                                className={`px-3 py-1.5 text-xs font-medium border border-gray-200 focus:z-10 focus:ring-2 ${record.status === 'ABSENT' ? 'bg-red-500 text-white border-red-500' : 'bg-white text-gray-900 hover:bg-gray-100 hover:text-blue-700'
                                                                    } ${disableEdit ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                            >
                                                                A
                                                            </button>
                                                            <button
                                                                type="button"
                                                                disabled={disableEdit}
                                                                onClick={() => handleStatusChange(student.id, 'LEAVE')}
                                                                className={`px-3 py-1.5 text-xs font-medium border border-gray-200 focus:z-10 focus:ring-2 ${record.status === 'LEAVE' ? 'bg-blue-500 text-white border-blue-500' : 'bg-white text-gray-900 hover:bg-gray-100 hover:text-blue-700'
                                                                    } ${disableEdit ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                            >
                                                                L
                                                            </button>
                                                            <button
                                                                type="button"
                                                                disabled={disableEdit}
                                                                onClick={() => handleStatusChange(student.id, 'LATE')}
                                                                className={`px-3 py-1.5 text-xs font-medium border border-gray-200 focus:z-10 focus:ring-2 ${record.status === 'LATE' ? 'bg-yellow-400 text-white border-yellow-400' : 'bg-white text-gray-900 hover:bg-gray-100 hover:text-blue-700'
                                                                    } ${disableEdit ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                            >
                                                                LT
                                                            </button>
                                                            <button
                                                                type="button"
                                                                disabled={disableEdit}
                                                                onClick={() => handleStatusChange(student.id, 'HALF_DAY')}
                                                                className={`px-3 py-1.5 text-xs font-medium border border-gray-200 focus:z-10 focus:ring-2 ${record.status === 'HALF_DAY' ? 'bg-purple-500 text-white border-purple-500' : 'bg-white text-gray-900 hover:bg-gray-100 hover:text-blue-700'
                                                                    } ${disableEdit ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                            >
                                                                HD
                                                            </button>
                                                            <button
                                                                type="button"
                                                                disabled={disableEdit}
                                                                onClick={() => handleStatusChange(student.id, 'HOLIDAY')}
                                                                className={`px-3 py-1.5 text-xs font-medium border border-gray-200 rounded-e-lg focus:z-10 focus:ring-2 ${record.status === 'HOLIDAY' ? 'bg-sky-500 text-white border-sky-500' : 'bg-white text-gray-900 hover:bg-gray-100 hover:text-blue-700'
                                                                    } ${disableEdit ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                            >
                                                                HL
                                                            </button>
                                                        </div>
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <input
                                                            type="text"
                                                            value={record.remarks}
                                                            onChange={(e) => handleRemarksChange(student.id, e.target.value)}
                                                            placeholder="Notes (optional)"
                                                            disabled={disableEdit}
                                                            className={`bg-gray-50 border border-gray-300 text-gray-900 text-xs rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2 ${disableEdit ? 'opacity-50 cursor-not-allowed' : ''}`}
                                                        />
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>

                                <div className="mt-6 flex justify-end">
                                    <button
                                        type="button"
                                        onClick={handleSubmit}
                                        disabled={loading || students.length === 0 || disableEdit}
                                        className="text-white bg-blue-700 hover:bg-blue-800 focus:ring-4 focus:ring-blue-300 font-medium rounded-lg text-sm px-6 py-2.5 disabled:opacity-50"
                                    >
                                        {loading ? 'Saving...' : 'Save Attendance'}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {selectedStudentId && (
                <StudentDetailsModal
                    student={studentDetails}
                    isLoading={loadingStudentDetails}
                    onClose={closeStudentModal}
                />
            )}
        </main>
    );
}
