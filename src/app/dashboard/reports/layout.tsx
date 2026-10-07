'use client';

import { BarChart2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import FeatureGate from '@/components/dashboard/FeatureGate';

export default function ReportsLayout({ children }: { children: React.ReactNode }) {
  const t = useTranslations('reports');
  return (
    <FeatureGate
      flag="reports_analytics"
      title={t('title')}
      icon={<BarChart2 />}
    >
      {children}
    </FeatureGate>
  );
}
