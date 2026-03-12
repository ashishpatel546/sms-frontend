"use client";

import { useState, useEffect, useCallback } from "react";
import { getUser, getToken, getRefreshToken, setTokens, removeToken, authFetch } from "@/lib/auth";
import { API_BASE_URL } from "@/lib/api";

type Session = {
    id: string;
    deviceInfo: string;
    ipAddress: string;
    lastActive: string;
    expiresAt: string;
    isCurrent?: boolean;
};

export default function ProfilePage() {
    const [user, setUser] = useState<any>(null);
    const [activeTab, setActiveTab] = useState<"general" | "security">("general");

    // Session State
    const [sessions, setSessions] = useState<Session[]>([]);
    const [loadingSessions, setLoadingSessions] = useState(false);

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
        setLoadingSessions(true);
        try {
            const refresh = getRefreshToken();
            const res = await authFetch(`${API_BASE_URL}/auth/sessions?currentRefreshToken=${refresh || ''}`);
            if (res.ok) {
                const data = await res.json();
                setSessions(data);
            }
        } catch (err) {
            console.error("Failed to fetch sessions", err);
        } finally {
            setLoadingSessions(false);
        }
    }, []);

    // Fetch sessions when switching to security tab
    useEffect(() => {
        if (activeTab === "security") {
            fetchSessions();
        }
    }, [activeTab, fetchSessions]);

    // PWA fix: re-fetch when user returns to the tab/app from background
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
        try {
            const res = await authFetch(`${API_BASE_URL}/auth/logout-device/${sessionId}`, {
                method: "POST",
            });
            if (res.ok) {
                setSessions(sessions.filter(s => s.id !== sessionId));
            }
        } catch (err) {
            console.error(err);
        }
    };

    const handleLogoutAll = async () => {
        try {
            const res = await authFetch(`${API_BASE_URL}/auth/logout-all`, {
                method: "POST",
            });
            if (res.ok) {
                // Clear local tokens immediately so this device is logged out right away
                removeToken();
                window.location.href = "/";
            }
        } catch (err) {
            console.error(err);
        }
    };


    if (!user) return null;

    return (
        <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
            <h1 className="text-2xl font-bold text-slate-900 mb-6">My Profile</h1>

            {/* Tabs */}
            <div className="bg-slate-100 border border-slate-200 rounded-2xl p-1.5 flex gap-1.5 mb-6">
                <button
                    onClick={() => setActiveTab("general")}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-semibold transition-all duration-200 ${activeTab === "general"
                        ? "bg-white shadow text-indigo-600 border border-slate-200"
                        : "text-slate-500 hover:text-slate-700"
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
                        ? "bg-white shadow text-indigo-600 border border-slate-200"
                        : "text-slate-500 hover:text-slate-700"
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
                <div className="bg-white shadow rounded-xl p-6 border border-slate-100">
                    <div className="flex items-center gap-6 mb-8">
                        <div className="h-24 w-24 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-3xl font-bold shadow-lg">
                            {user.firstName[0]}{user.lastName[0]}
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold text-slate-900">{user.firstName} {user.lastName}</h2>
                            <p className="text-slate-500 font-medium">{user.role?.replace("_", " ")}</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-slate-500 mb-1">First Name</label>
                            <div className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 min-h-[44px]">
                                {user.firstName || '\u00A0'}
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-500 mb-1">Last Name</label>
                            <div className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-900 min-h-[44px]">
                                {user.lastName || '\u00A0'}
                            </div>
                        </div>
                        {user.email && (
                            <div className="sm:col-span-2">
                                <label className="block text-sm font-medium text-slate-500 mb-1">Email Address</label>
                                <div className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-900">
                                    {user.email}
                                </div>
                            </div>
                        )}
                        {user.mobile && (
                            <div className="sm:col-span-2">
                                <label className="block text-sm font-medium text-slate-500 mb-1">Mobile Number</label>
                                <div className="px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-900">
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
                    {/* Change Password Block */}
                    <div className="bg-white shadow rounded-xl p-6 border border-slate-100">
                        <h3 className="text-lg font-bold text-slate-900 mb-1">Change Password</h3>
                        <p className="text-sm text-slate-500 mb-6">Update your account password to stay secure.</p>

                        <form onSubmit={handleChangePassword} className="space-y-4 max-w-md">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1.5">Current Password</label>
                                <div className="relative">
                                    <input
                                        type={showCurrent ? "text" : "password"}
                                        value={currentPassword}
                                        onChange={e => setCurrentPassword(e.target.value)}
                                        required
                                        className="w-full bg-slate-50 border border-slate-300 text-slate-900 rounded-lg px-4 py-2 pr-10 focus:ring-2 focus:ring-indigo-500 outline-none"
                                    />
                                    <button type="button" onClick={() => setShowCurrent(!showCurrent)} className="absolute right-3 top-2.5 text-slate-400">
                                        👁️‍🗨️
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1.5">New Password</label>
                                <div className="relative">
                                    <input
                                        type={showNew ? "text" : "password"}
                                        value={newPassword}
                                        onChange={e => setNewPassword(e.target.value)}
                                        required minLength={6}
                                        className="w-full bg-slate-50 border border-slate-300 text-slate-900 rounded-lg px-4 py-2 pr-10 focus:ring-2 focus:ring-indigo-500 outline-none"
                                    />
                                    <button type="button" onClick={() => setShowNew(!showNew)} className="absolute right-3 top-2.5 text-slate-400">
                                        👁️‍🗨️
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1.5">Confirm Password</label>
                                <input
                                    type="password"
                                    value={confirmPassword}
                                    onChange={e => setConfirmPassword(e.target.value)}
                                    required
                                    className="w-full bg-slate-50 border border-slate-300 text-slate-900 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
                                />
                            </div>

                            {pwError && <div className="text-sm text-red-600 bg-red-50 p-3 rounded-lg border border-red-100">{pwError}</div>}
                            {pwSuccess && <div className="text-sm text-green-600 bg-green-50 p-3 rounded-lg border border-green-100">{pwSuccess}</div>}

                            <button
                                type="submit"
                                disabled={pwLoading}
                                className="px-5 py-2.5 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                            >
                                {pwLoading ? "Updating..." : "Update Password"}
                            </button>
                        </form>
                    </div>

                    {/* Active Sessions Block */}
                    <div className="bg-white shadow rounded-xl border border-slate-100 overflow-hidden">
                        <div className="p-6 border-b border-slate-100">
                            <h3 className="text-lg font-bold text-slate-900 mb-1">Active Sessions</h3>
                            <p className="text-sm text-slate-500">You're currently logged in on these devices. If you don't recognize a device, log out of it immediately.</p>
                        </div>

                        {loadingSessions ? (
                            <div className="p-6 text-center text-slate-500">Loading sessions...</div>
                        ) : (
                            <ul className="divide-y divide-slate-100">
                                {sessions.map((session) => {
                                    const isCurrent = !!session.isCurrent;
                                    return (
                                        <li key={session.id} className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/50 transition-colors">
                                            <div className="flex items-start gap-4">
                                                <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
                                                    {session.deviceInfo?.toLowerCase().includes("mobile") || session.deviceInfo?.toLowerCase().includes("android") || session.deviceInfo?.toLowerCase().includes("iphone") ? '📱' : '💻'}
                                                </div>
                                                <div>
                                                    <p className="font-semibold text-slate-900 flex items-center gap-2">
                                                        {session.deviceInfo || "Unknown Device"}
                                                        {isCurrent && <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-green-100 text-green-700 uppercase tracking-wide">Current</span>}
                                                    </p>
                                                    <div className="text-sm text-slate-500 mt-1 space-y-0.5">
                                                        <p>IP: {session.ipAddress || "Unknown"}</p>
                                                        <p>Last active: {new Date(session.lastActive).toLocaleString()}</p>
                                                    </div>
                                                </div>
                                            </div>
                                            {!isCurrent && (
                                                <button
                                                    onClick={() => handleLogoutDevice(session.id)}
                                                    className="px-4 py-2 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors whitespace-nowrap self-start sm:self-center"
                                                >
                                                    Log Out
                                                </button>
                                            )}
                                        </li>
                                    );
                                })}
                            </ul>
                        )}

                        <div className="p-6 bg-red-50/50 border-t border-red-100">
                            <h4 className="text-red-800 font-semibold mb-2">Logout capability</h4>
                            <p className="text-sm text-red-600/80 mb-4">
                                If you lost your device or notice suspicious activity, you can log out of all devices immediately. You will need to log back in on this device.
                            </p>
                            <button
                                onClick={handleLogoutAll}
                                className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors shadow-sm"
                            >
                                Log out of all devices
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
