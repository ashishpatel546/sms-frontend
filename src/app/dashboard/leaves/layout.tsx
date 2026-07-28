'use client';

import FeatureGate from '@/components/dashboard/FeatureGate';

export default function LeavesLayout({ children }: { children: React.ReactNode }) {
  return (
    <FeatureGate
      flag="leave_management"
      title="Student Leaves"
      icon="🗓️"
      spinnerClass="border-teal-600"
    >
      {children}
    </FeatureGate>
  );
}
