'use client';

import * as React from 'react';
import useSWR from 'swr';
import { useTranslations } from 'next-intl';
import toast from 'react-hot-toast';
import { Camera, QrCode, UserCheck, UserRound } from 'lucide-react';

import {
  confirmTripPickup,
  errorMessage,
  fetchGuardians,
  recordTripEvent,
  verifyTripPickup,
  type PickupPass,
  type TripDetail,
  type TripStudent,
} from '@/lib/transport-api';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/Field';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

/**
 * Evening handover at the stop. A registered parent or guardian is picked
 * from the student record (with photos where the school has them) — no QR.
 * Anyone else must show the parent's pickup QR, then say their name and PIN.
 */
export function HandoverDialog({
  trip,
  student,
  onClose,
  onDone,
}: {
  trip: TripDetail;
  student: TripStudent;
  onClose: () => void;
  onDone: (t: TripDetail) => void;
}) {
  const t = useTranslations('transport.trip.handover');
  const tc = useTranslations('common');
  const [mode, setMode] = React.useState<'pick' | 'qr'>('pick');
  const [saving, setSaving] = React.useState(false);
  const { data, isLoading } = useSWR(['guardians', trip.id, student.studentId], () => fetchGuardians(trip.id, student.studentId));

  const handTo = async (name: string, relation: string) => {
    setSaving(true);
    try {
      const next = await recordTripEvent(trip.id, {
        type: 'HANDED_TO_GUARDIAN',
        studentIds: [student.studentId],
        handedToName: name,
        handedToRelation: relation,
      });
      toast.success(t('done', { name: student.name, person: name }));
      onDone(next);
    } catch (e) {
      toast.error(errorMessage(e, t('failed')));
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto overflow-x-hidden sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('title', { name: student.name })}</DialogTitle>
        </DialogHeader>

        {mode === 'pick' ? (
          <div className="mt-2 space-y-2 px-0.5">
            {data?.studentPhotoUrl && (
              <div className="mb-3 flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed S3 URL */}
                <img src={data.studentPhotoUrl} alt="" className="size-14 rounded-lg object-cover" />
                <p className="text-[13px] text-ink-muted">{t('checkChild')}</p>
              </div>
            )}
            {isLoading && <div className="skeleton h-16 w-full rounded-lg" />}
            {data && data.people.length === 0 && <p className="text-[13px] text-ink-muted">{t('noneOnFile')}</p>}
            {data?.people.map((p) => (
              <button
                key={p.relation}
                type="button"
                disabled={saving}
                onClick={() => handTo(p.name, p.relation)}
                className="flex min-h-16 w-full items-center gap-3 rounded-lg border border-line bg-surface px-3 py-2 text-left hover:border-brand disabled:opacity-60"
              >
                {p.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- short-lived signed S3 URL
                  <img src={p.photoUrl} alt="" className="size-12 shrink-0 rounded-full object-cover" />
                ) : (
                  <span className="grid size-12 shrink-0 place-items-center rounded-full bg-surface-inset text-ink-muted">
                    <UserRound className="size-5" />
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-medium text-ink">{p.name}</span>
                  <span className="block text-[12.5px] text-ink-muted">
                    {p.label || t(`relation.${p.relation}`)}
                    {p.phone && <span className="tabular"> · {p.phone}</span>}
                  </span>
                </span>
                <UserCheck className="size-5 shrink-0 text-accent-success-deep" />
              </button>
            ))}
            {trip.pickupEnabled && (
              <Button variant="outline" block className="mt-3 h-12" onClick={() => setMode('qr')}>
                <QrCode /> {t('someoneElse')}
              </Button>
            )}
            {!trip.pickupEnabled && <p className="pt-2 text-[12.5px] text-ink-muted">{t('qrOff')}</p>}
          </div>
        ) : (
          <PickupQr trip={trip} student={student} onDone={onDone} />
        )}

        <DialogFooter className="mt-4">
          {mode === 'qr' && (
            <Button variant="ghost" onClick={() => setMode('pick')}>
              {t('back')}
            </Button>
          )}
          <Button variant="ghost" onClick={onClose}>
            {tc('action.cancel')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Subset of Html5Qrcode's instance surface used here. */
interface Scanner {
  stop: () => Promise<void>;
}

const READER_ID = 'trip-pickup-qr-reader';

function PickupQr({ trip, student, onDone }: { trip: TripDetail; student: TripStudent; onDone: (t: TripDetail) => void }) {
  const t = useTranslations('transport.trip.handover');
  const [phase, setPhase] = React.useState<'idle' | 'scanning' | 'checking' | 'confirm'>('idle');
  const [token, setToken] = React.useState('');
  const [pass, setPass] = React.useState<PickupPass | null>(null);
  const [name, setName] = React.useState('');
  const [pin, setPin] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const scanner = React.useRef<Scanner | null>(null);

  const stop = React.useCallback(async () => {
    await scanner.current?.stop().catch(() => {});
    scanner.current = null;
  }, []);
  React.useEffect(() => () => void stop(), [stop]);

  const check = async (code: string) => {
    setPhase('checking');
    try {
      const p = await verifyTripPickup(trip.id, code);
      if (p.studentId !== student.studentId) {
        toast.error(t('otherChild', { name: p.studentName }));
        setPhase('idle');
        return;
      }
      setToken(code);
      setPass(p);
      setPhase('confirm');
    } catch (e) {
      toast.error(errorMessage(e, t('qrInvalid')));
      setPhase('idle');
    }
  };

  const scan = async () => {
    setPhase('scanning');
    try {
      const { Html5Qrcode } = await import('html5-qrcode');
      const cameras = await Html5Qrcode.getCameras();
      if (!cameras?.length) throw new Error(t('noCamera'));
      const back = cameras.find((c) => /back|rear|environment/i.test(c.label)) ?? cameras[cameras.length - 1];
      const s = new Html5Qrcode(READER_ID, { verbose: false });
      scanner.current = s;
      const box = Math.min(240, Math.round(window.innerWidth * 0.65));
      await s.start(
        back.id,
        { fps: 10, qrbox: { width: box, height: box } },
        (text: string) => {
          void stop().then(() => check(text.trim()));
        },
        () => {},
      );
    } catch (e) {
      toast.error(errorMessage(e, t('cameraFailed')));
      setPhase('idle');
    }
  };

  const confirm = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const next = await confirmTripPickup(trip.id, {
        token,
        studentId: student.studentId,
        enteredName: name.trim(),
        enteredPin: pin.trim(),
      });
      toast.success(t('done', { name: student.name, person: pass?.authorizedPersonName ?? name }));
      onDone(next);
    } catch (err) {
      toast.error(errorMessage(err, t('failed')));
      setSaving(false);
    }
  };

  if (phase === 'confirm' && pass) {
    return (
      <form onSubmit={confirm} className="mt-2 space-y-3 px-0.5">
        <div className="rounded-lg border border-accent-info-edge bg-accent-info-tint p-3 text-[13px] text-accent-info-deep">
          {t('passFor', { name: pass.studentName, by: pass.parentName })}
          {pass.notes && <p className="mt-1 text-ink-muted">{pass.notes}</p>}
        </div>
        <Field label={t('askName')} required>
          <Input value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" required />
        </Field>
        <Field label={t('askPin')} required>
          <Input
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
            inputMode="numeric"
            pattern="\d{4}"
            autoComplete="off"
            required
          />
        </Field>
        <Button type="submit" block className="h-12" disabled={saving || pin.length !== 4 || !name.trim()}>
          {t('confirm')}
        </Button>
      </form>
    );
  }

  return (
    <div className="mt-2 space-y-3 px-0.5">
      <p className="text-[13px] text-ink-muted">{t('qrHint')}</p>
      <div id={READER_ID} className={phase === 'scanning' ? 'overflow-hidden rounded-lg' : 'hidden'} />
      {phase !== 'scanning' && (
        <Button block className="h-12" onClick={scan} disabled={phase === 'checking'}>
          <Camera /> {phase === 'checking' ? t('checking') : t('scan')}
        </Button>
      )}
    </div>
  );
}
