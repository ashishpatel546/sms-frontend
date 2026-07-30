"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { API_BASE_URL } from "@/lib/api";
import { authFetch } from "@/lib/auth";

export interface StaffResult {
    id: number;
    employeeCode: number;
    firstName: string;
    lastName: string;
    mobile?: string;
    designation?: { name: string };
}

interface Props {
    value: number | null;
    onChange: (staffId: number | null, staff: StaffResult | null) => void;
    label?: string;
    placeholder?: string;
    required?: boolean;
    className?: string;
}

export default function StaffPicker({
    value,
    onChange,
    label = "Staff Member",
    placeholder = "Search by name or mobile...",
    required = false,
    className = "",
}: Props) {
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<StaffResult[]>([]);
    const [selected, setSelected] = useState<StaffResult | null>(null);
    const [loading, setLoading] = useState(false);
    const [open, setOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    // If value is set externally but selected is not yet loaded, fetch the staff record
    useEffect(() => {
        if (value && !selected) {
            authFetch(`${API_BASE_URL}/staff?id=${value}&limit=1`)
                .then(r => r.ok ? r.json() : null)
                .then(data => {
                    const item = data?.data?.[0] ?? (Array.isArray(data) ? data[0] : null);
                    if (item) setSelected(item);
                })
                .catch(() => { });
        }
        if (!value) {
            setSelected(null);
            setQuery("");
        }
    }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

    const doSearch = useCallback(async (q: string) => {
        if (!q.trim()) {
            setResults([]);
            setOpen(false);
            return;
        }
        setLoading(true);
        try {
            // Detect if query is numeric → search by mobile, otherwise by name
            const isMobile = /^\d+$/.test(q.trim());
            const params = isMobile
                ? `mobile=${encodeURIComponent(q.trim())}&limit=10`
                : `search=${encodeURIComponent(q.trim())}&limit=10`;
            const res = await authFetch(`${API_BASE_URL}/staff?${params}`);
            if (res.ok) {
                const data = await res.json();
                const list: StaffResult[] = data?.data ?? (Array.isArray(data) ? data : []);
                setResults(list);
                setOpen(list.length > 0);
            }
        } catch {
            setResults([]);
        } finally {
            setLoading(false);
        }
    }, []);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setQuery(val);
        // Clear selection if user modifies text
        if (selected) {
            setSelected(null);
            onChange(null, null);
        }
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => doSearch(val), 300);
    };

    const handleSelect = (staff: StaffResult) => {
        setSelected(staff);
        setQuery("");
        setOpen(false);
        setResults([]);
        onChange(staff.id, staff);
    };

    const handleClear = () => {
        setSelected(null);
        setQuery("");
        setResults([]);
        setOpen(false);
        onChange(null, null);
    };

    return (
        <div ref={containerRef} className={`relative ${className}`}>
            {label && (
                <label className="block mb-1 text-sm font-medium text-gray-900">
                    {label} {required && <span className="text-red-500">*</span>}
                </label>
            )}

            {selected ? (
                /* Selected state — show badge with clear button */
                <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-blue-900 truncate">
                            {selected.firstName} {selected.lastName}
                        </p>
                        <p className="text-xs text-blue-600">
                            EMP-{selected.employeeCode}
                            {selected.designation?.name ? ` · ${selected.designation.name}` : ""}
                            {selected.mobile ? ` · ${selected.mobile}` : ""}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={handleClear}
                        className="shrink-0 text-blue-400 hover:text-blue-600 p-0.5"
                        title="Clear selection"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
            ) : (
                /* Search input */
                <div className="relative">
                    <input
                        type="text"
                        value={query}
                        onChange={handleInputChange}
                        placeholder={placeholder}
                        required={required && !selected}
                        className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-brand/40 focus:border-brand block w-full p-2.5 pr-8"
                    />
                    {loading && (
                        <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
                            <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                        </div>
                    )}
                </div>
            )}

            {/* Dropdown results */}
            {open && results.length > 0 && (
                <ul className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-56 overflow-y-auto">
                    {results.map(staff => (
                        <li key={staff.id}>
                            <button
                                type="button"
                                onClick={() => handleSelect(staff)}
                                className="w-full text-left px-4 py-2.5 hover:bg-blue-50 transition-colors"
                            >
                                <p className="text-sm font-medium text-gray-900">
                                    {staff.firstName} {staff.lastName}
                                </p>
                                <p className="text-xs text-gray-500">
                                    EMP-{staff.employeeCode}
                                    {staff.designation?.name ? ` · ${staff.designation.name}` : ""}
                                    {staff.mobile ? ` · ${staff.mobile}` : ""}
                                </p>
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
