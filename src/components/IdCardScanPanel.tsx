'use client';

import React, { useEffect, useState } from 'react';
import {
  BadgeCheck,
  Ban,
  CalendarX,
  GraduationCap,
  IdCard,
  ScanLine,
  UserRound,
  XCircle,
} from 'lucide-react';
import {
  formatIdCardDate,
  idCardInitials,
  verifyIdCard,
  type IdCardVerifyResult,
} from '@/lib/id-card-api';

/* ═══════════════════════════════════════════════════════════════════════════
   ID CARD AT THE GATE

   Rendered by the shared scanner when an `IDC1:`-prefixed QR is decoded.

   A guard is standing in a queue, holding a phone, and needs one of three
   answers in under a second: LET THEM IN, THIS CARD IS DEAD, or THIS IS NOT
   OUR CARD. So the verdict is the whole screen — a colour, a word, a face —
   and the identity sits underneath it as the evidence.

   "Deactivated" is deliberately its own state rather than an error. The card
   is genuine; the holder has left. A guard told "invalid QR" would argue with
   the card. A guard told "this person has left the school" knows what to do.
   ═══════════════════════════════════════════════════════════════════════════ */

interface IdCardScanPanelProps {
  /** Raw QR content, `IDC1:` prefix included — the API verifies the whole thing. */
  token: string;
  /** Scan the next card. */
  onDone: () => void;
  /** Back to the scanner without another scan. */
  onCancel: () => void;
}

export default function IdCardScanPanel({ token, onDone, onCancel }: IdCardScanPanelProps) {
  const [result, setResult] = useState<IdCardVerifyResult | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    verifyIdCard(token)
      .then((data) => {
        if (!cancelled) setResult(data);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : 'This card could not be verified');
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (error) {
    return (
      <div className="flex flex-col items-center gap-5 py-8 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-red-500/20">
          <XCircle className="h-10 w-10 text-red-400" aria-hidden />
        </div>
        <div>
          <h2 className="mb-1 text-xl font-bold text-white">Not a valid ID card</h2>
          <p className="text-sm text-red-400">{error}</p>
        </div>
        <button
          onClick={onCancel}
          className="rounded-xl bg-indigo-600 px-8 py-3 font-semibold text-white transition-all hover:bg-indigo-500"
        >
          Back to scanner
        </button>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="flex flex-col items-center gap-4 py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
        <p className="text-sm text-slate-400">Checking this card…</p>
      </div>
    );
  }

  const isStudent = result.type === 'STUDENT';
  const standing = isStudent
    ? [result.className ? `Class ${result.className}` : null, result.section ? `Section ${result.section}` : null]
        .filter(Boolean)
        .join(' · ')
    : (result.designation ?? 'Staff');

  // The card's own fields, in the order a guard needs them. Blank values are
  // dropped rather than shown as dashes — a wall of "—" reads as broken.
  const details = (
    isStudent
      ? [
          { label: 'Roll no', value: result.rollNo != null ? String(result.rollNo) : null },
          { label: 'Blood group', value: result.bloodGroup },
          { label: "Father's name", value: result.fathersName },
          { label: "Mother's name", value: result.mothersName },
          {
            label: 'Guardian',
            value: result.guardianName
              ? result.guardianRelation
                ? `${result.guardianName} (${result.guardianRelation})`
                : result.guardianName
              : null,
          },
          { label: 'Parent contact', value: result.mobile },
          { label: 'Date of birth', value: formatIdCardDate(result.dob) },
        ]
      : [
          {
            label: 'Employee code',
            value: result.employeeCode != null ? String(result.employeeCode) : null,
          },
          { label: 'Department', value: result.department },
          { label: 'Blood group', value: result.bloodGroup },
          { label: 'Contact', value: result.mobile },
          { label: 'Date of birth', value: formatIdCardDate(result.dob) },
        ]
  ).filter((d): d is { label: string; value: string } => Boolean(d.value) && d.value !== '—');

  /* A guard gets one line to act on, and the failures are NOT the same
     instruction. "Expired" is the school's paperwork and the person in front
     of you is genuinely theirs; "replaced" means they are holding a card that
     was reported lost, which is the one worth a second look; "revoked" means
     the office killed this card on purpose and there is no newer one to ask
     for. Collapsing them into "invalid" would throw away exactly the
     distinction that matters. */
  const verdict = (() => {
    switch (result.status) {
      case 'VALID':
        return {
          tone: 'bg-emerald-500/10 border-emerald-500/25 text-emerald-300',
          ring: 'ring-emerald-500/40',
          icon: (
            <BadgeCheck
              className="h-5 w-5 shrink-0 text-emerald-400"
              aria-hidden
            />
          ),
          headline: 'Valid card',
          detail: isStudent
            ? 'This student is on the current roll.'
            : 'This member of staff is currently employed.',
        };
      case 'EXPIRED':
        return {
          tone: 'bg-amber-500/10 border-amber-500/25 text-amber-300',
          ring: 'ring-amber-500/40',
          icon: (
            <CalendarX className="h-5 w-5 shrink-0 text-amber-400" aria-hidden />
          ),
          headline: 'Expired card',
          detail:
            result.reason ??
            'This card belongs to a previous session. The office must issue a fresh one.',
        };
      case 'REVOKED':
        return {
          tone: 'bg-red-500/10 border-red-500/25 text-red-300',
          ring: 'ring-red-500/40',
          icon: <Ban className="h-5 w-5 shrink-0 text-red-400" aria-hidden />,
          headline: 'Card revoked',
          detail:
            result.reason ??
            'The office cancelled this card and issued no replacement. Do not admit on it — send them to the office.',
        };
      case 'REPLACED':
        return {
          tone: 'bg-red-500/10 border-red-500/25 text-red-300',
          ring: 'ring-red-500/40',
          icon: <Ban className="h-5 w-5 shrink-0 text-red-400" aria-hidden />,
          headline: `Replaced — issue ${result.issueVersion} of ${result.currentVersion}`,
          detail:
            result.reason ??
            'A newer card was issued. Do not admit on this one — send them to the office.',
        };
      default:
        return {
          tone: 'bg-amber-500/10 border-amber-500/25 text-amber-300',
          ring: 'ring-amber-500/40',
          icon: <Ban className="h-5 w-5 shrink-0 text-amber-400" aria-hidden />,
          headline: 'Card no longer valid',
          detail: isStudent
            ? 'This student has been deactivated. Do not admit on this card — send them to the office.'
            : 'This person is no longer active on the staff roll. Send them to the office.',
        };
    }
  })();

  return (
    <div className="space-y-4">
      {/* The verdict, first and largest. */}
      <div className={`flex items-start gap-2.5 rounded-xl border px-4 py-3 ${verdict.tone}`}>
        {verdict.icon}
        <div className="min-w-0">
          <p className="text-sm font-semibold">{verdict.headline}</p>
          <p className="mt-0.5 text-xs opacity-90">{verdict.detail}</p>
        </div>
      </div>

      {/* The evidence. */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
        <div className="flex items-center gap-4">
          {result.photoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={result.photoUrl}
              alt=""
              className={`h-24 w-18 shrink-0 rounded-lg object-cover ring-2 ${verdict.ring}`}
              style={{ width: 72, height: 96 }}
            />
          ) : (
            <div
              className={`flex shrink-0 items-center justify-center rounded-lg bg-slate-800 text-2xl font-bold text-slate-400 ring-2 ${verdict.ring}`}
              style={{ width: 72, height: 96 }}
            >
              {idCardInitials(result.name)}
            </div>
          )}

          <div className="min-w-0">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-800 px-2 py-0.5 text-[10.5px] font-semibold tracking-widest text-slate-400 uppercase">
              {isStudent ? (
                <GraduationCap className="h-3 w-3" aria-hidden />
              ) : (
                <UserRound className="h-3 w-3" aria-hidden />
              )}
              {isStudent ? 'Student' : 'Staff'}
            </span>
            <h3 className="mt-1.5 truncate text-lg font-bold text-white">{result.name}</h3>
            <p className="mt-0.5 text-sm text-slate-400">{standing || '—'}</p>
          </div>
        </div>

        {/* Everything below is legible on the card in the guard's hand, so the
            scan adds no exposure — it just saves squinting at a lanyard, and
            gives a number to ring when a child is collected by a stranger. */}
        {details.length > 0 && (
          <dl className="mt-3.5 grid grid-cols-2 gap-x-3 gap-y-2.5 border-t border-slate-800 pt-3">
            {details.map((d) => (
              <div key={d.label} className="min-w-0">
                <dt className="text-[10px] font-semibold tracking-widest text-slate-500 uppercase">
                  {d.label}
                </dt>
                <dd className="mt-0.5 truncate text-[13px] font-medium text-slate-200">
                  {d.value}
                </dd>
              </div>
            ))}
          </dl>
        )}

        <p className="mt-3.5 flex items-start gap-1.5 border-t border-slate-800 pt-3 text-xs text-slate-500">
          <IdCard className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden />
          Check the face against the photo. Nothing is recorded by a scan — this
          only confirms who the card belongs to.
        </p>
      </div>

      <div className="flex gap-2">
        <button
          onClick={onCancel}
          className="flex-1 rounded-xl bg-slate-800 py-3 text-sm font-medium text-white transition-all hover:bg-slate-700"
        >
          Back
        </button>
        <button
          onClick={onDone}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3 text-sm font-semibold text-white transition-all hover:bg-indigo-500"
        >
          <ScanLine className="h-4 w-4" aria-hidden />
          Scan next card
        </button>
      </div>
    </div>
  );
}
