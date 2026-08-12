import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { AttendanceMethod, AttendanceReport } from '@/lib/hr-api';
import { formatTime } from '@/lib/utils';

/** Same wording the HR table uses, so the export reads like the screen. */
const METHOD_LABELS: Record<AttendanceMethod, string> = {
  GEOFENCE: 'Self (geo)',
  WEBAUTHN: 'Biometric',
  BYPASS: 'Bypass',
  MANUAL: 'Manual',
};

/**
 * One provenance cell: how the event was recorded, plus who recorded it when
 * that wasn't the staff member. `method` describes the check-in and
 * `checkOutMethod` the check-out — a day can be self-checked-in and
 * admin-checked-out, and the report has to be able to show that.
 *
 * "Was this the staff member themselves?" is decided on user ids, never on
 * display names: in a large roster two people genuinely share a name, and a
 * name comparison would then drop the "— by <admin>" attribution from an audit
 * column. An unknown actor (`byId` null, i.e. rows predating the audit columns)
 * is not assumed to be self.
 */
function sourceCell(
  method: AttendanceMethod | null,
  byName: string | null,
  byId: number | null,
  staffUserId: number | null,
): string {
  if (!method && !byName) return '—';
  const how = method ? (METHOD_LABELS[method] ?? method) : 'Unknown';
  const isSelf =
    staffUserId !== null && byId !== null && byId === staffUserId;
  return isSelf || !byName ? how : `${how} — by ${byName}`;
}

/**
 * Renders the staff working-hours report as a landscape PDF and triggers a
 * download. Loaded via dynamic import() to keep jsPDF out of the main bundle.
 */
export function buildAttendanceReportPdf(report: AttendanceReport): void {
  const doc = new jsPDF({ orientation: 'landscape' });

  doc.setFontSize(15);
  doc.text('Staff Attendance Report', 14, 14);
  doc.setFontSize(10);
  doc.setTextColor(90);
  doc.text(
    `Period: ${report.from} to ${report.to} (${report.totalDaysInRange} days) — generated ${formatTime(report.generatedAt)}`,
    14,
    20,
  );
  doc.text(
    'Note: "Not Marked" counts days with no attendance record at all — including weekends and unmarked holidays — over the days each person was employed within the range ("Days Empl.").',
    14,
    25,
  );
  doc.setTextColor(0);

  /** Where the next section starts; each table advances it. */
  let nextY = 30;
  const advance = () => {
    nextY =
      (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable
        ?.finalY ?? nextY;
  };

  // Blocks the user didn't ask for are omitted rather than drawn empty — an
  // empty table under a heading reads as "nobody marked anything".
  if (report.include !== 'detail') {
    autoTable(doc, {
      startY: nextY,
      head: [
        [
          'Emp Code',
          'Name',
          'Mobile',
          'Days Empl.',
          'Present',
          // Overlay count (late arrivals can also be Present/Half Day) — must
          // not be summed with the status columns around it.
          'Late Arrivals',
          'Half Day',
          'Absent',
          'On Leave',
          'Holiday',
          'Not Marked',
          'Total Hrs',
          'Avg Hrs/Day',
        ],
      ],
      body: report.summary.map((s) => [
        s.employeeCode ?? '—',
        s.name,
        s.mobile ?? '—',
        s.daysEmployedInRange,
        s.present,
        s.late,
        s.halfDay,
        s.absent,
        s.onLeave,
        s.holiday,
        s.notMarked,
        s.totalWorkedHours,
        s.avgWorkedHours ?? '—',
      ]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [37, 99, 235] },
    });
    advance();
  }

  if (report.include !== 'summary') {
    doc.setFontSize(12);
    doc.text('Day-by-day detail', 14, nextY + 10);

    autoTable(doc, {
      startY: nextY + 14,
      head: [
        [
          'Date',
          'Emp Code',
          'Name',
          'Status',
          'Late',
          'Check-In',
          'Check-In Source',
          'Check-Out',
          'Check-Out Source',
          'Worked Hrs',
        ],
      ],
      body: report.rows.map((r) => [
        r.date,
        r.employeeCode ?? '—',
        r.name,
        r.status,
        r.isLate ? 'Yes' : '',
        formatTime(r.checkInTime),
        sourceCell(r.checkInMethod, r.markedByName, r.markedById, r.userId),
        formatTime(r.checkOutTime),
        r.checkOutTime
          ? sourceCell(
              r.checkOutMethod,
              r.checkOutByName,
              r.checkOutById,
              r.userId,
            )
          : '—',
        r.workedHours ?? '—',
      ]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [71, 85, 105] },
      // The two source columns are the widest free text in the table; letting
      // them wrap keeps the landscape page from squeezing the date and times.
      columnStyles: {
        6: { cellWidth: 42 },
        8: { cellWidth: 42 },
      },
    });
    advance();
  }

  doc.save(`staff-attendance-report_${report.from}_${report.to}.pdf`);
}
