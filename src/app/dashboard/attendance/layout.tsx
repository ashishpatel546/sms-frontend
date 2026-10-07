import { CalendarCheck } from 'lucide-react';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import FeatureGate from '@/components/dashboard/FeatureGate';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('attendance');
  return {
    title: t('title'),
  };
}

export default async function Layout({ children }: { children: React.ReactNode }) {
  const t = await getTranslations('attendance');
  return (
    <FeatureGate
      flag="attendance_management"
      title={t('title')}
      icon={<CalendarCheck />}
    >
      {children}
    </FeatureGate>
  );
}
