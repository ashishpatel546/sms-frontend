import { useTranslations } from "next-intl";
import { InfoBanner } from "@/components/ui/InfoBanner";

/** Marketing note shown on AI tool pages explaining why EduSphere AI beats generic chatbots. */
export function AiValueBanner() {
  const t = useTranslations("ai.valueBanner");
  return (
    <InfoBanner title={t("title")} variant="indigo">
      {t("body")}
    </InfoBanner>
  );
}
