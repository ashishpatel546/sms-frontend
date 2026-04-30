"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { API_BASE_URL } from "@/lib/api";
import { getToken, setToken, setTokens, getUser, removeToken, authFetch, isMustChangePasswordFlow } from "@/lib/auth";

function EyeIcon({ open }: { open: boolean }) {
    return open ? (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
        </svg>
    ) : (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
        </svg>
    );
}

function strengthLabel(score: number): { label: string; color: string; bars: number } {
    if (score <= 1) return { label: "Weak",   color: "bg-red-500",    bars: 1 };
    if (score <= 2) return { label: "Fair",   color: "bg-amber-500",  bars: 2 };
    if (score <= 3) return { label: "Good",   color: "bg-yellow-400", bars: 3 };
    if (score <= 4) return { label: "Strong", color: "bg-emerald-500",bars: 4 };
    return              { label: "Very Strong", color: "bg-emerald-400", bars: 5 };
}

export default function ChangePasswordPage() {
    const router = useRouter();
    const [form, setForm] = useState({ current: "", newPw: "", confirm: "" });
    const [show, setShow] = useState({ current: false, newPw: false, confirm: false });
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");
    const [user, setUser] = useState<any>(null);

    useEffect(() => {
        const u = getUser();
        if (!u) { router.replace("/"); return; }
        if (!u.mustChangePassword) {
            router.replace(u.role === "PARENT" ? "/parent-dashboard" : "/dashboard");
            return;
        }
        if (!isMustChangePasswordFlow()) { removeToken(); router.replace("/"); return; }
        setUser(u);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
        setForm(f => ({ ...f, [k]: e.target.value }));

    const toggleShow = (k: keyof typeof show) =>
        setShow(s => ({ ...s, [k]: !s[k] }));

    const strengthScore = useMemo(() => {
        const p = form.newPw;
        if (!p) return 0;
        let s = 0;
        if (p.length >= 8)  s++;
        if (p.length >= 12) s++;
        if (/[A-Z]/.test(p)) s++;
        if (/[0-9]/.test(p)) s++;
        if (/[^A-Za-z0-9]/.test(p)) s++;
        return s;
    }, [form.newPw]);

    const confirmMatch = form.confirm.length > 0 && form.newPw === form.confirm;
    const confirmMismatch = form.confirm.length > 0 && form.newPw !== form.confirm;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        if (form.newPw !== form.confirm) { setError("New passwords do not match"); return; }
        if (form.newPw.length < 6) { setError("Password must be at least 6 characters"); return; }
        if (form.newPw === form.current) { setError("New password must differ from current password"); return; }

        setIsLoading(true);
        try {
            const res = await authFetch(`${API_BASE_URL}/auth/change-password`, {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
                body: JSON.stringify({ currentPassword: form.current, newPassword: form.newPw }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || "Failed to change password");
            // Clear fields before navigation to prevent browser password-save prompt
            setForm({ current: "", newPw: "", confirm: "" });
            if (data.refresh_token) setTokens(data.access_token, data.refresh_token);
            else setToken(data.access_token);
            const updated = getUser();
            router.push(updated?.role === "PARENT" ? "/parent-dashboard" : "/dashboard");
        } catch (err: any) {
            setError(err.message || "Failed to change password");
        } finally {
            setIsLoading(false);
        }
    };

    if (!user) return null;

    const str = form.newPw ? strengthLabel(strengthScore) : null;

    return (
        <div className="min-h-screen bg-linear-to-br from-slate-950 via-slate-900 to-indigo-950 flex items-center justify-center px-4 py-12">
            <div className="w-full max-w-md">

                {/* Icon + heading */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-linear-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-500/30 mb-5">
                        <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" strokeWidth={1.75} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                        </svg>
                    </div>
                    <h1 className="text-2xl font-bold text-white tracking-tight">Create your password</h1>
                    <p className="text-slate-400 text-sm mt-2">
                        Welcome, <span className="text-indigo-400 font-semibold">{user.firstName}</span>. Set a new password to get started.
                    </p>
                </div>

                {/* Card */}
                <div className="bg-slate-900/70 backdrop-blur-md border border-slate-700/50 rounded-3xl p-7 shadow-2xl shadow-slate-950/60">
                    {/* autoComplete="off" prevents browser from showing its native save-password popup */}
                    <form onSubmit={handleSubmit} autoComplete="off" className="space-y-5">

                        {/* Current password */}
                        <div>
                            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Current Password</label>
                            <div className="relative">
                                <input
                                    type={show.current ? "text" : "password"}
                                    value={form.current}
                                    onChange={set("current")}
                                    required
                                    autoComplete="off"
                                    data-lpignore="true"
                                    data-form-type="other"
                                    placeholder="Enter your current password"
                                    className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-4 py-3 pr-11 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/70 focus:border-indigo-500/50 transition-all"
                                />
                                <button type="button" onClick={() => toggleShow("current")}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors p-0.5">
                                    <EyeIcon open={show.current} />
                                </button>
                            </div>
                        </div>

                        {/* Divider */}
                        <div className="border-t border-slate-800" />

                        {/* New password */}
                        <div>
                            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">New Password</label>
                            <div className="relative">
                                <input
                                    type={show.newPw ? "text" : "password"}
                                    value={form.newPw}
                                    onChange={set("newPw")}
                                    required
                                    autoComplete="off"
                                    data-lpignore="true"
                                    data-form-type="other"
                                    placeholder="Create a strong password"
                                    className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-4 py-3 pr-11 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/70 focus:border-indigo-500/50 transition-all"
                                />
                                <button type="button" onClick={() => toggleShow("newPw")}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors p-0.5">
                                    <EyeIcon open={show.newPw} />
                                </button>
                            </div>
                            {/* Strength meter */}
                            {str && (
                                <div className="mt-2.5">
                                    <div className="flex gap-1 mb-1.5">
                                        {[1,2,3,4,5].map(i => (
                                            <div key={i} className={`h-1 flex-1 rounded-full transition-all duration-300 ${i <= str.bars ? str.color : "bg-slate-700"}`} />
                                        ))}
                                    </div>
                                    <p className={`text-xs font-medium ${str.bars >= 4 ? "text-emerald-400" : str.bars >= 3 ? "text-yellow-400" : str.bars >= 2 ? "text-amber-400" : "text-red-400"}`}>
                                        {str.label}
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Confirm password */}
                        <div>
                            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Confirm New Password</label>
                            <div className="relative">
                                <input
                                    type={show.confirm ? "text" : "password"}
                                    value={form.confirm}
                                    onChange={set("confirm")}
                                    required
                                    autoComplete="off"
                                    data-lpignore="true"
                                    data-form-type="other"
                                    placeholder="Re-enter your new password"
                                    className={`w-full bg-slate-800/80 border rounded-xl px-4 py-3 pr-11 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 transition-all ${
                                        confirmMatch    ? "border-emerald-500/60 focus:ring-emerald-500/40" :
                                        confirmMismatch ? "border-red-500/60 focus:ring-red-500/40" :
                                                          "border-slate-700 focus:ring-indigo-500/70 focus:border-indigo-500/50"
                                    }`}
                                />
                                <button type="button" onClick={() => toggleShow("confirm")}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors p-0.5">
                                    <EyeIcon open={show.confirm} />
                                </button>
                                {confirmMatch && (
                                    <div className="absolute right-10 top-1/2 -translate-y-1/2">
                                        <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                                        </svg>
                                    </div>
                                )}
                            </div>
                            {confirmMismatch && (
                                <p className="text-xs text-red-400 mt-1.5 flex items-center gap-1">
                                    <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                    Passwords don&apos;t match
                                </p>
                            )}
                        </div>

                        {/* Error */}
                        {error && (
                            <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/25 rounded-xl px-4 py-3">
                                <svg className="w-4 h-4 text-red-400 mt-0.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                                </svg>
                                <p className="text-sm text-red-300">{error}</p>
                            </div>
                        )}

                        {/* Submit */}
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="relative w-full bg-linear-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl py-3 text-sm transition-all shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 flex items-center justify-center gap-2"
                        >
                            {isLoading ? (
                                <>
                                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                    </svg>
                                    Saving…
                                </>
                            ) : (
                                <>
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                                    </svg>
                                    Set Password &amp; Continue
                                </>
                            )}
                        </button>
                    </form>
                </div>

                <p className="text-center mt-6">
                    <button
                        onClick={() => { removeToken(); router.push("/"); }}
                        className="text-sm text-slate-500 hover:text-slate-400 transition-colors inline-flex items-center gap-1.5"
                    >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                        </svg>
                        Back to Login
                    </button>
                </p>
            </div>
        </div>
    );
}
