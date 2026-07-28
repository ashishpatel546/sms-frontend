import type { Metadata } from 'next';
import FeatureGate from '@/components/dashboard/FeatureGate';

export const metadata: Metadata = {
  title: 'Attendance',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <FeatureGate
      flag="attendance_management"
      title="Attendance"
      icon="✅"
      spinnerClass="border-green-600"
    >
      {children}
    </FeatureGate>
  );
}
