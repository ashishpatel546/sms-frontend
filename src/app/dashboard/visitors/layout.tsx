'use client';

import FeatureGate from '@/components/dashboard/FeatureGate';

export default function VisitorsLayout({ children }: { children: React.ReactNode }) {
  return (
    <FeatureGate
      flag="visitor_management"
      title="Visitor Management"
      icon="🛂"
      spinnerClass="border-teal-600"
    >
      {children}
    </FeatureGate>
  );
}
