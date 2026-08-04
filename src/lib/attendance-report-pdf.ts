import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { AttendanceReport } from '@/lib/hr-api';
import { formatTime } from '@/lib/utils';

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
        'Late',
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
        'Check-In',
        'Check-Out',
        'Worked Hrs',
      ],
    ],
    body: report.rows.map((r) => [
      r.date,
      r.employeeCode ?? '—',
      r.name,
      r.status,
      formatTime(r.checkInTime),
      formatTime(r.checkOutTime),
      r.workedHours ?? '—',
    ]),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [71, 85, 105] },
  });

  doc.save(`staff-attendance-report_${report.from}_${report.to}.pdf`);
}
