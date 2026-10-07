'use client';

import { IndianRupee } from 'lucide-react';
import FeatureGate from '@/components/dashboard/FeatureGate';
import { useTranslations } from 'next-intl';

export default function MySalaryLayout({ children }: { children: React.ReactNode }) {
  const t = useTranslations('hr');
  return (
    <FeatureGate
      flag="hr_portal"
      title={t("portalTitle")}
      icon={<IndianRupee />}
    >
      {children}
    </FeatureGate>
  );
}
