'use client';

import { useEffect, useState } from 'react';
import QRCode from 'react-qr-code';
import { useTranslations } from 'next-intl';
import { Bus, Download } from 'lucide-react';

import { buttonVariants } from '@/components/ui/button';
import { useCrewAppRelease } from '@/components/transport/live/crewApp';
import { detectPlatform, type Platform } from '@/components/transport/live/trackerApp';
import { getSchoolSlug } from '@/lib/env';
import { useSchoolInfoState } from '@/lib/useSchoolInfo';
import { cn } from '@/lib/utils';

/**
 * Public download page for the Colegios Crew Android app (bus drivers and
 * assistants). The APK is not in a store; it is served from this portal's
 * public/downloads/. Open it on the crew phone, or scan it from a computer.
 */
export default function CrewAppPage() {
  const t = useTranslations('publicPages.crewApp');
  const release = useCrewAppRelease();
  const { info } = useSchoolInfoState();
  const [platform, setPlatform] = useState<Platform | null>(null);
  const [here, setHere] = useState('');
  const [slug, setSlug] = useState('');

  useEffect(() => {
    queueMicrotask(() => {
      setPlatform(detectPlatform());
      setHere(window.location.origin + window.location.pathname);
      setSlug(getSchoolSlug());
    });
  }, []);

  return (
    <div className="flex min-h-dvh justify-center bg-surface-sunk px-4 py-8">
      <div className="w-full max-w-md space-y-5">
        <header className="flex flex-col items-center text-center">
          <div className="mb-3 flex size-14 items-center justify-center rounded-2xl bg-brand text-white shadow-sm">
            <Bus className="size-7" />
          </div>
          <h1 className="font-display text-[24px] font-semibold tracking-[-0.02em] text-ink">{t('title')}</h1>
          <p className="mt-1 text-[14px] text-ink-muted">{info?.name ? t('subtitleSchool', { school: info.name }) : t('subtitle')}</p>
        </header>

        <section className="rounded-xl border border-line bg-surface p-5 shadow-sm">
          {release === undefined || platform === null ? (
            <div className="skeleton h-40 w-full rounded-lg" />
          ) : release === null ? (
            <p className="text-[14px] text-ink">{t('unavailable')}</p>
          ) : platform === 'ios' ? (
            <p className="text-[14px] text-ink">{t('iphone')}</p>
          ) : platform === 'other' ? (
            <div className="flex flex-col items-center gap-3 text-center">
              <p className="text-[14px] text-ink">{t('desktop')}</p>
              {here && (
                <div className="rounded-md border border-line bg-white p-3">
                  <QRCode value={here} size={176} level="M" />
                </div>
              )}
              <p className="tabular break-all text-[13px] text-ink-muted">{here}</p>
            </div>
          ) : (
            <ol className="space-y-4">
              <Step n={1} title={t('step1')} hint={t('step1Hint')}>
                <a href={release.apk} download className={cn(buttonVariants({ size: 'lg' }), 'w-full')}>
                  <Download />
                  {t('download', { version: release.versionName, size: (release.size / 1_048_576).toFixed(1) })}
                </a>
              </Step>
              <Step n={2} title={t('step2')} hint={t('step2Hint')} />
              <Step n={3} title={t('step3')} hint={t('step3Hint')}>
                {slug && <p className="tabular w-fit rounded-md bg-surface-inset px-3 py-1.5 text-[16px] font-semibold text-ink">{slug}</p>}
              </Step>
              <Step n={4} title={t('step4')} hint={t('step4Hint')} />
            </ol>
          )}
        </section>

        <p className="text-center text-[12.5px] text-ink-muted">{t('who')}</p>
      </div>
    </div>
  );
}

function Step({ n, title, hint, children }: { n: number; title: string; hint: string; children?: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="tabular flex size-6 shrink-0 items-center justify-center rounded-full bg-surface-inset text-[12px] font-semibold text-ink">{n}</span>
      <div className="min-w-0 flex-1 space-y-1.5">
        <p className="text-[14px] font-medium text-ink">{title}</p>
        <p className="text-[12.5px] text-ink-muted">{hint}</p>
        {children}
      </div>
    </li>
  );
}
