"use client";

import React, { useState, useEffect, useRef } from "react";
import { API_BASE_URL } from "@/lib/api";
import { authFetch } from "@/lib/auth";
import toast from "react-hot-toast";
import { useLocale, useTranslations } from "next-intl";
import { INTL_LOCALE } from "@/i18n/config";
import { GraduationCap, ClipboardCheck, Hash } from "lucide-react";
import VisitorScanPanel from "./VisitorScanPanel";
import IdCardScanPanel from "./IdCardScanPanel";
import InventoryScanPanel from "./InventoryScanPanel";
import { useRbac } from "@/lib/rbac";
import { useFeatureFlag } from "@/lib/useSchoolFeatures";
import { lookupItem, type InventoryItem } from "@/lib/inventory-api";

// idle → requesting (camera perm) → scanning → verifying → confirming (step 1 & 2) → success | error
// "visitor":   a V1:-prefixed visitor QR was decoded — VisitorScanPanel takes over
// "idcard":    an IDC1:-prefixed printed ID card — IdCardScanPanel takes over
// "inventory": an INV1:-prefixed stock label, or any code that turned out to
//              be stock rather than a pass — InventoryScanPanel takes over
type ScanState = "idle" | "requesting" | "scanning" | "verifying" | "confirming" | "success" | "error" | "visitor" | "idcard" | "inventory";

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

/** The subset of Html5Qrcode's instance surface this component calls. */
interface Html5QrcodeInstance {
  start: (
    cameraIdOrConfig: string,
    config: { fps: number; qrbox: { width: number; height: number } },
    onSuccess: (decodedText: string) => void | Promise<void>,
    onError: () => void,
  ) => Promise<unknown>;
  stop: () => Promise<void>;
}

export default function PickupScanner() {
  const t = useTranslations("pickup");
  const tc = useTranslations("common");
  const intlLocale = INTL_LOCALE[useLocale()];
  const [scanState, setScanState] = useState<ScanState>("idle");
  // confirmStep: 1 = verify name, 2 = enter PIN
  const [confirmStep, setConfirmStep] = useState<1 | 2>(1);
  const [scannedToken, setScannedToken] = useState<string | null>(null);
  const [visitorToken, setVisitorToken] = useState<string | null>(null);
  const [idCardToken, setIdCardToken] = useState<string | null>(null);
  const [inventoryCode, setInventoryCode] = useState<string | null>(null);
  // Set only on the fallback path, where the lookup already happened — saves
  // the panel repeating a request whose answer we are holding.
  const [inventoryItem, setInventoryItem] = useState<InventoryItem | null>(null);
  const [verifyResult, setVerifyResult] = useState<VerifyResult | null>(null);
  const [enteredName, setEnteredName] = useState("");
  const [enteredPin, setEnteredPin] = useState("");
  const [confirmedAt, setConfirmedAt] = useState<string | null>(null);
  // Decided when the pass is verified, not while rendering: reading the clock
  // during render makes the same props produce different output.
  const [expiringSoon, setExpiringSoon] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  const scannerRef = useRef<HTMLDivElement>(null);
  const html5QrScannerRef = useRef<Html5QrcodeInstance | null>(null);

  // Whether an unrecognised code is worth trying against the store catalogue.
  // Both halves matter: a school without the module has no catalogue to hit,
  // and a GUARD would only earn a 403 from the lookup route (SUB_ADMIN+).
  const rbac = useRbac();
  const inventoryEnabled = useFeatureFlag("inventory_management").enabled === true;
  const canLookUpStock = inventoryEnabled && rbac.canManageInventory;
  // Read inside the decode callback, which is created once per camera start.
  const canLookUpStockRef = useRef(canLookUpStock);
  useEffect(() => {
    canLookUpStockRef.current = canLookUpStock;
  }, [canLookUpStock]);

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
    } catch (err) {
      const name = err instanceof Error ? err.name : "";
      const denied =
        name === "NotAllowedError" || name === "PermissionDeniedError";
      setErrorMsg(
        denied
          ? t("errors.cameraDenied")
          : t("errors.cameraError", { error: err instanceof Error ? err.message : String(err) }),
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
        setErrorMsg(t("errors.noCamera"));
        setScanState("error");
        return;
      }
      // Prefer back camera; fall back to first available
      const backCam = cameras.find((c) =>
        /back|rear|environment/i.test(c.label)
      ) ?? cameras[cameras.length - 1];

      const scanner: Html5QrcodeInstance = new Html5Qrcode("pickup-qr-reader", {
        verbose: false,
      });
      html5QrScannerRef.current = scanner;

      const boxSize = Math.min(260, Math.round(window.innerWidth * 0.7));
      await scanner.start(
        backCam.id,
        { fps: 10, qrbox: { width: boxSize, height: boxSize } },
        async (decodedText: string) => {
          await scanner.stop().catch(() => {});
          html5QrScannerRef.current = null;
          // Unified scanner. Each QR family declares itself with a prefix;
          // pickup QRs predate the convention and are raw tokens, so they are
          // the fallthrough rather than a case.
          //   V1:    visitor pass          → VisitorScanPanel
          //   IDC1:  printed ID card       → IdCardScanPanel
          //   INV1:  inventory stock label → InventoryScanPanel
          if (decodedText.startsWith("V1:")) {
            setVisitorToken(decodedText.slice(3));
            setScanState("visitor");
            return;
          }
          if (decodedText.startsWith("IDC1:")) {
            // The prefix stays on: /id-cards/verify signs and parses the whole
            // string, prefix included.
            setIdCardToken(decodedText);
            setScanState("idcard");
            return;
          }
          if (decodedText.startsWith("INV1:")) {
            // Whole string again — /inventory/items/lookup parses the prefix.
            setInventoryCode(decodedText);
            setScanState("inventory");
            return;
          }
          setScanState("verifying");
          setScannedToken(decodedText);
          await verifyToken(decodedText);
        },
        () => { /* per-frame error — keep scanning */ },
      );
    } catch (err) {
      console.error("Scanner init error", err);
      setErrorMsg(t("errors.startFailed"));
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
      // Pickup QRs predate the prefix convention, so an unprefixed code is
      // *assumed* to be one. Encoded because the fallback below means arbitrary
      // product barcodes now reach this path too, and a "/" in one would
      // otherwise silently become a different route.
      const res = await authFetch(`${API_BASE_URL}/pickup/verify/${encodeURIComponent(token)}`);
      if (res.ok) {
        const data: VerifyResult = await res.json();
        setVerifyResult(data);
        setExpiringSoon(new Date(data.expiresAt).getTime() - Date.now() < 5 * 60 * 1000);
        setEnteredName(data.authorizedPersonName);
        setEnteredPin("");
        setConfirmStep(1);
        setScanState("confirming");
        return;
      }
      // Not a pickup token. Before calling it invalid, try the store catalogue:
      // a Code-128 label we printed, or a publisher's EAN-13 on a textbook,
      // both arrive here as an unprefixed string. Only if that misses too is
      // the code genuinely unrecognised — and then the pickup error is the
      // honest one, since that is what the person was most likely scanning.
      const err = await res.json().catch(() => ({}));
      if (canLookUpStockRef.current) {
        const item = await lookupItem(token).catch(() => null);
        if (item) {
          setInventoryItem(item);
          setInventoryCode(token);
          setScanState("inventory");
          return;
        }
      }
      setErrorMsg(err.message || t("errors.invalidQr"));
      setScanState("error");
    } catch {
      setErrorMsg(t("errors.network"));
      setScanState("error");
    }
  };

  // ─── Submit final confirmation (step 2) ─────────────────────────────────────
  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scannedToken || !verifyResult) return;
    if (enteredPin.length !== 4 || !/^\d{4}$/.test(enteredPin)) {
      toast.error(t("errors.pinDigits"));
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
        toast.error(err.message || t("errors.confirmFailed"));
      }
    } catch {
      toast.error(t("errors.network"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setScannedToken(null);
    setVisitorToken(null);
    setIdCardToken(null);
    setInventoryCode(null);
    setInventoryItem(null);
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
    setVisitorToken(null);
    setIdCardToken(null);
    setInventoryCode(null);
    setInventoryItem(null);
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

  if (scanState === "visitor" && visitorToken) {
    return (
      <VisitorScanPanel
        token={visitorToken}
        onDone={restartScanner}
        onCancel={handleReset}
      />
    );
  }

  if (scanState === "idcard" && idCardToken) {
    return (
      <IdCardScanPanel
        token={idCardToken}
        onDone={restartScanner}
        onCancel={handleReset}
      />
    );
  }

  if (scanState === "inventory" && inventoryCode) {
    return (
      <InventoryScanPanel
        code={inventoryCode}
        initialItem={inventoryItem}
        onDone={restartScanner}
        onCancel={handleReset}
      />
    );
  }

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
          <h2 className="text-white font-bold text-xl">{t("scanner.idleTitle")}</h2>
          <p className="text-slate-400 text-sm">
            {canLookUpStock ? t("scanner.idleDescStock") : t("scanner.idleDesc")}
          </p>
        </div>
        <div className="px-4 py-3 bg-slate-800/60 border border-slate-700 rounded-xl text-slate-400 text-xs text-center max-w-xs">
          📷 {t("scanner.cameraNote")}
        </div>
        <button
          onClick={handleStartCamera}
          className="px-8 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl transition-all text-base"
        >
          📷 {t("scanner.startCamera")}
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
          <p className="text-white font-semibold text-base">{t("scanner.requesting")}</p>
          <p className="text-slate-400 text-sm mt-1">{t("scanner.requestingHint")}</p>
        </div>
      </div>
    );
  }

  if (scanState === "scanning") {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-white font-bold text-lg">{t("scanner.scanTitle")}</h2>
          <button onClick={stopScanner} className="text-slate-400 hover:text-white text-sm transition-colors">
            ✕ {tc("action.cancel")}
          </button>
        </div>
        <p className="text-slate-400 text-sm">
          {canLookUpStock ? t("scanner.scanHintStock") : t("scanner.scanHint")}
        </p>
        <div id="pickup-qr-reader" ref={scannerRef} className="overflow-hidden rounded-2xl border border-slate-700" />
      </div>
    );
  }

  if (scanState === "verifying") {
    return (
      <div className="flex flex-col items-center gap-4 py-12">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-slate-400 text-sm">{t("scanner.verifying")}</p>
      </div>
    );
  }

  if (scanState === "confirming" && verifyResult) {
    const expiresAt = new Date(verifyResult.expiresAt);
    const expiryStr = expiresAt.toLocaleTimeString(intlLocale, { hour: "2-digit", minute: "2-digit", hour12: true });
    const isExpiringSoon = expiringSoon;

    const studentCard = (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 bg-indigo-500/20 rounded-xl flex items-center justify-center shrink-0">
            <GraduationCap className="w-5 h-5 text-indigo-400" aria-hidden />
          </div>
          <div>
            <h3 className="text-white font-bold text-base">{verifyResult.studentName}</h3>
            <p className="text-slate-400 text-sm">
              {verifyResult.sectionName
                ? t("scanner.classSectionLine", { className: verifyResult.className, section: verifyResult.sectionName })
                : t("scanner.classLine", { className: verifyResult.className })}
            </p>
          </div>
        </div>
        <div className="border-t border-slate-800 pt-3 space-y-1 text-sm">
          <p className="text-slate-400"><span className="text-slate-500">{t("scanner.parent")}</span> <span className="text-white">{verifyResult.parentName}</span></p>
          <p className="text-slate-400"><span className="text-slate-500">{t("scanner.authorisedFor")}</span> <span className="text-emerald-300 font-medium">{verifyResult.authorizedPersonName}</span></p>
          {verifyResult.authorizedPersonMobile && (
            <p className="text-slate-400"><span className="text-slate-500">{t("scanner.mobile")}</span> <span className="text-white">{verifyResult.authorizedPersonMobile}</span></p>
          )}
          {verifyResult.notes && (
            <p className="text-slate-400"><span className="text-slate-500">{t("scanner.note")}</span> <span className="text-white">{verifyResult.notes}</span></p>
          )}
          <p className={isExpiringSoon ? "text-red-400" : "text-slate-400"}>
            <span className="text-slate-500">{t("scanner.expires")}</span> <span>{expiryStr}</span>
            {isExpiringSoon && <span className="ml-1 text-xs">{t("scanner.expiringSoon")}</span>}
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
          <span className={`text-sm ${step > 1 ? "text-slate-500 line-through" : "text-white font-medium"}`}>{t("scanner.stepIdentity")}</span>
        </div>
        <div className="flex-1 h-px bg-slate-700" />
        <div className="flex items-center gap-1.5">
          <span className={`w-6 h-6 rounded-full text-xs flex items-center justify-center font-bold ${step === 2 ? "bg-indigo-600 text-white" : "bg-slate-700 text-slate-400"}`}>2</span>
          <span className={`text-sm ${step === 2 ? "text-white font-medium" : "text-slate-500"}`}>{t("scanner.stepPin")}</span>
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
              <p className="text-white font-semibold text-sm mb-1 flex items-center gap-1.5">
                <ClipboardCheck className="w-4 h-4 text-indigo-400" aria-hidden />
                {t("scanner.step1Title")}
              </p>
              <p className="text-slate-400 text-xs">{t("scanner.step1Hint")}</p>
            </div>
            <div>
              <label className="block text-slate-400 text-xs mb-1.5">{t("scanner.nameLabel")}</label>
              <input
                type="text"
                value={enteredName}
                onChange={(e) => setEnteredName(e.target.value)}
                placeholder={t("scanner.namePlaceholder")}
                className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand/40 placeholder-slate-600"
                autoFocus
              />
              <p className="text-slate-600 text-xs mt-1">{t("scanner.expected")} <span className="text-slate-400">{verifyResult.authorizedPersonName}</span></p>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={handleReset}
                className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-sm font-medium transition-all">
                ✕ {t("scanner.wrongQr")}
              </button>
              <button type="button" onClick={() => setConfirmStep(2)} disabled={!enteredName.trim()}
                className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-sm font-semibold transition-all">
                {t("scanner.nameConfirmed")}
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
            {tc("action.edit")}
          </button>
        </div>
        {studentCard}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
          <div>
            <p className="text-white font-semibold text-sm mb-1 flex items-center gap-1.5">
                <Hash className="w-4 h-4 text-indigo-400" aria-hidden />
                {t("scanner.step2Title")}
              </p>
            <p className="text-slate-400 text-xs">{t("scanner.step2Hint")}</p>
          </div>
          <div>
            <label className="block text-slate-400 text-xs mb-1.5">{t("scanner.pinLabel")}</label>
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
              className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-2.5 font-mono tracking-[0.5em] focus:outline-none focus:ring-2 focus:ring-brand/40 placeholder-slate-600 text-center text-lg"
              autoFocus
            />
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => setConfirmStep(1)}
              className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-sm font-medium transition-all">
              ← {tc("action.back")}
            </button>
            <button type="submit" disabled={submitting || enteredPin.length !== 4}
              className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2">
              {submitting
                ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : `✓ ${t("scanner.confirmHandover")}`}
            </button>
          </div>
        </div>
      </form>
    );
  }

  if (scanState === "success" && verifyResult) {
    const timeStr = confirmedAt
      ? new Date(confirmedAt).toLocaleTimeString(intlLocale, { hour: "2-digit", minute: "2-digit", hour12: true })
      : "";

    return (
      <div className="flex flex-col items-center gap-5 py-8 text-center">
        <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center">
          <svg className="w-10 h-10 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <div>
          <h2 className="text-white font-bold text-xl mb-1">{t("scanner.successTitle")}</h2>
          <p className="text-emerald-400 text-sm font-medium">{timeStr}</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 w-full text-left space-y-1.5 text-sm">
          <p className="text-slate-400"><span className="text-slate-500">{t("scanner.student")}</span> <span className="text-white">{verifyResult.studentName}</span></p>
          <p className="text-slate-400"><span className="text-slate-500">{t("scanner.handedTo")}</span> <span className="text-white">{enteredName.trim() || verifyResult.authorizedPersonName}</span></p>
          {verifyResult.authorizedPersonMobile && (
            <p className="text-slate-400"><span className="text-slate-500">{t("scanner.mobile")}</span> <span className="text-white">{verifyResult.authorizedPersonMobile}</span></p>
          )}
        </div>
        <p className="text-slate-500 text-xs">{t("scanner.pushSent")}</p>
        <button onClick={restartScanner}
          className="px-8 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl transition-all">
          📷 {t("scanner.scanAnother")}
        </button>
      </div>
    );
  }

  if (scanState === "error") {
    const isCameraDenied = errorMsg === t("errors.cameraDenied") || errorMsg.toLowerCase().includes("denied") || errorMsg.toLowerCase().includes("settings");
    return (
      <div className="flex flex-col items-center gap-5 py-8 text-center">
        <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center">
          <svg className="w-10 h-10 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>
        <div className="space-y-1 px-2">
          <h2 className="text-white font-bold text-xl">{isCameraDenied ? t("scanner.deniedTitle") : t("scanner.failedTitle")}</h2>
          <p className="text-red-400 text-sm">{errorMsg}</p>
          {isCameraDenied && (
            <p className="text-slate-500 text-xs mt-2">
              {t("scanner.androidHint")}
            </p>
          )}
        </div>
        <button onClick={handleReset}
          className="px-8 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl transition-all">
          {isCameraDenied ? t("scanner.goBack") : tc("action.retry")}
        </button>
      </div>
    );
  }

  return null;
}
