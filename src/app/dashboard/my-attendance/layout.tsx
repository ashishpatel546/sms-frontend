'use client';

import { Clock } from 'lucide-react';
import FeatureGate from '@/components/dashboard/FeatureGate';
import { useTranslations } from 'next-intl';

export default function MyAttendanceLayout({ children }: { children: React.ReactNode }) {
  const t = useTranslations('hr');
  return (
    <FeatureGate
      flag="hr_portal"
      title={t("portalTitle")}
      icon={<Clock />}
    >
      {children}
    </FeatureGate>
  );
}
