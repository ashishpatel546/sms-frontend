'use client';

import { Pencil } from 'lucide-react';
import FeatureGate from '@/components/dashboard/FeatureGate';
import { useTranslations } from 'next-intl';

export default function HomeworkLayout({ children }: { children: React.ReactNode }) {
  const t = useTranslations('homework');
  return (
    <FeatureGate
      flag="homework_management"
      title={t('meta.title')}
      icon={<Pencil />}

    >
      {children}
    </FeatureGate>
  );
}
