import { IndianRupee } from 'lucide-react';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import FeatureGate from '@/components/dashboard/FeatureGate';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('fees');
  return {
    title: t('title'),
  };
}

export default async function Layout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations('fees');
  return (
    <FeatureGate
      flag="fee_management"
      title={t('title')}
      icon={<IndianRupee />}
    >
      {children}
    </FeatureGate>
  );
}
