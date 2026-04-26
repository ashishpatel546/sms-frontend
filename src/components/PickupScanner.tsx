"use client";

import React, { useState, useEffect, useRef } from "react";
import { API_BASE_URL } from "@/lib/api";
import { authFetch } from "@/lib/auth";
import toast from "react-hot-toast";

// idle → requesting (camera perm) → scanning → verifying → confirming (step 1 & 2) → success | error
type ScanState = "idle" | "requesting" | "scanning" | "verifying" | "confirming" | "success" | "error";

interface VerifyResult {
  id: string;
  studentName: string;
  className: string;
  sectionName: string;
  authorizedPersonName: string;
  authorizedPersonMobile: string | null;
  notes: string | null;
  expiresAt: string;
  parentName: string;
}

interface ConfirmForm {
  enteredName: string;
  enteredPin: string;
}

export default function PickupScanner() {
  const [scanState, setScanState] = useState<ScanState>("idle");
  // confirmStep: 1 = verify name, 2 = enter PIN
  const [confirmStep, setConfirmStep] = useState<1 | 2>(1);
  const [scannedToken, setScannedToken] = useState<string | null>(null);
  const [verifyResult, setVerifyResult] = useState<VerifyResult | null>(null);
  const [enteredName, setEnteredName] = useState("");
  const [enteredPin, setEnteredPin] = useState("");
  const [confirmedAt, setConfirmedAt] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  const scannerRef = useRef<HTMLDivElement>(null);
  const html5QrScannerRef = useRef<any>(null);

  // ─── Camera permission + scanner start ──────────────────────────────────────
  // Explicitly request camera via getUserMedia first (required on Android Chrome
  // to show the OS permission dialog from a user gesture). Once allowed, the
  // browser remembers the permission for the site — no repeated prompts.
  const handleStartCamera = async () => {
    if (typeof window === "undefined") return;

    setScanState("requesting");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
      // Release immediately — html5-qrcode will re-acquire the stream
      stream.getTracks().forEach((t) => t.stop());
    } catch (err: any) {
      const denied =
        err.name === "NotAllowedError" || err.name === "PermissionDeniedError";
      setErrorMsg(
        denied
          ? "Camera access was denied. Open your browser's site settings, allow the camera for this page, then try again."
          : `Could not access camera: ${err.message ?? err}`,
      );
      setScanState("error");
      return;
    }

    // Permission granted — init html5-qrcode (low-level API, no built-in UI)
    setScanState("scanning");
    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      if (html5QrScannerRef.current) {
        await html5QrScannerRef.current.stop().catch(() => {});
        html5QrScannerRef.current = null;
      }

      // Pick the back-facing camera automatically
      const cameras = await Html5Qrcode.getCameras();
      if (!cameras || cameras.length === 0) {
        setErrorMsg("No camera found on this device.");
        setScanState("error");
        return;
      }
      // Prefer back camera; fall back to first available
      const backCam = cameras.find((c) =>
        /back|rear|environment/i.test(c.label)
      ) ?? cameras[cameras.length - 1];

      const scanner = new Html5Qrcode("pickup-qr-reader", { verbose: false } as any);
      html5QrScannerRef.current = scanner;

      const boxSize = Math.min(260, Math.round(window.innerWidth * 0.7));
      await scanner.start(
        backCam.id,
        { fps: 10, qrbox: { width: boxSize, height: boxSize } },
        async (decodedText: string) => {
          await scanner.stop().catch(() => {});
          html5QrScannerRef.current = null;
          setScanState("verifying");
          setScannedToken(decodedText);
          await verifyToken(decodedText);
        },
        () => { /* per-frame error — keep scanning */ },
      );
    } catch (err) {
      console.error("Scanner init error", err);
      setErrorMsg("Failed to start scanner. Please reload the page and try again.");
      setScanState("error");
    }
  };

  const stopScanner = async () => {
    if (html5QrScannerRef.current) {
      await html5QrScannerRef.current.stop().catch(() => {});
      html5QrScannerRef.current = null;
    }
    setScanState("idle");
  };

  useEffect(() => {
    return () => {
      if (html5QrScannerRef.current) {
        html5QrScannerRef.current.stop().catch(() => {});
      }
    };
  }, []);

  // ─── Verify scanned token ───────────────────────────────────────────────────
  const verifyToken = async (token: string) => {
    try {
      const res = await authFetch(`${API_BASE_URL}/pickup/verify/${token}`);
      if (res.ok) {
        const data: VerifyResult = await res.json();
        setVerifyResult(data);
        setEnteredName(data.authorizedPersonName);
        setEnteredPin("");
        setConfirmStep(1);
        setScanState("confirming");
      } else {
        const err = await res.json();
        setErrorMsg(err.message || "Invalid or expired QR code");
        setScanState("error");
      }
    } catch {
      setErrorMsg("Network error. Please try again.");
      setScanState("error");
    }
  };

  // ─── Submit final confirmation (step 2) ─────────────────────────────────────
  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scannedToken || !verifyResult) return;
    if (enteredPin.length !== 4 || !/^\d{4}$/.test(enteredPin)) {
      toast.error("PIN must be exactly 4 digits");
      return;
    }

    setSubmitting(true);
    try {
      const res = await authFetch(`${API_BASE_URL}/pickup/confirm/${scannedToken}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enteredName: enteredName.trim(),
          enteredPin,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setConfirmedAt(data.confirmedAt);
        setScanState("success");
      } else {
        const err = await res.json();
        toast.error(err.message || "Confirmation failed. Check name and PIN.");
      }
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setScannedToken(null);
    setVerifyResult(null);
    setEnteredName("");
    setEnteredPin("");
    setConfirmedAt(null);
    setErrorMsg("");
    setConfirmStep(1);
    setScanState("idle");
  };

  // After a successful scan: reset state and re-open camera directly
  // (camera permission is already granted — no need to show idle screen again)
  const restartScanner = () => {
    setScannedToken(null);
    setVerifyResult(null);
    setEnteredName("");
    setEnteredPin("");
    setConfirmedAt(null);
    setErrorMsg("");
    setConfirmStep(1);
    handleStartCamera();
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════

  if (scanState === "idle") {
    return (
      <div className="flex flex-col items-center gap-6 py-8">
        <div className="w-24 h-24 bg-indigo-500/20 rounded-2xl flex items-center justify-center">
          <svg className="w-12 h-12 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </div>
        <div className="text-center space-y-1">
          <h2 className="text-white font-bold text-xl">Student Pickup Scanner</h2>
          <p className="text-slate-400 text-sm">Scan the parent&apos;s QR code to verify and confirm student handover</p>
        </div>
        <div className="px-4 py-3 bg-slate-800/60 border border-slate-700 rounded-xl text-slate-400 text-xs text-center max-w-xs">
          📷 Camera access is required. Your browser will ask for permission when you tap Start Camera. Once allowed, it stays remembered for this site.
        </div>
        <button
          onClick={handleStartCamera}
          className="px-8 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl transition-all text-base"
        >
          📷 Start Camera
        </button>
      </div>
    );
  }

  if (scanState === "requesting") {
    return (
      <div className="flex flex-col items-center gap-5 py-12 text-center">
        <div className="w-16 h-16 bg-indigo-500/20 rounded-full flex items-center justify-center">
          <svg className="w-8 h-8 text-indigo-400 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </div>
        <div>
          <p className="text-white font-semibold text-base">Requesting Camera Access…</p>
          <p className="text-slate-400 text-sm mt-1">Please allow camera access when your browser prompts you.</p>
        </div>
      </div>
    );
  }

  if (scanState === "scanning") {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-white font-bold text-lg">Scan QR Code</h2>
          <button onClick={stopScanner} className="text-slate-400 hover:text-white text-sm transition-colors">
            ✕ Cancel
          </button>
        </div>
        <p className="text-slate-400 text-sm">Point the back camera at the parent&apos;s QR code</p>
        <div id="pickup-qr-reader" ref={scannerRef} className="overflow-hidden rounded-2xl border border-slate-700" />
      </div>
    );
  }

  if (scanState === "verifying") {
    return (
      <div className="flex flex-col items-center gap-4 py-12">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-slate-400 text-sm">Verifying QR code…</p>
      </div>
    );
  }

  if (scanState === "confirming" && verifyResult) {
    const expiresAt = new Date(verifyResult.expiresAt);
    const expiryStr = expiresAt.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
    const isExpiringSoon = (expiresAt.getTime() - Date.now()) < 5 * 60 * 1000;

    const studentCard = (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 bg-indigo-500/20 rounded-xl flex items-center justify-center text-xl shrink-0">👨‍🎓</div>
          <div>
            <h3 className="text-white font-bold text-base">{verifyResult.studentName}</h3>
            <p className="text-slate-400 text-sm">
              Class {verifyResult.className}
              {verifyResult.sectionName ? ` — Section ${verifyResult.sectionName}` : ""}
            </p>
          </div>
        </div>
        <div className="border-t border-slate-800 pt-3 space-y-1 text-sm">
          <p className="text-slate-400"><span className="text-slate-500">Parent:</span> <span className="text-white">{verifyResult.parentName}</span></p>
          <p className="text-slate-400"><span className="text-slate-500">Authorised for:</span> <span className="text-emerald-300 font-medium">{verifyResult.authorizedPersonName}</span></p>
          {verifyResult.authorizedPersonMobile && (
            <p className="text-slate-400"><span className="text-slate-500">Mobile:</span> <span className="text-white">{verifyResult.authorizedPersonMobile}</span></p>
          )}
          {verifyResult.notes && (
            <p className="text-slate-400"><span className="text-slate-500">Note:</span> <span className="text-white">{verifyResult.notes}</span></p>
          )}
          <p className={isExpiringSoon ? "text-red-400" : "text-slate-400"}>
            <span className="text-slate-500">Expires:</span> <span>{expiryStr}</span>
            {isExpiringSoon && <span className="ml-1 text-xs">(expiring soon!)</span>}
          </p>
        </div>
      </div>
    );

    const stepIndicator = (step: 1 | 2) => (
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5">
          <span className={`w-6 h-6 rounded-full text-white text-xs flex items-center justify-center font-bold ${step > 1 ? "bg-emerald-600" : "bg-indigo-600"}`}>
            {step > 1 ? "✓" : "1"}
          </span>
          <span className={`text-sm ${step > 1 ? "text-slate-500 line-through" : "text-white font-medium"}`}>Verify Identity</span>
        </div>
        <div className="flex-1 h-px bg-slate-700" />
        <div className="flex items-center gap-1.5">
          <span className={`w-6 h-6 rounded-full text-xs flex items-center justify-center font-bold ${step === 2 ? "bg-indigo-600 text-white" : "bg-slate-700 text-slate-400"}`}>2</span>
          <span className={`text-sm ${step === 2 ? "text-white font-medium" : "text-slate-500"}`}>Verify PIN</span>
        </div>
      </div>
    );

    // ── Step 1: Verify name ──
    if (confirmStep === 1) {
      return (
        <div className="space-y-4">
          {stepIndicator(1)}
          {studentCard}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
            <div>
              <p className="text-white font-semibold text-sm mb-1">📋 Step 1 — Confirm the person&apos;s name</p>
              <p className="text-slate-400 text-xs">Ask the person to state their full name. Confirm it matches the authorised name.</p>
            </div>
            <div>
              <label className="block text-slate-400 text-xs mb-1.5">Name stated by the person</label>
              <input
                type="text"
                value={enteredName}
                onChange={(e) => setEnteredName(e.target.value)}
                placeholder="Enter the name they stated"
                className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-slate-600"
                autoFocus
              />
              <p className="text-slate-600 text-xs mt-1">Expected: <span className="text-slate-400">{verifyResult.authorizedPersonName}</span></p>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={handleReset}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-sm font-medium transition-all">
                ✕ Wrong QR
              </button>
              <button type="button" onClick={() => setConfirmStep(2)} disabled={!enteredName.trim()}
                className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-sm font-semibold transition-all">
                Name Confirmed →
              </button>
            </div>
          </div>
        </div>
      );
    }

    // ── Step 2: Enter PIN ──
    return (
      <form onSubmit={handleConfirm} className="space-y-4">
        {stepIndicator(2)}
        <div className="flex items-center gap-2 px-4 py-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
          <span className="text-emerald-400 text-sm">✓</span>
          <span className="text-emerald-300 text-sm font-medium">{enteredName.trim()}</span>
          <button type="button" onClick={() => setConfirmStep(1)}
            className="ml-auto text-slate-500 hover:text-slate-300 text-xs underline">
            Edit
          </button>
        </div>
        {studentCard}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
          <div>
            <p className="text-white font-semibold text-sm mb-1">🔢 Step 2 — Enter their 4-digit PIN</p>
            <p className="text-slate-400 text-xs">Ask the person to verbally state the 4-digit PIN the parent shared with them. Enter it below.</p>
          </div>
          <div>
            <label className="block text-slate-400 text-xs mb-1.5">4-Digit PIN</label>
            <input
              type="text"
              inputMode="numeric"
              pattern="\d{4}"
              maxLength={4}
              value={enteredPin}
              onChange={(e) => {
                const v = e.target.value.replace(/\D/g, "").slice(0, 4);
                setEnteredPin(v);
              }}
              placeholder="_ _ _ _"
              className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-2.5 font-mono tracking-[0.5em] focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-slate-600 text-center text-lg"
              autoFocus
            />
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => setConfirmStep(1)}
              className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-sm font-medium transition-all">
              ← Back
            </button>
            <button type="submit" disabled={submitting || enteredPin.length !== 4}
              className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2">
              {submitting
                ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : "✓ Confirm Handover"}
            </button>
          </div>
        </div>
      </form>
    );
  }

  if (scanState === "success" && verifyResult) {
    const timeStr = confirmedAt
      ? new Date(confirmedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })
      : "";

    return (
      <div className="flex flex-col items-center gap-5 py-8 text-center">
        <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center">
          <svg className="w-10 h-10 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <div>
          <h2 className="text-white font-bold text-xl mb-1">Handover Confirmed</h2>
          <p className="text-emerald-400 text-sm font-medium">{timeStr}</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 w-full text-left space-y-1.5 text-sm">
          <p className="text-slate-400"><span className="text-slate-500">Student:</span> <span className="text-white">{verifyResult.studentName}</span></p>
          <p className="text-slate-400"><span className="text-slate-500">Handed to:</span> <span className="text-white">{enteredName.trim() || verifyResult.authorizedPersonName}</span></p>
          {verifyResult.authorizedPersonMobile && (
            <p className="text-slate-400"><span className="text-slate-500">Mobile:</span> <span className="text-white">{verifyResult.authorizedPersonMobile}</span></p>
          )}
        </div>
        <p className="text-slate-500 text-xs">A push notification has been sent to the parent.</p>
        <button onClick={restartScanner}
          className="px-8 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl transition-all">
          📷 Scan Another QR
        </button>
      </div>
    );
  }

  if (scanState === "error") {
    const isCameraDenied = errorMsg.toLowerCase().includes("denied") || errorMsg.toLowerCase().includes("settings");
    return (
      <div className="flex flex-col items-center gap-5 py-8 text-center">
        <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center">
          <svg className="w-10 h-10 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <div className="space-y-1 px-2">
          <h2 className="text-white font-bold text-xl">{isCameraDenied ? "Camera Access Denied" : "QR Verification Failed"}</h2>
          <p className="text-red-400 text-sm">{errorMsg}</p>
          {isCameraDenied && (
            <p className="text-slate-500 text-xs mt-2">
              On Android: tap the lock icon 🔒 in the address bar → Site settings → Camera → Allow.
            </p>
          )}
        </div>
        <button onClick={handleReset}
          className="px-8 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl transition-all">
          {isCameraDenied ? "Go Back" : "Try Again"}
        </button>
      </div>
    );
  }

  return null;
}
