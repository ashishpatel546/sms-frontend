'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, BookUp, Boxes, IndianRupee, PackageX, ShoppingCart } from 'lucide-react';
import { errorMessage, lookupItem, type InventoryItem } from '@/lib/inventory-api';

/* ═══════════════════════════════════════════════════════════════════════════
   AN INVENTORY ITEM AT THE SHARED SCANNER

   Rendered by the gate scanner when an `INV1:` label — or any code that turns
   out to be stock rather than a pass — is decoded. The same phone that checks
   a visitor in is the one a storekeeper has in their pocket, so "what is this
   and how many are left" has to be answerable without walking to a desk.

   Deliberately read-only. Selling takes a buyer, a payment and an authoriser;
   none of that belongs in a one-handed queue-side panel. So this answers the
   question and then hands off to the counter screens.
   ═══════════════════════════════════════════════════════════════════════════ */

interface InventoryScanPanelProps {
  /** Whatever the camera decoded: an `INV1:` token, a barcode, or a typed code. */
  code: string;
  /**
   * Already-resolved item, when the caller had to look it up to decide this
   * panel was the right one. Skips a second identical request.
   */
  initialItem?: InventoryItem | null;
  /** Scan the next code. */
  onDone: () => void;
  /** Back to the scanner without another scan. */
  onCancel: () => void;
}

export default function InventoryScanPanel({
  code,
  initialItem = null,
  onDone,
  onCancel,
}: InventoryScanPanelProps) {
  const [item, setItem] = useState<InventoryItem | null>(initialItem);
  const [error, setError] = useState('');

  useEffect(() => {
    if (initialItem) return;
    let cancelled = false;
    lookupItem(code)
      .then((data) => {
        if (!cancelled) setItem(data);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(errorMessage(e, 'This code did not match any item'));
      });
    return () => {
      cancelled = true;
    };
  }, [code, initialItem]);

  if (error) {
    return (
      <div className="flex flex-col items-center gap-5 py-8 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-red-500/20">
          <PackageX className="h-10 w-10 text-red-400" aria-hidden />
        </div>
        <div className="space-y-1 px-2">
          <h2 className="text-xl font-bold text-white">Not an inventory item</h2>
          <p className="text-sm text-red-400">{error}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="rounded-xl bg-slate-800 px-6 py-3 font-semibold text-white transition-all hover:bg-slate-700"
          >
            Go Back
          </button>
          <button
            onClick={onDone}
            className="rounded-xl bg-indigo-600 px-6 py-3 font-semibold text-white transition-all hover:bg-indigo-500"
          >
            Scan Another
          </button>
        </div>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="flex flex-col items-center gap-4 py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
        <p className="text-sm text-slate-400">Looking up item…</p>
      </div>
    );
  }

  const outOfStock = item.availableQty <= 0;
  const low = !outOfStock && item.reorderLevel != null && item.availableQty <= item.reorderLevel;

  return (
    <div className="space-y-4">
      <div className="space-y-3 rounded-2xl border border-slate-800 bg-slate-900 p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-500/20">
            <Boxes className="h-5 w-5 text-orange-400" aria-hidden />
          </div>
          <div className="min-w-0">
            <h3 className="text-base font-bold text-white">{item.name}</h3>
            <p className="font-mono text-sm text-slate-400">{item.code}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 border-t border-slate-800 pt-3">
          <div>
            <p className="text-xs text-slate-500">Available</p>
            <p
              className={`text-lg font-bold ${
                outOfStock ? 'text-red-400' : low ? 'text-amber-400' : 'text-emerald-300'
              }`}
            >
              {item.availableQty}
              <span className="ml-1 text-xs font-normal text-slate-500">
                of {item.totalQty} {item.unit}
              </span>
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Price</p>
            <p className="flex items-center text-lg font-bold text-white">
              <IndianRupee className="h-4 w-4" aria-hidden />
              {item.sellingPrice}
            </p>
            {item.mrp != null && item.mrp > item.sellingPrice && (
              <p className="text-xs text-slate-500 line-through">₹{item.mrp}</p>
            )}
          </div>
        </div>

        {item.category?.name && (
          <p className="text-sm text-slate-400">
            <span className="text-slate-500">Category:</span> {item.category.name}
          </p>
        )}

        {(outOfStock || low) && (
          <div
            className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm ${
              outOfStock
                ? 'border-red-500/20 bg-red-500/10 text-red-300'
                : 'border-amber-500/20 bg-amber-500/10 text-amber-300'
            }`}
          >
            <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
            {outOfStock ? 'Out of stock' : `Low stock — reorder level is ${item.reorderLevel}`}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Link
          href="/dashboard/inventory/sell"
          className="flex items-center justify-center gap-2 rounded-xl bg-indigo-600 py-3 text-sm font-semibold text-white transition-all hover:bg-indigo-500"
        >
          <ShoppingCart className="h-4 w-4" aria-hidden /> Sell
        </Link>
        <Link
          href="/dashboard/inventory/issuances"
          className="flex items-center justify-center gap-2 rounded-xl bg-slate-800 py-3 text-sm font-semibold text-white transition-all hover:bg-slate-700"
        >
          <BookUp className="h-4 w-4" aria-hidden /> Issue
        </Link>
      </div>

      <div className="flex gap-2">
        <button
          onClick={onCancel}
          className="flex-1 rounded-xl bg-slate-800 py-2.5 text-sm font-medium text-white transition-all hover:bg-slate-700"
        >
          Done
        </button>
        <button
          onClick={onDone}
          className="flex-1 rounded-xl bg-indigo-600 py-2.5 text-sm font-semibold text-white transition-all hover:bg-indigo-500"
        >
          📷 Scan Another
        </button>
      </div>
    </div>
  );
}
