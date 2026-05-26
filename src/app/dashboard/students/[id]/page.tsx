"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { API_BASE_URL } from "@/lib/api";
import { authFetch } from "@/lib/auth";
import { useRbac } from "@/lib/rbac";

export default function ViewStudentPage() {
    const params = useParams();
    const id = params?.id as string;
    const rbac = useRbac();
    const [student, setStudent] = useState<any>(null);
    const [sibling, setSibling] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        if (!id) return;
        const fetchData = async () => {
            try {
                const res = await authFetch(`${API_BASE_URL}/students/${id}`);
                if (!res.ok) throw new Error("Failed to fetch student details");
                const data = await res.json();
                setStudent(data);

                if (data.siblingId) {
                    try {
                        const sibRes = await authFetch(`${API_BASE_URL}/students/${data.siblingId}`);
                        if (sibRes.ok) {
                            const sibData = await sibRes.json();
                            setSibling(sibData);
                        }
                    } catch (e) {
                        console.error("Failed to fetch sibling", e);
                    }
                }
            } catch (err: any) {
                setError(err.message || "Failed to load student details");
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [id]);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-slate-50">
                <div className="text-slate-500 font-medium">Loading student details...</div>
            </div>
        );
    }

    if (error || !student) {
        return (
            <div className="p-4 bg-slate-50 min-h-screen">
                <div className="max-w-4xl mx-auto bg-white p-6 rounded-lg border border-red-200 text-red-600">
                    {error || "Student not found"}
                    <div className="mt-4">
                        <Link href="/dashboard/students" className="text-blue-600 hover:underline">
                            &larr; Back to Students
                        </Link>
                    </div>
                </div>
            </div>
        );
    }

    const activeDiscounts = student.studentDiscounts?.filter((sd: any) => sd.isActive) || [];

    return (
        <main className="p-4 bg-slate-50 min-h-screen">
            <div className="max-w-4xl mx-auto bg-white p-8 rounded-lg shadow-sm border border-slate-200">
                {/* Header */}
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b pb-6 mb-6 gap-4">
                    <div>
                        <div className="flex items-center gap-3">
                            <h2 className="text-2xl font-bold text-slate-800">
                                {student.firstName} {student.lastName}
                            </h2>
                            <span className={`px-2.5 py-0.5 text-xs font-semibold rounded-full ${
                                student.isActive ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                            }`}>
                                {student.isActive ? "Active" : "Inactive"}
                            </span>
                        </div>
                        <p className="text-sm text-slate-500 mt-1">Student ID: {student.id}</p>
                    </div>
                    <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                        <Link href="/dashboard/students" className="text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 font-medium rounded-lg text-sm px-4 py-2">
                            Back
                        </Link>
                        {rbac.canManageStudents && (
                            <Link href={`/dashboard/students/${student.id}/edit`} className="text-white bg-blue-600 hover:bg-blue-700 font-medium rounded-lg text-sm px-4 py-2">
                                Edit Student
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
                                <span className="text-sm font-medium text-slate-800">{student.firstName || "-"}</span>
                            </div>
                            <div>
                                <span className="block text-xs font-semibold text-slate-500 uppercase">Last Name</span>
                                <span className="text-sm font-medium text-slate-800">{student.lastName || "-"}</span>
                            </div>
                            <div>
                                <span className="block text-xs font-semibold text-slate-500 uppercase">Gender</span>
                                <span className="text-sm font-medium text-slate-800">{student.gender || "-"}</span>
                            </div>
                            <div>
                                <span className="block text-xs font-semibold text-slate-500 uppercase">Date of Birth</span>
                                <span className="text-sm font-medium text-slate-800">
                                    {student.dateOfBirth ? new Date(student.dateOfBirth).toLocaleDateString() : "-"}
                                </span>
                            </div>
                            <div>
                                <span className="block text-xs font-semibold text-slate-500 uppercase">Blood Group</span>
                                <span className="text-sm font-medium text-slate-800">{student.bloodGroup || "-"}</span>
                            </div>
                            <div>
                                <span className="block text-xs font-semibold text-slate-500 uppercase">Aadhaar Number</span>
                                <span className="text-sm font-medium text-slate-800">{student.aadhaarNumber || "-"}</span>
                            </div>
                            <div>
                                <span className="block text-xs font-semibold text-slate-500 uppercase">PEN</span>
                                <span className="text-sm font-medium text-slate-800">{student.pen || "-"}</span>
                            </div>
                            <div>
                                <span className="block text-xs font-semibold text-slate-500 uppercase">APAR ID</span>
                                <span className="text-sm font-medium text-slate-800">{student.aparId || "-"}</span>
                            </div>
                            <div>
                                <span className="block text-xs font-semibold text-slate-500 uppercase">ABHA ID</span>
                                <span className="text-sm font-medium text-slate-800">{student.abhaId || "-"}</span>
                            </div>
                        </div>
                    </div>

                    {/* Contact Info */}
                    <div>
                        <h3 className="text-md font-bold mb-4 text-slate-700 uppercase tracking-wider border-b pb-1">Contact Information</h3>
                        <div className="grid gap-6 grid-cols-2 md:grid-cols-3">
                            <div>
                                <span className="block text-xs font-semibold text-slate-500 uppercase">Email</span>
                                <span className="text-sm font-medium text-slate-800">{student.email || "-"}</span>
                            </div>
                            <div>
                                <span className="block text-xs font-semibold text-slate-500 uppercase">Mobile Number</span>
                                <span className="text-sm font-medium text-slate-800">{student.mobile || "-"}</span>
                            </div>
                            <div>
                                <span className="block text-xs font-semibold text-slate-500 uppercase">Alternate Mobile</span>
                                <span className="text-sm font-medium text-slate-800">{student.alternateMobile || "-"}</span>
                            </div>
                        </div>
                    </div>

                    {/* Address */}
                    <div>
                        <h3 className="text-md font-bold mb-4 text-slate-700 uppercase tracking-wider border-b pb-1">Address Details</h3>
                        <div className="grid gap-6 grid-cols-2">
                            <div className="col-span-2">
                                <span className="block text-xs font-semibold text-slate-500 uppercase">Address Line 1</span>
                                <span className="text-sm font-medium text-slate-800">{student.address?.addressLine1 || "-"}</span>
                            </div>
                            <div className="col-span-2">
                                <span className="block text-xs font-semibold text-slate-500 uppercase">Address Line 2</span>
                                <span className="text-sm font-medium text-slate-800">{student.address?.addressLine2 || "-"}</span>
                            </div>
                            <div>
                                <span className="block text-xs font-semibold text-slate-500 uppercase">Landmark</span>
                                <span className="text-sm font-medium text-slate-800">{student.address?.landmark || "-"}</span>
                            </div>
                            <div>
                                <span className="block text-xs font-semibold text-slate-500 uppercase">City</span>
                                <span className="text-sm font-medium text-slate-800">{student.address?.city || "-"}</span>
                            </div>
                            <div>
                                <span className="block text-xs font-semibold text-slate-500 uppercase">State</span>
                                <span className="text-sm font-medium text-slate-800">{student.address?.state || "-"}</span>
                            </div>
                            <div>
                                <span className="block text-xs font-semibold text-slate-500 uppercase">Postal Code</span>
                                <span className="text-sm font-medium text-slate-800">{student.address?.postalCode || "-"}</span>
                            </div>
                            <div>
                                <span className="block text-xs font-semibold text-slate-500 uppercase">Country</span>
                                <span className="text-sm font-medium text-slate-800">{student.address?.country || "-"}</span>
                            </div>
                        </div>
                    </div>

                    {/* Parents Details */}
                    <div>
                        <h3 className="text-md font-bold mb-4 text-slate-700 uppercase tracking-wider border-b pb-1">Parent &amp; Family Details</h3>
                        <div className="grid gap-6 grid-cols-2">
                            {/* Father */}
                            <div className="space-y-4 border-r border-slate-100 pr-4">
                                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Father's Details</h4>
                                <div>
                                    <span className="block text-xs font-semibold text-slate-500 uppercase">Father's Name</span>
                                    <span className="text-sm font-medium text-slate-800">{student.fathersName || "-"}</span>
                                </div>
                                <div>
                                    <span className="block text-xs font-semibold text-slate-500 uppercase">Father's Aadhaar</span>
                                    <span className="text-sm font-medium text-slate-800">{student.fatherAadhaarNumber || "-"}</span>
                                </div>
                                <div>
                                    <span className="block text-xs font-semibold text-slate-500 uppercase">Father's PAN</span>
                                    <span className="text-sm font-medium text-slate-800">{student.fatherPan || "-"}</span>
                                </div>
                                <div>
                                    <span className="block text-xs font-semibold text-slate-500 uppercase">Father's Occupation</span>
                                    <span className="text-sm font-medium text-slate-800">{student.fatherOccupation || "-"}</span>
                                </div>
                                <div>
                                    <span className="block text-xs font-semibold text-slate-500 uppercase">Father's Annual Income</span>
                                    <span className="text-sm font-medium text-slate-800">
                                        {student.fatherIncome != null ? `₹${student.fatherIncome.toLocaleString()}` : "-"}
                                    </span>
                                </div>
                            </div>

                            {/* Mother */}
                            <div className="space-y-4 pl-4">
                                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Mother's Details</h4>
                                <div>
                                    <span className="block text-xs font-semibold text-slate-500 uppercase">Mother's Name</span>
                                    <span className="text-sm font-medium text-slate-800">{student.mothersName || "-"}</span>
                                </div>
                                <div>
                                    <span className="block text-xs font-semibold text-slate-500 uppercase">Mother's Aadhaar</span>
                                    <span className="text-sm font-medium text-slate-800">{student.motherAadhaarNumber || "-"}</span>
                                </div>
                                <div>
                                    <span className="block text-xs font-semibold text-slate-500 uppercase">Mother's PAN</span>
                                    <span className="text-sm font-medium text-slate-800">{student.motherPan || "-"}</span>
                                </div>
                                <div>
                                    <span className="block text-xs font-semibold text-slate-500 uppercase">Mother's Occupation</span>
                                    <span className="text-sm font-medium text-slate-800">{student.motherOccupation || "-"}</span>
                                </div>
                                <div>
                                    <span className="block text-xs font-semibold text-slate-500 uppercase">Mother's Annual Income</span>
                                    <span className="text-sm font-medium text-slate-800">
                                        {student.motherIncome != null ? `₹${student.motherIncome.toLocaleString()}` : "-"}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Sibling Info */}
                    {sibling && (
                        <div>
                            <h3 className="text-md font-bold mb-4 text-slate-700 uppercase tracking-wider border-b pb-1">Linked Sibling</h3>
                            <div className="bg-slate-50 p-4 rounded-lg border border-slate-100 flex justify-between items-center">
                                <div>
                                    <span className="block text-xs font-semibold text-slate-500 uppercase">Name</span>
                                    <Link href={`/dashboard/students/${sibling.id}`} className="text-sm font-medium text-blue-600 hover:underline">
                                        {sibling.firstName} {sibling.lastName} (ID: {sibling.id})
                                    </Link>
                                </div>
                                <div>
                                    <span className="block text-xs font-semibold text-slate-500 uppercase">Gender</span>
                                    <span className="text-sm font-medium text-slate-800">{sibling.gender || "-"}</span>
                                </div>
                                <div>
                                    <span className="block text-xs font-semibold text-slate-500 uppercase">Status</span>
                                    <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
                                        sibling.isActive ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                                    }`}>
                                        {sibling.isActive ? "Active" : "Inactive"}
                                    </span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Demographics */}
                    <div>
                        <h3 className="text-md font-bold mb-4 text-slate-700 uppercase tracking-wider border-b pb-1">Demographics</h3>
                        <div className="grid gap-6 grid-cols-2">
                            <div>
                                <span className="block text-xs font-semibold text-slate-500 uppercase">Category</span>
                                <span className="text-sm font-medium text-slate-800">{student.category || "-"}</span>
                            </div>
                            <div>
                                <span className="block text-xs font-semibold text-slate-500 uppercase">Religion</span>
                                <span className="text-sm font-medium text-slate-800">{student.religion || "-"}</span>
                            </div>
                        </div>
                    </div>

                    {/* Fee Discounts */}
                    {activeDiscounts.length > 0 && (
                        <div>
                            <h3 className="text-md font-bold mb-4 text-slate-700 uppercase tracking-wider border-b pb-1">Applied Fee Discounts</h3>
                            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
                                {activeDiscounts.map((sd: any) => {
                                    const disc = sd.discountCategory;
                                    if (!disc) return null;
                                    return (
                                        <div key={sd.id} className="p-3 border border-slate-200 rounded-lg bg-white flex justify-between items-center">
                                            <div>
                                                <span className="text-sm font-semibold text-slate-800">{disc.name}</span>
                                                <span className="block text-[10px] text-slate-400 uppercase">{disc.applicationType} discount</span>
                                            </div>
                                            <span className="text-sm font-bold text-green-600">
                                                {disc.type === "PERCENTAGE" ? `${disc.value}%` : `₹${disc.value}`}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </main>
    );
}
