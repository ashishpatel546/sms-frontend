'use client';

import { BarChart2 } from 'lucide-react';
import FeatureGate from '@/components/dashboard/FeatureGate';

export default function ReportsLayout({ children }: { children: React.ReactNode }) {
  return (
    <FeatureGate
      flag="reports_analytics"
      title="Reports"
      icon={<BarChart2 />}
    >
      {children}
    </FeatureGate>
  );
}
