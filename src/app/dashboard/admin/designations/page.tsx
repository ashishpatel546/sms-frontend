"use client";

import { useState, useEffect, useCallback } from "react";
import { API_BASE_URL } from "@/lib/api";
import { authFetch, getUser } from "@/lib/auth";
import { useRouter } from "next/navigation";
import toast, { Toaster } from "react-hot-toast";

export default function DesignationsAdminPage() {
    const router = useRouter();
    const currentUser = getUser();
    const [designations, setDesignations] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const [isEditing, setIsEditing] = useState(false);
    const [currentId, setCurrentId] = useState<number | null>(null);
    const [formData, setFormData] = useState({ title: "", description: "", isActive: true });
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!currentUser || !["SUPER_ADMIN", "ADMIN"].includes(currentUser.role)) {
            router.replace("/dashboard");
        }
    }, [currentUser, router]);

    const fetchDesignations = useCallback(async () => {
        setLoading(true);
        try {
            const res = await authFetch(`${API_BASE_URL}/designations`);
            if (res.ok) {
                setDesignations(await res.json());
            } else {
                toast.error("Failed to load designations");
            }
        } catch (err) {
            toast.error("Failed to fetch designations");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchDesignations();
    }, [fetchDesignations]);

    const handleEdit = (designation: any) => {
        setIsEditing(true);
        setCurrentId(designation.id);
        setFormData({
            title: designation.title,
            description: designation.description || "",
            isActive: designation.isActive
        });
    };

    const handleCancel = () => {
        setIsEditing(false);
        setCurrentId(null);
        setFormData({ title: "", description: "", isActive: true });
    };

    const handleDelete = async (id: number) => {
        if (!confirm("Are you sure you want to delete this designation?")) return;
        try {
            const res = await authFetch(`${API_BASE_URL}/designations/${id}`, {
                method: "DELETE"
            });
            if (res.ok) {
                toast.success("Designation deleted successfully");
                fetchDesignations();
            } else {
                toast.error("Failed to delete designation");
            }
        } catch (err) {
            toast.error("Error deleting designation");
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            const method = isEditing ? "PATCH" : "POST";
            const url = isEditing ? `${API_BASE_URL}/designations/${currentId}` : `${API_BASE_URL}/designations`;
            
            const res = await authFetch(url, {
                method: method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formData)
            });

            if (res.ok) {
                toast.success(`Designation ${isEditing ? "updated" : "created"} successfully`);
                fetchDesignations();
                handleCancel();
            } else {
                const data = await res.json();
                toast.error(data.message || "Failed to save designation");
            }
        } catch (err) {
            toast.error("Error saving designation");
        } finally {
            setSaving(false);
        }
    };

    return (
        <main className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6">
            <Toaster position="top-right" />
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800">Designations Management</h1>
                    <p className="text-sm text-slate-500">Manage staff roles and titles.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-1">
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                        <h2 className="text-lg font-semibold text-slate-800 mb-4">
                            {isEditing ? "Edit Designation" : "Add Designation"}
                        </h2>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Title <span className="text-red-500">*</span></label>
                                <input
                                    type="text"
                                    value={formData.title}
                                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    placeholder="e.g. Principal, Teacher"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Description</label>
                                <textarea
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    placeholder="Optional description..."
                                    rows={3}
                                />
                            </div>
                            <div className="flex items-center">
                                <input
                                    type="checkbox"
                                    id="isActive"
                                    checked={formData.isActive}
                                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                                    className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                                />
                                <label htmlFor="isActive" className="ml-2 text-sm text-slate-700">Active</label>
                            </div>
                            <div className="flex gap-2 pt-2">
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="flex-1 py-2 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-medium rounded-lg transition-colors flex justify-center disabled:opacity-50"
                                >
                                    {saving ? "Saving..." : isEditing ? "Update" : "Create"}
                                </button>
                                {isEditing && (
                                    <button
                                        type="button"
                                        onClick={handleCancel}
                                        disabled={saving}
                                        className="py-2 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium rounded-lg transition-colors disabled:opacity-50"
                                    >
                                        Cancel
                                    </button>
                                )}
                            </div>
                        </form>
                    </div>
                </div>

                <div className="lg:col-span-2">
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
                        {loading ? (
                            <div className="p-8 text-center text-slate-500">Loading designations...</div>
                        ) : designations.length === 0 ? (
                            <div className="p-8 text-center text-slate-500">No designations found. Add your first one!</div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase text-xs">
                                        <tr>
                                            <th className="px-6 py-3 font-medium">Title</th>
                                            <th className="px-6 py-3 font-medium">Description</th>
                                            <th className="px-6 py-3 font-medium text-center">Status</th>
                                            <th className="px-6 py-3 font-medium text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {designations.map((d) => (
                                            <tr key={d.id} className="hover:bg-slate-50 transition-colors">
                                                <td className="px-6 py-4 font-medium text-slate-800">{d.title}</td>
                                                <td className="px-6 py-4 text-slate-500 truncate max-w-xs">{d.description || "-"}</td>
                                                <td className="px-6 py-4 text-center">
                                                    <span className={`px-2 py-1 text-xs rounded-full font-medium ${d.isActive ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'}`}>
                                                        {d.isActive ? 'Active' : 'Inactive'}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <div className="flex justify-end gap-2">
                                                        <button
                                                            onClick={() => handleEdit(d)}
                                                            className="text-indigo-600 hover:bg-indigo-50 px-2 py-1 rounded"
                                                        >
                                                            Edit
                                                        </button>
                                                        <button
                                                            onClick={() => handleDelete(d.id)}
                                                            className="text-red-600 hover:bg-red-50 px-2 py-1 rounded"
                                                        >
                                                            Delete
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </main>
    );
}
