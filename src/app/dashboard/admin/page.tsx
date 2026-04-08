"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { API_BASE_URL } from "@/lib/api";
import { getToken, getUser, authFetch } from "@/lib/auth";
import { useRouter } from "next/navigation";
import toast, { Toaster } from "react-hot-toast";
import Link from "next/link";
import AddStaffForm from "@/components/AddStaffForm";

type Tab = "users" | "add-staff" | "school-setup";

const ROLE_LABELS: Record<string, { label: string; color: string }> = {
    SUPER_ADMIN: { label: "Super Admin", color: "bg-purple-500/20 text-purple-300 border-purple-500/30" },
    ADMIN: { label: "Admin", color: "bg-blue-500/20 text-blue-300 border-blue-500/30" },
    SUB_ADMIN: { label: "Sub Admin", color: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30" },
    TEACHER: { label: "Teacher", color: "bg-green-500/20 text-green-300 border-green-500/30" },
    STUDENT: { label: "Student", color: "bg-amber-500/20 text-amber-300 border-amber-500/30" },
    PARENT: { label: "Parent", color: "bg-pink-500/20 text-pink-300 border-pink-500/30" },
};

const ALL_ROLES = ["", "SUPER_ADMIN", "ADMIN", "SUB_ADMIN", "TEACHER", "PARENT", "STUDENT"];

export default function AdminPanel() {
    const router = useRouter();
    const currentUser = getUser();
    const [activeTab, setActiveTab] = useState<Tab>("users");
    const [users, setUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const [searchName, setSearchName] = useState("");
    const [searchEmail, setSearchEmail] = useState("");
    const [searchRole, setSearchRole] = useState("");
    const [searchMobile, setSearchMobile] = useState("");
    const [showAllUsers, setShowAllUsers] = useState(false);

    // 3-dots dropdown state
    const [openDropdownId, setOpenDropdownId] = useState<number | null>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // View-profile modal state
    const [viewModalUser, setViewModalUser] = useState<any | null>(null);
    const [viewModalStaff, setViewModalStaff] = useState<any | null>(null);
    const [viewModalLoading, setViewModalLoading] = useState(false);

    // School Setup state
    const [setupFile, setSetupFile] = useState<File | null>(null);
    const [setupTimer, setSetupTimer] = useState(0);
    const [isConfirmingSetup, setIsConfirmingSetup] = useState(false);
    const [setupLoading, setSetupLoading] = useState(false);

    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (isConfirmingSetup && setupTimer > 0) {
            interval = setInterval(() => {
                setSetupTimer((prev) => prev - 1);
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [isConfirmingSetup, setupTimer]);

    const executeSchoolSetup = async () => {
        if (!setupFile) return;
        setSetupLoading(true);
        try {
            const formData = new FormData();
            formData.append("file", setupFile);

            const res = await authFetch(`${API_BASE_URL}/school-setup/execute`, {
                method: "POST",
                headers: { Authorization: `Bearer ${getToken()}` },
                body: formData,
            });

            if (res.ok) {
                toast.success("School setup executed successfully!");
                setSetupFile(null);
                setIsConfirmingSetup(false);
                setSetupTimer(0);
            } else {
                const d = await res.json();
                toast.error(d.message || "Failed to execute setup.");
            }
        } catch (error) {
            toast.error("An error occurred during setup execution.");
        } finally {
            setSetupLoading(false);
        }
    };

    const authHeaders = { Authorization: `Bearer ${getToken()}`, "Content-Type": "application/json" };

    useEffect(() => {
        if (!currentUser || !["SUPER_ADMIN", "ADMIN"].includes(currentUser.role)) {
            router.replace("/dashboard");
        }
    }, [currentUser, router]);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setOpenDropdownId(null);
            }
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    const fetchUsers = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (searchName) params.set("name", searchName);
            if (searchEmail) params.set("email", searchEmail);
            if (searchRole) params.set("role", searchRole);
            if (searchMobile) params.set("mobile", searchMobile);
            // staffOnly=true by default unless user explicitly chose to show all or selected a non-staff role
            const isNonStaffRole = searchRole && !["SUPER_ADMIN", "ADMIN", "SUB_ADMIN", "TEACHER", ""].includes(searchRole);
            if (!showAllUsers && !isNonStaffRole) params.set("staffOnly", "true");

            const res = await authFetch(`${API_BASE_URL}/users?${params}`, { headers: authHeaders });
            if (res.ok) setUsers(await res.json());
        } catch { }
        setLoading(false);
    }, [searchName, searchEmail, searchRole, searchMobile, showAllUsers]);

    useEffect(() => { fetchUsers(); }, [fetchUsers]);

    const handleRoleChange = async (userId: number, newRole: string) => {
        try {
            const res = await authFetch(`${API_BASE_URL}/users/${userId}/role`, {
                method: "PATCH", headers: authHeaders,
                body: JSON.stringify({ role: newRole }),
            });
            if (res.ok) { toast.success("Role updated!"); fetchUsers(); }
            else { const d = await res.json(); toast.error(d.message || "Failed to update role"); }
        } catch { toast.error("Failed to update role"); }
    };

    const handleResetPassword = async (userId: number, name: string) => {
        if (!confirm(`Reset password for ${name} to default?`)) return;
        try {
            const res = await authFetch(`${API_BASE_URL}/users/${userId}/reset-password`, { method: "PATCH", headers: authHeaders });
            if (res.ok) toast.success("Password reset. User must change on next login.");
            else toast.error("Failed to reset password");
        } catch { toast.error("Failed to reset password"); }
    };

    const handleToggleStatus = async (userId: number, isActive: boolean, name: string) => {
        if (!confirm(`${isActive ? "Deactivate" : "Activate"} ${name}?`)) return;
        try {
            const res = await authFetch(`${API_BASE_URL}/users/${userId}/toggle-status`, { method: "PATCH", headers: authHeaders });
            if (res.ok) { toast.success("Status updated!"); fetchUsers(); }
            else toast.error("Failed to update status");
        } catch { toast.error("Failed to update status"); }
    };

    const handleDeleteUser = async (userId: number, name: string) => {
        if (!confirm(`Delete account for ${name}?\n\nThis is permanent and cannot be undone.`)) return;
        try {
            const res = await authFetch(`${API_BASE_URL}/users/${userId}`, { method: "DELETE", headers: authHeaders });
            const data = await res.json();
            if (res.ok) { toast.success(data.message || "Account deleted."); fetchUsers(); }
            else toast.error(data.message || "Failed to delete account");
        } catch { toast.error("Failed to delete account"); }
    };

    const handleViewProfile = async (user: any) => {
        setViewModalUser(user);
        setViewModalStaff(null);
        setViewModalLoading(true);
        setOpenDropdownId(null);
        // Only staff roles have a Staff record — try to load it
        if (["SUPER_ADMIN", "ADMIN", "SUB_ADMIN", "TEACHER"].includes(user.role)) {
            try {
                const res = await authFetch(`${API_BASE_URL}/staff/by-user/${user.id}`, { headers: authHeaders });
                if (res.ok) setViewModalStaff(await res.json());
            } catch { /* no staff record */ }
        }
        setViewModalLoading(false);
    };

    const isSuperAdmin = currentUser?.role === "SUPER_ADMIN";
    const editableRoles = isSuperAdmin
        ? ["ADMIN", "SUB_ADMIN", "TEACHER"]
        : ["SUB_ADMIN", "TEACHER"];

    return (
        <main className="p-4 sm:p-6 max-w-7xl mx-auto">
            <Toaster position="top-right" />
            <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-3 mb-1">
                        <div className="w-8 h-8 rounded-lg bg-linear-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
                            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                            </svg>
                        </div>
                        <h1 className="text-2xl font-bold text-slate-800">
                            {isSuperAdmin ? "Super Admin Panel" : "Admin Panel"}
                        </h1>
                    </div>
                    <p className="text-slate-500 text-sm ml-11">Manage users, roles, and staff accounts</p>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex flex-wrap gap-1 bg-slate-100 rounded-xl p-1 mb-6 w-fit">
                {(isSuperAdmin 
                    ? [["users", "👥 Users & Roles"], ["add-staff", "➕ Add Staff"], ["school-setup", "🏫 School Setup"]] as const 
                    : [["users", "👥 Users & Roles"], ["add-staff", "➕ Add Staff"]] as const
                ).map(([tab, label]) => (
                    <button key={tab} onClick={() => setActiveTab(tab)}
                        className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${activeTab === tab ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
                        {label}
                    </button>
                ))}
            </div>

            {/* ─── USERS TAB ─── */}
            {activeTab === "users" && (
                <div className="space-y-4">
                    {/* Search / Filter Bar */}
                    <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                            <div className="relative">
                                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                                <input
                                    type="text" value={searchName} onChange={e => setSearchName(e.target.value)}
                                    placeholder="Search by name..."
                                    className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>
                            <div className="relative">
                                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
                                </svg>
                                <input
                                    type="text" value={searchEmail} onChange={e => setSearchEmail(e.target.value)}
                                    placeholder="Search by email..."
                                    className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>
                            <div className="relative">
                                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                </svg>
                                <input
                                    type="text" value={searchMobile} onChange={e => setSearchMobile(e.target.value)}
                                    placeholder="Search by mobile..."
                                    className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>
                            <select
                                value={searchRole} onChange={e => setSearchRole(e.target.value)}
                                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            >
                                <option value="">All Roles</option>
                                {ALL_ROLES.filter(r => r).map(r => (
                                    <option key={r} value={r}>{ROLE_LABELS[r]?.label || r}</option>
                                ))}
                            </select>
                            <div className="flex items-center gap-2">
                                <label className="flex items-center gap-2 cursor-pointer select-none text-sm text-slate-600">
                                    <div
                                        onClick={() => setShowAllUsers(!showAllUsers)}
                                        className={`w-10 h-5 rounded-full relative transition-colors ${showAllUsers ? "bg-indigo-500" : "bg-slate-300"}`}
                                    >
                                        <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${showAllUsers ? "left-5" : "left-0.5"}`} />
                                    </div>
                                    Show all users
                                </label>
                            </div>
                        </div>
                        <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100">
                            <p className="text-xs text-slate-500">
                                {showAllUsers ? "Showing all users" : "Showing staff only (Admin/Teacher) • "}
                                <span className="font-medium text-slate-700">{users.length} results</span>
                            </p>
                            <button onClick={() => { setSearchName(""); setSearchEmail(""); setSearchRole(""); setSearchMobile(""); setShowAllUsers(false); }}
                                className="text-xs text-indigo-500 hover:text-indigo-700 font-medium">
                                Clear filters
                            </button>
                        </div>
                    </div>

                    {/* Users Table */}
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                        {loading ? (
                            <div className="flex items-center justify-center py-16">
                                <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                            </div>
                        ) : users.length === 0 ? (
                            <div className="text-center py-16 text-slate-400">
                                <div className="text-4xl mb-3">🔍</div>
                                <p className="font-medium">No users found</p>
                                <p className="text-sm mt-1">Try adjusting your search filters</p>
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wide">
                                        <tr>
                                            <th className="px-4 py-3">Name</th>
                                            <th className="px-4 py-3">Email / Mobile</th>
                                            <th className="px-4 py-3">Role</th>
                                            <th className="px-4 py-3">Status</th>
                                            <th className="px-4 py-3 text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {users.map(user => (
                                            <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-full bg-linear-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
                                                            {user.firstName?.[0]}{user.lastName?.[0]}
                                                        </div>
                                                        <div>
                                                            <span className="font-medium text-slate-800">{user.firstName} {user.lastName}</span>
                                                            {user.mustChangePassword && (
                                                                <span className="ml-2 px-1.5 py-0.5 text-xs bg-amber-100 text-amber-700 rounded">pw pending</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="text-slate-600">{user.email || <span className="text-slate-400">—</span>}</div>
                                                    {user.mobile && <div className="text-xs text-slate-400">{user.mobile}</div>}
                                                </td>
                                                <td className="px-4 py-3">
                                                    {(user.role === "SUPER_ADMIN" || !isSuperAdmin) ? (
                                                        <span className={`px-2.5 py-1 text-xs font-medium rounded-full border ${ROLE_LABELS[user.role]?.color || "bg-slate-100 text-slate-500"}`}>
                                                            {ROLE_LABELS[user.role]?.label || user.role}
                                                        </span>
                                                    ) : (
                                                        <select
                                                            defaultValue={user.role}
                                                            onChange={e => handleRoleChange(user.id, e.target.value)}
                                                            className="text-xs bg-white border border-slate-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                                                        >
                                                            {ALL_ROLES.filter(r => r).map(r => (
                                                                <option key={r} value={r}>{ROLE_LABELS[r]?.label || r}</option>
                                                            ))}
                                                        </select>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${user.isActive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}>
                                                        {user.isActive ? "Active" : "Inactive"}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    {user.role !== "SUPER_ADMIN" && (
                                                        <div className="relative inline-block" ref={openDropdownId === user.id ? dropdownRef : null}>
                                                            <button
                                                                onClick={() => setOpenDropdownId(openDropdownId === user.id ? null : user.id)}
                                                                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-700 transition-colors text-lg font-bold leading-none"
                                                                title="Actions">
                                                                &#8942;
                                                            </button>
                                                            {openDropdownId === user.id && (
                                                                <div className="absolute right-0 mt-1 w-44 bg-white rounded-xl shadow-lg border border-slate-200 z-30 py-1">
                                                                    <button
                                                                        onClick={() => handleViewProfile(user)}
                                                                        className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">
                                                                        👁 View Profile
                                                                    </button>
                                                                    <button
                                                                        onClick={() => { setOpenDropdownId(null); handleResetPassword(user.id, `${user.firstName} ${user.lastName}`); }}
                                                                        className="w-full text-left px-4 py-2 text-sm text-amber-700 hover:bg-amber-50">
                                                                        🔑 Reset Password
                                                                    </button>
                                                                    <button
                                                                        onClick={() => { setOpenDropdownId(null); handleToggleStatus(user.id, user.isActive, `${user.firstName} ${user.lastName}`); }}
                                                                        className={`w-full text-left px-4 py-2 text-sm hover:bg-slate-50 ${user.isActive ? "text-orange-700" : "text-green-700"}`}>
                                                                        {user.isActive ? "🔒 Deactivate" : "✅ Activate"}
                                                                    </button>
                                                                    {isSuperAdmin && (
                                                                        <>
                                                                            <hr className="my-1 border-slate-100" />
                                                                            <button
                                                                                onClick={() => { setOpenDropdownId(null); handleDeleteUser(user.id, `${user.firstName} ${user.lastName}`); }}
                                                                                className="w-full text-left px-4 py-2 text-sm text-rose-600 hover:bg-rose-50 font-medium">
                                                                                🗑 Delete Account
                                                                            </button>
                                                                        </>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ─── ADD STAFF TAB ─── */}
            {activeTab === "add-staff" && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 max-w-4xl">
                    <h2 className="font-bold text-slate-800 text-lg mb-1">Add New Staff Member</h2>
                    <p className="text-slate-500 text-sm mb-6">
                        Staff will be assigned the default password and must change it on first login.
                    </p>

                    <AddStaffForm
                        allowRoleSelect
                        isSuperAdmin={isSuperAdmin}
                        onSuccess={() => { fetchUsers(); setActiveTab("users"); }}
                        onCancel={() => setActiveTab("users")}
                    />
                </div>
            )}

            {/* ─── SCHOOL SETUP TAB ─── */}
            {activeTab === "school-setup" && isSuperAdmin && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 max-w-4xl">
                    <h2 className="font-bold text-rose-600 flex items-center gap-2 text-lg mb-1">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                        School Setup Automation
                    </h2>
                    <p className="text-slate-500 text-sm mb-6">
                        Upload a <code className="bg-slate-100 px-1 py-0.5 rounded text-rose-500">school-setup.json</code> file to automatically initialize the academic session, fee categories, designations, grades, and classes. 
                        <strong> This action should only be performed once on a fresh setup.</strong>
                    </p>
                    
                    <div className="space-y-6">
                        <div className="border-2 border-dashed border-slate-200 rounded-xl p-6 hover:bg-slate-50 transition-colors">
                            <label className="block text-sm font-medium text-slate-700 mb-2">Select Setup File</label>
                            <input 
                                type="file" 
                                accept=".json"
                                onChange={(e) => setSetupFile(e.target.files?.[0] || null)}
                                className="block w-full text-sm text-slate-500
                                    file:mr-4 file:py-2.5 file:px-4
                                    file:rounded-xl file:border-0
                                    file:text-sm file:font-semibold
                                    file:bg-indigo-50 file:text-indigo-700
                                    hover:file:bg-indigo-100
                                    cursor-pointer"
                            />
                        </div>

                        {setupTimer > 0 ? (
                            <button disabled className="w-full sm:w-auto px-6 py-3 bg-rose-400 text-white rounded-xl font-bold shadow-sm opacity-50 cursor-not-allowed">
                                Proceeding in {setupTimer}s...
                            </button>
                        ) : isConfirmingSetup ? (
                            <div className="flex flex-wrap items-center gap-3">
                                <button onClick={executeSchoolSetup} disabled={!setupFile || setupLoading} className="w-full sm:w-auto px-6 py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold transition-all shadow-sm disabled:opacity-50 flex justify-center items-center gap-2">
                                    {setupLoading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : "⚠️ Confirm Execution"}
                                </button>
                                <button onClick={() => { setIsConfirmingSetup(false); setSetupTimer(0); }} className="w-full sm:w-auto px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition-all disabled:opacity-50">
                                    Cancel
                                </button>
                            </div>
                        ) : (
                            <button onClick={() => { setIsConfirmingSetup(true); setSetupTimer(5); }} disabled={!setupFile} className="w-full sm:w-auto px-6 py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold transition-all shadow-sm disabled:opacity-50 focus:ring-4 focus:ring-rose-100">
                                Execute Setup
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* ─── VIEW PROFILE MODAL ─── */}
            {viewModalUser && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between p-6 border-b border-slate-100">
                            <h3 className="text-lg font-bold text-slate-800">User Profile</h3>
                            <button onClick={() => { setViewModalUser(null); setViewModalStaff(null); }}
                                className="p-2 rounded-lg hover:bg-slate-100 text-slate-500">
                                ✕
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            {viewModalLoading ? (
                                <div className="flex justify-center py-8">
                                    <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                                </div>
                            ) : (
                                <>
                                    <div className="flex items-center gap-4">
                                        <div className="w-14 h-14 rounded-full bg-linear-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xl font-bold">
                                            {viewModalUser.firstName?.[0]}{viewModalUser.lastName?.[0]}
                                        </div>
                                        <div>
                                            <p className="text-xl font-bold text-slate-800">{viewModalUser.firstName} {viewModalUser.lastName}</p>
                                            <p className="text-sm text-slate-500">{ROLE_LABELS[viewModalUser.role]?.label || viewModalUser.role}</p>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3 text-sm">
                                        {[
                                            ["Email", viewModalUser.email],
                                            ["Mobile", viewModalUser.mobile],
                                            ["Gender", viewModalUser.gender],
                                            ["Date of Birth", viewModalUser.dateOfBirth],
                                            ["Blood Group", viewModalUser.bloodGroup],
                                            ["Category", viewModalUser.category],
                                            ["Religion", viewModalUser.religion],
                                            ["Status", viewModalUser.isActive ? "Active" : "Inactive"],
                                        ].map(([label, val]) => val ? (
                                            <div key={label}>
                                                <p className="text-xs text-slate-400 uppercase tracking-wide">{label}</p>
                                                <p className="font-medium text-slate-700">{val}</p>
                                            </div>
                                        ) : null)}
                                    </div>
                                    {viewModalStaff && (
                                        <>
                                            <hr className="border-slate-100" />
                                            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Employment</p>
                                            <div className="grid grid-cols-2 gap-3 text-sm">
                                                {[
                                                    ["Staff Category", viewModalStaff.staffCategory],
                                                    ["Designation", viewModalStaff.designation?.title],
                                                    ["Employee Code", viewModalStaff.employeeCode],
                                                    ["Department", viewModalStaff.department],
                                                    ["Joining Date", viewModalStaff.joiningDate],
                                                ].map(([label, val]) => val ? (
                                                    <div key={label}>
                                                        <p className="text-xs text-slate-400 uppercase tracking-wide">{label}</p>
                                                        <p className="font-medium text-slate-700">{val}</p>
                                                    </div>
                                                ) : null)}
                                            </div>
                                            {viewModalStaff.id && (
                                                <div className="pt-2">
                                                    <Link href={`/dashboard/staff/${viewModalStaff.id}/edit`}
                                                        onClick={() => { setViewModalUser(null); setViewModalStaff(null); }}
                                                        className="text-indigo-600 hover:text-indigo-800 text-sm font-medium underline">
                                                        Open full staff profile →
                                                    </Link>
                                                </div>
                                            )}
                                        </>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}

        </main>
    );
}
