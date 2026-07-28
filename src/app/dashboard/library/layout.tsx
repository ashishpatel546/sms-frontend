'use client';

import FeatureGate from '@/components/dashboard/FeatureGate';

export default function LibraryLayout({ children }: { children: React.ReactNode }) {
  return (
    <FeatureGate
      flag="library_management"
      title="Library Management"
      icon="📚"
      spinnerClass="border-lime-600"
    >
      {children}
    </FeatureGate>
  );
}
