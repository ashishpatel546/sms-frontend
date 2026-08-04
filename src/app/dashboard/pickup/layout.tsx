'use client';

import { QrCode } from 'lucide-react';
import FeatureGate from '@/components/dashboard/FeatureGate';

export default function PickupLayout({ children }: { children: React.ReactNode }) {
  return (
    <FeatureGate
      flag="pickup_management"
      title="Student Pickup"
      icon={<QrCode />}
    >
      {children}
    </FeatureGate>
  );
}
