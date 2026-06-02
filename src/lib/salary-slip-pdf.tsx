import React from "react";
import { Document, Page, View, Text, Image, StyleSheet, pdf } from "@react-pdf/renderer";
import { ComponentSnapshotItem, PayrollEntry } from "./hr-api";
import { SchoolInfo } from "./useSchoolInfo";

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

const styles = StyleSheet.create({
  page: { fontFamily: "Helvetica", fontSize: 10, padding: 30, color: "#111" },
  
  // Header
  headerContainer: { flexDirection: "row", alignItems: "center", borderBottomWidth: 1.5, borderBottomColor: "#333", paddingBottom: 10, marginBottom: 20 },
  logo: { width: 60, height: 60, marginRight: 15 },
  schoolInfoContainer: { flex: 1 },
  schoolName: { fontSize: 18, fontFamily: "Helvetica-Bold", color: "#000" },
  tagline: { fontSize: 10, color: "#555", marginTop: 2, fontStyle: "italic" },
  address: { fontSize: 9, color: "#666", marginTop: 2 },
  contacts: { fontSize: 9, color: "#666", marginTop: 1 },

  // Title
  titleContainer: { alignItems: "center", marginBottom: 15 },
  slipTitle: { fontSize: 14, fontFamily: "Helvetica-Bold", textTransform: "uppercase", letterSpacing: 1 },

  // Sections
  section: { marginBottom: 15, borderWidth: 1, borderColor: "#ccc", borderRadius: 4 },
  sectionTitle: { backgroundColor: "#f0f0f0", padding: 6, fontSize: 10, fontFamily: "Helvetica-Bold", borderBottomWidth: 1, borderBottomColor: "#ccc" },
  
  // Grid / Layouts
  gridRow: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#eee" },
  gridCol: { flex: 1, flexDirection: "row", padding: 6, borderRightWidth: 0.5, borderRightColor: "#eee" },
  gridColNoBorder: { borderRightWidth: 0 },
  label: { color: "#555", width: 90, fontSize: 9 },
  value: { fontFamily: "Helvetica-Bold", fontSize: 9, flex: 1 },

  // Split Tables (Earnings / Deductions)
  splitTableContainer: { flexDirection: "row", borderWidth: 1, borderColor: "#ccc", borderRadius: 4, marginBottom: 15 },
  halfTable: { flex: 1 },
  halfTableLeft: { borderRightWidth: 1, borderRightColor: "#ccc" },
  tableHeaderRow: { flexDirection: "row", backgroundColor: "#f0f0f0", borderBottomWidth: 1, borderBottomColor: "#ccc", padding: 6 },
  tableRow: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#eee", padding: 6 },
  tableColDesc: { flex: 1, fontSize: 9 },
  tableColAmt: { width: 70, textAlign: "right", fontSize: 9 },
  tableColHeader: { fontFamily: "Helvetica-Bold", fontSize: 9 },

  // Totals
  tableTotalRow: { flexDirection: "row", borderTopWidth: 1, borderTopColor: "#aaa", padding: 6, backgroundColor: "#fafafa" },
  totalLabel: { flex: 1, fontFamily: "Helvetica-Bold", fontSize: 9 },
  totalValue: { width: 70, textAlign: "right", fontFamily: "Helvetica-Bold", fontSize: 9 },

  // Net Pay
  netPayContainer: { flexDirection: "row", justifyContent: "flex-end", marginTop: 10, marginBottom: 20 },
  netPayBox: { backgroundColor: "#f8f9fa", borderWidth: 1, borderColor: "#333", padding: 12, borderRadius: 4, alignItems: "flex-end" },
  netPayLabel: { fontSize: 10, color: "#555" },
  netPayValue: { fontSize: 16, fontFamily: "Helvetica-Bold", color: "#000", marginTop: 4 },
  
  // Footer
  footer: { position: "absolute", bottom: 30, left: 30, right: 30, borderTopWidth: 0.5, borderTopColor: "#ccc", paddingTop: 10, textAlign: "center", color: "#888", fontSize: 8 },
});

interface SalarySlipProps {
  entry: PayrollEntry;
  schoolInfo?: SchoolInfo;
  month?: number;
  year?: number;
}

function SalarySlipDocument({ entry, schoolInfo, month, year }: SalarySlipProps) {
  const snapshot = entry.componentsSnapshot ?? {};

  const staffName = entry.staff
    ? `${entry.staff.user.firstName} ${entry.staff.user.lastName}`
    : `Staff #${entry.staffId}`;
  
  const rawDesignation = entry.staff?.designation;
  const designation = typeof rawDesignation === 'string' 
    ? rawDesignation 
    : (rawDesignation as any)?.title ?? "—";
  
  const empCode = entry.staff?.employeeCode ? `${entry.staff.employeeCode}` : `#${entry.staffId}`;

  // Separate earnings and deductions
  // Supports both the enriched format { amount, name, type, displayOrder }
  // and the legacy plain-number format for entries created before the migration.
  const earnings: { label: string; amount: number; order: number }[] = [];
  const deductions: { label: string; amount: number; order: number }[] = [];
  const LEGACY_DEDUCTION_KEYS = ["PF", "PT", "TDS", "LOP_AMOUNT", "_DED"];

  Object.entries(snapshot).forEach(([key, val]) => {
    if (!val) return;
    if (typeof val === "object") {
      // Enriched format — use stored metadata
      const item = val as ComponentSnapshotItem;
      if (item.amount <= 0) return;
      if (item.type === "DEDUCTION") {
        deductions.push({ label: item.name || key, amount: item.amount, order: item.displayOrder });
      } else {
        earnings.push({ label: item.name || key, amount: item.amount, order: item.displayOrder });
      }
    } else {
      // Legacy format — infer type from code heuristic
      if (val <= 0) return;
      if (LEGACY_DEDUCTION_KEYS.some((dk) => key.toUpperCase().includes(dk))) {
        deductions.push({ label: key, amount: val, order: 99 });
      } else {
        earnings.push({ label: key, amount: val, order: 99 });
      }
    }
  });

  earnings.sort((a, b) => a.order - b.order || a.label.localeCompare(b.label));
  deductions.sort((a, b) => a.order - b.order || a.label.localeCompare(b.label));

  const totalEarnings = earnings.reduce((s, e) => s + e.amount, 0);
  const totalDeductions = deductions.reduce((s, d) => s + d.amount, 0);

  const monthYear = month && year
    ? `${MONTHS[month - 1]} ${year}`
    : year
    ? String(year)
    : `${MONTHS[new Date().getMonth()]} ${new Date().getFullYear()}`;

  const fmt = (n: number) => `Rs. ${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const schoolName = schoolInfo?.name ?? "School";

  // Balance out the table rows to make them equal height
  const maxRows = Math.max(earnings.length, deductions.length);
  const earningsList = [...earnings];
  const deductionsList = [...deductions];
  while (earningsList.length < maxRows) earningsList.push({ label: "", amount: -1, order: 99 });
  while (deductionsList.length < maxRows) deductionsList.push({ label: "", amount: -1, order: 99 });

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        
        {/* Header */}
        <View style={styles.headerContainer}>
          {schoolInfo?.logoDataUrl && (
            <Image src={schoolInfo.logoDataUrl} style={styles.logo} />
          )}
          <View style={styles.schoolInfoContainer}>
            <Text style={styles.schoolName}>{schoolName}</Text>
            {schoolInfo?.tagline && <Text style={styles.tagline}>{schoolInfo.tagline}</Text>}
            {schoolInfo?.address && <Text style={styles.address}>{schoolInfo.address}</Text>}
            {(schoolInfo?.phone || schoolInfo?.email) && (
              <Text style={styles.contacts}>
                {[schoolInfo.phone, schoolInfo.email].filter(Boolean).join(" | ")}
              </Text>
            )}
          </View>
        </View>

        {/* Title */}
        <View style={styles.titleContainer}>
          <Text style={styles.slipTitle}>Payslip for {monthYear}</Text>
        </View>

        {/* Employee Summary Block */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Employee Summary</Text>
          <View style={styles.gridRow}>
            <View style={styles.gridCol}>
              <Text style={styles.label}>Employee Name:</Text>
              <Text style={styles.value}>{staffName}</Text>
            </View>
            <View style={[styles.gridCol, styles.gridColNoBorder]}>
              <Text style={styles.label}>Working Days:</Text>
              <Text style={styles.value}>{entry.workingDays}</Text>
            </View>
          </View>
          <View style={styles.gridRow}>
            <View style={styles.gridCol}>
              <Text style={styles.label}>Employee Code:</Text>
              <Text style={styles.value}>{empCode}</Text>
            </View>
            <View style={[styles.gridCol, styles.gridColNoBorder]}>
              <Text style={styles.label}>Paid Days:</Text>
              <Text style={styles.value}>{entry.paidDays}</Text>
            </View>
          </View>
          <View style={[styles.gridRow, { borderBottomWidth: 0 }]}>
            <View style={styles.gridCol}>
              <Text style={styles.label}>Designation:</Text>
              <Text style={styles.value}>{designation}</Text>
            </View>
            <View style={[styles.gridCol, styles.gridColNoBorder]}>
              <Text style={styles.label}>LOP Days:</Text>
              <Text style={styles.value}>{entry.lopDays}</Text>
            </View>
          </View>
        </View>

        {/* Earnings and Deductions Side-by-Side */}
        <View style={styles.splitTableContainer}>
          
          {/* Earnings (Left) */}
          <View style={[styles.halfTable, styles.halfTableLeft]}>
            <View style={styles.tableHeaderRow}>
              <Text style={[styles.tableColDesc, styles.tableColHeader]}>Earnings</Text>
              <Text style={[styles.tableColAmt, styles.tableColHeader]}>Amount</Text>
            </View>
            {earningsList.map((e, i) => (
              <View key={`earning-${i}`} style={styles.tableRow}>
                <Text style={styles.tableColDesc}>{e.label}</Text>
                <Text style={styles.tableColAmt}>{e.amount >= 0 ? fmt(e.amount) : ""}</Text>
              </View>
            ))}
            <View style={styles.tableTotalRow}>
              <Text style={styles.totalLabel}>Gross Earnings</Text>
              <Text style={styles.totalValue}>{fmt(totalEarnings)}</Text>
            </View>
          </View>

          {/* Deductions (Right) */}
          <View style={styles.halfTable}>
            <View style={styles.tableHeaderRow}>
              <Text style={[styles.tableColDesc, styles.tableColHeader]}>Deductions</Text>
              <Text style={[styles.tableColAmt, styles.tableColHeader]}>Amount</Text>
            </View>
            {deductionsList.map((d, i) => (
              <View key={`deduction-${i}`} style={styles.tableRow}>
                <Text style={styles.tableColDesc}>{d.label}</Text>
                <Text style={styles.tableColAmt}>{d.amount >= 0 ? fmt(d.amount) : ""}</Text>
              </View>
            ))}
            <View style={styles.tableTotalRow}>
              <Text style={styles.totalLabel}>Total Deductions</Text>
              <Text style={styles.totalValue}>{fmt(totalDeductions)}</Text>
            </View>
          </View>

        </View>

        {/* Net Pay */}
        <View style={styles.netPayContainer}>
          <View style={styles.netPayBox}>
            <Text style={styles.netPayLabel}>Net Payable Amount</Text>
            <Text style={styles.netPayValue}>{fmt(entry.netPay)}</Text>
          </View>
        </View>

        {/* Footer */}
        <Text style={styles.footer}>
          This is a computer-generated document and does not require a signature.
        </Text>
      </Page>
    </Document>
  );
}

export async function generateSalarySlipPdf(
  entry: PayrollEntry,
  opts?: { schoolInfo?: SchoolInfo; fileName?: string; month?: number; year?: number },
) {
  const blob = await pdf(
    <SalarySlipDocument 
      entry={entry} 
      schoolInfo={opts?.schoolInfo} 
      month={opts?.month} 
      year={opts?.year} 
    />
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
