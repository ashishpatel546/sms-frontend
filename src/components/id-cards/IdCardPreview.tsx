'use client';

import * as React from 'react';
import QRCode from 'react-qr-code';
import { RotateCw } from 'lucide-react';
import {
  formatIdCardDate,
  idCardInitials,
  idCardRoleLine,
  type IdCardBranding,
  type IdCardRow,
} from '@/lib/id-card-api';
import { CARD_H, CARD_W } from '@/lib/id-card-pdf';
import { cn } from '@/lib/utils';

/* ═══════════════════════════════════════════════════════════════════════════
   THE CARD, ON SCREEN

   A print preview is only worth showing if it is the print. This renders the
   same layout as `id-card-pdf.tsx` at exactly 2× its point geometry, then
   scales the whole thing to whatever width it is given — so what an operator
   approves on a phone is what comes out of the printer, down to the hairline.

   Scaling rather than reflowing is the entire point: a CR80 card does not
   become taller on a narrow screen, it becomes smaller. The surrounding page
   is responsive; the card is not.
   ═══════════════════════════════════════════════════════════════════════════ */

/** 1 PDF point → 2 CSS px. */
const SCALE = 2;
const W = CARD_W * SCALE;
const H = CARD_H * SCALE;

/** Points to preview pixels. */
const p = (points: number) => points * SCALE;

const C = {
  walnut: '#362b1f',
  walnutDeep: '#241c12',
  brass: '#7d4907',
  marigold: '#f5a524',
  brassPale: '#e2b871',
  paper: '#ffffff',
  paperTint: '#faf8f3',
  inset: '#eae5dc',
  ink: '#211c16',
  inkSoft: '#57504a',
  inkMuted: '#756d65',
  inkFaint: '#948c83',
  line: '#e2ddd3',
  lineStrong: '#cdc5b7',
  vermilion: '#c41d1d',
} as const;

const TONES = ['#a9670c', '#1e4fd8', '#0b7a55', '#7c52e0', '#b4740c'];

function toneFor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) hash = (hash * 31 + name.charCodeAt(i)) % 9973;
  return TONES[hash % TONES.length];
}

function nameSize(name: string): number {
  const n = name.length;
  if (n <= 17) return 12.5;
  if (n <= 22) return 11;
  if (n <= 28) return 9.6;
  return 8.4;
}

/** The card never wraps its own text — the PDF clips to one line, so does this. */
const clip: React.CSSProperties = {
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const mono = 'ui-monospace, "IBM Plex Mono", "Cascadia Mono", monospace';
const sans = 'Helvetica, Arial, sans-serif';

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        fontFamily: mono,
        fontSize: p(4.4),
        letterSpacing: p(0.55),
        color: C.inkFaint,
        fontWeight: 700,
      }}
    >
      {children}
    </span>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ flex: 1, paddingRight: p(4), minWidth: 0 }}>
      <div>
        <Label>{label}</Label>
      </div>
      <div
        style={{
          ...clip,
          fontFamily: sans,
          fontWeight: 700,
          fontSize: p(7.2),
          color: C.ink,
          marginTop: p(1.5),
        }}
      >
        {value}
      </div>
    </div>
  );
}

function Spine() {
  return (
    <>
      <div style={{ width: p(6), background: C.walnut, flex: 'none' }} />
      <div style={{ width: p(1.2), background: C.brass, flex: 'none' }} />
    </>
  );
}

function Photo({ row }: { row: IdCardRow }) {
  const [failed, setFailed] = React.useState(false);
  const showPhoto = Boolean(row.photoUrl) && !failed;

  return (
    <div
      style={{
        width: p(55),
        height: p(72.3),
        background: C.inset,
        border: `${p(0.6)}px solid ${C.lineStrong}`,
        padding: p(1.5),
        flex: 'none',
      }}
    >
      {showPhoto ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={row.photoUrl ?? ''}
          alt=""
          onError={() => setFailed(true)}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      ) : (
        <div
          style={{
            width: '100%',
            height: '100%',
            background: toneFor(row.name),
            display: 'grid',
            placeItems: 'center',
            color: C.paper,
            fontFamily: sans,
            fontWeight: 700,
            fontSize: p(20),
          }}
        >
          {idCardInitials(row.name)}
        </div>
      )}
    </div>
  );
}

function classLabel(row: IdCardRow): string {
  if (!row.className) return '—';
  return row.section ? `${row.className} — ${row.section}` : row.className;
}

/* ── Front ───────────────────────────────────────────────────────────────── */

function Front({ row, school }: { row: IdCardRow; school: IdCardBranding }) {
  const isStudent = row.type === 'STUDENT';
  const guardian = row.fathersName ?? row.guardianName;

  return (
    <div
      style={{
        width: W,
        height: H,
        background: C.paper,
        display: 'flex',
        border: `${p(0.5)}px solid ${C.lineStrong}`,
        boxSizing: 'border-box',
      }}
    >
      <Spine />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Masthead */}
        <div
          style={{
            height: p(36),
            background: C.walnut,
            display: 'flex',
            alignItems: 'center',
            padding: `0 ${p(8)}px`,
            flex: 'none',
          }}
        >
          <div
            style={{
              width: p(24),
              height: p(24),
              background: C.paper,
              borderRadius: p(3),
              marginRight: p(7),
              display: 'grid',
              placeItems: 'center',
              flex: 'none',
            }}
          >
            {school.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={school.logoUrl}
                alt=""
                style={{ width: p(20), height: p(20), objectFit: 'contain' }}
              />
            ) : (
              <span
                style={{
                  fontFamily: sans,
                  fontWeight: 700,
                  fontSize: p(10),
                  color: C.brass,
                }}
              >
                {idCardInitials(school.name)}
              </span>
            )}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                ...clip,
                fontFamily: sans,
                fontWeight: 700,
                fontSize: p(9),
                color: C.paper,
                lineHeight: 1.15,
              }}
            >
              {school.name}
            </div>
            <div
              style={{
                fontFamily: mono,
                fontWeight: 700,
                fontSize: p(4.6),
                letterSpacing: p(0.7),
                color: C.brassPale,
                marginTop: p(1.5),
              }}
            >
              {isStudent ? 'STUDENT IDENTITY CARD' : 'STAFF IDENTITY CARD'}
            </div>
          </div>
          {school.session ? (
            <div style={{ textAlign: 'right', marginLeft: p(6), flex: 'none' }}>
              <div
                style={{
                  fontFamily: mono,
                  fontWeight: 700,
                  fontSize: p(4.2),
                  letterSpacing: p(0.6),
                  color: C.brassPale,
                }}
              >
                SESSION
              </div>
              <div
                style={{
                  fontFamily: sans,
                  fontWeight: 700,
                  fontSize: p(8),
                  color: C.marigold,
                  marginTop: p(1),
                }}
              >
                {school.session}
              </div>
            </div>
          ) : null}
        </div>
        <div style={{ height: p(2), background: C.brass, flex: 'none' }} />

        {/* The person */}
        <div style={{ flex: 1, display: 'flex', padding: `${p(7)}px ${p(8)}px 0`, minHeight: 0 }}>
          <Photo row={row} />
          <div style={{ flex: 1, paddingLeft: p(8), minWidth: 0 }}>
            <div
              style={{
                ...clip,
                fontFamily: sans,
                fontWeight: 700,
                fontSize: p(nameSize(row.name)),
                color: C.ink,
                lineHeight: 1.15,
              }}
            >
              {row.name}
            </div>
            <div
              style={{
                ...clip,
                fontFamily: sans,
                fontSize: p(7.2),
                color: C.inkMuted,
                marginTop: p(2),
              }}
            >
              {idCardRoleLine(row)}
            </div>
            <div
              style={{
                height: p(0.6),
                background: C.line,
                margin: `${p(6)}px 0`,
              }}
            />
            {isStudent ? (
              <>
                <div style={{ display: 'flex', marginBottom: p(5) }}>
                  <Field label="CLASS" value={classLabel(row)} />
                  <Field label="ROLL NO" value={row.rollNo != null ? String(row.rollNo) : '—'} />
                </div>
                <div style={{ display: 'flex' }}>
                  <Field label="DATE OF BIRTH" value={formatIdCardDate(row.dob)} />
                  <Field label="GUARDIAN" value={guardian ?? '—'} />
                </div>
              </>
            ) : (
              <>
                <div style={{ display: 'flex', marginBottom: p(5) }}>
                  <Field
                    label="EMPLOYEE CODE"
                    value={row.employeeCode != null ? String(row.employeeCode) : '—'}
                  />
                  <Field label="DEPARTMENT" value={row.department ?? '—'} />
                </div>
                <div style={{ display: 'flex' }}>
                  <Field label="DESIGNATION" value={row.designation ?? '—'} />
                  <Field label="DATE OF BIRTH" value={formatIdCardDate(row.dob)} />
                </div>
              </>
            )}
          </div>
        </div>

        {/* The strip read in an emergency */}
        <div
          style={{
            height: p(21),
            background: C.paperTint,
            borderTop: `${p(0.6)}px solid ${C.line}`,
            display: 'flex',
            alignItems: 'center',
            padding: `0 ${p(8)}px`,
            flex: 'none',
          }}
        >
          {row.bloodGroup ? (
            <span
              style={{
                background: C.vermilion,
                color: C.paper,
                fontFamily: sans,
                fontWeight: 700,
                fontSize: p(7.5),
                padding: `${p(2)}px ${p(4.5)}px`,
                borderRadius: p(2),
                marginRight: p(6),
              }}
            >
              {row.bloodGroup}
            </span>
          ) : null}
          <div style={{ width: p(46) }}>
            <Label>BLOOD GROUP</Label>
            {!row.bloodGroup ? (
              <div
                style={{
                  fontFamily: sans,
                  fontWeight: 700,
                  fontSize: p(7.4),
                  color: C.ink,
                  marginTop: p(1),
                }}
              >
                Not recorded
              </div>
            ) : null}
          </div>
          <div style={{ flex: 1, textAlign: 'right', minWidth: 0 }}>
            <Label>{isStudent ? 'PARENT CONTACT' : 'CONTACT'}</Label>
            <div
              style={{
                ...clip,
                fontFamily: sans,
                fontWeight: 700,
                fontSize: p(7.4),
                color: C.ink,
                marginTop: p(1),
              }}
            >
              {row.mobile ?? school.phone ?? '—'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Back ────────────────────────────────────────────────────────────────── */

function Back({ row, school }: { row: IdCardRow; school: IdCardBranding }) {
  return (
    <div
      style={{
        width: W,
        height: H,
        background: C.paper,
        display: 'flex',
        border: `${p(0.5)}px solid ${C.lineStrong}`,
        boxSizing: 'border-box',
      }}
    >
      <Spine />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <div
          style={{
            height: p(17),
            background: C.walnutDeep,
            display: 'flex',
            alignItems: 'center',
            padding: `0 ${p(8)}px`,
            flex: 'none',
          }}
        >
          <span
            style={{
              ...clip,
              flex: 1,
              fontFamily: sans,
              fontWeight: 700,
              fontSize: p(6.4),
              color: C.paper,
            }}
          >
            {school.name}
          </span>
          <span
            style={{
              fontFamily: mono,
              fontWeight: 700,
              fontSize: p(4.4),
              letterSpacing: p(0.8),
              color: C.marigold,
            }}
          >
            {row.type === 'STUDENT' ? 'STUDENT' : 'STAFF'}
          </span>
        </div>

        <div style={{ flex: 1, display: 'flex', padding: `${p(7)}px ${p(8)}px 0`, minHeight: 0 }}>
          <div style={{ flex: 'none' }}>
            <div
              style={{
                width: p(74),
                height: p(74),
                background: C.paper,
                border: `${p(0.6)}px solid ${C.lineStrong}`,
                padding: p(2.5),
                boxSizing: 'border-box',
              }}
            >
              <QRCode
                value={row.qrToken}
                level="M"
                bgColor="#ffffff"
                fgColor="#1c150d"
                style={{ width: '100%', height: '100%' }}
              />
            </div>
            <div
              style={{
                width: p(74),
                textAlign: 'center',
                fontFamily: mono,
                fontWeight: 700,
                fontSize: p(4.2),
                letterSpacing: p(0.5),
                color: C.inkFaint,
                marginTop: p(3),
              }}
            >
              SCAN AT THE GATE
            </div>
          </div>

          <div style={{ flex: 1, paddingLeft: p(9), minWidth: 0 }}>
            <div
              style={{
                fontFamily: mono,
                fontWeight: 700,
                fontSize: p(4.4),
                letterSpacing: p(0.7),
                color: C.brass,
              }}
            >
              IF FOUND
            </div>
            <div
              style={{
                fontFamily: sans,
                fontSize: p(5.9),
                lineHeight: 1.35,
                color: C.inkSoft,
                marginTop: p(3),
              }}
            >
              Please return this card to the school office, or hand it in at the
              address below.
            </div>
            <div
              style={{
                fontFamily: sans,
                fontWeight: 700,
                fontSize: p(6.6),
                color: C.ink,
                marginTop: p(4),
              }}
            >
              {school.name}
            </div>
            {school.address ? (
              <div
                style={{
                  fontFamily: sans,
                  fontSize: p(5.9),
                  lineHeight: 1.35,
                  color: C.inkMuted,
                  marginTop: p(2),
                }}
              >
                {school.address}
              </div>
            ) : null}
            {school.phone ? (
              <div
                style={{
                  fontFamily: sans,
                  fontSize: p(5.9),
                  lineHeight: 1.35,
                  color: C.inkMuted,
                  marginTop: p(2),
                }}
              >
                Tel {school.phone}
              </div>
            ) : null}
          </div>
        </div>

        <div
          style={{
            borderTop: `${p(0.6)}px solid ${C.line}`,
            display: 'flex',
            alignItems: 'flex-end',
            padding: `${p(4)}px ${p(8)}px ${p(5)}px`,
            flex: 'none',
          }}
        >
          <div
            style={{
              flex: 1,
              fontFamily: sans,
              fontSize: p(5),
              lineHeight: 1.3,
              color: C.inkMuted,
              paddingRight: p(8),
            }}
          >
            {school.session ? `Valid for the ${school.session} academic session. ` : ''}
            This card remains the property of the school. It is not transferable
            and must be surrendered on leaving.
          </div>
          <div style={{ width: p(74), textAlign: 'center', flex: 'none' }}>
            <div style={{ height: p(0.6), background: C.lineStrong }} />
            <div
              style={{
                fontFamily: mono,
                fontWeight: 700,
                fontSize: p(3.9),
                letterSpacing: p(0.5),
                color: C.inkFaint,
                marginTop: p(2.5),
              }}
            >
              AUTHORISED SIGNATORY
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── The scaling shell ───────────────────────────────────────────────────── */

/**
 * One face, scaled to fill its container's width while keeping CR80's exact
 * proportions.
 */
export function IdCardFace({
  row,
  school,
  face,
  className,
}: {
  row: IdCardRow;
  school: IdCardBranding;
  face: 'front' | 'back';
  className?: string;
}) {
  const hostRef = React.useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = React.useState(1);

  React.useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const observer = new ResizeObserver(([entry]) => {
      const width = entry.contentRect.width;
      if (width > 0) setScale(width / W);
    });
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={hostRef}
      className={cn('relative w-full', className)}
      style={{ height: H * scale }}
    >
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: W,
          height: H,
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
        }}
      >
        {face === 'front' ? (
          <Front row={row} school={school} />
        ) : (
          <Back row={row} school={school} />
        )}
      </div>
    </div>
  );
}

/**
 * The interactive preview: one card you can turn over, the way you would turn
 * over the real thing. The flip is the only animation on the page and it is
 * the literal gesture, not decoration.
 */
export function IdCardPreview({
  row,
  school,
  className,
}: {
  row: IdCardRow;
  school: IdCardBranding;
  className?: string;
}) {
  const [face, setFace] = React.useState<'front' | 'back'>('front');

  // A new holder always opens on the front — nobody wants to land on the back
  // of the next card because they turned the last one over.
  React.useEffect(() => {
    setFace('front');
  }, [row.qrToken]);

  return (
    <div className={cn('w-full', className)}>
      <div
        className="rounded-xl bg-surface-inset p-3 shadow-soft sm:p-4"
        style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.4)' }}
      >
        <div className="mx-auto w-full max-w-[420px]">
          <IdCardFace row={row} school={school} face={face} />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[12px] text-ink-muted">
          <span className="tabular">85.6 × 54 mm</span> — standard CR80, shown
          to scale.
        </p>
        <button
          type="button"
          onClick={() => setFace((f) => (f === 'front' ? 'back' : 'front'))}
          aria-pressed={face === 'back'}
          className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-md border border-line-strong bg-surface px-3 text-[13px] font-semibold text-ink transition-colors hover:border-brand hover:text-brand"
        >
          <RotateCw className="size-3.5" aria-hidden />
          {face === 'front' ? 'Show the back' : 'Show the front'}
        </button>
      </div>
    </div>
  );
}

export default IdCardPreview;
