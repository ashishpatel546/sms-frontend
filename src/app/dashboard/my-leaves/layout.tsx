'use client';

import FeatureGate from '@/components/dashboard/FeatureGate';

export default function MyLeavesLayout({ children }: { children: React.ReactNode }) {
  return (
    <FeatureGate
      flag="hr_portal"
      title="HR Portal"
      icon="🗓️"
      spinnerClass="border-teal-600"
    >
      {children}
    </FeatureGate>
  );
}
