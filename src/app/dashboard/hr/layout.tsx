'use client';

import { Building2 } from 'lucide-react';
import FeatureGate from '@/components/dashboard/FeatureGate';

export default function HrLayout({ children }: { children: React.ReactNode }) {
  return (
    <FeatureGate
      flag="hr_portal"
      title="HR Portal"
      icon={<Building2 />}
    >
      {children}
    </FeatureGate>
  );
}
