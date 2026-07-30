"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { API_BASE_URL } from "@/lib/api";
import { authFetch } from "@/lib/auth";
import { useRbac } from "@/lib/rbac";
import toast from "react-hot-toast";

export default function ViewStaffPage() {
    const params = useParams();
    const id = params?.id as string;
    const rbac = useRbac();
    const [staff, setStaff] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    // Exit Modal States
    const [showExitModal, setShowExitModal] = useState(false);
    const [exitDate, setExitDate] = useState(new Date().toISOString().split('T')[0]);
    const [isExiting, setIsExiting] = useState(false);

    const fetchStaffDetails = async () => {
        try {
            const res = await authFetch(`${API_BASE_URL}/staff/${id}`);
            if (!res.ok) throw new Error("Failed to fetch staff details");
            const data = await res.json();
            setStaff(data);
        } catch (err: any) {
            setError(err.message || "Failed to load staff details");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (id) {
            fetchStaffDetails();
        }
    }, [id]);

    const handleConfirmExit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsExiting(true);
        try {
            const res = await authFetch(`${API_BASE_URL}/staff/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    exitDate: exitDate,
                    isActive: false
                })
            });
            if (res.ok) {
                toast.success("Staff exit marked successfully");
                setShowExitModal(false);
                fetchStaffDetails(); // Refresh details on page
            } else {
                const err = await res.json();
                toast.error(err.message || "Failed to mark exit");
            }
        } catch (error) {
            toast.error("An error occurred while marking exit");
        } finally {
            setIsExiting(false);
        }
    };

    if (loading) {
        return (
            <div className="flex min-h-[60vh] items-center justify-center">
                <div className="text-slate-500 font-medium">Loading staff details...</div>
            </div>
        );
    }

    if (error || !staff) {
        return (
            <div className="p-4 sm:p-5">
                <div className="max-w-4xl mx-auto bg-white p-6 rounded-lg border border-red-200 text-red-600">
                    {error || "Staff not found"}
                    <div className="mt-4">
                        <Link href="/dashboard/staff" className="text-blue-600 hover:underline">
                            &larr; Back to Staff
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    const activeAssignments = staff.subjectAssignments?.filter((a: any) => a.isActive) || [];

    return (
        <main className="p-4 sm:p-5 space-y-6">
            <div className="max-w-4xl mx-auto bg-white p-8 rounded-lg shadow-sm border border-slate-200">
                {/* Header */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b pb-6 mb-6 gap-4">
                    <div>
                        <div className="flex items-center gap-3">
                            <h2 className="text-2xl font-bold text-slate-800">
                                {staff.firstName} {staff.lastName}
                            </h2>
                            <span className={`px-2.5 py-0.5 text-xs font-semibold rounded-full ${
                                staff.isActive ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                            }`}>
                                {staff.isActive ? "Active" : "Inactive"}
                            </span>
                        </div>
                        <p className="text-sm text-slate-500 mt-1">Staff ID: {staff.id} | Role: {staff.role || "-"}</p>
                    </div>
                    <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                        <Link href="/dashboard/staff" className="text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 font-medium rounded-lg text-sm px-4 py-2">
                            Back
                        </Link>
                        {rbac.canManageTeachers && staff.isActive && (
                            <button
                                type="button"
                                onClick={() => {
                                    setExitDate(new Date().toISOString().split('T')[0]);
                                    setShowExitModal(true);
                                }}
                                className="text-white bg-red-600 hover:bg-red-700 font-medium rounded-lg text-sm px-4 py-2"
                            >
                                Mark Exit
                            </button>
                        )}
                        {rbac.canManageTeachers && (
                            <Link href={`/dashboard/staff/${staff.id}/edit`} className="text-white bg-blue-600 hover:bg-blue-700 font-medium rounded-lg text-sm px-4 py-2">
                                Edit Staff
                            </Link>
                        )}
                    </div>
                </div>

                <div className="space-y-8">
                    {/* Basic Info */}
                    <div>
                        <h3 className="text-md font-bold mb-4 text-slate-700 uppercase tracking-wider border-b pb-1">Basic Information</h3>
                        <div className="grid gap-6 grid-cols-2 md:grid-cols-3">
                            <div>
                                <span className="block text-xs font-semibold text-slate-500 uppercase">First Name</span>
                                <span className="text-sm font-medium text-slate-800">{staff.firstName || "-"}</span>
                            </div>
                            <div>
                                <span className="block text-xs font-semibold text-slate-500 uppercase">Last Name</span>
                                <span className="text-sm font-medium text-slate-800">{staff.lastName || "-"}</span>
                            </div>
                            <div>
                                <span className="block text-xs font-semibold text-slate-500 uppercase">Gender</span>
                                <span className="text-sm font-medium text-slate-800">{staff.gender || "-"}</span>
                            </div>
                            <div>
                                <span className="block text-xs font-semibold text-slate-500 uppercase">Date of Birth</span>
                                <span className="text-sm font-medium text-slate-800">
                                    {staff.dateOfBirth ? new Date(staff.dateOfBirth).toLocaleDateString() : "-"}
                                </span>
                            </div>
                            <div>
                                <span className="block text-xs font-semibold text-slate-500 uppercase">Blood Group</span>
                                <span className="text-sm font-medium text-slate-800">{staff.bloodGroup || "-"}</span>
                            </div>
                            <div>
                                <span className="block text-xs font-semibold text-slate-500 uppercase">Aadhaar Number</span>
                                <span className="text-sm font-medium text-slate-800">{staff.aadhaarNumber || "-"}</span>
                            </div>
                        </div>
                    </div>

                    {/* Contact Info */}
                    <div>
                        <h3 className="text-md font-bold mb-4 text-slate-700 uppercase tracking-wider border-b pb-1">Contact Information</h3>
                        <div className="grid gap-6 grid-cols-2 md:grid-cols-3">
                            <div>
                                <span className="block text-xs font-semibold text-slate-500 uppercase">Email</span>
                                <span className="text-sm font-medium text-slate-800">{staff.email || "-"}</span>
                            </div>
                            <div>
                                <span className="block text-xs font-semibold text-slate-500 uppercase">Mobile Number</span>
                                <span className="text-sm font-medium text-slate-800">{staff.mobile || "-"}</span>
                            </div>
                            <div>
                                <span className="block text-xs font-semibold text-slate-500 uppercase">Alternate Mobile</span>
                                <span className="text-sm font-medium text-slate-800">{staff.alternateMobile || "-"}</span>
                            </div>
                        </div>
                    </div>

                    {/* Address */}
                    <div>
                        <h3 className="text-md font-bold mb-4 text-slate-700 uppercase tracking-wider border-b pb-1">Address Details</h3>
                        <div className="grid gap-6 grid-cols-2">
                            <div className="col-span-2">
                                <span className="block text-xs font-semibold text-slate-500 uppercase">Address Line 1</span>
                                <span className="text-sm font-medium text-slate-800">{staff.address?.addressLine1 || "-"}</span>
                            </div>
                            <div className="col-span-2">
                                <span className="block text-xs font-semibold text-slate-500 uppercase">Address Line 2</span>
                                <span className="text-sm font-medium text-slate-800">{staff.address?.addressLine2 || "-"}</span>
                            </div>
                            <div>
                                <span className="block text-xs font-semibold text-slate-500 uppercase">Landmark</span>
                                <span className="text-sm font-medium text-slate-800">{staff.address?.landmark || "-"}</span>
                            </div>
                            <div>
                                <span className="block text-xs font-semibold text-slate-500 uppercase">City</span>
                                <span className="text-sm font-medium text-slate-800">{staff.address?.city || "-"}</span>
                            </div>
                            <div>
                                <span className="block text-xs font-semibold text-slate-500 uppercase">State</span>
                                <span className="text-sm font-medium text-slate-800">{staff.address?.state || "-"}</span>
                            </div>
                            <div>
                                <span className="block text-xs font-semibold text-slate-500 uppercase">Postal Code</span>
                                <span className="text-sm font-medium text-slate-800">{staff.address?.postalCode || "-"}</span>
                            </div>
                            <div>
                                <span className="block text-xs font-semibold text-slate-500 uppercase">Country</span>
                                <span className="text-sm font-medium text-slate-800">{staff.address?.country || "-"}</span>
                            </div>
                        </div>
                    </div>

                    {/* Family Details & Demographics */}
                    <div>
                        <h3 className="text-md font-bold mb-4 text-slate-700 uppercase tracking-wider border-b pb-1">Demographics &amp; Family</h3>
                        <div className="grid gap-6 grid-cols-2 md:grid-cols-4">
                            <div>
                                <span className="block text-xs font-semibold text-slate-500 uppercase">Father's Name</span>
                                <span className="text-sm font-medium text-slate-800">{staff.fathersName || "-"}</span>
                            </div>
                            <div>
                                <span className="block text-xs font-semibold text-slate-500 uppercase">Mother's Name</span>
                                <span className="text-sm font-medium text-slate-800">{staff.mothersName || "-"}</span>
                            </div>
                            <div>
                                <span className="block text-xs font-semibold text-slate-500 uppercase">Category</span>
                                <span className="text-sm font-medium text-slate-800">{staff.category || "-"}</span>
                            </div>
                            <div>
                                <span className="block text-xs font-semibold text-slate-500 uppercase">Religion</span>
                                <span className="text-sm font-medium text-slate-800">{staff.religion || "-"}</span>
                            </div>
                        </div>
                    </div>

                    {/* Employment Info */}
                    <div>
                        <h3 className="text-md font-bold mb-4 text-slate-700 uppercase tracking-wider border-b pb-1">Employment Information</h3>
                        <div className="grid gap-6 grid-cols-2 md:grid-cols-3">
                            <div>
                                <span className="block text-xs font-semibold text-slate-500 uppercase">Staff Category</span>
                                <span className="text-sm font-medium text-slate-800">{staff.staffCategory || "-"}</span>
                            </div>
                            <div>
                                <span className="block text-xs font-semibold text-slate-500 uppercase">Designation</span>
                                <span className="text-sm font-medium text-slate-800">{staff.designation?.title || "-"}</span>
                            </div>
                            <div>
                                <span className="block text-xs font-semibold text-slate-500 uppercase">Joining Date</span>
                                <span className="text-sm font-medium text-slate-800">
                                    {staff.joiningDate ? new Date(staff.joiningDate).toLocaleDateString() : "-"}
                                </span>
                            </div>
                            <div>
                                <span className="block text-xs font-semibold text-slate-500 uppercase">Exit Date</span>
                                <span className="text-sm font-medium text-slate-800">
                                    {staff.exitDate ? new Date(staff.exitDate).toLocaleDateString() : "-"}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Subject Assignments (Read-Only) */}
            {staff.staffCategory === 'Teaching Staff' && (
                <div className="max-w-4xl mx-auto bg-white p-8 rounded-lg shadow-sm border border-slate-200">
                    <h3 className="text-md font-bold mb-4 text-slate-700 uppercase tracking-wider border-b pb-1">Subject Assignments</h3>
                    {activeAssignments.length === 0 ? (
                        <p className="text-gray-500 italic text-sm">No active subject assignments.</p>
                    ) : (
                        <div className="relative overflow-x-auto">
                            <table className="w-full text-sm text-left text-gray-500">
                                <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                                    <tr>
                                        <th scope="col" className="px-6 py-3">Subject</th>
                                        <th scope="col" className="px-6 py-3">Class</th>
                                        <th scope="col" className="px-6 py-3">Section</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {activeAssignments.map((assignment: any) => (
                                        <tr key={assignment.id} className="bg-white border-b">
                                            <td className="px-6 py-4 font-medium text-gray-900">{assignment.subject?.name}</td>
                                            <td className="px-6 py-4">{assignment.class?.name}</td>
                                            <td className="px-6 py-4">{assignment.section?.name}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}
            {showExitModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-walnut-950/55 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
                        <h3 className="text-lg font-bold text-gray-900 mb-4">Mark Staff Exit</h3>
                        <p className="text-sm text-gray-600 mb-4">
                            You are marking exit for staff member: <span className="font-semibold text-gray-800">{staff.firstName} {staff.lastName}</span> (ID: {staff.id}). This will also deactivate their user account.
                        </p>
                        <form onSubmit={handleConfirmExit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Exit Date <span className="text-red-500">*</span></label>
                                <input
                                    type="date"
                                    required
                                    value={exitDate}
                                    onChange={e => setExitDate(e.target.value)}
                                    className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-brand/40 focus:border-brand block w-full p-2.5"
                                />
                            </div>
                            <div className="flex justify-end gap-2 pt-4 border-t border-gray-200">
                                <button
                                    type="button"
                                    onClick={() => { setShowExitModal(false); }}
                                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:ring-4 focus:ring-line-strong"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={isExiting}
                                    className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 focus:ring-4 focus:ring-red-300 disabled:opacity-50"
                                >
                                    {isExiting ? "Marking Exit..." : "Confirm Exit"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </main>
    );
}
