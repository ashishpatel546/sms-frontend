'use client';

import { use } from 'react';
import { Bus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import FeatureGate from '@/components/dashboard/FeatureGate';
import { TripScreen } from '@/components/transport/trip/TripScreen';

/**
 * The crew's trip screen. It lives outside /dashboard/transport because
 * that section is for transport managers; drivers and assistants reach this
 * from their home screen. The API decides who may see the trip.
 */
export default function CrewTripPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const t = useTranslations('transport');
  return (
    <FeatureGate flag="transport_management" title={t('gate.title')} icon={<Bus />} description={t('gate.description')}>
      <TripScreen tripId={Number(id)} backHref="/dashboard" />
    </FeatureGate>
  );
}
