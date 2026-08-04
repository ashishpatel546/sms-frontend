'use client';

import { Users } from 'lucide-react';
import FeatureGate from '@/components/dashboard/FeatureGate';

export default function VisitorsLayout({ children }: { children: React.ReactNode }) {
  return (
    <FeatureGate
      flag="visitor_management"
      title="Visitor Management"
      icon={<Users />}
    >
      {children}
    </FeatureGate>
  );
}
