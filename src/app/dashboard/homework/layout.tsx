'use client';

import FeatureGate from '@/components/dashboard/FeatureGate';

export default function HomeworkLayout({ children }: { children: React.ReactNode }) {
  return (
    <FeatureGate
      flag="homework_management"
      title="Homework"
      icon="📝"
      spinnerClass="border-pink-600"
    >
      {children}
    </FeatureGate>
  );
}
