"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { API_BASE_URL } from "@/lib/api";
import { setToken, setTokens, getDashboardRoute, getUser, authFetch, markMustChangePasswordFlow } from "@/lib/auth";
import SplashScreen from "@/components/SplashScreen";

type Tab = "parent" | "staff";

export default function LoginPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("staff");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showSplash, setShowSplash] = useState(false);

  // Parent form
  const [mobile, setMobile] = useState("");
  // Staff form
  const [emailPrefix, setEmailPrefix] = useState("");
  const [password, setPassword] = useState("");

  // Redirect if already logged in
  useEffect(() => {
    const user = getUser();
    if (user) {
      setShowSplash(true);
      setTimeout(() => {
        if (user.mustChangePassword) {
          markMustChangePasswordFlow();
          router.replace("/change-password");
        } else {
          router.replace(getDashboardRoute(user.role));
        }
      }, 1500);
    }
  }, [router]);

  const handleParentLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/auth/login/parent`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mobile, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Invalid mobile number or password");
      setTokens(data.access_token, data.refresh_token);
      setShowSplash(true);
      setTimeout(() => {
        if (data.user.mustChangePassword) {
          markMustChangePasswordFlow();
          router.push("/change-password");
        } else {
          router.push("/parent-dashboard");
        }
      }, 1500);
    } catch (err: any) {
      setError(err.message || "Invalid mobile number or password");
    } finally {
      setIsLoading(false);
    }
  };

  const handleStaffLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);
    try {
      const fullEmail = `${emailPrefix}@colegios.in`;
      const res = await fetch(`${API_BASE_URL}/auth/login/staff`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: fullEmail, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Invalid email or password");
      setTokens(data.access_token, data.refresh_token);
      setShowSplash(true);
      setTimeout(() => {
        if (data.user.mustChangePassword) {
          markMustChangePasswordFlow();
          router.push("/change-password");
        } else {
          router.push("/dashboard");
        }
      }, 1500);
    } catch (err: any) {
      setError(err.message || "Invalid email or password");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-950 selection:bg-indigo-500/30">
      {showSplash && <SplashScreen />}
      {/* Left — Branding Panel */}
      <div className="relative hidden md:flex md:w-1/2 flex-col justify-between p-12 overflow-hidden">
        {/* Background school image */}
        <div className="absolute inset-0"
          style={{ backgroundImage: 'url(/colegios-bg.png)', backgroundSize: 'cover', backgroundPosition: 'center' }}
        />
        {/* Gradient overlay on top of image - enhanced contrast for text */}
        <div className="absolute inset-0 bg-slate-950/60" />
        <div className="absolute inset-0 opacity-30"
          style={{
            backgroundImage: `radial-gradient(ellipse at 20% 50%, rgba(99,102,241,0.5) 0%, transparent 60%),
                                          radial-gradient(ellipse at 80% 20%, rgba(168,85,247,0.4) 0%, transparent 50%)`
          }}
        />
        {/* Floating orbs */}
        <div className="absolute top-1/4 right-1/4 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 left-1/4 w-48 h-48 bg-purple-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-3/4 right-1/3 w-32 h-32 bg-violet-400/10 rounded-full blur-2xl animate-pulse" style={{ animationDelay: '2s' }} />

        <div className="relative z-10">
          {/* Logo */}
          <div className="flex items-center gap-4 mb-14">
            <a href="https://colegios.in" target="_blank" rel="noopener noreferrer" className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center shadow-xl border border-white/20 p-2 hover:scale-105 transition-transform">
              <img src="/colegios/logo.png" alt="Colegios Logo" className="w-full h-full object-contain drop-shadow-md" />
            </a>
            <div className="flex flex-col">
              <a href="https://colegios.in" target="_blank" rel="noopener noreferrer" className="text-white font-extrabold text-4xl tracking-tight drop-shadow-md hover:text-indigo-200 transition-colors">
                Colegios
              </a>
              <a href="https://appme.in" target="_blank" rel="noopener noreferrer" className="text-indigo-100 text-sm font-bold tracking-widest drop-shadow-md mt-1 hover:text-white transition-colors">
                A Flagship Product of AppMe Soft Pvt Ltd.
              </a>
            </div>
          </div>

          {/* Headline */}
          <h1 className="text-white text-4xl lg:text-5xl font-extrabold leading-tight mb-8 drop-shadow-lg">
            Digitizing Schools<br />
            <span className="text-transparent bg-clip-text bg-linear-to-r from-indigo-300 to-purple-300 drop-shadow-sm">
              for the Future.
            </span>
          </h1>
          
          <div className="space-y-4 mb-8 p-6 rounded-2xl bg-slate-900/50 backdrop-blur-xl border border-white/10 shadow-2xl">
            <p className="text-white text-xl font-bold tracking-wide leading-relaxed">
              Colegios - The Smart Operating System for Modern Schools.
            </p>
            <p className="text-slate-200 text-base leading-relaxed max-w-md font-medium">
              Colegios is an all-in-one, feature-rich school management ecosystem. We are building a stronger, smarter future by bringing cutting-edge digital infrastructure straight to the roots of our education system.
            </p>
            <p className="text-white text-sm font-black flex items-center gap-2 uppercase tracking-wider pt-2">
              <svg className="w-5 h-5 text-indigo-400 drop-shadow-md" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Igniting a Digital Revolution in Education.
            </p>
          </div>
        </div>

        <div className="relative z-10">
          {/* Feature pills */}
          <div className="flex flex-wrap gap-3">
            {['📊 Report & Analytics', '📋 Attendance', '💰 Fee Management', '📝 Examinations', '👥 Parent Portal'].map(f => (
              <span key={f} className="px-4 py-2 cursor-pointer bg-white/10 hover:bg-white/20 hover:scale-105 hover:-translate-y-1 transition-all duration-300 backdrop-blur-md text-white font-medium text-sm rounded-xl border border-indigo-500/30 shadow-lg hover:shadow-indigo-500/40">
                {f}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Right — Login Panel */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-10 min-h-screen md:min-h-0">
        <div className="w-full max-w-md">
          {/* Mobile/tablet branding card — visible up to large screens (desktop uses left panel) */}
          <div className="lg:hidden relative w-full rounded-2xl overflow-hidden mb-7 shadow-2xl bg-linear-to-br from-slate-900 via-slate-950 to-slate-900 border border-white/10 p-5"
            style={{ animation: 'fade-in 0.55s ease-out forwards' }}
          >
            <div className="absolute inset-0 opacity-30 bg-linear-to-br from-indigo-500/20 via-purple-500/10 to-transparent" />
            <div className="relative flex items-center gap-3 mb-4">
              <div className="w-14 h-14 rounded-3xl bg-white/10 border border-white/10 backdrop-blur-md flex items-center justify-center shadow-lg">
                <img src="/colegios/logo.png" alt="Colegios Logo" className="w-10 h-10 object-contain" />
              </div>
              <div>
                <p className="text-white font-extrabold text-xl tracking-tight">Colegios</p>
                <p className="text-slate-300 text-xs uppercase tracking-[0.24em]">Smart Operating System For School</p>
              </div>
            </div>
            <div className="relative rounded-2xl bg-slate-950/60 border border-white/10 p-4 shadow-inner shadow-indigo-950/40 animate-[slide-up_0.75s_cubic-bezier(0.16,1,0.3,1)_0.1s_forwards]">
              <p className="text-slate-200 text-sm leading-relaxed">
                A smarter digital campus for modern schools.
              </p>
            </div>
          </div>

          <h2 className="text-white text-3xl font-bold mb-2">Welcome Back</h2>
          <p className="text-slate-500 mb-8">Sign in to your account to continue</p>

          {/* Tab Switcher */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-1.5 flex gap-1.5 mb-6">
            <button
              onClick={() => { setActiveTab("staff"); setError(""); }}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-semibold transition-all duration-200 ${activeTab === "staff"
                ? "bg-linear-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-500/20"
                : "text-slate-500 hover:text-slate-300"
                }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              Staff / Admin
            </button>
            <button
              onClick={() => { setActiveTab("parent"); setError(""); }}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-semibold transition-all duration-200 ${activeTab === "parent"
                ? "bg-linear-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-500/20"
                : "text-slate-500 hover:text-slate-300"
                }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Parent / Student
            </button>
          </div>

          {/* Form Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-7 shadow-2xl">
            {activeTab === "staff" ? (
              <form onSubmit={handleStaffLogin} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Email Address</label>
                  <div className="flex items-center">
                    <div className="relative flex-1">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                        <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
                        </svg>
                      </div>
                      <input
                        type="text"
                        value={emailPrefix}
                        onChange={e => setEmailPrefix(e.target.value.toLowerCase().replace(/\s/g, ""))}
                        required
                        placeholder="admin"
                        className="w-full bg-slate-800 border border-slate-700 text-white placeholder-slate-500 rounded-l-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                      />
                    </div>
                    <span className="inline-flex items-center px-4 py-3 text-sm font-bold text-slate-300 bg-slate-800 border border-l-0 border-slate-700 rounded-r-xl">
                      @colegios.in
                    </span>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between mb-2">
                    <label className="text-sm font-medium text-slate-300">Password</label>
                  </div>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                      <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                    </div>
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      required
                      placeholder="••••••••"
                      className="w-full bg-slate-800 border border-slate-700 text-white placeholder-slate-500 rounded-xl pl-10 pr-11 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-500 hover:text-slate-300 transition-colors"
                    >
                      {showPassword ? (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                      ) : (
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                      )}
                    </button>
                  </div>
                </div>
                {error && (
                  <div className="flex items-center gap-2 px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
                    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    {error}
                  </div>
                )}
                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full py-3 rounded-xl font-semibold text-white bg-linear-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-500/20 transition-all duration-200 flex items-center justify-center gap-2 mt-2"
                >
                  {isLoading ? (
                    <><svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg> Signing in...</>
                  ) : 'Sign in to Dashboard'}
                </button>
              </form>
            ) : (
              <>
                <form onSubmit={handleParentLogin} className="space-y-5">
                  <div className="p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-sm text-indigo-300">
                    <span className="font-semibold">ℹ️ Parent / Student Login:</span> Use the mobile number registered for your child&apos;s account.
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Registered Mobile Number</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                        <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                        </svg>
                      </div>
                      <input
                        type="tel"
                        value={mobile}
                        onChange={e => setMobile(e.target.value)}
                        required
                        placeholder="e.g. 9876543210"
                        className="w-full bg-slate-800 border border-slate-700 text-white placeholder-slate-500 rounded-xl pl-10 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Password</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                        <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                      </div>
                      <input
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        required
                        placeholder="••••••••"
                        className="w-full bg-slate-800 border border-slate-700 text-white placeholder-slate-500 rounded-xl pl-10 pr-11 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-500 hover:text-slate-300 transition-colors"
                      >
                        {showPassword ? (
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                        ) : (
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                        )}
                      </button>
                    </div>
                  </div>
                  {error && (
                    <div className="flex items-center gap-2 px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
                      <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      {error}
                    </div>
                  )}
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="w-full py-3 rounded-xl font-semibold text-white bg-linear-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-500/20 transition-all duration-200 flex items-center justify-center gap-2 mt-2"
                  >
                    {isLoading ? (
                      <><svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg> Signing in...</>
                    ) : "Access Parent Portal"}
                  </button>
                </form>
                <div className="text-center mt-3">
                  <p className="text-slate-500 text-sm">
                    New here?{" "}
                    <a href="/register-parent" className="text-indigo-400 hover:text-indigo-300 font-semibold transition-colors">
                      Register as Parent &rarr;
                    </a>
                  </p>
                </div>
              </>
            )}
          </div>

          <p className="text-center text-slate-600 text-sm mt-6">
            Need help? Contact{" "}
            <a href="mailto:support@colegios.in" className="text-indigo-400 hover:text-indigo-300 font-medium transition-colors">
              support@colegios.in
            </a>
          </p>

          <div className="mt-8 text-center text-xs text-slate-600 space-y-1">
            <p>
              &copy; {new Date().getFullYear()}{" "}
              <a href="https://colegios.in" target="_blank" rel="noopener noreferrer" className="hover:text-slate-400 transition-colors">
                Colegios
              </a>
              . All rights reserved.
            </p>
            <p>
              Developed by{" "}
              <a href="https://appme.in" target="_blank" rel="noopener noreferrer" className="text-indigo-300 underline decoration-indigo-500/70 decoration-1 underline-offset-2 font-medium transition-colors hover:text-indigo-100 hover:decoration-indigo-300">
                AppMe Soft Pvt Ltd.
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
