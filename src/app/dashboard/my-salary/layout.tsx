'use client';

import FeatureGate from '@/components/dashboard/FeatureGate';

export default function MySalaryLayout({ children }: { children: React.ReactNode }) {
  return (
    <FeatureGate
      flag="hr_portal"
      title="HR Portal"
      icon="💰"
      spinnerClass="border-rose-600"
    >
      {children}
    </FeatureGate>
  );
}
