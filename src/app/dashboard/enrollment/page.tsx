"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import toast, { Toaster } from "react-hot-toast";
import Table from "../../../components/Table";
import { API_BASE_URL } from "@/lib/api";
import { authFetch } from "@/lib/auth";

export default function EnrollmentPage() {
    const router = useRouter();
    const [students, setStudents] = useState<any[]>([]);
    const [subjects, setSubjects] = useState<any[]>([]);
    const [classes, setClasses] = useState<any[]>([]);
    const [sections, setSections] = useState<any[]>([]);
    const [academicSessions, setAcademicSessions] = useState<any[]>([]);
    const [selectedSessionId, setSelectedSessionId] = useState<number | "">("");

    const [filteredStudents, setFilteredStudents] = useState<any[]>([]);

    // Search Filters
    const [searchTerm, setSearchTerm] = useState("");
    const [filterClass, setFilterClass] = useState("");
    const [filterSection, setFilterSection] = useState("");
    const [availableSections, setAvailableSections] = useState<any[]>([]);

    const [selectedStudent, setSelectedStudent] = useState("");
    const [studentData, setStudentData] = useState<any>(null); // Full student object
    const [selectedClass, setSelectedClass] = useState("");
    const [selectedSection, setSelectedSection] = useState("");
    const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);

    const [loading, setLoading] = useState(false);
    const [searchLoading, setSearchLoading] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [showEditModal, setShowEditModal] = useState(false);

    // Bulk action state
    const [selectedStudentIds, setSelectedStudentIds] = useState<number[]>([]);
    const [showBulkModal, setShowBulkModal] = useState(false);
    const [bulkSubjects, setBulkSubjects] = useState<string[]>([]);
    const [bulkActionType, setBulkActionType] = useState<"ADD" | "REPLACE">("REPLACE");
    const [bulkLoading, setBulkLoading] = useState(false);

    // Initial Fetch
    useEffect(() => {
        const fetchData = async () => {
            try {
                const [studentsRes, subjectsRes, classesRes, sessionsRes] = await Promise.all([
                    authFetch(`${API_BASE_URL}/students`),
                    authFetch(`${API_BASE_URL}/subjects`),
                    authFetch(`${API_BASE_URL}/classes`),
                    authFetch(`${API_BASE_URL}/academic-sessions`)
                ]);

                if (studentsRes.ok) {
                    const data = await studentsRes.json();
                    setStudents(data);
                    // Do NOT setFilteredStudents here initially to keep table empty until search
                }
                if (subjectsRes.ok) setSubjects(await subjectsRes.json());
                if (classesRes.ok) setClasses(await classesRes.json());
                if (sessionsRes.ok) {
                    const data = await sessionsRes.json();
                    setAcademicSessions(data);
                    const active = data.find((s: any) => s.isActive);
                    if (active) setSelectedSessionId(active.id);
                }
            } catch (err) {
                console.error("Failed to fetch data", err);
            }
        };
        fetchData();
    }, []);

    // Update sections for filter dropdown when class filter changes
    useEffect(() => {
        if (filterClass) {
            const cls = classes.find((c: any) => c.id === parseInt(filterClass));
            setAvailableSections(cls ? cls.sections : []);
        } else {
            setAvailableSections([]);
            setFilterSection("");
        }
    }, [filterClass, classes]);

    const handleSearch = () => {
        setSearchLoading(true);
        // Simulate a small delay or just filter immediately
        setTimeout(() => {
            let filtered = students;

            if (filterClass) {
                filtered = filtered.filter((s: any) => s.class?.id === parseInt(filterClass));
            }

            if (filterSection) {
                filtered = filtered.filter((s: any) => s.section?.id === parseInt(filterSection));
            }

            if (searchTerm) {
                const lower = searchTerm.toLowerCase();
                filtered = filtered.filter((s: any) =>
                    (s.id?.toString() || "").includes(lower) ||
                    (s.firstName?.toLowerCase() || "").includes(lower) ||
                    (s.lastName?.toLowerCase() || "").includes(lower) ||
                    (s.email?.toLowerCase() || "").includes(lower)
                );
            }
            setFilteredStudents(filtered);
            setSearchLoading(false);
        }, 300); // Small UI feedback delay
    };

    // Fetch full student details when selected
    useEffect(() => {
        if (!selectedStudent) {
            setStudentData(null);
            setSelectedClass("");
            setSelectedSection("");
            setSelectedSubjects([]); // Reset subjects
            return;
        }

        const fetchStudentDetails = async () => {
            try {
                const res = await authFetch(`${API_BASE_URL}/students/${selectedStudent}`);
                if (res.ok) {
                    const data = await res.json();
                    setStudentData(data);
                    // Pre-fill Class/Section if they have one
                    if (data.class) setSelectedClass(data.class.id.toString());
                    if (data.section) setSelectedSection(data.section.id.toString());

                    // Pre-fill subjects (map to string IDs)
                    if (data.studentSubjects) {
                        setSelectedSubjects(data.studentSubjects.map((ss: any) => (ss.subject || ss.extraSubject).id.toString()));
                    }
                }
            } catch (err) {
                console.error("Failed to fetch student details", err);
            }
        };
        fetchStudentDetails();
    }, [selectedStudent]);

    // Filter sections when class changes (for the Enrollment Form)
    useEffect(() => {
        if (selectedClass) {
            const cls = classes.find((c: any) => c.id === parseInt(selectedClass));
            if (cls) {
                setSections(cls.sections || []);
            } else {
                setSections([]);
            }
        } else {
            setSections([]);
        }
    }, [selectedClass, classes]);

    const handleSubjectToggle = (subjectId: string) => {
        setSelectedSubjects(prev =>
            prev.includes(subjectId)
                ? prev.filter(id => id !== subjectId)
                : [...prev, subjectId]
        );
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError("");
        setSuccess("");

        if (!selectedStudent || !selectedClass || !selectedSection) {
            setError("Please select student, class, and section.");
            setLoading(false);
            return;
        }

        try {
            const res = await authFetch(`${API_BASE_URL}/students/${selectedStudent}/enroll`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    classId: parseInt(selectedClass),
                    sectionId: parseInt(selectedSection),
                    subjectIds: selectedSubjects.map(id => parseInt(id)),
                    academicSessionId: selectedSessionId !== "" ? selectedSessionId : undefined
                }),
            });

            if (!res.ok) {
                throw new Error("Failed to enroll student");
            }

            toast.success("Student enrollment updated successfully!");
            setShowEditModal(false);
            // Refresh the students list from server to reflect new enrollment
            const refreshRes = await authFetch(`${API_BASE_URL}/students`);
            if (refreshRes.ok) {
                const refreshedStudents = await refreshRes.json();
                setStudents(refreshedStudents);

                // Update the filtered list which feeds the visible table
                setFilteredStudents(prevFiltered => {
                    return prevFiltered.map(fs => {
                        const updated = refreshedStudents.find((rs: any) => rs.id === fs.id);
                        return updated ? updated : fs;
                    });
                });
            }

        } catch (err) {
            setError("Failed to enroll student. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const handleBulkSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setBulkLoading(true);

        try {
            const res = await authFetch(`${API_BASE_URL}/students/bulk-assign-subjects`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    studentIds: selectedStudentIds,
                    subjectIds: bulkSubjects.map(id => parseInt(id)),
                    action: bulkActionType,
                }),
            });

            if (!res.ok) throw new Error("Bulk assign failed");

            toast.success("Subjects assigned successfully!");
            setShowBulkModal(false);
            setBulkSubjects([]);
            setSelectedStudentIds([]); // Clear selection after success

            // Refresh data
            const refreshRes = await authFetch(`${API_BASE_URL}/students`);
            if (refreshRes.ok) {
                const refreshedStudents = await refreshRes.json();
                setStudents(refreshedStudents);
                setFilteredStudents(prevFiltered => prevFiltered.map(fs => {
                    const updated = refreshedStudents.find((rs: any) => rs.id === fs.id);
                    return updated ? updated : fs;
                }));
            }
        } catch (err) {
            toast.error("Failed to assign subjects in bulk.");
        } finally {
            setBulkLoading(false);
        }
    };

    const columns = [
        {
            header: (
                <input
                    type="checkbox"
                    className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 cursor-pointer"
                    checked={filteredStudents.length > 0 && selectedStudentIds.length === filteredStudents.length}
                    onChange={(e) => {
                        if (e.target.checked) {
                            setSelectedStudentIds(filteredStudents.map(s => s.id));
                        } else {
                            setSelectedStudentIds([]);
                        }
                    }}
                />
            ),
            className: "w-10",
            render: (s: any) => (
                <input
                    type="checkbox"
                    className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 cursor-pointer"
                    checked={selectedStudentIds.includes(s.id)}
                    onChange={(e) => {
                        if (e.target.checked) {
                            setSelectedStudentIds(prev => [...prev, s.id]);
                        } else {
                            setSelectedStudentIds(prev => prev.filter(id => id !== s.id));
                        }
                    }}
                />
            )
        },
        { header: "ID", accessor: "id", className: "w-16", sortable: true, sortKey: "id" },
        { header: "Name", render: (s: any) => `${s.firstName} ${s.lastName}`, sortable: true, sortKey: "firstName" },
        { header: "Class / Section", render: (s: any) => s.class ? `${s.class.name} - ${s.section?.name}` : 'Not Assigned' },
        {
            header: "Roll No",
            render: (s: any) => {
                const activeEnrollment = s.enrollments?.find((e: any) => e.status === 'ACTIVE');
                return activeEnrollment?.rollNo ?? '-';
            }
        },
        {
            header: "Enrolled Subjects",
            render: (s: any) => (
                <div className="flex flex-wrap gap-1">
                    {s.studentSubjects?.length > 0
                        ? s.studentSubjects.map((ss: any) => (
                            <span key={ss.id} className="bg-blue-100 text-blue-800 text-xs font-medium px-2 py-0.5 rounded">
                                {(ss.subject || ss.extraSubject)?.name}
                            </span>
                        ))
                        : <span className="text-gray-400 italic">None</span>
                    }
                </div>
            )
        },
        {
            header: "Action",
            render: (s: any) => (
                <button
                    onClick={() => {
                        setSelectedStudent(s.id.toString());
                        setShowEditModal(true);
                    }}
                    className="font-medium text-blue-600 hover:underline"
                >
                    Edit Enrollment
                </button>
            )
        }
    ];

    return (
        <main className="p-4 bg-slate-50 min-h-screen">
            <Toaster position="top-right" />
            <div className="max-w-6xl mx-auto">
                <div className="bg-white p-8 rounded-lg shadow-sm border border-slate-200 mb-6">
                    <h2 className="text-2xl font-bold mb-6 text-slate-800">Enrollment Management</h2>

                    {/* Filter Controls */}
                    <div className="mb-8 p-6 bg-gray-50 rounded-lg border border-gray-200">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-4">
                            <div>
                                <label className="block mb-2 text-sm font-medium text-gray-900">Class</label>
                                <select
                                    value={filterClass}
                                    onChange={(e) => setFilterClass(e.target.value)}
                                    className="bg-white border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5"
                                >
                                    <option value="">All Classes</option>
                                    {classes.map((c: any) => (
                                        <option key={c.id} value={c.id}>{c.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block mb-2 text-sm font-medium text-gray-900">Section</label>
                                <select
                                    value={filterSection}
                                    onChange={(e) => setFilterSection(e.target.value)}
                                    className="bg-white border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5"
                                    disabled={!filterClass}
                                >
                                    <option value="">All Sections</option>
                                    {availableSections.map((s: any) => (
                                        <option key={s.id} value={s.id}>{s.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block mb-2 text-sm font-medium text-gray-900">Search</label>
                                <input
                                    type="text"
                                    placeholder="ID, Name or Email"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="bg-white border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5"
                                />
                            </div>
                        </div>
                        <div className="flex justify-end">
                            <button
                                onClick={handleSearch}
                                disabled={searchLoading}
                                className="text-white bg-blue-700 hover:bg-blue-800 focus:ring-4 focus:ring-blue-300 font-medium rounded-lg text-sm px-5 py-2.5 mr-2 mb-2 focus:outline-none"
                            >
                                {searchLoading ? 'Searching...' : 'Search Students'}
                            </button>
                        </div>
                    </div>

                    {/* Results Table */}
                    <div className="mb-8">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-lg font-semibold text-slate-700">Student List</h3>
                            {selectedStudentIds.length > 0 && (
                                <div className="flex items-center gap-4">
                                    <span className="text-sm font-medium text-blue-600 bg-blue-50 px-3 py-1 rounded-full">
                                        {selectedStudentIds.length} student(s) selected
                                    </span>
                                    <button
                                        onClick={() => setShowBulkModal(true)}
                                        className="text-white bg-green-600 hover:bg-green-700 focus:ring-4 focus:ring-green-300 font-medium rounded-lg text-sm px-4 py-2 focus:outline-none"
                                    >
                                        Bulk Assign Subjects
                                    </button>
                                </div>
                            )}
                        </div>
                        <Table
                            columns={columns}
                            data={filteredStudents}
                            loading={searchLoading}
                            emptyMessage="Use filters and click Search to see students."
                            defaultSortColumn="firstName"
                        />
                    </div>

                    {/* Enrollment Form Modal */}
                    {showEditModal && selectedStudent && studentData && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
                            <div className="bg-white p-8 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
                                <h3 className="text-xl font-bold mb-6 text-slate-800">
                                    Edit Enrollment: <span className="text-blue-600">[#{studentData.id}] {studentData.firstName} {studentData.lastName}</span>
                                </h3>

                                {error && <div className="p-4 mb-4 text-sm text-red-800 rounded-lg bg-red-50">{error}</div>}

                                <form onSubmit={handleSubmit}>
                                    {!studentData.class ? (
                                        <div className="grid gap-6 mb-6 md:grid-cols-3">
                                            <div>
                                                <label htmlFor="class" className="block mb-2 text-sm font-medium text-gray-900">Class</label>
                                                <select
                                                    id="class"
                                                    value={selectedClass}
                                                    onChange={(e) => setSelectedClass(e.target.value)}
                                                    className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5"
                                                    required
                                                >
                                                    <option value="">Choose a class</option>
                                                    {classes.map((cls: any) => (
                                                        <option key={cls.id} value={cls.id}>
                                                            {cls.name}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div>
                                                <label htmlFor="section" className="block mb-2 text-sm font-medium text-gray-900">Section</label>
                                                <select
                                                    id="section"
                                                    value={selectedSection}
                                                    onChange={(e) => setSelectedSection(e.target.value)}
                                                    className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5"
                                                    required
                                                    disabled={!selectedClass}
                                                >
                                                    <option value="">Choose a section</option>
                                                    {sections.map((section: any) => (
                                                        <option key={section.id} value={section.id}>
                                                            {section.name}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                            <div>
                                                <label htmlFor="session" className="block mb-2 text-sm font-medium text-gray-900">Academic Session</label>
                                                <select
                                                    id="session"
                                                    value={selectedSessionId}
                                                    onChange={(e) => setSelectedSessionId(e.target.value === "" ? "" : Number(e.target.value))}
                                                    className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5"
                                                    required
                                                >
                                                    <option value="">Choose a session</option>
                                                    {academicSessions.map((session: any) => (
                                                        <option key={session.id} value={session.id}>
                                                            {session.name} {session.isActive ? '(Current)' : ''}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                                            <div className="flex flex-wrap gap-8">
                                                <div>
                                                    <span className="block text-xs font-bold text-gray-500 uppercase">Class</span>
                                                    <span className="text-gray-900 font-medium">{studentData.class.name}</span>
                                                </div>
                                                <div>
                                                    <span className="block text-xs font-bold text-gray-500 uppercase">Section</span>
                                                    <span className="text-gray-900 font-medium">{studentData.section.name}</span>
                                                </div>
                                                <div>
                                                    <span className="block text-xs font-bold text-gray-500 uppercase">Academic Session</span>
                                                    <span className="text-gray-900 font-medium">
                                                        {studentData.enrollments?.find((e: any) => e.status === 'ACTIVE')?.academicSession?.name || 'N/A'}
                                                    </span>
                                                </div>
                                            </div>
                                            <p className="mt-2 text-xs text-yellow-700">
                                                Class, Section, and Academic Session cannot be changed here. Use the "Bulk Promotion" page to change them.
                                            </p>
                                        </div>
                                    )}

                                    <div className="mb-6">
                                        <label className="block mb-2 text-sm font-medium text-gray-900">Subjects</label>
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-gray-50 p-6 rounded-lg border border-gray-200">
                                            {subjects.map((subject: any) => (
                                                <div key={subject.id} className="flex items-center">
                                                    <input
                                                        id={`subject-${subject.id}`}
                                                        type="checkbox"
                                                        value={subject.id}
                                                        checked={selectedSubjects.includes(subject.id.toString())}
                                                        onChange={() => handleSubjectToggle(subject.id.toString())}
                                                        className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2 cursor-pointer"
                                                    />
                                                    <label htmlFor={`subject-${subject.id}`} className="ml-2 text-sm font-medium text-gray-900 cursor-pointer select-none">
                                                        {subject.name}
                                                    </label>
                                                </div>
                                            ))}
                                        </div>
                                        <p className="mt-2 text-sm text-gray-500">Select all subjects that apply.</p>
                                    </div>

                                    <div className="flex items-center justify-end space-x-4 border-t pt-4">
                                        <button
                                            type="button"
                                            onClick={() => setShowEditModal(false)}
                                            className="px-4 py-2 border border-gray-300 rounded text-gray-700 hover:bg-gray-50 transition-colors"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={loading}
                                            className="text-white bg-blue-700 hover:bg-blue-800 focus:ring-4 focus:outline-none focus:ring-blue-300 font-medium rounded-lg text-sm w-full sm:w-auto px-5 py-2.5 text-center disabled:opacity-50"
                                        >
                                            {loading ? 'Saving Enrollment...' : 'Update Enrollment'}
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    )}

                    {/* Bulk Assign Subjects Modal */}
                    {showBulkModal && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
                            <div className="bg-white p-8 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                                <h3 className="text-xl font-bold mb-6 text-slate-800">
                                    Bulk Assign Subjects ({selectedStudentIds.length} students)
                                </h3>

                                <form onSubmit={handleBulkSubmit}>
                                    <div className="mb-6">
                                        <label className="block mb-2 text-sm font-medium text-gray-900">Action Type</label>
                                        <div className="flex space-x-4">
                                            <label className="flex items-center space-x-2">
                                                <input
                                                    type="radio"
                                                    name="bulkActionType"
                                                    value="REPLACE"
                                                    checked={bulkActionType === "REPLACE"}
                                                    onChange={(e) => setBulkActionType(e.target.value as "ADD" | "REPLACE")}
                                                    className="text-blue-600 focus:ring-blue-500"
                                                />
                                                <span className="text-sm font-medium text-gray-900">Replace existing subjects</span>
                                            </label>
                                            <label className="flex items-center space-x-2">
                                                <input
                                                    type="radio"
                                                    name="bulkActionType"
                                                    value="ADD"
                                                    checked={bulkActionType === "ADD"}
                                                    onChange={(e) => setBulkActionType(e.target.value as "ADD" | "REPLACE")}
                                                    className="text-blue-600 focus:ring-blue-500"
                                                />
                                                <span className="text-sm font-medium text-gray-900">Add to existing subjects</span>
                                            </label>
                                        </div>
                                    </div>

                                    <div className="mb-6">
                                        <label className="block mb-2 text-sm font-medium text-gray-900">Subjects</label>
                                        <div className="grid grid-cols-2 gap-4 bg-gray-50 p-6 rounded-lg border border-gray-200">
                                            {subjects.map((subject: any) => (
                                                <div key={subject.id} className="flex items-center">
                                                    <input
                                                        id={`bulk-subject-${subject.id}`}
                                                        type="checkbox"
                                                        value={subject.id}
                                                        checked={bulkSubjects.includes(subject.id.toString())}
                                                        onChange={(e) => {
                                                            const idStr = subject.id.toString();
                                                            setBulkSubjects(prev =>
                                                                e.target.checked
                                                                    ? [...prev, idStr]
                                                                    : prev.filter(id => id !== idStr)
                                                            );
                                                        }}
                                                        className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2 cursor-pointer"
                                                    />
                                                    <label htmlFor={`bulk-subject-${subject.id}`} className="ml-2 text-sm font-medium text-gray-900 cursor-pointer select-none">
                                                        {subject.name}
                                                    </label>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-end space-x-4 border-t pt-4">
                                        <button
                                            type="button"
                                            onClick={() => setShowBulkModal(false)}
                                            className="px-4 py-2 border border-gray-300 rounded text-gray-700 hover:bg-gray-50 transition-colors"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={bulkLoading}
                                            className="text-white bg-green-600 hover:bg-green-700 focus:ring-4 focus:outline-none focus:ring-green-300 font-medium rounded-lg text-sm w-full sm:w-auto px-5 py-2.5 text-center disabled:opacity-50"
                                        >
                                            {bulkLoading ? 'Applying...' : 'Apply Subjects'}
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </main>
    );
}

