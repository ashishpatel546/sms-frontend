/**
 * salary-slip-pdf.tsx
 * Client-side salary slip PDF using @react-pdf/renderer.
 * Call generateSalarySlipPdf(entry) → downloads the PDF in the browser.
 */
import React from "react";
import { Document, Page, View, Text, StyleSheet, pdf } from "@react-pdf/renderer";
import { PayrollEntry } from "./hr-api";

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

const styles = StyleSheet.create({
  page: { fontFamily: "Helvetica", fontSize: 10, padding: 40, color: "#111" },
  header: { borderBottomWidth: 1, borderBottomColor: "#ccc", paddingBottom: 12, marginBottom: 16 },
  schoolName: { fontSize: 16, fontFamily: "Helvetica-Bold", textAlign: "center" },
  slipTitle: { fontSize: 11, textAlign: "center", marginTop: 4, color: "#444" },
  section: { marginBottom: 14 },
  sectionTitle: { fontSize: 9, fontFamily: "Helvetica-Bold", textTransform: "uppercase", letterSpacing: 1, color: "#555", marginBottom: 6, borderBottomWidth: 0.5, borderBottomColor: "#ddd", paddingBottom: 3 },
  row: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  label: { color: "#555" },
  value: { fontFamily: "Helvetica-Bold" },
  tableHeader: { flexDirection: "row", backgroundColor: "#f5f5f5", borderWidth: 0.5, borderColor: "#ccc", padding: 5 },
  tableRow: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#eee", padding: 5 },
  col1: { flex: 3 },
  col2: { flex: 1, textAlign: "right" },
  totalRow: { flexDirection: "row", justifyContent: "space-between", borderTopWidth: 1, borderTopColor: "#aaa", paddingTop: 6, marginTop: 4 },
  totalLabel: { fontFamily: "Helvetica-Bold", fontSize: 11 },
  totalValue: { fontFamily: "Helvetica-Bold", fontSize: 11 },
  netPay: { marginTop: 16, backgroundColor: "#1e3a5f", padding: 12, borderRadius: 4 },
  netPayText: { color: "white", fontFamily: "Helvetica-Bold", fontSize: 13, textAlign: "center" },
  footer: { marginTop: 24, borderTopWidth: 0.5, borderTopColor: "#ccc", paddingTop: 8, color: "#888", fontSize: 8, textAlign: "center" },
});

interface SalarySlipProps {
  entry: PayrollEntry;
  schoolName?: string;
  month?: number;
  year?: number;
}

function SalarySlipDocument({ entry, schoolName = "School", month, year }: SalarySlipProps) {
  const snapshot = entry.componentsSnapshot ?? {};

  const staffName = entry.staff
    ? `${entry.staff.user.firstName} ${entry.staff.user.lastName}`
    : `Staff #${entry.staffId}`;
  const designation = entry.staff?.designation ?? "—";
  const empCode = entry.staff?.employeeCode ? `EMP-${entry.staff.employeeCode}` : `#${entry.staffId}`;

  // Separate earnings and deductions from snapshot
  const earnings: { label: string; amount: number }[] = [];
  const deductions: { label: string; amount: number }[] = [];

  Object.entries(snapshot).forEach(([key, val]) => {
    if (typeof val !== "number") return;
    // Heuristic: keys ending in _DED or containing DEDUCTION, PF, PT, TDS are deductions
    const deductionKeys = ["PF", "PT", "TDS", "LOP_AMOUNT"];
    if (deductionKeys.some((dk) => key.toUpperCase().includes(dk))) {
      if (val > 0) deductions.push({ label: key, amount: val });
    } else {
      if (val > 0) earnings.push({ label: key, amount: val });
    }
  });

  const totalEarnings = earnings.reduce((s, e) => s + e.amount, 0);
  const totalDeductions = deductions.reduce((s, d) => s + d.amount, 0);

  // Month/year for the slip header
  const monthYear = month && year
    ? `${MONTHS[month - 1]} ${year}`
    : year
    ? String(year)
    : `${MONTHS[new Date().getMonth()]} ${new Date().getFullYear()}`;

  const fmt = (n: number) => `₹${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.schoolName}>{schoolName}</Text>
          <Text style={styles.slipTitle}>Salary Slip — {monthYear}</Text>
        </View>

        {/* Employee details */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Employee Details</Text>
          <View style={styles.row}><Text style={styles.label}>Employee Name</Text><Text style={styles.value}>{staffName}</Text></View>
          <View style={styles.row}><Text style={styles.label}>Employee Code</Text><Text style={styles.value}>{empCode}</Text></View>
          <View style={styles.row}><Text style={styles.label}>Designation</Text><Text style={styles.value}>{designation}</Text></View>
        </View>

        {/* Attendance summary */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Attendance Summary</Text>
          <View style={styles.row}><Text style={styles.label}>Working Days</Text><Text style={styles.value}>{entry.workingDays}</Text></View>
          <View style={styles.row}><Text style={styles.label}>Present Days</Text><Text style={styles.value}>{entry.presentDays}</Text></View>
          <View style={styles.row}><Text style={styles.label}>LOP Days</Text><Text style={styles.value}>{entry.lopDays}</Text></View>
          <View style={styles.row}><Text style={styles.label}>Paid Days</Text><Text style={styles.value}>{entry.paidDays}</Text></View>
        </View>

        {/* Earnings table */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Earnings</Text>
          <View style={styles.tableHeader}>
            <Text style={[styles.col1, { fontFamily: "Helvetica-Bold" }]}>Component</Text>
            <Text style={[styles.col2, { fontFamily: "Helvetica-Bold" }]}>Amount</Text>
          </View>
          {earnings.map((e, i) => (
            <View key={i} style={styles.tableRow}>
              <Text style={styles.col1}>{e.label}</Text>
              <Text style={styles.col2}>{fmt(e.amount)}</Text>
            </View>
          ))}
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Total Earnings</Text>
            <Text style={styles.totalValue}>{fmt(totalEarnings)}</Text>
          </View>
        </View>

        {/* Deductions table */}
        {deductions.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Deductions</Text>
            <View style={styles.tableHeader}>
              <Text style={[styles.col1, { fontFamily: "Helvetica-Bold" }]}>Component</Text>
              <Text style={[styles.col2, { fontFamily: "Helvetica-Bold" }]}>Amount</Text>
            </View>
            {deductions.map((d, i) => (
              <View key={i} style={styles.tableRow}>
                <Text style={styles.col1}>{d.label}</Text>
                <Text style={styles.col2}>{fmt(d.amount)}</Text>
              </View>
            ))}
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total Deductions</Text>
              <Text style={styles.totalValue}>{fmt(totalDeductions)}</Text>
            </View>
          </View>
        )}

        {/* Net pay */}
        <View style={styles.netPay}>
          <Text style={styles.netPayText}>Net Pay: {fmt(entry.netPay)}</Text>
        </View>

        <Text style={styles.footer}>This is a computer-generated salary slip and does not require a signature.</Text>
      </Page>
    </Document>
  );
}

/**
 * Generates a salary slip PDF and triggers browser download.
 */
export async function generateSalarySlipPdf(
  entry: PayrollEntry,
  opts?: { schoolName?: string; fileName?: string; month?: number; year?: number },
) {
  const blob = await pdf(
    <SalarySlipDocument entry={entry} schoolName={opts?.schoolName} month={opts?.month} year={opts?.year} />,
  ).toBlob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = opts?.fileName ?? `salary-slip-staff-${entry.staffId}-run-${entry.payrollRunId}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
