"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { getUser, getRefreshToken, setTokens, removeToken, authFetch } from "@/lib/auth";
import { API_BASE_URL } from "@/lib/api";

type Session = {
    id: string;
    deviceInfo: string;
    ipAddress: string;
    lastActive: string;
    expiresAt: string;
    isCurrent?: boolean;
};

export default function ParentProfilePage() {
    const [user, setUser] = useState<any>(null);
    const [activeTab, setActiveTab] = useState<"general" | "security">("general");

    // Session State
    const [sessions, setSessions] = useState<Session[]>([]);
    const [loadingSessions, setLoadingSessions] = useState(false);
    const [sessionError, setSessionError] = useState("");
    const [logoutError, setLogoutError] = useState("");
    const [logoutingDevices, setLogoutingDevices] = useState<Set<string>>(new Set());
    const [logoutingAll, setLogoutingAll] = useState(false);
    // Ref held across renders so we can abort stale fetchSessions calls
    const fetchAbortRef = useRef<AbortController | null>(null);

    // Password State
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [pwLoading, setPwLoading] = useState(false);
    const [pwError, setPwError] = useState("");
    const [pwSuccess, setPwSuccess] = useState("");
    const [showCurrent, setShowCurrent] = useState(false);
    const [showNew, setShowNew] = useState(false);

    useEffect(() => {
        const u = getUser();
        if (u) setUser(u);
    }, []);

    const fetchSessions = useCallback(async () => {
        // Abort any in-flight request before starting a new one
        fetchAbortRef.current?.abort();
        fetchAbortRef.current = new AbortController();
        const signal = fetchAbortRef.current.signal;

        setLoadingSessions(true);
        setSessionError("");
        try {
            const refresh = getRefreshToken();
            const res = await authFetch(
                `${API_BASE_URL}/auth/sessions?currentRefreshToken=${refresh || ''}`,
                { signal } as RequestInit,
            );
            if (signal.aborted) return;
            if (res.ok) {
                const data = await res.json();
                setSessions(data);
            } else {
                setSessionError("Failed to load sessions. Pull down to retry.");
            }
        } catch (err: any) {
            if (err?.name === 'AbortError') return;
            console.error("Failed to fetch sessions", err);
            setSessionError("Failed to load sessions. Pull down to retry.");
        } finally {
            if (!signal.aborted) setLoadingSessions(false);
        }
    }, []);

    // Fetch sessions when switching to security tab
    useEffect(() => {
        if (activeTab === "security") {
            fetchSessions();
        }
    }, [activeTab, fetchSessions]);

    // PWA fix: re-fetch sessions when user returns to the tab/app from background
    useEffect(() => {
        if (activeTab !== "security") return;
        const handleVisibility = () => {
            if (document.visibilityState === "visible") {
                fetchSessions();
            }
        };
        document.addEventListener("visibilitychange", handleVisibility);
        return () => document.removeEventListener("visibilitychange", handleVisibility);
    }, [activeTab, fetchSessions]);

    const handleChangePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setPwError("");
        setPwSuccess("");

        if (newPassword !== confirmPassword) {
            setPwError("New passwords do not match");
            return;
        }
        if (newPassword.length < 6) {
            setPwError("Password must be at least 6 characters");
            return;
        }
        if (newPassword === currentPassword) {
            setPwError("New password must be different from current password");
            return;
        }

        setPwLoading(true);
        try {
            const res = await authFetch(`${API_BASE_URL}/auth/change-password`, {
                method: "POST",
                body: JSON.stringify({ currentPassword, newPassword }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || "Failed to change password");

            if (data.refresh_token) {
                setTokens(data.access_token, data.refresh_token);
            }

            setPwSuccess("Password changed successfully!");
            setCurrentPassword("");
            setNewPassword("");
            setConfirmPassword("");
        } catch (err: any) {
            setPwError(err.message || "Failed to change password");
        } finally {
            setPwLoading(false);
        }
    };

    const handleLogoutDevice = async (sessionId: string) => {
        setLogoutError("");
        setLogoutingDevices(prev => new Set(prev).add(sessionId));
        try {
            const res = await authFetch(`${API_BASE_URL}/auth/logout-device/${sessionId}`, {
                method: "POST",
            });
            if (res.ok) {
                setSessions(prev => prev.filter(s => s.id !== sessionId));
            } else {
                const data = await res.json().catch(() => ({}));
                setLogoutError(data.message || "Failed to log out device. Please try again.");
            }
        } catch (err: any) {
            setLogoutError("Network error. Please check your connection and try again.");
        } finally {
            setLogoutingDevices(prev => { const s = new Set(prev); s.delete(sessionId); return s; });
        }
    };

    const handleLogoutAll = async () => {
        setLogoutError("");
        setLogoutingAll(true);
        try {
            const res = await authFetch(`${API_BASE_URL}/auth/logout-all`, {
                method: "POST",
            });
            if (res.ok) {
                // Clear local tokens immediately so this device is logged out right away
                removeToken();
                window.location.href = "/";
            } else {
                const data = await res.json().catch(() => ({}));
                setLogoutError(data.message || "Failed to log out of all devices. Please try again.");
                setLogoutingAll(false);
            }
        } catch (err: any) {
            setLogoutError("Network error. Please check your connection and try again.");
            setLogoutingAll(false);
        }
    };

    if (!user) return null;

    return (
        <div className="max-w-4xl mx-auto">
            <h1 className="text-2xl font-bold text-white mb-6">Account Settings</h1>

            {/* Tabs */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-1.5 flex gap-1.5 mb-6">
                <button
                    onClick={() => setActiveTab("general")}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-semibold transition-all duration-200 ${activeTab === "general"
                        ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-500/20"
                        : "text-slate-500 hover:text-slate-300"
                    }`}
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    General Information
                </button>
                <button
                    onClick={() => setActiveTab("security")}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-semibold transition-all duration-200 ${activeTab === "security"
                        ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-500/20"
                        : "text-slate-500 hover:text-slate-300"
                    }`}
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    Security &amp; Login
                </button>
            </div>

            {/* General Tab */}
            {activeTab === "general" && (
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                    <div className="flex items-center gap-5 mb-8">
                        <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-3xl font-bold shadow-lg shadow-indigo-500/20 flex-shrink-0">
                            {user.firstName[0]}{user.lastName[0]}
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white">{user.firstName} {user.lastName}</h2>
                            <p className="text-slate-400 text-sm mt-0.5">Linked Parent Account</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                        <div>
                            <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1.5">First Name</label>
                            <div className="px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white min-h-11">
                                {user.firstName || '\u00A0'}
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1.5">Last Name</label>
                            <div className="px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white min-h-11">
                                {user.lastName || '\u00A0'}
                            </div>
                        </div>
                        {user.mobile && (
                            <div className="sm:col-span-2">
                                <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-1.5">Registered Mobile Number</label>
                                <div className="px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white">
                                    +91 {user.mobile}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Security Tab */}
            {activeTab === "security" && (
                <div className="space-y-6">
                    {/* Change Password */}
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                        <h3 className="text-lg font-bold text-white mb-1">Change Password</h3>
                        <p className="text-sm text-slate-400 mb-6">Update your account password to stay secure.</p>

                        <form onSubmit={handleChangePassword} className="space-y-4 max-w-md">
                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-1.5">Current Password</label>
                                <div className="relative">
                                    <input
                                        type={showCurrent ? "text" : "password"}
                                        value={currentPassword}
                                        onChange={e => setCurrentPassword(e.target.value)}
                                        required
                                        className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-4 py-2.5 pr-10 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none placeholder-slate-500 transition-colors"
                                        placeholder="••••••••"
                                    />
                                    <button type="button" onClick={() => setShowCurrent(!showCurrent)} className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-300 transition-colors">
                                        👁️‍🗨️
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-1.5">New Password</label>
                                <div className="relative">
                                    <input
                                        type={showNew ? "text" : "password"}
                                        value={newPassword}
                                        onChange={e => setNewPassword(e.target.value)}
                                        required minLength={6}
                                        className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-4 py-2.5 pr-10 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none placeholder-slate-500 transition-colors"
                                        placeholder="Min. 6 characters"
                                    />
                                    <button type="button" onClick={() => setShowNew(!showNew)} className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-300 transition-colors">
                                        👁️‍🗨️
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-400 mb-1.5">Confirm Password</label>
                                <input
                                    type="password"
                                    value={confirmPassword}
                                    onChange={e => setConfirmPassword(e.target.value)}
                                    required
                                    className="w-full bg-slate-800 border border-slate-700 text-white rounded-lg px-4 py-2.5 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none placeholder-slate-500 transition-colors"
                                    placeholder="Re-enter password"
                                />
                            </div>

                            {pwError && (
                                <div className="flex items-start gap-2.5 text-sm text-red-400 bg-red-500/10 p-3 rounded-lg border border-red-500/30">
                                    <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                    {pwError}
                                </div>
                            )}
                            {pwSuccess && (
                                <div className="flex items-start gap-2.5 text-sm text-green-400 bg-green-500/10 p-3 rounded-lg border border-green-500/30">
                                    <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                    {pwSuccess}
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={pwLoading}
                                className="px-5 py-2.5 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-500 disabled:opacity-50 transition-colors"
                            >
                                {pwLoading ? "Updating…" : "Update Password"}
                            </button>
                        </form>
                    </div>

                    {/* Active Sessions Block */}
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
                        <div className="p-6 border-b border-slate-800">
                            <h3 className="text-lg font-bold text-white mb-1">Active Sessions</h3>
                            <p className="text-sm text-slate-400">You&apos;re currently logged in on these devices. If you don&apos;t recognize a device, log out of it immediately.</p>
                        </div>

                        {loadingSessions ? (
                            <div className="p-8 flex flex-col items-center gap-3">
                                <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                                <p className="text-sm text-slate-500">Loading sessions…</p>
                            </div>
                        ) : sessionError ? (
                            <div className="p-8 text-center">
                                <div className="w-10 h-10 mx-auto mb-3 rounded-full bg-red-500/10 flex items-center justify-center">
                                    <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                </div>
                                <p className="text-sm text-red-400 mb-4">{sessionError}</p>
                                <button onClick={fetchSessions} className="px-4 py-2 text-sm font-medium text-indigo-400 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 rounded-lg transition-colors">
                                    Retry
                                </button>
                            </div>
                        ) : sessions.length === 0 ? (
                            <div className="p-8 text-center text-slate-500 text-sm">No active sessions found.</div>
                        ) : (
                            <ul className="divide-y divide-slate-800">
                                {sessions.map((session) => {
                                    const isCurrent = !!session.isCurrent;
                                    const isLoggingOut = logoutingDevices.has(session.id);
                                    return (
                                        <li key={session.id} className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-800/40 transition-colors">
                                            <div className="flex items-start gap-4">
                                                <div className="p-2.5 bg-indigo-500/10 text-indigo-400 rounded-xl text-lg flex-shrink-0">
                                                    {session.deviceInfo?.toLowerCase().includes("mobile") || session.deviceInfo?.toLowerCase().includes("android") || session.deviceInfo?.toLowerCase().includes("iphone") ? '📱' : '💻'}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="font-semibold text-white flex flex-wrap items-center gap-2">
                                                        <span className="truncate">{session.deviceInfo || "Unknown Device"}</span>
                                                        {isCurrent && (
                                                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-green-500/20 text-green-400 border border-green-500/30 uppercase tracking-wide flex-shrink-0">
                                                                Current
                                                            </span>
                                                        )}
                                                    </p>
                                                    <div className="text-xs text-slate-500 mt-1 space-y-0.5">
                                                        <p>IP: {session.ipAddress || "Unknown"}</p>
                                                        <p>Last active: {new Date(session.lastActive).toLocaleString()}</p>
                                                    </div>
                                                </div>
                                            </div>
                                            {!isCurrent && (
                                                <button
                                                    onClick={() => handleLogoutDevice(session.id)}
                                                    disabled={isLoggingOut}
                                                    className="px-4 py-2 text-sm font-medium text-red-400 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap self-start sm:self-center flex-shrink-0"
                                                >
                                                    {isLoggingOut ? "Logging out…" : "Log Out"}
                                                </button>
                                            )}
                                        </li>
                                    );
                                })}
                            </ul>
                        )}

                        <div className="p-6 bg-slate-800/50 border-t border-slate-800">
                            <h4 className="text-white font-semibold mb-1">Log out of all devices</h4>
                            <p className="text-sm text-slate-400 mb-4">
                                If you lost your device or notice suspicious activity, you can log out everywhere immediately. You will need to log back in on this device.
                            </p>
                            {logoutError && (
                                <div className="flex items-start gap-2.5 mb-4 text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                                    <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                    {logoutError}
                                </div>
                            )}
                            <button
                                onClick={handleLogoutAll}
                                disabled={logoutingAll}
                                className="px-5 py-2.5 bg-red-600 text-white font-medium rounded-lg hover:bg-red-500 disabled:opacity-50 transition-colors"
                            >
                                {logoutingAll ? "Logging out…" : "Log out of all devices"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
