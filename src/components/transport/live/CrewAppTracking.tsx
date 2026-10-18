'use client';

import * as React from 'react';
import useSWR from 'swr';
import { useTranslations } from 'next-intl';
import { BatteryMedium, BatteryWarning, MapPinOff, Smartphone } from 'lucide-react';

import { fetchTripTracker } from '@/lib/transport-api';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Ago } from './Ago';
import { crewApp, useCrewAppStatus } from './crewApp';

/** No position at the server this long after the app started: say so. */
const FIRST_FIX_GRACE_MS = 60_000;

/**
 * Trip screen inside our crew app: background sharing starts by itself
 * when the trip is running and stops when it is finished. Shows what the
 * school sees (last position, battery) and fixes for the two things that
 * stop sharing on a locked phone: location not allowed "All the time",
 * and battery optimisation.
 */
export function CrewAppTracking({ tripId, running }: { tripId: number; running: boolean }) {
  const t = useTranslations('transport.live.crewApp');
  const tt = useTranslations('transport.live.tracker');
  const { data } = useSWR(['trip-tracker', tripId], () => fetchTripTracker(tripId), {
    refreshInterval: running ? 15_000 : 0,
  });
  const status = useCrewAppStatus();
  const asked = React.useRef(false);
  const [startedAt, setStartedAt] = React.useState<number | null>(null);
  const [now, setNow] = React.useState(() => Date.now());

  const key = data?.key ?? null;
  const mine = !!status?.tracking && !!key && status.key === key;
  const label = data ? t('notification', { vehicle: data.vehicle }) : '';

  const start = React.useCallback(() => {
    if (!key) return;
    crewApp()?.start(key, label);
    setStartedAt(Date.now());
  }, [key, label]);

  // Start once per visit while the trip runs; the crew can retry by hand.
  React.useEffect(() => {
    if (!running || !status || !key || mine || asked.current) return;
    asked.current = true;
    queueMicrotask(start);
  }, [running, status, key, mine, start]);

  // Trip finished on this screen (or by the office): stop this bus's sharing.
  React.useEffect(() => {
    if (!running && mine && key) crewApp()?.stop(key);
  }, [running, mine, key]);

  React.useEffect(() => {
    if (!startedAt) return;
    const id = window.setInterval(() => setNow(Date.now()), 10_000);
    return () => window.clearInterval(id);
  }, [startedAt]);

  if (!running || !status || !data) return null;

  const fixes: React.ReactNode[] = [];
  if (status.error === 'PERMISSION_DENIED' || !status.backgroundLocation) {
    fixes.push(
      <Fix key="loc" icon={<MapPinOff className="size-4 shrink-0" />} text={t('permission')}>
        <Button variant="outline" size="sm" onClick={() => crewApp()?.openAppSettings()}>
          {t('openSettings')}
        </Button>
        {!mine && (
          <Button variant="attn" size="sm" onClick={start}>
            {t('tryAgain')}
          </Button>
        )}
      </Fix>,
    );
  }
  if (!status.batteryUnrestricted) {
    fixes.push(
      <Fix key="bat" icon={<BatteryWarning className="size-4 shrink-0" />} text={t('battery')}>
        <Button variant="outline" size="sm" onClick={() => crewApp()?.fixBattery()}>
          {t('allow')}
        </Button>
      </Fix>,
    );
  }

  let head: React.ReactNode;
  if (!mine) {
    head = (
      <Strip tone="warn">
        <span className="min-w-0 flex-1">{t('off')}</span>
        <Button variant="attn" size="sm" onClick={start}>
          {t('start')}
        </Button>
      </Strip>
    );
  } else if (data.active) {
    head = (
      <Strip tone="ok">
        <span className="font-medium">{t('sharing')}</span>
        {data.lastSeenAt && (
          <span className="text-[12px]">
            · <Ago at={data.lastSeenAt} />
          </span>
        )}
        {data.battery != null && (
          <span className="inline-flex items-center gap-1 text-[12px]">
            · <BatteryMedium className="size-3.5" /> {data.battery}%
          </span>
        )}
        <span className="basis-full pl-6 text-[12px]">{tt('canLock')}</span>
      </Strip>
    );
  } else {
    const late = startedAt === null || now - startedAt > FIRST_FIX_GRACE_MS;
    head = (
      <Strip tone={late ? 'warn' : 'neutral'}>
        <span className="min-w-0 flex-1">{late ? t('notReaching') : t('waiting')}</span>
      </Strip>
    );
  }

  return (
    <div className="space-y-2" role="status">
      {head}
      {fixes}
    </div>
  );
}

function Strip({ tone, children }: { tone: 'ok' | 'warn' | 'neutral'; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border px-3 py-2 text-[13px]',
        tone === 'ok' && 'border-accent-success-edge bg-accent-success-tint text-accent-success-deep',
        tone === 'warn' && 'border-accent-warn-edge bg-accent-warn-tint text-accent-warn-deep',
        tone === 'neutral' && 'border-line bg-surface text-ink-muted',
      )}
    >
      <Smartphone className="size-4 shrink-0" />
      {children}
    </div>
  );
}

function Fix({ icon, text, children }: { icon: React.ReactNode; text: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-accent-warn-edge bg-accent-warn-tint px-3 py-2 text-[13px] text-accent-warn-deep">
      {icon}
      <span className="min-w-0 flex-1">{text}</span>
      {children}
    </div>
  );
}
