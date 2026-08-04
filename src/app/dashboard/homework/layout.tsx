'use client';

import { Pencil } from 'lucide-react';
import FeatureGate from '@/components/dashboard/FeatureGate';

export default function HomeworkLayout({ children }: { children: React.ReactNode }) {
  return (
    <FeatureGate
      flag="homework_management"
      title="Homework"
      icon={<Pencil />}

    >
      {children}
    </FeatureGate>
  );
}
