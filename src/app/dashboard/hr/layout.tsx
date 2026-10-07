'use client';

import { Building2 } from 'lucide-react';
import FeatureGate from '@/components/dashboard/FeatureGate';
import { useTranslations } from 'next-intl';

export default function HrLayout({ children }: { children: React.ReactNode }) {
  const t = useTranslations('hr');
  return (
    <FeatureGate
      flag="hr_portal"
      title={t("portalTitle")}
      icon={<Building2 />}
    >
      {children}
    </FeatureGate>
  );
}
