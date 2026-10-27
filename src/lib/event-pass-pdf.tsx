import React from 'react';
import { Document, Image, StyleSheet, Text, View, pdf } from '@react-pdf/renderer';
import {
  CARD_H,
  CARD_W,
  CARDS_PER_SHEET,
  Sheet,
  chunk,
  safeLogoDataUrl,
  saveBlob,
  slugify,
} from './id-card-pdf';
import {
  EVENT_PASS_TIER_COLORS,
  passSerial,
  passShortDate,
  passStudentsLine,
  type EventPass,
  type EventPassEvent,
  type EventPassVehicleType,
} from './event-passes-api';

/* ═══════════════════════════════════════════════════════════════════════════
   THE EVENT PASS

   Same blank as the ID card — CR80, ten to an A4 sheet — but with a small gap
   between passes, so each is cut on its own border. Same size means the
   office's holders and habits carry over.

   One face only. A pass is handed over the counter and shown at a gate; there
   is no lanyard to flip, and a single-sided sheet prints on any printer.

   What the guard reads, in order: the tier band (colour AND the word, so a
   black-and-white printout still says GOLD), the QR, "ADMITS 4", the holder.
   Everything the office might correct after printing is checked at the gate
   against the server, so the print is a convenience, not the record.
   ═══════════════════════════════════════════════════════════════════════════ */

const INK = '#211c16';
const INK_SOFT = '#57504a';
const INK_MUTED = '#756d65';
const LINE = '#e2ddd3';
const LINE_STRONG = '#cdc5b7';
const PAPER = '#ffffff';

/** ~3 mm between passes, so each one is cut out on its own border. */
const PASS_GUTTER = 8.5;

const VEHICLE_LABEL: Record<EventPassVehicleType, string> = {
  TWO_WHEELER: '2W',
  FOUR_WHEELER: '4W',
  OTHER: 'Vehicle',
};

const s = StyleSheet.create({
  card: {
    width: CARD_W,
    height: CARD_H,
    backgroundColor: PAPER,
    borderWidth: 0.5,
    borderColor: LINE_STRONG,
  },
  band: {
    height: 21,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  logo: { width: 13, height: 13, marginRight: 5, objectFit: 'contain' },
  school: { flex: 1, fontFamily: 'Helvetica-Bold', fontSize: 7.2, maxLines: 1, textOverflow: 'ellipsis' },
  tier: { fontFamily: 'Courier-Bold', fontSize: 8.5, letterSpacing: 1.2 },
  body: { flex: 1, flexDirection: 'row', paddingHorizontal: 8, paddingTop: 6, paddingBottom: 5 },
  left: { flex: 1, paddingRight: 6 },
  right: { width: 80, alignItems: 'center' },
  title: { fontFamily: 'Helvetica-Bold', fontSize: 9.4, color: INK, maxLines: 2, textOverflow: 'ellipsis' },
  meta: { fontFamily: 'Helvetica', fontSize: 6.2, color: INK_SOFT, marginTop: 1.5, maxLines: 1, textOverflow: 'ellipsis' },
  rule: { height: 0.5, backgroundColor: LINE, marginVertical: 4 },
  holder: { fontFamily: 'Helvetica-Bold', fontSize: 8.6, color: INK, maxLines: 1, textOverflow: 'ellipsis' },
  label: { fontFamily: 'Courier-Bold', fontSize: 5.2, color: INK_MUTED, letterSpacing: 0.6 },
  small: { fontFamily: 'Helvetica', fontSize: 6.2, color: INK_SOFT, maxLines: 2, textOverflow: 'ellipsis' },
  admitsRow: { flexDirection: 'row', alignItems: 'flex-end', marginTop: 3 },
  admits: { fontFamily: 'Helvetica-Bold', fontSize: 15, color: INK, lineHeight: 1 },
  admitsLabel: { fontFamily: 'Courier-Bold', fontSize: 6, color: INK_MUTED, marginLeft: 3, marginBottom: 1.5 },
  vehicle: { fontFamily: 'Courier-Bold', fontSize: 6.8, color: INK, marginLeft: 8, marginBottom: 1, maxLines: 1 },
  qr: { width: 76, height: 76 },
  serial: { fontFamily: 'Courier-Bold', fontSize: 8, color: INK, marginTop: 3, letterSpacing: 0.6 },
  scan: { fontFamily: 'Helvetica', fontSize: 5, color: INK_MUTED, marginTop: 1 },
  zone: { fontFamily: 'Helvetica-Bold', fontSize: 7, color: INK, marginTop: 4, maxLines: 1, textOverflow: 'ellipsis' },
});

/** Just what is printed — an office pass and a parent's pass both fit. */
export type PrintableEventPass = Pick<
  EventPass,
  | 'id'
  | 'serial'
  | 'tier'
  | 'holderName'
  | 'membersAllowed'
  | 'memberNames'
  | 'vehicleType'
  | 'vehicleNumber'
  | 'allDays'
  | 'validDates'
  | 'zone'
  | 'token'
> & { students: { name: string; className: string | null; section: string | null }[] };

export interface PreparedEventPass {
  pass: PrintableEventPass;
  qrDataUrl: string;
}

function datesLine(pass: PrintableEventPass, event: EventPassEvent): string {
  if (pass.allDays) {
    const start = passShortDate(event.startDate);
    if (!event.endDate || event.endDate === event.startDate) return start;
    return `All days · ${start} – ${passShortDate(event.endDate)}`;
  }
  return pass.validDates.map((d) => passShortDate(d)).join(', ');
}

export function EventPassFace({
  prepared,
  event,
  schoolName,
  logoDataUrl,
}: {
  prepared: PreparedEventPass;
  event: EventPassEvent;
  schoolName: string;
  logoDataUrl: string | null;
}) {
  const { pass } = prepared;
  const tone = EVENT_PASS_TIER_COLORS[pass.tier];
  const holder = pass.holderName || (pass.students.length ? `Parent of ${pass.students[0].name}` : 'Guest');
  const studentsLine = passStudentsLine(pass.students);
  const year = event.startDate.slice(0, 4);

  return (
    <View style={s.card}>
      <View style={[s.band, { backgroundColor: tone.band }]}>
        {logoDataUrl ? <Image src={logoDataUrl} style={s.logo} /> : null}
        <Text style={[s.school, { color: tone.ink }]}>{schoolName}</Text>
        <Text style={[s.tier, { color: tone.ink }]}>{pass.tier}</Text>
      </View>
      <View style={s.body}>
        <View style={s.left}>
          <Text style={s.title}>{event.title}</Text>
          <Text style={s.meta}>
            {datesLine(pass, event)} {year}
            {event.venue ? ` · ${event.venue}` : ''}
          </Text>
          <View style={s.rule} />
          <Text style={s.holder}>{holder}</Text>
          {studentsLine ? <Text style={s.small}>Parent of {studentsLine}</Text> : null}
          {pass.memberNames.length > 0 ? (
            <Text style={[s.small, { marginTop: 1.5 }]}>
              <Text style={s.label}>WITH </Text>
              {pass.memberNames.join(', ')}
            </Text>
          ) : null}
          <View style={s.admitsRow}>
            <Text style={s.admits}>{pass.membersAllowed}</Text>
            <Text style={s.admitsLabel}>{pass.membersAllowed === 1 ? 'ADMITS ONE' : 'ADMITS'}</Text>
            {pass.vehicleNumber ? (
              <Text style={s.vehicle}>
                {pass.vehicleType ? `${VEHICLE_LABEL[pass.vehicleType]} ` : ''}
                {pass.vehicleNumber}
              </Text>
            ) : null}
          </View>
          {pass.zone ? (
            <Text style={s.zone}>
              <Text style={s.label}>ENTRY </Text>
              {pass.zone}
            </Text>
          ) : null}
        </View>
        <View style={s.right}>
          <Image src={prepared.qrDataUrl} style={s.qr} />
          <Text style={s.serial}>{passSerial(pass.serial)}</Text>
          <Text style={s.scan}>Scan at the gate</Text>
        </View>
      </View>
    </View>
  );
}

export function EventPassBatchDocument({
  passes,
  event,
  schoolName,
  logoDataUrl,
}: {
  passes: PreparedEventPass[];
  event: EventPassEvent;
  schoolName: string;
  logoDataUrl: string | null;
}) {
  const sheets = chunk(passes, CARDS_PER_SHEET);
  return (
    <Document title={`Event passes — ${event.title}`} author={schoolName} subject="Printable event passes">
      {sheets.map((sheet, index) => (
        <Sheet
          key={index}
          gutter={PASS_GUTTER}
          caption={`Sheet ${index + 1} of ${sheets.length} · ${event.title} · Print at 100% (no "fit to page"), single-sided. Cut around each pass.`}
        >
          {sheet.map((p) => (
            <View key={p.pass.id} style={{ width: CARD_W, height: CARD_H }}>
              <EventPassFace prepared={p} event={event} schoolName={schoolName} logoDataUrl={logoDataUrl} />
            </View>
          ))}
        </Sheet>
      ))}
    </Document>
  );
}

export async function renderEventPassQr(token: string, width = 480): Promise<string> {
  const { default: QRCode } = await import('qrcode');
  return QRCode.toDataURL(token, {
    errorCorrectionLevel: 'M',
    margin: 0,
    width,
    color: { dark: '#1c150dff', light: '#ffffffff' },
  });
}

/** Build and download the print sheets. Returns the number of A4 sheets. */
export async function downloadEventPassesPdf(
  passes: PrintableEventPass[],
  event: EventPassEvent,
  schoolName: string,
): Promise<number> {
  const [prepared, logoDataUrl] = await Promise.all([
    Promise.all(
      passes.map(async (pass) => ({ pass, qrDataUrl: await renderEventPassQr(pass.token ?? '') })),
    ),
    safeLogoDataUrl().catch(() => null),
  ]);

  const build = (logo: string | null) => (
    <EventPassBatchDocument passes={prepared} event={event} schoolName={schoolName} logoDataUrl={logo} />
  );
  let blob: Blob;
  try {
    blob = await pdf(build(logoDataUrl)).toBlob();
  } catch {
    // An undecodable logo takes the whole document down; a plainer pass beats none.
    blob = await pdf(build(null)).toBlob();
  }
  saveBlob(blob, `event-passes-${slugify(event.title)}-${passes.length}.pdf`);
  return Math.ceil(passes.length / CARDS_PER_SHEET);
}
