'use client';

import { FileText } from 'lucide-react';
import { useTranslations } from 'next-intl';
import FeatureGate from '@/components/dashboard/FeatureGate';

export default function ExaminationsLayout({ children }: { children: React.ReactNode }) {
  const t = useTranslations('exams');
  return (
    <FeatureGate
      flag="exam_management"
      title={t('title')}
      icon={<FileText />}
    >
      {children}
    </FeatureGate>
  );
}
