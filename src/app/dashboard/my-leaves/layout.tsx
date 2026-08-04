'use client';

import { CalendarDays } from 'lucide-react';
import FeatureGate from '@/components/dashboard/FeatureGate';

export default function MyLeavesLayout({ children }: { children: React.ReactNode }) {
  return (
    <FeatureGate
      flag="hr_portal"
      title="HR Portal"
      icon={<CalendarDays />}
    >
      {children}
    </FeatureGate>
  );
}
