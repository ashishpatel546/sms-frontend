'use client';

import FeatureGate from '@/components/dashboard/FeatureGate';

export default function ReportsLayout({ children }: { children: React.ReactNode }) {
  return (
    <FeatureGate
      flag="reports_analytics"
      title="Reports"
      icon="📊"
      spinnerClass="border-amber-600"
    >
      {children}
    </FeatureGate>
  );
}
