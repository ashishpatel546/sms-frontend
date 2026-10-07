'use client';

import { QrCode } from 'lucide-react';
import { useTranslations } from 'next-intl';
import FeatureGate from '@/components/dashboard/FeatureGate';

export default function PickupLayout({ children }: { children: React.ReactNode }) {
  const t = useTranslations('pickup');
  return (
    <FeatureGate
      flag="pickup_management"
      title={t('gate.title')}
      icon={<QrCode />}
    >
      {children}
    </FeatureGate>
  );
}
