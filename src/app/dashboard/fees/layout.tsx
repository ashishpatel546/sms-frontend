import type { Metadata } from 'next';
import FeatureGate from '@/components/dashboard/FeatureGate';

export const metadata: Metadata = {
  title: 'Fees',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <FeatureGate
      flag="fee_management"
      title="Fees"
      icon="💰"
      spinnerClass="border-rose-600"
    >
      {children}
    </FeatureGate>
  );
}
