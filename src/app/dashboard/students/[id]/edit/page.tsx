"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import { API_BASE_URL } from "@/lib/api";
import { authFetch } from "@/lib/auth";

export default function EditStudentPage() {
    const router = useRouter();
    const params = useParams();
    const id = params?.id as string;
    const [formData, setFormData] = useState({
        firstName: "",
        lastName: "",
        email: "",
        fathersName: "",
        fatherAadhaarNumber: "",
        mothersName: "",
        motherAadhaarNumber: "",
        aadhaarNumber: "",
        mobile: "",
        alternateMobile: "",
        category: "",
        bloodGroup: "",
        religion: "",
        gender: "",
        dateOfBirth: "",
        siblingId: "",
        isActive: true,
    });
    const [availableDiscounts, setAvailableDiscounts] = useState<any[]>([]);
    const [selectedDiscounts, setSelectedDiscounts] = useState<number[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    // Sibling Modal State
    const [showSiblingModal, setShowSiblingModal] = useState(false);
    const [siblingModalError, setSiblingModalError] = useState("");
    const [siblingSearch, setSiblingSearch] = useState("");
    const [siblingSearchMode, setSiblingSearchMode] = useState<'name' | 'id'>('name');
    const [siblingResults, setSiblingResults] = useState<any[]>([]);
    const [siblingLoading, setSiblingLoading] = useState(false);
    const [selectedSiblingObj, setSelectedSiblingObj] = useState<any>(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [discRes] = await Promise.all([
                    authFetch(`${API_BASE_URL}/fees/discounts`)
                ]);

                if (discRes.ok) setAvailableDiscounts(await discRes.json());

                if (!id) return;
                const studRes = await authFetch(`${API_BASE_URL}/students/${id}`);
                if (!studRes.ok) throw new Error("Failed to fetch student");
                const student = await studRes.json();

                if (student) {
                    setFormData({
                        firstName: student.firstName || "",
                        lastName: student.lastName || "",
                        email: student.email || "",
                        fathersName: student.fathersName || "",
                        fatherAadhaarNumber: student.fatherAadhaarNumber || "",
                        mothersName: student.mothersName || "",
                        motherAadhaarNumber: student.motherAadhaarNumber || "",
                        aadhaarNumber: student.aadhaarNumber || "",
                        mobile: student.mobile || "",
                        alternateMobile: student.alternateMobile || "",
                        category: student.category || "",
                        bloodGroup: student.bloodGroup || "",
                        religion: student.religion || "",
                        gender: student.gender || "",
                        dateOfBirth: student.dateOfBirth ? new Date(student.dateOfBirth).toISOString().split('T')[0] : "",
                        siblingId: student.siblingId ? student.siblingId.toString() : "",
                        isActive: student.isActive,
                    });
                    if (student.studentDiscounts) {
                        const activeDiscounts = student.studentDiscounts.filter((sd: any) => sd.isActive);
                        setSelectedDiscounts(activeDiscounts.map((sd: any) => sd.discountCategory?.id || sd.discountCategoryId));
                    }
                    // If a sibling is already set, load the sibling's actual info for display
                    if (student.siblingId) {
                        try {
                            const sibRes = await authFetch(`${API_BASE_URL}/students/${student.siblingId}`);
                            if (sibRes.ok) {
                                const sibData = await sibRes.json();
                                setSelectedSiblingObj(sibData);
                            } else {
                                setSelectedSiblingObj({ id: student.siblingId, firstName: '(sibling ID:', lastName: `${student.siblingId})` });
                            }
                        } catch {
                            setSelectedSiblingObj({ id: student.siblingId, firstName: '(sibling ID:', lastName: `${student.siblingId})` });
                        }
                    }
                } else {
                    setError("Student not found");
                }
            } catch (err) {
                setError("Failed to load data");
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [id]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const target = e.target as HTMLInputElement;
        const value = target.type === 'checkbox' ? target.checked : target.value;
        const name = target.name;
        setFormData({ ...formData, [name]: value });

        // Auto-suggest Girl discount
        if (name === 'gender' && value === 'Female') {
            const girlDiscount = availableDiscounts.find(d => d.applicationType === 'AUTO' && d.logicReference === 'GIRL');
            if (girlDiscount && !selectedDiscounts.includes(girlDiscount.id)) {
                setSelectedDiscounts(prev => [...prev, girlDiscount.id]);
                toast.success(`Auto-applied: ${girlDiscount.name}`);
            }
        }
    };

    const openSiblingModal = () => {
        if (!formData.fathersName.trim() || !formData.mothersName.trim()) {
            setSiblingModalError("Please fill in Father's Name and Mother's Name before searching for a sibling.");
            return;
        }
        setSiblingModalError("");
        setSiblingSearch("");
        setSiblingResults([]);
        setSiblingSearchMode('name');
        setShowSiblingModal(true);
    };

    const handleSearchSibling = async () => {
        if (!siblingSearch.trim()) return;
        setSiblingLoading(true);
        try {
            let url: string;
            if (siblingSearchMode === 'id') {
                const numericId = parseInt(siblingSearch.trim());
                if (isNaN(numericId)) {
                    setSiblingResults([]);
                    setSiblingLoading(false);
                    return;
                }
                url = `${API_BASE_URL}/students?id=${numericId}`;
            } else {
                url = `${API_BASE_URL}/students?search=${encodeURIComponent(siblingSearch.trim())}`;
            }
            const res = await authFetch(url);
            if (res.ok) {
                const data = await res.json();
                // Exclude the student being edited from results
                setSiblingResults(data.filter((s: any) => s.id.toString() !== id));
            }
        } catch (err) {
            console.error("Failed to fetch sibling", err);
        } finally {
            setSiblingLoading(false);
        }
    };

    const isSiblingMatch = (sibling: any) => {
        const sibFather = (sibling.fathersName || "").trim().toLowerCase();
        const sibMother = (sibling.mothersName || "").trim().toLowerCase();
        const myFather = formData.fathersName.trim().toLowerCase();
        const myMother = formData.mothersName.trim().toLowerCase();
        return sibFather === myFather && sibMother === myMother;
    };

    const selectSibling = (sibling: any) => {
        setSelectedSiblingObj(sibling);
        setFormData({
            ...formData,
            siblingId: sibling.id.toString(),
            fathersName: sibling.fathersName || formData.fathersName,
            mothersName: sibling.mothersName || formData.mothersName
        });
        setShowSiblingModal(false);
        setSiblingSearch("");
        setSiblingResults([]);

        // Auto-suggest Sibling discount
        const siblingDiscount = availableDiscounts.find(d => d.applicationType === 'AUTO' && d.logicReference === 'SIBLING');
        if (siblingDiscount && !selectedDiscounts.includes(siblingDiscount.id)) {
            setSelectedDiscounts(prev => [...prev, siblingDiscount.id]);
            toast.success(`Auto-applied: ${siblingDiscount.name}`);
        }
    };

    const clearSibling = () => {
        setSelectedSiblingObj(null);
        // Only clear the sibling link — keep parent names intact
        setFormData({ ...formData, siblingId: "" });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setError("");

        try {
            const payload = {
                ...formData,
                siblingId: formData.siblingId ? parseInt(formData.siblingId) : null,
                discountIds: selectedDiscounts
            };

            // Remove optional empty string fields to prevent validation errors
            const optionalFields = ['email', 'aadhaarNumber', 'mobile', 'alternateMobile', 'category', 'bloodGroup', 'religion', 'dateOfBirth'];
            optionalFields.forEach(field => {
                const key = field as keyof typeof payload;
                if (!(payload as any)[key]) {
                    delete (payload as any)[key];
                }
            });

            const res = await authFetch(`${API_BASE_URL}/students/${id}`, {
                method: "PATCH",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(payload),
            });

            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.message || "Failed to update student");
            }

            router.push("/dashboard/students");
            router.refresh();
        } catch (err: any) {
            console.error(err);
            setError(err.message || "Failed to update student. Please try again.");
        } finally {
            setSaving(false);
        }
    };

    if (loading) return <div className="p-4">Loading...</div>;
    if (error && !formData.firstName) return <div className="p-4 text-red-600">{error}</div>;

    return (
        <main className="p-4 bg-slate-50 min-h-screen">
            <div className="max-w-4xl mx-auto bg-white p-8 rounded-lg shadow-sm border border-slate-200 relative">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold text-slate-800">Edit Student</h2>
                    <Link href="/dashboard/students" className="text-blue-600 hover:underline">
                        &larr; Back to Students
                    </Link>
                </div>

                {error && (
                    <div className="p-4 mb-4 text-sm text-red-800 rounded-lg bg-red-50" role="alert">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-8">
                    {/* TODO: For future, we'll make fields compulsory. For now only first name, last name, gender, father's name, mother's name make compulsory. All other are optional. */}
                    {/* Basic Info */}
                    <div>
                        <h3 className="text-lg font-bold mb-4 text-slate-700 border-b pb-2">Basic Information</h3>
                        <div className="grid gap-6 md:grid-cols-3">
                            <div>
                                <label htmlFor="firstName" className="block mb-2 text-sm font-medium text-gray-900">First name <span className="text-red-500">*</span></label>
                                <input type="text" id="firstName" name="firstName" value={formData.firstName} onChange={handleChange} className="bg-gray-50 border border-gray-300 text-sm rounded-lg block w-full p-2.5" required />
                            </div>
                            <div>
                                <label htmlFor="lastName" className="block mb-2 text-sm font-medium text-gray-900">Last name <span className="text-red-500">*</span></label>
                                <input type="text" id="lastName" name="lastName" value={formData.lastName} onChange={handleChange} className="bg-gray-50 border border-gray-300 text-sm rounded-lg block w-full p-2.5" required />
                            </div>
                            <div>
                                <label htmlFor="gender" className="block mb-2 text-sm font-medium text-gray-900">Gender <span className="text-red-500">*</span></label>
                                <select id="gender" name="gender" value={formData.gender} onChange={handleChange} className="bg-gray-50 border border-gray-300 text-sm rounded-lg block w-full p-2.5" required>
                                    <option value="">Select Gender</option>
                                    <option value="Male">Male</option>
                                    <option value="Female">Female</option>
                                    <option value="Others">Others</option>
                                </select>
                            </div>
                            <div>
                                <label htmlFor="dateOfBirth" className="block mb-2 text-sm font-medium text-gray-900">Date of Birth</label>
                                <input type="date" id="dateOfBirth" name="dateOfBirth" value={formData.dateOfBirth} onChange={handleChange} className="bg-gray-50 border border-gray-300 text-sm rounded-lg block w-full p-2.5" />
                            </div>
                            <div>
                                <label htmlFor="bloodGroup" className="block mb-2 text-sm font-medium text-gray-900">Blood Group</label>
                                <select id="bloodGroup" name="bloodGroup" value={formData.bloodGroup} onChange={handleChange} className="bg-gray-50 border border-gray-300 text-sm rounded-lg block w-full p-2.5">
                                    <option value="">Select Group</option>
                                    <option value="A+">A+</option><option value="A-">A-</option>
                                    <option value="B+">B+</option><option value="B-">B-</option>
                                    <option value="O+">O+</option><option value="O-">O-</option>
                                    <option value="AB+">AB+</option><option value="AB-">AB-</option>
                                </select>
                            </div>
                            <div>
                                <label htmlFor="aadhaarNumber" className="block mb-2 text-sm font-medium text-gray-900">Aadhaar Number <span className="text-gray-400 font-normal">(Optional)</span></label>
                                <input type="text" id="aadhaarNumber" name="aadhaarNumber" value={formData.aadhaarNumber} onChange={handleChange} className="bg-gray-50 border border-gray-300 text-sm rounded-lg block w-full p-2.5" />
                            </div>
                        </div>
                    </div>

                    {/* Contact Info */}
                    <div>
                        <h3 className="text-lg font-bold mb-4 text-slate-700 border-b pb-2">Contact Information</h3>
                        <div className="grid gap-6 md:grid-cols-3">
                            <div>
                                <label htmlFor="email" className="block mb-2 text-sm font-medium text-gray-900">Email address <span className="text-gray-400 font-normal">(Optional)</span></label>
                                <input type="email" id="email" name="email" value={formData.email} onChange={handleChange} className="bg-gray-50 border border-gray-300 text-sm rounded-lg block w-full p-2.5" />
                            </div>
                            <div>
                                <label htmlFor="mobile" className="block mb-2 text-sm font-medium text-gray-900">Mobile Number</label>
                                <input type="tel" id="mobile" name="mobile" value={formData.mobile} onChange={handleChange} className="bg-gray-50 border border-gray-300 text-sm rounded-lg block w-full p-2.5" />
                            </div>
                            <div>
                                <label htmlFor="alternateMobile" className="block mb-2 text-sm font-medium text-gray-900">Alternate Mobile</label>
                                <input type="tel" id="alternateMobile" name="alternateMobile" value={formData.alternateMobile} onChange={handleChange} className="bg-gray-50 border border-gray-300 text-sm rounded-lg block w-full p-2.5" />
                            </div>
                        </div>
                    </div>

                    {/* Parent & Family Info */}
                    <div>
                        <h3 className="text-lg font-bold mb-4 text-slate-700 border-b pb-2">Parent &amp; Family Details</h3>

                        {/* Linked sibling badge */}
                        {selectedSiblingObj && (
                            <div className="flex items-center space-x-2 mb-4">
                                <span className="text-xs font-semibold bg-green-100 text-green-800 px-2 py-1 rounded border border-green-200">
                                    Linked Sibling: {selectedSiblingObj.firstName} {selectedSiblingObj.lastName} (ID: {selectedSiblingObj.id})
                                </span>
                                <button type="button" onClick={clearSibling} className="text-red-600 hover:text-red-800 text-xs font-medium underline">Remove Link</button>
                            </div>
                        )}

                        <div className="grid gap-6 md:grid-cols-2">
                            <div>
                                <label htmlFor="fathersName" className="block mb-2 text-sm font-medium text-gray-900">Father's Name <span className="text-red-500">*</span></label>
                                <input type="text" id="fathersName" name="fathersName" value={formData.fathersName} onChange={handleChange} disabled={!!selectedSiblingObj} className="bg-gray-50 border border-gray-300 text-sm rounded-lg block w-full p-2.5 disabled:bg-gray-200 disabled:text-gray-500 disabled:cursor-not-allowed" required />
                            </div>
                            <div>
                                <label htmlFor="fatherAadhaarNumber" className="block mb-2 text-sm font-medium text-gray-900">Father's UUID (Aadhaar Number) <span className="text-gray-400 font-normal">(Optional)</span></label>
                                <input type="text" id="fatherAadhaarNumber" name="fatherAadhaarNumber" value={formData.fatherAadhaarNumber} onChange={handleChange} disabled={!!selectedSiblingObj} className="bg-gray-50 border border-gray-300 text-sm rounded-lg block w-full p-2.5 disabled:bg-gray-200 disabled:text-gray-500 disabled:cursor-not-allowed" />
                            </div>
                            <div>
                                <label htmlFor="mothersName" className="block mb-2 text-sm font-medium text-gray-900">Mother's Name <span className="text-red-500">*</span></label>
                                <input type="text" id="mothersName" name="mothersName" value={formData.mothersName} onChange={handleChange} disabled={!!selectedSiblingObj} className="bg-gray-50 border border-gray-300 text-sm rounded-lg block w-full p-2.5 disabled:bg-gray-200 disabled:text-gray-500 disabled:cursor-not-allowed" required />
                            </div>
                            <div>
                                <label htmlFor="motherAadhaarNumber" className="block mb-2 text-sm font-medium text-gray-900">Mother's UUID (Aadhaar Number) <span className="text-gray-400 font-normal">(Optional)</span></label>
                                <input type="text" id="motherAadhaarNumber" name="motherAadhaarNumber" value={formData.motherAadhaarNumber} onChange={handleChange} disabled={!!selectedSiblingObj} className="bg-gray-50 border border-gray-300 text-sm rounded-lg block w-full p-2.5 disabled:bg-gray-200 disabled:text-gray-500 disabled:cursor-not-allowed" />
                            </div>
                        </div>

                        {selectedSiblingObj && (
                            <p className="mt-2 text-xs text-blue-600 italic">Parent names are locked and synced with the linked sibling.</p>
                        )}

                        {/* Add Sibling button — placed AFTER parent name fields */}
                        {!selectedSiblingObj && (
                            <div className="mt-4">
                                {siblingModalError && (
                                    <p className="text-xs text-red-600 mb-2">{siblingModalError}</p>
                                )}
                                <button
                                    type="button"
                                    onClick={openSiblingModal}
                                    className="text-white bg-green-600 hover:bg-green-700 focus:ring-4 focus:ring-green-300 font-medium rounded-lg text-xs px-3 py-1.5 focus:outline-none"
                                >
                                    + Add Sibling
                                </button>
                                <p className="text-xs text-gray-400 mt-1">Fill in Father&apos;s and Mother&apos;s Name first, then search for a sibling with matching parents.</p>
                            </div>
                        )}
                    </div>

                    {/* Additional Demographics */}
                    <div>
                        <h3 className="text-lg font-bold mb-4 text-slate-700 border-b pb-2">Demographics</h3>
                        <div className="grid gap-6 md:grid-cols-2">
                            <div>
                                <label htmlFor="category" className="block mb-2 text-sm font-medium text-gray-900">Category</label>
                                <select id="category" name="category" value={formData.category} onChange={handleChange} className="bg-gray-50 border border-gray-300 text-sm rounded-lg block w-full p-2.5">
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
                                <select id="religion" name="religion" value={formData.religion} onChange={handleChange} className="bg-gray-50 border border-gray-300 text-sm rounded-lg block w-full p-2.5">
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

                    {/* Administrative Info */}
                    <div>
                        <h3 className="text-lg font-bold mb-4 text-slate-700 border-b pb-2">Administrative Info</h3>
                        <div className="flex items-center mb-6">
                            <input
                                id="isActive"
                                name="isActive"
                                type="checkbox"
                                checked={formData.isActive}
                                onChange={handleChange}
                                className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                            />
                            <label htmlFor="isActive" className="ml-2 text-sm font-medium text-gray-900">Account Active</label>
                        </div>

                        {availableDiscounts.length > 0 && (
                            <div className="mb-6">
                                <label className="block mb-3 text-sm font-medium text-gray-900">Fee Discounts applied to this student</label>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                    {availableDiscounts.map(d => (
                                        <label key={d.id} className="flex flex-col p-3 border border-gray-200 bg-white rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                                            <div className="flex items-center">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedDiscounts.includes(d.id)}
                                                    onChange={(e) => {
                                                        if (e.target.checked) setSelectedDiscounts([...selectedDiscounts, d.id]);
                                                        else setSelectedDiscounts(selectedDiscounts.filter(did => did !== d.id));
                                                    }}
                                                    className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                                                />
                                                <span className="ml-2 text-sm font-medium text-gray-900">{d.name}</span>
                                            </div>
                                            <span className="mt-1 ml-6 text-xs text-gray-500">
                                                {d.type === 'PERCENTAGE' ? `${d.value}%` : `$${d.value}`}
                                                {d.applicationType === 'AUTO' && <span className="ml-1 text-[10px] bg-blue-100 text-blue-800 px-1 rounded font-bold">{d.logicReference}</span>}
                                            </span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="flex items-center space-x-4 pt-4 border-t">
                        <button
                            type="submit"
                            disabled={saving}
                            className="text-white bg-blue-700 hover:bg-blue-800 focus:ring-4 focus:outline-none focus:ring-blue-300 font-bold rounded-lg text-lg w-full sm:w-auto px-8 py-3 text-center disabled:opacity-50"
                        >
                            {saving ? 'Saving...' : 'Save Changes'}
                        </button>
                        <Link href="/dashboard/students" className="text-gray-900 bg-white border border-gray-300 focus:outline-none hover:bg-gray-100 focus:ring-4 focus:ring-gray-200 font-medium rounded-lg text-sm px-5 py-3">
                            Cancel
                        </Link>
                    </div>
                </form>

                {/* Sibling Search Modal */}
                {showSiblingModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50">
                        <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
                            <div className="flex items-center justify-between p-4 border-b">
                                <div>
                                    <h3 className="text-xl font-semibold text-gray-900">Search Existing Sibling</h3>
                                    <p className="text-xs text-gray-500 mt-0.5">
                                        Searching for siblings of: <span className="font-medium text-gray-700">{formData.fathersName}</span> &amp; <span className="font-medium text-gray-700">{formData.mothersName}</span>
                                    </p>
                                </div>
                                <button type="button" onClick={() => setShowSiblingModal(false)} className="text-gray-400 bg-transparent hover:bg-gray-200 hover:text-gray-900 rounded-lg text-sm w-8 h-8 ml-auto inline-flex justify-center items-center">
                                    <svg className="w-3 h-3" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 14 14"><path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m1 1 6 6m0 0 6 6M7 7l6-6M7 7l-6 6" /></svg>
                                    <span className="sr-only">Close modal</span>
                                </button>
                            </div>
                            <div className="p-6 flex-1 overflow-y-auto">
                                {/* Search mode toggle */}
                                <div className="flex mb-3 rounded-lg overflow-hidden border border-gray-300 w-fit">
                                    <button
                                        type="button"
                                        onClick={() => { setSiblingSearchMode('name'); setSiblingSearch(''); setSiblingResults([]); }}
                                        className={`px-4 py-1.5 text-sm font-medium transition-colors ${siblingSearchMode === 'name'
                                            ? 'bg-blue-700 text-white'
                                            : 'bg-white text-gray-600 hover:bg-gray-100'
                                            }`}
                                    >
                                        Search by Name
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => { setSiblingSearchMode('id'); setSiblingSearch(''); setSiblingResults([]); }}
                                        className={`px-4 py-1.5 text-sm font-medium transition-colors ${siblingSearchMode === 'id'
                                            ? 'bg-blue-700 text-white'
                                            : 'bg-white text-gray-600 hover:bg-gray-100'
                                            }`}
                                    >
                                        Search by ID
                                    </button>
                                </div>
                                <form className="flex items-center space-x-2 mb-4" onSubmit={(e) => { e.preventDefault(); handleSearchSibling(); }}>
                                    <input
                                        type={siblingSearchMode === 'id' ? 'number' : 'text'}
                                        value={siblingSearch}
                                        onChange={e => setSiblingSearch(e.target.value)}
                                        placeholder={siblingSearchMode === 'id' ? 'Enter student ID (e.g. 42)' : 'Search by first or last name (e.g. Raj)'}
                                        className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5"
                                    />
                                    <button type="submit" className="text-white bg-blue-700 hover:bg-blue-800 font-medium rounded-lg text-sm px-5 py-2.5" disabled={siblingLoading}>{siblingLoading ? '...' : 'Search'}</button>
                                </form>

                                <div className="mt-4">
                                    {siblingResults.length > 0 ? (
                                        <>
                                            <p className="text-xs text-gray-500 mb-2">
                                                <span className="inline-flex items-center mr-3"><span className="w-2 h-2 rounded-full bg-green-500 inline-block mr-1"></span>Names match — can be linked</span>
                                                <span className="inline-flex items-center"><span className="w-2 h-2 rounded-full bg-red-400 inline-block mr-1"></span>Names don&apos;t match — cannot link</span>
                                            </p>
                                            <ul className="divide-y divide-gray-200 border rounded-lg max-h-64 overflow-y-auto">
                                                {siblingResults.map(s => {
                                                    const match = isSiblingMatch(s);
                                                    return (
                                                        <li key={s.id} className={`p-3 flex justify-between items-center transition-colors ${match ? 'hover:bg-green-50' : 'bg-red-50 opacity-70'}`}>
                                                            <div>
                                                                <div className="flex items-center gap-2">
                                                                    <span className={`w-2 h-2 rounded-full shrink-0 ${match ? 'bg-green-500' : 'bg-red-400'}`}></span>
                                                                    <p className="text-sm font-medium text-gray-900">{s.firstName} {s.lastName}</p>
                                                                </div>
                                                                <p className="text-xs text-gray-500 ml-4">ID: {s.id} | Father: {s.fathersName || 'N/A'} | Mother: {s.mothersName || 'N/A'}</p>
                                                                {!match && (
                                                                    <p className="text-xs text-red-600 ml-4 mt-0.5">⚠ Parent names do not match — cannot select as sibling</p>
                                                                )}
                                                            </div>
                                                            <button
                                                                type="button"
                                                                onClick={() => match && selectSibling(s)}
                                                                disabled={!match}
                                                                className={`font-medium rounded-lg text-xs px-3 py-1.5 focus:outline-none shrink-0 ml-2 ${match ? 'text-white bg-green-600 hover:bg-green-700' : 'text-gray-400 bg-gray-200 cursor-not-allowed'}`}
                                                            >
                                                                Select
                                                            </button>
                                                        </li>
                                                    );
                                                })}
                                            </ul>
                                        </>
                                    ) : (
                                        <p className="text-sm text-gray-500 italic text-center py-4">Search to find siblings.</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </main>
    );
}
