'use client';

import { API_BASE_URL } from './api';
import { authFetch } from './auth';

/* ═══════════════════════════════════════════════════════════════════════════
   TRANSPORT — the client half of `sms-backend/src/modules/transport`.

   Shapes mirror what the backend returns. History rows (crew, route ↔
   vehicle, student assignments) are never deleted server-side: a change
   closes the open row and starts a new one, so every list here can show
   who did what, when.
   ═══════════════════════════════════════════════════════════════════════════ */

export type VehicleType = 'BUS' | 'MINI_BUS' | 'VAN' | 'CAB' | 'AUTO';
export const VEHICLE_TYPES: VehicleType[] = ['BUS', 'MINI_BUS', 'VAN', 'CAB', 'AUTO'];
export type CrewRole = 'DRIVER' | 'ASSISTANT';
export type RecordStatus = 'ACTIVE' | 'OBSOLETE';
export type JoinBilling = 'FULL' | 'PRORATED';
export type LeaveBilling = 'FULL' | 'PRORATED';
export type ExemptionType = 'PERCENT' | 'FLAT';
export type ExemptionStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type AssignmentState = 'CURRENT' | 'UPCOMING' | 'ENDED' | 'CHANGED';
export type VehicleDocument = 'FITNESS' | 'INSURANCE' | 'PUC' | 'PERMIT';

export interface TransportSettings {
  id: number;
  feeCategoryId: number | null;
  defaultJoinBilling: JoinBilling;
  leaveBilling: LeaveBilling;
  exemptionApproverRole: 'SUPER_ADMIN' | 'ADMIN' | 'SUB_ADMIN';
  expiryReminderDays: number;
}

export interface CrewSummary {
  crewId: number;
  staffId: number;
  name: string;
  mobile: string | null;
  since: string;
}

export interface Vehicle {
  id: number;
  registrationNumber: string;
  type: VehicleType;
  fleetNumber: string | null;
  makeModel: string | null;
  capacity: number;
  gpsDeviceId: string | null;
  fitnessExpiry: string | null;
  insuranceExpiry: string | null;
  pucExpiry: string | null;
  permitExpiry: string | null;
  notes: string | null;
  isActive: boolean;
  driver?: CrewSummary | null;
  assistant?: CrewSummary | null;
  routes?: { id: number; routeNumber: string; name: string }[];
}

export type VehicleInput = Omit<Vehicle, 'id' | 'driver' | 'assistant' | 'routes'>;

export interface CrewHistoryRow extends Partial<CrewSummary> {
  id: number;
  role: CrewRole;
  status: RecordStatus;
  startDate: string;
  endDate: string | null;
  changeReason: string | null;
  changedBy: string | null;
}

export interface CrewCandidate {
  staffId: number;
  name: string;
  mobile: string | null;
  role: string;
}

export interface Stop {
  id: number;
  routeId: number;
  sequence: number;
  name: string;
  landmark: string | null;
  latitude: string | null;
  longitude: string | null;
  pickupTime: string | null;
  dropTime: string | null;
  monthlyFee: string | null;
  isActive: boolean;
}

export interface StopInput {
  name: string;
  sequence?: number;
  landmark?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  pickupTime?: string | null;
  dropTime?: string | null;
  monthlyFee?: number | null;
  isActive?: boolean;
}

export interface Route {
  id: number;
  routeNumber: string;
  name: string;
  morningStart: string | null;
  eveningStart: string | null;
  notes: string | null;
  isActive: boolean;
  stops: Stop[];
  vehicle?: {
    id: number;
    registrationNumber: string;
    fleetNumber: string | null;
    type: VehicleType;
    capacity: number;
    since: string;
  } | null;
  riders?: number;
}

export type RouteInput = Pick<Route, 'routeNumber' | 'name' | 'morningStart' | 'eveningStart' | 'notes'> & {
  isActive?: boolean;
};

export interface RouteVehicleHistoryRow {
  id: number;
  status: RecordStatus;
  startDate: string;
  endDate: string | null;
  changeReason: string | null;
  vehicle: { id: number; registrationNumber: string; fleetNumber: string | null };
  changedBy: string | null;
}

export interface Exemption {
  type: ExemptionType;
  value: number;
  monthlyAmount: number;
  netMonthlyFee: number;
  reason: string | null;
  status: ExemptionStatus | null;
  requestedBy: string | null;
  decidedBy: string | null;
  decidedAt: string | null;
  decisionNote: string | null;
}

export interface Assignment {
  id: number;
  state: AssignmentState;
  student: {
    id: number;
    name: string;
    admissionNumber: string | null;
    className: string | null;
    sectionName: string | null;
  } | null;
  pickupRoute: { id: number; routeNumber: string; name: string };
  pickupStop: { id: number; name: string; time: string | null };
  dropRoute: { id: number; routeNumber: string; name: string };
  dropStop: { id: number; name: string; time: string | null };
  sameEveningRoute: boolean;
  dropSameAsPickup: boolean;
  startDate: string;
  endDate: string | null;
  endReason: 'ENDED' | 'CHANGED' | null;
  previousAssignmentId: number | null;
  monthlyFee: number;
  joinBilling: JoinBilling;
  exemption: Exemption | null;
  remarks: string | null;
  createdAt: string;
}

/** Route, stops and fee — shared by "assign" and "change". */
export interface TransportPlanInput {
  pickupRouteId: number;
  pickupStopId: number;
  sameEveningRoute: boolean;
  dropSameAsPickup: boolean;
  dropRouteId?: number;
  dropStopId?: number;
  monthlyFee: number;
  exemption: boolean;
  exemptionType?: ExemptionType;
  exemptionValue?: number;
  exemptionReason?: string;
  remarks?: string;
}

export interface AssignInput extends TransportPlanInput {
  studentId: number;
  startDate: string;
  joinBilling: JoinBilling;
  replaceManualFee?: boolean;
}

export interface Paged<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export interface ExpiringDocument {
  vehicleId: number;
  registrationNumber: string;
  fleetNumber: string | null;
  document: VehicleDocument;
  expiresOn: string;
  daysLeft: number;
}

export interface TransportOverview {
  vehicles: number;
  routes: number;
  riders: number;
  pendingExemptions: number;
  routesWithoutVehicle: number;
  overCapacity: { routeId: number; routeNumber: string; riders: number; capacity: number }[];
  documents: ExpiringDocument[];
  reminderDays: number;
}

export interface RouteLeg {
  route: { id: number; routeNumber: string; name: string };
  vehicle: { id: number; registrationNumber: string; fleetNumber: string | null; type: VehicleType } | null;
  driver: CrewSummary | null;
  assistant: CrewSummary | null;
  stop: {
    id: number;
    name: string;
    landmark: string | null;
    latitude: number | null;
    longitude: number | null;
    time: string | null;
  };
}

/** What a parent (or staff on the student profile) sees. */
export type StudentTransport =
  | { assigned: false }
  | {
      assigned: true;
      startsOn: string;
      endsOn: string | null;
      morning: RouteLeg;
      evening: RouteLeg;
      monthlyFee: number;
      exemption: Exemption | null;
    };

export interface CrewDuty {
  vehicles: {
    role: CrewRole;
    vehicle: { id: number; registrationNumber: string; fleetNumber: string | null; type: VehicleType; capacity: number };
    crew: (CrewSummary & { role: CrewRole })[];
    routes: {
      id: number;
      routeNumber: string;
      name: string;
      morningStart: string | null;
      eveningStart: string | null;
      stops: {
        id: number;
        sequence: number;
        name: string;
        landmark: string | null;
        pickupTime: string | null;
        dropTime: string | null;
        boarding: number;
        alighting: number;
      }[];
    }[];
  }[];
}

/* ── Plumbing ──────────────────────────────────────────────────────────── */

export class TransportApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await authFetch(`${API_BASE_URL}${path}`, init);
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as {
      message?: string | string[] | { message?: string; code?: string };
      code?: string;
    };
    // Nest puts a thrown object under `message`; validation errors arrive as a list.
    const nested = typeof body.message === 'object' && !Array.isArray(body.message) ? body.message : null;
    const message = nested?.message
      ?? (Array.isArray(body.message) ? body.message[0] : (body.message as string | undefined))
      ?? 'The request failed';
    throw new TransportApiError(message, res.status, nested?.code ?? body.code);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

const send = <T,>(method: string, path: string, body?: unknown) =>
  request<T>(path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

function qs(params: Record<string, string | number | undefined | null>): string {
  const search = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') search.set(k, String(v));
  }
  const s = search.toString();
  return s ? `?${s}` : '';
}

export function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

/* ── Settings & overview ───────────────────────────────────────────────── */

export const fetchSettings = () => request<TransportSettings>('/transport/settings');
export const updateSettings = (body: Partial<TransportSettings>) =>
  send<TransportSettings>('PATCH', '/transport/settings', body);
export const fetchOverview = () => request<TransportOverview>('/transport/overview');

/* ── Vehicles & crew ───────────────────────────────────────────────────── */

export const fetchVehicles = () => request<Vehicle[]>('/transport/vehicles');
export const createVehicle = (body: Partial<VehicleInput>) => send<Vehicle>('POST', '/transport/vehicles', body);
export const updateVehicle = (id: number, body: Partial<VehicleInput>) =>
  send<Vehicle>('PATCH', `/transport/vehicles/${id}`, body);
export const fetchCrewHistory = (vehicleId: number) =>
  request<CrewHistoryRow[]>(`/transport/vehicles/${vehicleId}/crew`);
export const assignCrew = (
  vehicleId: number,
  body: { role: CrewRole; staffId: number; effectiveFrom: string; reason?: string },
) => send('POST', `/transport/vehicles/${vehicleId}/crew`, body);
export const endCrew = (vehicleId: number, body: { role: CrewRole; lastDay: string; reason?: string }) =>
  send('POST', `/transport/vehicles/${vehicleId}/crew/end`, body);
export const fetchCrewCandidates = (role?: CrewRole) =>
  request<CrewCandidate[]>(`/transport/crew-candidates${qs({ role })}`);

/* ── Routes & stops ────────────────────────────────────────────────────── */

export const fetchRoutes = () => request<Route[]>('/transport/routes');
export const fetchRoute = (id: number) => request<Route>(`/transport/routes/${id}`);
export const createRoute = (body: RouteInput) => send<Route>('POST', '/transport/routes', body);
export const updateRoute = (id: number, body: Partial<RouteInput>) =>
  send<Route>('PATCH', `/transport/routes/${id}`, body);
export const fetchRouteVehicleHistory = (routeId: number) =>
  request<RouteVehicleHistoryRow[]>(`/transport/routes/${routeId}/vehicles`);
export const assignRouteVehicle = (
  routeId: number,
  body: { vehicleId: number; effectiveFrom: string; reason?: string },
) => send('POST', `/transport/routes/${routeId}/vehicle`, body);
export const addStop = (routeId: number, body: StopInput) => send<Stop>('POST', `/transport/routes/${routeId}/stops`, body);
export const updateStop = (routeId: number, stopId: number, body: Partial<StopInput>) =>
  send<Stop>('PATCH', `/transport/routes/${routeId}/stops/${stopId}`, body);
export const removeStop = (routeId: number, stopId: number) =>
  send<{ removed: boolean; deactivated: boolean }>('DELETE', `/transport/routes/${routeId}/stops/${stopId}`);
export const reorderStops = (routeId: number, stopIds: number[]) =>
  send<Route>('PUT', `/transport/routes/${routeId}/stops/order`, { stopIds });

/* ── Student transport ─────────────────────────────────────────────────── */

export interface AssignmentQuery {
  routeId?: number;
  status?: 'current' | 'upcoming' | 'ended' | 'all';
  exemptionStatus?: ExemptionStatus;
  search?: string;
  page?: number;
  limit?: number;
}

export const fetchAssignments = (q: AssignmentQuery) =>
  request<Paged<Assignment>>(`/transport/assignments${qs({ ...q })}`);
export const assignTransport = (body: AssignInput) => send<Assignment>('POST', '/transport/assignments', body);
export const changeTransport = (id: number, body: TransportPlanInput & { effectiveFrom: string }) =>
  send<Assignment>('POST', `/transport/assignments/${id}/change`, body);
export const endTransport = (id: number, body: { lastDay: string; reason?: string }) =>
  send<Assignment>('POST', `/transport/assignments/${id}/end`, body);
export const fetchPendingExemptions = () => request<Assignment[]>('/transport/exemptions/pending');
export const decideExemption = (id: number, body: { approve: boolean; note?: string }) =>
  send<Assignment>('POST', `/transport/assignments/${id}/exemption-decision`, body);
export const fetchStudentTransport = (studentId: number) =>
  request<{ current: StudentTransport; history: Assignment[] }>(`/transport/students/${studentId}`);

/* ── Parent & crew ─────────────────────────────────────────────────────── */

export const fetchChildTransport = (studentId: number) =>
  request<StudentTransport>(`/parent/transport/student/${studentId}`);
export const fetchCrewDuty = () => request<CrewDuty>('/transport/crew/me');

/* ── Small helpers ─────────────────────────────────────────────────────── */

/** "07:05:00" → "07:05". */
export const hhmm = (t: string | null | undefined) => (t ? t.slice(0, 5) : null);

/** Today in IST as YYYY-MM-DD (the backend's calendar). */
export function todayIst(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
}

/** Monthly exemption for a full month, as the backend computes it. */
export function exemptionAmount(fee: number, type: ExemptionType | undefined, value: number | undefined): number {
  if (!type || !value || !fee) return 0;
  return type === 'PERCENT' ? Math.round(fee * Math.min(value, 100)) / 100 : Math.min(fee, value);
}

/** Display name for a vehicle: fleet number with registration, or registration alone. */
export function vehicleName(v: { fleetNumber: string | null; registrationNumber: string }): string {
  return v.fleetNumber ? `${v.fleetNumber} · ${v.registrationNumber}` : v.registrationNumber;
}

/* ── Trips (phase 2) ───────────────────────────────────────────────────────
   A trip is one run of a route on one day (morning or evening). A child's
   state on it is their latest mark that was not undone. */

export type TripLeg = 'MORNING' | 'EVENING';
export type TripStatus = 'IN_PROGRESS' | 'COMPLETED';
export type TripEventType =
  | 'BOARDED'
  | 'NO_SHOW'
  | 'ARRIVED_SCHOOL'
  | 'NOT_TRAVELLING'
  | 'DROPPED'
  | 'HANDED_TO_GUARDIAN'
  | 'HANDED_VIA_PICKUP';
export type SkipReason = 'PARENT_NOTICE' | 'ON_LEAVE' | 'ABSENT_TODAY' | 'COLLECTED_AT_GATE';

export interface TripCounts {
  total: number;
  expected: number;
  notExpected: number;
  onBoard: number;
  done: number;
  pending: number;
  noShow: number;
}

export interface TripRun {
  route: { id: number; routeNumber: string; name: string; morningStart: string | null; eveningStart: string | null };
  vehicle: { id: number; registrationNumber: string; fleetNumber: string | null; type: VehicleType } | null;
  driver: CrewSummary | null;
  assistant: CrewSummary | null;
  legs: {
    leg: TripLeg;
    trip: { id: number; status: TripStatus; startedAt: string; endedAt: string | null; forceClosed: boolean } | null;
    counts: TripCounts;
  }[];
}

export interface TripStudent {
  studentId: number;
  assignmentId: number | null;
  name: string;
  className: string | null;
  sectionName: string | null;
  admissionNumber: string | null;
  stopId: number | null;
  skip: SkipReason | null;
  skipNote: string | null;
  state: TripEventType | null;
  stateAt: string | null;
  handedToName: string | null;
  lastEventId: number | null;
}

export interface TripEvent {
  id: number;
  studentId: number;
  studentName: string;
  type: TripEventType;
  at: string;
  stopName: string | null;
  handedToName: string | null;
  handedToRelation: string | null;
  by: string | null;
  voided: boolean;
}

export interface TripDetail {
  id: number;
  date: string;
  leg: TripLeg;
  status: TripStatus;
  startedAt: string;
  endedAt: string | null;
  startedBy: string | null;
  endedBy: string | null;
  forceClosed: boolean;
  closeNote: string | null;
  route: { id: number; routeNumber: string; name: string };
  vehicle: { id: number; registrationNumber: string; fleetNumber: string | null; type: VehicleType; capacity: number } | null;
  driver: { staffId: number; name: string; mobile: string | null } | null;
  assistant: { staffId: number; name: string; mobile: string | null } | null;
  stops: { id: number; name: string; landmark: string | null; sequence: number; time: string | null; isActive: boolean }[];
  students: TripStudent[];
  counts: TripCounts;
  events: TripEvent[];
  pickupEnabled: boolean;
  canOperate: boolean;
}

export type TripAlert =
  | { type: 'TRIP_RUNNING_LONG' | 'CHILDREN_ON_BOARD'; tripId: number; leg: TripLeg; date: string; routeNumber: string; vehicle: string; since: string }
  | { type: 'FORCE_CLOSED'; tripId: number; leg: TripLeg; date: string; routeNumber: string; vehicle: string; note: string | null }
  | { type: 'BOARDED_BUT_ABSENT'; tripId: number; leg: TripLeg; date: string; routeNumber: string; vehicle: string; studentId: number; studentName: string };

export interface TripLogRow {
  id: number;
  date: string;
  leg: TripLeg;
  status: TripStatus;
  startedAt: string;
  endedAt: string | null;
  forceClosed: boolean;
  route: { id: number; routeNumber: string; name: string };
  vehicle: string;
  boarded: number;
  notTravelled: number;
  onBoard: number;
}

export interface Guardians {
  studentName: string;
  studentPhotoUrl: string | null;
  people: { relation: 'FATHER' | 'MOTHER' | 'GUARDIAN'; label: string | null; name: string; phone: string | null; photoUrl: string | null }[];
}

export interface PickupPass {
  id: string;
  studentId: number;
  studentName: string;
  className: string;
  sectionName: string;
  authorizedPersonName: string;
  authorizedPersonMobile: string | null;
  notes: string | null;
  expiresAt: string;
  parentName: string;
}

export interface ChildDay {
  date: string;
  legs: {
    leg: TripLeg;
    route: { routeNumber: string; name: string } | null;
    stop: { name: string; time: string | null } | null;
    trip: { status: TripStatus; startedAt: string; endedAt: string | null } | null;
    state: TripEventType | null;
    events: { type: TripEventType; at: string; stopName: string | null; handedToName: string | null }[];
    notTravelling: { reason: string | null } | null;
    canChangeNotice: boolean;
  }[];
  notices: { date: string; leg: TripLeg; reason: string | null }[];
}

export interface Position {
  latitude?: number;
  longitude?: number;
}

export const fetchTripsToday = () => request<{ date: string; runs: TripRun[] }>('/transport/trips/today');
export const startTrip = (routeId: number, leg: TripLeg) =>
  send<TripDetail>('POST', '/transport/trips/start', { routeId, leg });
export const fetchTrip = (id: number) => request<TripDetail>(`/transport/trips/${id}`);
export const recordTripEvent = (
  id: number,
  body: {
    type: Exclude<TripEventType, 'HANDED_VIA_PICKUP'>;
    studentIds: number[];
    handedToName?: string;
    handedToRelation?: string;
    note?: string;
  } & Position,
) => send<TripDetail>('POST', `/transport/trips/${id}/events`, body);
export const undoTripEvent = (id: number, eventId: number) =>
  send<TripDetail>('POST', `/transport/trips/${id}/events/${eventId}/undo`);
export const fetchGuardians = (id: number, studentId: number) =>
  request<Guardians>(`/transport/trips/${id}/students/${studentId}/guardians`);
export const verifyTripPickup = (id: number, token: string) =>
  send<PickupPass>('POST', `/transport/trips/${id}/pickup/verify`, { token });
export const confirmTripPickup = (
  id: number,
  body: { token: string; studentId: number; enteredName: string; enteredPin: string } & Position,
) => send<TripDetail>('POST', `/transport/trips/${id}/pickup/confirm`, body);
export const completeTrip = (id: number, body: { force?: boolean; note?: string } = {}) =>
  send<TripDetail>('POST', `/transport/trips/${id}/complete`, body);

export const fetchTripBoard = (date?: string) =>
  request<{ date: string; runs: TripRun[]; alerts: TripAlert[] }>(`/transport/trip-reports/board${qs({ date })}`);
export const fetchTripLog = (q: { from?: string; to?: string; routeId?: number; leg?: TripLeg; page?: number; limit?: number }) =>
  request<Paged<TripLogRow>>(`/transport/trip-reports/log${qs(q)}`);

export const fetchChildDay = (studentId: number) => request<ChildDay>(`/parent/transport/student/${studentId}/day`);
export const setNotTravelling = (studentId: number, body: { date: string; legs: TripLeg[]; reason?: string }) =>
  send<ChildDay>('POST', `/parent/transport/student/${studentId}/not-travelling`, body);
export const withdrawNotTravelling = (studentId: number, body: { date: string; legs: TripLeg[] }) =>
  send<ChildDay>('POST', `/parent/transport/student/${studentId}/not-travelling/withdraw`, body);

/** States after which nothing more happens to the child on this leg. */
export function isSettled(leg: TripLeg, s: TripEventType | null): boolean {
  if (s === null || s === 'BOARDED') return false;
  return leg === 'MORNING' ? s === 'ARRIVED_SCHOOL' || s === 'NO_SHOW' : true;
}

/** "HH:MM" in school time for an ISO instant. */
export function istClock(iso: string, locale = 'en-IN'): string {
  return new Date(iso).toLocaleTimeString(locale, { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' });
}

/* ── Live tracking (phase 3) ───────────────────────────────────────────────
   The crew phone posts positions during a trip. The school sees every
   vehicle; a parent sees only their child's bus, and only while the child
   is waiting for it or on it (the server decides). */

export interface LivePosition {
  tripId: number | null;
  latitude: number;
  longitude: number;
  accuracy: number | null;
  speed: number | null;
  heading: number | null;
  recordedAt: string;
  /** PHONE = the trip screen, APP = the tracking app (Traccar Client). */
  source?: 'PHONE' | 'APP';
  stale: boolean;
}

export interface MapStop {
  id: number;
  name: string;
  sequence: number;
  latitude: number;
  longitude: number;
}

export interface LiveBoard {
  staleSeconds: number;
  vehicles: {
    vehicle: { id: number; registrationNumber: string; fleetNumber: string | null; type: VehicleType };
    tracker: { lastSeenAt: string | null; battery: number | null; active: boolean };
    live: LivePosition | null;
    trip: {
      id: number;
      leg: TripLeg;
      startedAt: string;
      route: { id: number; routeNumber: string; name: string };
      sharing: boolean;
      onBoard: number;
      pending: number;
    } | null;
  }[];
  routes: { routeId: number; stops: MapStop[] }[];
}

export interface TripTrack {
  tripId: number;
  status: TripStatus;
  staleSeconds: number;
  points: { latitude: number; longitude: number; at: string }[];
  stops: MapStop[];
  live: LivePosition | null;
}

export type ChildLive =
  | {
      available: true;
      leg: TripLeg;
      state: TripEventType | null;
      vehicle: string;
      position: { latitude: number; longitude: number; accuracy: number | null; heading: number | null; speed: number | null };
      recordedAt: string;
      stale: boolean;
      stop: { name: string; latitude: number | null; longitude: number | null } | null;
      distanceM: number | null;
      etaMinutes: number | null;
    }
  | { available: false; reason: 'NO_TRIP' | 'NOT_ON_TRIP' | 'NOT_TRAVELLING' | 'DONE' | 'NO_SIGNAL'; leg?: TripLeg };

export interface LocationPoint {
  latitude: number;
  longitude: number;
  accuracy?: number;
  speed?: number;
  heading?: number;
  at: string;
}

export const reportLocation = (tripId: number, points: LocationPoint[]) =>
  send<{ accepted: number; live: boolean; trackerActive: boolean }>('POST', `/transport/live/trips/${tripId}/location`, { points });

/** A vehicle's tracking-app (Traccar Client) setup. `key` is its device identifier. */
export interface TrackerSetup {
  vehicleId: number;
  vehicle: string;
  key: string;
  lastSeenAt: string | null;
  battery: number | null;
  /** Reported in the last 90 s. */
  active: boolean;
}
export const fetchTripTracker = (tripId: number) => request<TrackerSetup>(`/transport/live/trips/${tripId}/tracker`);
export const fetchVehicleTracker = (vehicleId: number) => request<TrackerSetup>(`/transport/live/vehicles/${vehicleId}/tracker`);
export const rotateVehicleTracker = (vehicleId: number) => send<TrackerSetup>('POST', `/transport/live/vehicles/${vehicleId}/tracker/rotate`);
export const revokeVehicleTracker = (vehicleId: number) => send<{ revoked: true }>('DELETE', `/transport/live/vehicles/${vehicleId}/tracker`);
export const fetchLiveBoard = () => request<LiveBoard>('/transport/live/board');
export const fetchTripTrack = (tripId: number) => request<TripTrack>(`/transport/live/trips/${tripId}/track`);
export const fetchChildLive = (studentId: number) => request<ChildLive>(`/parent/transport/student/${studentId}/live`);

/** "45 s" / "3 min" since an ISO instant. */
export function secondsSince(iso: string, now = Date.now()): number {
  return Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
}
