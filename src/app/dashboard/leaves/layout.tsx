'use client';

import { CalendarDays } from 'lucide-react';
import { useTranslations } from 'next-intl';
import FeatureGate from '@/components/dashboard/FeatureGate';

export default function LeavesLayout({ children }: { children: React.ReactNode }) {
  const t = useTranslations('leaves');
  return (
    <FeatureGate
      flag="leave_management"
      title={t('title')}
      icon={<CalendarDays />}
    >
      {children}
    </FeatureGate>
  );
}
