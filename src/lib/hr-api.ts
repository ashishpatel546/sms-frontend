/**
 * hr-api.ts — Typed API client for all HR Portal endpoints.
 * Uses the same token/slug handling as api.ts.
 */
import { authFetch } from './auth';
import { getEnv } from './env';

const base = () => getEnv('API_URL') || 'http://localhost:3000';

/**
 * Returns true when the app is running as an installed PWA (standalone mode).
 * Covers: iOS Safari Add-to-Home-Screen, Android Chrome/Edge PWA, desktop PWA.
 */
function isPwa(): boolean {
  if (typeof window === 'undefined') return false;
  // iOS Safari
  if ((window.navigator as any).standalone === true) return true;
  // Chrome / Android / Desktop
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches ||
    window.matchMedia('(display-mode: minimal-ui)').matches
  );
}

async function req<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const extraHeaders: Record<string, string> = {};
  if (isPwa()) extraHeaders['X-PWA-Context'] = '1';

  const res = await authFetch(`${base()}${path}`, {
    method,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    headers: extraHeaders,
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
  staff?: {
    user: { firstName: string; lastName: string; mobile?: string };
    employeeCode?: number;
    designation?: string;
  };
}

export type StaffAttendanceStatus =
  | 'PRESENT'
  | 'ABSENT'
  | 'LATE'
  | 'HALF_DAY'
  | 'ON_LEAVE'
  | 'HOLIDAY';
/**
 * `NOT_MARKED` is never stored — it is the *absence* of an attendance row. The
 * daily endpoint synthesises it for rostered staff with no record when the
 * list is filtered to `status=NOT_MARKED`, so only the daily register and its
 * filter deal in this value; a submitted status is always a real one.
 */
export type DailyAttendanceStatus = StaffAttendanceStatus | 'NOT_MARKED';
export type AttendanceMethod = 'MANUAL' | 'WEBAUTHN' | 'GEOFENCE' | 'BYPASS';
export type CheckOutReason =
  | 'REGULAR'
  | 'HALF_DAY'
  | 'EARLY_LEAVE'
  | 'OVERTIME'
  | 'FORGOT';

export interface StaffAttendanceRecord {
  id: number;
  staffId: number;
  date: string;
  status: StaffAttendanceStatus;
  method: AttendanceMethod;
  checkInTime?: string;
  checkOutTime?: string;
  checkOutReason?: CheckOutReason;
  lat?: number;
  lng?: number;
  matchedZoneId?: number;
  overrideReason?: string;
  /**
   * How the **check-out** was recorded. Null/absent while the record is still
   * open, or for legacy rows closed before the check-out audit columns existed.
   * `method` above describes the CHECK-IN side only.
   */
  checkOutMethod?: AttendanceMethod | null;
  /**
   * Hours between check-in and check-out, computed server-side by the daily
   * endpoint. Null when either timestamp is missing or the span is not
   * positive — prefer this over subtracting the timestamps in the client.
   */
  workedHours?: number | null;
  /** Populated by the daily endpoint (HR view) */
  staff?: {
    id: number;
    employeeCode: number;
    user?: { id?: number; firstName: string; lastName: string; mobile?: string };
  };
  /** Who recorded the CHECK-IN (self for geofence, HR user for manual/kiosk). */
  markedBy?: { id: number; firstName: string; lastName: string; role: string };
  /** Who recorded the CHECK-OUT — self for geo checkout, HR user when resolved. */
  checkOutBy?: { id: number; firstName: string; lastName: string; role: string };
}

export interface TodayAttendanceStatus {
  todayRecord: StaffAttendanceRecord | null;
  pendingCheckOut: {
    date: string;
    checkInTime: string;
    daysAgo: number;
  } | null;
  canCheckIn: boolean;
  canCheckOut: boolean;
}

export interface HrPendingCheckoutItem {
  staffId: number;
  employeeCode: number | null;
  name: string;
  date: string;
  checkInTime: string;
  daysAgo: number;
}

export interface DailyAttendanceSummary {
  PRESENT: number;
  LATE: number;
  ABSENT: number;
  HALF_DAY: number;
  ON_LEAVE: number;
  HOLIDAY: number;
  /** Active staff with no attendance record at all for the day. */
  NOT_MARKED?: number;
}

export interface PaginatedDailyAttendance {
  data: StaffAttendanceRecord[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  /** Staff expected to mark attendance on the requested date. */
  totalStaff?: number;
  summary: DailyAttendanceSummary;
  /**
   * The real, ongoing "late today" count — everyone whose isLate=true for the
   * date. Prefer this over `summary.LATE`, which counts the legacy `status
   * === 'LATE'` value and trends toward 0 now that auto-compute never
   * assigns it (see the `isLate` column on StaffAttendanceRecord).
   */
  lateArrivals?: number;
}

export interface AttendanceReportSummaryRow {
  staffId: number;
  name: string;
  employeeCode: number | null;
  mobile: string | null;
  present: number;
  late: number;
  halfDay: number;
  absent: number;
  onLeave: number;
  holiday: number;
  notMarked: number;
  daysWithRecords: number;
  totalWorkedHours: number;
  avgWorkedHours: number | null;
}

export interface AttendanceReportDetailRow {
  staffId: number;
  name: string;
  employeeCode: number | null;
  mobile: string | null;
  date: string;
  status: StaffAttendanceStatus;
  checkInTime: string | null;
  checkOutTime: string | null;
  workedHours: number | null;
  /** Arrived after the late cutoff. Independent of `status` — see isLate on records. */
  isLate: boolean;
  /** How the check-in happened. */
  checkInMethod: AttendanceMethod | null;
  /** How the check-out happened; null while open or for pre-audit rows. */
  checkOutMethod: AttendanceMethod | null;
  /** Who recorded the check-in. */
  markedByName: string | null;
  /** Who recorded the check-out. */
  checkOutByName: string | null;
}

export interface AttendanceReport {
  from: string;
  to: string;
  generatedAt: string;
  totalDaysInRange: number;
  summary: AttendanceReportSummaryRow[];
  rows: AttendanceReportDetailRow[];
}

/** One vertex of a drawn campus outline. */
export interface BoundaryPoint {
  lat: number;
  lng: number;
}

export interface AttendanceZone {
  id: number;
  name: string;
  lat: number;
  lng: number;
  radiusMeters: number;
  /**
   * Traced campus outline. When set it replaces the circle entirely and
   * `radiusMeters` is ignored; `lat`/`lng` remain the map centre. Null on zones
   * created before boundaries existed, which stay circles until redrawn.
   */
  boundary: BoundaryPoint[] | null;
  isActive: boolean;
}

export interface AttendanceBypassWindow {
  id: number;
  expiresAt: string;
  reason?: string;
  createdAt: string;
}

/**
 * Per-component value stored inside a payroll entry's componentsSnapshot.
 * New entries use this rich format; legacy entries may have plain numbers —
 * always check `typeof val === 'object'` before reading fields.
 */
export interface ComponentSnapshotItem {
  amount: number;
  name: string;
  type: 'EARNING' | 'DEDUCTION';
  displayOrder: number;
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
  staff?: {
    user: { firstName: string; lastName: string; mobile?: string };
    employeeCode?: number;
    designation?: string;
  };
}

export interface PayrollMonthlySummary {
  month: number;
  year: number;
  monthName: string;
  headcount: number;
  totalGross: number;
  totalDeductions: number;
  totalNetPay: number;
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
  monthlyGrossCTC?: number;
  grossEarnings: number;
  totalDeductions: number;
  netPay: number;
  componentsSnapshot: Record<string, ComponentSnapshotItem | number>;
  payrollRun?: PayrollRun;
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
  devicePublicKey?: string | null;
  staffId?: number;
  staff?: {
    id: number;
    employeeCode: number;
    user: { firstName: string; lastName: string };
  };
}

export interface DeviceRegistrationRow {
  staffId: number;
  employeeCode: number | null;
  name: string;
  mobile: string | null;
  isRegistered: boolean;
  deviceName: string | null;
  registeredAt: string | null;
  biometricId: number | null;
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
      /** Mandatory when `method` is GEOFENCE; meaningless for MANUAL. */
      accuracy?: number;
      checkInTime?: string;
      checkOutTime?: string;
      clientTimestamp?: string;
      overrideReason?: string;
    }) => req<StaffAttendanceRecord>('POST', '/hr/staff-attendance', data),
    selfCheckIn: (data: {
      lat: number;
      lng: number;
      /**
       * `GeolocationCoordinates.accuracy` in metres. Required — the server
       * rejects the request without it rather than assuming the coordinates
       * can be trusted. See `acquirePreciseFix` in `lib/geolocation.ts`.
       */
      accuracy: number;
      clientTimestamp?: string;
      checkInTime?: string;
      status?: 'PRESENT' | 'LATE' | 'HALF_DAY';
      webauthnAssertion: any;
    }) =>
      req<StaffAttendanceRecord>(
        'POST',
        '/hr/staff-attendance/self-checkin',
        data,
      ),
    selfCheckOut: (data: {
      lat: number;
      lng: number;
      /** Required, for the same reason as on check-in. */
      accuracy: number;
      clientTimestamp?: string;
      checkOutTime?: string;
      reason: CheckOutReason;
      statusOverride?: 'PRESENT' | 'LATE' | 'HALF_DAY';
      webauthnAssertion: any;
    }) =>
      req<StaffAttendanceRecord>(
        'POST',
        '/hr/staff-attendance/self-checkout',
        data,
      ),
    resolvePending: (data: { pendingDate: string; webauthnAssertion: any }) =>
      req<StaffAttendanceRecord>(
        'POST',
        '/hr/staff-attendance/resolve-pending',
        data,
      ),
    pendingCheckouts: () =>
      req<HrPendingCheckoutItem[]>(
        'GET',
        '/hr/staff-attendance/pending-checkouts',
      ),
    hrResolvePending: (data: {
      staffId: number;
      pendingDate: string;
      checkOutTime?: string;
      reason?: string;
      hrNote?: string;
      status?: any;
    }) =>
      req<StaffAttendanceRecord>(
        'POST',
        '/hr/staff-attendance/hr-resolve-pending',
        data,
      ),
    todayStatus: () =>
      req<TodayAttendanceStatus>('GET', '/hr/staff-attendance/me/today-status'),
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
    daily: (
      date: string,
      opts?: {
        page?: number;
        limit?: number;
        search?: string;
        employeeCode?: string;
        staffId?: string;
        /**
         * Narrows the list only — `summary` and `lateArrivals` always describe
         * the whole day, so the filter buttons keep their counts while one of
         * them is active.
         */
        status?: DailyAttendanceStatus;
      },
    ) => {
      const p = new URLSearchParams({ date });
      if (opts?.page) p.set('page', String(opts.page));
      if (opts?.limit) p.set('limit', String(opts.limit));
      if (opts?.search) p.set('search', opts.search);
      if (opts?.employeeCode) p.set('employeeCode', opts.employeeCode);
      if (opts?.staffId) p.set('staffId', opts.staffId);
      if (opts?.status) p.set('status', opts.status);
      return req<PaginatedDailyAttendance>(
        'GET',
        `/hr/staff-attendance/daily?${p.toString()}`,
      );
    },
    getReport: (opts: { from: string; to: string; staffId?: number }) => {
      const p = new URLSearchParams({ from: opts.from, to: opts.to });
      if (opts.staffId) p.set('staffId', String(opts.staffId));
      return req<AttendanceReport>(
        'GET',
        `/hr/staff-attendance/report?${p.toString()}`,
      );
    },
    exportReportCsv: async (opts: {
      from: string;
      to: string;
      staffId?: number;
    }): Promise<void> => {
      const p = new URLSearchParams({
        from: opts.from,
        to: opts.to,
        format: 'csv',
      });
      if (opts.staffId) p.set('staffId', String(opts.staffId));
      const res = await authFetch(
        `${base()}/hr/staff-attendance/report?${p.toString()}`,
      );
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const cd = res.headers.get('Content-Disposition') ?? '';
      const match = cd.match(/filename="([^"]+)"/);
      const filename = match
        ? match[1]
        : `staff-attendance-report_${opts.from}_${opts.to}.csv`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    },
    zones: {
      list: () => req<AttendanceZone[]>('GET', '/hr/staff-attendance/zones'),
      create: (data: {
        name: string;
        lat: number;
        lng: number;
        radiusMeters?: number;
        boundary?: BoundaryPoint[];
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
      close: () => req<void>('DELETE', '/hr/staff-attendance/bypass'),
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
      deviceRegistrations: (
        params: {
          page?: number;
          limit?: number;
          name?: string;
          mobile?: string;
          employeeCode?: string;
          staffId?: string;
          status?: 'registered' | 'unregistered' | 'all';
        } = {},
      ) => {
        const q = new URLSearchParams();
        if (params.page) q.set('page', String(params.page));
        if (params.limit) q.set('limit', String(params.limit));
        if (params.name) q.set('name', params.name);
        if (params.mobile) q.set('mobile', params.mobile);
        if (params.employeeCode) q.set('employeeCode', params.employeeCode);
        if (params.staffId) q.set('staffId', params.staffId);
        if (params.status) q.set('status', params.status);
        return req<{
          data: DeviceRegistrationRow[];
          total: number;
          page: number;
          totalPages: number;
        }>('GET', `/hr/staff-attendance/webauthn/device-registrations?${q}`);
      },

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
      /**
       * Step 1 before self-check-in or self-check-out: fetch a one-time
       * WebAuthn auth challenge bound to the current user's enrolled credentials.
       * Pass the result to startAuthentication({ optionsJSON }) from
       * @simplewebauthn/browser, then include the assertion in the check-in/out body.
       */
      selfGetAuthChallenge: () =>
        req<any>(
          'POST',
          '/hr/staff-attendance/webauthn/self/auth-challenge',
          {},
        ),
      selfGetRegOptions: (devicePublicKey?: string) =>
        req<any>(
          'POST',
          '/hr/staff-attendance/webauthn/self/register-options',
          { devicePublicKey },
        ),
      selfVerifyReg: (
        response: any,
        deviceName?: string,
        devicePublicKey?: string,
        deviceSignature?: string,
      ) =>
        req<StaffBiometric>(
          'POST',
          '/hr/staff-attendance/webauthn/self/register-verify',
          { response, deviceName, devicePublicKey, deviceSignature },
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
    listAll: (status?: 'ALL' | 'ACTIVE' | 'HISTORY') =>
      req<EmployeeSalaryConfig[]>(
        'GET',
        status ? `/hr/employee-salary?status=${status}` : '/hr/employee-salary',
      ),
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
    generateDraft: (month: number, year: number, force?: boolean) =>
      req<PayrollRun>('POST', '/hr/payroll/runs/draft', { month, year, force }),
    deleteDraft: (runId: number) =>
      req<void>('DELETE', `/hr/payroll/runs/${runId}`),
    refreshDraft: (runId: number) =>
      req<PayrollRun>('POST', `/hr/payroll/runs/${runId}/refresh`),
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
    exportRun: async (runId: number): Promise<void> => {
      const res = await authFetch(`${base()}/hr/payroll/runs/${runId}/export`);
      if (!res.ok) throw new Error('Export failed');
      const blob = await res.blob();
      const cd = res.headers.get('Content-Disposition') ?? '';
      const match = cd.match(/filename="([^"]+)"/);
      const filename = match ? match[1] : `payroll-run-${runId}.csv`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    },
    monthlySummary: (year: number) =>
      req<PayrollMonthlySummary[]>(
        'GET',
        `/hr/payroll/reports/monthly-summary?year=${year}`,
      ),
    mySlips: (staffId?: number) => {
      const q = staffId ? `?staffId=${staffId}` : '';
      return req<PayrollEntry[]>('GET', `/hr/payroll/my-slips${q}`);
    },
  },
};
