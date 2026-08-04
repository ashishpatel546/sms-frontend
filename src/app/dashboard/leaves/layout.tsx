'use client';

import { CalendarDays } from 'lucide-react';
import FeatureGate from '@/components/dashboard/FeatureGate';

export default function LeavesLayout({ children }: { children: React.ReactNode }) {
  return (
    <FeatureGate
      flag="leave_management"
      title="Student Leaves"
      icon={<CalendarDays />}
    >
      {children}
    </FeatureGate>
  );
}
