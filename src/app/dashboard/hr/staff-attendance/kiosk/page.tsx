"use client";

import { useState, useEffect, useRef } from "react";
import { hrApi } from "@/lib/hr-api";
import toast, { Toaster } from "react-hot-toast";
import {
  startRegistration,
  startAuthentication,
} from "@simplewebauthn/browser";

type KioskStep = "idle" | "entering" | "verifying" | "success" | "error";

export default function AttendanceKioskPage() {
  const [step, setStep] = useState<KioskStep>("idle");
  const [employeeCode, setEmployeeCode] = useState("");
  const [message, setMessage] = useState("");
  const [lastRecord, setLastRecord] = useState<any>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const today = new Date().toISOString().slice(0, 10);

  // Auto-focus input when idle or entering
  useEffect(() => {
    if (step === "idle" || step === "entering") inputRef.current?.focus();
  }, [step]);

  // Auto-reset after success/error
  useEffect(() => {
    if (step === "success" || step === "error") {
      const t = setTimeout(() => {
        setStep("idle");
        setEmployeeCode("");
        setMessage("");
      }, 4000);
      return () => clearTimeout(t);
    }
  }, [step]);

  const handleAuthenticate = async () => {
    if (!employeeCode) return;
    setStep("verifying");
    try {
      // Get auth options
      const options = await hrApi.attendance.webauthn.getAuthOptions(Number(employeeCode));
      // Perform browser WebAuthn
      const authResponse = await startAuthentication({ optionsJSON: options });
      // Verify on server — automatically records attendance
      const record = await hrApi.attendance.webauthn.verifyAuth(Number(employeeCode), authResponse, today);
      setLastRecord(record);
      setMessage(`Attendance recorded — ${record.status}`);
      setStep("success");
    } catch (e: any) {
      const msg = e?.info?.message ?? e?.message ?? "Authentication failed";
      setMessage(msg);
      setStep("error");
    }
  };

  const statusColor =
    step === "success"
      ? "bg-green-500"
      : step === "error"
      ? "bg-red-500"
      : step === "verifying"
      ? "bg-blue-500"
      : "bg-gray-800";

  return (
    <div className={`min-h-screen flex flex-col items-center justify-center transition-colors duration-500 ${statusColor}`}>
      <Toaster />
      <div className="bg-white rounded-2xl shadow-2xl p-10 w-full max-w-sm text-center space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Attendance Kiosk</h1>
          <p className="text-sm text-gray-500 mt-1">{new Date().toLocaleString()}</p>
        </div>

        {(step === "idle" || step === "entering") && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Enter Employee Code</label>
              <input
                ref={inputRef}
                type="number"
                value={employeeCode}
                onChange={(e) => { setEmployeeCode(e.target.value); setStep("entering"); }}
                onKeyDown={(e) => e.key === "Enter" && handleAuthenticate()}
                placeholder="e.g. 1001"
                className="w-full border-2 border-gray-300 rounded-xl px-4 py-3 text-2xl text-center tracking-widest focus:outline-none focus:border-blue-500"
                autoComplete="off"
              />
            </div>
            <button
              onClick={handleAuthenticate}
              disabled={!employeeCode}
              className="w-full bg-blue-600 text-white py-3 rounded-xl text-lg font-semibold hover:bg-blue-700 disabled:opacity-40 transition-colors"
            >
              Scan Fingerprint / Face
            </button>
            <p className="text-xs text-gray-400">Enter your employee code then press the button or Enter to scan your biometric.</p>
          </>
        )}

        {step === "verifying" && (
          <div className="space-y-4">
            <div className="w-16 h-16 mx-auto border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-lg font-medium text-gray-700">Verifying…</p>
            <p className="text-sm text-gray-500">Please follow your browser's biometric prompt.</p>
          </div>
        )}

        {step === "success" && (
          <div className="space-y-4">
            <div className="w-16 h-16 mx-auto bg-green-100 rounded-full flex items-center justify-center">
              <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-xl font-bold text-green-700">Attendance Recorded!</p>
            <p className="text-sm text-gray-600">{message}</p>
            {lastRecord && (
              <div className="text-xs text-gray-500 space-y-1">
                <div>Date: {lastRecord.date}</div>
                <div>Status: {lastRecord.status}</div>
                {lastRecord.checkInTime && <div>Check-In: {lastRecord.checkInTime}</div>}
              </div>
            )}
            <p className="text-xs text-gray-400">Resetting in 4 seconds…</p>
          </div>
        )}

        {step === "error" && (
          <div className="space-y-4">
            <div className="w-16 h-16 mx-auto bg-red-100 rounded-full flex items-center justify-center">
              <svg className="w-10 h-10 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <p className="text-xl font-bold text-red-700">Failed</p>
            <p className="text-sm text-gray-600">{message}</p>
            <p className="text-xs text-gray-400">Resetting in 4 seconds…</p>
          </div>
        )}
      </div>
    </div>
  );
}
