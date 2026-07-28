'use client';

import FeatureGate from '@/components/dashboard/FeatureGate';

export default function HrLayout({ children }: { children: React.ReactNode }) {
  return (
    <FeatureGate
      flag="hr_portal"
      title="HR Portal"
      icon="🏢"
      spinnerClass="border-blue-600"
    >
      {children}
    </FeatureGate>
  );
}
