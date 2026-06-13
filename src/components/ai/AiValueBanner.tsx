import { InfoBanner } from "@/components/ui/InfoBanner";

/** Marketing note shown on AI tool pages explaining why EduSphere AI beats generic chatbots. */
export function AiValueBanner() {
  return (
    <InfoBanner title="✨ Built for your classroom" variant="indigo">
      EduSphere AI understands your request and tailors every output to your
      class, subject, board and language — print-ready and curriculum-aligned,
      unlike generic chatbots.
    </InfoBanner>
  );
}
