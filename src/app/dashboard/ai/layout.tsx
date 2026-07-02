'use client';

import { AiFeatureGate } from '@/components/ai/AiFeatureGate';

export default function AiLayout({ children }: { children: React.ReactNode }) {
  return <AiFeatureGate>{children}</AiFeatureGate>;
}
