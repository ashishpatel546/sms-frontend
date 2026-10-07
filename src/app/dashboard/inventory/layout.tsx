'use client';

import { usePathname, useRouter } from 'next/navigation';
import {
  ArrowLeftRight,
  BarChart2,
  Boxes,
  Receipt,
  Settings,
  ShoppingCart,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import FeatureGate from '@/components/dashboard/FeatureGate';
import { PageTabs } from '@/components/ui/FilterBar';

// Icons say what each tab *does* before the word is read: the catalogue is
// boxes on a shelf, Sell is the cart in hand, Sales is the receipt that
// resulted, Issue/Return is stock going out and coming back.
const SECTIONS = [
  { value: '', key: 'items', icon: <Boxes /> },
  { value: 'sell', key: 'sell', icon: <ShoppingCart /> },
  { value: 'sales', key: 'sales', icon: <Receipt /> },
  { value: 'issuances', key: 'issuances', icon: <ArrowLeftRight /> },
  { value: 'reports', key: 'reports', icon: <BarChart2 /> },
  { value: 'settings', key: 'settings', icon: <Settings /> },
] as const;

/**
 * `inventory_management` ships switched OFF, so most schools land on the
 * locked screen. The sub-nav below the FeatureGate is what turns the six
 * inventory routes into one module in the sidebar's eyes — Items is the
 * landing route ('') and everything else hangs off it.
 */
export default function InventoryLayout({ children }: { children: React.ReactNode }) {
  const t = useTranslations('inventory');
  const pathname = usePathname();
  const router = useRouter();

  const segment = pathname.replace(/^\/dashboard\/inventory\/?/, '').split('/')[0] ?? '';
  const active = SECTIONS.some((s) => s.value === segment) ? segment : '';

  return (
    <FeatureGate
      flag="inventory_management"
      title={t('gate.title')}
      icon={<Boxes />}
      description={t('gate.description')}
    >
      <div className="mx-auto w-full max-w-wide px-3 pt-4 sm:px-5 sm:pt-6">
        <PageTabs
          value={active}
          onValueChange={(v) => router.push(`/dashboard/inventory${v ? `/${v}` : ''}`)}
          options={SECTIONS.map((s) => ({ value: s.value, label: t(`tabs.${s.key}`), icon: s.icon }))}
        />
      </div>
      {children}
    </FeatureGate>
  );
}
