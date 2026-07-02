"use client";

import { useState } from "react";
import { API_BASE_URL } from "@/lib/api";
import { authFetch } from "@/lib/auth";

export interface ResolvedStaff {
    id: number;
    employeeCode: number;
    firstName: string;
    lastName: string;
    mobile?: string;
}

interface Props {
    onResolved: (staff: ResolvedStaff) => void;
    onClear?: () => void;
    selectedLabel?: string | null;
    /** Show or hide individual boxes (default: all three) */
    fields?: { employeeCode?: boolean; id?: boolean; mobile?: boolean };
}

/**
 * Three explicit lookup boxes (Employee Code | Staff ID | Mobile Number).
 * Hits a single backend column per field for fast, indexed lookups.
 * Mirrors the same UX used on the kiosk and manual-mark flows.
 */
export default function StaffLookupForm({ onResolved, onClear, selectedLabel, fields }: Props) {
    const show = { employeeCode: true, id: true, mobile: true, ...(fields ?? {}) };
    const [empCode, setEmpCode] = useState("");
    const [staffId, setStaffId] = useState("");
    const [mobile, setMobile] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const reset = () => { setEmpCode(""); setStaffId(""); setMobile(""); setError(null); };

    const handleLookup = async (kind: "employeeCode" | "id" | "mobile", value: string) => {
        const v = value.trim();
        if (!v) { setError("Enter a value to search."); return; }
        setLoading(true);
        setError(null);
        try {
            const res = await authFetch(`${API_BASE_URL}/staff?${kind}=${encodeURIComponent(v)}&limit=1`);
            if (!res.ok) throw new Error("Lookup failed");
            const data = await res.json();
            const list = data?.data ?? (Array.isArray(data) ? data : []);
            const row = list[0];
            if (!row) {
                setError(`No staff found for ${kind === "employeeCode" ? "employee code" : kind === "id" ? "staff ID" : "mobile"} "${v}".`);
                return;
            }
            const staff: ResolvedStaff = {
                id: row.id,
                employeeCode: row.employeeCode,
                firstName: row.user?.firstName ?? row.firstName ?? "",
                lastName: row.user?.lastName ?? row.lastName ?? "",
                mobile: row.user?.mobile ?? row.mobile,
            };
            onResolved(staff);
        } catch (e: any) {
            setError(e?.message ?? "Lookup failed");
        } finally {
            setLoading(false);
        }
    };

    if (selectedLabel) {
        return (
            <div className="flex items-center justify-between gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                <div className="text-sm font-medium text-blue-900 truncate">{selectedLabel}</div>
                <button
                    type="button"
                    onClick={() => { reset(); onClear?.(); }}
                    className="text-blue-400 hover:text-blue-600 text-xs"
                >
                    Change
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-2.5">
            <p className="text-xs text-gray-500">
                Look up staff by exactly one of the fields below — the backend runs a direct indexed query for the value you enter.
            </p>
            {show.employeeCode && (
                <div className="flex gap-2">
                    <input
                        type="number"
                        value={empCode}
                        onChange={(e) => setEmpCode(e.target.value)}
                        placeholder="Employee code (e.g. 1001)"
                        className="flex-1 border rounded-lg px-3 py-2 text-sm"
                    />
                    <button
                        type="button"
                        onClick={() => handleLookup("employeeCode", empCode)}
                        disabled={loading || !empCode}
                        className="px-3 py-2 text-sm bg-gray-100 border rounded-lg hover:bg-gray-200 disabled:opacity-50"
                    >
                        Find
                    </button>
                </div>
            )}
            {show.id && (
                <div className="flex gap-2">
                    <input
                        type="number"
                        value={staffId}
                        onChange={(e) => setStaffId(e.target.value)}
                        placeholder="Staff ID (internal row id)"
                        className="flex-1 border rounded-lg px-3 py-2 text-sm"
                    />
                    <button
                        type="button"
                        onClick={() => handleLookup("id", staffId)}
                        disabled={loading || !staffId}
                        className="px-3 py-2 text-sm bg-gray-100 border rounded-lg hover:bg-gray-200 disabled:opacity-50"
                    >
                        Find
                    </button>
                </div>
            )}
            {show.mobile && (
                <div className="flex gap-2">
                    <input
                        type="tel"
                        value={mobile}
                        onChange={(e) => setMobile(e.target.value)}
                        placeholder="Mobile number"
                        className="flex-1 border rounded-lg px-3 py-2 text-sm"
                    />
                    <button
                        type="button"
                        onClick={() => handleLookup("mobile", mobile)}
                        disabled={loading || !mobile}
                        className="px-3 py-2 text-sm bg-gray-100 border rounded-lg hover:bg-gray-200 disabled:opacity-50"
                    >
                        Find
                    </button>
                </div>
            )}
            {error && <p className="text-xs text-red-600">{error}</p>}
            {loading && <p className="text-xs text-gray-500">Looking up…</p>}
        </div>
    );
}
