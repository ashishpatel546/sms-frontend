"use client";

import { useTranslations } from "next-intl";

/** A role code (SUPER_ADMIN) as the reader's language names it. */
export function useRoleLabel(role: string | undefined | null): string {
    const t = useTranslations("nav.role");
    if (!role) return "";
    const key = role as Parameters<typeof t>[0];
    return t.has(key) ? t(key) : role.replace(/_/g, " ");
}
