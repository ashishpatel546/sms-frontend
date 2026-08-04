'use client';

import { FileText } from 'lucide-react';
import FeatureGate from '@/components/dashboard/FeatureGate';

export default function ExaminationsLayout({ children }: { children: React.ReactNode }) {
  return (
    <FeatureGate
      flag="exam_management"
      title="Examinations"
      icon={<FileText />}
    >
      {children}
    </FeatureGate>
  );
}
