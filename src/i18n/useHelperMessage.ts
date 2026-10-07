"use client";

import { useTranslations } from "next-intl";
import type { HelperMessage } from "./helper-message";

/** Turns a HelperMessage from a src/lib helper into text in the reader's language. */
export function useHelperMessage() {
  const t = useTranslations("common.helper");
  return (m: HelperMessage) => t(m.key, m.values);
}
