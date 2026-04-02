"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { API_BASE_URL } from "@/lib/api";
import { setToken, setTokens } from "@/lib/auth";

type Step = "mobile" | "otp" | "students" | "details";

export default function RegisterParentPage() {
    const router = useRouter();

    const [step, setStep] = useState<Step>("mobile");

    // Step 1 — Mobile
    const [mobile, setMobile] = useState("");
    const [mobileCheck, setMobileCheck] = useState<{ status: "idle" | "checking" | "found" | "not_found"; students: any[] }>({ status: "idle", students: [] });
    const [sendingOtp, setSendingOtp] = useState(false);
    const [otpSendError, setOtpSendError] = useState("");

    // Step 2 — OTP
    const [otp, setOtp] = useState("");
    const [otpError, setOtpError] = useState("");
    const [verifying, setVerifying] = useState(false);
    const [countdown, setCountdown] = useState(0);

    // After OTP verified
    const [registrationToken, setRegistrationToken] = useState("");
    const [linkedStudents, setLinkedStudents] = useState<any[]>([]);

    // Step 4 — Details
    const [form, setForm] = useState({ firstName: "", lastName: "", email: "", password: "", confirmPassword: "", parentType: "", fatherAadhaarNumber: "", motherAadhaarNumber: "" });
    const [showPw, setShowPw] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState("");
    const [namesLocked, setNamesLocked] = useState(false);

    // Helper: Split name into First and Last according to logic
    const parseName = (fullName: string) => {
        if (!fullName) return { first: "", last: "" };
        const parts = fullName.trim().split(/\s+/);
        if (parts.length === 1) return { first: parts[0], last: "" };
        if (parts.length === 2) return { first: parts[0], last: parts[1] };
        // 3 or more words: First Name = word1 + word2, Last Name = rest
        const first = parts.slice(0, 2).join(' ');
        const last = parts.slice(2).join(' ');
        return { first, last };
    };

    const handleRoleSelection = (role: string) => {
        if (role === 'GUARDIAN') {
            setNamesLocked(false);
            setForm(prev => ({ ...prev, parentType: role, firstName: "", lastName: "" }));
            return;
        }

        // FATHER or MOTHER
        if (linkedStudents.length > 0) {
            const student = linkedStudents[0]; // Assuming we fetch from the first linked student
            let nameToParse = "";

            if (role === 'FATHER') {
                nameToParse = student.fathersName || "";
            } else if (role === 'MOTHER') {
                nameToParse = student.mothersName || "";
            }

            const { first, last } = parseName(nameToParse);

            setForm(prev => ({
                ...prev,
                parentType: role,
                firstName: first,
                lastName: last
            }));

            // Only lock names if we actually found a name to auto-fill
            if (first) {
                setNamesLocked(true);
            } else {
                setNamesLocked(false);
            }

        } else {
            setForm(prev => ({ ...prev, parentType: role }));
        }
    };

    // ── Debounced mobile check ──
    const checkMobile = useCallback(async (num: string) => {
        if (num.length < 10) { setMobileCheck({ status: "idle", students: [] }); return; }
        setMobileCheck({ status: "checking", students: [] });
        try {
            const res = await fetch(`${API_BASE_URL}/auth/parent/check-mobile?mobile=${encodeURIComponent(num)}`);
            const data = await res.json();
            setMobileCheck({ status: data.found ? "found" : "not_found", students: data.students || [] });
        } catch {
            setMobileCheck({ status: "idle", students: [] });
        }
    }, []);

    useEffect(() => {
        setOtpSendError("");
        const t = setTimeout(() => checkMobile(mobile), 500);
        return () => clearTimeout(t);
    }, [mobile, checkMobile]);

    // ── Countdown timer for OTP ──
    useEffect(() => {
        if (countdown <= 0) return;
        const t = setInterval(() => setCountdown(c => c - 1), 1000);
        return () => clearInterval(t);
    }, [countdown]);

    // ── Step 1: Send OTP ──
    const handleSendOtp = async () => {
        setSendingOtp(true);
        setOtpSendError("");
        try {
            const res = await fetch(`${API_BASE_URL}/auth/parent/request-otp`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ mobile }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || "Failed to send OTP");
            setStep("otp");
            setCountdown(600); // 10 min countdown display
        } catch (err: any) {
            setOtpSendError(err.message || "Failed to send OTP. Please try again.");
        } finally {
            setSendingOtp(false);
        }
    };

    // ── Step 2: Verify OTP ──
    const handleVerifyOtp = async (e: React.FormEvent) => {
        e.preventDefault();
        setOtpError("");
        setVerifying(true);
        try {
            const res = await fetch(`${API_BASE_URL}/auth/parent/verify-otp`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ mobile, otp }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || "Invalid OTP");
            setRegistrationToken(data.registrationToken);
            setLinkedStudents(data.students || []);
            setStep("students");
        } catch (err: any) {
            setOtpError(err.message || "Invalid OTP");
        } finally {
            setVerifying(false);
        }
    };

    // ── Step 4: Complete Registration ──
    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitError("");
        if (form.password !== form.confirmPassword) { setSubmitError("Passwords do not match"); return; }
        if (!form.parentType) { setSubmitError("Please select a registration role"); return; }
        setSubmitting(true);
        try {
            const res = await fetch(`${API_BASE_URL}/auth/parent/register`, {
                method: "POST",
                headers: { "Content-Type": "application/json", Authorization: `Bearer ${registrationToken}` },
                body: JSON.stringify({
                    firstName: form.firstName,
                    lastName: form.lastName,
                    email: form.email || undefined,
                    password: form.password,
                    parentType: form.parentType
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message || "Registration failed");
            setTokens(data.access_token, data.refresh_token);
            router.push("/parent-dashboard");
        } catch (err: any) {
            setSubmitError(err.message || "Registration failed");
            // If it's a duplicate role error, unlock fields to let them change it
            if (err.message && err.message.includes('already registered as')) {
                setNamesLocked(false);
            }
        } finally {
            setSubmitting(false);
        }
    };

    const avatarColors = ["from-violet-500 to-purple-600", "from-indigo-500 to-blue-600", "from-pink-500 to-rose-600", "from-emerald-500 to-teal-600"];

    return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                {/* Header */}
                <div className="flex flex-col items-center mb-8">
                    <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30 mb-4">
                        <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                        </svg>
                    </div>
                    <h1 className="text-white text-2xl font-bold">Register as Parent</h1>
                    <p className="text-slate-400 text-sm mt-1">Access your child&apos;s school information</p>
                </div>

                {/* Progress Steps */}
                <div className="flex items-center justify-center gap-2 mb-8">
                    {(["mobile", "otp", "students", "details"] as Step[]).map((s, i) => {
                        const stepIndex = ["mobile", "otp", "students", "details"].indexOf(step);
                        const thisIndex = i;
                        const done = thisIndex < stepIndex;
                        const active = thisIndex === stepIndex;
                        return (
                            <div key={s} className="flex items-center gap-2">
                                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${done ? "bg-green-500 text-white" : active ? "bg-indigo-600 text-white" : "bg-slate-800 text-slate-500"}`}>
                                    {done ? "✓" : i + 1}
                                </div>
                                {i < 3 && <div className={`w-8 h-0.5 ${done ? "bg-green-500" : "bg-slate-800"}`} />}
                            </div>
                        );
                    })}
                </div>

                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl">

                    {/* ─── STEP 1: Mobile ─── */}
                    {step === "mobile" && (
                        <div className="space-y-5">
                            <div>
                                <h2 className="text-white font-bold text-lg mb-1">Enter your mobile number</h2>
                                <p className="text-slate-400 text-sm">Use the number registered at school for your child</p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">Mobile Number</label>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                        <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                        </svg>
                                    </div>
                                    <input
                                        type="tel" value={mobile} onChange={e => setMobile(e.target.value.replace(/\D/, '').slice(0, 10))}
                                        maxLength={10} placeholder="9876543210"
                                        className="w-full bg-slate-800 border border-slate-700 text-white placeholder-slate-500 rounded-xl px-4 py-3 pl-10 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    />
                                    {mobileCheck.status === "checking" && (
                                        <div className="absolute inset-y-0 right-3 flex items-center">
                                            <svg className="animate-spin w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                                        </div>
                                    )}
                                </div>

                                {/* Feedback */}
                                {mobileCheck.status === "found" && (
                                    <div className="mt-2 flex items-center gap-2 text-green-400 text-sm">
                                        <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                        {mobileCheck.students.length} student{mobileCheck.students.length > 1 ? "s" : ""} found linked to this number
                                    </div>
                                )}
                                {mobileCheck.status === "not_found" && (
                                    <div className="mt-2 flex items-start gap-2 text-red-400 text-sm">
                                        <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                        <span>This number is not linked to any student. Please ask the school to update your mobile number in the student record first.</span>
                                    </div>
                                )}
                            </div>

                            {otpSendError && (
                                <div className="flex items-start gap-2 text-red-400 text-sm p-3 bg-red-500/10 border border-red-500/20 rounded-xl">
                                    <svg className="w-4 h-4 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                    <span>{otpSendError}</span>
                                </div>
                            )}

                            <button
                                onClick={handleSendOtp}
                                disabled={mobileCheck.status !== "found" || sendingOtp}
                                className="w-full py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                            >
                                {sendingOtp ? <><svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg> Sending...</> : "Send OTP via WhatsApp →"}
                            </button>
                        </div>
                    )}

                    {/* ─── STEP 2: OTP ─── */}
                    {step === "otp" && (
                        <form onSubmit={handleVerifyOtp} className="space-y-5">
                            <div>
                                <h2 className="text-white font-bold text-lg mb-1">Enter OTP</h2>
                                <p className="text-slate-400 text-sm">
                                    OTP sent to <span className="text-white font-medium">{mobile}</span>
                                </p>
                                <p className="text-slate-500 text-xs mt-1">
                                    {countdown > 0 ? `Expires in ${Math.floor(countdown / 60)}:${String(countdown % 60).padStart(2, "0")}` : "OTP expired"}
                                </p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-2">One-Time Password</label>
                                <input
                                    type="text" value={otp} onChange={e => setOtp(e.target.value.replace(/\D/, "").slice(0, 6))}
                                    placeholder="Enter OTP" maxLength={6} autoFocus
                                    className="w-full bg-slate-800 border border-slate-700 text-white placeholder-slate-500 rounded-xl px-4 py-3 text-2xl tracking-widest text-center font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                                {otpError && (
                                    <p className="mt-2 text-red-400 text-sm flex items-center gap-1">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                        {otpError}
                                    </p>
                                )}
                            </div>

                            <div className="flex gap-3">
                                <button type="button" onClick={() => setStep("mobile")} className="px-4 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm transition-colors">← Back</button>
                                <button type="submit" disabled={otp.length < 4 || verifying}
                                    className="flex-1 py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-40 transition-all flex items-center justify-center gap-2">
                                    {verifying ? <><svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg> Verifying...</> : "Verify OTP"}
                                </button>
                            </div>
                            <button type="button" onClick={handleSendOtp} disabled={sendingOtp}
                                className="w-full text-center text-slate-500 hover:text-slate-300 text-sm transition-colors">
                                Didn&apos;t receive? Resend OTP
                            </button>
                        </form>
                    )}

                    {/* ─── STEP 3: Confirm Students ─── */}
                    {step === "students" && (
                        <div className="space-y-5">
                            <div>
                                <h2 className="text-white font-bold text-lg mb-1">
                                    {linkedStudents.length > 0 ? "Confirm your children" : "No students found"}
                                </h2>
                                <p className="text-slate-400 text-sm">
                                    {linkedStudents.length > 0
                                        ? "These students are linked to your mobile number"
                                        : "Your mobile is verified, but no active students are found"}
                                </p>
                            </div>

                            {linkedStudents.length > 0 ? (
                                <div className="space-y-2">
                                    {linkedStudents.map((s, i) => (
                                        <div key={s.id} className={`flex items-center gap-3 p-3 bg-gradient-to-r ${avatarColors[i % avatarColors.length]} rounded-xl bg-opacity-10`}>
                                            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${avatarColors[i % avatarColors.length]} flex items-center justify-center text-white text-sm font-bold`}>
                                                {s.firstName?.[0]}{s.lastName?.[0]}
                                            </div>
                                            <div>
                                                <p className="text-white font-semibold text-sm">{s.firstName} {s.lastName}</p>
                                                <p className="text-slate-400 text-xs">{s.className ? `Enrolled in ${s.className}${s.sectionName ? ` – ${s.sectionName}` : ""}` : "Details pending"}</p>
                                            </div>
                                            <svg className="w-5 h-5 text-green-400 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-300 text-sm">
                                    Contact the school to link students to your mobile number.
                                </div>
                            )}

                            <div className="flex gap-3">
                                <button onClick={() => setStep("otp")} className="px-4 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm transition-colors">← Back</button>
                                <button onClick={() => setStep("details")}
                                    className="flex-1 py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 transition-all">
                                    {linkedStudents.length > 0 ? "Looks Good, Continue →" : "Continue Anyway →"}
                                </button>
                            </div>
                        </div>
                    )}

                    {/* ─── STEP 4: Fill Details ─── */}
                    {step === "details" && (
                        <form onSubmit={handleRegister} className="space-y-4">
                            <div>
                                <h2 className="text-white font-bold text-lg mb-1">Create your account</h2>
                                <p className="text-slate-400 text-sm">Almost done! Fill in your details.</p>
                            </div>

                            <div className="grid grid-cols-2 gap-3 mb-4">
                                <div className="col-span-2">
                                    <label className="block text-sm font-medium text-slate-300 mb-1">Register As <span className="text-red-500">*</span></label>
                                    <select
                                        value={form.parentType}
                                        onChange={e => handleRoleSelection(e.target.value)}
                                        required
                                        className="w-full bg-slate-800 border border-slate-700 text-white placeholder-slate-500 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    >
                                        <option value="" disabled>Select Role</option>
                                        <option value="FATHER">Father</option>
                                        <option value="MOTHER">Mother</option>
                                        <option value="GUARDIAN">Guardian</option>
                                    </select>
                                    {namesLocked && <p className="text-xs text-green-400 mt-1">Name auto-filled from student records.</p>}
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-1">First Name <span className="text-red-500">*</span></label>
                                    <input value={form.firstName} onChange={e => setForm({ ...form, firstName: e.target.value })} disabled={namesLocked} required placeholder="Raj"
                                        className="w-full bg-slate-800 border border-slate-700 text-white placeholder-slate-500 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-300 mb-1">Last Name</label>
                                    <input value={form.lastName} onChange={e => setForm({ ...form, lastName: e.target.value })} disabled={namesLocked} placeholder="Patel"
                                        className="w-full bg-slate-800 border border-slate-700 text-white placeholder-slate-500 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50" />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-1">Email (optional)</label>
                                <input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="raj@example.com"
                                    className="w-full bg-slate-800 border border-slate-700 text-white placeholder-slate-500 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-1">Password <span className="text-red-500">*</span></label>
                                <div className="relative">
                                    <input type={showPw ? "text" : "password"} value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required minLength={6} placeholder="Min. 6 characters"
                                        className="w-full bg-slate-800 border border-slate-700 text-white placeholder-slate-500 rounded-xl px-3 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                                    <button type="button" onClick={() => setShowPw(!showPw)} className="absolute inset-y-0 right-3 flex items-center text-slate-500 hover:text-slate-300">
                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={showPw ? "M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" : "M15 12a3 3 0 11-6 0 3 3 0 016 0zM2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"} /></svg>
                                    </button>
                                </div>
                                {/* Strength bar */}
                                {form.password && (
                                    <div className="flex gap-1 mt-1.5">
                                        {[1, 2, 3, 4].map(i => (
                                            <div key={i} className={`h-1 flex-1 rounded-full ${form.password.length >= i * 2 ? i <= 1 ? "bg-red-500" : i <= 2 ? "bg-yellow-500" : i <= 3 ? "bg-blue-500" : "bg-green-500" : "bg-slate-700"}`} />
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-300 mb-1">Confirm Password <span className="text-red-500">*</span></label>
                                <input type="password" value={form.confirmPassword} onChange={e => setForm({ ...form, confirmPassword: e.target.value })} required placeholder="Re-enter password"
                                    className={`w-full bg-slate-800 border text-white placeholder-slate-500 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:border-transparent transition-all ${form.confirmPassword && form.confirmPassword !== form.password ? "border-red-500/70 focus:ring-red-500" : "border-slate-700 focus:ring-indigo-500"}`} />
                            </div>

                            {submitError && (
                                <div className="flex items-center gap-2 px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
                                    <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                    {submitError}
                                </div>
                            )}

                            <div className="flex gap-3">
                                <button type="button" onClick={() => setStep("students")} className="px-4 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-sm transition-colors">← Back</button>
                                <button type="submit" disabled={submitting}
                                    className="flex-1 py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50 transition-all flex items-center justify-center gap-2">
                                    {submitting ? <><svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg> Creating...</> : "✓ Create Account"}
                                </button>
                            </div>
                        </form>
                    )}
                </div>

                <p className="text-center text-slate-600 text-sm mt-6">
                    Already have an account?{" "}
                    <Link href="/" className="text-indigo-400 hover:text-indigo-300 font-medium transition-colors">Sign In</Link>
                </p>
            </div>
        </div>
    );
}
