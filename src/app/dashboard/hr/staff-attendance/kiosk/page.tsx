"use client";

import { useState, useEffect, useRef } from "react";
import { hrApi, type StaffAttendanceStatus } from "@/lib/hr-api";
import { useLocale, useTranslations } from "next-intl";
import { INTL_LOCALE, type Locale } from "@/i18n/config";
import { todayLocalDate } from "@/lib/utils";
import toast, { Toaster } from "react-hot-toast";
import Link from "next/link";
import StaffLookupForm from "@/components/StaffLookupForm";
import {
  startRegistration,
  startAuthentication,
} from "@simplewebauthn/browser";

type KioskStep = "idle" | "entering" | "verifying" | "success" | "error";

export default function AttendanceKioskPage() {
  const t = useTranslations("hr");
  const locale = useLocale() as Locale;
  const [step, setStep] = useState<KioskStep>("idle");
  const [employeeCode, setEmployeeCode] = useState("");
  const [showLookup, setShowLookup] = useState(false);
  const [message, setMessage] = useState("");
  const [lastRecord, setLastRecord] = useState<any>(null);
  const [showHowItWorks, setShowHowItWorks] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const today = todayLocalDate();

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
      const options = await hrApi.attendance.webauthn.getAuthOptions(Number(employeeCode));
      const authResponse = await startAuthentication({ optionsJSON: options });
      const record = await hrApi.attendance.webauthn.verifyAuth(Number(employeeCode), authResponse, today);
      setLastRecord(record);
      setMessage(t("kiosk.recorded", { status: t(`attendanceStatus.${record.status as StaffAttendanceStatus}`) }));
      setStep("success");
    } catch (e: any) {
      const msg = e?.info?.message ?? e?.message ?? t("kiosk.authFailed");
      setMessage(msg);
      setStep("error");
    }
  };

  const statusColor =
    step === "success" ? "bg-green-500"
    : step === "error" ? "bg-red-500"
    : step === "verifying" ? "bg-blue-500"
    : "bg-gray-800";

  return (
    <div className={`min-h-screen flex flex-col items-center justify-center transition-colors duration-500 ${statusColor} relative`}>
      <Toaster />

      {/* Back link — subtle top-left corner */}
      <Link
        href="/dashboard/hr/staff-attendance"
        className="absolute top-4 left-4 text-white/70 hover:text-white text-sm flex items-center gap-1 transition-colors"
      >
        {t("kiosk.back")}
      </Link>

      <div className="bg-white rounded-2xl shadow-2xl p-10 w-full max-w-sm text-center space-y-6">
        <div>
          <h1 className="font-display text-[22px] sm:text-[26px] font-semibold tracking-[-0.02em] text-ink">{t("kiosk.title")}</h1>
          <p className="text-sm text-gray-500 mt-1">{new Date().toLocaleString(INTL_LOCALE[locale])}</p>
        </div>

        {(step === "idle" || step === "entering") && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">{t("kiosk.enterCode")}</label>
              <input
                ref={inputRef}
                type="number"
                value={employeeCode}
                onChange={(e) => { setEmployeeCode(e.target.value); setStep("entering"); }}
                onKeyDown={(e) => e.key === "Enter" && handleAuthenticate()}
                placeholder={t("kiosk.codePlaceholder")}
                className="w-full border-2 border-gray-300 rounded-xl px-4 py-3 text-2xl text-center tracking-widest focus:outline-none focus:border-brand"
                autoComplete="off"
              />
            </div>
            <button
              onClick={handleAuthenticate}
              disabled={!employeeCode}
              className="w-full bg-blue-600 text-white py-3 rounded-xl text-lg font-semibold hover:bg-blue-700 disabled:opacity-40 transition-colors"
            >
              {t("kiosk.verify")}
            </button>
            <p className="text-xs text-gray-400">
              {t("kiosk.typeHint")}
            </p>

            {/* Lookup helper — resolve by Staff ID / mobile when the user doesn't remember their employee code */}
            <div className="border border-gray-200 rounded-xl text-left overflow-hidden">
              <button
                onClick={() => setShowLookup((v) => !v)}
                className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                <span>{t("kiosk.lookupToggle")}</span>
                <span className="text-gray-400">{showLookup ? "▲" : "▼"}</span>
              </button>
              {showLookup && (
                <div className="px-4 pb-4 pt-3 border-t border-gray-100">
                  <StaffLookupForm
                    fields={{ employeeCode: false, id: true, mobile: true }}
                    onResolved={(staff) => {
                      setEmployeeCode(String(staff.employeeCode));
                      setStep("entering");
                      setShowLookup(false);
                      toast.success(t("kiosk.loaded", { name: `${staff.firstName} ${staff.lastName}`, code: String(staff.employeeCode) }));
                    }}
                  />
                </div>
              )}
            </div>

            {/* How it works accordion */}
            <div className="border border-gray-200 rounded-xl text-left overflow-hidden">
              <button
                onClick={() => setShowHowItWorks((v) => !v)}
                className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                <span>{t("kiosk.howTitle")}</span>
                <span className="text-gray-400">{showHowItWorks ? "▲" : "▼"}</span>
              </button>
              {showHowItWorks && (
                <div className="px-4 pb-4 text-xs text-gray-600 space-y-2 border-t border-gray-100">
                  <p>{t.rich("kiosk.howIntro", { strong: (c) => <strong>{c}</strong> })}</p>
                  <ol className="list-decimal list-inside space-y-1">
                    <li>{t.rich("kiosk.howSetup", { strong: (c) => <strong>{c}</strong> })}</li>
                    <li>{t.rich("kiosk.howDaily", { strong: (c) => <strong>{c}</strong>, em: (c) => <em>{c}</em> })}</li>
                    <li>{t.rich("kiosk.howSecurity", { strong: (c) => <strong>{c}</strong>, em: (c) => <em>{c}</em> })}</li>
                  </ol>
                  <p className="text-gray-400 pt-1">
                    {t.rich("kiosk.howRegister", { strong: (c) => <strong>{c}</strong> })}
                  </p>
                </div>
              )}
            </div>
          </>
        )}

        {step === "verifying" && (
          <div className="space-y-4">
            <div className="w-16 h-16 mx-auto border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-lg font-medium text-gray-700">{t("kiosk.verifying")}</p>
            <p className="text-sm text-gray-500">{t("kiosk.followPrompt")}</p>
          </div>
        )}

        {step === "success" && (
          <div className="space-y-4">
            <div className="w-16 h-16 mx-auto bg-green-100 rounded-full flex items-center justify-center">
              <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-xl font-bold text-green-700">{t("kiosk.recordedTitle")}</p>
            <p className="text-sm text-gray-600">{message}</p>
            {lastRecord && (
              <div className="text-xs text-gray-500 space-y-1">
                <div>{t("kiosk.dateLine", { date: lastRecord.date })}</div>
                <div>{t("kiosk.statusLine", { status: t(`attendanceStatus.${lastRecord.status as StaffAttendanceStatus}`) })}</div>
                {lastRecord.checkInTime && <div>{t("kiosk.checkInLine", { time: lastRecord.checkInTime })}</div>}
              </div>
            )}
            <p className="text-xs text-gray-400">{t("kiosk.resetting")}</p>
          </div>
        )}

        {step === "error" && (
          <div className="space-y-4">
            <div className="w-16 h-16 mx-auto bg-red-100 rounded-full flex items-center justify-center">
              <svg className="w-10 h-10 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <p className="text-xl font-bold text-red-700">{t("failed")}</p>
            <p className="text-sm text-gray-600">{message}</p>
            <p className="text-xs text-gray-400">{t("kiosk.resetting")}</p>
          </div>
        )}
      </div>
    </div>
  );
}
