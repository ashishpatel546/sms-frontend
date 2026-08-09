"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { API_BASE_URL } from "@/lib/api";
import { getToken, getUser, authFetch } from "@/lib/auth";
import { useRouter } from "next/navigation";
import toast, { Toaster } from "react-hot-toast";
import Link from "next/link";
import AddStaffForm from "@/components/AddStaffForm";
import { useReadOnlySession, READ_ONLY_TITLE } from "@/lib/support-session";
import { useRbac } from "@/lib/rbac";
import {
    RoleChip,
    RoleManagerDialog,
    roleLabel,
    type RoleManagerUser,
} from "./RoleManagerDialog";

type Tab = "users" | "add-staff" | "school-setup";

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

const ALL_ROLES = ["SUPER_ADMIN", "ADMIN", "SUB_ADMIN", "HR_ADMIN", "LIBRARIAN", "TEACHER", "GUARD", "PARENT", "STUDENT"];

/**
 * Primary roles that can never carry an additional role, so there is nothing
 * to look up for them. Keeps the roles fan-out below to staff rows.
 */
const NO_EXTRA_ROLES = ["PARENT", "STUDENT"];

export default function AdminPanel() {
    const router = useRouter();
    const currentUser = getUser();
    const { canAccessAdminPanel } = useRbac();
    const readOnly = useReadOnlySession();
    const [activeTab, setActiveTab] = useState<Tab>("users");
    const [users, setUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const [searchName, setSearchName] = useState("");
    const [searchEmail, setSearchEmail] = useState("");
    const [searchRole, setSearchRole] = useState("");
    const [searchMobile, setSearchMobile] = useState("");
    const [searchDesignation, setSearchDesignation] = useState("");
    const [showAllUsers, setShowAllUsers] = useState(false);
    const [designations, setDesignations] = useState<{ id: number; title: string }[]>([]);

    // Pagination
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(25);
    const [total, setTotal] = useState(0);
    const totalPages = Math.ceil(total / pageSize);

    // 3-dots dropdown state
    const [openDropdownId, setOpenDropdownId] = useState<number | null>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Additional roles per user id, filled in behind the table. `undefined`
    // means "not looked up yet" — the row shows the primary chip alone until
    // the answer lands, never a wrong one.
    const [extraRoles, setExtraRoles] = useState<Record<number, string[]>>({});
    const [roleEditorUser, setRoleEditorUser] = useState<RoleManagerUser | null>(null);

    // View-profile modal state
    const [viewModalUser, setViewModalUser] = useState<any | null>(null);
    const [viewModalStaff, setViewModalStaff] = useState<any | null>(null);
    const [viewModalLoading, setViewModalLoading] = useState(false);

    // Fetch designations for filter dropdown
    useEffect(() => {
        authFetch(`${API_BASE_URL}/designations`, { headers: { Authorization: `Bearer ${getToken()}` } })
            .then(r => r.ok ? r.json() : [])
            .then((data: { id: number; title: string }[]) => setDesignations(data))
            .catch(() => {});
    }, []);

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

    // Resolved across every role held, not just the primary one — the panel is
    // ADMIN+, and that bar is cleared by any role the person holds.
    useEffect(() => {
        if (!currentUser || !canAccessAdminPanel) {
            router.replace("/dashboard");
        }
    }, [currentUser, canAccessAdminPanel, router]);

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

    const fetchUsers = useCallback(async (overridePage?: number, overrideSize?: number) => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (searchName) params.set("name", searchName);
            if (searchEmail) params.set("email", searchEmail);
            if (searchRole) params.set("role", searchRole);
            if (searchMobile) params.set("mobile", searchMobile);
            if (searchDesignation) params.set("designationId", searchDesignation);
            // staffOnly=true by default unless the user explicitly chose to show all,
            // selected a non-staff role, or is looking someone up by mobile number —
            // a mobile lookup must surface every matching account (the same number
            // belongs to a parent and their children's student logins).
            const isNonStaffRole = searchRole && !["SUPER_ADMIN", "ADMIN", "SUB_ADMIN", "HR_ADMIN", "TEACHER", ""].includes(searchRole);
            const isMobileLookup = Boolean(searchMobile.trim());
            if (!showAllUsers && !isNonStaffRole && !isMobileLookup) params.set("staffOnly", "true");
            params.set("page", String(overridePage ?? page));
            params.set("limit", String(overrideSize ?? pageSize));

            const res = await authFetch(`${API_BASE_URL}/users?${params}`, { headers: authHeaders });
            if (res.ok) {
                const data = await res.json();
                if (data && data.data) {
                    setUsers(data.data);
                    setTotal(data.total);
                    setPage(data.page);
                } else {
                    setUsers(Array.isArray(data) ? data : []);
                    setTotal(Array.isArray(data) ? data.length : 0);
                }
            }
        } catch { }
        setLoading(false);
    }, [searchName, searchEmail, searchRole, searchMobile, searchDesignation, showAllUsers, page, pageSize]);

    const handlePageChange = (newPage: number) => {
        if (newPage < 1 || newPage > totalPages) return;
        setPage(newPage);
        fetchUsers(newPage);
    };

    const handlePageSizeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newSize = parseInt(e.target.value);
        setPageSize(newSize);
        setPage(1);
        fetchUsers(1, newSize);
    };

    const getPageNumbers = () => {
        const pages: (number | '...')[] = [];
        if (totalPages <= 7) {
            for (let i = 1; i <= totalPages; i++) pages.push(i);
        } else {
            pages.push(1);
            if (page > 3) pages.push('...');
            const start = Math.max(2, page - 1);
            const end = Math.min(totalPages - 1, page + 1);
            for (let i = start; i <= end; i++) pages.push(i);
            if (page < totalPages - 2) pages.push('...');
            pages.push(totalPages);
        }
        return pages;
    };

    useEffect(() => { fetchUsers(); }, [fetchUsers]);

    // Additional roles are not part of the user list payload — there is one
    // endpoint per user — so the visible page is filled in afterwards, four
    // requests at a time. The table is readable the whole time; chips just
    // arrive a beat later. Parent/student rows are skipped: the API refuses to
    // grant them anything, so the answer is always empty.
    useEffect(() => {
        const ids = (users as { id: number; role: string }[])
            .filter(u => !NO_EXTRA_ROLES.includes(u.role))
            .map(u => u.id);
        if (ids.length === 0) return;

        let cancelled = false;
        const queue = [...ids];
        const found: Record<number, string[]> = {};

        const worker = async () => {
            while (queue.length && !cancelled) {
                const id = queue.shift()!;
                try {
                    const res = await authFetch(`${API_BASE_URL}/users/${id}/roles`, {
                        headers: { Authorization: `Bearer ${getToken()}` },
                    });
                    if (res.ok) {
                        const d = await res.json();
                        found[id] = (d.secondary ?? []).map((s: { role: string }) => s.role);
                    }
                } catch { /* a row that can't be read just shows its primary role */ }
            }
        };

        void Promise.all([worker(), worker(), worker(), worker()]).then(() => {
            if (!cancelled) setExtraRoles(prev => ({ ...prev, ...found }));
        });

        return () => { cancelled = true; };
    }, [users]);

    const handleResetPassword = async (userId: number, name: string) => {
        if (!confirm(`Reset password for ${name} to default?\n\nThey will be logged out everywhere and must change the password at next login.`)) return;
        try {
            const res = await authFetch(`${API_BASE_URL}/users/${userId}/reset-password`, { method: "PATCH", headers: authHeaders });
            if (res.ok) {
                const d = await res.json().catch(() => null);
                toast.success(d?.message || "Password reset. User must change on next login.");
            } else {
                const d = await res.json().catch(() => null);
                toast.error(d?.message ? `Reset failed: ${d.message}` : `Failed to reset password (HTTP ${res.status})`);
            }
        } catch { toast.error("Failed to reset password — network error"); }
    };

    const handleToggleStatus = async (userId: number, isActive: boolean, name: string) => {
        if (!confirm(`${isActive ? "Deactivate" : "Activate"} ${name}?`)) return;
        try {
            const res = await authFetch(`${API_BASE_URL}/users/${userId}/toggle-status`, { method: "PATCH", headers: authHeaders });
            if (res.ok) { toast.success("Status updated!"); fetchUsers(page); }
            else toast.error("Failed to update status");
        } catch { toast.error("Failed to update status"); }
    };

    const handleDeleteUser = async (userId: number, name: string) => {
        if (!confirm(`Delete account for ${name}?\n\nThis is permanent and cannot be undone.`)) return;
        try {
            const res = await authFetch(`${API_BASE_URL}/users/${userId}`, { method: "DELETE", headers: authHeaders });
            const data = await res.json();
            if (res.ok) { toast.success(data.message || "Account deleted."); fetchUsers(page); }
            else toast.error(data.message || "Failed to delete account");
        } catch { toast.error("Failed to delete account"); }
    };

    const handleViewProfile = async (user: any) => {
        setViewModalUser(user);
        setViewModalStaff(null);
        setViewModalLoading(true);
        setOpenDropdownId(null);
        // Only staff roles have a Staff record — try to load it
        if (["SUPER_ADMIN", "ADMIN", "SUB_ADMIN", "HR_ADMIN", "TEACHER"].includes(user.role)) {
            try {
                const res = await authFetch(`${API_BASE_URL}/staff/by-user/${user.id}`, { headers: authHeaders });
                if (res.ok) setViewModalStaff(await res.json());
            } catch { /* no staff record */ }
        }
        setViewModalLoading(false);
    };

    const isSuperAdmin = currentUser?.role === "SUPER_ADMIN";

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
                        <h1 className="font-display text-[22px] sm:text-[26px] font-semibold tracking-[-0.02em] text-ink">
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
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
                            <div className="relative">
                                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                                <input
                                    type="text" value={searchName} onChange={e => setSearchName(e.target.value)}
                                    placeholder="Search by name..."
                                    className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand/40"
                                />
                            </div>
                            <div className="relative">
                                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
                                </svg>
                                <input
                                    type="text" value={searchEmail} onChange={e => setSearchEmail(e.target.value)}
                                    placeholder="Search by email..."
                                    className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand/40"
                                />
                            </div>
                            <div className="relative">
                                <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                </svg>
                                <input
                                    type="text" value={searchMobile} onChange={e => setSearchMobile(e.target.value)}
                                    placeholder="Search by mobile..."
                                    className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand/40"
                                />
                            </div>
                            <select
                                value={searchRole} onChange={e => setSearchRole(e.target.value)}
                                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand/40"
                            >
                                <option value="">All Roles</option>
                                {ALL_ROLES.map(r => (
                                    <option key={r} value={r}>{roleLabel(r)}</option>
                                ))}
                            </select>
                            <select
                                value={searchDesignation} onChange={e => setSearchDesignation(e.target.value)}
                                className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand/40"
                            >
                                <option value="">All Designations</option>
                                {designations.map(d => (
                                    <option key={d.id} value={String(d.id)}>{d.title}</option>
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
                                <span className="font-medium text-slate-700">{total} results</span>
                            </p>
                            <button onClick={() => { setSearchName(""); setSearchEmail(""); setSearchRole(""); setSearchMobile(""); setSearchDesignation(""); setShowAllUsers(false); setPage(1); fetchUsers(1); }}
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
                            // On a phone the six columns cannot honestly fit, so the table
                            // keeps its real width and scrolls sideways rather than being
                            // crushed until pills and names wrap mid-word. `min-w` is what
                            // turns `w-full` from "squeeze to fit" into "scroll to see".
                            <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
                                <table className="w-full min-w-208 text-sm text-left">
                                    <thead className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wide">
                                        <tr>
                                            <th className="px-4 py-3 whitespace-nowrap">Name</th>
                                            <th className="px-4 py-3 whitespace-nowrap">Email / Mobile</th>
                                            <th className="px-4 py-3 whitespace-nowrap">Role</th>
                                            <th className="px-4 py-3 whitespace-nowrap">Designation</th>
                                            <th className="px-4 py-3 whitespace-nowrap">Status</th>
                                            <th className="px-4 py-3 text-right whitespace-nowrap">Actions</th>
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
                                                                <span className="ml-2 inline-flex whitespace-nowrap px-1.5 py-0.5 text-xs bg-amber-100 text-amber-700 rounded">pw pending</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="text-slate-600">{user.email || <span className="text-slate-400">—</span>}</div>
                                                    {user.mobile && <div className="text-xs text-slate-400">{user.mobile}</div>}
                                                </td>
                                                <td className="px-4 py-3">
                                                    {/* Every role the person holds, primary first. The cell is the way
                                                        in to the role editor — a select here could only ever show one. */}
                                                    <button
                                                        type="button"
                                                        onClick={() => setRoleEditorUser(user)}
                                                        title={`Manage roles for ${user.firstName} ${user.lastName}`}
                                                        className="group -mx-1 -my-0.5 flex max-w-56 cursor-pointer flex-wrap items-center gap-1 rounded-lg px-1 py-0.5 text-left transition-colors hover:bg-brand-tint/60 focus-visible:ring-3 focus-visible:ring-brand/30 focus-visible:outline-none"
                                                    >
                                                        <RoleChip role={user.role} primary />
                                                        {(extraRoles[user.id] ?? []).map((r: string) => (
                                                            <RoleChip key={r} role={r} />
                                                        ))}
                                                        <span className="text-ink-faint group-hover:text-brand text-[11px] font-semibold opacity-0 transition-opacity group-hover:opacity-100">
                                                            Edit
                                                        </span>
                                                    </button>
                                                </td>
                                                <td className="px-4 py-3">
                                                    {user.designation ? (
                                                        // inline-flex + whitespace-nowrap, NOT a bare inline span:
                                                        // an inline element wraps BETWEEN its words, which splits the
                                                        // pill's background and border in half — "Vice" in one box on
                                                        // one line, "Principal" in another below it. A pill has to
                                                        // stay one unbroken box, so it never wraps; the table scrolls
                                                        // sideways instead (see min-w on the table).
                                                        <span className="inline-flex whitespace-nowrap px-2.5 py-1 text-xs font-medium rounded-full bg-violet-500/10 text-violet-700 border border-violet-500/20">
                                                            {user.designation.title}
                                                        </span>
                                                    ) : (
                                                        <span className="text-slate-400 text-xs">—</span>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className={`inline-flex whitespace-nowrap px-2 py-0.5 text-xs rounded-full font-medium ${user.isActive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}>
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
                                                                        onClick={() => { setOpenDropdownId(null); setRoleEditorUser(user); }}
                                                                        className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">
                                                                        🎫 Manage Roles
                                                                    </button>
                                                                    <button
                                                                        onClick={() => { setOpenDropdownId(null); handleResetPassword(user.id, `${user.firstName} ${user.lastName}`); }}
                                                                        disabled={readOnly}
                                                                        title={readOnly ? READ_ONLY_TITLE : undefined}
                                                                        className="w-full text-left px-4 py-2 text-sm text-amber-700 hover:bg-amber-50 disabled:opacity-50 disabled:cursor-not-allowed">
                                                                        🔑 Reset Password
                                                                    </button>
                                                                    <button
                                                                        onClick={() => { setOpenDropdownId(null); handleToggleStatus(user.id, user.isActive, `${user.firstName} ${user.lastName}`); }}
                                                                        disabled={readOnly}
                                                                        title={readOnly ? READ_ONLY_TITLE : undefined}
                                                                        className={`w-full text-left px-4 py-2 text-sm hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed ${user.isActive ? "text-orange-700" : "text-green-700"}`}>
                                                                        {user.isActive ? "🔒 Deactivate" : "Activate"}
                                                                    </button>
                                                                    {isSuperAdmin && (
                                                                        <>
                                                                            <hr className="my-1 border-slate-100" />
                                                                            <button
                                                                                onClick={() => { setOpenDropdownId(null); handleDeleteUser(user.id, `${user.firstName} ${user.lastName}`); }}
                                                                                disabled={readOnly}
                                                                                title={readOnly ? READ_ONLY_TITLE : undefined}
                                                                                className="w-full text-left px-4 py-2 text-sm text-rose-600 hover:bg-rose-50 font-medium disabled:opacity-50 disabled:cursor-not-allowed">
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

                    {/* Pagination */}
                    {!loading && total > 0 && (
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-4 pt-4 border-t border-slate-200">
                            <div className="flex items-center gap-2 text-sm text-slate-600">
                                <span>Rows per page:</span>
                                <select
                                    value={pageSize}
                                    onChange={handlePageSizeChange}
                                    className="border border-slate-200 rounded-lg text-sm p-1 focus:outline-none focus:ring-1 focus:ring-brand/40"
                                >
                                    {PAGE_SIZE_OPTIONS.map(opt => (
                                        <option key={opt} value={opt}>{opt}</option>
                                    ))}
                                </select>
                                <span className="ml-2 text-slate-500">
                                    {Math.min((page - 1) * pageSize + 1, total)}–{Math.min(page * pageSize, total)} of {total}
                                </span>
                            </div>
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={() => handlePageChange(page - 1)}
                                    disabled={page === 1}
                                    className="px-3 py-1.5 text-sm rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                >
                                    ← Prev
                                </button>
                                {getPageNumbers().map((p, idx) =>
                                    p === '...' ? (
                                        <span key={`ellipsis-${idx}`} className="px-2 py-1.5 text-sm text-slate-400">…</span>
                                    ) : (
                                        <button
                                            key={p}
                                            onClick={() => handlePageChange(p as number)}
                                            className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${page === p ? 'bg-indigo-600 text-white border-indigo-600' : 'border-slate-200 hover:bg-slate-50'}`}
                                        >
                                            {p}
                                        </button>
                                    )
                                )}
                                <button
                                    onClick={() => handlePageChange(page + 1)}
                                    disabled={page === totalPages || totalPages === 0}
                                    className="px-3 py-1.5 text-sm rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                >
                                    Next →
                                </button>
                            </div>
                        </div>
                    )}
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
                        onSuccess={() => { fetchUsers(1); setActiveTab("users"); }}
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
                                <button onClick={executeSchoolSetup} disabled={!setupFile || setupLoading || readOnly} title={readOnly ? READ_ONLY_TITLE : undefined} className="w-full sm:w-auto px-6 py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold transition-all shadow-sm disabled:opacity-50 flex justify-center items-center gap-2">
                                    {setupLoading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : "Confirm Execution"}
                                </button>
                                <button onClick={() => { setIsConfirmingSetup(false); setSetupTimer(0); }} className="w-full sm:w-auto px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition-all disabled:opacity-50">
                                    Cancel
                                </button>
                            </div>
                        ) : (
                            <button onClick={() => { setIsConfirmingSetup(true); setSetupTimer(5); }} disabled={!setupFile || readOnly} title={readOnly ? READ_ONLY_TITLE : undefined} className="w-full sm:w-auto px-6 py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold transition-all shadow-sm disabled:opacity-50 focus:ring-4 focus:ring-rose-100">
                                Execute Setup
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* ─── VIEW PROFILE MODAL ─── */}
            {viewModalUser && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-walnut-950/55 p-4">
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
                                            <div className="mt-1 flex flex-wrap items-center gap-1.5">
                                                <RoleChip role={viewModalUser.role} primary />
                                                {(extraRoles[viewModalUser.id] ?? []).map((r: string) => (
                                                    <RoleChip key={r} role={r} />
                                                ))}
                                            </div>
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

            {/* ─── ROLE EDITOR ─── */}
            <RoleManagerDialog
                // Keyed on the person: opening the sheet for someone else
                // starts it clean rather than showing the last person's roles
                // until the fetch lands.
                key={roleEditorUser?.id ?? "none"}
                user={roleEditorUser}
                open={roleEditorUser !== null}
                onOpenChange={(next) => { if (!next) setRoleEditorUser(null); }}
                canEditPrimary={isSuperAdmin}
                isSelf={roleEditorUser?.id === currentUser?.sub}
                readOnly={readOnly}
                onRolesChanged={(userId, secondary) =>
                    setExtraRoles(prev => ({ ...prev, [userId]: secondary }))
                }
                onPrimaryChanged={() => fetchUsers(page)}
            />

        </main>
    );
}
