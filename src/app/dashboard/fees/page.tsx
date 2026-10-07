"use client";

import { useState, useEffect } from "react";
import toast, { Toaster } from "react-hot-toast";
import Link from "next/link";
import { API_BASE_URL } from "@/lib/api";
import { useRouter } from "next/navigation";
import { useRbac } from "@/lib/rbac";
import { authFetch, getUser } from "@/lib/auth";
import { useReadOnlySession, READ_ONLY_TITLE } from "@/lib/support-session";
import ReceiptModal from "@/components/ReceiptModal";
import { Settings, Layers, Wallet, BadgePercent } from "lucide-react";
import { sortByName } from "@/lib/utils";
import NumberInput from "@/components/ui/NumberInput";
import { useLocale, useTranslations } from "next-intl";
import { INTL_LOCALE, type Locale } from "@/i18n/config";

// Mirrors the backend `PaymentMethod` enum (fee_payment / fee_adjustment).
// Ordered by how often the counter actually uses them.
const PAYMENT_METHODS = ['CASH', 'UPI', 'CARD', 'ONLINE', 'CHEQUE'] as const;
type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export default function FeesDashboardPage() {
    const t = useTranslations("fees");
    const tc = useTranslations("common");
    const intl = INTL_LOCALE[useLocale() as Locale];
    const router = useRouter();
    const rbac = useRbac();
    const readOnly = useReadOnlySession();
    const [activeTab, setActiveTab] = useState<'SETUP' | 'STRUCTURES' | 'COLLECTION' | 'APPLY_DISCOUNTS' | 'APPLY_OTHER_FEE' | 'FEE_DETAILS'>('COLLECTION');
    const [mounted, setMounted] = useState(false);

    // Role guard — redirect TEACHER away from fees
    useEffect(() => {
        if (mounted && !rbac.canAccessFees) {
            toast.error(t("toast.noPermission"));
            router.replace('/dashboard');
        }
    }, [mounted, rbac.canAccessFees, router, t]);

    // --- Setup State ---
    const [categories, setCategories] = useState<any[]>([]);
    const [regularCategories, setRegularCategories] = useState<any[]>([]);
    const [addOnCategories, setAddOnCategories] = useState<any[]>([]);
    const [structures, setStructures] = useState<any[]>([]);
    const [classes, setClasses] = useState<any[]>([]);
    const [sessions, setSessions] = useState<any[]>([]);
    const [globalSettings, setGlobalSettings] = useState({ feeDueDate: 15, lateFeePerDay: 50.0 });
    const [savingSettings, setSavingSettings] = useState(false);
    const [loadingSetup, setLoadingSetup] = useState(false);

    // New Category Form
    const [newCategoryName, setNewCategoryName] = useState("");
    const [newCategoryDesc, setNewCategoryDesc] = useState("");
    const [newCategoryType, setNewCategoryType] = useState("REGULAR");
    const [editingCategory, setEditingCategory] = useState<any>(null);
    const [editCategoryName, setEditCategoryName] = useState("");
    const [editCategoryDesc, setEditCategoryDesc] = useState("");
    const [editCategoryType, setEditCategoryType] = useState("REGULAR");

    // New Structure Form
    const [formClassId, setFormClassId] = useState("");
    const [formCategoryId, setFormCategoryId] = useState("");
    const [formAmount, setFormAmount] = useState("");
    const [formFrequency, setFormFrequency] = useState("MONTHLY");
    const [formAcademicYear, setFormAcademicYear] = useState("");
    // Only checked discounts apply. Empty = no discounts. Defaults to all when discounts load.
    const [formApplicableDiscountIds, setFormApplicableDiscountIds] = useState<number[]>([]);
    const [formDiscountsInitialized, setFormDiscountsInitialized] = useState(false);
    const [formIsLateFeeApplicable, setFormIsLateFeeApplicable] = useState(true);

    // New Discount Form
    const [discounts, setDiscounts] = useState<any[]>([]);
    const [newDiscountName, setNewDiscountName] = useState("");
    const [newDiscountType, setNewDiscountType] = useState("FLAT");
    const [newDiscountValue, setNewDiscountValue] = useState("");
    const [newDiscountAppType, setNewDiscountAppType] = useState("MANUAL");
    const [newDiscountLogicRef, setNewDiscountLogicRef] = useState("");
    const [editingDiscount, setEditingDiscount] = useState<any>(null);
    const [editDiscountName, setEditDiscountName] = useState("");
    const [editDiscountType, setEditDiscountType] = useState("FLAT");
    const [editDiscountValue, setEditDiscountValue] = useState("");
    const [editDiscountAppType, setEditDiscountAppType] = useState("MANUAL");
    const [editDiscountLogicRef, setEditDiscountLogicRef] = useState("");

    // Manage Discounts State
    const [applyDiscountStudentId, setApplyDiscountStudentId] = useState("");
    const [applyDiscountStudentClassId, setApplyDiscountStudentClassId] = useState("");
    const [applyDiscountSearchQuery, setApplyDiscountSearchQuery] = useState("");
    const [selectedDiscountsToApply, setSelectedDiscountsToApply] = useState<number[]>([]);
    const [applyingDiscounts, setApplyingDiscounts] = useState(false);

    // Apply Other Fee State
    const [applyOtherFeeStudentId, setApplyOtherFeeStudentId] = useState("");
    const [applyOtherFeeStudentName, setApplyOtherFeeStudentName] = useState("");
    const [applyOtherFeeCategoryId, setApplyOtherFeeCategoryId] = useState("");
    const [applyOtherFeeAmount, setApplyOtherFeeAmount] = useState("");
    const [applyOtherFeeFrequency, setApplyOtherFeeFrequency] = useState("MONTHLY");
    const [applyOtherFeeDescription, setApplyOtherFeeDescription] = useState("");
    const [applyingOtherFee, setApplyingOtherFee] = useState(false);

    // Shared Student Search Form State
    const [searchFormId, setSearchFormId] = useState("");
    const [searchFormFirstName, setSearchFormFirstName] = useState("");
    const [searchFormLastName, setSearchFormLastName] = useState("");
    const [searchFormMobile, setSearchFormMobile] = useState("");
    const [searchFormClassId, setSearchFormClassId] = useState("");
    const [searchFormSectionId, setSearchFormSectionId] = useState("");
    const [searchFormSessionId, setSearchFormSessionId] = useState("");
    const [searchFormSections, setSearchFormSections] = useState<any[]>([]);
    const [hasSearchFormSearched, setHasSearchFormSearched] = useState(false);
    const [searchFormStudentsList, setSearchFormStudentsList] = useState<any[]>([]);
    const [isSearchingStudents, setIsSearchingStudents] = useState(false);
    // Pagination for student search
    const [searchFormPage, setSearchFormPage] = useState(1);
    const [searchFormTotal, setSearchFormTotal] = useState(0);
    const SEARCH_PAGE_SIZE = 20;

    // FEE_DETAILS tab state
    const [feeDetailsStudentId, setFeeDetailsStudentId] = useState("");
    const [feeDetailsStudentName, setFeeDetailsStudentName] = useState("");
    const [feeDetailsOptionalFees, setFeeDetailsOptionalFees] = useState<any[]>([]);
    const [feeDetailsDiscounts, setFeeDetailsDiscounts] = useState<any[]>([]);
    const [feeDetailsFull, setFeeDetailsFull] = useState<any>(null);
    const [loadingFeeDetails, setLoadingFeeDetails] = useState(false);
    const [removingFeeId, setRemovingFeeId] = useState<number | null>(null);

    // Manage Structures State
    const [structureSearchClassId, setStructureSearchClassId] = useState("");
    const [editingStructure, setEditingStructure] = useState<any>(null);
    const [editAmount, setEditAmount] = useState("");
    const [editFrequency, setEditFrequency] = useState("MONTHLY");
    const [editYear, setEditYear] = useState("");
    const [editApplicableDiscountIds, setEditApplicableDiscountIds] = useState<number[]>([]);
    const [editIsLateFeeApplicable, setEditIsLateFeeApplicable] = useState(true);

    // Dropdown State for actions (row id tracking)
    const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
    const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });

    // Pre-select all discounts in the create form when discounts first load
    useEffect(() => {
        if (!formDiscountsInitialized && discounts.length > 0) {
            setFormApplicableDiscountIds(discounts.filter(d => d.isActive !== false).map((d: any) => d.id));
            setFormDiscountsInitialized(true);
        }
    }, [discounts, formDiscountsInitialized]);

    // Close dropdowns when clicking outside or scrolling
    useEffect(() => {
        const handleClose = (e: MouseEvent | Event) => {
            // only close if we didn't just click a dropdown toggle button
            const target = e.target as any;
            if (target && typeof target.closest === 'function') {
                if (!target.closest('.action-dropdown-btn') && !target.closest('.action-dropdown-menu')) {
                    setOpenDropdownId(null);
                }
            } else {
                setOpenDropdownId(null);
            }
        };
        document.addEventListener('click', handleClose);
        document.addEventListener('scroll', handleClose, true);
        return () => {
            document.removeEventListener('click', handleClose);
            document.removeEventListener('scroll', handleClose, true);
        }
    }, []);

    // Decouple Search: Reset search state when switching tabs
    useEffect(() => {
        // Reset search results for the shared student search form when tab changes
        setSearchFormStudentsList([]);
        setHasSearchFormSearched(false);
        setSearchFormTotal(0);
        setSearchFormPage(1);

        // Also reset selected states for management panels
        setApplyDiscountStudentId("");
        setApplyOtherFeeStudentId("");
        setFeeDetailsStudentId("");
    }, [activeTab]);

    const handleDropdownClick = (e: React.MouseEvent, id: string) => {
        e.preventDefault();
        e.stopPropagation();

        if (openDropdownId === id) {
            setOpenDropdownId(null);
        } else {
            const button = e.currentTarget as HTMLElement;
            const rect = button.getBoundingClientRect();
            // Estimated menu height (3 items * ~34px each + padding)
            const menuHeight = 120;
            const menuWidth = 130;
            const viewportHeight = window.innerHeight;
            const viewportWidth = window.innerWidth;

            // Flip above if not enough space below
            const spaceBelow = viewportHeight - rect.bottom;
            const top = spaceBelow >= menuHeight
                ? rect.bottom + 4       // show below
                : rect.top - menuHeight - 4; // flip above

            // Ensure it doesn't go off the right edge
            const left = Math.min(rect.right - menuWidth, viewportWidth - menuWidth - 8);

            setDropdownPosition({ top, left });
            setOpenDropdownId(id);
        }
    };

    // --- Collection State ---
    // Cache of full student records seen so far — populated lazily as students
    // are searched/selected rather than bulk-loaded, so receipt-building code
    // further down (students.find(...) by selectedStudentId) keeps working
    // without ever fetching the whole school's roster.
    const [students, setStudents] = useState<any[]>([]);
    const [selectedStudentId, setSelectedStudentId] = useState("");
    const [searchQuery, setSearchQuery] = useState("");
    const [collectionSearchResults, setCollectionSearchResults] = useState<any[]>([]);
    const [isSearchingCollection, setIsSearchingCollection] = useState(false);
    const [collectionYear, setCollectionYear] = useState("2026-2027");
    const [studentFeeDetails, setStudentFeeDetails] = useState<any>(null);
    const [loadingCollection, setLoadingCollection] = useState(false);

    // Payment Form
    const [selectedMonths, setSelectedMonths] = useState<string[]>([]);
    const [payAmount, setPayAmount] = useState("");
    const [payMethod, setPayMethod] = useState("CASH");
    const [payRemarks, setPayRemarks] = useState("");
    const [receiptData, setReceiptData] = useState<any>(null); // For receipt modal

    // Payment History modal (for PARTIAL months)
    const [paymentHistoryData, setPaymentHistoryData] = useState<any>(null);

    // Fee Adjustment (Refund / Waive-Off) state
    const [adjFeeMonth, setAdjFeeMonth] = useState("");
    const [adjAmount, setAdjAmount] = useState("");
    const [adjReason, setAdjReason] = useState("");
    const [adjPaymentMethod, setAdjPaymentMethod] = useState("CASH");
    const [adjType, setAdjType] = useState<'REFUND' | 'WAIVE_OFF'>('REFUND');
    const [adjModalOpen, setAdjModalOpen] = useState(false);
    const [submittingAdj, setSubmittingAdj] = useState(false);
    const [adjPermittedBySearch, setAdjPermittedBySearch] = useState("");
    const [adjPermittedByResults, setAdjPermittedByResults] = useState<any[]>([]);
    const [adjPermittedByUserId, setAdjPermittedByUserId] = useState<number | null>(null);
    const [adjPermittedByName, setAdjPermittedByName] = useState("");

    // Fetch Setup Data
    useEffect(() => {
        const fetchSetupData = async () => {
            try {
                const [catRes, structRes, classRes, settingsRes, discountRes, sessionRes, regularCatRes, addOnCatRes] = await Promise.all([
                    authFetch(`${API_BASE_URL}/fees/categories`),
                    authFetch(`${API_BASE_URL}/fees/structures`),
                    authFetch(`${API_BASE_URL}/classes`),
                    authFetch(`${API_BASE_URL}/fees/settings`),
                    authFetch(`${API_BASE_URL}/fees/discounts`),
                    authFetch(`${API_BASE_URL}/academic-sessions`),
                    authFetch(`${API_BASE_URL}/fees/categories?type=REGULAR`),
                    authFetch(`${API_BASE_URL}/fees/categories?type=ADD_ON`),
                ]);
                if (catRes.ok) setCategories(await catRes.json());
                if (structRes.ok) setStructures(await structRes.json());
                if (classRes.ok) setClasses(sortByName(await classRes.json()));
                if (settingsRes.ok) setGlobalSettings(await settingsRes.json());
                if (discountRes.ok) setDiscounts(await discountRes.json());
                if (regularCatRes.ok) setRegularCategories(await regularCatRes.json());
                if (addOnCatRes.ok) setAddOnCategories(await addOnCatRes.json());

                if (sessionRes.ok) {
                    const sessList = await sessionRes.json();
                    setSessions(sessList);
                    const active = sessList.find((s: any) => s.isActive);
                    if (active) {
                        setCollectionYear(active.name);
                        setFormAcademicYear(active.name);
                    }
                }
            } catch (err) {
                toast.error(t("toast.loadSetupFailed"));
            }
        };
        fetchSetupData();
        setMounted(true);
    }, [t]);

    // Refresh Setup Data helper
    const refreshSetupData = async () => {
        const [catRes, structRes, regularCatRes, addOnCatRes] = await Promise.all([
            authFetch(`${API_BASE_URL}/fees/categories`),
            authFetch(`${API_BASE_URL}/fees/structures`),
            authFetch(`${API_BASE_URL}/fees/categories?type=REGULAR`),
            authFetch(`${API_BASE_URL}/fees/categories?type=ADD_ON`),
        ]);
        if (catRes.ok) setCategories(await catRes.json());
        if (structRes.ok) setStructures(await structRes.json());
        if (regularCatRes.ok) setRegularCategories(await regularCatRes.json());
        if (addOnCatRes.ok) setAddOnCategories(await addOnCatRes.json());
    };

    const handleSaveSettings = async (e: React.FormEvent) => {
        e.preventDefault();
        if (readOnly) return;
        setSavingSettings(true);
        try {
            const res = await authFetch(`${API_BASE_URL}/fees/settings`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    feeDueDate: parseInt(globalSettings.feeDueDate.toString()),
                    lateFeePerDay: parseFloat(globalSettings.lateFeePerDay.toString())
                })
            });
            if (res.ok) {
                toast.success(t("toast.settingsSaved"));
                setGlobalSettings(await res.json());
            } else throw new Error("Failed to save settings");
        } catch (err) {
            toast.error(t("toast.settingsSaveFailed"));
        } finally {
            setSavingSettings(false);
        }
    };

    const handleCreateDiscount = async (e: React.FormEvent) => {
        e.preventDefault();
        if (readOnly) return;
        try {
            const res = await authFetch(`${API_BASE_URL}/fees/discounts`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: newDiscountName,
                    type: newDiscountType,
                    value: parseFloat(newDiscountValue),
                    applicationType: newDiscountAppType,
                    logicReference: newDiscountLogicRef || undefined
                })
            });
            if (res.ok) {
                toast.success(t("toast.discountCreated"));
                setNewDiscountName("");
                setNewDiscountValue("");
                setNewDiscountLogicRef("");
                const dRes = await authFetch(`${API_BASE_URL}/fees/discounts`);
                if (dRes.ok) setDiscounts(await dRes.json());
            } else throw new Error("Creation failed");
        } catch (err) {
            toast.error(t("toast.discountCreateFailed"));
        }
    };

    const handleUpdateDiscount = async (e: React.FormEvent) => {
        e.preventDefault();
        if (readOnly) return;
        if (!editingDiscount) return;
        try {
            const res = await authFetch(`${API_BASE_URL}/fees/discounts/${editingDiscount.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: editDiscountName,
                    type: editDiscountType,
                    value: parseFloat(editDiscountValue),
                    applicationType: editDiscountAppType,
                    logicReference: editDiscountLogicRef || undefined
                })
            });
            if (res.ok) {
                toast.success(t("toast.discountUpdated"));
                setEditingDiscount(null);
                const dRes = await authFetch(`${API_BASE_URL}/fees/discounts`);
                if (dRes.ok) setDiscounts(await dRes.json());
            } else throw new Error(t("toast.updateFailed"));
        } catch (err: any) {
            toast.error(err.message || t("toast.discountUpdateFailed"));
        }
    };

    const handleToggleDiscountStatus = async (id: number, currentStatus: boolean) => {
        try {
            const res = await authFetch(`${API_BASE_URL}/fees/discounts/${id}/toggle-status`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ isActive: !currentStatus })
            });
            if (res.ok) {
                toast.success(currentStatus ? t("toast.discountDeactivated") : t("toast.discountActivated"));
                const dRes = await authFetch(`${API_BASE_URL}/fees/discounts`);
                if (dRes.ok) setDiscounts(await dRes.json());
            } else throw new Error(t("toast.statusUpdateFailed"));
        } catch (err: any) {
            toast.error(err.message || t("toast.statusUpdateFailed"));
        }
    };

    const handleDeleteDiscount = async (id: number) => {
        if (!confirm(t("confirm.deleteDiscount"))) return;
        try {
            const res = await authFetch(`${API_BASE_URL}/fees/discounts/${id}`, {
                method: "DELETE"
            });
            if (res.ok) {
                toast.success(t("toast.discountDeleted"));
                const dRes = await authFetch(`${API_BASE_URL}/fees/discounts`);
                if (dRes.ok) setDiscounts(await dRes.json());
            } else {
                const errData = await res.json();
                throw new Error(errData.message || t("toast.deleteFailed"));
            }
        } catch (err: any) {
            toast.error(err.message || t("toast.discountDeleteFailed"));
        }
    };

    const handleCreateCategory = async (e: React.FormEvent) => {
        e.preventDefault();
        if (readOnly) return;
        try {
            const res = await authFetch(`${API_BASE_URL}/fees/categories`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: newCategoryName, description: newCategoryDesc, type: newCategoryType })
            });
            if (res.ok) {
                toast.success(t("toast.categoryCreated"));
                setNewCategoryName("");
                setNewCategoryDesc("");
                setNewCategoryType("REGULAR");
                refreshSetupData();
            } else throw new Error("Creation failed");
        } catch (err) {
            toast.error(t("toast.categoryCreateFailed"));
        }
    };

    const handleUpdateCategory = async (e: React.FormEvent) => {
        e.preventDefault();
        if (readOnly) return;
        if (!editingCategory) return;
        try {
            const res = await authFetch(`${API_BASE_URL}/fees/categories/${editingCategory.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: editCategoryName, description: editCategoryDesc, type: editCategoryType })
            });
            if (res.ok) {
                toast.success(t("toast.categoryUpdated"));
                setEditingCategory(null);
                refreshSetupData();
            } else throw new Error(t("toast.updateFailed"));
        } catch (err: any) {
            toast.error(err.message || t("toast.categoryUpdateFailed"));
        }
    };

    const handleToggleCategoryStatus = async (id: number, currentStatus: boolean) => {
        try {
            const res = await authFetch(`${API_BASE_URL}/fees/categories/${id}/toggle-status`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ isActive: !currentStatus })
            });
            if (res.ok) {
                toast.success(currentStatus ? t("toast.categoryDeactivated") : t("toast.categoryActivated"));
                refreshSetupData();
            } else throw new Error(t("toast.statusUpdateFailed"));
        } catch (err: any) {
            toast.error(err.message || t("toast.statusUpdateFailed"));
        }
    };

    const handleDeleteCategory = async (id: number) => {
        if (!confirm(t("confirm.deleteCategory"))) return;
        try {
            const res = await authFetch(`${API_BASE_URL}/fees/categories/${id}`, {
                method: "DELETE"
            });
            if (res.ok) {
                toast.success(t("toast.categoryDeleted"));
                refreshSetupData();
            } else {
                const errData = await res.json();
                throw new Error(errData.message || t("toast.deleteFailed"));
            }
        } catch (err: any) {
            toast.error(err.message || t("toast.categoryDeleteFailed"));
        }
    };

    const handleCreateStructure = async (e: React.FormEvent) => {
        e.preventDefault();
        if (readOnly) return;
        try {
            const res = await authFetch(`${API_BASE_URL}/fees/structures`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    classId: parseInt(formClassId),
                    feeCategoryId: parseInt(formCategoryId),
                    amount: parseFloat(formAmount),
                    frequency: formFrequency,
                    academicYear: formAcademicYear,
                    applicableDiscountIds: formApplicableDiscountIds,
                    isLateFeeApplicable: formIsLateFeeApplicable,
                })
            });
            if (res.ok) {
                toast.success(t("toast.structureCreated"));
                setFormAmount("");
                // Reset to all-checked for the next structure creation
                setFormApplicableDiscountIds(discounts.filter(d => d.isActive !== false).map((d: any) => d.id));
                setFormIsLateFeeApplicable(true);
                refreshSetupData();
            } else {
                const errData = await res.json();
                throw new Error(errData.message || t("toast.createFailed"));
            }
        } catch (err: any) {
            toast.error(err.message || t("toast.structureCreateFailed"));
        }
    };

    const handleUpdateStructure = async (e: React.FormEvent) => {
        e.preventDefault();
        if (readOnly) return;
        if (!editingStructure) return;
        try {
            const res = await authFetch(`${API_BASE_URL}/fees/structures/${editingStructure.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    amount: parseFloat(editAmount),
                    frequency: editFrequency,
                    academicYear: editYear,
                    applicableDiscountIds: editApplicableDiscountIds,
                    isLateFeeApplicable: editIsLateFeeApplicable,
                })
            });
            if (res.ok) {
                toast.success(t("toast.structureUpdated"));
                setEditingStructure(null);
                refreshSetupData();
            } else {
                const errData = await res.json();
                throw new Error(errData.message || t("toast.updateFailed"));
            }
        } catch (err: any) {
            toast.error(err.message || t("toast.structureUpdateFailed"));
        }
    };

    const handleDeleteStructure = async (id: number) => {
        if (!confirm(t("confirm.deleteStructure"))) return;
        try {
            const res = await authFetch(`${API_BASE_URL}/fees/structures/${id}`, {
                method: "DELETE"
            });
            if (res.ok) {
                toast.success(t("toast.structureDeleted"));
                refreshSetupData();
            } else {
                const errData = await res.json();
                throw new Error(errData.message || t("toast.deleteFailed"));
            }
        } catch (err: any) {
            toast.error(err.message || t("toast.structureDeleteFailed"));
        }
    };

    const handleSearchFormStudents = async (e: React.FormEvent, overridePage?: number) => {
        e.preventDefault();
        const pageToFetch = overridePage ?? 1;
        setIsSearchingStudents(true);
        setHasSearchFormSearched(true);
        if (!overridePage) setSearchFormPage(1);
        try {
            const params = new URLSearchParams();
            if (searchFormId) params.append("id", searchFormId);
            if (searchFormFirstName) params.append("firstName", searchFormFirstName);
            if (searchFormLastName) params.append("lastName", searchFormLastName);
            if (searchFormMobile) params.append("mobile", searchFormMobile);
            if (searchFormClassId) params.append("classId", searchFormClassId);
            if (searchFormSectionId) params.append("sectionId", searchFormSectionId);
            if (searchFormSessionId) params.append("academicSessionId", searchFormSessionId); // fixed: was "sessionId"
            params.append("page", String(pageToFetch));
            params.append("limit", String(SEARCH_PAGE_SIZE));

            const res = await authFetch(`${API_BASE_URL}/students?${params.toString()}`);
            if (res.ok) {
                const data = await res.json();
                // Backend returns { data, total, page, limit } when paginated
                if (data && data.data) {
                    setSearchFormStudentsList(data.data);
                    setSearchFormTotal(data.total);
                    setSearchFormPage(data.page);
                } else {
                    setSearchFormStudentsList(Array.isArray(data) ? data : []);
                    setSearchFormTotal(Array.isArray(data) ? data.length : 0);
                }
            } else {
                toast.error(t("toast.fetchStudentsFailed"));
            }
        } catch (error) {
            toast.error(t("toast.fetchStudentsError"));
        } finally {
            setIsSearchingStudents(false);
        }
    };

    // Server-side collection search, debounced — replaces the old
    // unbounded-fetch-then-client-filter approach, which pulled every student
    // in the school on every page load. Matches by name or admission number
    // (the backend's generic `search` OR-group covers both).
    useEffect(() => {
        if (!searchQuery || selectedStudentId) {
            setCollectionSearchResults([]);
            return;
        }
        setIsSearchingCollection(true);
        const timer = setTimeout(async () => {
            try {
                const params = new URLSearchParams({ search: searchQuery, page: '1', limit: '8' });
                const res = await authFetch(`${API_BASE_URL}/students?${params.toString()}`);
                if (res.ok) {
                    const data = await res.json();
                    setCollectionSearchResults(data?.data ?? (Array.isArray(data) ? data : []));
                }
            } catch {
                // silent — the box just shows no results, no need to toast on every keystroke
            } finally {
                setIsSearchingCollection(false);
            }
        }, 300);
        return () => clearTimeout(timer);
    }, [searchQuery, selectedStudentId]);

    // Upserts full student records into the `students` cache by id, so
    // students.find(...) elsewhere (receipt building) keeps resolving
    // whichever student was actually selected/searched.
    const cacheStudents = (rows: any[]) => {
        setStudents(prev => {
            const byId = new Map(prev.map(s => [s.id, s]));
            for (const row of rows) byId.set(row.id, row);
            return Array.from(byId.values());
        });
    };

    const handleSelectStudent = (student: any) => {
        cacheStudents([student]);
        setSelectedStudentId(student.id.toString());
        setSearchQuery(`${student.firstName} ${student.lastName} (ID: ${student.id})`);
        setCollectionSearchResults([]);
    };

    // Fetch Student Fees whenever student changes
    useEffect(() => {
        if (!selectedStudentId) {
            setStudentFeeDetails(null);
            setSelectedMonths([]);
            return;
        }

        const fetchStudentFees = async () => {
            setLoadingCollection(true);
            try {
                const res = await authFetch(`${API_BASE_URL}/fees/student/${selectedStudentId}?academicYear=${collectionYear}`);
                if (res.ok) {
                    setStudentFeeDetails(await res.json());
                    setSelectedMonths([]);
                }
            } catch (err) {
                toast.error(t("toast.loadStudentFeesFailed"));
            } finally {
                setLoadingCollection(false);
            }
        };
        fetchStudentFees();
    }, [selectedStudentId, collectionYear, t]);

    // Handle class change to update sections dropdown
    useEffect(() => {
        if (!searchFormClassId) {
            setSearchFormSections([]);
            setSearchFormSectionId("");
            return;
        }
        const cls = classes.find(c => c.id.toString() === searchFormClassId);
        if (cls && cls.sections) {
            setSearchFormSections(cls.sections);
            // Auto-select first section or clear if none
            setSearchFormSectionId(cls.sections.length > 0 ? cls.sections[0].id.toString() : "");
        } else {
            setSearchFormSections([]);
            setSearchFormSectionId("");
        }
    }, [searchFormClassId, classes]);

    const handleApplyOtherFeeSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (readOnly) return;
        if (!applyOtherFeeStudentId || !applyOtherFeeCategoryId || !applyOtherFeeAmount) return;

        setApplyingOtherFee(true);
        try {
            const res = await authFetch(`${API_BASE_URL}/students/${applyOtherFeeStudentId}/optional-fees`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    feeCategoryId: parseInt(applyOtherFeeCategoryId),
                    amount: parseFloat(applyOtherFeeAmount),
                    frequency: applyOtherFeeFrequency,
                    description: applyOtherFeeDescription
                })
            });
            if (res.ok) {
                toast.success(t("toast.specialFeeApplied"));
                // Clear form but keep student selected
                setApplyOtherFeeCategoryId("");
                setApplyOtherFeeAmount("");
                setApplyOtherFeeDescription("");
            } else {
                throw new Error("Failed to apply fee");
            }
        } catch (err) {
            toast.error(t("toast.applyFeeError"));
        } finally {
            setApplyingOtherFee(false);
        }
    };

    const handleLoadFeeDetails = async (studentId: string, studentName: string) => {
        setFeeDetailsStudentId(studentId);
        setFeeDetailsStudentName(studentName);
        setLoadingFeeDetails(true);
        setFeeDetailsOptionalFees([]);
        setFeeDetailsDiscounts([]);
        setFeeDetailsFull(null);
        try {
            const [optFeesRes, fullFeesRes, studentRes] = await Promise.all([
                authFetch(`${API_BASE_URL}/students/${studentId}/optional-fees`),
                authFetch(`${API_BASE_URL}/fees/student/${studentId}?academicYear=${collectionYear}`),
                authFetch(`${API_BASE_URL}/students?id=${studentId}&page=1&limit=1`)
            ]);
            if (optFeesRes.ok) setFeeDetailsOptionalFees(await optFeesRes.json());
            if (fullFeesRes.ok) setFeeDetailsFull(await fullFeesRes.json());
            if (studentRes.ok) {
                const data = await studentRes.json();
                const students = data?.data || (Array.isArray(data) ? data : []);
                const s = students[0];
                if (s?.studentDiscounts) {
                    setFeeDetailsDiscounts(s.studentDiscounts.filter((sd: any) => sd.isActive));
                }
            }
        } catch {
            toast.error(t("toast.loadFeeDetailsFailed"));
        } finally {
            setLoadingFeeDetails(false);
            setTimeout(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }), 100);
        }
    };

    const handleRemoveOptionalFee = async (feeId: number) => {
        if (!feeDetailsStudentId) return;
        setRemovingFeeId(feeId);
        try {
            const res = await authFetch(`${API_BASE_URL}/students/${feeDetailsStudentId}/optional-fees/${feeId}`, {
                method: 'DELETE'
            });
            if (res.ok) {
                toast.success(t("toast.optionalFeeRemoved"));
                setFeeDetailsOptionalFees(prev => prev.filter((f: any) => f.id !== feeId));
            } else {
                throw new Error("Failed to remove fee");
            }
        } catch {
            toast.error(t("toast.removeFeeFailed"));
        } finally {
            setRemovingFeeId(null);
        }
    };

    const handleCollectPayment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (readOnly) return;
        if (selectedMonths.length === 0) return;

        try {
            setLoadingCollection(true);

            // Calculate breakdowns
            const otFees = studentFeeDetails?.oneTimeFees;
            const otSelected = otFees && selectedMonths.includes(otFees.monthKey);
            const paidMonthsBreakdown = studentFeeDetails?.monthlyBreakdown?.filter((m: any) => selectedMonths.includes(m.monthKey)) || [];
            const totalBaseFee = paidMonthsBreakdown.reduce((sum: number, m: any) => sum + (m.baseFee || 0), 0)
                + (otSelected ? (otFees.baseFee || 0) : 0);
            const totalLateFee = paidMonthsBreakdown.reduce((sum: number, m: any) => sum + (m.lateFee || 0), 0);

            // Aggregate categories
            const aggregatedCategories: { [key: string]: number } = {};
            paidMonthsBreakdown.forEach((m: any) => {
                if (m.categoryBreakdown && m.categoryBreakdown.length > 0) {
                    m.categoryBreakdown.forEach((c: any) => {
                        aggregatedCategories[c.categoryName] = (aggregatedCategories[c.categoryName] || 0) + c.amount;
                    });
                } else if (m.baseFee > 0) {
                    aggregatedCategories['General Tuition'] = (aggregatedCategories['General Tuition'] || 0) + m.baseFee;
                }
            });
            if (otSelected) {
                (otFees.categoryBreakdown || []).forEach((c: any) => {
                    aggregatedCategories[c.categoryName] = (aggregatedCategories[c.categoryName] || 0) + c.amount;
                });
            }
            const categoryBreakdownArray = Object.keys(aggregatedCategories).map(key => ({
                name: key,
                amount: aggregatedCategories[key]
            }));

            // Aggregate discounts
            const aggregatedDiscounts: { [key: string]: number } = {};
            paidMonthsBreakdown.forEach((m: any) => {
                (m.appliedDiscounts || []).forEach((d: any) => {
                    aggregatedDiscounts[d.name] = (aggregatedDiscounts[d.name] || 0) + d.amount;
                });
            });
            if (otSelected) {
                (otFees.appliedDiscounts || []).forEach((d: any) => {
                    aggregatedDiscounts[d.name] = (aggregatedDiscounts[d.name] || 0) + d.amount;
                });
            }
            const discountsArray = Object.keys(aggregatedDiscounts).map(key => ({
                name: key,
                amount: aggregatedDiscounts[key]
            }));

            const totalDiscountAmount = discountsArray.reduce((sum, d) => sum + d.amount, 0);

            const res = await authFetch(`${API_BASE_URL}/fees/pay`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    studentId: parseInt(selectedStudentId),
                    feeMonths: selectedMonths,
                    amountPaid: parseFloat(payAmount),
                    paymentMethod: payMethod,
                    remarks: payRemarks,
                    academicYear: collectionYear,
                    discountAmount: totalDiscountAmount || 0,
                    baseFeeAmount: totalBaseFee || 0,
                    otherFeeAmount: totalLateFee || 0,
                    feeBreakdown: {
                        discounts: discountsArray,
                        categories: categoryBreakdownArray
                    }
                })
            });

            if (res.ok) {
                await res.json(); // consume response
                toast.success(t("toast.paymentSuccess"));

                // Refresh fee details so the month cards update immediately
                const feesRes = await authFetch(`${API_BASE_URL}/fees/student/${selectedStudentId}?academicYear=${collectionYear}`);
                if (feesRes.ok) {
                    setStudentFeeDetails(await feesRes.json());
                }

                // Reset selection — view accurate receipts via the month card's Payment History modal
                setSelectedMonths([]);
                setPayAmount("");
                setPayRemarks("");

            } else {
                const errData = await res.json();
                throw new Error(errData.message || t("toast.paymentFailed"));
            }
        } catch (err: any) {
            toast.error(err.message || t("toast.paymentProcessFailed"));
        } finally {
            setLoadingCollection(false);
        }
    };

    const printReceipt = () => {
        window.print();
    };

    // Open adjustment modal pre-filled for a specific month
    const openAdjModal = (monthKey: string, defaultType: 'REFUND' | 'WAIVE_OFF' = 'REFUND') => {
        setAdjFeeMonth(monthKey);
        setAdjAmount("");
        setAdjReason("");
        setAdjPaymentMethod("CASH");
        setAdjType(defaultType);
        setAdjPermittedBySearch("");
        setAdjPermittedByResults([]);
        setAdjPermittedByUserId(null);
        setAdjPermittedByName("");
        setAdjModalOpen(true);
    };

    const handleIssueAdjustment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (readOnly) return;
        if (!selectedStudentId || !adjFeeMonth) return;
        if (adjType === 'WAIVE_OFF' && !adjPermittedByUserId) {
            toast.error(t("toast.selectPermittedBy"));
            return;
        }
        setSubmittingAdj(true);
        try {
            const body: any = {
                studentId: parseInt(selectedStudentId),
                feeMonth: adjFeeMonth,
                academicYear: collectionYear,
                amount: parseFloat(adjAmount),
                reason: adjReason || undefined,
                type: adjType,
            };
            if (adjType === 'REFUND') body.paymentMethod = adjPaymentMethod;
            if (adjPermittedByUserId) body.permittedByUserId = adjPermittedByUserId;
            const res = await authFetch(`${API_BASE_URL}/fees/adjustment`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body)
            });
            if (res.ok) {
                toast.success(adjType === 'REFUND' ? t("toast.refundDone") : t("toast.waiveOffDone"));
                setAdjModalOpen(false);
                // Clear the waived month from selection so the card is no longer highlighted
                if (adjType === 'WAIVE_OFF') {
                    setSelectedMonths(prev => prev.filter(m => m !== adjFeeMonth));
                }
                setAdjFeeMonth("");
                setAdjAmount("");
                setAdjReason("");
                // Refresh fee data
                const feesRes = await authFetch(`${API_BASE_URL}/fees/student/${selectedStudentId}?academicYear=${collectionYear}`);
                if (feesRes.ok) setStudentFeeDetails(await feesRes.json());
            } else {
                const errData = await res.json();
                throw new Error(errData.message || t("toast.adjustmentFailed"));
            }
        } catch (err: any) {
            toast.error(err.message || t("toast.adjustmentProcessFailed"));
        } finally {
            setSubmittingAdj(false);
        }
    };

    const searchPermittedBy = async (query: string) => {
        setAdjPermittedBySearch(query);
        if (!query.trim()) { setAdjPermittedByResults([]); return; }
        try {
            const res = await authFetch(`${API_BASE_URL}/users?staffOnly=true&name=${encodeURIComponent(query)}&limit=10`);
            if (res.ok) {
                const data = await res.json();
                const users = Array.isArray(data) ? data : (data.data ?? []);
                setAdjPermittedByResults(users);
            }
        } catch { /* ignore */ }
    };

    const handleRevertWaiveOff = async (adjustmentId: number) => {
        if (!confirm(t("confirm.revertWaiveOff"))) return;
        try {
            const res = await authFetch(`${API_BASE_URL}/fees/adjustment/${adjustmentId}`, { method: "DELETE" });
            if (res.ok) {
                toast.success(t("toast.waiveOffReverted"));
                setPaymentHistoryData(null);
                const feesRes = await authFetch(`${API_BASE_URL}/fees/student/${selectedStudentId}?academicYear=${collectionYear}`);
                if (feesRes.ok) setStudentFeeDetails(await feesRes.json());
            } else {
                const errData = await res.json();
                throw new Error(errData.message || t("toast.revertFailed"));
            }
        } catch (err: any) {
            toast.error(err.message || t("toast.revertFailed"));
        }
    };

    // Display label for a payment method enum; unknown values are shown as sent.
    const paymentMethodLabel = (method: string) =>
        (PAYMENT_METHODS as readonly string[]).includes(method) ? t(`method.${method as PaymentMethod}`) : method;

    // Display label for a fee frequency enum; unknown values are shown as sent.
    const frequencyLabel = (frequency: string) => {
        switch (frequency) {
            case 'MONTHLY':
            case 'ONE_TIME':
            case 'ANNUALLY':
            case 'QUARTERLY':
            case 'HALF_YEARLY':
                return t(`frequency.${frequency}`);
            default: return frequency;
        }
    };

    // Display label for a fee status enum; unknown values are shown as sent.
    const feeStatusLabel = (status: string) => {
        switch (status) {
            case 'PAID': return tc("status.paid");
            case 'PARTIAL': return tc("status.partial");
            case 'UNPAID': return tc("status.unpaid");
            case 'PENDING': return tc("status.pending");
            case 'OVERDUE': return tc("status.overdue");
            case 'WAIVED': return t("status.waived");
            default: return status;
        }
    };

    if (!mounted) {
        return (
            <div className="p-8 flex justify-center items-center h-full">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    return (
        <main className="p-4 flex-1 h-full overflow-y-auto w-full max-w-7xl mx-auto printable-area">
            <Toaster position="top-right" />


            <h1 className="font-display text-[22px] sm:text-[26px] font-semibold tracking-[-0.02em] text-ink">{t("page.title")}</h1>

            {/* Receipt Modal */}
            {receiptData && (
                <ReceiptModal
                    receiptData={receiptData}
                    onClose={() => setReceiptData(null)}
                    isAdmin={rbac.isAdmin}
                    onCollectRemaining={
                        (receiptData.balanceAfterPayment ?? 0) > 0 && receiptData.monthKey
                            ? () => {
                                setReceiptData(null);
                                const period = studentFeeDetails?.feePeriods?.find((fp: any) =>
                                    (fp.months ?? [fp.monthKey])?.includes(receiptData.monthKey)
                                );
                                const monthsToSelect: string[] = period?.months ?? [receiptData.monthKey!];
                                setSelectedMonths(prev => {
                                    const next = [...prev];
                                    for (const mk of monthsToSelect) {
                                        if (!next.includes(mk)) next.push(mk);
                                    }
                                    return next;
                                });
                              }
                            : undefined
                    }
                    onWaiveOff={
                        (receiptData.balanceAfterPayment ?? 0) > 0 && receiptData.monthKey
                            ? () => { const mk = receiptData.monthKey!; setReceiptData(null); openAdjModal(mk, 'WAIVE_OFF'); }
                            : undefined
                    }
                    onIssueRefund={
                        (receiptData.excess ?? 0) > 0 && receiptData.monthKey
                            ? () => { const mk = receiptData.monthKey!; setReceiptData(null); openAdjModal(mk, 'REFUND'); }
                            : undefined
                    }
                />
            )}



            {/* Payment History Modal (for PARTIAL months) */}
            {paymentHistoryData && (
                <div className="fixed inset-0 z-100 flex items-center justify-center bg-walnut-950/55 backdrop-blur-sm no-print">
                    <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-lg">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-lg font-bold text-slate-800">{t("history.title", { label: paymentHistoryData.label })}</h2>
                            <button onClick={() => setPaymentHistoryData(null)} className="text-gray-400 hover:text-gray-600 transition-colors">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                            </button>
                        </div>
                        <div className="mb-4 grid grid-cols-2 gap-3 text-sm bg-slate-50 p-3 rounded-lg">
                            <div><span className="text-gray-500">{t("history.totalDue")}</span> <span className="font-semibold">₹{Number(paymentHistoryData.totalDue || 0).toFixed(2)}</span></div>
                            <div><span className="text-gray-500">{t("history.totalPaid")}</span> <span className="font-semibold text-green-700">₹{Number(paymentHistoryData.totalPaid || 0).toFixed(2)}</span></div>
                            {(paymentHistoryData.excess ?? 0) > 0 ? (
                                <div><span className="text-gray-500">{t("history.excessPaid")}</span> <span className="font-semibold text-green-600">₹{Number(paymentHistoryData.excess).toFixed(2)}</span></div>
                            ) : (
                                <div><span className="text-gray-500">{t("history.balance")}</span> <span className={`font-semibold ${paymentHistoryData.outstanding > 0 ? 'text-red-600' : 'text-green-700'}`}>₹{Number(paymentHistoryData.outstanding || 0).toFixed(2)}</span></div>
                            )}
                            <div><span className="text-gray-500">{t("history.status")}</span> <span className={`font-bold uppercase text-xs px-2 py-0.5 rounded ${paymentHistoryData.status === 'PAID' ? 'bg-green-100 text-green-800' : paymentHistoryData.status === 'PARTIAL' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}`}>{feeStatusLabel(paymentHistoryData.status)}</span></div>
                        </div>
                        {paymentHistoryData.payments?.length > 0 ? (
                            <div>
                                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">{t("history.paymentsMade")}</p>
                                <div className="space-y-2 max-h-64 overflow-y-auto">
                                    {paymentHistoryData.payments.map((p: any, idx: number) => (
                                        <div key={idx} className="flex justify-between items-center text-sm bg-green-50 border border-green-100 p-3 rounded-lg">
                                            <div>
                                                <p className="font-medium text-slate-800">₹{Number(p.amountPaid).toFixed(2)} <span className="text-xs text-gray-500">({paymentMethodLabel(p.paymentMethod)})</span></p>
                                                <p className="text-xs text-gray-500">{new Date(p.paymentDate).toLocaleDateString(intl, { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                                                <p className="text-xs text-gray-400">{t("history.receipt", { number: p.receiptNumber })}</p>
                                                {p.gatewayPaymentId && (
                                                    <p className="text-xs text-blue-500 font-mono mt-0.5">
                                                        {t("history.gateway", { id: p.gatewayPaymentId })}
                                                        <button onClick={() => navigator.clipboard.writeText(p.gatewayPaymentId)} className="ml-1.5 text-gray-400 hover:text-blue-600" title={t("history.copyPaymentId")}>⧉</button>
                                                    </p>
                                                )}
                                            </div>
                                            <button
                                                onClick={() => {
                                                    const student = students.find(s => s.id.toString() === selectedStudentId);
                                                    setReceiptData({
                                                        receiptNumber: p.receiptNumber,
                                                        paymentDate: p.paymentDate,
                                                        amountPaid: p.amountPaid,
                                                        paymentMethod: p.paymentMethod,
                                                        studentName: `${student?.firstName} ${student?.lastName}`,
                                                        studentClass: student?.class?.name || null,
                                                        studentSection: student?.section?.name || null,
                                                        feeCategory: paymentHistoryData.label,
                                                        academicYear: collectionYear,
                                                        monthsPaid: paymentHistoryData.label,
                                                        totalBaseFee: p.baseFeeAmount || 0,
                                                        totalLateFee: p.otherFeeAmount || 0,
                                                        // For partial payments, proportionally scale the components of the master invoice to the amount paid.
                                                        // p.totalPayableAmount is now returned by the backend for master invoices, and is available if this is the master itself,
                                                        // or if we wanted to be more precise, we use paymentHistoryData.totalDue.
                                                        // Since paymentHistoryData.totalDue incorporates all Base, Discount, and Late Fee at the time of calculation,
                                                        // we can use p.amountPaid / paymentHistoryData.totalDue as the scale factor.
                                                        // Use the stored components as-is — they already hold the correct
                                                        // per-period amounts (e.g. 9000, 3000, 900). The "Total Paid" row
                                                        // separately shows what was actually collected for this payment.
                                                        components: p.components ?? [],
                                                        // legacy fallback fields
                                                        appliedDiscounts: p.feeBreakdown?.discounts || (p.discountAmount > 0 ? [{ name: 'Discount', amount: p.discountAmount }] : []),
                                                        categoryBreakdown: p.feeBreakdown?.categories || [],
                                                        totalPayable: paymentHistoryData.totalDue ?? null,
                                                        balanceAfterPayment: paymentHistoryData.outstanding,
                                                        excess: paymentHistoryData.excess ?? 0,
                                                        monthKey: paymentHistoryData.monthKey,
                                                        adjustments: paymentHistoryData.adjustments ?? [],
                                                        collectedByName: p.collectedByName || null,
                                                        gatewayPaymentId: p.gatewayPaymentId || null,
                                                        gatewayOrderId: p.gatewayOrderId || null,
                                                    });
                                                    setPaymentHistoryData(null);
                                                }}
                                                className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                                            >
                                                {t("history.viewReceipt")}
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <p className="text-sm text-gray-500 italic">{t("history.noPayments")}</p>
                        )}
                        {paymentHistoryData.adjustments?.length > 0 && (
                            <div className="mt-4">
                                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">{t("history.adjustments")}</p>
                                <div className="space-y-2 max-h-40 overflow-y-auto">
                                    {paymentHistoryData.adjustments.map((a: any, idx: number) => (
                                        <div key={idx} className={`flex justify-between items-start text-sm p-3 rounded-lg border ${a.type === 'REFUND' ? 'bg-orange-50 border-orange-100' : 'bg-purple-50 border-purple-100'}`}>
                                            <div className="flex-1">
                                                <p className={`font-medium ${a.type === 'REFUND' ? 'text-orange-800' : 'text-purple-800'}`}>
                                                    <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded mr-1.5 ${a.type === 'REFUND' ? 'bg-orange-200 text-orange-700' : 'bg-purple-200 text-purple-700'}`}>{a.type === 'REFUND' ? t("history.refund") : t("history.waived")}</span>
                                                    ₹{Number(a.amount).toFixed(2)}
                                                    {a.type === 'REFUND' && a.paymentMethod && <span className="text-xs text-gray-500 ml-1">({paymentMethodLabel(a.paymentMethod)})</span>}
                                                </p>
                                                <p className="text-xs text-gray-500">{new Date(a.adjustedAt).toLocaleDateString(intl, { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                                                {a.reason && <p className="text-xs text-gray-400">{t("history.reason", { reason: a.reason })}</p>}
                                                {a.createdByName && <p className="text-xs text-gray-400">{t("history.by", { name: a.createdByName })}</p>}
                                            </div>
                                            {rbac.isAdmin && a.type === 'WAIVE_OFF' && a.id && (
                                                <button
                                                    onClick={() => handleRevertWaiveOff(a.id)}
                                                    className="ml-2 shrink-0 text-[10px] text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded px-2 py-1 transition-colors"
                                                    title={t("history.revertHint")}
                                                >
                                                    {t("history.revert")}
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                        <div className="mt-5 flex flex-wrap justify-between items-center gap-2">
                            {paymentHistoryData.outstanding > 0 && (
                                <button
                                    onClick={() => {
                                        setPaymentHistoryData(null);
                                        // Select all period months so the receipt label is correct
                                        const monthsToSelect: string[] = paymentHistoryData.months ?? [paymentHistoryData.monthKey];
                                        setSelectedMonths(prev => {
                                            const next = [...prev];
                                            for (const mk of monthsToSelect) {
                                                if (!next.includes(mk)) next.push(mk);
                                            }
                                            return next;
                                        });
                                    }}
                                    className="px-4 py-2 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
                                >
                                    {t("receipt.collectRemaining", { amount: Number(paymentHistoryData.outstanding).toFixed(2) })}
                                </button>
                            )}
                            {rbac.isAdmin && (paymentHistoryData.excess ?? 0) > 0 && (
                                <button
                                    onClick={() => { openAdjModal(paymentHistoryData.monthKey, 'REFUND'); setPaymentHistoryData(null); }}
                                    className="px-4 py-2 bg-orange-100 text-orange-700 text-sm border border-orange-200 rounded hover:bg-orange-200 transition-colors"
                                >
                                    {t("receipt.issueRefund", { amount: Number(paymentHistoryData.excess).toFixed(2) })}
                                </button>
                            )}
                            {rbac.isAdmin && paymentHistoryData.outstanding > 0 && (
                                <button
                                    onClick={() => { openAdjModal(paymentHistoryData.monthKey, 'WAIVE_OFF'); setPaymentHistoryData(null); }}
                                    className="px-4 py-2 bg-purple-100 text-purple-700 text-sm border border-purple-200 rounded hover:bg-purple-200 transition-colors"
                                >
                                    {t("history.waiveOffDues")}
                                </button>
                            )}
                            <button onClick={() => setPaymentHistoryData(null)} className="px-4 py-2 border border-gray-300 rounded text-gray-700 hover:bg-gray-50 transition-colors ml-auto">{tc("action.close")}</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Fee Adjustment Modal (Refund / Waive-Off) */}
            {adjModalOpen && (
                <div className="fixed inset-0 z-110 flex items-center justify-center bg-walnut-950/60 backdrop-blur-sm no-print">
                    <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md">
                        <div className="flex justify-between items-center mb-3">
                            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                {adjType === 'REFUND' ? (
                                    <>
                                        <svg className="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"></path></svg>
                                        {t("adj.issueRefund")}
                                    </>
                                ) : (
                                    <>
                                        <svg className="w-5 h-5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                        {t("history.waiveOffDues")}
                                    </>
                                )}
                            </h2>
                            <button onClick={() => setAdjModalOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                            </button>
                        </div>
                        <div className="mb-4">
                            <span className={`text-xs font-semibold uppercase px-2 py-1 rounded ${adjType === 'REFUND' ? 'bg-orange-100 text-orange-700' : 'bg-purple-100 text-purple-700'}`}>
                                {adjType === 'REFUND' ? t("adj.refundHint") : t("adj.waiveHint")}
                            </span>
                        </div>
                        <form onSubmit={handleIssueAdjustment} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-900 mb-1">{t("adj.feeMonth")}</label>
                                <select
                                    value={adjFeeMonth}
                                    onChange={(e) => setAdjFeeMonth(e.target.value)}
                                    required
                                    className="bg-gray-50 border border-gray-300 text-sm rounded-lg block w-full p-2.5 focus:ring-brand/40 focus:border-brand"
                                >
                                    <option value="">{t("adj.selectMonth")}</option>
                                    {studentFeeDetails?.oneTimeFees && (
                                        adjType === 'REFUND'
                                            ? (studentFeeDetails.oneTimeFees.excess ?? 0) > 0
                                            : (studentFeeDetails.oneTimeFees.outstanding ?? 0) > 0
                                    ) && (
                                        <option value={studentFeeDetails.oneTimeFees.monthKey}>
                                            {adjType === 'REFUND'
                                                ? t("adj.optionExcess", { label: studentFeeDetails.oneTimeFees.label, amount: Number(studentFeeDetails.oneTimeFees.excess).toFixed(2) })
                                                : t("adj.optionOutstanding", { label: studentFeeDetails.oneTimeFees.label, amount: Number(studentFeeDetails.oneTimeFees.outstanding).toFixed(2) })}
                                        </option>
                                    )}
                                    {(studentFeeDetails?.monthlyBreakdown || [])
                                        .filter((m: any) => adjType === 'REFUND' ? (m.excess ?? 0) > 0 : (m.outstanding ?? 0) > 0)
                                        .map((m: any) => (
                                            <option key={m.monthKey} value={m.monthKey}>
                                                {adjType === 'REFUND'
                                                    ? t("adj.optionExcess", { label: m.monthName, amount: Number(m.excess).toFixed(2) })
                                                    : t("adj.optionOutstanding", { label: m.monthName, amount: Number(m.outstanding).toFixed(2) })}
                                            </option>
                                        ))
                                    }
                                </select>
                            </div>
                            {(() => {
                                const mData = adjFeeMonth
                                    ? (studentFeeDetails?.monthlyBreakdown?.find((m: any) => m.monthKey === adjFeeMonth) ||
                                       (studentFeeDetails?.oneTimeFees?.monthKey === adjFeeMonth ? studentFeeDetails.oneTimeFees : null))
                                    : null;
                                const maxAmt: number = adjType === 'REFUND' ? (mData?.excess ?? 0) : (mData?.outstanding ?? 0);
                                return (
                                    <div>
                                        <label className="block text-sm font-medium text-gray-900 mb-1">
                                            {t("adj.amount")}
                                            {maxAmt > 0 && <span className="ml-2 text-xs text-gray-500 font-normal">{t("adj.max", { amount: maxAmt.toFixed(2) })}</span>}
                                        </label>
                                        <input
                                            type="number" step="0.01" min="0.01" max={maxAmt > 0 ? maxAmt : undefined}
                                            value={adjAmount}
                                            onChange={(e) => setAdjAmount(e.target.value)}
                                            required
                                            className="bg-gray-50 border-2 border-gray-200 rounded-lg block w-full p-2.5 focus:ring-brand/40 focus:border-brand font-bold text-lg"
                                            placeholder={t("adj.enterAmount")}
                                        />
                                    </div>
                                );
                            })()}
                            {adjType === 'REFUND' && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-900 mb-1">{t("adj.refundMethod")}</label>
                                    <div className="grid grid-cols-3 gap-2">
                                        {PAYMENT_METHODS.map(method => (
                                            <label key={method} className={`flex items-center justify-center p-2.5 border rounded-lg cursor-pointer transition-all text-xs font-medium ${adjPaymentMethod === method ? 'border-orange-500 bg-orange-50 text-orange-700 ring-1 ring-orange-500' : 'border-gray-200 bg-white hover:bg-gray-50 text-gray-600'}`}>
                                                <input type="radio" name="adjPaymentMethod" value={method} checked={adjPaymentMethod === method} onChange={(e) => setAdjPaymentMethod(e.target.value)} className="sr-only" />
                                                {paymentMethodLabel(method)}
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            )}
                            <div>
                                <label className="block text-sm font-medium text-gray-900 mb-1">
                                    {t("adj.reason")}
                                    {adjType === 'WAIVE_OFF' && <span className="text-red-500 ml-1">*</span>}
                                </label>
                                <input
                                    type="text"
                                    value={adjReason}
                                    onChange={(e) => setAdjReason(e.target.value)}
                                    required={adjType === 'WAIVE_OFF'}
                                    className="bg-gray-50 border border-gray-300 text-sm rounded-lg block w-full p-2.5 focus:ring-brand/40 focus:border-brand"
                                    placeholder={adjType === 'REFUND' ? t("adj.refundReasonPlaceholder") : t("adj.waiveReasonPlaceholder")}
                                />
                            </div>
                            {/* Permitted By — required for WAIVE_OFF */}
                            {adjType === 'WAIVE_OFF' && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-900 mb-1">
                                        {t("adj.permittedBy")} <span className="text-red-500">*</span>
                                        <span className="ml-1 text-xs text-gray-400 font-normal">{t("adj.searchStaff")}</span>
                                    </label>
                                    {adjPermittedByUserId ? (
                                        <div className="flex items-center gap-2 bg-purple-50 border border-purple-200 rounded-lg px-3 py-2">
                                            <svg className="w-4 h-4 text-purple-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5.121 17.804A7 7 0 1112 19a7 7 0 01-6.879-1.196" /></svg>
                                            <span className="text-sm font-medium text-purple-800 flex-1">{adjPermittedByName}</span>
                                            <button type="button" onClick={() => { setAdjPermittedByUserId(null); setAdjPermittedByName(""); setAdjPermittedBySearch(""); }} className="text-gray-400 hover:text-gray-600">
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="relative">
                                            <input
                                                type="text"
                                                value={adjPermittedBySearch}
                                                onChange={(e) => searchPermittedBy(e.target.value)}
                                                className="bg-gray-50 border border-gray-300 text-sm rounded-lg block w-full p-2.5 focus:ring-purple-500 focus:border-purple-500"
                                                placeholder={t("adj.typeName")}
                                                autoComplete="off"
                                            />
                                            {adjPermittedByResults.length > 0 && (
                                                <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                                                    {adjPermittedByResults.map((u: any) => (
                                                        <button
                                                            key={u.id}
                                                            type="button"
                                                            className="w-full text-left px-3 py-2 text-sm hover:bg-purple-50 flex items-center gap-2"
                                                            onClick={() => {
                                                                const desig = u.designation?.title;
                                                                const label = desig ? `${u.firstName} ${u.lastName} (${desig})` : `${u.firstName} ${u.lastName}`;
                                                                setAdjPermittedByUserId(u.id);
                                                                setAdjPermittedByName(label);
                                                                setAdjPermittedBySearch("");
                                                                setAdjPermittedByResults([]);
                                                            }}
                                                        >
                                                            <span className="font-medium text-slate-800">{u.firstName} {u.lastName}</span>
                                                            <span className="text-xs bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded ml-auto">
                                                                {u.designation?.title || u.role?.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())}
                                                            </span>
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                            <div className="flex gap-3 pt-2">
                                <button type="submit" disabled={submittingAdj || readOnly} title={readOnly ? READ_ONLY_TITLE : undefined} className={`flex-1 text-white py-2.5 rounded-lg font-bold transition-colors disabled:opacity-50 ${adjType === 'REFUND' ? 'bg-orange-500 hover:bg-orange-600' : 'bg-purple-600 hover:bg-purple-700'}`}>
                                    {submittingAdj ? t("adj.processing") : adjType === 'REFUND' ? t("adj.confirmRefund") : t("adj.confirmWaive")}
                                </button>
                                <button type="button" onClick={() => setAdjModalOpen(false)} className="px-5 py-2.5 bg-gray-100 text-gray-700 border border-gray-200 rounded-lg font-medium hover:bg-gray-200 transition-colors">
                                    {tc("action.cancel")}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <div className="mb-6 flex flex-col lg:flex-row lg:justify-between lg:items-center no-print gap-4">
                <div className="flex p-1 bg-slate-100 rounded-xl w-fit shadow-inner border border-slate-200/60 overflow-x-auto">
                    {/* Fee Setup tab — ADMIN+ only */}
                    {rbac.canConfigureFees && (
                        <button
                            onClick={() => setActiveTab('SETUP')}
                            className={`flex items-center whitespace-nowrap gap-2 px-5 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 ${
                                activeTab === 'SETUP'
                                    ? "bg-white text-blue-700 shadow-sm ring-1 ring-black/5"
                                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"
                            }`}
                        >
                            <Settings className="w-4 h-4" />
                            {t("tabs.setup")}
                        </button>
                    )}
                    {rbac.canConfigureFees && (
                        <button
                            onClick={() => setActiveTab('STRUCTURES')}
                            className={`flex items-center whitespace-nowrap gap-2 px-5 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 ${
                                activeTab === 'STRUCTURES'
                                    ? "bg-white text-blue-700 shadow-sm ring-1 ring-black/5"
                                    : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"
                            }`}
                        >
                            <Layers className="w-4 h-4" />
                            {t("tabs.structures")}
                        </button>
                    )}
                    <button
                        onClick={() => setActiveTab('COLLECTION')}
                        className={`flex items-center whitespace-nowrap gap-2 px-5 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 ${
                            activeTab === 'COLLECTION'
                                ? "bg-white text-blue-700 shadow-sm ring-1 ring-black/5"
                                : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"
                        }`}
                    >
                        <Wallet className="w-4 h-4" />
                        {t("tabs.collection")}
                    </button>
                    <button
                        onClick={() => setActiveTab('APPLY_DISCOUNTS')}
                        className={`flex items-center whitespace-nowrap gap-2 px-5 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 ${
                            activeTab === 'APPLY_DISCOUNTS'
                                ? "bg-white text-blue-700 shadow-sm ring-1 ring-black/5"
                                : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"
                        }`}
                    >
                        <BadgePercent className="w-4 h-4" />
                        {t("tabs.applyDiscounts")}
                    </button>
                    <button
                        onClick={() => setActiveTab('APPLY_OTHER_FEE')}
                        className={`flex items-center whitespace-nowrap gap-2 px-5 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 ${
                            activeTab === 'APPLY_OTHER_FEE'
                                ? "bg-white text-blue-700 shadow-sm ring-1 ring-black/5"
                                : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"
                        }`}
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path></svg>
                        {t("tabs.applyOtherFee")}
                    </button>
                    <button
                        onClick={() => setActiveTab('FEE_DETAILS')}
                        className={`flex items-center whitespace-nowrap gap-2 px-5 py-2.5 text-sm font-medium rounded-lg transition-all duration-200 ${
                            activeTab === 'FEE_DETAILS'
                                ? "bg-white text-blue-700 shadow-sm ring-1 ring-black/5"
                                : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/50"
                        }`}
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path></svg>
                        {t("tabs.feeDetails")}
                    </button>
                </div>
                <div className="w-full md:w-auto">
                    <Link href="/dashboard/fees/reports" className="w-full md:w-auto px-4 py-2 bg-slate-800 text-white text-sm font-medium rounded-lg hover:bg-slate-700 transition-colors shadow-sm inline-flex items-center justify-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path></svg>
                        {t("tabs.viewReports")}
                    </Link>
                </div>
            </div>

            {/* TAB: SETUP */}
            {activeTab === 'SETUP' && (
                <div className="space-y-6 no-print animate-in fade-in duration-300">
                    {/* Global Configuration */}
                    <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
                        <h2 className="text-xl font-bold mb-4 text-slate-800">{t("setup.globalConfig")}</h2>
                        <form onSubmit={handleSaveSettings} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-end">
                            <div>
                                <label className="block mb-2 text-sm font-medium text-gray-900">{t("setup.dueDay")}</label>
                                <NumberInput
                                    min={1} max={28}
                                    value={globalSettings.feeDueDate}
                                    emptyValue={15}
                                    onChange={(v) => setGlobalSettings({ ...globalSettings, feeDueDate: v ?? 15 })}
                                    className="bg-gray-50 border border-gray-300 text-sm rounded-lg block w-full p-2.5 transition-colors focus:ring-brand/40 focus:border-brand"
                                    required
                                />
                                <p className="text-xs text-gray-500 mt-1">{t("setup.dueDayHint")}</p>
                            </div>
                            <div>
                                <label className="block mb-2 text-sm font-medium text-gray-900">{t("setup.lateFeePerDay")}</label>
                                <NumberInput
                                    step="0.01"
                                    value={globalSettings.lateFeePerDay}
                                    emptyValue={0}
                                    onChange={(v) => setGlobalSettings({ ...globalSettings, lateFeePerDay: v ?? 0 })}
                                    className="bg-gray-50 border border-gray-300 text-sm rounded-lg block w-full p-2.5 transition-colors focus:ring-brand/40 focus:border-brand"
                                    required
                                />
                                <p className="text-xs text-gray-500 mt-1">{t("setup.lateFeeHint")}</p>
                            </div>
                            <div>
                                <button type="submit" disabled={savingSettings || readOnly} title={readOnly ? READ_ONLY_TITLE : undefined} className="text-white bg-green-600 hover:bg-green-700 transition-colors py-2.5 px-6 rounded text-sm w-full font-medium disabled:opacity-50">
                                    {savingSettings ? tc("action.saving") : t("setup.saveConfig")}
                                </button>
                            </div>
                        </form>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Create Category */}
                        <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
                            <h2 className="text-xl font-bold mb-4 text-slate-800">{t("setup.addCategory")}</h2>
                            <form onSubmit={handleCreateCategory}>
                                <div className="mb-4">
                                    <label className="block mb-2 text-sm font-medium text-gray-900">{t("setup.categoryName")}</label>
                                    <input type="text" value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} placeholder={t("setup.categoryNamePlaceholder")} className="bg-gray-50 border border-gray-300 text-sm rounded-lg block w-full p-2.5 transition-colors focus:ring-brand/40 focus:border-brand" required />
                                </div>
                                <div className="mb-4">
                                    <label className="block mb-2 text-sm font-medium text-gray-900">{tc("field.description")}</label>
                                    <input type="text" value={newCategoryDesc} onChange={(e) => setNewCategoryDesc(e.target.value)} className="bg-gray-50 border border-gray-300 text-sm rounded-lg block w-full p-2.5 transition-colors focus:ring-brand/40 focus:border-brand" />
                                </div>
                                <div className="mb-4">
                                    <label className="block mb-2 text-sm font-medium text-gray-900">{tc("field.type")}</label>
                                    <select value={newCategoryType} onChange={(e) => setNewCategoryType(e.target.value)} className="bg-gray-50 border border-gray-300 text-sm rounded-lg block w-full p-2.5 transition-colors focus:ring-brand/40 focus:border-brand" required>
                                        <option value="REGULAR">{t("setup.typeRegular")}</option>
                                        <option value="ADD_ON">{t("setup.typeAddOn")}</option>
                                    </select>
                                </div>
                                <button type="submit" disabled={readOnly} title={readOnly ? READ_ONLY_TITLE : undefined} className="text-white bg-indigo-600 hover:bg-indigo-700 transition-colors py-2 px-4 rounded text-sm w-full font-medium disabled:opacity-50 disabled:cursor-not-allowed">{t("setup.createCategory")}</button>
                            </form>

                            {/* Category Edit Modal */}
                            {editingCategory && (
                                <div className="fixed inset-0 z-60 flex items-center justify-center bg-walnut-950/55 backdrop-blur-sm">
                                    <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md animate-in zoom-in-95 duration-200">
                                        <h3 className="text-lg font-bold mb-4 text-slate-800">{t("setup.editCategory")}</h3>
                                        <form onSubmit={handleUpdateCategory}>
                                            <div className="mb-4">
                                                <label className="block mb-2 text-sm font-medium text-gray-900">{t("setup.categoryName")}</label>
                                                <input
                                                    type="text"
                                                    value={editCategoryName}
                                                    onChange={(e) => setEditCategoryName(e.target.value)}
                                                    className="bg-gray-50 border border-gray-300 text-sm rounded-lg block w-full p-2.5 transition-colors focus:ring-brand/40 focus:border-brand"
                                                    required
                                                />
                                            </div>
                                            <div className="mb-4">
                                                <label className="block mb-2 text-sm font-medium text-gray-900">{tc("field.description")}</label>
                                                <input
                                                    type="text"
                                                    value={editCategoryDesc}
                                                    onChange={(e) => setEditCategoryDesc(e.target.value)}
                                                    className="bg-gray-50 border border-gray-300 text-sm rounded-lg block w-full p-2.5 transition-colors focus:ring-brand/40 focus:border-brand"
                                                />
                                            </div>
                                            <div className="mb-6">
                                                <label className="block mb-2 text-sm font-medium text-gray-900">{tc("field.type")}</label>
                                                <select
                                                    value={editCategoryType}
                                                    onChange={(e) => setEditCategoryType(e.target.value)}
                                                    className="bg-gray-50 border border-gray-300 text-sm rounded-lg block w-full p-2.5 transition-colors focus:ring-brand/40 focus:border-brand"
                                                    required
                                                >
                                                    <option value="REGULAR">{t("setup.typeRegular")}</option>
                                                    <option value="ADD_ON">{t("setup.typeAddOn")}</option>
                                                </select>
                                            </div>
                                            <div className="flex gap-3 justify-end">
                                                <button
                                                    type="button"
                                                    onClick={() => setEditingCategory(null)}
                                                    className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                                                >
                                                    {tc("action.cancel")}
                                                </button>
                                                <button
                                                    type="submit"
                                                    disabled={readOnly}
                                                    title={readOnly ? READ_ONLY_TITLE : undefined}
                                                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                    {t("setup.saveChanges")}
                                                </button>
                                            </div>
                                        </form>
                                    </div>
                                </div>
                            )}

                            <h3 className="text-sm font-bold mt-6 mb-2 text-slate-800">{t("setup.existingCategories")}</h3>
                            <div className="relative border border-gray-200 rounded-lg max-h-100">
                                <table className="w-full text-sm text-left text-gray-500">
                                    <thead className="text-xs text-gray-700 uppercase bg-gray-50 sticky top-0 z-10">
                                        <tr>
                                            <th className="px-4 py-2">{tc("field.name")}</th>
                                            <th className="px-4 py-2">{tc("field.type")}</th>
                                            <th className="px-4 py-2">{tc("field.status")}</th>
                                            <th className="px-4 py-2 text-right">{tc("action.actions")}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {categories.map(c => (
                                            <tr key={c.id} className={`bg-white border-b hover:bg-gray-50 ${c.isActive === false ? 'opacity-60' : ''}`}>
                                                <td className="px-4 py-3 font-medium text-gray-900">
                                                    {c.name}
                                                    {c.description && <p className="text-xs text-gray-500 font-normal mt-0.5">{c.description}</p>}
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className={`px-2 py-1 rounded text-xs font-semibold ${c.type === 'ADD_ON' ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'}`}>
                                                        {c.type === 'ADD_ON' ? t("setup.addOn") : t("setup.regular")}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <span className={`px-2 py-1 rounded text-xs font-semibold ${c.isActive !== false ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                                        {c.isActive !== false ? tc("status.active") : tc("status.inactive")}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    <div className="relative inline-block text-left">
                                                        <button
                                                            type="button"
                                                            onClick={(e) => handleDropdownClick(e, `cat-${c.id}`)}
                                                            className="action-dropdown-btn text-gray-500 hover:text-gray-700 p-1 rounded hover:bg-gray-100 focus:outline-none"
                                                        >
                                                            <svg className="w-5 h-5 pointer-events-none" fill="currentColor" viewBox="0 0 20 20"><path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z"></path></svg>
                                                        </button>
                                                        {openDropdownId === `cat-${c.id}` && (
                                                            <div
                                                                className="action-dropdown-menu fixed w-32 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-9999 border border-gray-100"
                                                                style={{ top: dropdownPosition.top, left: dropdownPosition.left }}
                                                            >
                                                                <div className="py-1">
                                                                    <button type="button" onClick={(e) => { e.stopPropagation(); setEditingCategory(c); setEditCategoryName(c.name); setEditCategoryDesc(c.description || ""); setEditCategoryType(c.type || "REGULAR"); setOpenDropdownId(null); }} className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">{tc("action.edit")}</button>
                                                                    <button type="button" onClick={(e) => { e.stopPropagation(); handleToggleCategoryStatus(c.id, c.isActive !== false); setOpenDropdownId(null); }} className={`block w-full text-left px-4 py-2 text-sm ${c.isActive !== false ? 'text-orange-600' : 'text-green-600'} hover:bg-gray-100`}>
                                                                        {c.isActive !== false ? t("setup.deactivate") : t("setup.activate")}
                                                                    </button>
                                                                    <button type="button" onClick={(e) => { e.stopPropagation(); handleDeleteCategory(c.id); setOpenDropdownId(null); }} className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100">{tc("action.delete")}</button>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                        {categories.length === 0 && <tr><td colSpan={4} className="px-4 py-4 text-center">{t("setup.noCategories")}</td></tr>}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Assign Structure */}
                        <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
                            <h2 className="text-xl font-bold mb-4 text-slate-800">{t("setup.assignStructure")}</h2>
                            <form onSubmit={handleCreateStructure}>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                                    <div>
                                        <label className="block mb-2 text-sm font-medium text-gray-900">{tc("field.class")}</label>
                                        <select value={formClassId} onChange={(e) => setFormClassId(e.target.value)} className="bg-gray-50 border border-gray-300 text-sm rounded-lg block w-full p-2.5 transition-colors focus:ring-brand/40 focus:border-brand" required>
                                            <option value="">{t("setup.select")}</option>
                                            {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block mb-2 text-sm font-medium text-gray-900">{t("setup.category")}</label>
                                        <select value={formCategoryId} onChange={(e) => setFormCategoryId(e.target.value)} className="bg-gray-50 border border-gray-300 text-sm rounded-lg block w-full p-2.5 transition-colors focus:ring-brand/40 focus:border-brand" required>
                                            <option value="">{t("setup.select")}</option>
                                            {regularCategories.filter(c => c.isActive !== false).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                        </select>
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
                                    <div>
                                        <label className="block mb-2 text-sm font-medium text-gray-900">{t("adj.amount")}</label>
                                        <input type="number" step="0.01" value={formAmount} onChange={(e) => setFormAmount(e.target.value)} className="bg-gray-50 border border-gray-300 text-sm rounded-lg block w-full p-2.5 transition-colors focus:ring-brand/40 focus:border-brand" required />
                                    </div>
                                    <div>
                                        <label className="block mb-2 text-sm font-medium text-gray-900">{t("setup.frequency")}</label>
                                        <select value={formFrequency} onChange={(e) => setFormFrequency(e.target.value)} className="bg-gray-50 border border-gray-300 text-sm rounded-lg block w-full p-2.5 transition-colors focus:ring-brand/40 focus:border-brand" required>
                                            <option value="MONTHLY">{t("frequency.MONTHLY")}</option>
                                            <option value="ONE_TIME">{t("frequency.ONE_TIME")}</option>
                                            <option value="ANNUALLY">{t("frequency.ANNUALLY")}</option>
                                            <option value="QUARTERLY">{t("frequency.QUARTERLY")}</option>
                                            <option value="HALF_YEARLY">{t("frequency.HALF_YEARLY")}</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block mb-2 text-sm font-medium text-gray-900">{tc("field.academicYear")}</label>
                                        <select value={formAcademicYear} onChange={(e) => setFormAcademicYear(e.target.value)} className="bg-gray-50 border border-gray-300 text-sm rounded-lg block w-full p-2.5 transition-colors focus:ring-brand/40 focus:border-brand" required>
                                            <option value="">{t("setup.selectYear")}</option>
                                            {sessions.map((s: any) => <option key={s.id} value={s.name}>{s.name} {s.isActive ? t("setup.current") : ''}</option>)}
                                        </select>
                                    </div>
                                </div>

                                {/* Applicable Discounts checklist */}
                                {discounts.filter(d => d.isActive !== false).length > 0 && (
                                    <div className="mb-4">
                                        <label className="block mb-1 text-sm font-medium text-gray-900">
                                            {t("setup.applicableDiscounts")}
                                            <span className="ml-2 text-xs font-normal text-gray-500">{t("setup.applicableDiscountsHint")}</span>
                                        </label>
                                        <div className="border border-gray-200 rounded-lg p-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                                            {discounts.filter(d => d.isActive !== false).map(d => (
                                                <label key={d.id} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
                                                    <input
                                                        type="checkbox"
                                                        className="rounded border-gray-300 text-indigo-600 focus:ring-brand/40"
                                                        checked={formApplicableDiscountIds.includes(d.id)}
                                                        onChange={(e) => {
                                                            setFormApplicableDiscountIds(prev =>
                                                                e.target.checked ? [...prev, d.id] : prev.filter(x => x !== d.id)
                                                            );
                                                        }}
                                                    />
                                                    <span className="font-medium">{d.name}</span>
                                                    <span className="text-xs text-gray-400">({d.type === 'PERCENTAGE' ? `${d.value}%` : `₹${d.value}`})</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Late fee toggle */}
                                <div className="mb-4">
                                    <label className="flex items-center gap-3 cursor-pointer select-none">
                                        <input
                                            type="checkbox"
                                            className="rounded border-gray-300 text-indigo-600 focus:ring-brand/40"
                                            checked={formIsLateFeeApplicable}
                                            onChange={(e) => setFormIsLateFeeApplicable(e.target.checked)}
                                        />
                                        <span className="text-sm font-medium text-gray-900">{t("setup.applyLateFee")}</span>
                                        <span className="text-xs text-gray-500">{t("setup.applyLateFeeHint")}</span>
                                    </label>
                                </div>

                                <button type="submit" disabled={readOnly} title={readOnly ? READ_ONLY_TITLE : undefined} className="text-white bg-indigo-600 hover:bg-indigo-700 transition-colors py-2 px-4 rounded text-sm w-full font-medium disabled:opacity-50 disabled:cursor-not-allowed">{t("setup.defineStructure")}</button>
                            </form>
                        </div>
                    </div>

                    {/* Manage Discounts */}
                    <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
                        <h2 className="text-xl font-bold mb-4 text-slate-800">{t("setup.manageDiscounts")}</h2>
                        <form onSubmit={handleCreateDiscount} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 items-end mb-6">
                            <div className="col-span-2">
                                <label className="block mb-2 text-sm font-medium text-gray-900">{t("setup.discountName")}</label>
                                <input type="text" value={newDiscountName} onChange={(e) => setNewDiscountName(e.target.value)} placeholder={t("setup.discountNamePlaceholder")} className="bg-gray-50 border border-gray-300 text-sm rounded-lg block w-full p-2.5 transition-colors focus:ring-brand/40 focus:border-brand" required />
                            </div>
                            <div className="col-span-1">
                                <label className="block mb-2 text-sm font-medium text-gray-900">{t("setup.valueType")}</label>
                                <select value={newDiscountType} onChange={(e) => setNewDiscountType(e.target.value)} className="bg-gray-50 border border-gray-300 text-sm rounded-lg block w-full p-2.5 transition-colors focus:ring-brand/40 focus:border-brand" required>
                                    <option value="FLAT">{t("setup.flatAmount")}</option>
                                    <option value="PERCENTAGE">{t("setup.percentage")}</option>
                                </select>
                            </div>
                            <div className="col-span-1">
                                <label className="block mb-2 text-sm font-medium text-gray-900">{t("setup.value")}</label>
                                <input type="number" step="0.01" value={newDiscountValue} onChange={(e) => setNewDiscountValue(e.target.value)} className="bg-gray-50 border border-gray-300 text-sm rounded-lg block w-full p-2.5 transition-colors focus:ring-brand/40 focus:border-brand" required />
                            </div>
                            <div className="col-span-1">
                                <label className="block mb-2 text-sm font-medium text-gray-900">{t("setup.application")}</label>
                                <select value={newDiscountAppType} onChange={(e) => setNewDiscountAppType(e.target.value)} className="bg-gray-50 border border-gray-300 text-sm rounded-lg block w-full p-2.5 transition-colors focus:ring-brand/40 focus:border-brand" required>
                                    <option value="MANUAL">{t("setup.manual")}</option>
                                    <option value="AUTO">{t("setup.auto")}</option>
                                </select>
                            </div>
                            {newDiscountAppType === 'AUTO' && (
                                <div className="col-span-1">
                                    <label className="block mb-2 text-sm font-medium text-gray-900">{t("setup.logicRef")}</label>
                                    <select value={newDiscountLogicRef} onChange={(e) => setNewDiscountLogicRef(e.target.value)} className="bg-gray-50 border border-gray-300 text-sm rounded-lg block w-full p-2.5 transition-colors focus:ring-brand/40 focus:border-brand">
                                        <option value="">{t("setup.none")}</option>
                                        <option value="SIBLING">{t("setup.logic.SIBLING")}</option>
                                        <option value="GIRL">{t("setup.logic.GIRL")}</option>
                                        <option value="EWS">{t("setup.logic.EWS")}</option>
                                    </select>
                                </div>
                            )}
                            <div className="col-span-6 md:col-span-1">
                                <button type="submit" disabled={readOnly} title={readOnly ? READ_ONLY_TITLE : undefined} className="text-white bg-indigo-600 hover:bg-indigo-700 transition-colors py-2.5 px-6 rounded text-sm w-full font-medium disabled:opacity-50 disabled:cursor-not-allowed">{tc("action.create")}</button>
                            </div>
                        </form>

                        {/* Edit Discount Modal */}
                        {editingDiscount && (
                            <div className="fixed inset-0 z-60 flex items-center justify-center bg-walnut-950/55 backdrop-blur-sm">
                                <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-2xl animate-in zoom-in-95 duration-200">
                                    <h3 className="text-lg font-bold mb-4 text-slate-800">{t("setup.editDiscount")}</h3>
                                    <form onSubmit={handleUpdateDiscount}>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                            <div>
                                                <label className="block mb-2 text-sm font-medium text-gray-900">{t("setup.discountName")}</label>
                                                <input type="text" value={editDiscountName} onChange={(e) => setEditDiscountName(e.target.value)} className="bg-gray-50 border border-gray-300 text-sm rounded-lg block w-full p-2.5" required />
                                            </div>
                                            <div>
                                                <label className="block mb-2 text-sm font-medium text-gray-900">{t("setup.valueType")}</label>
                                                <select value={editDiscountType} onChange={(e) => setEditDiscountType(e.target.value)} className="bg-gray-50 border border-gray-300 text-sm rounded-lg block w-full p-2.5" required>
                                                    <option value="FLAT">{t("setup.flatAmount")}</option>
                                                    <option value="PERCENTAGE">{t("setup.percentage")}</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block mb-2 text-sm font-medium text-gray-900">{t("setup.value")}</label>
                                                <input type="number" step="0.01" value={editDiscountValue} onChange={(e) => setEditDiscountValue(e.target.value)} className="bg-gray-50 border border-gray-300 text-sm rounded-lg block w-full p-2.5" required />
                                            </div>
                                            <div>
                                                <label className="block mb-2 text-sm font-medium text-gray-900">{t("setup.application")}</label>
                                                <select value={editDiscountAppType} onChange={(e) => setEditDiscountAppType(e.target.value)} className="bg-gray-50 border border-gray-300 text-sm rounded-lg block w-full p-2.5" required>
                                                    <option value="MANUAL">{t("setup.manual")}</option>
                                                    <option value="AUTO">{t("setup.auto")}</option>
                                                </select>
                                            </div>
                                            {editDiscountAppType === 'AUTO' && (
                                                <div>
                                                    <label className="block mb-2 text-sm font-medium text-gray-900">{t("setup.logicRef")}</label>
                                                    <select value={editDiscountLogicRef} onChange={(e) => setEditDiscountLogicRef(e.target.value)} className="bg-gray-50 border border-gray-300 text-sm rounded-lg block w-full p-2.5">
                                                        <option value="">{t("setup.none")}</option>
                                                        <option value="SIBLING">{t("setup.logic.SIBLING")}</option>
                                                        <option value="GIRL">{t("setup.logic.GIRL")}</option>
                                                        <option value="EWS">{t("setup.logic.EWS")}</option>
                                                    </select>
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex gap-3 justify-end mt-6">
                                            <button type="button" onClick={() => setEditingDiscount(null)} className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">{tc("action.cancel")}</button>
                                            <button type="submit" disabled={readOnly} title={readOnly ? READ_ONLY_TITLE : undefined} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed">{t("setup.saveChanges")}</button>
                                        </div>
                                    </form>
                                </div>
                            </div>
                        )}

                        <div className="relative border border-gray-200 rounded-lg">
                            <table className="w-full text-sm text-left text-gray-500">
                                <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-3">{t("setup.discountName")}</th>
                                        <th className="px-6 py-3">{tc("field.type")}</th>
                                        <th className="px-6 py-3">{t("setup.value")}</th>
                                        <th className="px-6 py-3">{tc("field.status")}</th>
                                        <th className="px-6 py-3">{t("setup.autoMenu")}</th>
                                        <th className="px-6 py-3">{tc("action.actions")}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {discounts.map(d => (
                                        <tr key={d.id} className={`bg-white border-b hover:bg-gray-50 ${d.isActive === false ? 'opacity-60' : ''}`}>
                                            <td className="px-6 py-4 font-medium text-gray-900">{d.name}</td>
                                            <td className="px-6 py-4">{d.type === 'PERCENTAGE' ? t("setup.percentage") : d.type === 'FLAT' ? t("setup.flatAmount") : d.type}</td>
                                            <td className="px-6 py-4">{d.type === 'PERCENTAGE' ? `${d.value}%` : `₹${d.value}`}</td>
                                            <td className="px-6 py-4">
                                                <span className={`px-2 py-1 rounded text-xs font-semibold ${d.isActive !== false ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                                    {d.isActive !== false ? tc("status.active") : tc("status.inactive")}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`px-2 py-1 rounded text-xs font-semibold ${d.applicationType === 'AUTO' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'}`}>
                                                    {(d.applicationType || 'MANUAL') === 'AUTO' ? t("setup.auto") : (d.applicationType || 'MANUAL') === 'MANUAL' ? t("setup.manual") : d.applicationType}
                                                </span>
                                                {d.applicationType === 'AUTO' && <p className="text-xs text-gray-500 mt-1">{t("setup.ref", { ref: d.logicReference })}</p>}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="relative inline-block text-left">
                                                    <button
                                                        type="button"
                                                        onClick={(e) => handleDropdownClick(e, `disc-${d.id}`)}
                                                        className="action-dropdown-btn text-gray-500 hover:text-gray-700 p-1 rounded hover:bg-gray-100 focus:outline-none"
                                                    >
                                                        <svg className="w-5 h-5 pointer-events-none" fill="currentColor" viewBox="0 0 20 20"><path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z"></path></svg>
                                                    </button>
                                                    {openDropdownId === `disc-${d.id}` && (
                                                        <div
                                                            className="action-dropdown-menu fixed w-32 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-9999 border border-gray-100"
                                                            style={{ top: dropdownPosition.top, left: dropdownPosition.left }}
                                                        >
                                                            <div className="py-1">
                                                                <button type="button" onClick={(e) => { e.stopPropagation(); setEditingDiscount(d); setEditDiscountName(d.name); setEditDiscountType(d.type); setEditDiscountValue(d.value.toString()); setEditDiscountAppType(d.applicationType); setEditDiscountLogicRef(d.logicReference || ""); setOpenDropdownId(null); }} className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">{tc("action.edit")}</button>
                                                                <button type="button" onClick={(e) => { e.stopPropagation(); handleToggleDiscountStatus(d.id, d.isActive !== false); setOpenDropdownId(null); }} className={`block w-full text-left px-4 py-2 text-sm ${d.isActive !== false ? 'text-orange-600' : 'text-green-600'} hover:bg-gray-100`}>
                                                                    {d.isActive !== false ? t("setup.deactivate") : t("setup.activate")}
                                                                </button>
                                                                <button type="button" onClick={(e) => { e.stopPropagation(); handleDeleteDiscount(d.id); setOpenDropdownId(null); }} className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100">{tc("action.delete")}</button>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    {discounts.length === 0 && (
                                        <tr><td colSpan={6} className="px-6 py-4 text-center">{t("setup.noDiscounts")}</td></tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* TAB: STRUCTURES */}
            {activeTab === 'STRUCTURES' && (
                <div className="space-y-6 no-print animate-in fade-in duration-300">
                    <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold text-slate-800">{t("structures.title")}</h2>
                            <div className="w-64">
                                <select
                                    value={structureSearchClassId}
                                    onChange={(e) => setStructureSearchClassId(e.target.value)}
                                    className="bg-gray-50 border border-gray-300 text-sm rounded-lg block w-full p-2.5 transition-colors focus:ring-brand/40 focus:border-brand"
                                >
                                    <option value="">{t("structures.filterClass")}</option>
                                    {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left text-gray-500">
                                <thead className="text-xs text-gray-700 uppercase bg-gray-50 border-b">
                                    <tr>
                                        <th scope="col" className="px-6 py-3">{tc("field.class")}</th>
                                        <th scope="col" className="px-6 py-3">{t("setup.category")}</th>
                                        <th scope="col" className="px-6 py-3">{t("adj.amount")}</th>
                                        <th scope="col" className="px-6 py-3">{t("setup.frequency")}</th>
                                        <th scope="col" className="px-6 py-3">{tc("field.academicYear")}</th>
                                        <th scope="col" className="px-6 py-3">{t("setup.applicableDiscounts")}</th>
                                        <th scope="col" className="px-6 py-3 text-right">{tc("action.actions")}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {structures
                                        .filter(s => !structureSearchClassId || s.class.id.toString() === structureSearchClassId)
                                        .map(s => (
                                            <tr key={s.id} className="bg-white border-b hover:bg-gray-50">
                                                <td className="px-6 py-4 font-medium text-gray-900">{s.class.name}</td>
                                                <td className="px-6 py-4">{s.feeCategory.name}</td>
                                                <td className="px-6 py-4">₹{s.amount}</td>
                                                <td className="px-6 py-4">{frequencyLabel(s.frequency || 'MONTHLY')}</td>
                                                <td className="px-6 py-4">{s.academicYear}</td>
                                                <td className="px-6 py-4">
                                                    {s.applicableDiscounts && s.applicableDiscounts.length > 0 ? (
                                                        <div className="flex flex-wrap gap-1">
                                                            {s.applicableDiscounts.map((d: any) => (
                                                                <span key={d.id} className="px-2 py-0.5 bg-indigo-100 text-indigo-800 text-xs font-medium rounded-full">{d.name}</span>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs font-medium rounded-full">{t("structures.noDiscounts")}</span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <div className="relative inline-block text-left">
                                                        <button
                                                            type="button"
                                                            onClick={(e) => handleDropdownClick(e, `struct-${s.id}`)}
                                                            className="action-dropdown-btn text-gray-500 hover:text-gray-700 p-1 rounded hover:bg-gray-100 focus:outline-none"
                                                        >
                                                            <svg className="w-5 h-5 pointer-events-none" fill="currentColor" viewBox="0 0 20 20"><path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z"></path></svg>
                                                        </button>
                                                        {openDropdownId === `struct-${s.id}` && (
                                                            <div
                                                                className="action-dropdown-menu fixed w-32 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-9999 border border-gray-100"
                                                                style={{ top: dropdownPosition.top, left: dropdownPosition.left }}
                                                            >
                                                                <div className="py-1">
                                                                    <button type="button" onClick={(e) => { e.stopPropagation(); setEditingStructure(s); setEditAmount(s.amount.toString()); setEditFrequency(s.frequency || 'MONTHLY'); setEditYear(s.academicYear); setEditApplicableDiscountIds((s.applicableDiscounts || []).map((d: any) => d.id)); setEditIsLateFeeApplicable(s.isLateFeeApplicable !== false); setOpenDropdownId(null); }} className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">{tc("action.edit")}</button>
                                                                    <button type="button" onClick={(e) => { e.stopPropagation(); handleDeleteStructure(s.id); setOpenDropdownId(null); }} className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100">{tc("action.delete")}</button>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    }
                                </tbody>
                            </table>
                            {structures.filter(s => !structureSearchClassId || s.class.id.toString() === structureSearchClassId).length === 0 && (
                                <div className="text-center py-8 text-gray-500">{t("structures.empty")}</div>
                            )}
                        </div>
                    </div>

                    {/* Edit Modal */}
                    {editingStructure && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center bg-walnut-950/55 backdrop-blur-sm">
                            <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md animate-in zoom-in-95 duration-200">
                                <h3 className="text-lg font-bold mb-4 text-slate-800">{t("structures.edit")}</h3>
                                <p className="text-sm text-gray-600 mb-4">
                                    {t.rich("structures.updating", {
                                        category: editingStructure.feeCategory.name,
                                        class: editingStructure.class.name,
                                        b: (chunks) => <span className="font-semibold">{chunks}</span>,
                                    })}
                                </p>
                                <form onSubmit={handleUpdateStructure}>
                                    <div className="mb-4">
                                        <label className="block mb-2 text-sm font-medium text-gray-900">{t("adj.amount")}</label>
                                        <input
                                            type="number" step="0.01"
                                            value={editAmount}
                                            onChange={(e) => setEditAmount(e.target.value)}
                                            className="bg-gray-50 border border-gray-300 text-sm rounded-lg block w-full p-2.5 transition-colors focus:ring-brand/40 focus:border-brand"
                                            required
                                        />
                                    </div>
                                    <div className="mb-4">
                                        <label className="block mb-2 text-sm font-medium text-gray-900">{t("setup.frequency")}</label>
                                        <select
                                            value={editFrequency}
                                            onChange={(e) => setEditFrequency(e.target.value)}
                                            className="bg-gray-50 border border-gray-300 text-sm rounded-lg block w-full p-2.5 transition-colors focus:ring-brand/40 focus:border-brand"
                                            required
                                        >
                                            <option value="MONTHLY">{t("frequency.MONTHLY")}</option>
                                            <option value="ONE_TIME">{t("frequency.ONE_TIME")}</option>
                                            <option value="ANNUALLY">{t("frequency.ANNUALLY")}</option>
                                            <option value="QUARTERLY">{t("frequency.QUARTERLY")}</option>
                                            <option value="HALF_YEARLY">{t("frequency.HALF_YEARLY")}</option>
                                        </select>
                                    </div>
                                    <div className="mb-6">
                                        <label className="block mb-2 text-sm font-medium text-gray-900">{tc("field.academicYear")}</label>
                                        <select
                                            value={editYear}
                                            onChange={(e) => setEditYear(e.target.value)}
                                            className="bg-gray-50 border border-gray-300 text-sm rounded-lg block w-full p-2.5 transition-colors focus:ring-brand/40 focus:border-brand"
                                            required
                                        >
                                            <option value="">{t("setup.selectYear")}</option>
                                            {sessions.map((s: any) => <option key={s.id} value={s.name}>{s.name} {s.isActive ? t("setup.current") : ''}</option>)}
                                        </select>
                                    </div>

                                    {/* Applicable Discounts checklist */}
                                    {discounts.filter(d => d.isActive !== false).length > 0 && (
                                        <div className="mb-6">
                                            <label className="block mb-1 text-sm font-medium text-gray-900">
                                                {t("setup.applicableDiscounts")}
                                                <span className="ml-2 text-xs font-normal text-gray-500">{t("structures.uncheckAllHint")}</span>
                                            </label>
                                            <div className="border border-gray-200 rounded-lg p-3 grid grid-cols-2 gap-2">
                                                {discounts.filter(d => d.isActive !== false).map(d => (
                                                    <label key={d.id} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
                                                        <input
                                                            type="checkbox"
                                                            className="rounded border-gray-300 text-indigo-600 focus:ring-brand/40"
                                                            checked={editApplicableDiscountIds.includes(d.id)}
                                                            onChange={(e) => {
                                                                setEditApplicableDiscountIds(prev =>
                                                                    e.target.checked ? [...prev, d.id] : prev.filter(x => x !== d.id)
                                                                );
                                                            }}
                                                        />
                                                        <span className="font-medium">{d.name}</span>
                                                        <span className="text-xs text-gray-400">({d.type === 'PERCENTAGE' ? `${d.value}%` : `₹${d.value}`})</span>
                                                    </label>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    {/* Late fee toggle */}
                                    <div className="mb-6">
                                        <label className="flex items-center gap-3 cursor-pointer select-none">
                                            <input
                                                type="checkbox"
                                                className="rounded border-gray-300 text-indigo-600 focus:ring-brand/40"
                                                checked={editIsLateFeeApplicable}
                                                onChange={(e) => setEditIsLateFeeApplicable(e.target.checked)}
                                            />
                                            <span className="text-sm font-medium text-gray-900">{t("setup.applyLateFee")}</span>
                                            <span className="text-xs text-gray-500">{t("setup.applyLateFeeHint")}</span>
                                        </label>
                                    </div>
                                    <div className="flex gap-3 justify-end">
                                        <button
                                            type="button"
                                            onClick={() => setEditingStructure(null)}
                                            className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                                        >
                                            {tc("action.cancel")}
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={readOnly}
                                            title={readOnly ? READ_ONLY_TITLE : undefined}
                                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            {t("setup.saveChanges")}
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* TAB: COLLECTION */}
            {activeTab === 'COLLECTION' && (
                <div className="no-print animate-in fade-in duration-300">
                    <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200 mb-6 relative z-20">
                        <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
                            <div className="w-full md:w-1/2">
                                <label className="block mb-2 text-sm font-medium text-gray-900">{t("collection.searchLabel")}</label>
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => {
                                        setSearchQuery(e.target.value);
                                        if (selectedStudentId) setSelectedStudentId(""); // Clear selection if typing
                                    }}
                                    placeholder={t("collection.searchPlaceholder")}
                                    className="bg-gray-50 border border-gray-300 text-sm rounded-lg block w-full p-3 transition-colors focus:ring-brand/40 focus:border-brand shadow-sm"
                                />

                                {/* Search Results Dropdown */}
                                {searchQuery && !selectedStudentId && (
                                    <ul className="absolute z-30 mt-1 w-full md:w-1/2 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                                        {isSearchingCollection ? (
                                            <li className="px-4 py-3 text-sm text-gray-500">{t("collection.searching")}</li>
                                        ) : collectionSearchResults.length > 0 ? (
                                            collectionSearchResults.map(s => {
                                                const enr = s.enrollments?.find((e: any) => e.status === 'ACTIVE') || s.enrollments?.[0];
                                                const classNameStr = enr?.class?.name || s.class?.name;
                                                const sectionNameStr = enr?.section?.name || s.section?.name;
                                                const classSection = [classNameStr, sectionNameStr].filter(Boolean).join(' - ');
                                                const rollNo = enr?.rollNo;
                                                const line2 = [s.admissionNumber ? t("collection.admNo", { number: s.admissionNumber }) : null, classSection || null, rollNo ? t("collection.roll", { roll: rollNo }) : null].filter(Boolean).join(' · ');
                                                const parents = [s.fathersName, s.mothersName].filter(Boolean).join(' / ');
                                                const line3 = [parents || null, s.mobile || null].filter(Boolean).join(' · ');
                                                return (
                                                    <li
                                                        key={s.id}
                                                        onClick={() => handleSelectStudent(s)}
                                                        className="px-4 py-3 hover:bg-blue-50 cursor-pointer border-b border-gray-50 last:border-0 transition-colors"
                                                    >
                                                        <div className="font-medium text-gray-900">{s.firstName} {s.lastName}</div>
                                                        {line2 && <div className="text-xs text-gray-500">{line2}</div>}
                                                        {line3 && <div className="text-xs text-gray-400">{line3}</div>}
                                                    </li>
                                                );
                                            })
                                        ) : (
                                            <li className="px-4 py-3 text-sm text-gray-500">{t("collection.noMatch")}</li>
                                        )}
                                    </ul>
                                )}
                            </div>

                            {/* Top Right: Collection Year Setting */}
                            <div className="w-full md:w-1/4">
                                <label className="block mb-2 text-sm font-bold text-amber-700">{t("collection.yearFilter")}</label>
                                <select
                                    value={collectionYear}
                                    onChange={(e) => setCollectionYear(e.target.value)}
                                    className="bg-amber-50 border border-amber-300 text-amber-900 text-sm font-semibold rounded-lg block w-full p-2.5 transition-colors focus:ring-amber-500 focus:border-amber-500 shadow-sm"
                                >
                                    {sessions.map(s => (
                                        <option key={s.id} value={s.name}>{s.name} {s.isActive ? t("setup.current") : ''}</option>
                                    ))}
                                </select>
                                <p className="text-xs text-amber-600 mt-1">{t("collection.yearFilterHint")}</p>
                            </div>
                        </div>
                    </div>

                    {selectedStudentId && (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in slide-in-from-bottom-2 duration-300 relative z-10">
                            {/* Left: Fee Period Grid */}
                            <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
                                <h2 className="text-xl font-bold mb-4 text-slate-800">{t("collection.overview")}</h2>
                                {loadingCollection && <div className="text-sm text-gray-500 animate-pulse">{t("collection.loadingFees")}</div>}
                                {!loadingCollection && !studentFeeDetails && <div className="text-sm text-gray-500 p-4 bg-gray-50 rounded-lg border border-gray-100 flex items-center justify-center h-32">{t("collection.selectStudent")}</div>}

                                {studentFeeDetails && (
                                    <div className="space-y-4">
                                        {/* One-Time & Annual Fees (outside the monthly calendar) */}
                                        {studentFeeDetails.oneTimeFees && (() => {
                                            const ot = studentFeeDetails.oneTimeFees;
                                            const isOTSelected = selectedMonths.includes(ot.monthKey);
                                            const canPayOT = ot.outstanding > 0;
                                            // hasHistory: payments OR adjustments (e.g. waive-off records) exist
                                            const hasHistory = (ot.payments?.length > 0) || (ot.adjustments?.length > 0);
                                            return (
                                                <div>
                                                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">{t("collection.oneTimeFees")}</p>
                                                    <div
                                                        onClick={() => {
                                                            if (canPayOT) {
                                                                // Outstanding > 0: toggle selection for payment form.
                                                                // Card-face buttons handle receipt/waive-off access.
                                                                setSelectedMonths(prev =>
                                                                    isOTSelected
                                                                        ? prev.filter(m => m !== ot.monthKey)
                                                                        : [...prev, ot.monthKey]
                                                                );
                                                            } else if (isOTSelected) {
                                                                // No outstanding but still selected (e.g. waived off after selecting):
                                                                // allow deselect by clicking the card
                                                                setSelectedMonths(prev => prev.filter(m => m !== ot.monthKey));
                                                            } else if (hasHistory) {
                                                                // Fully paid / waived (outstanding = 0): open history modal.
                                                                // Works even when payments[] is empty but adjustments[] has waive-off records.
                                                                setPaymentHistoryData({
                                                                    monthKey: ot.monthKey,
                                                                    label: ot.label,
                                                                    totalDue: ot.totalDue,
                                                                    totalPaid: ot.totalPaid,
                                                                    outstanding: ot.outstanding,
                                                                    excess: ot.excess ?? 0,
                                                                    status: ot.status,
                                                                    payments: ot.payments || [],
                                                                    adjustments: ot.adjustments || [],
                                                                });
                                                            }
                                                        }}
                                                        className={`p-4 border rounded-lg transition-all relative overflow-hidden ${canPayOT || hasHistory ? 'cursor-pointer hover:shadow-md' : 'opacity-75'} ${
                                                            isOTSelected ? 'ring-2 ring-blue-500 border-blue-500 bg-blue-50 scale-[1.01] shadow-md' :
                                                            ot.status === 'PAID' ? 'border-green-200 bg-green-50' :
                                                            ot.status === 'PARTIAL' ? 'border-yellow-200 bg-yellow-50' :
                                                            'border-purple-200 bg-purple-50'
                                                        }`}
                                                    >
                                                        <div className="flex items-start gap-1 mb-2">
                                                            <span className="font-bold text-slate-800 text-sm flex-1 min-w-0">{ot.label}</span>
                                                            <div className="flex items-center gap-1 shrink-0">
                                                                {hasHistory && (
                                                                    <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path></svg>
                                                                )}
                                                                <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded whitespace-nowrap ${ot.status === 'PAID' ? 'bg-green-100 text-green-800' : ot.status === 'PARTIAL' ? 'bg-yellow-100 text-yellow-800' : 'bg-purple-100 text-purple-800'}`}>
                                                                    {feeStatusLabel(ot.status)}
                                                                </span>
                                                            </div>
                                                        </div>
                                                        <div className="space-y-1 text-xs text-slate-600">
                                                            {(ot.categoryBreakdown || []).map((c: any, ci: number) => (
                                                                <div key={ci} className="flex justify-between text-slate-500">
                                                                    <span className="truncate pr-2">{c.categoryName}:</span>
                                                                    <span>₹{c.amount}</span>
                                                                </div>
                                                            ))}
                                                            {ot.discount > 0 && <div className="flex justify-between text-green-600"><span>{t("collection.disc")}</span><span>-₹{Number(ot.discount).toFixed(2)}</span></div>}
                                                            {ot.totalPaid > 0 && (
                                                                <div className="flex justify-between text-green-700 font-medium">
                                                                    <span>{t("collection.paid")}</span>
                                                                    <span>₹{Number(ot.totalPaid).toFixed(2)}</span>
                                                                </div>
                                                            )}
                                                            <div className={`border-t border-slate-200 pt-1 mt-1 font-semibold leading-snug ${ot.outstanding > 0 ? 'text-red-600' : 'text-green-600'}`}>
                                                                <span className="block text-[10px] font-medium opacity-80">{ot.outstanding > 0 ? t("collection.balanceDue") : t("collection.balance")}</span>
                                                                <span className="block">₹{Number(ot.outstanding).toLocaleString(intl, { minimumFractionDigits: 2 })}</span>
                                                            </div>
                                                        </div>
                                                        {/* ── PARTIAL card action buttons (matching monthly fees behaviour) ── */}
                                                        {ot.status === 'PARTIAL' && (
                                                            <div className="mt-2 grid grid-cols-2 gap-1" onClick={e => e.stopPropagation()}>
                                                                {/* View Receipt — opens ReceiptModal if payment exists, else history modal */}
                                                                {hasHistory && (
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            const latestOTPayment = (ot.payments || []).at(-1);
                                                                            const s = students.find((st: any) => st.id.toString() === selectedStudentId);
                                                                            const lastOTAdj = (ot.adjustments || []).at(-1);
                                                                            setReceiptData({
                                                                                receiptNumber: latestOTPayment?.receiptNumber,
                                                                                paymentDate: latestOTPayment?.paymentDate ?? lastOTAdj?.adjustedAt,
                                                                                amountPaid: latestOTPayment ? latestOTPayment.amountPaid : 0,
                                                                                paymentMethod: latestOTPayment?.paymentMethod ?? 'Fee Adjustment',
                                                                                studentName: `${s?.firstName} ${s?.lastName}`,
                                                                                studentClass: s?.class?.name || null,
                                                                                studentSection: s?.section?.name || null,
                                                                                feeCategory: ot.label,
                                                                                academicYear: collectionYear,
                                                                                monthsPaid: ot.label,
                                                                                totalBaseFee: latestOTPayment?.baseFeeAmount || 0,
                                                                                totalLateFee: latestOTPayment?.otherFeeAmount || 0,
                                                                                components: latestOTPayment?.components ?? [],
                                                                                appliedDiscounts: latestOTPayment?.feeBreakdown?.discounts || (latestOTPayment?.discountAmount > 0 ? [{ name: 'Discount', amount: latestOTPayment.discountAmount }] : []),
                                                                                categoryBreakdown: latestOTPayment?.feeBreakdown?.categories || [],
                                                                                totalPayable: ot.totalDue ?? null,
                                                                                balanceAfterPayment: ot.outstanding,
                                                                                excess: ot.excess ?? 0,
                                                                                monthKey: ot.monthKey,
                                                                                adjustments: ot.adjustments ?? [],
                                                                                collectedByName: latestOTPayment?.collectedByName || null,
                                                                                gatewayPaymentId: latestOTPayment?.gatewayPaymentId || null,
                                                                                gatewayOrderId: latestOTPayment?.gatewayOrderId || null,
                                                                            });
                                                                        }}
                                                                        className="col-span-2 text-[10px] text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded px-2 py-1 text-center transition-colors flex items-center justify-center gap-1"
                                                                    >
                                                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path></svg>
                                                                        {t("history.viewReceipt")}
                                                                    </button>
                                                                )}
                                                                {/* Collect Remaining */}
                                                                {canPayOT && (
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            setSelectedMonths(prev =>
                                                                                prev.includes(ot.monthKey) ? prev : [...prev, ot.monthKey]
                                                                            );
                                                                        }}
                                                                        className="text-[10px] text-green-700 bg-green-50 hover:bg-green-100 border border-green-200 rounded px-2 py-1 text-center transition-colors"
                                                                    >
                                                                        {t("collection.collectAmount", { amount: Number(ot.outstanding).toFixed(0) })}
                                                                    </button>
                                                                )}
                                                                {/* Waive Off — admin only */}
                                                                {rbac.isAdmin && canPayOT && (
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            openAdjModal(ot.monthKey, 'WAIVE_OFF');
                                                                        }}
                                                                        className="text-[10px] text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded px-2 py-1 text-center transition-colors"
                                                                    >
                                                                        {t("collection.waiveOff")}
                                                                    </button>
                                                                )}
                                                                {/* Revert Waive Off — admin only */}
                                                                {rbac.isAdmin && (ot.adjustments || []).some((a: any) => a.type === 'WAIVE_OFF') && (() => {
                                                                    const otWaiveOffs = (ot.adjustments || []).filter((a: any) => a.type === 'WAIVE_OFF');
                                                                    return (
                                                                        <button
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                handleRevertWaiveOff(otWaiveOffs[otWaiveOffs.length - 1].id);
                                                                            }}
                                                                            className="col-span-2 text-[10px] text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded px-2 py-1 text-center transition-colors"
                                                                        >
                                                                            {t("collection.revertLastWaive")}
                                                                        </button>
                                                                    );
                                                                })()}
                                                            </div>
                                                        )}
                                                        {/* OT PAID: admin revert waive-off for fully waived one-time fees */}
                                                        {rbac.isAdmin && ot.status === 'PAID' && (ot.adjustments || []).some((a: any) => a.type === 'WAIVE_OFF') && (() => {
                                                            const otWaiveOffs = (ot.adjustments || []).filter((a: any) => a.type === 'WAIVE_OFF');
                                                            return (
                                                                <div className="mt-2" onClick={e => e.stopPropagation()}>
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            handleRevertWaiveOff(otWaiveOffs[otWaiveOffs.length - 1].id);
                                                                        }}
                                                                        className="w-full text-[10px] text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded px-2 py-1 text-center transition-colors"
                                                                    >
                                                                        {t("collection.revertLastWaive")}
                                                                    </button>
                                                                </div>
                                                            );
                                                        })()}
                                                        {isOTSelected && (
                                                            <div className="absolute -top-2 -right-2 bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center shadow-sm">
                                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })()}
                                        {/* Monthly Fee Calendar */}
                                        <div>
                                            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">{t("collection.monthlyFees")}</p>
                                            <div className="grid grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-3">
                                        {(studentFeeDetails.feePeriods ?? studentFeeDetails.monthlyBreakdown).map((period: any) => {
                                            // Support both feePeriods objects and legacy monthlyBreakdown objects
                                            const isLegacy = !period.months;
                                            const periodMonths: string[] = isLegacy ? [period.monthKey] : period.months;
                                            const outstanding = isLegacy ? period.outstanding : (period.adjustedOutstanding ?? period.rawOutstanding ?? period.outstanding);
                                            const excess: number = period.excess ?? 0;
                                            const periodKey = isLegacy ? period.monthKey : period.periodKey;
                                            const label = isLegacy ? period.monthName : period.periodLabel;
                                            const status = period.status;
                                            const isSelected = periodMonths.every(mk => selectedMonths.includes(mk));
                                            const isPartiallySelected = !isSelected && periodMonths.some(mk => selectedMonths.includes(mk));
                                            const canPay = outstanding > 0;
                                            const previousBalance: number = 0; // carry-forward removed
                                            const periodSize: number = isLegacy ? 1 : (period.periodSize ?? 1);
                                            // Payments and adjustments sourced from monthlyBreakdown
                                            const periodPayments = periodMonths.flatMap((mk: string) => {
                                                const mb = studentFeeDetails.monthlyBreakdown?.find((m: any) => m.monthKey === mk);
                                                return mb?.payments ?? [];
                                            });
                                            const periodAdjustments = periodMonths.flatMap((mk: string) => {
                                                const mb = studentFeeDetails.monthlyBreakdown?.find((m: any) => m.monthKey === mk);
                                                return mb?.adjustments ?? [];
                                            });
                                            const hasPeriodHistory = periodPayments.length > 0 || periodAdjustments.length > 0;
                                            const periodWaiveOffs = periodAdjustments.filter((a: any) => a.type === 'WAIVE_OFF');

                                            return (
                                                <div
                                                    key={periodKey}
                                                    onClick={() => {
                                                        if (canPay) {
                                                            // Any card with outstanding (PARTIAL, PENDING, OVERDUE) →
                                                            // toggle selection. The card-face buttons handle receipt/modal access.
                                                            if (isSelected) {
                                                                setSelectedMonths(prev => prev.filter(m => !periodMonths.includes(m)));
                                                            } else {
                                                                setSelectedMonths(prev => {
                                                                    const next = [...prev];
                                                                    for (const mk of periodMonths) {
                                                                        if (!next.includes(mk)) next.push(mk);
                                                                    }
                                                                    return next;
                                                                });
                                                            }
                                                        } else if (isSelected) {
                                                            // Deselect — box was selected before waive-off completed (outstanding now 0)
                                                            setSelectedMonths(prev => prev.filter(m => !periodMonths.includes(m)));
                                                        } else if (status === 'PAID') {
                                                            // Fully paid or fully waived → open history / details modal
                                                            const allPayments = periodMonths.flatMap((mk: string) => {
                                                                const mb = studentFeeDetails.monthlyBreakdown.find((m: any) => m.monthKey === mk);
                                                                return mb?.payments ?? [];
                                                            });
                                                            const allAdjustments = periodMonths.flatMap((mk: string) => {
                                                                const mb = studentFeeDetails.monthlyBreakdown.find((m: any) => m.monthKey === mk);
                                                                return mb?.adjustments ?? [];
                                                            });
                                                            if (allPayments.length > 0 || allAdjustments.length > 0) {
                                                                setPaymentHistoryData({
                                                                    monthKey: periodMonths[0],
                                                                    months: periodMonths,
                                                                    label,
                                                                    totalDue: period.totalDue,
                                                                    totalPaid: period.totalPaid,
                                                                    outstanding: 0,
                                                                    excess: period.excess ?? 0,
                                                                    status,
                                                                    payments: allPayments,
                                                                    adjustments: allAdjustments,
                                                                });
                                                            }
                                                        }
                                                    }}
                                                    className={`p-3 border rounded-lg transition-all relative overflow-hidden ${canPay || status === 'PAID' || status === 'PARTIAL' ? 'cursor-pointer hover:shadow-md' : 'opacity-75 bg-slate-50'
                                                        } ${isSelected ? 'ring-2 ring-blue-500 border-blue-500 bg-blue-50 scale-[1.02] shadow-md z-10' :
                                                            isPartiallySelected ? 'ring-1 ring-blue-300 border-blue-300 bg-blue-50/50' :
                                                            status === 'OVERDUE' ? 'border-red-200 bg-red-50' :
                                                                status === 'PAID' ? 'border-green-200 bg-green-50' :
                                                                    status === 'PARTIAL' ? 'border-yellow-200 bg-yellow-50' :
                                                                        'border-slate-200 bg-white'
                                                        }`}
                                                >
                                                    {/* Period size badge for non-monthly periods */}
                                                    {periodSize > 1 && (
                                                        <div className="absolute -top-2 -left-2 bg-indigo-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide shadow-sm">
                                                            {periodSize === 3 ? t("collection.badgeQuarterly") : periodSize === 6 ? t("collection.badgeHalfYearly") : t("collection.badgeAnnual")}
                                                        </div>
                                                    )}
                                                    <div className="flex items-start gap-1 mb-2">
                                                        <h3 className="font-bold text-slate-800 text-sm leading-tight flex-1 min-w-0">{label}</h3>
                                                        <div className="flex items-center gap-1 shrink-0">
                                                            {(status === 'PAID' || status === 'PARTIAL') && period.payments?.length > 0 && (
                                                                <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path></svg>
                                                            )}
                                                            <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded whitespace-nowrap ${status === 'PAID' ? 'bg-green-100 text-green-800' :
                                                                status === 'OVERDUE' ? 'bg-red-100 text-red-800' :
                                                                    status === 'PARTIAL' ? 'bg-yellow-100 text-yellow-800' :
                                                                        'bg-slate-100 text-slate-800'
                                                                }`}>
                                                                {feeStatusLabel(status)}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <div className="space-y-1 text-xs text-slate-600">
                                                        {/* Previous credit from overpayment */}
                                                        {previousBalance > 0 && (
                                                            <div className="flex justify-between text-teal-600 font-medium">
                                                                <span>{t("collection.creditPrev")}</span>
                                                                <span>₹{previousBalance.toFixed(2)}</span>
                                                            </div>
                                                        )}
                                                        {/* Previous deficit carry-forward from underpayment */}
                                                        {previousBalance < 0 && (
                                                            <div className="flex justify-between text-orange-600 font-medium">
                                                                <span>{t("collection.prevUnpaid")}</span>
                                                                <span>+₹{Math.abs(previousBalance).toFixed(2)}</span>
                                                            </div>
                                                        )}
                                                        {(() => {
                                                            const isFullyPaid = status === 'PAID' && period.payments?.length > 0;
                                                            const pBase = isFullyPaid
                                                                ? period.payments[period.payments.length - 1].baseFeeAmount
                                                                : period.baseFee;
                                                            const pDisc = isFullyPaid
                                                                ? period.payments[period.payments.length - 1].discountAmount
                                                                : period.discount;
                                                            const pLate = isFullyPaid
                                                                ? period.payments[period.payments.length - 1].otherFeeAmount
                                                                : period.lateFee;
                                                            const categories = period.categoryBreakdown ?? [];
                                                            // totalPaid for this period (sum across months)
                                                            const periodTotalPaid = isLegacy
                                                                ? (period.totalPaid ?? 0)
                                                                : (period.totalPaid ?? 0);

                                                            return (
                                                                <>
                                                                    {categories.length > 0 ? (
                                                                        categories.map((c: any, cidx: number) => (
                                                                            <div key={cidx} className="flex justify-between text-slate-500">
                                                                                <span className="truncate pr-2">{c.categoryName}:</span>
                                                                                <span>₹{c.amount}</span>
                                                                            </div>
                                                                        ))
                                                                    ) : (
                                                                        <div className="flex justify-between"><span>{t("collection.base")}</span> <span>₹{pBase}</span></div>
                                                                    )}
                                                                    {pDisc > 0 && <div className="flex justify-between text-green-600"><span>{t("collection.disc")}</span> <span>-₹{pDisc}</span></div>}
                                                                    {pLate > 0 && <div className="flex justify-between text-red-600"><span>{t("collection.lateFee")}</span> <span>+₹{pLate}</span></div>}
                                                                    {periodTotalPaid > 0 && (
                                                                        <div className="flex justify-between text-green-700 font-medium">
                                                                            <span>{t("collection.paid")}</span>
                                                                            <span>₹{Number(periodTotalPaid).toFixed(2)}</span>
                                                                        </div>
                                                                    )}
                                                                    <div className="border-t border-slate-200 pt-1 mt-1 space-y-0.5">
                                                                        {excess > 0 && (
                                                                            <div className="flex justify-between font-semibold text-green-700">
                                                                                <span>{t("history.excessPaid")}</span>
                                                                                <span>₹{Number(excess).toFixed(2)}</span>
                                                                            </div>
                                                                        )}
                                                                        {outstanding > 0 ? (
                                                                            <div className="font-semibold text-red-600 leading-snug">
                                                                                <span className="block text-[10px] font-medium opacity-80">{t("collection.balanceDue")}</span>
                                                                                <span className="block">₹{Number(outstanding).toLocaleString(intl, { minimumFractionDigits: 2 })}</span>
                                                                            </div>
                                                                        ) : (excess === 0 && status !== 'UNPAID') ? (
                                                                            <div className="flex justify-between font-semibold text-green-600">
                                                                                <span>{t("history.balance")}</span>
                                                                                <span>₹0.00</span>
                                                                            </div>
                                                                        ) : null}
                                                                    </div>
                                                                </>
                                                            );
                                                        })()}
                                                    </div>
                                                    {/* ── PARTIAL card action buttons ── */}
                                                    {status === 'PARTIAL' && (
                                                        <div className="mt-2 grid grid-cols-2 gap-1" onClick={e => e.stopPropagation()}>
                                                            {/* View Receipt — opens ReceiptModal if payment exists, else history modal */}
                                                            {hasPeriodHistory && (
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        // Use period.payments directly (embedded in feePeriods/legacy object) as primary source
                                                                        const allPeriodPmts: any[] = period.payments?.length > 0 ? period.payments : periodPayments;
                                                                        const latestPeriodPayment = allPeriodPmts.at(-1);
                                                                        const s = students.find((st: any) => st.id.toString() === selectedStudentId);
                                                                        const lastPeriodAdj = periodAdjustments.at(-1);
                                                                        setReceiptData({
                                                                            receiptNumber: latestPeriodPayment?.receiptNumber,
                                                                            paymentDate: latestPeriodPayment?.paymentDate ?? lastPeriodAdj?.adjustedAt,
                                                                            amountPaid: latestPeriodPayment ? latestPeriodPayment.amountPaid : 0,
                                                                            paymentMethod: latestPeriodPayment?.paymentMethod ?? 'Fee Adjustment',
                                                                            studentName: `${s?.firstName} ${s?.lastName}`,
                                                                            studentClass: s?.class?.name || null,
                                                                            studentSection: s?.section?.name || null,
                                                                            feeCategory: label,
                                                                            academicYear: collectionYear,
                                                                            monthsPaid: label,
                                                                            totalBaseFee: latestPeriodPayment?.baseFeeAmount || 0,
                                                                            totalLateFee: latestPeriodPayment?.otherFeeAmount || 0,
                                                                            components: latestPeriodPayment?.components ?? [],
                                                                            appliedDiscounts: latestPeriodPayment?.feeBreakdown?.discounts || (latestPeriodPayment?.discountAmount > 0 ? [{ name: 'Discount', amount: latestPeriodPayment.discountAmount }] : []),
                                                                            categoryBreakdown: latestPeriodPayment?.feeBreakdown?.categories || [],
                                                                            totalPayable: period.totalDue ?? null,
                                                                            balanceAfterPayment: outstanding,
                                                                            excess: period.excess ?? 0,
                                                                            monthKey: periodMonths[0],
                                                                            adjustments: periodAdjustments ?? [],
                                                                            collectedByName: latestPeriodPayment?.collectedByName || null,
                                                                            gatewayPaymentId: latestPeriodPayment?.gatewayPaymentId || null,
                                                                            gatewayOrderId: latestPeriodPayment?.gatewayOrderId || null,
                                                                        });
                                                                    }}
                                                                    className="col-span-2 text-[10px] text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded px-2 py-1 text-center transition-colors flex items-center justify-center gap-1"
                                                                >
                                                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path></svg>
                                                                    {t("history.viewReceipt")}
                                                                </button>
                                                            )}
                                                            {/* Collect Remaining */}
                                                            {outstanding > 0 && (
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setSelectedMonths(prev => {
                                                                            const next = [...prev];
                                                                            for (const mk of periodMonths) {
                                                                                if (!next.includes(mk)) next.push(mk);
                                                                            }
                                                                            return next;
                                                                        });
                                                                    }}
                                                                    className="text-[10px] text-green-700 bg-green-50 hover:bg-green-100 border border-green-200 rounded px-2 py-1 text-center transition-colors"
                                                                >
                                                                    {t("collection.collectAmount", { amount: Number(outstanding).toFixed(0) })}
                                                                </button>
                                                            )}
                                                            {/* Waive Off — admin only */}
                                                            {rbac.isAdmin && outstanding > 0 && (
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        openAdjModal(periodMonths[0], 'WAIVE_OFF');
                                                                    }}
                                                                    className="text-[10px] text-purple-700 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded px-2 py-1 text-center transition-colors"
                                                                >
                                                                    {t("collection.waiveOff")}
                                                                </button>
                                                            )}
                                                            {/* Revert Waive Off — admin only, shown when prior waive-offs exist */}
                                                            {rbac.isAdmin && periodWaiveOffs.length > 0 && (
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleRevertWaiveOff(periodWaiveOffs[periodWaiveOffs.length - 1].id);
                                                                    }}
                                                                    className="col-span-2 text-[10px] text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded px-2 py-1 text-center transition-colors"
                                                                >
                                                                    {t("collection.revertLastWaive")}
                                                                </button>
                                                            )}
                                                        </div>
                                                    )}
                                                    {/* PAID card admin actions (e.g. revert waive-off on fully waived months) */}
                                                    {rbac.isAdmin && status === 'PAID' && periodWaiveOffs.length > 0 && (
                                                        <div className="mt-2" onClick={e => e.stopPropagation()}>
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleRevertWaiveOff(periodWaiveOffs[periodWaiveOffs.length - 1].id);
                                                                }}
                                                                className="w-full text-[10px] text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded px-2 py-1 text-center transition-colors"
                                                            >
                                                                {t("collection.revertLastWaive")}
                                                            </button>
                                                        </div>
                                                    )}
                                                    {/* PAID card: selected indicator */}
                                                    {canPay && status !== 'PARTIAL' && isSelected && (
                                                        <div className="mt-2 text-[10px] text-blue-600 text-center font-medium">{t("collection.selectedForPayment")}</div>
                                                    )}
                                                    {isSelected && (
                                                        <div className="absolute -top-2 -right-2 bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center shadow-sm">
                                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>
                                                        </div>
                                                    )}
                                                    {isPartiallySelected && !isSelected && (
                                                        <div className="absolute -top-2 -right-2 bg-blue-400 text-white rounded-full w-6 h-6 flex items-center justify-center shadow-sm text-[10px] font-bold">
                                                            {periodMonths.filter(mk => selectedMonths.includes(mk)).length}/{periodMonths.length}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Right: Payment Form */}
                            <div className="bg-slate-50 p-6 rounded-lg border border-slate-200 h-fit sticky top-6">
                                <h2 className="text-xl font-bold mb-4 text-slate-800">{t("collection.collectPayment")}</h2>
                                {selectedMonths.length === 0 ? (
                                    <div className="text-sm text-gray-500 italic flex flex-col h-48 items-center justify-center border-2 border-dashed border-gray-300 rounded-lg bg-white/50">
                                        <svg className="w-8 h-8 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122"></path></svg>
                                        {t("collection.selectMonthsHint")}
                                    </div>
                                ) : (
                                    <form onSubmit={handleCollectPayment} className="bg-white p-5 shadow-md border border-gray-200 rounded-lg animate-in zoom-in-95 duration-200">
                                        <div className="mb-4">
                                            <label className="block mb-2 text-sm font-medium text-gray-900">{t("collection.selectedPeriod")}</label>
                                            <div className="bg-gray-100 border border-gray-300 text-sm rounded-lg block w-full p-2.5 text-gray-600 font-medium wrap-break-word">
                                                {(() => {
                                                    const matchedPeriod = studentFeeDetails?.feePeriods?.find((fp: any) =>
                                                        fp.months?.length === selectedMonths.filter((mk: string) => studentFeeDetails.monthlyBreakdown?.some((m: any) => m.monthKey === mk)).length &&
                                                        selectedMonths.every((mk: string) => fp.months?.includes(mk))
                                                    );
                                                    if (matchedPeriod) return matchedPeriod.periodLabel;
                                                    return selectedMonths.map((mkey: string) => {
                                                        const m = studentFeeDetails.monthlyBreakdown.find((m: any) => m.monthKey === mkey);
                                                        if (m) return m.monthName;
                                                        if (studentFeeDetails.oneTimeFees?.monthKey === mkey) return studentFeeDetails.oneTimeFees.label;
                                                        return mkey;
                                                    }).join(', ');
                                                })()}
                                            </div>
                                        </div>

                                        {(() => {
                                            const totalBalance = (() => {
                                                const feePeriodsArr: any[] = studentFeeDetails.feePeriods ?? [];
                                                const countedPeriodKeys = new Set<string>();
                                                let total = 0;
                                                for (const mkey of selectedMonths) {
                                                    if (studentFeeDetails.oneTimeFees?.monthKey === mkey) {
                                                        total += Number(studentFeeDetails.oneTimeFees.outstanding) || 0;
                                                        continue;
                                                    }
                                                    const matchedPeriod = feePeriodsArr.find((p: any) =>
                                                        (p.months ?? [p.monthKey])?.includes(mkey)
                                                    );
                                                    if (matchedPeriod) {
                                                        // Only count each period once — all months in a period share the same outstanding
                                                        if (!countedPeriodKeys.has(matchedPeriod.periodKey ?? matchedPeriod.monthKey)) {
                                                            countedPeriodKeys.add(matchedPeriod.periodKey ?? matchedPeriod.monthKey);
                                                            total += Number(matchedPeriod.adjustedOutstanding) || 0;
                                                        }
                                                    } else {
                                                        const m = studentFeeDetails.monthlyBreakdown.find((m: any) => m.monthKey === mkey);
                                                        total += Number(m?.outstanding) || 0;
                                                    }
                                                }
                                                return total;
                                            })();

                                            return (
                                                <div className="mb-4">
                                                    <div className="flex justify-between items-center mb-2">
                                                        <label className="text-sm font-bold text-blue-700">{t("collection.amountPaying")}</label>
                                                        <span className="text-xs text-gray-500 font-medium">{t("collection.totalBalance", { amount: totalBalance.toFixed(2) })}</span>
                                                    </div>
                                                    <input
                                                        type="number" step="0.01"
                                                        value={payAmount}
                                                        onChange={(e) => setPayAmount(e.target.value)}
                                                        placeholder={t("collection.recommended", { amount: totalBalance.toFixed(2) })}
                                                        className="bg-blue-50 border-2 border-blue-200 rounded-lg block w-full p-2.5 focus:ring-brand/40 focus:border-brand text-lg font-bold text-blue-900 transition-colors"
                                                        required
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => setPayAmount(totalBalance.toFixed(2))}
                                                        className="mt-2 text-xs text-blue-600 hover:text-blue-800 hover:underline font-medium"
                                                    >
                                                        {t("collection.fillTotal")}
                                                    </button>
                                                </div>
                                            );
                                        })()}

                                        <div className="mb-5 text-sm font-medium">
                                            <label className="block mb-3 text-gray-900">{t("receipt.paymentMethod")}</label>
                                            <div className="grid grid-cols-3 gap-2 sm:gap-3">
                                                {PAYMENT_METHODS.map(method => (
                                                    <label key={method} className={`flex items-center justify-center p-3 border rounded-lg cursor-pointer transition-all ${payMethod === method ? 'border-blue-500 bg-blue-50 text-blue-700 ring-1 ring-blue-500' : 'border-gray-200 bg-white hover:bg-gray-50 text-gray-600'}`}>
                                                        <input type="radio" name="payMethod" value={method} checked={payMethod === method} onChange={(e) => setPayMethod(e.target.value)} className="sr-only" />
                                                        <span className="font-medium text-xs">{paymentMethodLabel(method)}</span>
                                                    </label>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="mb-6">
                                            <label className="block mb-2 text-sm font-medium text-gray-900">{t("collection.remarksRef")}</label>
                                            <input type="text" value={payRemarks} onChange={(e) => setPayRemarks(e.target.value)} className="bg-gray-50 border border-gray-300 text-sm rounded-lg block w-full p-2.5 transition-colors focus:ring-brand/40 focus:border-brand" placeholder={t("collection.optionalTxnId")} />
                                        </div>
                                        <div className="flex gap-3">
                                            <button type="submit" disabled={loadingCollection || readOnly} title={readOnly ? READ_ONLY_TITLE : undefined} className="flex-1 text-white bg-blue-600 hover:bg-blue-700 py-3 rounded-lg font-bold disabled:opacity-50 transition-colors shadow-sm">
                                                {t("collection.confirmPayment")}
                                            </button>
                                            <button type="button" onClick={() => setSelectedMonths([])} className="px-5 py-3 bg-gray-100 text-gray-700 border border-gray-200 rounded-lg font-medium hover:bg-gray-200 transition-colors">
                                                {t("collection.clearSelection")}
                                            </button>
                                        </div>
                                        {/* Issue Refund / Waive Off shortcuts */}
                                        {studentFeeDetails && (() => {
                                            const excessMonth = studentFeeDetails.monthlyBreakdown?.find((m: any) => (m.excess ?? 0) > 0) ||
                                                (( studentFeeDetails.oneTimeFees?.excess ?? 0) > 0 ? studentFeeDetails.oneTimeFees : null);
                                            const outstandingMonth = studentFeeDetails.monthlyBreakdown?.find((m: any) => (m.outstanding ?? 0) > 0) ||
                                                ((studentFeeDetails.oneTimeFees?.outstanding ?? 0) > 0 ? studentFeeDetails.oneTimeFees : null);
                                            return (
                                                <div className="mt-3 flex flex-col gap-2">
                                                    {rbac.isAdmin && excessMonth && (
                                                        <button
                                                            type="button"
                                                            onClick={() => openAdjModal(excessMonth.monthKey, 'REFUND')}
                                                            className="w-full py-2 text-sm font-medium text-orange-700 bg-orange-50 border border-orange-200 rounded-lg hover:bg-orange-100 transition-colors"
                                                        >
                                                            {t("collection.issueRefundExcess")}
                                                        </button>
                                                    )}
                                                    {rbac.isAdmin && outstandingMonth && (
                                                        <button
                                                            type="button"
                                                            onClick={() => openAdjModal(outstandingMonth.monthKey, 'WAIVE_OFF')}
                                                            className="w-full py-2 text-sm font-medium text-purple-700 bg-purple-50 border border-purple-200 rounded-lg hover:bg-purple-100 transition-colors"
                                                        >
                                                            {t("collection.waiveOffOutstanding")}
                                                        </button>
                                                    )}
                                                </div>
                                            );
                                        })()}
                                    </form>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* TAB: APPLY_DISCOUNTS, APPLY_OTHER_FEE & FEE_DETAILS */}
            {(activeTab === 'APPLY_DISCOUNTS' || activeTab === 'APPLY_OTHER_FEE' || activeTab === 'FEE_DETAILS') && (
                <div className="no-print animate-in fade-in duration-300">
                    {/* Shared Advanced Student Search */}
                    <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200 mb-6 relative z-20">
                        <h2 className="text-xl font-bold mb-4 text-slate-800">
                            {activeTab === 'APPLY_DISCOUNTS' ? t("search.titleDiscounts")
                                : activeTab === 'APPLY_OTHER_FEE' ? t("search.titleOtherFee")
                                : t("search.titleDetails")}
                        </h2>
                        <form onSubmit={handleSearchFormStudents} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-4 mb-4">
                            <input type="text" placeholder={t("search.studentId")} value={searchFormId} onChange={e => setSearchFormId(e.target.value)} className="bg-gray-50 border border-gray-300 text-sm rounded-lg block p-2.5 focus:ring-brand/40 focus:border-brand" />
                            <input type="text" placeholder={t("search.firstName")} value={searchFormFirstName} onChange={e => setSearchFormFirstName(e.target.value)} className="bg-gray-50 border border-gray-300 text-sm rounded-lg block p-2.5 focus:ring-brand/40 focus:border-brand" />
                            <input type="text" placeholder={t("search.lastName")} value={searchFormLastName} onChange={e => setSearchFormLastName(e.target.value)} className="bg-gray-50 border border-gray-300 text-sm rounded-lg block p-2.5 focus:ring-brand/40 focus:border-brand" />
                            <input type="text" placeholder={tc("field.mobile")} value={searchFormMobile} onChange={e => setSearchFormMobile(e.target.value)} className="bg-gray-50 border border-gray-300 text-sm rounded-lg block p-2.5 focus:ring-brand/40 focus:border-brand" />
                            
                            <select value={searchFormClassId} onChange={e => setSearchFormClassId(e.target.value)} className="bg-gray-50 border border-gray-300 text-sm rounded-lg block p-2.5 focus:ring-brand/40 focus:border-brand">
                                <option value="">{t("search.classAll")}</option>
                                {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                            <select value={searchFormSectionId} onChange={e => setSearchFormSectionId(e.target.value)} disabled={!searchFormClassId} className="bg-gray-50 border border-gray-300 text-sm rounded-lg block p-2.5 focus:ring-brand/40 focus:border-brand">
                                <option value="">{t("search.sectionAll")}</option>
                                {searchFormSections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>
                            <select value={searchFormSessionId} onChange={e => setSearchFormSessionId(e.target.value)} className="bg-gray-50 border border-gray-300 text-sm rounded-lg block p-2.5 focus:ring-brand/40 focus:border-brand">
                                <option value="">{t("search.sessionAll")}</option>
                                {sessions.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                            </select>

                            <div className="lg:col-span-7 flex justify-end gap-2">
                                <button type="button" onClick={() => { setSearchFormId(""); setSearchFormFirstName(""); setSearchFormLastName(""); setSearchFormMobile(""); setSearchFormClassId(""); setSearchFormSectionId(""); setSearchFormSessionId(""); setHasSearchFormSearched(false); setSearchFormStudentsList([]); }} className="text-gray-700 bg-white border border-gray-300 font-medium rounded-lg text-sm px-4 py-2 hover:bg-gray-50 transition-colors">{tc("action.clear")}</button>
                                <button type="submit" disabled={isSearchingStudents} className="text-white bg-blue-600 font-medium rounded-lg text-sm px-6 py-2 hover:bg-blue-700 transition-colors disabled:opacity-50">
                                    {isSearchingStudents ? t("collection.searching") : tc("action.search")}
                                </button>
                            </div>
                        </form>

                        {hasSearchFormSearched && (<>
                            <div className="overflow-x-auto border border-gray-200 rounded-lg max-h-64 mt-4">
                                <table className="w-full text-sm text-left text-gray-500 relative">
                                    <thead className="text-xs text-gray-700 uppercase bg-gray-50 sticky top-0 z-10 shadow-sm">
                                        <tr>
                                            <th className="px-4 py-3">{t("search.id")}</th>
                                            <th className="px-4 py-3">{tc("field.name")}</th>
                                            <th className="px-4 py-3">{t("search.classSection")}</th>
                                            <th className="px-4 py-3">{tc("field.mobile")}</th>
                                            <th className="px-4 py-3 text-right">{t("search.action")}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {searchFormStudentsList.length > 0 ? (
                                            searchFormStudentsList.map((s: any) => {
                                                const enr = s.enrollments?.find((e: any) => e.status === 'ACTIVE') || s.enrollments?.[0];
                                                const classNameStr = enr?.class?.name || s.class?.name || t("search.na");
                                                const sectionNameStr = enr?.section?.name || s.section?.name || t("search.na");
                                                const mobile = s.user?.mobile || s.mobile || t("search.na");
                                                return (
                                                    <tr key={s.id} className="bg-white border-b hover:bg-slate-50 last:border-0 transition-colors">
                                                        <td className="px-4 py-3 font-medium text-gray-900">{s.id}</td>
                                                        <td className="px-4 py-3">{s.firstName} {s.lastName}</td>
                                                        <td className="px-4 py-3">{classNameStr} - {sectionNameStr}</td>
                                                        <td className="px-4 py-3">{mobile}</td>
                                                        <td className="px-4 py-3 text-right">
                                                            <button
                                                                onClick={() => {
                                                                    if (activeTab === 'APPLY_DISCOUNTS') {
                                                                        setApplyDiscountStudentId(s.id.toString());
                                                                        setApplyDiscountStudentClassId(enr?.class?.id?.toString() || s.class?.id?.toString() || "");
                                                                        setSelectedDiscountsToApply(
                                                                            s.studentDiscounts
                                                                                ? s.studentDiscounts.filter((sd: any) => sd.isActive).map((sd: any) => sd.discountCategory?.id || sd.discountCategoryId)
                                                                                : []
                                                                        );
                                                                    } else if (activeTab === 'APPLY_OTHER_FEE') {
                                                                        setApplyOtherFeeStudentId(s.id.toString());
                                                                        setApplyOtherFeeStudentName(`${s.firstName} ${s.lastName}`);
                                                                    } else {
                                                                        // FEE_DETAILS
                                                                        handleLoadFeeDetails(s.id.toString(), `${s.firstName} ${s.lastName}`);
                                                                    }
                                                                    setTimeout(() => {
                                                                        window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
                                                                    }, 100);
                                                                }}
                                                                className="text-xs px-3 py-1.5 bg-blue-50 text-blue-700 font-semibold rounded hover:bg-blue-100 transition-colors border border-blue-100"
                                                            >
                                                                {activeTab === 'FEE_DETAILS' ? t("search.viewDetails") : t("setup.select")}
                                                            </button>
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        ) : (
                                            <tr>
                                                <td colSpan={5} className="px-4 py-6 text-center text-gray-500">
                                                    {isSearchingStudents ? tc("state.loading") : t("search.noMatch")}
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                            {/* Pagination Controls */}
                            {searchFormTotal > SEARCH_PAGE_SIZE && (
                                <div className="flex items-center justify-between mt-3 px-1">
                                    <p className="text-xs text-gray-500">
                                        {t("search.showing", { from: (searchFormPage - 1) * SEARCH_PAGE_SIZE + 1, to: Math.min(searchFormPage * SEARCH_PAGE_SIZE, searchFormTotal), total: searchFormTotal })}
                                    </p>
                                    <div className="flex gap-1">
                                        <button
                                            disabled={searchFormPage <= 1 || isSearchingStudents}
                                            onClick={(e) => handleSearchFormStudents(e as any, searchFormPage - 1)}
                                            className="px-3 py-1 text-xs border rounded hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                                        >{t("search.prev")}</button>
                                        <span className="px-3 py-1 text-xs bg-blue-50 text-blue-700 border border-blue-200 rounded font-semibold">
                                            {searchFormPage} / {Math.ceil(searchFormTotal / SEARCH_PAGE_SIZE)}
                                        </span>
                                        <button
                                            disabled={searchFormPage >= Math.ceil(searchFormTotal / SEARCH_PAGE_SIZE) || isSearchingStudents}
                                            onClick={(e) => handleSearchFormStudents(e as any, searchFormPage + 1)}
                                            className="px-3 py-1 text-xs border rounded hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                                        >{t("search.next")}</button>
                                    </div>
                                </div>
                            )}
                        </>)}
                    </div>

                    {/* APPLY_DISCOUNTS specific content */}
                    {activeTab === 'APPLY_DISCOUNTS' && applyDiscountStudentId && (
                        <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200 animate-in slide-in-from-bottom-2 duration-300 relative z-10 w-full md:w-2/3">
                            <h2 className="text-xl font-bold mb-4 text-slate-800">{t("discounts.title")}</h2>
                            <p className="text-sm text-gray-600 mb-6">{t("discounts.intro")}</p>

                            <form onSubmit={async (e) => {
                                e.preventDefault();
                                if (readOnly) return;
                                setApplyingDiscounts(true);
                                try {
                                    const res = await authFetch(`${API_BASE_URL}/students/${applyDiscountStudentId}`, {
                                        method: 'PATCH',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ discountIds: selectedDiscountsToApply })
                                    });
                                    if (res.ok) {
                                        toast.success(t("toast.discountsApplied"));
                                        // Refresh student query
                                        handleSearchFormStudents(e); 
                                    } else {
                                        throw new Error("Failed to apply discounts");
                                    }
                                } catch (err) {
                                    toast.error(t("toast.applyDiscountsError"));
                                } finally {
                                    setApplyingDiscounts(false);
                                }
                            }}>
                                <div className="space-y-4 mb-6 max-h-96 overflow-y-auto p-4 border rounded-lg bg-slate-50">
                                    {discounts.length === 0 ? (
                                        <div className="text-sm text-gray-500">{t("discounts.none")}</div>
                                    ) : (
                                        discounts.map(d => {
                                            const isSelected = selectedDiscountsToApply.includes(d.id);
                                            // Fee structures whitelist which discounts they honor (empty = none).
                                            // Warn when this discount isn't enabled on any structure of the
                                            // student's class — assigning it would not reduce the balance.
                                            const isWhitelisted = !applyDiscountStudentClassId || structures.some(st =>
                                                st.class?.id?.toString() === applyDiscountStudentClassId &&
                                                (st.applicableDiscounts || []).some((ad: any) => ad.id === d.id)
                                            );
                                            return (
                                                <div key={`d-select-${d.id}`}
                                                    onClick={() => {
                                                        setSelectedDiscountsToApply(prev =>
                                                            prev.includes(d.id) ? prev.filter(id => id !== d.id) : [...prev, d.id]
                                                        );
                                                    }}
                                                    className={`cursor-pointer flex items-center p-4 rounded-lg border transition-all ${isSelected ? 'bg-blue-50 border-blue-400 shadow-sm' : 'bg-white border-gray-200 hover:border-blue-300'
                                                        }`}
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={isSelected}
                                                        onChange={() => { }}
                                                        className="w-5 h-5 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-brand/40"
                                                    />
                                                    <div className="ml-4 flex-1">
                                                        <span className="block text-sm font-semibold text-gray-900">{d.name}</span>
                                                        <span className="block text-xs text-gray-500 mt-0.5">
                                                            {d.type === 'PERCENTAGE' ? t("discounts.percentOff", { value: d.value }) : t("discounts.flatOff", { value: d.value })}
                                                            {d.applicationType === 'AUTO' && <span className="ml-2 inline-block px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 text-[10px] font-bold">{t("discounts.autoRef", { ref: d.logicReference })}</span>}
                                                        </span>
                                                        {isSelected && !isWhitelisted && (
                                                            <span className="block text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1 mt-2">
                                                                {t("discounts.notEnabled")}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>

                                <div className="flex justify-end pt-4 border-t">
                                    <button
                                        type="submit"
                                        disabled={applyingDiscounts || readOnly}
                                        title={readOnly ? READ_ONLY_TITLE : undefined}
                                        className="text-white bg-blue-600 hover:bg-blue-700 focus:ring-4 focus:ring-brand/40 font-medium rounded-lg text-sm px-6 py-2.5 transition-colors disabled:opacity-50"
                                    >
                                        {applyingDiscounts ? tc("action.saving") : t("discounts.save")}
                                    </button>
                                </div>
                            </form>
                        </div>
                    )}

                    {/* APPLY_OTHER_FEE specific content */}
                    {activeTab === 'APPLY_OTHER_FEE' && applyOtherFeeStudentId && (
                        <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200 animate-in slide-in-from-bottom-2 duration-300 relative z-10 w-full">
                            <h2 className="text-xl font-bold mb-4 text-slate-800">{t("otherFee.title")}</h2>
                            <p className="text-sm text-gray-600 mb-6">{t.rich("otherFee.intro", { name: applyOtherFeeStudentName, id: applyOtherFeeStudentId, b: (chunks) => <span className="font-semibold text-blue-700">{chunks}</span> })}</p>

                            <form onSubmit={handleApplyOtherFeeSubmit}>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                    <div>
                                        <label className="block mb-2 text-sm font-medium text-gray-900">{t("otherFee.category")}</label>
                                        <select
                                            value={applyOtherFeeCategoryId}
                                            onChange={(e) => setApplyOtherFeeCategoryId(e.target.value)}
                                            required
                                            className="bg-gray-50 border border-gray-300 text-sm rounded-lg block w-full p-2.5 focus:ring-brand/40 focus:border-brand"
                                        >
                                            <option value="">{t("otherFee.selectCategory")}</option>
                                            {addOnCategories.filter(c => c.isActive !== false).map(c => (
                                                <option key={c.id} value={c.id}>{c.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block mb-2 text-sm font-medium text-gray-900">{t("adj.amount")}</label>
                                        <input
                                            type="number" step="0.01" min="0" required
                                            value={applyOtherFeeAmount}
                                            onChange={(e) => setApplyOtherFeeAmount(e.target.value)}
                                            placeholder={t("otherFee.amountPlaceholder")}
                                            className="bg-gray-50 border border-gray-300 text-sm rounded-lg block w-full p-2.5 focus:ring-brand/40 focus:border-brand"
                                        />
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                                    <div>
                                        <label className="block mb-2 text-sm font-medium text-gray-900">{t("setup.frequency")}</label>
                                        <select
                                            value={applyOtherFeeFrequency}
                                            onChange={(e) => setApplyOtherFeeFrequency(e.target.value)}
                                            required
                                            className="bg-gray-50 border border-gray-300 text-sm rounded-lg block w-full p-2.5 focus:ring-brand/40 focus:border-brand"
                                        >
                                            <option value="MONTHLY">{t("frequency.MONTHLY")}</option>
                                            <option value="QUARTERLY">{t("frequency.QUARTERLY")}</option>
                                            <option value="HALF_YEARLY">{t("frequency.HALF_YEARLY")}</option>
                                            <option value="ANNUALLY">{t("frequency.ANNUALLY")}</option>
                                            <option value="ONE_TIME">{t("frequency.ONE_TIME")}</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block mb-2 text-sm font-medium text-gray-900">{t("otherFee.remarks")}</label>
                                        <input
                                            type="text"
                                            value={applyOtherFeeDescription}
                                            onChange={(e) => setApplyOtherFeeDescription(e.target.value)}
                                            placeholder={t("otherFee.remarksPlaceholder")}
                                            className="bg-gray-50 border border-gray-300 text-sm rounded-lg block w-full p-2.5 focus:ring-brand/40 focus:border-brand"
                                        />
                                    </div>
                                </div>

                                <div className="flex justify-end pt-4 border-t">
                                    <button
                                        type="submit"
                                        disabled={applyingOtherFee || readOnly}
                                        title={readOnly ? READ_ONLY_TITLE : undefined}
                                        className="text-white bg-blue-600 hover:bg-blue-700 focus:ring-4 focus:ring-brand/40 font-medium rounded-lg text-sm px-6 py-2.5 transition-colors disabled:opacity-50"
                                    >
                                        {applyingOtherFee ? t("otherFee.applying") : t("otherFee.apply")}
                                    </button>
                                </div>
                            </form>
                        </div>
                    )}
                </div>
            )}

            {/* FEE_DETAILS — Detail Panel (rendered below the shared search when a student is selected) */}
            {activeTab === 'FEE_DETAILS' && feeDetailsStudentId && (
                <div className="no-print mt-4 animate-in slide-in-from-bottom-2 duration-300">
                    {loadingFeeDetails ? (
                        <div className="bg-white p-8 rounded-lg shadow-sm border border-slate-200 text-center">
                            <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-3"></div>
                            <p className="text-gray-500 text-sm">{t("details.loading", { name: feeDetailsStudentName })}</p>
                        </div>
                    ) : (() => {
                            // 1. Core Summary Calculations
                            const annualLiability = (feeDetailsFull.monthlyBreakdown?.reduce((acc: number, m: any) => acc + (m.totalDue || 0), 0) || 0) + (feeDetailsFull.oneTimeFees?.totalDue || 0);
                            const amountPaid = (feeDetailsFull.monthlyBreakdown?.reduce((acc: number, m: any) => acc + (m.totalPaid || 0), 0) || 0) + (feeDetailsFull.oneTimeFees?.totalPaid || 0);
                            const balanceDue = annualLiability - amountPaid;
                            const pendingMonthsCount = feeDetailsFull.monthlyBreakdown?.filter((m: any) => m.outstanding > 0 || m.status === 'OVERDUE').length || 0;
                            
                            // 2. Representative Monthly Recurring (The standard expected bill)
                            // We look for the first billing month with a baseFee > 0 and use its netFee (Core + Optional - Discounts)
                            const recurringMonth = feeDetailsFull.monthlyBreakdown?.find((m: any) => m.baseFee > 0);
                            const monthlyRecurring = recurringMonth?.netFee || 0;

                            return (
                                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                    {/* Premium Profile Header - Glassmorphism style */}
                                    <div className="relative overflow-hidden bg-slate-900 rounded-2xl shadow-xl border border-slate-800 p-8">
                                        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-600/20 rounded-full blur-3xl -mr-20 -mt-20"></div>
                                        <div className="absolute bottom-0 left-0 w-48 h-48 bg-indigo-600/10 rounded-full blur-3xl -ml-20 -mb-20"></div>
                                        
                                        <div className="relative flex flex-col md:flex-row items-center gap-6">
                                            <div className="w-24 h-24 rounded-2xl bg-linear-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-3xl font-bold text-white shadow-lg border border-blue-400/30">
                                                {feeDetailsStudentName.split(' ').map(n => n[0]).join('')}
                                            </div>
                                            <div className="text-center md:text-left flex-1">
                                                <div className="flex items-center justify-center md:justify-start gap-2 mb-1">
                                                    <span className="px-2 py-0.5 bg-blue-500/10 text-blue-400 text-[10px] font-bold uppercase tracking-widest rounded-full border border-blue-500/20">{t("details.profile")}</span>
                                                    <span className="px-2 py-0.5 bg-green-500/10 text-green-400 text-[10px] font-bold uppercase tracking-widest rounded-full border border-green-500/20">{tc("status.active")}</span>
                                                </div>
                                                <h3 className="text-3xl font-black text-white tracking-tight">{feeDetailsStudentName}</h3>
                                                <div className="flex items-center justify-center md:justify-start gap-4 mt-2 text-slate-400 text-sm">
                                                    <span className="flex items-center gap-1.5 font-medium">
                                                        <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>
                                                        {t.rich("details.id", { id: feeDetailsStudentId, v: (chunks) => <span className="text-slate-200">{chunks}</span> })}
                                                    </span>
                                                    <span className="flex items-center gap-1.5 font-medium">
                                                        <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                                                        {t.rich("details.session", { session: collectionYear, v: (chunks) => <span className="text-slate-200">{chunks}</span> })}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="mt-4 md:mt-0 flex flex-col items-center md:items-end">
                                                <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-1">{t("details.totalBalanceDue")}</p>
                                                <p className="text-4xl font-black text-white drop-shadow-sm">
                                                    ₹{Number(balanceDue).toLocaleString(intl)}
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Stats Grid - 4 Columns */}
                                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                        {[
                                            { 
                                                label: t("details.annualLiability"), 
                                                value: annualLiability, 
                                                icon: "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m.599-1c.532-.1 1.01-.304 1.43-.591m-1.43.591c-1.01 0-2.08-.402-2.599-1M9.401 13c-.532.1-1.01.304-1.43.591m1.43-.591c.532.1 1.01.304 1.43.591", 
                                                color: "blue" 
                                            },
                                            { 
                                                label: t("details.amountPaid"), 
                                                value: amountPaid, 
                                                icon: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z", 
                                                color: "green" 
                                            },
                                            { 
                                                label: t("details.monthlyRecurring"), 
                                                value: monthlyRecurring,
                                                icon: "M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15", 
                                                color: "indigo" 
                                            },
                                            { 
                                                label: t("details.pendingMonths"), 
                                                value: pendingMonthsCount,
                                                isCurrency: false,
                                                icon: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z", 
                                                color: "orange" 
                                            }
                                        ].map((stat, i) => (
                                            <div key={i} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all duration-300">
                                                <div className={`w-8 h-8 rounded-lg ${stat.color === 'blue' ? 'bg-blue-50' : stat.color === 'green' ? 'bg-green-50' : stat.color === 'orange' ? 'bg-orange-50' : 'bg-indigo-50'} flex items-center justify-center mb-3`}>
                                                    <svg className={`w-4 h-4 ${stat.color === 'blue' ? 'text-blue-600' : stat.color === 'green' ? 'text-green-600' : stat.color === 'orange' ? 'text-orange-600' : 'text-indigo-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={stat.icon}></path></svg>
                                                </div>
                                                <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">{stat.label}</p>
                                                <p className="text-xl font-black text-slate-900 mt-0.5">
                                                    {stat.isCurrency === false ? stat.value : `₹${Number(stat.value || 0).toLocaleString(intl)}`}
                                                </p>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                        {/* 1. Standard Fees (From Class Structure) */}
                                        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                                            <div className="px-5 py-4 border-b border-slate-50 flex items-center justify-between">
                                                <h4 className="font-bold text-slate-800 flex items-center gap-2">
                                                    <div className="w-1.5 h-1.5 bg-blue-600 rounded-full"></div>
                                                    {t("details.standardFees")}
                                                </h4>
                                                <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">{t("details.recurring")}</span>
                                            </div>
                                            <div className="p-5">
                                                {!feeDetailsFull ? (
                                                    <p className="text-sm text-gray-400 italic">{t("details.finding")}</p>
                                                ) : (
                                                    <div className="space-y-4">
                                                        <ul className="space-y-3">
                                                            {(feeDetailsFull.monthlyBreakdown?.find((m: any) => m.categoryBreakdown?.length > 0) || feeDetailsFull.monthlyBreakdown?.[0])?.categoryBreakdown?.map((cat: any, idx: number) => (
                                                                <li key={`std-${idx}`} className="flex justify-between items-center group">
                                                                    <div className="flex items-center gap-3">
                                                                        <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                                                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path></svg>
                                                                        </div>
                                                                        <div>
                                                                            <span className="text-sm font-semibold text-slate-700">{cat.categoryName}</span>
                                                                            <span className="text-[10px] text-slate-400 block uppercase tracking-tight leading-none mt-0.5">{cat.frequency ? frequencyLabel(cat.frequency) : cat.frequency}</span>
                                                                        </div>
                                                                    </div>
                                                                    <span className="text-sm font-black text-slate-900 bg-slate-50 px-3 py-1 rounded-lg">₹{Number(cat.amount).toLocaleString(intl)}</span>
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* 2. Applied Optional/Other Fees */}
                                        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                                            <div className="px-5 py-4 border-b border-slate-50 flex items-center justify-between">
                                                <h4 className="font-bold text-slate-800 flex items-center gap-2">
                                                    <div className="w-1.5 h-1.5 bg-orange-600 rounded-full"></div>
                                                    {t("details.specialFees")}
                                                </h4>
                                                <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">{t("details.custom")}</span>
                                            </div>
                                            <div className="p-5">
                                                {feeDetailsOptionalFees.length === 0 ? (
                                                    <div className="flex flex-col items-center py-6">
                                                        <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center mb-3">
                                                            <svg className="w-6 h-6 text-slate-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                                        </div>
                                                        <p className="text-xs text-slate-400 italic">{t("details.noExtra")}</p>
                                                    </div>
                                                ) : (
                                                    <ul className="space-y-3">
                                                        {feeDetailsOptionalFees.map((fee: any) => (
                                                            <li key={fee.id} className="flex items-start justify-between p-3 rounded-xl bg-orange-50/50 border border-orange-100/50 hover:bg-orange-50 hover:border-orange-200 transition-all gap-3">
                                                                <div className="flex-1 min-w-0">
                                                                    <span className="font-bold text-sm text-slate-800 block truncate">{fee.feeCategory?.name || t("setup.category")}</span>
                                                                    <div className="flex items-center gap-2 mt-1">
                                                                        <span className="text-xs font-black text-orange-700">₹{Number(fee.amount).toLocaleString(intl)}</span>
                                                                        <span className="text-[10px] text-orange-400 font-bold uppercase tracking-tighter">· {fee.frequency ? frequencyLabel(fee.frequency) : fee.frequency}</span>
                                                                    </div>
                                                                </div>
                                                                {rbac.canConfigureFees && (
                                                                    <button
                                                                        onClick={() => handleRemoveOptionalFee(fee.id)}
                                                                        disabled={removingFeeId === fee.id}
                                                                        className="shrink-0 text-[10px] px-3 py-1.5 text-red-600 border border-red-200 bg-white rounded-lg hover:bg-red-50 transition-all font-black uppercase tracking-tighter shadow-sm"
                                                                    >
                                                                        {removingFeeId === fee.id ? t("details.wait") : t("details.unlink")}
                                                                    </button>
                                                                )}
                                                            </li>
                                                        ))}
                                                    </ul>
                                                )}
                                            </div>
                                        </div>

                                        {/* 3. Applied Discounts */}
                                        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden lg:col-span-2">
                                            <div className="px-5 py-4 border-b border-slate-50 flex items-center justify-between">
                                                <h4 className="font-bold text-slate-800 flex items-center gap-2">
                                                    <div className="w-1.5 h-1.5 bg-green-600 rounded-full"></div>
                                                    {t("details.benefitSummary")}
                                                </h4>
                                                <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">{t("details.discounts")}</span>
                                            </div>
                                            <div className="p-5">
                                                {feeDetailsDiscounts.length === 0 ? (
                                                    <p className="text-sm text-slate-400 italic text-center py-4">{t("details.noDiscounts")}</p>
                                                ) : (
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                        {feeDetailsDiscounts.map((sd: any) => {
                                                            const calculatedSaving = feeDetailsFull?.monthlyBreakdown?.find((m: any) => m.baseFee > 0)?.appliedDiscounts?.find((d: any) => d.name === (sd.discountCategory?.name || sd.name))?.amount || 0;
                                                            return (
                                                                <div key={sd.id} className="flex items-center justify-between p-4 rounded-xl bg-green-50/50 border border-green-100/50">
                                                                    <div className="flex items-center gap-4">
                                                                        <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center text-green-600">
                                                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7"></path></svg>
                                                                        </div>
                                                                        <div>
                                                                            <span className="font-bold text-sm text-slate-800 block leading-tight">{sd.discountCategory?.name || t("receipt.discount")}</span>
                                                                            <span className="text-[10px] text-green-600 font-black uppercase tracking-widest mt-0.5">
                                                                                {sd.discountCategory?.type === 'PERCENTAGE' ? t("details.scholarship", { value: sd.discountCategory.value }) : t("details.monthlyRelief")}
                                                                            </span>
                                                                        </div>
                                                                    </div>
                                                                    <div className="text-right">
                                                                        <span className="text-lg font-black text-green-700">-{calculatedSaving > 0 ? `₹${calculatedSaving}` : '₹0'}</span>
                                                                        <span className="block text-[10px] text-green-400 font-bold uppercase tracking-tighter">{t("details.savingsPerMonth")}</span>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })()}
                </div>
            )}
        </main>
    );
}
