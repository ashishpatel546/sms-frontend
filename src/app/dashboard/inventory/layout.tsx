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
import FeatureGate from '@/components/dashboard/FeatureGate';
import { PageTabs } from '@/components/ui/FilterBar';

// Icons say what each tab *does* before the word is read: the catalogue is
// boxes on a shelf, Sell is the cart in hand, Sales is the receipt that
// resulted, Issue/Return is stock going out and coming back.
const SECTIONS = [
  { value: '', label: 'Items', icon: <Boxes /> },
  { value: 'sell', label: 'Sell', icon: <ShoppingCart /> },
  { value: 'sales', label: 'Sales', icon: <Receipt /> },
  { value: 'issuances', label: 'Issue / Return', icon: <ArrowLeftRight /> },
  { value: 'reports', label: 'Reports', icon: <BarChart2 /> },
  { value: 'settings', label: 'Settings', icon: <Settings /> },
] as const;

/**
 * `inventory_management` ships switched OFF, so most schools land on the
 * locked screen. The sub-nav below the FeatureGate is what turns the six
 * inventory routes into one module in the sidebar's eyes — Items is the
 * landing route ('') and everything else hangs off it.
 */
export default function InventoryLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  const segment = pathname.replace(/^\/dashboard\/inventory\/?/, '').split('/')[0] ?? '';
  const active = SECTIONS.some((s) => s.value === segment) ? segment : '';

  return (
    <FeatureGate
      flag="inventory_management"
      title="Inventory & Store"
      icon={<Boxes />}
      description="Track stock, scan a QR or barcode to sell or lend items at the counter, and run monetary reports."
    >
      <div className="mx-auto w-full max-w-wide px-3 pt-4 sm:px-5 sm:pt-6">
        <PageTabs
          value={active}
          onValueChange={(v) => router.push(`/dashboard/inventory${v ? `/${v}` : ''}`)}
          options={SECTIONS.map((s) => ({ value: s.value, label: s.label, icon: s.icon }))}
        />
      </div>
      {children}
    </FeatureGate>
  );
}
