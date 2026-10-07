"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Popover } from "@base-ui/react/popover";
import { Check, Languages, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import { cn } from "@/lib/utils";
import { LOCALES, LOCALE_NAMES, type Locale } from "@/i18n/config";
import { setUserLocale } from "@/i18n/actions";
import { useSchoolLocale, useUserLocale } from "@/i18n/SchoolLocaleProvider";

/* ═══════════════════════════════════════════════════════════════════════════
   THE LANGUAGE PICKER

   The portal opens in the school's language. This lets one person choose a
   different language for themselves on this device (a cookie), or go back to
   following the school's — which matters because the school can change its
   language later, and someone who never chose should move with it.

   Each language is named in itself (हिन्दी, বাংলা), so a person who cannot
   read the current language can still find their own.
   ═══════════════════════════════════════════════════════════════════════════ */

export function LanguagePicker({
    className,
    /** Rendered on the rail or a coloured bar rather than on paper. */
    onInk = false,
}: {
    className?: string;
    onInk?: boolean;
}) {
    const t = useTranslations("common.language");
    const locale = useLocale();
    const router = useRouter();
    const schoolLocale = useSchoolLocale();
    const [open, setOpen] = useState(false);
    const override = useUserLocale();
    const [pending, startTransition] = useTransition();

    const choose = (next: Locale | null) => {
        setOpen(false);
        if (next === override) return;
        startTransition(async () => {
            try {
                await setUserLocale(next);
                router.refresh();
            } catch {
                toast.error(t("changeFailed"));
            }
        });
    };

    const optionClass = (active: boolean) =>
        cn(
            "flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors",
            active ? "bg-brand-tint" : "hover:bg-surface-secondary",
        );

    return (
        <Popover.Root open={open} onOpenChange={setOpen}>
            <Popover.Trigger
                aria-label={t("label")}
                title={t("label")}
                className={cn(
                    "flex size-9 cursor-pointer items-center justify-center rounded-lg border transition-colors",
                    "focus-visible:ring-3 focus-visible:ring-brand/16 focus-visible:outline-none",
                    onInk
                        ? "border-rail-line bg-rail-selected text-rail-ink hover:bg-rail-hover"
                        : "border-line bg-surface-secondary text-ink-muted hover:bg-surface-inset hover:text-ink",
                    className,
                )}
            >
                {pending ? (
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                ) : (
                    <Languages className="size-4" aria-hidden />
                )}
            </Popover.Trigger>

            <Popover.Portal>
                <Popover.Positioner side="bottom" align="end" sideOffset={8} className="z-50">
                    <Popover.Popup
                        className={cn(
                            "w-64 rounded-xl border border-line bg-popover p-2 text-popover-foreground",
                            "shadow-glass outline-none",
                            "data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95",
                            "data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
                        )}
                    >
                        <Popover.Title className="eyebrow px-2.5 pt-1 pb-1.5">{t("label")}</Popover.Title>
                        <div role="radiogroup" aria-label={t("label")} className="flex flex-col gap-0.5">
                            <button
                                type="button"
                                role="radio"
                                aria-checked={override === null}
                                onClick={() => choose(null)}
                                className={optionClass(override === null)}
                            >
                                <span className="min-w-0">
                                    <span className="block truncate text-[13px] font-semibold text-ink">
                                        {t("followSchool")} · {LOCALE_NAMES[schoolLocale]}
                                    </span>
                                    <span className="block truncate text-[11px] text-ink-muted">
                                        {t("followSchoolHint")}
                                    </span>
                                </span>
                                {override === null && (
                                    <Check className="ml-auto size-4 shrink-0 text-brand" aria-hidden />
                                )}
                            </button>

                            <div aria-hidden className="mx-2.5 my-1 border-t border-line" />

                            {LOCALES.map((code) => {
                                const active = override === code;
                                return (
                                    <button
                                        key={code}
                                        type="button"
                                        role="radio"
                                        aria-checked={active}
                                        lang={code}
                                        onClick={() => choose(code)}
                                        className={optionClass(active)}
                                    >
                                        <span className="text-[13.5px] font-semibold text-ink">
                                            {LOCALE_NAMES[code]}
                                        </span>
                                        {active && (
                                            <Check className="ml-auto size-4 shrink-0 text-brand" aria-hidden />
                                        )}
                                        {!active && override === null && code === locale && (
                                            <span className="ml-auto size-1.5 rounded-full bg-ink-faint" aria-hidden />
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </Popover.Popup>
                </Popover.Positioner>
            </Popover.Portal>
        </Popover.Root>
    );
}

export default LanguagePicker;
