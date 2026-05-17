/**
 * hr-api.ts — Typed API client for all HR Portal endpoints.
 * Uses the same token/slug handling as api.ts.
 */
import { authFetch } from './auth';
import { getEnv } from './env';

const base = () => getEnv('API_URL') || 'http://localhost:3000';

async function req<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const res = await authFetch(`${base()}${path}`, {
    method,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err: any = new Error('HR API error');
    err.status = res.status;
    err.info = await res.json().catch(() => ({}));
    throw err;
  }
  if (res.status === 204) return undefined as T;
  const text = await res.text();
  return text ? JSON.parse(text) : (undefined as T);
}

// ── Types ─────────────────────────────────────────────────────────────────

export type LeaveGender = 'ALL' | 'MALE' | 'FEMALE';

export interface StaffLeavePolicy {
  id: number;
  name: string;
  code: string;
  totalDaysPerYear: number;
  carryForward: boolean;
  maxCarryForwardDays: number;
  isPaid: boolean;
  proRata: boolean;
  appliesToGender: LeaveGender;
  isActive: boolean;
}

/** Read-only shape returned by GET /hr/leave-policies/defaults (no id/isActive). */
export interface LeavePolicyDefault {
  name: string;
  code: string;
  totalDaysPerYear: number;
  carryForward: boolean;
  maxCarryForwardDays: number;
  isPaid: boolean;
  proRata: boolean;
  appliesToGender: LeaveGender;
}

export type AccrualFrequency = 'YEARLY' | 'MONTHLY';

export interface HrSettings {
  leaveYearStartMonth: number; // 1–12
  accrualFrequency: AccrualFrequency;
}

export interface StaffLeaveBalance {
  id: number;
  staffId: number;
  leavePolicyId: number;
  leavePolicy: StaffLeavePolicy;
  year: number;
  allocated: number;
  used: number;
  lopDays: number;
}

export type StaffLeaveStatus =
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED'
  | 'CANCELLED';
export type StaffLeaveDuration = 'FULL_DAY' | 'HALF_DAY';

export interface StaffLeaveApplication {
  id: number;
  staffId: number;
  leavePolicyId: number;
  leavePolicy: StaffLeavePolicy;
  fromDate: string;
  toDate: string;
  leaveDuration: StaffLeaveDuration;
  reason: string;
  status: StaffLeaveStatus;
  leaveDays: number;
  isLop: boolean;
  lopDays: number;
  attachmentUrl?: string;
  approverId?: number;
  approvedAt?: string;
  rejectionReason?: string;
  createdAt: string;
}

export type StaffAttendanceStatus =
  | 'PRESENT'
  | 'ABSENT'
  | 'LATE'
  | 'HALF_DAY'
  | 'ON_LEAVE'
  | 'HOLIDAY';
export type AttendanceMethod = 'MANUAL' | 'WEBAUTHN' | 'GEOFENCE' | 'BYPASS';

export interface StaffAttendanceRecord {
  id: number;
  staffId: number;
  date: string;
  status: StaffAttendanceStatus;
  method: AttendanceMethod;
  checkInTime?: string;
  checkOutTime?: string;
  lat?: number;
  lng?: number;
  matchedZoneId?: number;
  overrideReason?: string;
  /** Populated by the daily endpoint (HR view) */
  staff?: {
    id: number;
    employeeCode: number;
    user?: { firstName: string; lastName: string; mobile?: string };
  };
  /** Populated by the daily endpoint when method = MANUAL or WEBAUTHN kiosk-by-admin */
  markedBy?: { id: number; firstName: string; lastName: string; role: string };
}

export interface AttendanceZone {
  id: number;
  name: string;
  lat: number;
  lng: number;
  radiusMeters: number;
  isActive: boolean;
}

export interface AttendanceBypassWindow {
  id: number;
  expiresAt: string;
  reason?: string;
  createdAt: string;
}

export interface SalaryComponentDef {
  id: number;
  name: string;
  code: string;
  type: 'EARNING' | 'DEDUCTION';
  calcType: 'FLAT' | 'PERCENTAGE_OF_BASIC' | 'PERCENTAGE_OF_GROSS';
  value: number;
  isDefault: boolean;
  isActive: boolean;
  displayOrder: number;
}

export interface EmployeeSalaryConfig {
  id: number;
  staffId: number;
  grossCTC: number;
  effectiveFrom: string;
  effectiveTo?: string;
  componentOverrides: Record<string, number>;
}

export type PayrollStatus = 'DRAFT' | 'FINALIZED';

export interface PayrollRun {
  id: number;
  month: number;
  year: number;
  status: PayrollStatus;
  finalizedAt?: string;
  createdAt: string;
}

export interface PayrollEntry {
  id: number;
  payrollRunId: number;
  staffId: number;
  workingDays: number;
  presentDays: number;
  lopDays: number;
  paidDays: number;
  grossEarnings: number;
  totalDeductions: number;
  netPay: number;
  componentsSnapshot: Record<string, number>;
  staff?: {
    user: { firstName: string; lastName: string };
    employeeCode?: number;
    designation?: string;
  };
}

export interface StaffBiometric {
  id: number;
  credentialId: string;
  deviceName: string;
  registeredAt: string;
  staffId?: number;
  staff?: {
    id: number;
    employeeCode: number;
    user: { firstName: string; lastName: string };
  };
}

export interface WebauthnRegistrationPermit {
  id: number;
  staffId: number;
  grantedByUserId: number;
  grantedAt: string;
  expiresAt: string;
  usedAt: string | null;
}

export interface WebauthnPermitStatus {
  allowed: boolean;
  hasStaffProfile?: boolean;
  expiresAt?: string;
}

// ── Leave Policies ─────────────────────────────────────────────────────────

export const hrApi = {
  leavePolicies: {
    list: () => req<StaffLeavePolicy[]>('GET', '/hr/leave-policies'),
    listDefaults: () =>
      req<LeavePolicyDefault[]>('GET', '/hr/leave-policies/defaults'),
    create: (data: Partial<StaffLeavePolicy>) =>
      req<StaffLeavePolicy>('POST', '/hr/leave-policies', data),
    update: (id: number, data: Partial<StaffLeavePolicy>) =>
      req<StaffLeavePolicy>('PATCH', `/hr/leave-policies/${id}`, data),
    remove: (id: number) => req<void>('DELETE', `/hr/leave-policies/${id}`),
    seedDefaults: () =>
      req<StaffLeavePolicy[]>('POST', '/hr/leave-policies/seed-defaults'),
  },

  // ── HR Settings (per-school leave-year calendar + accrual mode) ─────────────
  settings: {
    get: () => req<HrSettings>('GET', '/hr/staff-leaves/settings'),
    update: (data: Partial<HrSettings>) =>
      req<HrSettings>('PATCH', '/hr/staff-leaves/settings', data),
    initYearBalances: () =>
      req<{ initialized: number }>(
        'POST',
        '/hr/staff-leaves/init-year-balances',
      ),
  },

  // ── Staff Leaves ─────────────────────────────────────────────────────────
  leaves: {
    apply: (data: {
      staffId: number;
      leavePolicyId: number;
      fromDate: string;
      toDate: string;
      leaveDuration: StaffLeaveDuration;
      reason: string;
      attachmentUrl?: string;
    }) => req<StaffLeaveApplication>('POST', '/hr/staff-leaves', data),
    list: (params?: {
      staffId?: number;
      status?: StaffLeaveStatus;
      month?: number;
      year?: number;
    }) => {
      const q = params
        ? '?' +
          new URLSearchParams(
            Object.entries(params)
              .filter(([, v]) => v !== undefined)
              .map(([k, v]) => [k, String(v)]),
          ).toString()
        : '';
      return req<StaffLeaveApplication[]>('GET', `/hr/staff-leaves${q}`);
    },
    approve: (id: number) =>
      req<StaffLeaveApplication>('PATCH', `/hr/staff-leaves/${id}/approve`),
    reject: (id: number, rejectionReason: string) =>
      req<StaffLeaveApplication>('PATCH', `/hr/staff-leaves/${id}/reject`, {
        rejectionReason,
      }),
    cancel: (id: number) =>
      req<StaffLeaveApplication>('PATCH', `/hr/staff-leaves/${id}/cancel`),
    balances: (staffId: number, year?: number) => {
      const q = year ? `?year=${year}` : '';
      return req<StaffLeaveBalance[]>(
        'GET',
        `/hr/staff-leaves/balance/${staffId}${q}`,
      );
    },
    // Self-service: current user's leaves and balances (JWT sub → staffId resolved on backend)
    myLeaves: (params?: { status?: StaffLeaveStatus; year?: number }) => {
      const q = params
        ? '?' +
          new URLSearchParams(
            Object.entries(params)
              .filter(([, v]) => v !== undefined)
              .map(([k, v]) => [k, String(v)]),
          ).toString()
        : '';
      return req<StaffLeaveApplication[]>('GET', `/hr/staff-leaves/mine${q}`);
    },
    myBalances: (year?: number) => {
      const q = year ? `?year=${year}` : '';
      return req<StaffLeaveBalance[]>('GET', `/hr/staff-leaves/my-balance${q}`);
    },
  },

  // ── Attendance ────────────────────────────────────────────────────────────
  attendance: {
    submit: (data: {
      staffId: number;
      date: string;
      method: AttendanceMethod;
      status?: StaffAttendanceStatus;
      lat?: number;
      lng?: number;
      checkInTime?: string;
      checkOutTime?: string;
      clientTimestamp?: string;
      overrideReason?: string;
    }) => req<StaffAttendanceRecord>('POST', '/hr/staff-attendance', data),
    selfCheckIn: (data: {
      lat: number;
      lng: number;
      clientTimestamp?: string;
    }) =>
      req<StaffAttendanceRecord>(
        'POST',
        '/hr/staff-attendance/self-checkin',
        data,
      ),
    myMonthly: (month: number, year: number) =>
      req<StaffAttendanceRecord[]>(
        'GET',
        `/hr/staff-attendance/monthly/me?month=${month}&year=${year}`,
      ),
    monthly: (staffId: number, month: number, year: number) =>
      req<StaffAttendanceRecord[]>(
        'GET',
        `/hr/staff-attendance/monthly?staffId=${staffId}&month=${month}&year=${year}`,
      ),
    daily: (date: string) =>
      req<StaffAttendanceRecord[]>(
        'GET',
        `/hr/staff-attendance/daily?date=${date}`,
      ),
    zones: {
      list: () => req<AttendanceZone[]>('GET', '/hr/staff-attendance/zones'),
      create: (data: {
        name: string;
        lat: number;
        lng: number;
        radiusMeters?: number;
      }) => req<AttendanceZone>('POST', '/hr/staff-attendance/zones', data),
      update: (id: number, data: Partial<AttendanceZone>) =>
        req<AttendanceZone>('PATCH', `/hr/staff-attendance/zones/${id}`, data),
      remove: (id: number) =>
        req<void>('DELETE', `/hr/staff-attendance/zones/${id}`),
    },
    bypass: {
      getActive: () =>
        req<AttendanceBypassWindow | null>(
          'GET',
          '/hr/staff-attendance/bypass/active',
        ),
      create: (data: { reason?: string; durationHours?: number }) =>
        req<AttendanceBypassWindow>(
          'POST',
          '/hr/staff-attendance/bypass',
          data,
        ),
    },
    webauthn: {
      // HR: register on behalf of staff
      getRegOptions: (staffId: number) =>
        req<any>('POST', '/hr/staff-attendance/webauthn/register-options', {
          staffId,
        }),
      verifyReg: (staffId: number, response: any, deviceName?: string) =>
        req<StaffBiometric>(
          'POST',
          '/hr/staff-attendance/webauthn/register-verify',
          { staffId, response, deviceName },
        ),
      credentials: (staffId: number) =>
        req<StaffBiometric[]>(
          'GET',
          `/hr/staff-attendance/webauthn/credentials/${staffId}`,
        ),
      deleteCredential: (id: number) =>
        req<void>('DELETE', `/hr/staff-attendance/webauthn/credentials/${id}`),
      allCredentials: () =>
        req<StaffBiometric[]>(
          'GET',
          '/hr/staff-attendance/webauthn/all-credentials',
        ),

      // HR: permit management
      grantPermit: (staffId: number) =>
        req<WebauthnRegistrationPermit>(
          'POST',
          `/hr/staff-attendance/webauthn/permit/${staffId}`,
        ),
      revokePermitByStaff: (staffId: number) =>
        req<void>(
          'DELETE',
          `/hr/staff-attendance/webauthn/permit/by-staff/${staffId}`,
        ),
      revokePermit: (permitId: number) =>
        req<void>('DELETE', `/hr/staff-attendance/webauthn/permit/${permitId}`),
      listPermits: () =>
        req<WebauthnRegistrationPermit[]>(
          'GET',
          '/hr/staff-attendance/webauthn/permits',
        ),

      // Staff self-service
      myPermitStatus: () =>
        req<WebauthnPermitStatus>(
          'GET',
          '/hr/staff-attendance/webauthn/my-permit-status',
        ),
      selfGetRegOptions: () =>
        req<any>(
          'POST',
          '/hr/staff-attendance/webauthn/self/register-options',
          {},
        ),
      selfVerifyReg: (response: any, deviceName?: string) =>
        req<StaffBiometric>(
          'POST',
          '/hr/staff-attendance/webauthn/self/register-verify',
          { response, deviceName },
        ),
      myCredentials: () =>
        req<StaffBiometric[]>(
          'GET',
          '/hr/staff-attendance/webauthn/self/credentials',
        ),
      deleteMyCredential: (id: number) =>
        req<void>(
          'DELETE',
          `/hr/staff-attendance/webauthn/self/credentials/${id}`,
        ),

      // Kiosk authentication
      getAuthOptions: (employeeCode: number) =>
        req<any>(
          'GET',
          `/hr/staff-attendance/webauthn/auth-options?employeeCode=${employeeCode}`,
        ),
      verifyAuth: (
        employeeCode: number,
        authenticationResponse: any,
        date?: string,
      ) =>
        req<StaffAttendanceRecord>(
          'POST',
          `/hr/staff-attendance/webauthn/verify${date ? `?date=${date}` : ''}`,
          { employeeCode, authenticationResponse },
        ),
    },
  },

  // ── Salary Components ─────────────────────────────────────────────────────
  salaryComponents: {
    list: () => req<SalaryComponentDef[]>('GET', '/hr/salary-components'),
    create: (data: Partial<SalaryComponentDef>) =>
      req<SalaryComponentDef>('POST', '/hr/salary-components', data),
    update: (id: number, data: Partial<SalaryComponentDef>) =>
      req<SalaryComponentDef>('PATCH', `/hr/salary-components/${id}`, data),
    remove: (id: number) => req<void>('DELETE', `/hr/salary-components/${id}`),
    seedDefaults: () =>
      req<SalaryComponentDef[]>('POST', '/hr/salary-components/seed-defaults'),
  },

  // ── Employee Salary ───────────────────────────────────────────────────────
  employeeSalary: {
    listActive: () => req<EmployeeSalaryConfig[]>('GET', '/hr/employee-salary'),
    history: (staffId: number) =>
      req<EmployeeSalaryConfig[]>(
        'GET',
        `/hr/employee-salary/${staffId}/history`,
      ),
    active: (staffId: number) =>
      req<EmployeeSalaryConfig | null>(
        'GET',
        `/hr/employee-salary/${staffId}/active`,
      ),
    create: (data: {
      staffId: number;
      grossCTC: number;
      effectiveFrom: string;
      componentOverrides?: Record<string, number>;
    }) => req<EmployeeSalaryConfig>('POST', '/hr/employee-salary', data),
  },

  // ── Payroll ───────────────────────────────────────────────────────────────
  payroll: {
    listRuns: () => req<PayrollRun[]>('GET', '/hr/payroll/runs'),
    generateDraft: (month: number, year: number) =>
      req<PayrollRun>('POST', '/hr/payroll/runs/draft', { month, year }),
    finalize: (runId: number) =>
      req<PayrollRun>('PATCH', `/hr/payroll/runs/${runId}/finalize`),
    entries: (runId: number) =>
      req<PayrollEntry[]>('GET', `/hr/payroll/runs/${runId}/entries`),
    entry: (runId: number, staffId: number) =>
      req<PayrollEntry>('GET', `/hr/payroll/runs/${runId}/entries/${staffId}`),
    recalculate: (runId: number, staffId: number) =>
      req<PayrollEntry>(
        'POST',
        `/hr/payroll/runs/${runId}/recalculate/${staffId}`,
      ),
    mySlips: (staffId?: number) => {
      const q = staffId ? `?staffId=${staffId}` : '';
      return req<PayrollEntry[]>('GET', `/hr/payroll/my-slips${q}`);
    },
  },
};
