"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import toast from "react-hot-toast";
import { Check, Languages, Loader2 } from "lucide-react";
import { API_BASE_URL } from "@/lib/api";
import { authFetch } from "@/lib/auth";
import { cn } from "@/lib/utils";
import { READ_ONLY_TITLE } from "@/lib/support-session";
import { LOCALES, LOCALE_NAMES, type Locale } from "@/i18n/config";
import { refreshSchoolLocale } from "@/i18n/actions";
import { useSchoolLocale } from "@/i18n/SchoolLocaleProvider";

/**
 * The school's portal language — what the app opens in for everyone here.
 * Super admin only (same gate as the rest of System settings); hub admins set
 * the same value from the school's profile in Colegio Hub.
 */
export function SchoolLanguageCard({ canEdit, readOnly }: { canEdit: boolean; readOnly: boolean }) {
    const t = useTranslations("settings.language");
    const router = useRouter();
    const current = useSchoolLocale();
    const [saving, setSaving] = useState<Locale | null>(null);
    const [, startTransition] = useTransition();

    const disabled = !canEdit || readOnly || saving !== null;

    const choose = async (next: Locale) => {
        if (next === current || disabled) return;
        setSaving(next);
        try {
            const res = await authFetch(`${API_BASE_URL}/school/language`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ defaultLanguage: next }),
            });
            if (!res.ok) throw new Error();
            await refreshSchoolLocale();
            toast.success(t("saved"));
            startTransition(() => router.refresh());
        } catch {
            toast.error(t("saveFailed"));
        } finally {
            setSaving(null);
        }
    };

    return (
        <section className="rounded-xl border border-line bg-surface p-5 shadow-soft lg:col-span-2">
            <div className="flex items-start gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-brand-tint text-brand">
                    <Languages className="size-4.5" aria-hidden />
                </span>
                <div className="min-w-0">
                    <h2 className="font-display text-[17px] font-semibold text-ink">{t("title")}</h2>
                    <p className="mt-0.5 max-w-2xl text-[13px] leading-relaxed text-ink-muted">{t("description")}</p>
                </div>
            </div>

            <div
                role="radiogroup"
                aria-label={t("title")}
                className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3"
            >
                {LOCALES.map((code) => {
                    const active = code === current;
                    return (
                        <button
                            key={code}
                            type="button"
                            role="radio"
                            aria-checked={active}
                            lang={code}
                            disabled={disabled && !active}
                            title={readOnly ? READ_ONLY_TITLE : undefined}
                            onClick={() => choose(code)}
                            className={cn(
                                "flex h-12 items-center gap-2.5 rounded-lg border px-3.5 text-left transition-colors",
                                active
                                    ? "border-brand bg-brand-tint"
                                    : "border-line enabled:cursor-pointer enabled:hover:bg-surface-secondary disabled:opacity-60",
                            )}
                        >
                            <span className="text-[14.5px] font-semibold text-ink">{LOCALE_NAMES[code]}</span>
                            {saving === code ? (
                                <Loader2 className="ml-auto size-4 shrink-0 animate-spin text-brand" aria-hidden />
                            ) : active ? (
                                <Check className="ml-auto size-4 shrink-0 text-brand" aria-hidden />
                            ) : null}
                        </button>
                    );
                })}
            </div>

            {!canEdit && <p className="mt-3 text-[12.5px] text-ink-muted">{t("readOnly")}</p>}
        </section>
    );
}
