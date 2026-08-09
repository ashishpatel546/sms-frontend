'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle } from 'lucide-react';
import { API_BASE_URL } from '@/lib/api';
import { authFetch } from '@/lib/auth';
import { useRbac } from '@/lib/rbac';

interface Summary {
  outstandingPaise: number;
  outstandingCount: number;
  overdueCount: number;
  nextDueDate: string | null;
  suspendOn: string | null;
}

function rupees(paise: number): string {
  return (paise / 100).toLocaleString('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  });
}

function formatDate(value: string | null): string {
  if (!value) return '';
  return new Date(value).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Warns the school owner about unpaid subscription invoices on the dashboard
 * home, so a suspension is never the first they hear of it.
 *
 * Shown only to ADMIN+ (ADMIN, SUPER_ADMIN): they are the only roles that can
 * see billing or act on it, and commercial terms are not staff business.
 */
export default function BillingDueBanner() {
  const rbac = useRbac();
  const [summary, setSummary] = useState<Summary | null>(null);

  useEffect(() => {
    if (!rbac.isAdmin) return;
    let cancelled = false;

    authFetch(`${API_BASE_URL}/billing/summary`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: Summary | null) => {
        if (!cancelled && data) setSummary(data);
      })
      // Billing being unreachable must never break the dashboard.
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [rbac.isAdmin]);

  if (!rbac.isAdmin) return null;
  if (!summary || summary.outstandingCount === 0) return null;

  const overdue = summary.overdueCount > 0;

  return (
    <div
      className={`rounded-xl border p-4 flex flex-col sm:flex-row sm:items-center gap-3 ${
        overdue
          ? 'border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-950/30'
          : 'border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/30'
      }`}
    >
      <AlertTriangle
        className={`w-5 h-5 shrink-0 ${overdue ? 'text-red-600' : 'text-amber-600'}`}
      />
      <div className="flex-1 min-w-0">
        <p
          className={`text-sm font-semibold ${
            overdue
              ? 'text-red-900 dark:text-red-200'
              : 'text-amber-900 dark:text-amber-200'
          }`}
        >
          {overdue
            ? `Payment overdue — ${rupees(summary.outstandingPaise)} due`
            : `Payment due — ${rupees(summary.outstandingPaise)}`}
        </p>
        <p
          className={`text-xs mt-0.5 ${
            overdue
              ? 'text-red-700 dark:text-red-300'
              : 'text-amber-800 dark:text-amber-300'
          }`}
        >
          {overdue && summary.suspendOn
            ? `Please pay before ${formatDate(summary.suspendOn)} to avoid any interruption to your school's access.`
            : summary.nextDueDate
              ? `Due by ${formatDate(summary.nextDueDate)}. Paying on time keeps everything running smoothly.`
              : 'Please settle your outstanding invoice to avoid any inconvenience.'}
        </p>
      </div>
      <Link
        href="/dashboard/billing"
        className={`shrink-0 px-4 py-2 rounded-lg text-xs font-semibold text-white ${
          overdue
            ? 'bg-red-600 hover:bg-red-700'
            : 'bg-amber-600 hover:bg-amber-700'
        }`}
      >
        Pay now
      </Link>
    </div>
  );
}
