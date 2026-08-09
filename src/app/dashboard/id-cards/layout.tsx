'use client';

import { IdCard } from 'lucide-react';
import FeatureGate from '@/components/dashboard/FeatureGate';

/**
 * `id_cards` ships switched OFF, so most schools land on the locked screen
 * rather than on a page whose every request would 403. FeatureGate keeps
 * "not on your plan" and "we could not check" apart, which is the difference
 * between calling support and refreshing.
 */
export default function IdCardsLayout({ children }: { children: React.ReactNode }) {
  return (
    <FeatureGate
      flag="id_cards"
      title="ID Cards"
      icon={<IdCard />}
      description="Print CR80 identity cards for students and staff, with a QR the gate can verify."
    >
      {children}
    </FeatureGate>
  );
}
