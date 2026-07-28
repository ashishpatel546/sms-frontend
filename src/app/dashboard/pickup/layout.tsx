'use client';

import FeatureGate from '@/components/dashboard/FeatureGate';

export default function PickupLayout({ children }: { children: React.ReactNode }) {
  return (
    <FeatureGate
      flag="pickup_management"
      title="Student Pickup"
      icon="🚸"
      spinnerClass="border-cyan-600"
    >
      {children}
    </FeatureGate>
  );
}
