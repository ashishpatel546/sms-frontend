'use client';

import { BookOpen } from 'lucide-react';
import FeatureGate from '@/components/dashboard/FeatureGate';

export default function LibraryLayout({ children }: { children: React.ReactNode }) {
  return (
    <FeatureGate
      flag="library_management"
      title="Library Management"
      icon={<BookOpen />}

    >
      {children}
    </FeatureGate>
  );
}
