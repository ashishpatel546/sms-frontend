'use client';

import FeatureGate from '@/components/dashboard/FeatureGate';

export default function MyAttendanceLayout({ children }: { children: React.ReactNode }) {
  return (
    <FeatureGate
      flag="hr_portal"
      title="HR Portal"
      icon="🕒"
      spinnerClass="border-emerald-600"
    >
      {children}
    </FeatureGate>
  );
}
