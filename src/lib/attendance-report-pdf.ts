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
 * The report rows carry names rather than user ids, so "was this the staff
 * member themselves?" is answered by comparing against the row's own name.
 */
function sourceCell(
  method: AttendanceMethod | null,
  byName: string | null,
  staffName: string,
): string {
  if (!method && !byName) return '—';
  const how = method ? (METHOD_LABELS[method] ?? method) : 'Unknown';
  const isSelf = !byName || byName.trim() === staffName.trim();
  return isSelf ? how : `${how} — by ${byName}`;
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
    'Note: "Not Marked" counts days with no attendance record at all, including weekends and unmarked holidays.',
    14,
    25,
  );
  doc.setTextColor(0);

  autoTable(doc, {
    startY: 30,
    head: [
      [
        'Emp Code',
        'Name',
        'Mobile',
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

  const afterSummaryY =
    (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable
      ?.finalY ?? 30;

  doc.setFontSize(12);
  doc.text('Day-by-day detail', 14, afterSummaryY + 10);

  autoTable(doc, {
    startY: afterSummaryY + 14,
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
      sourceCell(r.checkInMethod, r.markedByName, r.name),
      formatTime(r.checkOutTime),
      r.checkOutTime
        ? sourceCell(r.checkOutMethod, r.checkOutByName, r.name)
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

  doc.save(`staff-attendance-report_${report.from}_${report.to}.pdf`);
}
