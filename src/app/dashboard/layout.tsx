"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { getUser, logout, isAuthenticated, getDashboardRoute, getToken, setToken, setTokens, authFetch, resetRefreshState } from "@/lib/auth";
import { useRbac } from "@/lib/rbac";
import { API_BASE_URL } from "@/lib/api";
import { NotificationBell } from "@/components/NotificationBell";
import { useSchoolInfo } from "@/lib/useSchoolInfo";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const router = useRouter();
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [user, setUser] = useState<any>(null);
    const schoolInfo = useSchoolInfo();

    useEffect(() => {
        const u = getUser();
        if (!u) { router.replace("/"); return; }
        if (u.mustChangePassword) { router.replace("/change-password"); return; }
        if (u.role === "PARENT") { router.replace("/parent-dashboard"); return; }
        setUser(u);
    }, [router]);

    // When the PWA returns from background, reset any stuck refresh state
    useEffect(() => {
        const handleVisibility = () => {
            if (document.visibilityState === 'visible') resetRefreshState();
        };
        document.addEventListener('visibilitychange', handleVisibility);
        return () => document.removeEventListener('visibilitychange', handleVisibility);
    }, []);

    // Close sidebar when route changes
    useEffect(() => { setIsSidebarOpen(false); }, [pathname]);

    const isActive = (path: string) => {
        if (path === '/dashboard') return pathname === '/dashboard';
        return pathname === path || pathname.startsWith(`${path}/`);
    };

    const getLinkClass = (path: string) => {
        const base = "flex items-center p-2 rounded-lg group transition-colors";
        return isActive(path) ? `${base} bg-blue-100 text-blue-700` : `${base} text-gray-900 hover:bg-gray-100`;
    };

    const isAdmin = user && ["SUPER_ADMIN", "ADMIN"].includes(user.role);
    const isSuperAdmin = user?.role === "SUPER_ADMIN";
    const rbac = useRbac();

    const handleLogout = () => { logout(); };



    if (!user) return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
    );

    return (
        <div className="min-h-screen bg-slate-50">
            <nav className="bg-white border-b border-slate-200 px-4 py-2.5 fixed left-0 right-0 top-0 z-50">
                <div className="flex justify-between items-center w-full">
                    <div className="flex items-center">
                        <button
                            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                            className="p-2 mr-2 text-gray-600 rounded-lg cursor-pointer sm:hidden hover:text-gray-900 hover:bg-gray-100"
                        >
                            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                            </svg>
                        </button>
                        <span className="self-center text-lg sm:text-xl font-semibold whitespace-nowrap text-slate-900 truncate max-w-[140px] xs:max-w-xs sm:max-w-none">
                            {schoolInfo?.name || 'School'} <span className="hidden sm:inline">Dashboard</span>
                        </span>
                    </div>
                    <div className="flex items-center gap-3 lg:order-2">
                        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-lg">
                            <div className="w-6 h-6 rounded-full bg-linear-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold">
                                {user.firstName?.[0]}{user.lastName?.[0]}
                            </div>
                            <span className="text-slate-700 text-sm font-medium">{user.firstName} {user.lastName}</span>
                            <span className="text-xs text-slate-400 border-l border-slate-300 pl-2">{user.role?.replace("_", " ")}</span>
                        </div>
                        {/* Notification Bell */}
                        <NotificationBell variant="light" />
                        {/* Profile Button */}
                        <Link
                            href="/dashboard/profile"
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all text-sm ${pathname === '/dashboard/profile' ? 'bg-slate-100 text-slate-900' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'}`}
                            title="My Profile"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span className="hidden sm:block font-medium">Profile</span>
                        </Link>
                        <button
                            onClick={handleLogout}
                            title="Logout"
                            className="flex items-center gap-1.5 px-3 py-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-all text-sm"
                        >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                            </svg>
                            <span className="hidden sm:block font-medium">Logout</span>
                        </button>
                    </div>
                </div>
            </nav>

            <div className="flex pt-16 overflow-hidden bg-gray-50">
                {isSidebarOpen && (
                    <div className="fixed inset-0 z-30 bg-gray-900/50 sm:hidden" onClick={() => setIsSidebarOpen(false)} />
                )}

                <aside className={`fixed top-0 left-0 z-40 w-64 h-dvh pt-20 transition-transform bg-white border-r border-gray-200 sm:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                    <div className="h-full px-3 pb-6 overflow-y-auto bg-white">
                        <ul className="space-y-2 font-medium">
                            <li><Link href="/dashboard" className={getLinkClass("/dashboard")}><span className="ml-3">🏠 Dashboard</span></Link></li>
                            <li><Link href="/dashboard/notifications" className={getLinkClass("/dashboard/notifications")}><span className="ml-3">🔔 Notifications</span></Link></li>
                            <li><Link href="/dashboard/students" className={getLinkClass("/dashboard/students")}><span className="ml-3">👨‍🎓 Students</span></Link></li>
                            <li><Link href="/dashboard/staff" className={getLinkClass("/dashboard/staff")}><span className="ml-3">👩‍🏫 Staff</span></Link></li>
                            <li><Link href="/dashboard/subjects" className={getLinkClass("/dashboard/subjects")}><span className="ml-3">📚 Subjects</span></Link></li>
                            <li><Link href="/dashboard/classes" className={getLinkClass("/dashboard/classes")}><span className="ml-3">🏫 Classes</span></Link></li>
                            {rbac.canManageEnrollments && (
                                <li><Link href="/dashboard/enrollment" className={getLinkClass("/dashboard/enrollment")}><span className="ml-3">📋 Enrollment</span></Link></li>
                            )}
                            <li><Link href="/dashboard/attendance" className={getLinkClass("/dashboard/attendance")}><span className="ml-3">📅 Attendance</span></Link></li>
                            {rbac.canAccessFees && (
                                <li><Link href="/dashboard/fees" className={getLinkClass("/dashboard/fees")}><span className="ml-3">💰 Fees</span></Link></li>
                            )}
                            <li><Link href="/dashboard/examinations" className={getLinkClass("/dashboard/examinations")}><span className="ml-3">📝 Examinations</span></Link></li>
                            <li><Link href="/dashboard/homework" className={getLinkClass("/dashboard/homework")}><span className="ml-3">📚 Homework</span></Link></li>
                            <li>
                                <p className="px-2 pt-3 pb-1 text-xs font-semibold text-slate-400 uppercase tracking-wider">Pickup</p>
                                <ul className="space-y-1">
                                    <li><Link href="/dashboard/pickup/scan" className={getLinkClass("/dashboard/pickup/scan")}><span className="ml-3">📷 Scan QR</span></Link></li>
                                    <li><Link href="/dashboard/pickup/history" className={getLinkClass("/dashboard/pickup/history")}><span className="ml-3">📋 Pickup History</span></Link></li>
                                </ul>
                            </li>
                            {rbac.isAdmin && (
                                <li><Link href="/dashboard/reports" className={getLinkClass("/dashboard/reports")}><span className="ml-3">📊 Reports</span></Link></li>
                            )}
                            {rbac.canAccessAdminPanel && (
                                <>
                                    <li className="pt-4 border-t border-gray-200">
                                        <p className="px-2 pb-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">Administration</p>
                                    </li>
                                    <li><Link href="/dashboard/admin" className={getLinkClass("/dashboard/admin")}><span className="ml-3">🛡️ {rbac.isSuperAdmin ? "Super Admin Panel" : "Admin Panel"}</span></Link></li>
                                </>
                            )}
                            <li className="pt-4 mt-4 space-y-2 border-t border-gray-200">
                                <Link href="/dashboard/support" className={getLinkClass("/dashboard/support")}><span className="ml-3">❓ Help / Support</span></Link>
                                <Link href="/dashboard/settings" className={getLinkClass("/dashboard/settings")}><span className="ml-3">⚙️ Settings</span></Link>
                            </li>
                        </ul>
                    </div>
                </aside>

                <div id="main-content" className="relative w-full h-full overflow-y-auto bg-gray-50 sm:ml-64">
                    {children}
                </div>
            </div>
        </div>
    );
}
