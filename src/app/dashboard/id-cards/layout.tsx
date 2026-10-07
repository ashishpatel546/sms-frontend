'use client';

import { IdCard } from 'lucide-react';
import { useTranslations } from 'next-intl';
import FeatureGate from '@/components/dashboard/FeatureGate';

/**
 * `id_cards` ships switched OFF, so most schools land on the locked screen
 * rather than on a page whose every request would 403. FeatureGate keeps
 * "not on your plan" and "we could not check" apart, which is the difference
 * between calling support and refreshing.
 */
export default function IdCardsLayout({ children }: { children: React.ReactNode }) {
  const t = useTranslations('idCards.layout');
  return (
    <FeatureGate
      flag="id_cards"
      title={t('title')}
      icon={<IdCard />}
      description={t('description')}
    >
      {children}
    </FeatureGate>
  );
}
