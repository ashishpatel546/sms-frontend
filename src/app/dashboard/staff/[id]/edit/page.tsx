"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { API_BASE_URL } from "@/lib/api";
import { Country, State, City } from "country-state-city";
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
        fathersName: "",
        mothersName: "",
        staffCategory: "",
        designationId: "",
        isActive: true,
        address: {
            addressLine1: "",
            addressLine2: "",
            landmark: "",
            city: "",
            state: "",
            postalCode: "",
            country: "IN",
        },
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

    // Address cascading
    const countries = Country.getAllCountries();
    const [states, setStates] = useState<any[]>(State.getStatesOfCountry("IN"));
    const [cities, setCities] = useState<any[]>([]);

    useEffect(() => {
        if (formData.address.country) {
            setStates(State.getStatesOfCountry(formData.address.country));
        }
    }, [formData.address.country]);

    useEffect(() => {
        if (formData.address.country && formData.address.state) {
            setCities(City.getCitiesOfState(formData.address.country, formData.address.state));
        } else {
            setCities([]);
        }
    }, [formData.address.country, formData.address.state]);

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
                    fathersName: teacher.fathersName || "",
                    mothersName: teacher.mothersName || "",
                    staffCategory: teacher.staffCategory || "",
                    designationId: teacher.designation?.id || "",
                    isActive: teacher.isActive ?? true,
                    address: {
                        addressLine1: teacher.address?.addressLine1 || "",
                        addressLine2: teacher.address?.addressLine2 || "",
                        landmark: teacher.address?.landmark || "",
                        city: teacher.address?.city || "",
                        state: teacher.address?.state || "",
                        postalCode: teacher.address?.postalCode || "",
                        country: teacher.address?.country || "IN",
                    },
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

    const handleAddressChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        if (name === "country") {
            setFormData(prev => ({ ...prev, address: { ...prev.address, country: value, state: "", city: "" } }));
        } else if (name === "state") {
            setFormData(prev => ({ ...prev, address: { ...prev.address, state: value, city: "" } }));
        } else {
            setFormData(prev => ({ ...prev, address: { ...prev.address, [name]: value } }));
        }
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
            
            // Resolve country/state ISO codes → full names
            if (
                payload.address.addressLine1 &&
                payload.address.city &&
                payload.address.state &&
                payload.address.postalCode
            ) {
                const countryObj = Country.getCountryByCode(payload.address.country);
                const stateObj = State.getStateByCodeAndCountry(payload.address.state, payload.address.country);
                payload.address.country = countryObj ? countryObj.name : payload.address.country;
                payload.address.state = stateObj ? stateObj.name : payload.address.state;
            } else {
                delete (payload as any).address;
            }

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
                    {/* ── BASIC INFORMATION ── */}
                    <div>
                        <h3 className="text-sm font-semibold text-slate-600 uppercase tracking-wide border-b border-slate-200 pb-2 mb-4">Basic Information</h3>
                        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
                            <div>
                                <label className="block mb-1 text-sm font-medium text-gray-900">First Name <span className="text-red-500">*</span></label>
                                <input type="text" name="firstName" value={formData.firstName} onChange={handleChange} required
                                    className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5" />
                            </div>
                            <div>
                                <label className="block mb-1 text-sm font-medium text-gray-900">Last Name <span className="text-red-500">*</span></label>
                                <input type="text" name="lastName" value={formData.lastName} onChange={handleChange} required
                                    className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5" />
                            </div>
                            <div>
                                <label className="block mb-1 text-sm font-medium text-gray-900">Gender</label>
                                <select name="gender" value={formData.gender} onChange={handleChange} required
                                    className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5">
                                    <option value="">Select Gender</option>
                                    <option value="Male">Male</option>
                                    <option value="Female">Female</option>
                                    <option value="Others">Others</option>
                                </select>
                            </div>
                            <div>
                                <label className="block mb-1 text-sm font-medium text-gray-900">Date of Birth</label>
                                <input type="date" name="dateOfBirth" value={formData.dateOfBirth} onChange={handleChange} required
                                    className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5" />
                            </div>
                            <div>
                                <label className="block mb-1 text-sm font-medium text-gray-900">Blood Group</label>
                                <select name="bloodGroup" value={formData.bloodGroup} onChange={handleChange}
                                    className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5">
                                    <option value="">Select Group</option>
                                    <option value="A+">A+</option><option value="A-">A-</option>
                                    <option value="B+">B+</option><option value="B-">B-</option>
                                    <option value="O+">O+</option><option value="O-">O-</option>
                                    <option value="AB+">AB+</option><option value="AB-">AB-</option>
                                </select>
                            </div>
                            <div>
                                <label className="block mb-1 text-sm font-medium text-gray-900">Aadhaar Number <span className="text-gray-400 font-normal">(Optional)</span></label>
                                <input type="text" name="aadhaarNumber" value={formData.aadhaarNumber} onChange={handleChange} maxLength={14}
                                    className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5" />
                            </div>
                        </div>
                    </div>

                    {/* ── CONTACT INFORMATION ── */}
                    <div>
                        <h3 className="text-sm font-semibold text-slate-600 uppercase tracking-wide border-b border-slate-200 pb-2 mb-4">Contact Information</h3>
                        <div className="grid gap-4 sm:grid-cols-3">
                            <div>
                                <label className="block mb-1 text-sm font-medium text-gray-900">Email Address <span className="text-red-500">*</span></label>
                                <input type="email" name="email" value={formData.email} onChange={handleChange} required readOnly
                                    className="bg-gray-100 border border-gray-300 text-gray-600 text-sm rounded-lg block w-full p-2.5 cursor-not-allowed" title="Email cannot be changed" />
                            </div>
                            <div>
                                <label className="block mb-1 text-sm font-medium text-gray-900">Mobile <span className="text-red-500">*</span></label>
                                <input type="tel" name="mobile" value={formData.mobile} onChange={handleChange} required
                                    className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5" />
                            </div>
                            <div>
                                <label className="block mb-1 text-sm font-medium text-gray-900">Alternate Mobile <span className="text-gray-400 font-normal">(Optional)</span></label>
                                <input type="tel" name="alternateMobile" value={formData.alternateMobile} onChange={handleChange}
                                    className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5" />
                            </div>
                        </div>
                    </div>

                    {/* ── ADDRESS INFORMATION ── */}
                    <div>
                        <h3 className="text-sm font-semibold text-slate-600 uppercase tracking-wide border-b border-slate-200 pb-2 mb-4">Address Information</h3>
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div>
                                <label className="block mb-1 text-sm font-medium text-gray-900">Country <span className="text-red-500">*</span></label>
                                <select name="country" value={formData.address.country} onChange={handleAddressChange}
                                    className="bg-gray-50 border border-gray-300 text-sm rounded-lg block w-full p-2.5">
                                    <option value="">Select Country</option>
                                    {countries.map(c => <option key={c.isoCode} value={c.isoCode}>{c.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block mb-1 text-sm font-medium text-gray-900">State <span className="text-red-500">*</span></label>
                                <select name="state" value={formData.address.state} onChange={handleAddressChange} disabled={!states.length}
                                    className="bg-gray-50 border border-gray-300 text-sm rounded-lg block w-full p-2.5 disabled:opacity-50">
                                    <option value="">Select State</option>
                                    {states.map(s => <option key={s.isoCode} value={s.isoCode}>{s.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block mb-1 text-sm font-medium text-gray-900">City <span className="text-red-500">*</span></label>
                                {cities.length > 0 ? (
                                    <select name="city" value={formData.address.city} onChange={handleAddressChange}
                                        className="bg-gray-50 border border-gray-300 text-sm rounded-lg block w-full p-2.5">
                                        <option value="">Select City</option>
                                        {cities.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                                    </select>
                                ) : (
                                    <input type="text" name="city" value={formData.address.city} onChange={handleAddressChange}
                                        placeholder="City name" disabled={!formData.address.state}
                                        className="bg-gray-50 border border-gray-300 text-sm rounded-lg block w-full p-2.5 disabled:opacity-50" />
                                )}
                            </div>
                            <div>
                                <label className="block mb-1 text-sm font-medium text-gray-900">Postal Code <span className="text-red-500">*</span></label>
                                <input type="text" name="postalCode" value={formData.address.postalCode} onChange={handleAddressChange}
                                    placeholder="PIN code" className="bg-gray-50 border border-gray-300 text-sm rounded-lg block w-full p-2.5" />
                            </div>
                            <div className="sm:col-span-2">
                                <label className="block mb-1 text-sm font-medium text-gray-900">Address Line 1 <span className="text-red-500">*</span></label>
                                <input type="text" name="addressLine1" value={formData.address.addressLine1} onChange={handleAddressChange}
                                    placeholder="Street address, Flat no, etc." className="bg-gray-50 border border-gray-300 text-sm rounded-lg block w-full p-2.5" />
                            </div>
                            <div className="sm:col-span-2">
                                <label className="block mb-1 text-sm font-medium text-gray-900">Address Line 2 <span className="text-gray-400 font-normal">(Optional)</span></label>
                                <input type="text" name="addressLine2" value={formData.address.addressLine2} onChange={handleAddressChange}
                                    placeholder="Apartment, suite, unit, etc." className="bg-gray-50 border border-gray-300 text-sm rounded-lg block w-full p-2.5" />
                            </div>
                            <div className="sm:col-span-2">
                                <label className="block mb-1 text-sm font-medium text-gray-900">Landmark <span className="text-gray-400 font-normal">(Optional)</span></label>
                                <input type="text" name="landmark" value={formData.address.landmark} onChange={handleAddressChange}
                                    placeholder="Near..." className="bg-gray-50 border border-gray-300 text-sm rounded-lg block w-full p-2.5" />
                            </div>
                        </div>
                    </div>

                    {/* ── DEMOGRAPHICS ── */}
                    <div>
                        <h3 className="text-sm font-semibold text-slate-600 uppercase tracking-wide border-b border-slate-200 pb-2 mb-4">Demographics</h3>
                        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
                            <div>
                                <label className="block mb-1 text-sm font-medium text-gray-900">Category</label>
                                <select name="category" value={formData.category} onChange={handleChange} required
                                    className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5">
                                    <option value="">Select Category</option>
                                    {["General", "SC", "ST", "OBC", "EWS"].map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block mb-1 text-sm font-medium text-gray-900">Religion</label>
                                <select name="religion" value={formData.religion} onChange={handleChange} required
                                    className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5">
                                    <option value="">Select Religion</option>
                                    {["HINDU", "MUSLIM", "SIKH", "CHRISTIAN", "PARSI", "OTHERS"].map(r => (
                                        <option key={r} value={r}>{r[0] + r.slice(1).toLowerCase()}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block mb-1 text-sm font-medium text-gray-900">Father&apos;s Name <span className="text-gray-400 font-normal">(Optional)</span></label>
                                <input type="text" name="fathersName" value={formData.fathersName} onChange={handleChange}
                                    placeholder="Father's name" className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5" />
                            </div>
                            <div>
                                <label className="block mb-1 text-sm font-medium text-gray-900">Mother&apos;s Name <span className="text-gray-400 font-normal">(Optional)</span></label>
                                <input type="text" name="mothersName" value={formData.mothersName} onChange={handleChange}
                                    placeholder="Mother's name" className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5" />
                            </div>
                        </div>
                    </div>

                    {/* ── EMPLOYMENT DETAILS ── */}
                    <div>
                        <h3 className="text-sm font-semibold text-slate-600 uppercase tracking-wide border-b border-slate-200 pb-2 mb-4">Employment Details</h3>
                        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3">
                            <div>
                                <label className="block mb-1 text-sm font-medium text-gray-900">Staff Category <span className="text-red-500">*</span></label>
                                <select name="staffCategory" value={formData.staffCategory} onChange={handleChange} required
                                    className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5">
                                    <option value="">Select Category</option>
                                    <option value="Teaching Staff">Teaching Staff</option>
                                    <option value="Management">Management</option>
                                    <option value="Support Staff">Support Staff</option>
                                    <option value="Admin Staff">Admin Staff</option>
                                </select>
                            </div>
                            <div>
                                <label className="block mb-1 text-sm font-medium text-gray-900">Designation <span className="text-red-500">*</span></label>
                                <select name="designationId" value={String(formData.designationId)} onChange={handleChange} required
                                    className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5">
                                    <option value="">Select Designation</option>
                                    {designations.map(d => <option key={d.id} value={d.id}>{d.title}</option>)}
                                    {isAdmin && <option value="CREATE_NEW" className="font-bold text-blue-600">+ Create New Designation</option>}
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* ── ACCOUNT STATUS ── */}
                    <div className="flex items-center">
                        <input id="isActive" name="isActive" type="checkbox" checked={formData.isActive} onChange={handleChange}
                            className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500" />
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
