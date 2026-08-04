'use client';

import { Clock } from 'lucide-react';
import FeatureGate from '@/components/dashboard/FeatureGate';

export default function MyAttendanceLayout({ children }: { children: React.ReactNode }) {
  return (
    <FeatureGate
      flag="hr_portal"
      title="HR Portal"
      icon={<Clock />}
    >
      {children}
    </FeatureGate>
  );
}
