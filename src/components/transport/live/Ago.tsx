'use client';

import * as React from 'react';
import { useTranslations } from 'next-intl';
import { secondsSince } from '@/lib/transport-api';

/**
 * "Updated 12 s ago", ticking. Stale positions say "Last seen …" in the
 * attention colour, so an old dot is never mistaken for a live one.
 */
export function Ago({ at, stale }: { at: string; stale?: boolean }) {
  const t = useTranslations('transport.live');
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 5_000);
    return () => window.clearInterval(id);
  }, []);
  const s = secondsSince(at, now);
  const when = s < 60 ? t('seconds', { count: s }) : t('minutes', { count: Math.round(s / 60) });
  return (
    <span className={stale ? 'font-medium text-accent-warn-deep' : 'text-ink-muted'}>
      {stale ? t('lastSeen', { when }) : t('updated', { when })}
    </span>
  );
}
