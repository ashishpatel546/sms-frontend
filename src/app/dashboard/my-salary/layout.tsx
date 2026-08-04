'use client';

import { IndianRupee } from 'lucide-react';
import FeatureGate from '@/components/dashboard/FeatureGate';

export default function MySalaryLayout({ children }: { children: React.ReactNode }) {
  return (
    <FeatureGate
      flag="hr_portal"
      title="HR Portal"
      icon={<IndianRupee />}
    >
      {children}
    </FeatureGate>
  );
}
