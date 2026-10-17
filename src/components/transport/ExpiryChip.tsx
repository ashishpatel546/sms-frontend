'use client';

import { useTranslations } from 'next-intl';
import { StatusChip } from '@/components/ui/StatusChip';

/** Vermilion once expired or due within a week, marigold inside the reminder window. */
export function ExpiryChip({ daysLeft }: { daysLeft: number }) {
  const t = useTranslations('transport.expiry');
  const label =
    daysLeft < 0 ? t('expired', { days: -daysLeft }) : daysLeft === 0 ? t('today') : t('in', { days: daysLeft });
  return <StatusChip size="sm" pigment={daysLeft <= 7 ? 'danger' : 'attn'} label={label} />;
}
