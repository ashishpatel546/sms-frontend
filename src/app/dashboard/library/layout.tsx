'use client';

import { BookOpen } from 'lucide-react';
import { useTranslations } from 'next-intl';
import FeatureGate from '@/components/dashboard/FeatureGate';

export default function LibraryLayout({ children }: { children: React.ReactNode }) {
  const t = useTranslations('library');
  return (
    <FeatureGate
      flag="library_management"
      title={t('gate.title')}
      icon={<BookOpen />}

    >
      {children}
    </FeatureGate>
  );
}
