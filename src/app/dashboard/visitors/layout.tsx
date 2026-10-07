'use client';

import { Users } from 'lucide-react';
import { useTranslations } from 'next-intl';
import FeatureGate from '@/components/dashboard/FeatureGate';

export default function VisitorsLayout({ children }: { children: React.ReactNode }) {
  const t = useTranslations('visitors');
  return (
    <FeatureGate
      flag="visitor_management"
      title={t('gate.title')}
      icon={<Users />}
    >
      {children}
    </FeatureGate>
  );
}
