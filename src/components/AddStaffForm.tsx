"use client";

import { useState, useEffect } from "react";
import { API_BASE_URL } from "@/lib/api";
import { Country, State, City } from "country-state-city";
import toast from "react-hot-toast";
import { authFetch } from "@/lib/auth";

const ROLE_LABELS: Record<string, string> = {
    ADMIN: "Admin",
    SUB_ADMIN: "Sub Admin",
    TEACHER: "Teacher",
};

interface Props {
    /** Called with the newly created staff object on successful submission */
    onSuccess?: (newStaff: any) => void;
    /** Called when user clicks Cancel */
    onCancel?: () => void;
    /**
     * When true (admin panel), a "System Role" selector is shown so the caller
     * can assign ADMIN / SUB_ADMIN / TEACHER.  When false (staff/new page) the
     * role field is omitted and the backend defaults to TEACHER.
     */
    allowRoleSelect?: boolean;
    /** Controls which roles are exposed in the Role selector */
    isSuperAdmin?: boolean;
}

const EMPTY_FORM = {
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
    designationId: "" as string | number,
    isActive: true,
    role: "TEACHER",
    address: {
        addressLine1: "",
        addressLine2: "",
        landmark: "",
        city: "",
        state: "",
        postalCode: "",
        country: "IN",
    },
};

export default function AddStaffForm({
    onSuccess,
    onCancel,
    allowRoleSelect = false,
    isSuperAdmin = false,
}: Props) {
    const [formData, setFormData] = useState(EMPTY_FORM);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    // Designation
    const [designations, setDesignations] = useState<any[]>([]);
    const [showDesModal, setShowDesModal] = useState(false);
    const [newDesTitle, setNewDesTitle] = useState("");
    const [creatingDes, setCreatingDes] = useState(false);

    // Subject assignments (Teaching Staff only)
    const [classes, setClasses] = useState<any[]>([]);
    const [subjects, setSubjects] = useState<any[]>([]);
    const [pendingAssignments, setPendingAssignments] = useState<any[]>([]);
    const [selectedClass, setSelectedClass] = useState("");
    const [selectedSection, setSelectedSection] = useState("");
    const [selectedSubject, setSelectedSubject] = useState("");

    // Address cascading
    const countries = Country.getAllCountries();
    const [states, setStates] = useState<any[]>(State.getStatesOfCountry("IN"));
    const [cities, setCities] = useState<any[]>([]);

    useEffect(() => {
        const fetchSetupData = async () => {
            try {
                const [classesRes, subjectsRes, desigRes] = await Promise.all([
                    authFetch(`${API_BASE_URL}/classes`),
                    authFetch(`${API_BASE_URL}/subjects`),
                    authFetch(`${API_BASE_URL}/designations`),
                ]);
                if (classesRes.ok) setClasses(await classesRes.json());
                if (subjectsRes.ok) setSubjects(await subjectsRes.json());
                if (desigRes.ok) setDesignations(await desigRes.json());
            } catch (err) {
                console.error("Failed to load setup data", err);
            }
        };
        fetchSetupData();
    }, []);

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

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const target = e.target as HTMLInputElement;
        const value = target.type === "checkbox" ? target.checked : target.value;

        if (target.name === "designationId" && value === "CREATE_NEW") {
            setShowDesModal(true);
            return;
        }
        setFormData(prev => ({ ...prev, [target.name]: value }));
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
                body: JSON.stringify({ title: newDesTitle.trim(), description: "" }),
            });
            if (res.ok) {
                const newD = await res.json();
                setDesignations(prev => [...prev, newD]);
                setFormData(prev => ({ ...prev, designationId: newD.id }));
                setShowDesModal(false);
                setNewDesTitle("");
                toast.success("Designation created successfully");
            } else {
                toast.error("Failed to create designation");
            }
        } catch {
            toast.error("Failed to create designation");
        }
        setCreatingDes(false);
    };

    const sectionsForClass = classes.find(c => c.id.toString() === selectedClass)?.sections || [];

    const handleAddPendingAssignment = () => {
        if (!selectedClass || !selectedSection || !selectedSubject) return;
        const cls = classes.find(c => c.id.toString() === selectedClass);
        const sec = cls?.sections.find((s: any) => s.id.toString() === selectedSection);
        const sub = subjects.find(s => s.id.toString() === selectedSubject);
        setPendingAssignments(prev => [...prev, {
            classId: parseInt(selectedClass),
            className: cls?.name,
            sectionId: parseInt(selectedSection),
            sectionName: sec?.name,
            subjectId: parseInt(selectedSubject),
            subjectName: sub?.name,
        }]);
        setSelectedClass("");
        setSelectedSection("");
        setSelectedSubject("");
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError("");

        try {
            const payload: any = { ...formData };

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
                delete payload.address;
            }

            if (payload.designationId) {
                payload.designationId = parseInt(String(payload.designationId));
            } else {
                delete payload.designationId;
            }

            // Strip empty optional strings
            for (const key of ["alternateMobile", "fathersName", "mothersName", "aadhaarNumber", "bloodGroup"] as const) {
                if (payload[key] === "") delete payload[key];
            }

            // role is only sent when allowRoleSelect is explicitly shown
            if (!allowRoleSelect) delete payload.role;

            const res = await authFetch(`${API_BASE_URL}/staff`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.message || "Failed to create staff member");
            }

            const newStaff = await res.json();

            // Create any pending subject assignments for Teaching Staff
            if (formData.staffCategory === "Teaching Staff") {
                for (const assignment of pendingAssignments) {
                    await authFetch(`${API_BASE_URL}/staff/${newStaff.id}/assign-subject`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            classId: assignment.classId,
                            sectionId: assignment.sectionId,
                            subjectId: assignment.subjectId,
                        }),
                    });
                }
            }

            toast.success("Staff member created successfully.");
            setFormData(EMPTY_FORM);
            setPendingAssignments([]);
            onSuccess?.(newStaff);
        } catch (err: any) {
            setError(err.message || "Failed to create staff member. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const editableRoles = isSuperAdmin ? ["ADMIN", "SUB_ADMIN", "TEACHER"] : ["SUB_ADMIN", "TEACHER"];

    return (
        <>
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
                            <label className="block mb-1 text-sm font-medium text-gray-900">Gender <span className="text-red-500">*</span></label>
                            <select name="gender" value={formData.gender} onChange={handleChange} required
                                className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5">
                                <option value="">Select Gender</option>
                                <option value="Male">Male</option>
                                <option value="Female">Female</option>
                                <option value="Others">Others</option>
                            </select>
                        </div>
                        <div>
                            <label className="block mb-1 text-sm font-medium text-gray-900">Date of Birth <span className="text-red-500">*</span></label>
                            <input type="date" name="dateOfBirth" value={formData.dateOfBirth} onChange={handleChange} required
                                className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5" />
                        </div>
                        <div>
                            <label className="block mb-1 text-sm font-medium text-gray-900">Blood Group</label>
                            <select name="bloodGroup" value={formData.bloodGroup} onChange={handleChange}
                                className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5">
                                <option value="">Select Group</option>
                                {["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"].map(bg => (
                                    <option key={bg} value={bg}>{bg}</option>
                                ))}
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
                            <input type="email" name="email" value={formData.email} onChange={handleChange} required
                                className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5" />
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
                            <label className="block mb-1 text-sm font-medium text-gray-900">Category <span className="text-red-500">*</span></label>
                            <select name="category" value={formData.category} onChange={handleChange} required
                                className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5">
                                <option value="">Select Category</option>
                                {["General", "SC", "ST", "OBC", "EWS"].map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block mb-1 text-sm font-medium text-gray-900">Religion <span className="text-red-500">*</span></label>
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
                                <option value="CREATE_NEW" className="font-bold text-blue-600">+ Create New Designation</option>
                            </select>
                        </div>
                        {allowRoleSelect && (
                            <div>
                                <label className="block mb-1 text-sm font-medium text-gray-900">System Role <span className="text-red-500">*</span></label>
                                <select name="role" value={formData.role} onChange={handleChange} required
                                    className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5">
                                    {editableRoles.map(r => (
                                        <option key={r} value={r}>{ROLE_LABELS[r] || r}</option>
                                    ))}
                                </select>
                            </div>
                        )}
                    </div>
                </div>

                {/* ── ACCOUNT STATUS ── */}
                <div className="flex items-center">
                    <input id="isActive" name="isActive" type="checkbox" checked={formData.isActive} onChange={handleChange}
                        className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500" />
                    <label htmlFor="isActive" className="ml-2 text-sm font-medium text-gray-900">Account Active</label>
                </div>

                {/* ── SUBJECT ASSIGNMENTS (Teaching Staff only) ── */}
                {formData.staffCategory === "Teaching Staff" && (
                    <div className="border-t pt-6">
                        <h3 className="text-sm font-semibold text-slate-600 uppercase tracking-wide border-b border-slate-200 pb-2 mb-4">
                            Subject Assignments <span className="text-gray-400 font-normal normal-case">(Optional)</span>
                        </h3>
                        {pendingAssignments.length > 0 && (
                            <ul className="space-y-2 mb-4">
                                {pendingAssignments.map((pa, idx) => (
                                    <li key={idx} className="flex justify-between items-center bg-gray-50 p-3 rounded-lg border border-gray-200">
                                        <span className="text-sm font-medium text-gray-700">
                                            {pa.subjectName} &mdash; Class {pa.className} ({pa.sectionName})
                                        </span>
                                        <button type="button"
                                            onClick={() => setPendingAssignments(a => a.filter((_, i) => i !== idx))}
                                            className="text-red-600 hover:text-red-800 text-sm font-semibold">
                                            Remove
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end bg-blue-50 p-4 rounded-lg border border-blue-100">
                            <div>
                                <label className="block mb-1 text-sm font-medium text-gray-900">Class</label>
                                <select value={selectedClass} onChange={e => { setSelectedClass(e.target.value); setSelectedSection(""); }}
                                    className="bg-white border border-gray-300 text-gray-900 text-sm rounded-lg block w-full p-2.5">
                                    <option value="">Select Class</option>
                                    {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block mb-1 text-sm font-medium text-gray-900">Section</label>
                                <select value={selectedSection} onChange={e => setSelectedSection(e.target.value)} disabled={!selectedClass}
                                    className="bg-white border border-gray-300 text-gray-900 text-sm rounded-lg block w-full p-2.5 disabled:opacity-50">
                                    <option value="">Select Section</option>
                                    {sectionsForClass.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block mb-1 text-sm font-medium text-gray-900">Subject</label>
                                <select value={selectedSubject} onChange={e => setSelectedSubject(e.target.value)}
                                    className="bg-white border border-gray-300 text-gray-900 text-sm rounded-lg block w-full p-2.5">
                                    <option value="">Select Subject</option>
                                    {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                </select>
                            </div>
                            <button type="button" onClick={handleAddPendingAssignment}
                                disabled={!selectedClass || !selectedSection || !selectedSubject}
                                className="text-blue-700 bg-white border border-blue-700 hover:bg-blue-700 hover:text-white font-medium rounded-lg text-sm px-5 py-2.5 text-center disabled:opacity-50 transition-colors">
                                Queue
                            </button>
                        </div>
                    </div>
                )}

                {/* Info note */}
                <div className="flex items-start gap-3 p-3 bg-blue-50 border border-blue-100 rounded-xl text-sm text-blue-700">
                    <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Staff will be assigned the default password and must change it on first login.
                </div>

                {/* ── ACTIONS ── */}
                <div className="flex items-center gap-3 border-t pt-6">
                    <button type="submit" disabled={loading}
                        className="text-white bg-blue-700 hover:bg-blue-800 focus:ring-4 focus:outline-none focus:ring-blue-300 font-medium rounded-lg text-sm px-6 py-2.5 disabled:opacity-50">
                        {loading ? "Creating..." : "Create Staff Member"}
                    </button>
                    {onCancel && (
                        <button type="button" onClick={onCancel}
                            className="text-gray-900 bg-white border border-gray-300 hover:bg-gray-100 focus:ring-4 focus:ring-gray-200 font-medium rounded-lg text-sm px-6 py-2.5">
                            Cancel
                        </button>
                    )}
                </div>
            </form>

            {/* ── DESIGNATION CREATION MODAL ── */}
            {showDesModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                    <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-sm">
                        <h3 className="text-lg font-bold mb-4">Create New Designation</h3>
                        <form onSubmit={handleCreateDesignation}>
                            <input type="text" value={newDesTitle} onChange={e => setNewDesTitle(e.target.value)}
                                placeholder="Designation Title (e.g. Principal)"
                                className="w-full border p-2 rounded mb-4 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                autoFocus required />
                            <div className="flex justify-end gap-2">
                                <button type="button"
                                    onClick={() => { setShowDesModal(false); setNewDesTitle(""); setFormData(prev => ({ ...prev, designationId: "" })); }}
                                    className="px-4 py-2 text-sm bg-gray-200 rounded hover:bg-gray-300">Cancel</button>
                                <button type="submit" disabled={creatingDes}
                                    className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50">
                                    {creatingDes ? "Creating..." : "Create"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
}
