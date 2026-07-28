'use client';

import FeatureGate from '@/components/dashboard/FeatureGate';

export default function ExaminationsLayout({ children }: { children: React.ReactNode }) {
  return (
    <FeatureGate
      flag="exam_management"
      title="Examinations"
      icon="📋"
      spinnerClass="border-purple-600"
    >
      {children}
    </FeatureGate>
  );
}
