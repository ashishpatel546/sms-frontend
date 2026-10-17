'use client';

import { usePathname, useRouter } from 'next/navigation';
import { Bus, History, LayoutDashboard, Map, MapPinned, Radio, Settings, Users } from 'lucide-react';
import { useFeatureFlag } from '@/lib/useSchoolFeatures';
import { useTranslations } from 'next-intl';
import FeatureGate from '@/components/dashboard/FeatureGate';
import { PageTabs } from '@/components/ui/FilterBar';
import { EmptyState } from '@/components/ui/EmptyState';
import { useRbac } from '@/lib/rbac';

// Overview is the landing route (''); the rest hang off it like inventory's
// sub-nav, so the sidebar's single Transport item stays active throughout.
const SECTIONS = [
  { value: '', key: 'overview', icon: <LayoutDashboard /> },
  { value: 'today', key: 'today', icon: <Radio /> },
  { value: 'live', key: 'live', icon: <MapPinned /> },
  { value: 'trips', key: 'trips', icon: <History /> },
  { value: 'students', key: 'students', icon: <Users /> },
  { value: 'routes', key: 'routes', icon: <Map /> },
  { value: 'vehicles', key: 'vehicles', icon: <Bus /> },
  { value: 'settings', key: 'settings', icon: <Settings /> },
] as const;

export default function TransportLayout({ children }: { children: React.ReactNode }) {
  const t = useTranslations('transport');
  const pathname = usePathname();
  const router = useRouter();
  const rbac = useRbac();
  const liveOn = useFeatureFlag('transport_live_tracking').enabled === true;
  const sections = SECTIONS.filter((s) => s.value !== 'live' || liveOn);

  const segment = pathname.replace(/^\/dashboard\/transport\/?/, '').split('/')[0] ?? '';
  const active = SECTIONS.some((s) => s.value === segment) ? segment : '';

  return (
    <FeatureGate
      flag="transport_management"
      title={t('gate.title')}
      icon={<Bus />}
      description={t('gate.description')}
    >
      {rbac.canManageTransport ? (
        <>
          <div className="mx-auto w-full max-w-wide px-3 pt-4 sm:px-5 sm:pt-6">
            <PageTabs
              value={active}
              onValueChange={(v) => router.push(`/dashboard/transport${v ? `/${v}` : ''}`)}
              options={sections.map((s) => ({ value: s.value, label: t(`tabs.${s.key}`), icon: s.icon }))}
            />
          </div>
          {children}
        </>
      ) : (
        <EmptyState icon={<Bus />} title={t('gate.title')} description={t('noAccess')} />
      )}
    </FeatureGate>
  );
}
