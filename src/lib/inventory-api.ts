'use client';

import { API_BASE_URL } from './api';
import { authFetch } from './auth';

/* ═══════════════════════════════════════════════════════════════════════════
   INVENTORY — the client half of `sms-backend/src/modules/inventory`.

   Mirrors the shapes the backend actually returns (see the entities and DTOs
   under sms-backend/src/modules/inventory). Every list endpoint is paginated
   as { data, total, page, limit } — no unbounded fetches anywhere here.
   ═══════════════════════════════════════════════════════════════════════════ */

export type InventoryCatalogDiscountType = 'PERCENT' | 'FLAT';
export type InventoryBuyerType = 'STUDENT' | 'STAFF' | 'WALK_IN';
export type InventorySaleStatus = 'DUE' | 'PARTIAL' | 'PAID' | 'WAIVED';
export type InventoryPaymentMode = 'CASH' | 'UPI' | 'ONLINE' | 'CHEQUE_DD' | 'OTHER';
export type InventoryBorrowerType = 'STUDENT' | 'STAFF';
export type InventoryIssuanceStatus = 'ISSUED' | 'PARTIALLY_RETURNED' | 'RETURNED' | 'OVERDUE';
export type InventoryReturnCondition = 'GOOD' | 'DAMAGED' | 'LOST';
export type InventoryStockMovementType =
  | 'PURCHASE'
  | 'ADJUSTMENT'
  | 'SALE'
  | 'ISSUE'
  | 'RETURN'
  | 'DAMAGE_WRITE_OFF'
  | 'LOST_WRITE_OFF';

export const PAYMENT_MODE_LABELS: Record<InventoryPaymentMode, string> = {
  CASH: 'Cash',
  UPI: 'UPI',
  ONLINE: 'Online',
  CHEQUE_DD: 'Cheque / DD',
  OTHER: 'Other',
};

export const PAYMENT_MODES: InventoryPaymentMode[] = ['CASH', 'UPI', 'ONLINE', 'CHEQUE_DD', 'OTHER'];

export interface InventoryCategory {
  id: number;
  name: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface InventoryItem {
  id: number;
  name: string;
  code: string;
  barcode: string | null;
  categoryId: number;
  category?: InventoryCategory;
  mrp: number | null;
  catalogDiscountType: InventoryCatalogDiscountType | null;
  catalogDiscountValue: number | null;
  sellingPrice: number;
  costPrice: number | null;
  unit: string;
  totalQty: number;
  availableQty: number;
  reorderLevel: number | null;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface InventoryItemPriceHistoryRow {
  id: number;
  mrp: number | null;
  catalogDiscountType: InventoryCatalogDiscountType | null;
  catalogDiscountValue: number | null;
  sellingPrice: number;
  costPrice: number | null;
  changedBy: { firstName: string; lastName: string } | null;
  createdAt: string;
}

export interface InventoryStockMovementRow {
  id: number;
  type: InventoryStockMovementType;
  qtyDelta: number;
  availableAfter: number;
  totalAfter: number;
  note: string | null;
  createdBy: { firstName: string; lastName: string } | null;
  createdAt: string;
}

export type InventoryLookupResult = InventoryItem;

export interface InventoryLabel {
  itemId: number;
  name: string;
  code: string;
  sellingPrice: number;
  copies: number;
  token: string;
}

interface PersonRef {
  id: number;
  user?: { firstName: string; lastName: string; mobile?: string };
}

export interface InventorySaleLine {
  id: number;
  itemId: number | null;
  itemName: string;
  itemCode: string | null;
  categoryName: string | null;
  mrpAtSale: number | null;
  unitPrice: number;
  qty: number;
  lineTotal: number;
}

export interface InventorySalePayment {
  id: number;
  amount: number;
  mode: InventoryPaymentMode;
  reference: string | null;
  remarks: string | null;
  collectedBy: { firstName: string; lastName: string } | null;
  createdAt: string;
}

export interface InventorySaleWaiver {
  id: number;
  amount: number;
  reason: string;
  permittedBy: { firstName: string; lastName: string } | null;
  createdBy: { firstName: string; lastName: string } | null;
  createdAt: string;
}

export interface InventorySale {
  id: number;
  receiptNumber: string;
  fiscalYear: string;
  buyerType: InventoryBuyerType;
  studentId: number | null;
  staffId: number | null;
  student?: PersonRef | null;
  staff?: PersonRef | null;
  buyerName: string;
  buyerMobile: string | null;
  grossAmount: number;
  discountAmount: number;
  netAmount: number;
  paidAmount: number;
  waivedAmount: number;
  balanceAmount: number;
  discountPermittedBy: { firstName: string; lastName: string } | null;
  discountReason: string | null;
  status: InventorySaleStatus;
  soldBy: { firstName: string; lastName: string } | null;
  remarks: string | null;
  lines: InventorySaleLine[];
  payments: InventorySalePayment[];
  waivers: InventorySaleWaiver[];
  createdAt: string;
  updatedAt: string;
}

export interface InventoryIssuanceReturnRow {
  id: number;
  condition: InventoryReturnCondition;
  qty: number;
  note: string | null;
  returnedBy: { firstName: string; lastName: string } | null;
  createdAt: string;
}

export interface InventoryIssuance {
  id: number;
  itemId: number;
  itemName: string;
  item?: InventoryItem;
  borrowerType: InventoryBorrowerType;
  studentId: number | null;
  staffId: number | null;
  student?: PersonRef | null;
  staff?: PersonRef | null;
  qty: number;
  qtyReturnedGood: number;
  qtyDamaged: number;
  qtyLost: number;
  issueDate: string;
  dueDate: string;
  status: InventoryIssuanceStatus;
  issuedBy: { firstName: string; lastName: string } | null;
  notes: string | null;
  returns: InventoryIssuanceReturnRow[];
  createdAt: string;
  updatedAt: string;
}

export interface InventorySettings {
  defaultLoanDays: number;
  maxLoanDays: number;
  receiptPrefix: string;
}

export interface Paginated<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export class InventoryApiError extends Error {
  readonly status: number;
  readonly featureDisabled: boolean;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'InventoryApiError';
    this.status = status;
    this.featureDisabled = status === 403 && /not enabled/i.test(message);
  }
}

function buildQuery<T extends object>(params: T): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined || value === '') continue;
    search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

async function getJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await authFetch(`${API_BASE_URL}${path}`, init);
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { message?: string };
    throw new InventoryApiError(body.message ?? 'The request failed', res.status);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

function postJson<T>(path: string, body?: unknown): Promise<T> {
  return getJson<T>(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

function patchJson<T>(path: string, body: unknown): Promise<T> {
  return getJson<T>(path, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function putJson<T>(path: string, body: unknown): Promise<T> {
  return getJson<T>(path, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

/** Downloads a CSV report and hands it to the browser as a file save. */
export async function downloadCsv(path: string, filename: string): Promise<void> {
  const res = await authFetch(`${API_BASE_URL}${path}`);
  if (!res.ok) throw new InventoryApiError('Could not export the report', res.status);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/* ── Categories ────────────────────────────────────────────────────────── */

export function fetchCategories(): Promise<InventoryCategory[]> {
  return getJson('/inventory/categories');
}

export function createCategory(name: string): Promise<InventoryCategory> {
  return postJson('/inventory/categories', { name });
}

export function updateCategory(
  id: number,
  dto: { name?: string; isActive?: boolean },
): Promise<InventoryCategory> {
  return patchJson(`/inventory/categories/${id}`, dto);
}

/* ── Items ─────────────────────────────────────────────────────────────── */

export interface ItemQuery {
  search?: string;
  categoryId?: number;
  isActive?: boolean;
  lowStock?: boolean;
  page?: number;
  limit?: number;
}

export function fetchItems(query: ItemQuery): Promise<Paginated<InventoryItem>> {
  return getJson(`/inventory/items${buildQuery(query)}`);
}

export function fetchNextItemCode(): Promise<{ code: string }> {
  return getJson('/inventory/items/next-code');
}

/** "Can I keep this code?" — answered while the operator is still in the form. */
export function checkItemCodeAvailable(
  code: string,
  excludeItemId?: number,
): Promise<{ available: boolean; reason?: string }> {
  return getJson(`/inventory/items/code-available${buildQuery({ code, excludeItemId })}`);
}

export interface ItemFormFields {
  name: string;
  categoryId: number;
  code: string;
  barcode?: string;
  mrp?: number;
  catalogDiscountType?: InventoryCatalogDiscountType;
  catalogDiscountValue?: number;
  sellingPrice: number;
  costPrice?: number;
  unit?: string;
  reorderLevel?: number;
  description?: string;
}

export function createItem(dto: ItemFormFields & { openingQty?: number }): Promise<InventoryItem> {
  return postJson('/inventory/items', dto);
}

export function updateItem(
  id: number,
  dto: Partial<ItemFormFields> & { isActive?: boolean },
): Promise<InventoryItem> {
  return patchJson(`/inventory/items/${id}`, dto);
}

export function fetchItem(id: number): Promise<InventoryItem> {
  return getJson(`/inventory/items/${id}`);
}

export function fetchPriceHistory(
  id: number,
  page = 1,
  limit = 20,
): Promise<Paginated<InventoryItemPriceHistoryRow>> {
  return getJson(`/inventory/items/${id}/price-history${buildQuery({ page, limit })}`);
}

export function adjustStock(
  id: number,
  dto: { qtyDelta: number; type: 'PURCHASE' | 'ADJUSTMENT'; note?: string },
): Promise<InventoryItem> {
  return postJson(`/inventory/items/${id}/stock`, dto);
}

export function fetchMovements(
  id: number,
  page = 1,
  limit = 20,
): Promise<Paginated<InventoryStockMovementRow>> {
  return getJson(`/inventory/items/${id}/movements${buildQuery({ page, limit })}`);
}

/** The one scan/search funnel — camera QR, camera barcode, USB wedge, manual typing. */
export function lookupItem(code: string): Promise<InventoryLookupResult> {
  return postJson('/inventory/items/lookup', { code });
}

export function generateLabels(items: { itemId: number; copies: number }[]): Promise<InventoryLabel[]> {
  return postJson('/inventory/items/labels', { items });
}

/* ── Sales ─────────────────────────────────────────────────────────────── */

export interface SaleLineInput {
  itemId: number;
  qty: number;
}

export interface CreateSalePayload {
  buyerType: InventoryBuyerType;
  studentId?: number;
  staffId?: number;
  buyerName?: string;
  buyerMobile?: string;
  lines: SaleLineInput[];
  discountAmount?: number;
  discountPermittedByUserId?: number;
  discountReason?: string;
  payment?: {
    amount: number;
    mode: InventoryPaymentMode;
    reference?: string;
    remarks?: string;
  };
  remarks?: string;
}

export function createSale(dto: CreateSalePayload): Promise<InventorySale> {
  return postJson('/inventory/sales', dto);
}

export interface SaleQuery {
  fromDate?: string;
  toDate?: string;
  status?: InventorySaleStatus;
  buyerType?: InventoryBuyerType;
  buyerMobile?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export function fetchSales(query: SaleQuery): Promise<Paginated<InventorySale>> {
  return getJson(`/inventory/sales${buildQuery(query)}`);
}

export function fetchSale(id: number): Promise<InventorySale> {
  return getJson(`/inventory/sales/${id}`);
}

export function collectSalePayment(
  id: number,
  dto: { amount: number; mode: InventoryPaymentMode; reference?: string; remarks?: string },
): Promise<InventorySale> {
  return postJson(`/inventory/sales/${id}/payments`, dto);
}

export function waiveSaleBalance(
  id: number,
  dto: { amount: number; reason: string; permittedByUserId: number },
): Promise<InventorySale> {
  return postJson(`/inventory/sales/${id}/waivers`, dto);
}

/* ── Issuances (borrow / return) ──────────────────────────────────────── */

export interface CreateIssuancePayload {
  itemId: number;
  qty: number;
  borrowerType: InventoryBorrowerType;
  studentId?: number;
  staffId?: number;
  dueDate?: string;
  notes?: string;
}

export function createIssuance(dto: CreateIssuancePayload): Promise<InventoryIssuance> {
  return postJson('/inventory/issuances', dto);
}

export interface IssuanceQuery {
  status?: InventoryIssuanceStatus;
  borrowerType?: InventoryBorrowerType;
  fromDate?: string;
  toDate?: string;
  itemName?: string;
  mobile?: string;
  page?: number;
  limit?: number;
}

export function fetchIssuances(query: IssuanceQuery): Promise<Paginated<InventoryIssuance>> {
  return getJson(`/inventory/issuances${buildQuery(query)}`);
}

export function fetchIssuance(id: number): Promise<InventoryIssuance> {
  return getJson(`/inventory/issuances/${id}`);
}

export function returnIssuance(
  id: number,
  dto: { returns: { condition: InventoryReturnCondition; qty: number }[]; note?: string },
): Promise<InventoryIssuance> {
  return postJson(`/inventory/issuances/${id}/returns`, dto);
}

/* ── Reports ──────────────────────────────────────────────────────────── */

export interface ReportQuery {
  fromDate?: string;
  toDate?: string;
  buyerMobile?: string;
  itemCode?: string;
  itemName?: string;
  categoryId?: number;
  paymentMode?: InventoryPaymentMode;
  status?: string;
  borrowerType?: InventoryBorrowerType;
  mobile?: string;
  minBalance?: number;
  buyerType?: InventoryBuyerType;
  lowStockOnly?: boolean;
  page?: number;
  limit?: number;
}

export interface InventorySummary {
  salesCount: number;
  salesValue: number;
  collected: number;
  outstanding: number;
  waived: number;
  lowStockCount: number;
}

export interface SalesReportRow {
  id: number;
  receiptNumber: string;
  createdAt: string;
  buyerType: InventoryBuyerType;
  buyerName: string;
  buyerMobile: string | null;
  grossAmount: number;
  catalogDiscount: number;
  counterDiscount: number;
  netAmount: number;
  paidAmount: number;
  waivedAmount: number;
  balanceAmount: number;
  status: InventorySaleStatus;
}

export function fetchInventorySummary(query: ReportQuery): Promise<InventorySummary> {
  return getJson(`/inventory/reports/summary${buildQuery(query)}`);
}

export function fetchSalesReport(query: ReportQuery): Promise<Paginated<SalesReportRow>> {
  return getJson(`/inventory/reports/sales${buildQuery(query)}`);
}

export function fetchPaymentsReport(query: ReportQuery): Promise<Paginated<InventorySalePayment & { sale?: InventorySale }>> {
  return getJson(`/inventory/reports/payments${buildQuery(query)}`);
}

export function fetchOutstandingReport(query: ReportQuery): Promise<Paginated<InventorySale>> {
  return getJson(`/inventory/reports/outstanding${buildQuery(query)}`);
}

export function fetchWaiversReport(query: ReportQuery): Promise<Paginated<InventorySaleWaiver & { sale?: InventorySale }>> {
  return getJson(`/inventory/reports/waivers${buildQuery(query)}`);
}

export function fetchIssuancesReport(query: ReportQuery): Promise<Paginated<InventoryIssuance>> {
  return getJson(`/inventory/reports/issuances${buildQuery(query)}`);
}

export function fetchStockReport(query: ReportQuery): Promise<Paginated<InventoryItem>> {
  return getJson(`/inventory/reports/stock${buildQuery(query)}`);
}

export function downloadReportCsv(
  report: 'sales' | 'payments' | 'outstanding' | 'waivers' | 'issuances' | 'stock',
  query: ReportQuery,
  filename: string,
): Promise<void> {
  return downloadCsv(`/inventory/reports/${report}${buildQuery({ ...query, export: 'csv' })}`, filename);
}

export function downloadSalesCsv(query: SaleQuery, filename: string): Promise<void> {
  return downloadCsv(`/inventory/sales${buildQuery({ ...query, export: 'csv' })}`, filename);
}

export function downloadIssuancesCsv(query: IssuanceQuery, filename: string): Promise<void> {
  return downloadCsv(`/inventory/issuances${buildQuery({ ...query, export: 'csv' })}`, filename);
}

/* ── Settings ─────────────────────────────────────────────────────────── */

export function fetchInventorySettings(): Promise<InventorySettings> {
  return getJson('/inventory/settings');
}

export function updateInventorySettings(dto: Partial<InventorySettings>): Promise<InventorySettings> {
  return putJson('/inventory/settings', dto);
}

/* ── Display helpers ──────────────────────────────────────────────────── */

export function personName(ref: PersonRef | null | undefined): string {
  if (!ref?.user) return '—';
  return `${ref.user.firstName} ${ref.user.lastName}`.trim();
}

export function isLowStock(item: InventoryItem): boolean {
  return item.reorderLevel != null && item.availableQty <= item.reorderLevel;
}

/* ── My Inventory (self-service: parents, students, staff) ─────────────── */

export function fetchMySales(page = 1, limit = 20): Promise<Paginated<InventorySale>> {
  return getJson(`/inventory/my/sales${buildQuery({ page, limit })}`);
}

export function fetchMyIssuances(page = 1, limit = 20): Promise<Paginated<InventoryIssuance>> {
  return getJson(`/inventory/my/issuances${buildQuery({ page, limit })}`);
}

export function issuanceOutstanding(issuance: InventoryIssuance): number {
  return issuance.qty - issuance.qtyReturnedGood - issuance.qtyDamaged - issuance.qtyLost;
}

/** Extracts a human-readable message from a caught error, for toast.error(). */
export function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}
