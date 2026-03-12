"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { API_BASE_URL } from "@/lib/api";
import { authFetch, getUser } from "@/lib/auth";
import toast from "react-hot-toast";

export default function EditStaffPage() {
    const router = useRouter();
    const params = useParams();
    const id = params?.id as string;
    const currentUser = getUser();
    const isAdmin = currentUser?.role === "SUPER_ADMIN" || currentUser?.role === "ADMIN";

    const [formData, setFormData] = useState({
        firstName: "",
        lastName: "",
        email: "",
        mobile: "",
        alternateMobile: "",
        gender: "",
        dateOfBirth: "",
        bloodGroup: "",
        aadhaarNumber: "",
        category: "",
        religion: "",
        staffCategory: "",
        designationId: "",
        isActive: true,
    });
    const [assignments, setAssignments] = useState<any[]>([]);

    // Assignment Form State
    const [classes, setClasses] = useState<any[]>([]);
    const [subjects, setSubjects] = useState<any[]>([]);
    const [selectedClass, setSelectedClass] = useState("");
    const [selectedSection, setSelectedSection] = useState("");
    const [selectedSubject, setSelectedSubject] = useState("");
    const [assignLoading, setAssignLoading] = useState(false);
    const [assignError, setAssignError] = useState("");

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    // Inline designation creation state
    const [showDesModal, setShowDesModal] = useState(false);
    const [newDesTitle, setNewDesTitle] = useState("");
    const [creatingDes, setCreatingDes] = useState(false);

    const [designations, setDesignations] = useState<any[]>([]);

    const fetchTeacherDetails = async () => {
        try {
            const [teachersRes, classesRes, subjectsRes, desigRes] = await Promise.all([
                authFetch(`${API_BASE_URL}/staff`),
                authFetch(`${API_BASE_URL}/classes`),
                authFetch(`${API_BASE_URL}/subjects`),
                authFetch(`${API_BASE_URL}/designations`)
            ]);

            if (!teachersRes.ok) throw new Error("Failed to fetch staff");
            const teachers = await teachersRes.json();
            const teacher = teachers.data ? teachers.data.find((t: any) => t.id === parseInt(id)) : teachers.find((t: any) => t.id === parseInt(id));

            if (teacher) {
                setFormData({
                    firstName: teacher.firstName || "",
                    lastName: teacher.lastName || "",
                    email: teacher.email || "",
                    mobile: teacher.mobile || "",
                    alternateMobile: teacher.alternateMobile || "",
                    gender: teacher.gender || "",
                    dateOfBirth: teacher.dateOfBirth ? new Date(teacher.dateOfBirth).toISOString().split('T')[0] : "",
                    bloodGroup: teacher.bloodGroup || "",
                    aadhaarNumber: teacher.aadhaarNumber || "",
                    category: teacher.category || "",
                    religion: teacher.religion || "",
                    staffCategory: teacher.staffCategory || "",
                    designationId: teacher.designation?.id || "",
                    isActive: teacher.isActive ?? true,
                });
                const activeAssignments = teacher.subjectAssignments?.filter((a: any) => a.isActive) || [];
                setAssignments(activeAssignments);
            } else {
                setError("Staff not found");
            }

            if (classesRes.ok) setClasses(await classesRes.json());
            if (subjectsRes.ok) setSubjects(await subjectsRes.json());
            if (desigRes.ok) setDesignations(await desigRes.json());
        } catch (err) {
            setError("Failed to load data");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!id) return;
        fetchTeacherDetails();
    }, [id]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const target = e.target as HTMLInputElement;
        const value = target.type === 'checkbox' ? target.checked : target.value;

        if (target.name === 'designationId' && value === 'CREATE_NEW') {
            setShowDesModal(true);
            return;
        }

        setFormData({ ...formData, [target.name]: value });
    };

    const handleCreateDesignation = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newDesTitle.trim()) return;
        setCreatingDes(true);
        try {
            const res = await authFetch(`${API_BASE_URL}/designations`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ title: newDesTitle.trim(), description: "" })
            });
            if (res.ok) {
                const newD = await res.json();
                setDesignations([...designations, newD]);
                setFormData({ ...formData, designationId: newD.id });
                setShowDesModal(false);
                setNewDesTitle("");
                toast.success("Designation created successfully");
            } else {
                toast.error("Failed to create designation");
            }
        } catch (err) {
            toast.error("Failed to create designation");
        }
        setCreatingDes(false);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setError("");

        try {
            const payload = { ...formData };
            if (payload.designationId) {
                payload.designationId = parseInt(payload.designationId as any) as any;
            } else {
                delete (payload as any).designationId;
            }

            const res = await authFetch(`${API_BASE_URL}/staff/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.message || "Failed to update staff");
            }

            router.push("/dashboard/staff");
            router.refresh();
        } catch (err: any) {
            console.error(err);
            setError(err.message || "Failed to update staff. Please try again.");
        } finally {
            setSaving(false);
        }
    };

    const handleAssignSubject = async (e: React.FormEvent) => {
        e.preventDefault();
        setAssignLoading(true);
        setAssignError("");
        try {
            const res = await authFetch(`${API_BASE_URL}/staff/${id}/assign-subject`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    classId: parseInt(selectedClass),
                    sectionId: parseInt(selectedSection),
                    subjectId: parseInt(selectedSubject)
                })
            });

            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.message || "Failed to assign subject");
            }

            await fetchTeacherDetails();
            setSelectedClass("");
            setSelectedSection("");
            setSelectedSubject("");
        } catch (err: any) {
            console.error(err);
            setAssignError(err.message || "Failed to assign subject");
        } finally {
            setAssignLoading(false);
        }
    };

    const handleUnassignSubject = async (assignmentId: number) => {
        if (!confirm("Are you sure you want to unassign this subject?")) return;
        try {
            const res = await authFetch(`${API_BASE_URL}/staff/${id}/assignments/${assignmentId}`, {
                method: "DELETE",
            });
            if (!res.ok) throw new Error("Failed to unassign subject");
            await fetchTeacherDetails();
        } catch (err) {
            console.error(err);
            alert("Failed to unassign subject");
        }
    };

    if (loading) return <div className="p-4">Loading...</div>;
    if (error && !formData.firstName) return <div className="p-4 text-red-600">{error}</div>;

    const sectionsForClass = classes.find(c => c.id.toString() === selectedClass)?.sections || [];

    return (
        <main className="p-4 bg-slate-50 min-h-screen space-y-6">
            <div className="max-w-4xl mx-auto bg-white p-8 rounded-lg shadow-sm border border-slate-200">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold text-slate-800">Edit Staff</h2>
                    <Link href="/dashboard/staff" className="text-blue-600 hover:underline">
                        &larr; Back to Staff
                    </Link>
                </div>

                {error && (
                    <div className="p-4 mb-4 text-sm text-red-800 rounded-lg bg-red-50" role="alert">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-8">
                    {/* Basic Info */}
                    <div>
                        <h3 className="text-lg font-bold mb-4 text-slate-700 border-b pb-2">Basic Information</h3>
                        <div className="grid gap-6 md:grid-cols-3">
                            <div>
                                <label htmlFor="firstName" className="block mb-2 text-sm font-medium text-gray-900">First name <span className="text-red-500">*</span></label>
                                <input type="text" id="firstName" name="firstName" value={formData.firstName} onChange={handleChange} className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5" required />
                            </div>
                            <div>
                                <label htmlFor="lastName" className="block mb-2 text-sm font-medium text-gray-900">Last name <span className="text-red-500">*</span></label>
                                <input type="text" id="lastName" name="lastName" value={formData.lastName} onChange={handleChange} className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5" required />
                            </div>
                            <div>
                                <label htmlFor="staffCategory" className="block mb-2 text-sm font-medium text-gray-900">Staff Category <span className="text-red-500">*</span></label>
                                <select id="staffCategory" name="staffCategory" value={formData.staffCategory} onChange={handleChange} className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5" required>
                                    <option value="">Select Category</option>
                                    <option value="Teaching Staff">Teaching Staff</option>
                                    <option value="Management">Management</option>
                                    <option value="Support Staff">Support Staff</option>
                                    <option value="Admin Staff">Admin Staff</option>
                                </select>
                            </div>
                            <div>
                                <label htmlFor="designationId" className="block mb-2 text-sm font-medium text-gray-900">Designation <span className="text-red-500">*</span></label>
                                <select id="designationId" name="designationId" value={formData.designationId} onChange={handleChange} className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5" required>
                                    <option value="">Select Designation</option>
                                    {designations.map(d => (
                                        <option key={d.id} value={d.id}>{d.title}</option>
                                    ))}
                                    {isAdmin && <option value="CREATE_NEW" className="font-bold text-blue-600">+ Create New Designation</option>}
                                </select>
                            </div>
                            <div>
                                <label htmlFor="gender" className="block mb-2 text-sm font-medium text-gray-900">Gender</label>
                                <select id="gender" name="gender" value={formData.gender} onChange={handleChange} className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5">
                                    <option value="">Select Gender</option>
                                    <option value="Male">Male</option>
                                    <option value="Female">Female</option>
                                    <option value="Others">Others</option>
                                </select>
                            </div>
                            <div>
                                <label htmlFor="dateOfBirth" className="block mb-2 text-sm font-medium text-gray-900">Date of Birth</label>
                                <input type="date" id="dateOfBirth" name="dateOfBirth" value={formData.dateOfBirth} onChange={handleChange} className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5" />
                            </div>
                            <div>
                                <label htmlFor="bloodGroup" className="block mb-2 text-sm font-medium text-gray-900">Blood Group</label>
                                <select id="bloodGroup" name="bloodGroup" value={formData.bloodGroup} onChange={handleChange} className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5">
                                    <option value="">Select Group</option>
                                    <option value="A+">A+</option><option value="A-">A-</option>
                                    <option value="B+">B+</option><option value="B-">B-</option>
                                    <option value="O+">O+</option><option value="O-">O-</option>
                                    <option value="AB+">AB+</option><option value="AB-">AB-</option>
                                </select>
                            </div>
                            <div>
                                <label htmlFor="aadhaarNumber" className="block mb-2 text-sm font-medium text-gray-900">Aadhaar Number <span className="text-gray-400 font-normal">(Optional)</span></label>
                                <input type="text" id="aadhaarNumber" name="aadhaarNumber" value={formData.aadhaarNumber} onChange={handleChange} className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5" />
                            </div>
                        </div>
                    </div>

                    {/* Contact Info */}
                    <div>
                        <h3 className="text-lg font-bold mb-4 text-slate-700 border-b pb-2">Contact Information</h3>
                        <div className="grid gap-6 md:grid-cols-3">
                            <div>
                                <label htmlFor="email" className="block mb-2 text-sm font-medium text-gray-900">Email address <span className="text-red-500">*</span></label>
                                <input type="email" id="email" name="email" value={formData.email} onChange={handleChange} className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5" required />
                            </div>
                            <div>
                                <label htmlFor="mobile" className="block mb-2 text-sm font-medium text-gray-900">Mobile Number <span className="text-gray-400 font-normal">(Optional)</span></label>
                                <input type="tel" id="mobile" name="mobile" value={formData.mobile} onChange={handleChange} className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5" />
                            </div>
                            <div>
                                <label htmlFor="alternateMobile" className="block mb-2 text-sm font-medium text-gray-900">Alternate Mobile <span className="text-gray-400 font-normal">(Optional)</span></label>
                                <input type="tel" id="alternateMobile" name="alternateMobile" value={formData.alternateMobile} onChange={handleChange} className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5" />
                            </div>
                        </div>
                    </div>

                    {/* Demographics */}
                    <div>
                        <h3 className="text-lg font-bold mb-4 text-slate-700 border-b pb-2">Demographics</h3>
                        <div className="grid gap-6 md:grid-cols-2">
                            <div>
                                <label htmlFor="category" className="block mb-2 text-sm font-medium text-gray-900">Category</label>
                                <select id="category" name="category" value={formData.category} onChange={handleChange} className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5">
                                    <option value="">Select Category</option>
                                    <option value="General">General</option>
                                    <option value="SC">SC</option>
                                    <option value="ST">ST</option>
                                    <option value="OBC">OBC</option>
                                    <option value="EWS">EWS</option>
                                </select>
                            </div>
                            <div>
                                <label htmlFor="religion" className="block mb-2 text-sm font-medium text-gray-900">Religion</label>
                                <select id="religion" name="religion" value={formData.religion} onChange={handleChange} className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5">
                                    <option value="">Select Religion</option>
                                    <option value="HINDU">HINDU</option>
                                    <option value="MUSLIM">MUSLIM</option>
                                    <option value="SIKH">SIKH</option>
                                    <option value="CHRISTIAN">CHRISTIAN</option>
                                    <option value="PARSI">PARSI</option>
                                    <option value="OTHERS">OTHERS</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Status */}
                    <div className="flex items-center">
                        <input id="isActive" name="isActive" type="checkbox" checked={formData.isActive} onChange={handleChange} className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500" />
                        <label htmlFor="isActive" className="ml-2 text-sm font-medium text-gray-900">Account Active</label>
                    </div>

                    <div className="flex items-center space-x-4 border-t pt-6">
                        <button type="submit" disabled={saving} className="text-white bg-blue-700 hover:bg-blue-800 focus:ring-4 focus:outline-none focus:ring-blue-300 font-medium rounded-lg text-sm w-full sm:w-auto px-5 py-2.5 text-center disabled:opacity-50">
                            {saving ? 'Saving...' : 'Save Changes'}
                        </button>
                        <Link href="/dashboard/staff" className="text-gray-900 bg-white border border-gray-300 focus:outline-none hover:bg-gray-100 focus:ring-4 focus:ring-gray-200 font-medium rounded-lg text-sm px-5 py-2.5">
                            Cancel
                        </Link>
                    </div>
                </form>
            </div>

            {/* Subject Assignments */}
            {formData.staffCategory === 'Teaching Staff' && (
            <div className="max-w-4xl mx-auto bg-white p-8 rounded-lg shadow-sm border border-slate-200">
                <h3 className="text-xl font-bold mb-4 text-slate-800">Subject Assignments</h3>

                <div className="mb-6">
                    <h4 className="font-semibold text-gray-700 mb-2">Current Assignments</h4>
                    {assignments.length === 0 ? (
                        <p className="text-gray-500 italic">No active subject assignments.</p>
                    ) : (
                        <div className="relative overflow-x-auto">
                            <table className="w-full text-sm text-left text-gray-500">
                                <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                                    <tr>
                                        <th scope="col" className="px-6 py-3">Subject</th>
                                        <th scope="col" className="px-6 py-3">Class</th>
                                        <th scope="col" className="px-6 py-3">Section</th>
                                        <th scope="col" className="px-6 py-3">Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {assignments.map((assignment: any) => (
                                        <tr key={assignment.id} className="bg-white border-b">
                                            <td className="px-6 py-4 font-medium text-gray-900">{assignment.subject?.name}</td>
                                            <td className="px-6 py-4">{assignment.class?.name}</td>
                                            <td className="px-6 py-4">{assignment.section?.name}</td>
                                            <td className="px-6 py-4">
                                                <button
                                                    type="button"
                                                    onClick={() => handleUnassignSubject(assignment.id)}
                                                    className="text-white bg-red-600 hover:bg-red-700 focus:ring-4 focus:outline-none focus:ring-red-300 font-medium rounded-lg text-xs px-3 py-1.5"
                                                >
                                                    Unassign
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                <div className="border-t pt-6">
                    <h4 className="font-semibold text-gray-700 mb-4">Assign New Subject</h4>
                    <form onSubmit={handleAssignSubject} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                        <div>
                            <label className="block mb-2 text-sm font-medium text-gray-900">Class</label>
                            <select value={selectedClass} onChange={(e) => { setSelectedClass(e.target.value); setSelectedSection(""); }} className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5">
                                <option value="">Select Class</option>
                                {classes.map((c: any) => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block mb-2 text-sm font-medium text-gray-900">Section</label>
                            <select value={selectedSection} onChange={(e) => setSelectedSection(e.target.value)} disabled={!selectedClass} className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 disabled:opacity-50">
                                <option value="">Select Section</option>
                                {sectionsForClass.map((s: any) => (
                                    <option key={s.id} value={s.id}>{s.name}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block mb-2 text-sm font-medium text-gray-900">Subject</label>
                            <select value={selectedSubject} onChange={(e) => setSelectedSubject(e.target.value)} className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5">
                                <option value="">Select Subject</option>
                                {subjects.map((s: any) => (
                                    <option key={s.id} value={s.id}>{s.name}</option>
                                ))}
                            </select>
                        </div>
                        <button type="submit" disabled={assignLoading || !selectedClass || !selectedSection || !selectedSubject} className="text-white bg-green-600 hover:bg-green-700 focus:ring-4 focus:outline-none focus:ring-green-300 font-medium rounded-lg text-sm px-5 py-2.5 text-center disabled:opacity-50">
                            {assignLoading ? 'Assigning...' : 'Assign'}
                        </button>
                    </form>
                    {assignError && (
                        <div className="mt-3 p-3 text-sm text-red-800 rounded-lg bg-red-50" role="alert">
                            {assignError}
                        </div>
                    )}
                </div>
            </div>
            )}

            {/* Designation Creation Modal */}
            {showDesModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                    <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-sm">
                        <h3 className="text-lg font-bold mb-4">Create New Designation</h3>
                        <form onSubmit={handleCreateDesignation}>
                            <input type="text" value={newDesTitle} onChange={e => setNewDesTitle(e.target.value)} placeholder="Designation Title (e.g. Principal)" className="w-full border p-2 rounded mb-4 focus:ring-2 focus:ring-blue-500 focus:outline-none" autoFocus required />
                            <div className="flex justify-end gap-2">
                                <button type="button" onClick={() => { setShowDesModal(false); setNewDesTitle(""); setFormData({...formData, designationId: ""}); }} className="px-4 py-2 text-sm bg-gray-200 rounded hover:bg-gray-300">Cancel</button>
                                <button type="submit" disabled={creatingDes} className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">{creatingDes ? "Creating..." : "Create"}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </main>
    );
}
