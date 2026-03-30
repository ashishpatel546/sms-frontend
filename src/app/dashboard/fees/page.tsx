"use client";

import { useState, useEffect } from "react";
import toast, { Toaster } from "react-hot-toast";
import Link from "next/link";
import { API_BASE_URL } from "@/lib/api";
import { useRouter } from "next/navigation";
import { useRbac } from "@/lib/rbac";
import { authFetch, getUser } from "@/lib/auth";
import ReceiptModal from "@/components/ReceiptModal";
import { Settings, Layers, Wallet, BadgePercent } from "lucide-react";

export default function FeesDashboardPage() {
    const router = useRouter();
    const rbac = useRbac();
    const [activeTab, setActiveTab] = useState<'SETUP' | 'STRUCTURES' | 'COLLECTION' | 'APPLY_DISCOUNTS'>('COLLECTION');
    const [mounted, setMounted] = useState(false);

    // Role guard — redirect TEACHER away from fees
    useEffect(() => {
        if (mounted && !rbac.canAccessFees) {
            toast.error("You don't have permission to access Fee Management.");
            router.replace('/dashboard');
        }
    }, [mounted, rbac.canAccessFees, router]);

    // --- Setup State ---
    const [categories, setCategories] = useState<any[]>([]);
    const [structures, setStructures] = useState<any[]>([]);
    const [classes, setClasses] = useState<any[]>([]);
    const [sessions, setSessions] = useState<any[]>([]);
    const [globalSettings, setGlobalSettings] = useState({ feeDueDate: 15, lateFeePerDay: 50.0 });
    const [savingSettings, setSavingSettings] = useState(false);
    const [loadingSetup, setLoadingSetup] = useState(false);

    // New Category Form
    const [newCategoryName, setNewCategoryName] = useState("");
    const [newCategoryDesc, setNewCategoryDesc] = useState("");
    const [editingCategory, setEditingCategory] = useState<any>(null);
    const [editCategoryName, setEditCategoryName] = useState("");
    const [editCategoryDesc, setEditCategoryDesc] = useState("");

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
    const [applyDiscountSearchQuery, setApplyDiscountSearchQuery] = useState("");
    const [selectedDiscountsToApply, setSelectedDiscountsToApply] = useState<number[]>([]);
    const [applyingDiscounts, setApplyingDiscounts] = useState(false);

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
    const [students, setStudents] = useState<any[]>([]);
    const [selectedStudentId, setSelectedStudentId] = useState("");
    const [searchQuery, setSearchQuery] = useState("");
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

    // Fetch Setup Data
    useEffect(() => {
        const fetchSetupData = async () => {
            try {
                const [catRes, structRes, classRes, studentRes, settingsRes, discountRes, sessionRes] = await Promise.all([
                    authFetch(`${API_BASE_URL}/fees/categories`),
                    authFetch(`${API_BASE_URL}/fees/structures`),
                    authFetch(`${API_BASE_URL}/classes`),
                    authFetch(`${API_BASE_URL}/students`),
                    authFetch(`${API_BASE_URL}/fees/settings`),
                    authFetch(`${API_BASE_URL}/fees/discounts`),
                    authFetch(`${API_BASE_URL}/academic-sessions`)
                ]);
                if (catRes.ok) setCategories(await catRes.json());
                if (structRes.ok) setStructures(await structRes.json());
                if (classRes.ok) setClasses(await classRes.json());
                if (studentRes.ok) setStudents(await studentRes.json());
                if (settingsRes.ok) setGlobalSettings(await settingsRes.json());
                if (discountRes.ok) setDiscounts(await discountRes.json());

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
                toast.error("Failed to load setup data");
            }
        };
        fetchSetupData();
        setMounted(true);
    }, []);

    // Refresh Setup Data helper
    const refreshSetupData = async () => {
        const [catRes, structRes] = await Promise.all([
            authFetch(`${API_BASE_URL}/fees/categories`),
            authFetch(`${API_BASE_URL}/fees/structures`)
        ]);
        if (catRes.ok) setCategories(await catRes.json());
        if (structRes.ok) setStructures(await structRes.json());
    };

    const handleSaveSettings = async (e: React.FormEvent) => {
        e.preventDefault();
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
                toast.success("Global Settings Saved!");
                setGlobalSettings(await res.json());
            } else throw new Error("Failed to save settings");
        } catch (err) {
            toast.error("Failed to save global settings");
        } finally {
            setSavingSettings(false);
        }
    };

    const handleCreateDiscount = async (e: React.FormEvent) => {
        e.preventDefault();
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
                toast.success("Discount Category Created!");
                setNewDiscountName("");
                setNewDiscountValue("");
                setNewDiscountLogicRef("");
                const dRes = await authFetch(`${API_BASE_URL}/fees/discounts`);
                if (dRes.ok) setDiscounts(await dRes.json());
            } else throw new Error("Creation failed");
        } catch (err) {
            toast.error("Failed to create discount");
        }
    };

    const handleUpdateDiscount = async (e: React.FormEvent) => {
        e.preventDefault();
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
                toast.success("Discount Category Updated!");
                setEditingDiscount(null);
                const dRes = await authFetch(`${API_BASE_URL}/fees/discounts`);
                if (dRes.ok) setDiscounts(await dRes.json());
            } else throw new Error("Update failed");
        } catch (err: any) {
            toast.error(err.message || "Failed to update discount");
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
                toast.success(`Discount ${currentStatus ? 'deactivated' : 'activated'}!`);
                const dRes = await authFetch(`${API_BASE_URL}/fees/discounts`);
                if (dRes.ok) setDiscounts(await dRes.json());
            } else throw new Error("Status update failed");
        } catch (err: any) {
            toast.error(err.message || "Failed to update status");
        }
    };

    const handleDeleteDiscount = async (id: number) => {
        if (!confirm("Are you sure you want to delete this discount category?")) return;
        try {
            const res = await authFetch(`${API_BASE_URL}/fees/discounts/${id}`, {
                method: "DELETE"
            });
            if (res.ok) {
                toast.success("Discount deleted!");
                const dRes = await authFetch(`${API_BASE_URL}/fees/discounts`);
                if (dRes.ok) setDiscounts(await dRes.json());
            } else {
                const errData = await res.json();
                throw new Error(errData.message || "Deletion failed");
            }
        } catch (err: any) {
            toast.error(err.message || "Failed to delete discount");
        }
    };

    const handleCreateCategory = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const res = await authFetch(`${API_BASE_URL}/fees/categories`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: newCategoryName, description: newCategoryDesc })
            });
            if (res.ok) {
                toast.success("Fee Category Created!");
                setNewCategoryName("");
                setNewCategoryDesc("");
                refreshSetupData();
            } else throw new Error("Creation failed");
        } catch (err) {
            toast.error("Failed to create category");
        }
    };

    const handleUpdateCategory = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingCategory) return;
        try {
            const res = await authFetch(`${API_BASE_URL}/fees/categories/${editingCategory.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: editCategoryName, description: editCategoryDesc })
            });
            if (res.ok) {
                toast.success("Fee Category Updated!");
                setEditingCategory(null);
                refreshSetupData();
            } else throw new Error("Update failed");
        } catch (err: any) {
            toast.error(err.message || "Failed to update category");
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
                toast.success(`Category ${currentStatus ? 'deactivated' : 'activated'}!`);
                refreshSetupData();
            } else throw new Error("Status update failed");
        } catch (err: any) {
            toast.error(err.message || "Failed to update status");
        }
    };

    const handleDeleteCategory = async (id: number) => {
        if (!confirm("Are you sure you want to delete this category?")) return;
        try {
            const res = await authFetch(`${API_BASE_URL}/fees/categories/${id}`, {
                method: "DELETE"
            });
            if (res.ok) {
                toast.success("Category deleted!");
                refreshSetupData();
            } else {
                const errData = await res.json();
                throw new Error(errData.message || "Deletion failed");
            }
        } catch (err: any) {
            toast.error(err.message || "Failed to delete category");
        }
    };

    const handleCreateStructure = async (e: React.FormEvent) => {
        e.preventDefault();
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
                toast.success("Fee Structure Created!");
                setFormAmount("");
                // Reset to all-checked for the next structure creation
                setFormApplicableDiscountIds(discounts.filter(d => d.isActive !== false).map((d: any) => d.id));
                setFormIsLateFeeApplicable(true);
                refreshSetupData();
            } else {
                const errData = await res.json();
                throw new Error(errData.message || "Creation failed");
            }
        } catch (err: any) {
            toast.error(err.message || "Failed to create structure");
        }
    };

    const handleUpdateStructure = async (e: React.FormEvent) => {
        e.preventDefault();
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
                toast.success("Fee Structure Updated!");
                setEditingStructure(null);
                refreshSetupData();
            } else {
                const errData = await res.json();
                throw new Error(errData.message || "Failed to update");
            }
        } catch (err: any) {
            toast.error(err.message || "Failed to update structure");
        }
    };

    const handleDeleteStructure = async (id: number) => {
        if (!confirm("Are you sure you want to delete this fee structure?")) return;
        try {
            const res = await authFetch(`${API_BASE_URL}/fees/structures/${id}`, {
                method: "DELETE"
            });
            if (res.ok) {
                toast.success("Fee Structure deleted!");
                refreshSetupData();
            } else {
                const errData = await res.json();
                throw new Error(errData.message || "Deletion failed");
            }
        } catch (err: any) {
            toast.error(err.message || "Failed to delete structure");
        }
    };

    // Filter Students based on Search Query
    const filteredStudents = students.filter(s => {
        if (!searchQuery) return false;
        const searchLower = searchQuery.toLowerCase();
        return s.id.toString().includes(searchLower) ||
            s.firstName.toLowerCase().includes(searchLower) ||
            s.lastName.toLowerCase().includes(searchLower);
    });

    const handleSelectStudent = (studentId: string) => {
        setSelectedStudentId(studentId);
        const student = students.find(s => s.id.toString() === studentId);
        if (student) {
            setSearchQuery(`${student.firstName} ${student.lastName} (ID: ${student.id})`);
        }
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
                toast.error("Failed to load student fees");
            } finally {
                setLoadingCollection(false);
            }
        };
        fetchStudentFees();
    }, [selectedStudentId, collectionYear]);

    const handleCollectPayment = async (e: React.FormEvent) => {
        e.preventDefault();
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
                toast.success("Payment successful!");

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
                throw new Error(errData.message || "Payment failed");
            }
        } catch (err: any) {
            toast.error(err.message || "Failed to process payment");
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
        setAdjModalOpen(true);
    };

    const handleIssueAdjustment = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedStudentId || !adjFeeMonth) return;
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
            const res = await authFetch(`${API_BASE_URL}/fees/adjustment`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body)
            });
            if (res.ok) {
                toast.success(adjType === 'REFUND' ? "Refund processed successfully!" : "Fee waived off successfully!");
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
                throw new Error(errData.message || "Adjustment failed");
            }
        } catch (err: any) {
            toast.error(err.message || "Failed to process adjustment");
        } finally {
            setSubmittingAdj(false);
        }
    };

    const handleRevertWaiveOff = async (adjustmentId: number) => {
        if (!confirm("Are you sure you want to revert this waive-off? The outstanding balance will be restored.")) return;
        try {
            const res = await authFetch(`${API_BASE_URL}/fees/adjustment/${adjustmentId}`, { method: "DELETE" });
            if (res.ok) {
                toast.success("Waive-off reverted successfully!");
                setPaymentHistoryData(null);
                const feesRes = await authFetch(`${API_BASE_URL}/fees/student/${selectedStudentId}?academicYear=${collectionYear}`);
                if (feesRes.ok) setStudentFeeDetails(await feesRes.json());
            } else {
                const errData = await res.json();
                throw new Error(errData.message || "Failed to revert waive-off");
            }
        } catch (err: any) {
            toast.error(err.message || "Failed to revert waive-off");
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


            <h1 className="text-3xl font-bold mb-6 text-slate-800 no-print">Fee Management</h1>

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
                <div className="fixed inset-0 z-100 flex items-center justify-center bg-black bg-opacity-50 no-print">
                    <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-lg">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-lg font-bold text-slate-800">Payment History — {paymentHistoryData.label}</h2>
                            <button onClick={() => setPaymentHistoryData(null)} className="text-gray-400 hover:text-gray-600 transition-colors">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                            </button>
                        </div>
                        <div className="mb-4 grid grid-cols-2 gap-3 text-sm bg-slate-50 p-3 rounded-lg">
                            <div><span className="text-gray-500">Total Due:</span> <span className="font-semibold">₹{Number(paymentHistoryData.totalDue || 0).toFixed(2)}</span></div>
                            <div><span className="text-gray-500">Total Paid:</span> <span className="font-semibold text-green-700">₹{Number(paymentHistoryData.totalPaid || 0).toFixed(2)}</span></div>
                            {(paymentHistoryData.excess ?? 0) > 0 ? (
                                <div><span className="text-gray-500">Excess Paid:</span> <span className="font-semibold text-green-600">₹{Number(paymentHistoryData.excess).toFixed(2)}</span></div>
                            ) : (
                                <div><span className="text-gray-500">Balance:</span> <span className={`font-semibold ${paymentHistoryData.outstanding > 0 ? 'text-red-600' : 'text-green-700'}`}>₹{Number(paymentHistoryData.outstanding || 0).toFixed(2)}</span></div>
                            )}
                            <div><span className="text-gray-500">Status:</span> <span className={`font-bold uppercase text-xs px-2 py-0.5 rounded ${paymentHistoryData.status === 'PAID' ? 'bg-green-100 text-green-800' : paymentHistoryData.status === 'PARTIAL' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}`}>{paymentHistoryData.status}</span></div>
                        </div>
                        {paymentHistoryData.payments?.length > 0 ? (
                            <div>
                                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Payments Made</p>
                                <div className="space-y-2 max-h-64 overflow-y-auto">
                                    {paymentHistoryData.payments.map((p: any, idx: number) => (
                                        <div key={idx} className="flex justify-between items-center text-sm bg-green-50 border border-green-100 p-3 rounded-lg">
                                            <div>
                                                <p className="font-medium text-slate-800">₹{Number(p.amountPaid).toFixed(2)} <span className="text-xs text-gray-500">({p.paymentMethod})</span></p>
                                                <p className="text-xs text-gray-500">{new Date(p.paymentDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                                                <p className="text-xs text-gray-400">Receipt: {p.receiptNumber}</p>
                                                {p.gatewayPaymentId && (
                                                    <p className="text-xs text-blue-500 font-mono mt-0.5">
                                                        Gateway: {p.gatewayPaymentId}
                                                        <button onClick={() => navigator.clipboard.writeText(p.gatewayPaymentId)} className="ml-1.5 text-gray-400 hover:text-blue-600" title="Copy payment ID">⧉</button>
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
                                                View Receipt
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <p className="text-sm text-gray-500 italic">No payments recorded yet.</p>
                        )}
                        {paymentHistoryData.adjustments?.length > 0 && (
                            <div className="mt-4">
                                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Fee Adjustments</p>
                                <div className="space-y-2 max-h-40 overflow-y-auto">
                                    {paymentHistoryData.adjustments.map((a: any, idx: number) => (
                                        <div key={idx} className={`flex justify-between items-start text-sm p-3 rounded-lg border ${a.type === 'REFUND' ? 'bg-orange-50 border-orange-100' : 'bg-purple-50 border-purple-100'}`}>
                                            <div className="flex-1">
                                                <p className={`font-medium ${a.type === 'REFUND' ? 'text-orange-800' : 'text-purple-800'}`}>
                                                    <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded mr-1.5 ${a.type === 'REFUND' ? 'bg-orange-200 text-orange-700' : 'bg-purple-200 text-purple-700'}`}>{a.type === 'REFUND' ? 'Refund' : 'Waived'}</span>
                                                    ₹{Number(a.amount).toFixed(2)}
                                                    {a.type === 'REFUND' && a.paymentMethod && <span className="text-xs text-gray-500 ml-1">({a.paymentMethod})</span>}
                                                </p>
                                                <p className="text-xs text-gray-500">{new Date(a.adjustedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                                                {a.reason && <p className="text-xs text-gray-400">Reason: {a.reason}</p>}
                                                {a.createdByName && <p className="text-xs text-gray-400">By: {a.createdByName}</p>}
                                            </div>
                                            {rbac.isAdmin && a.type === 'WAIVE_OFF' && a.id && (
                                                <button
                                                    onClick={() => handleRevertWaiveOff(a.id)}
                                                    className="ml-2 shrink-0 text-[10px] text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded px-2 py-1 transition-colors"
                                                    title="Revert this waive-off"
                                                >
                                                    ↩ Revert
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
                                    Collect Remaining ₹{Number(paymentHistoryData.outstanding).toFixed(2)}
                                </button>
                            )}
                            {rbac.isAdmin && (paymentHistoryData.excess ?? 0) > 0 && (
                                <button
                                    onClick={() => { openAdjModal(paymentHistoryData.monthKey, 'REFUND'); setPaymentHistoryData(null); }}
                                    className="px-4 py-2 bg-orange-100 text-orange-700 text-sm border border-orange-200 rounded hover:bg-orange-200 transition-colors"
                                >
                                    Issue Refund (₹{Number(paymentHistoryData.excess).toFixed(2)} excess)
                                </button>
                            )}
                            {rbac.isAdmin && paymentHistoryData.outstanding > 0 && (
                                <button
                                    onClick={() => { openAdjModal(paymentHistoryData.monthKey, 'WAIVE_OFF'); setPaymentHistoryData(null); }}
                                    className="px-4 py-2 bg-purple-100 text-purple-700 text-sm border border-purple-200 rounded hover:bg-purple-200 transition-colors"
                                >
                                    Waive Off Dues
                                </button>
                            )}
                            <button onClick={() => setPaymentHistoryData(null)} className="px-4 py-2 border border-gray-300 rounded text-gray-700 hover:bg-gray-50 transition-colors ml-auto">Close</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Fee Adjustment Modal (Refund / Waive-Off) */}
            {adjModalOpen && (
                <div className="fixed inset-0 z-110 flex items-center justify-center bg-black bg-opacity-60 no-print">
                    <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md">
                        <div className="flex justify-between items-center mb-3">
                            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                                {adjType === 'REFUND' ? (
                                    <>
                                        <svg className="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"></path></svg>
                                        Issue Refund
                                    </>
                                ) : (
                                    <>
                                        <svg className="w-5 h-5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                        Waive Off Dues
                                    </>
                                )}
                            </h2>
                            <button onClick={() => setAdjModalOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                            </button>
                        </div>
                        <div className="mb-4">
                            <span className={`text-xs font-semibold uppercase px-2 py-1 rounded ${adjType === 'REFUND' ? 'bg-orange-100 text-orange-700' : 'bg-purple-100 text-purple-700'}`}>
                                {adjType === 'REFUND' ? 'Refund — return excess collected payment' : 'Waive Off — write off pending outstanding dues'}
                            </span>
                        </div>
                        <form onSubmit={handleIssueAdjustment} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-900 mb-1">Fee Month / Period</label>
                                <select
                                    value={adjFeeMonth}
                                    onChange={(e) => setAdjFeeMonth(e.target.value)}
                                    required
                                    className="bg-gray-50 border border-gray-300 text-sm rounded-lg block w-full p-2.5 focus:ring-blue-500 focus:border-blue-500"
                                >
                                    <option value="">Select month...</option>
                                    {studentFeeDetails?.oneTimeFees && (
                                        adjType === 'REFUND'
                                            ? (studentFeeDetails.oneTimeFees.excess ?? 0) > 0
                                            : (studentFeeDetails.oneTimeFees.outstanding ?? 0) > 0
                                    ) && (
                                        <option value={studentFeeDetails.oneTimeFees.monthKey}>
                                            {studentFeeDetails.oneTimeFees.label}
                                            {adjType === 'REFUND'
                                                ? ` (Excess: ₹${Number(studentFeeDetails.oneTimeFees.excess).toFixed(2)})`
                                                : ` (Outstanding: ₹${Number(studentFeeDetails.oneTimeFees.outstanding).toFixed(2)})`}
                                        </option>
                                    )}
                                    {(studentFeeDetails?.monthlyBreakdown || [])
                                        .filter((m: any) => adjType === 'REFUND' ? (m.excess ?? 0) > 0 : (m.outstanding ?? 0) > 0)
                                        .map((m: any) => (
                                            <option key={m.monthKey} value={m.monthKey}>
                                                {m.monthName}
                                                {adjType === 'REFUND'
                                                    ? ` (Excess: ₹${Number(m.excess).toFixed(2)})`
                                                    : ` (Outstanding: ₹${Number(m.outstanding).toFixed(2)})`}
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
                                            Amount (₹)
                                            {maxAmt > 0 && <span className="ml-2 text-xs text-gray-500 font-normal">max ₹{maxAmt.toFixed(2)}</span>}
                                        </label>
                                        <input
                                            type="number" step="0.01" min="0.01" max={maxAmt > 0 ? maxAmt : undefined}
                                            value={adjAmount}
                                            onChange={(e) => setAdjAmount(e.target.value)}
                                            required
                                            className="bg-gray-50 border-2 border-gray-200 rounded-lg block w-full p-2.5 focus:ring-blue-500 focus:border-blue-500 font-bold text-lg"
                                            placeholder="Enter amount"
                                        />
                                    </div>
                                );
                            })()}
                            {adjType === 'REFUND' && (
                                <div>
                                    <label className="block text-sm font-medium text-gray-900 mb-1">Refund Method</label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {['CASH', 'CARD', 'ONLINE', 'CHEQUE'].map(method => (
                                            <label key={method} className={`flex items-center justify-center p-2.5 border rounded-lg cursor-pointer transition-all text-xs font-medium ${adjPaymentMethod === method ? 'border-orange-500 bg-orange-50 text-orange-700 ring-1 ring-orange-500' : 'border-gray-200 bg-white hover:bg-gray-50 text-gray-600'}`}>
                                                <input type="radio" name="adjPaymentMethod" value={method} checked={adjPaymentMethod === method} onChange={(e) => setAdjPaymentMethod(e.target.value)} className="sr-only" />
                                                {method}
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            )}
                            <div>
                                <label className="block text-sm font-medium text-gray-900 mb-1">
                                    Reason
                                    {adjType === 'WAIVE_OFF' && <span className="text-red-500 ml-1">*</span>}
                                </label>
                                <input
                                    type="text"
                                    value={adjReason}
                                    onChange={(e) => setAdjReason(e.target.value)}
                                    required={adjType === 'WAIVE_OFF'}
                                    className="bg-gray-50 border border-gray-300 text-sm rounded-lg block w-full p-2.5 focus:ring-blue-500 focus:border-blue-500"
                                    placeholder={adjType === 'REFUND' ? 'e.g. Overpayment, Error correction...' : 'Reason for waiving dues (required)'}
                                />
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button type="submit" disabled={submittingAdj} className={`flex-1 text-white py-2.5 rounded-lg font-bold transition-colors disabled:opacity-50 ${adjType === 'REFUND' ? 'bg-orange-500 hover:bg-orange-600' : 'bg-purple-600 hover:bg-purple-700'}`}>
                                    {submittingAdj ? 'Processing...' : adjType === 'REFUND' ? 'Confirm Refund' : 'Confirm Waive Off'}
                                </button>
                                <button type="button" onClick={() => setAdjModalOpen(false)} className="px-5 py-2.5 bg-gray-100 text-gray-700 border border-gray-200 rounded-lg font-medium hover:bg-gray-200 transition-colors">
                                    Cancel
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
                            Fee Setup (Admin)
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
                            Manage Structures
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
                        Fee Collection
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
                        Apply Fee Discounts
                    </button>
                </div>
                <div className="w-full md:w-auto">
                    <Link href="/dashboard/fees/reports" className="w-full md:w-auto px-4 py-2 bg-slate-800 text-white text-sm font-medium rounded-lg hover:bg-slate-700 transition-colors shadow-sm inline-flex items-center justify-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path></svg>
                        View Fee Reports
                    </Link>
                </div>
            </div>

            {/* TAB: SETUP */}
            {activeTab === 'SETUP' && (
                <div className="space-y-6 no-print animate-in fade-in duration-300">
                    {/* Global Configuration */}
                    <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
                        <h2 className="text-xl font-bold mb-4 text-slate-800">Global Configuration</h2>
                        <form onSubmit={handleSaveSettings} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-end">
                            <div>
                                <label className="block mb-2 text-sm font-medium text-gray-900">Monthly Due Date (Day)</label>
                                <input
                                    type="number" min="1" max="28"
                                    value={globalSettings.feeDueDate}
                                    onChange={(e) => setGlobalSettings({ ...globalSettings, feeDueDate: parseInt(e.target.value) || 15 })}
                                    className="bg-gray-50 border border-gray-300 text-sm rounded-lg block w-full p-2.5 transition-colors focus:ring-blue-500 focus:border-blue-500"
                                    required
                                />
                                <p className="text-xs text-gray-500 mt-1">Day of the month (e.g., 15th)</p>
                            </div>
                            <div>
                                <label className="block mb-2 text-sm font-medium text-gray-900">Late Fee Per Day ($)</label>
                                <input
                                    type="number" step="0.01"
                                    value={globalSettings.lateFeePerDay}
                                    onChange={(e) => setGlobalSettings({ ...globalSettings, lateFeePerDay: parseFloat(e.target.value) || 0 })}
                                    className="bg-gray-50 border border-gray-300 text-sm rounded-lg block w-full p-2.5 transition-colors focus:ring-blue-500 focus:border-blue-500"
                                    required
                                />
                                <p className="text-xs text-gray-500 mt-1">Applied daily if overdue</p>
                            </div>
                            <div>
                                <button type="submit" disabled={savingSettings} className="text-white bg-green-600 hover:bg-green-700 transition-colors py-2.5 px-6 rounded text-sm w-full font-medium disabled:opacity-50">
                                    {savingSettings ? 'Saving...' : 'Save Configuration'}
                                </button>
                            </div>
                        </form>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Create Category */}
                        <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
                            <h2 className="text-xl font-bold mb-4 text-slate-800">1. Add Fee Category</h2>
                            <form onSubmit={handleCreateCategory}>
                                <div className="mb-4">
                                    <label className="block mb-2 text-sm font-medium text-gray-900">Category Name</label>
                                    <input type="text" value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} placeholder="e.g. Curriculum Activity" className="bg-gray-50 border border-gray-300 text-sm rounded-lg block w-full p-2.5 transition-colors focus:ring-blue-500 focus:border-blue-500" required />
                                </div>
                                <div className="mb-4">
                                    <label className="block mb-2 text-sm font-medium text-gray-900">Description</label>
                                    <input type="text" value={newCategoryDesc} onChange={(e) => setNewCategoryDesc(e.target.value)} className="bg-gray-50 border border-gray-300 text-sm rounded-lg block w-full p-2.5 transition-colors focus:ring-blue-500 focus:border-blue-500" />
                                </div>
                                <button type="submit" className="text-white bg-indigo-600 hover:bg-indigo-700 transition-colors py-2 px-4 rounded text-sm w-full font-medium">Create Category</button>
                            </form>

                            {/* Category Edit Modal */}
                            {editingCategory && (
                                <div className="fixed inset-0 z-60 flex items-center justify-center bg-black bg-opacity-50">
                                    <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md animate-in zoom-in-95 duration-200">
                                        <h3 className="text-lg font-bold mb-4 text-slate-800">Edit Fee Category</h3>
                                        <form onSubmit={handleUpdateCategory}>
                                            <div className="mb-4">
                                                <label className="block mb-2 text-sm font-medium text-gray-900">Category Name</label>
                                                <input
                                                    type="text"
                                                    value={editCategoryName}
                                                    onChange={(e) => setEditCategoryName(e.target.value)}
                                                    className="bg-gray-50 border border-gray-300 text-sm rounded-lg block w-full p-2.5 transition-colors focus:ring-blue-500 focus:border-blue-500"
                                                    required
                                                />
                                            </div>
                                            <div className="mb-6">
                                                <label className="block mb-2 text-sm font-medium text-gray-900">Description</label>
                                                <input
                                                    type="text"
                                                    value={editCategoryDesc}
                                                    onChange={(e) => setEditCategoryDesc(e.target.value)}
                                                    className="bg-gray-50 border border-gray-300 text-sm rounded-lg block w-full p-2.5 transition-colors focus:ring-blue-500 focus:border-blue-500"
                                                />
                                            </div>
                                            <div className="flex gap-3 justify-end">
                                                <button
                                                    type="button"
                                                    onClick={() => setEditingCategory(null)}
                                                    className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                                                >
                                                    Cancel
                                                </button>
                                                <button
                                                    type="submit"
                                                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                                                >
                                                    Save Changes
                                                </button>
                                            </div>
                                        </form>
                                    </div>
                                </div>
                            )}

                            <h3 className="text-sm font-bold mt-6 mb-2 text-slate-800">Existing Categories:</h3>
                            <div className="relative border border-gray-200 rounded-lg max-h-[400px]">
                                <table className="w-full text-sm text-left text-gray-500">
                                    <thead className="text-xs text-gray-700 uppercase bg-gray-50 sticky top-0 z-10">
                                        <tr>
                                            <th className="px-4 py-2">Name</th>
                                            <th className="px-4 py-2">Status</th>
                                            <th className="px-4 py-2 text-right">Actions</th>
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
                                                    <span className={`px-2 py-1 rounded text-xs font-semibold ${c.isActive !== false ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                                        {c.isActive !== false ? 'Active' : 'Inactive'}
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
                                                                    <button type="button" onClick={(e) => { e.stopPropagation(); setEditingCategory(c); setEditCategoryName(c.name); setEditCategoryDesc(c.description || ""); setOpenDropdownId(null); }} className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">Edit</button>
                                                                    <button type="button" onClick={(e) => { e.stopPropagation(); handleToggleCategoryStatus(c.id, c.isActive !== false); setOpenDropdownId(null); }} className={`block w-full text-left px-4 py-2 text-sm ${c.isActive !== false ? 'text-orange-600' : 'text-green-600'} hover:bg-gray-100`}>
                                                                        {c.isActive !== false ? 'Deactivate' : 'Activate'}
                                                                    </button>
                                                                    <button type="button" onClick={(e) => { e.stopPropagation(); handleDeleteCategory(c.id); setOpenDropdownId(null); }} className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100">Delete</button>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                        {categories.length === 0 && <tr><td colSpan={3} className="px-4 py-4 text-center">No categories found.</td></tr>}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Assign Structure */}
                        <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
                            <h2 className="text-xl font-bold mb-4 text-slate-800">2. Assign Fee Structure to Class</h2>
                            <form onSubmit={handleCreateStructure}>
                                <div className="grid grid-cols-2 gap-4 mb-4">
                                    <div>
                                        <label className="block mb-2 text-sm font-medium text-gray-900">Class</label>
                                        <select value={formClassId} onChange={(e) => setFormClassId(e.target.value)} className="bg-gray-50 border border-gray-300 text-sm rounded-lg block w-full p-2.5 transition-colors focus:ring-blue-500 focus:border-blue-500" required>
                                            <option value="">Select</option>
                                            {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block mb-2 text-sm font-medium text-gray-900">Category</label>
                                        <select value={formCategoryId} onChange={(e) => setFormCategoryId(e.target.value)} className="bg-gray-50 border border-gray-300 text-sm rounded-lg block w-full p-2.5 transition-colors focus:ring-blue-500 focus:border-blue-500" required>
                                            <option value="">Select</option>
                                            {categories.filter(c => c.isActive !== false).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                        </select>
                                    </div>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                                    <div>
                                        <label className="block mb-2 text-sm font-medium text-gray-900">Amount (₹)</label>
                                        <input type="number" step="0.01" value={formAmount} onChange={(e) => setFormAmount(e.target.value)} className="bg-gray-50 border border-gray-300 text-sm rounded-lg block w-full p-2.5 transition-colors focus:ring-blue-500 focus:border-blue-500" required />
                                    </div>
                                    <div>
                                        <label className="block mb-2 text-sm font-medium text-gray-900">Frequency</label>
                                        <select value={formFrequency} onChange={(e) => setFormFrequency(e.target.value)} className="bg-gray-50 border border-gray-300 text-sm rounded-lg block w-full p-2.5 transition-colors focus:ring-blue-500 focus:border-blue-500" required>
                                            <option value="MONTHLY">Monthly</option>
                                            <option value="ONE_TIME">One Time</option>
                                            <option value="ANNUALLY">Annually</option>
                                            <option value="QUARTERLY">Quarterly</option>
                                            <option value="HALF_YEARLY">Half Yearly</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block mb-2 text-sm font-medium text-gray-900">Academic Year</label>
                                        <select value={formAcademicYear} onChange={(e) => setFormAcademicYear(e.target.value)} className="bg-gray-50 border border-gray-300 text-sm rounded-lg block w-full p-2.5 transition-colors focus:ring-blue-500 focus:border-blue-500" required>
                                            <option value="">Select Year</option>
                                            {sessions.map((s: any) => <option key={s.id} value={s.name}>{s.name} {s.isActive ? '(Current)' : ''}</option>)}
                                        </select>
                                    </div>
                                </div>

                                {/* Applicable Discounts checklist */}
                                {discounts.filter(d => d.isActive !== false).length > 0 && (
                                    <div className="mb-4">
                                        <label className="block mb-1 text-sm font-medium text-gray-900">
                                            Applicable Discounts
                                            <span className="ml-2 text-xs font-normal text-gray-500">(Only checked discounts will apply to this fee)</span>
                                        </label>
                                        <div className="border border-gray-200 rounded-lg p-3 grid grid-cols-2 gap-2">
                                            {discounts.filter(d => d.isActive !== false).map(d => (
                                                <label key={d.id} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
                                                    <input
                                                        type="checkbox"
                                                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
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
                                            className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                            checked={formIsLateFeeApplicable}
                                            onChange={(e) => setFormIsLateFeeApplicable(e.target.checked)}
                                        />
                                        <span className="text-sm font-medium text-gray-900">Apply Late Fee</span>
                                        <span className="text-xs text-gray-500">(Uncheck to disable late fee penalty for this fee category)</span>
                                    </label>
                                </div>

                                <button type="submit" className="text-white bg-indigo-600 hover:bg-indigo-700 transition-colors py-2 px-4 rounded text-sm w-full font-medium">Define Structure</button>
                            </form>
                        </div>
                    </div>

                    {/* Manage Discounts */}
                    <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
                        <h2 className="text-xl font-bold mb-4 text-slate-800">3. Manage Discount Categories</h2>
                        <form onSubmit={handleCreateDiscount} className="grid grid-cols-1 md:grid-cols-6 gap-4 items-end mb-6">
                            <div className="col-span-2">
                                <label className="block mb-2 text-sm font-medium text-gray-900">Discount Name</label>
                                <input type="text" value={newDiscountName} onChange={(e) => setNewDiscountName(e.target.value)} placeholder="e.g. Sibling Discount" className="bg-gray-50 border border-gray-300 text-sm rounded-lg block w-full p-2.5 transition-colors focus:ring-blue-500 focus:border-blue-500" required />
                            </div>
                            <div className="col-span-1">
                                <label className="block mb-2 text-sm font-medium text-gray-900">Value Type</label>
                                <select value={newDiscountType} onChange={(e) => setNewDiscountType(e.target.value)} className="bg-gray-50 border border-gray-300 text-sm rounded-lg block w-full p-2.5 transition-colors focus:ring-blue-500 focus:border-blue-500" required>
                                    <option value="FLAT">Flat Amount ($)</option>
                                    <option value="PERCENTAGE">Percentage (%)</option>
                                </select>
                            </div>
                            <div className="col-span-1">
                                <label className="block mb-2 text-sm font-medium text-gray-900">Value</label>
                                <input type="number" step="0.01" value={newDiscountValue} onChange={(e) => setNewDiscountValue(e.target.value)} className="bg-gray-50 border border-gray-300 text-sm rounded-lg block w-full p-2.5 transition-colors focus:ring-blue-500 focus:border-blue-500" required />
                            </div>
                            <div className="col-span-1">
                                <label className="block mb-2 text-sm font-medium text-gray-900">Application</label>
                                <select value={newDiscountAppType} onChange={(e) => setNewDiscountAppType(e.target.value)} className="bg-gray-50 border border-gray-300 text-sm rounded-lg block w-full p-2.5 transition-colors focus:ring-blue-500 focus:border-blue-500" required>
                                    <option value="MANUAL">Manual</option>
                                    <option value="AUTO">Auto</option>
                                </select>
                            </div>
                            {newDiscountAppType === 'AUTO' && (
                                <div className="col-span-1">
                                    <label className="block mb-2 text-sm font-medium text-gray-900">Logic Ref</label>
                                    <select value={newDiscountLogicRef} onChange={(e) => setNewDiscountLogicRef(e.target.value)} className="bg-gray-50 border border-gray-300 text-sm rounded-lg block w-full p-2.5 transition-colors focus:ring-blue-500 focus:border-blue-500">
                                        <option value="">(None)</option>
                                        <option value="SIBLING">Sibling</option>
                                        <option value="GIRL">Girl Student</option>
                                    </select>
                                </div>
                            )}
                            <div className="col-span-6 md:col-span-1">
                                <button type="submit" className="text-white bg-indigo-600 hover:bg-indigo-700 transition-colors py-2.5 px-6 rounded text-sm w-full font-medium">Create</button>
                            </div>
                        </form>

                        {/* Edit Discount Modal */}
                        {editingDiscount && (
                            <div className="fixed inset-0 z-60 flex items-center justify-center bg-black bg-opacity-50">
                                <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-2xl animate-in zoom-in-95 duration-200">
                                    <h3 className="text-lg font-bold mb-4 text-slate-800">Edit Discount Category</h3>
                                    <form onSubmit={handleUpdateDiscount}>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                            <div>
                                                <label className="block mb-2 text-sm font-medium text-gray-900">Discount Name</label>
                                                <input type="text" value={editDiscountName} onChange={(e) => setEditDiscountName(e.target.value)} className="bg-gray-50 border border-gray-300 text-sm rounded-lg block w-full p-2.5" required />
                                            </div>
                                            <div>
                                                <label className="block mb-2 text-sm font-medium text-gray-900">Value Type</label>
                                                <select value={editDiscountType} onChange={(e) => setEditDiscountType(e.target.value)} className="bg-gray-50 border border-gray-300 text-sm rounded-lg block w-full p-2.5" required>
                                                    <option value="FLAT">Flat Amount ($)</option>
                                                    <option value="PERCENTAGE">Percentage (%)</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block mb-2 text-sm font-medium text-gray-900">Value</label>
                                                <input type="number" step="0.01" value={editDiscountValue} onChange={(e) => setEditDiscountValue(e.target.value)} className="bg-gray-50 border border-gray-300 text-sm rounded-lg block w-full p-2.5" required />
                                            </div>
                                            <div>
                                                <label className="block mb-2 text-sm font-medium text-gray-900">Application</label>
                                                <select value={editDiscountAppType} onChange={(e) => setEditDiscountAppType(e.target.value)} className="bg-gray-50 border border-gray-300 text-sm rounded-lg block w-full p-2.5" required>
                                                    <option value="MANUAL">Manual</option>
                                                    <option value="AUTO">Auto</option>
                                                </select>
                                            </div>
                                            {editDiscountAppType === 'AUTO' && (
                                                <div>
                                                    <label className="block mb-2 text-sm font-medium text-gray-900">Logic Ref</label>
                                                    <select value={editDiscountLogicRef} onChange={(e) => setEditDiscountLogicRef(e.target.value)} className="bg-gray-50 border border-gray-300 text-sm rounded-lg block w-full p-2.5">
                                                        <option value="">(None)</option>
                                                        <option value="SIBLING">Sibling</option>
                                                        <option value="GIRL">Girl Student</option>
                                                    </select>
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex gap-3 justify-end mt-6">
                                            <button type="button" onClick={() => setEditingDiscount(null)} className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">Cancel</button>
                                            <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Save Changes</button>
                                        </div>
                                    </form>
                                </div>
                            </div>
                        )}

                        <div className="relative border border-gray-200 rounded-lg">
                            <table className="w-full text-sm text-left text-gray-500">
                                <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-3">Discount Name</th>
                                        <th className="px-6 py-3">Type</th>
                                        <th className="px-6 py-3">Value</th>
                                        <th className="px-6 py-3">Status</th>
                                        <th className="px-6 py-3">Auto Menu</th>
                                        <th className="px-6 py-3">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {discounts.map(d => (
                                        <tr key={d.id} className={`bg-white border-b hover:bg-gray-50 ${d.isActive === false ? 'opacity-60' : ''}`}>
                                            <td className="px-6 py-4 font-medium text-gray-900">{d.name}</td>
                                            <td className="px-6 py-4">{d.type}</td>
                                            <td className="px-6 py-4">{d.type === 'PERCENTAGE' ? `${d.value}%` : `$${d.value}`}</td>
                                            <td className="px-6 py-4">
                                                <span className={`px-2 py-1 rounded text-xs font-semibold ${d.isActive !== false ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                                                    {d.isActive !== false ? 'Active' : 'Inactive'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`px-2 py-1 rounded text-xs font-semibold ${d.applicationType === 'AUTO' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'}`}>
                                                    {d.applicationType || 'MANUAL'}
                                                </span>
                                                {d.applicationType === 'AUTO' && <p className="text-xs text-gray-500 mt-1">Ref: {d.logicReference}</p>}
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
                                                                <button type="button" onClick={(e) => { e.stopPropagation(); setEditingDiscount(d); setEditDiscountName(d.name); setEditDiscountType(d.type); setEditDiscountValue(d.value.toString()); setEditDiscountAppType(d.applicationType); setEditDiscountLogicRef(d.logicReference || ""); setOpenDropdownId(null); }} className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">Edit</button>
                                                                <button type="button" onClick={(e) => { e.stopPropagation(); handleToggleDiscountStatus(d.id, d.isActive !== false); setOpenDropdownId(null); }} className={`block w-full text-left px-4 py-2 text-sm ${d.isActive !== false ? 'text-orange-600' : 'text-green-600'} hover:bg-gray-100`}>
                                                                    {d.isActive !== false ? 'Deactivate' : 'Activate'}
                                                                </button>
                                                                <button type="button" onClick={(e) => { e.stopPropagation(); handleDeleteDiscount(d.id); setOpenDropdownId(null); }} className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100">Delete</button>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                    {discounts.length === 0 && (
                                        <tr><td colSpan={6} className="px-6 py-4 text-center">No discounts found.</td></tr>
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
                            <h2 className="text-xl font-bold text-slate-800">Manage Fee Structures</h2>
                            <div className="w-64">
                                <select
                                    value={structureSearchClassId}
                                    onChange={(e) => setStructureSearchClassId(e.target.value)}
                                    className="bg-gray-50 border border-gray-300 text-sm rounded-lg block w-full p-2.5 transition-colors focus:ring-blue-500 focus:border-blue-500"
                                >
                                    <option value="">Filter by Class (All)</option>
                                    {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left text-gray-500">
                                <thead className="text-xs text-gray-700 uppercase bg-gray-50 border-b">
                                    <tr>
                                        <th scope="col" className="px-6 py-3">Class</th>
                                        <th scope="col" className="px-6 py-3">Category</th>
                                        <th scope="col" className="px-6 py-3">Amount (₹)</th>
                                        <th scope="col" className="px-6 py-3">Frequency</th>
                                        <th scope="col" className="px-6 py-3">Academic Year</th>
                                        <th scope="col" className="px-6 py-3">Applicable Discounts</th>
                                        <th scope="col" className="px-6 py-3 text-right">Actions</th>
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
                                                <td className="px-6 py-4">{s.frequency || 'MONTHLY'}</td>
                                                <td className="px-6 py-4">{s.academicYear}</td>
                                                <td className="px-6 py-4">
                                                    {s.applicableDiscounts && s.applicableDiscounts.length > 0 ? (
                                                        <div className="flex flex-wrap gap-1">
                                                            {s.applicableDiscounts.map((d: any) => (
                                                                <span key={d.id} className="px-2 py-0.5 bg-indigo-100 text-indigo-800 text-xs font-medium rounded-full">{d.name}</span>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs font-medium rounded-full">No Discounts</span>
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
                                                                    <button type="button" onClick={(e) => { e.stopPropagation(); setEditingStructure(s); setEditAmount(s.amount.toString()); setEditFrequency(s.frequency || 'MONTHLY'); setEditYear(s.academicYear); setEditApplicableDiscountIds((s.applicableDiscounts || []).map((d: any) => d.id)); setEditIsLateFeeApplicable(s.isLateFeeApplicable !== false); setOpenDropdownId(null); }} className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">Edit</button>
                                                                    <button type="button" onClick={(e) => { e.stopPropagation(); handleDeleteStructure(s.id); setOpenDropdownId(null); }} className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100">Delete</button>
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
                                <div className="text-center py-8 text-gray-500">No fee structures found for this selection.</div>
                            )}
                        </div>
                    </div>

                    {/* Edit Modal */}
                    {editingStructure && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
                            <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md animate-in zoom-in-95 duration-200">
                                <h3 className="text-lg font-bold mb-4 text-slate-800">Edit Fee Structure</h3>
                                <p className="text-sm text-gray-600 mb-4">
                                    Updating <span className="font-semibold">{editingStructure.feeCategory.name}</span> for <span className="font-semibold">{editingStructure.class.name}</span>.
                                </p>
                                <form onSubmit={handleUpdateStructure}>
                                    <div className="mb-4">
                                        <label className="block mb-2 text-sm font-medium text-gray-900">Amount (₹)</label>
                                        <input
                                            type="number" step="0.01"
                                            value={editAmount}
                                            onChange={(e) => setEditAmount(e.target.value)}
                                            className="bg-gray-50 border border-gray-300 text-sm rounded-lg block w-full p-2.5 transition-colors focus:ring-blue-500 focus:border-blue-500"
                                            required
                                        />
                                    </div>
                                    <div className="mb-4">
                                        <label className="block mb-2 text-sm font-medium text-gray-900">Frequency</label>
                                        <select
                                            value={editFrequency}
                                            onChange={(e) => setEditFrequency(e.target.value)}
                                            className="bg-gray-50 border border-gray-300 text-sm rounded-lg block w-full p-2.5 transition-colors focus:ring-blue-500 focus:border-blue-500"
                                            required
                                        >
                                            <option value="MONTHLY">Monthly</option>
                                            <option value="ONE_TIME">One Time</option>
                                            <option value="ANNUALLY">Annually</option>
                                            <option value="QUARTERLY">Quarterly</option>
                                            <option value="HALF_YEARLY">Half Yearly</option>
                                        </select>
                                    </div>
                                    <div className="mb-6">
                                        <label className="block mb-2 text-sm font-medium text-gray-900">Academic Year</label>
                                        <select
                                            value={editYear}
                                            onChange={(e) => setEditYear(e.target.value)}
                                            className="bg-gray-50 border border-gray-300 text-sm rounded-lg block w-full p-2.5 transition-colors focus:ring-blue-500 focus:border-blue-500"
                                            required
                                        >
                                            <option value="">Select Year</option>
                                            {sessions.map((s: any) => <option key={s.id} value={s.name}>{s.name} {s.isActive ? '(Current)' : ''}</option>)}
                                        </select>
                                    </div>

                                    {/* Applicable Discounts checklist */}
                                    {discounts.filter(d => d.isActive !== false).length > 0 && (
                                        <div className="mb-6">
                                            <label className="block mb-1 text-sm font-medium text-gray-900">
                                                Applicable Discounts
                                                <span className="ml-2 text-xs font-normal text-gray-500">(Uncheck all = no restriction)</span>
                                            </label>
                                            <div className="border border-gray-200 rounded-lg p-3 grid grid-cols-2 gap-2">
                                                {discounts.filter(d => d.isActive !== false).map(d => (
                                                    <label key={d.id} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none">
                                                        <input
                                                            type="checkbox"
                                                            className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
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
                                                className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                                checked={editIsLateFeeApplicable}
                                                onChange={(e) => setEditIsLateFeeApplicable(e.target.checked)}
                                            />
                                            <span className="text-sm font-medium text-gray-900">Apply Late Fee</span>
                                            <span className="text-xs text-gray-500">(Uncheck to disable late fee penalty for this fee category)</span>
                                        </label>
                                    </div>
                                    <div className="flex gap-3 justify-end">
                                        <button
                                            type="button"
                                            onClick={() => setEditingStructure(null)}
                                            className="px-4 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                                        >
                                            Save Changes
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
                                <label className="block mb-2 text-sm font-medium text-gray-900">Search Student by Name or ID</label>
                                <input
                                    type="text"
                                    value={searchQuery}
                                    onChange={(e) => {
                                        setSearchQuery(e.target.value);
                                        if (selectedStudentId) setSelectedStudentId(""); // Clear selection if typing
                                    }}
                                    placeholder="Search e.g., 'John', '12'"
                                    className="bg-gray-50 border border-gray-300 text-sm rounded-lg block w-full p-3 transition-colors focus:ring-blue-500 focus:border-blue-500 shadow-sm"
                                />

                                {/* Search Results Dropdown */}
                                {searchQuery && !selectedStudentId && (
                                    <ul className="absolute z-30 mt-1 w-full md:w-1/2 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                                        {filteredStudents.length > 0 ? (
                                            filteredStudents.map(s => (
                                                <li
                                                    key={s.id}
                                                    onClick={() => handleSelectStudent(s.id.toString())}
                                                    className="px-4 py-3 hover:bg-blue-50 cursor-pointer border-b border-gray-50 last:border-0 transition-colors"
                                                >
                                                    <div className="font-medium text-gray-900">{s.firstName} {s.lastName}</div>
                                                    <div className="text-xs text-gray-500">ID: {s.id}</div>
                                                </li>
                                            ))
                                        ) : (
                                            <li className="px-4 py-3 text-sm text-gray-500">No students found matching your search.</li>
                                        )}
                                    </ul>
                                )}
                            </div>

                            {/* Top Right: Collection Year Setting */}
                            <div className="w-full md:w-1/4">
                                <label className="block mb-2 text-sm font-bold text-amber-700">Academic Year Filter</label>
                                <select
                                    value={collectionYear}
                                    onChange={(e) => setCollectionYear(e.target.value)}
                                    className="bg-amber-50 border border-amber-300 text-amber-900 text-sm font-semibold rounded-lg block w-full p-2.5 transition-colors focus:ring-amber-500 focus:border-amber-500 shadow-sm"
                                >
                                    {sessions.map(s => (
                                        <option key={s.id} value={s.name}>{s.name} {s.isActive ? '(Current)' : ''}</option>
                                    ))}
                                </select>
                                <p className="text-xs text-amber-600 mt-1">Changes the dynamic fee ledger.</p>
                            </div>
                        </div>
                    </div>

                    {selectedStudentId && (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 animate-in slide-in-from-bottom-2 duration-300 relative z-10">
                            {/* Left: Fee Period Grid */}
                            <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200">
                                <h2 className="text-xl font-bold mb-4 text-slate-800">Fee Overview</h2>
                                {loadingCollection && <div className="text-sm text-gray-500 animate-pulse">Loading fees...</div>}
                                {!loadingCollection && !studentFeeDetails && <div className="text-sm text-gray-500 p-4 bg-gray-50 rounded-lg border border-gray-100 flex items-center justify-center h-32">Select a student to view fee details.</div>}

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
                                                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">One-Time & Annual Fees</p>
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
                                                        className={`p-4 border rounded-lg transition-all relative ${canPayOT || hasHistory ? 'cursor-pointer hover:shadow-md' : 'opacity-75'} ${
                                                            isOTSelected ? 'ring-2 ring-blue-500 border-blue-500 bg-blue-50 scale-[1.01] shadow-md' :
                                                            ot.status === 'PAID' ? 'border-green-200 bg-green-50' :
                                                            ot.status === 'PARTIAL' ? 'border-yellow-200 bg-yellow-50' :
                                                            'border-purple-200 bg-purple-50'
                                                        }`}
                                                    >
                                                        <div className="flex justify-between items-center mb-2">
                                                            <span className="font-bold text-slate-800 text-sm">{ot.label}</span>
                                                            <div className="flex items-center gap-1">
                                                                {hasHistory && (
                                                                    <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path></svg>
                                                                )}
                                                                <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded ${ot.status === 'PAID' ? 'bg-green-100 text-green-800' : ot.status === 'PARTIAL' ? 'bg-yellow-100 text-yellow-800' : 'bg-purple-100 text-purple-800'}`}>
                                                                    {ot.status}
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
                                                            {ot.discount > 0 && <div className="flex justify-between text-green-600"><span>Disc:</span><span>-₹{Number(ot.discount).toFixed(2)}</span></div>}
                                                            {ot.totalPaid > 0 && (
                                                                <div className="flex justify-between text-green-700 font-medium">
                                                                    <span>Paid:</span>
                                                                    <span>₹{Number(ot.totalPaid).toFixed(2)}</span>
                                                                </div>
                                                            )}
                                                            <div className="flex justify-between border-t border-slate-200 pt-1 mt-1 font-semibold text-slate-800">
                                                                <span>Balance:</span>
                                                                <span className={ot.outstanding > 0 ? 'text-red-600' : 'text-green-600'}>₹{Number(ot.outstanding).toFixed(2)}</span>
                                                            </div>
                                                        </div>
                                                        {/* ── PARTIAL card action buttons (matching monthly fees behaviour) ── */}
                                                        {ot.status === 'PARTIAL' && (
                                                            <div className="mt-2 grid grid-cols-2 gap-1" onClick={e => e.stopPropagation()}>
                                                                {/* View Receipt — opens payment/adjustment history modal */}
                                                                {hasHistory && (
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            setPaymentHistoryData({ monthKey: ot.monthKey, label: ot.label, totalDue: ot.totalDue, totalPaid: ot.totalPaid, outstanding: ot.outstanding, excess: ot.excess ?? 0, status: ot.status, payments: ot.payments || [], adjustments: ot.adjustments || [] });
                                                                        }}
                                                                        className="col-span-2 text-[10px] text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded px-2 py-1 text-center transition-colors flex items-center justify-center gap-1"
                                                                    >
                                                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path></svg>
                                                                        View Receipt / History
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
                                                                        Collect ₹{Number(ot.outstanding).toFixed(0)}
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
                                                                        Waive Off
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
                                                                            ↩ Revert Last Waive Off
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
                                                                        ↩ Revert Last Waive Off
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
                                            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Monthly Fees</p>
                                            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
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
                                                    className={`p-4 border rounded-lg transition-all relative ${canPay || status === 'PAID' || status === 'PARTIAL' ? 'cursor-pointer hover:shadow-md' : 'opacity-75 bg-slate-50'
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
                                                            {periodSize === 3 ? 'Q' : periodSize === 6 ? 'H' : 'A'}
                                                        </div>
                                                    )}
                                                    <div className="flex justify-between items-center mb-2">
                                                        <h3 className="font-bold text-slate-800 text-sm leading-tight">{label}</h3>
                                                        <div className="flex items-center gap-1">
                                                            {(status === 'PAID' || status === 'PARTIAL') && period.payments?.length > 0 && (
                                                                <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path></svg>
                                                            )}
                                                            <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded ${status === 'PAID' ? 'bg-green-100 text-green-800' :
                                                                status === 'OVERDUE' ? 'bg-red-100 text-red-800' :
                                                                    status === 'PARTIAL' ? 'bg-yellow-100 text-yellow-800' :
                                                                        'bg-slate-100 text-slate-800'
                                                                }`}>
                                                                {status}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <div className="space-y-1 text-xs text-slate-600">
                                                        {/* Previous credit from overpayment */}
                                                        {previousBalance > 0 && (
                                                            <div className="flex justify-between text-teal-600 font-medium">
                                                                <span>Credit (prev):</span>
                                                                <span>₹{previousBalance.toFixed(2)}</span>
                                                            </div>
                                                        )}
                                                        {/* Previous deficit carry-forward from underpayment */}
                                                        {previousBalance < 0 && (
                                                            <div className="flex justify-between text-orange-600 font-medium">
                                                                <span>Prev Unpaid:</span>
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
                                                                        <div className="flex justify-between"><span>Base:</span> <span>₹{pBase}</span></div>
                                                                    )}
                                                                    {pDisc > 0 && <div className="flex justify-between text-green-600"><span>Disc:</span> <span>-₹{pDisc}</span></div>}
                                                                    {pLate > 0 && <div className="flex justify-between text-red-600"><span>Late Fee:</span> <span>+₹{pLate}</span></div>}
                                                                    {periodTotalPaid > 0 && (
                                                                        <div className="flex justify-between text-green-700 font-medium">
                                                                            <span>Paid:</span>
                                                                            <span>₹{Number(periodTotalPaid).toFixed(2)}</span>
                                                                        </div>
                                                                    )}
                                                                    <div className="border-t border-slate-200 pt-1 mt-1 space-y-0.5">
                                                                        {excess > 0 && (
                                                                            <div className="flex justify-between font-semibold text-green-700">
                                                                                <span>Excess Paid:</span>
                                                                                <span>₹{Number(excess).toFixed(2)}</span>
                                                                            </div>
                                                                        )}
                                                                        {outstanding > 0 ? (
                                                                            <div className="flex justify-between font-semibold text-red-600">
                                                                                <span>Balance Due:</span>
                                                                                <span>₹{Number(outstanding).toFixed(2)}</span>
                                                                            </div>
                                                                        ) : (excess === 0 && status !== 'UNPAID') ? (
                                                                            <div className="flex justify-between font-semibold text-green-600">
                                                                                <span>Balance:</span>
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
                                                            {/* View Receipt — opens payment history modal */}
                                                            {hasPeriodHistory && (
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setPaymentHistoryData({
                                                                            monthKey: periodMonths[0],
                                                                            months: periodMonths,
                                                                            label,
                                                                            totalDue: period.totalDue,
                                                                            totalPaid: period.totalPaid,
                                                                            outstanding,
                                                                            excess: period.excess ?? 0,
                                                                            status,
                                                                            payments: periodPayments,
                                                                            adjustments: periodAdjustments,
                                                                        });
                                                                    }}
                                                                    className="col-span-2 text-[10px] text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded px-2 py-1 text-center transition-colors flex items-center justify-center gap-1"
                                                                >
                                                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path></svg>
                                                                    View Receipt / History
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
                                                                    Collect ₹{Number(outstanding).toFixed(0)}
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
                                                                    Waive Off
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
                                                                    ↩ Revert Last Waive Off
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
                                                                ↩ Revert Last Waive Off
                                                            </button>
                                                        </div>
                                                    )}
                                                    {/* PAID card: selected indicator */}
                                                    {canPay && status !== 'PARTIAL' && isSelected && (
                                                        <div className="mt-2 text-[10px] text-blue-600 text-center font-medium">✓ Selected for payment</div>
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
                                <h2 className="text-xl font-bold mb-4 text-slate-800">Collect Payment</h2>
                                {selectedMonths.length === 0 ? (
                                    <div className="text-sm text-gray-500 italic flex flex-col h-48 items-center justify-center border-2 border-dashed border-gray-300 rounded-lg bg-white/50">
                                        <svg className="w-8 h-8 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122"></path></svg>
                                        Select pending months from the left grid to collect payment.
                                    </div>
                                ) : (
                                    <form onSubmit={handleCollectPayment} className="bg-white p-5 shadow-md border border-gray-200 rounded-lg animate-in zoom-in-95 duration-200">
                                        <div className="mb-4">
                                            <label className="block mb-2 text-sm font-medium text-gray-900">Selected Period</label>
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
                                                        <label className="text-sm font-bold text-blue-700">Amount Paying (₹)</label>
                                                        <span className="text-xs text-gray-500 font-medium">Total Balance: ₹{totalBalance.toFixed(2)}</span>
                                                    </div>
                                                    <input
                                                        type="number" step="0.01"
                                                        value={payAmount}
                                                        onChange={(e) => setPayAmount(e.target.value)}
                                                        placeholder={`Recommended: ${totalBalance.toFixed(2)}`}
                                                        className="bg-blue-50 border-2 border-blue-200 rounded-lg block w-full p-2.5 focus:ring-blue-500 focus:border-blue-500 text-lg font-bold text-blue-900 transition-colors"
                                                        required
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => setPayAmount(totalBalance.toFixed(2))}
                                                        className="mt-2 text-xs text-blue-600 hover:text-blue-800 hover:underline font-medium"
                                                    >
                                                        Fill Total Balance
                                                    </button>
                                                </div>
                                            );
                                        })()}

                                        <div className="mb-5 text-sm font-medium">
                                            <label className="block mb-3 text-gray-900">Payment Method</label>
                                            <div className="grid grid-cols-2 gap-3">
                                                {['CASH', 'CARD', 'ONLINE', 'CHEQUE'].map(method => (
                                                    <label key={method} className={`flex items-center justify-center p-3 border rounded-lg cursor-pointer transition-all ${payMethod === method ? 'border-blue-500 bg-blue-50 text-blue-700 ring-1 ring-blue-500' : 'border-gray-200 bg-white hover:bg-gray-50 text-gray-600'}`}>
                                                        <input type="radio" name="payMethod" value={method} checked={payMethod === method} onChange={(e) => setPayMethod(e.target.value)} className="sr-only" />
                                                        <span className="font-medium text-xs">{method}</span>
                                                    </label>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="mb-6">
                                            <label className="block mb-2 text-sm font-medium text-gray-900">Remarks/Ref No.</label>
                                            <input type="text" value={payRemarks} onChange={(e) => setPayRemarks(e.target.value)} className="bg-gray-50 border border-gray-300 text-sm rounded-lg block w-full p-2.5 transition-colors focus:ring-blue-500 focus:border-blue-500" placeholder="Optional transaction ID..." />
                                        </div>
                                        <div className="flex gap-3">
                                            <button type="submit" disabled={loadingCollection} className="flex-1 text-white bg-blue-600 hover:bg-blue-700 py-3 rounded-lg font-bold disabled:opacity-50 transition-colors shadow-sm">
                                                Confirm Payment
                                            </button>
                                            <button type="button" onClick={() => setSelectedMonths([])} className="px-5 py-3 bg-gray-100 text-gray-700 border border-gray-200 rounded-lg font-medium hover:bg-gray-200 transition-colors">
                                                Clear Selection
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
                                                            Issue Refund (Excess Paid)
                                                        </button>
                                                    )}
                                                    {rbac.isAdmin && outstandingMonth && (
                                                        <button
                                                            type="button"
                                                            onClick={() => openAdjModal(outstandingMonth.monthKey, 'WAIVE_OFF')}
                                                            className="w-full py-2 text-sm font-medium text-purple-700 bg-purple-50 border border-purple-200 rounded-lg hover:bg-purple-100 transition-colors"
                                                        >
                                                            Waive Off Outstanding Dues
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

            {/* TAB: APPLY_DISCOUNTS */}
            {activeTab === 'APPLY_DISCOUNTS' && (
                <div className="no-print animate-in fade-in duration-300">
                    <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200 mb-6 relative z-20">
                        <div className="w-full md:w-1/2">
                            <label className="block mb-2 text-sm font-medium text-gray-900">Search Student to Apply Discounts</label>
                            <input
                                type="text"
                                value={applyDiscountSearchQuery}
                                onChange={(e) => {
                                    setApplyDiscountSearchQuery(e.target.value);
                                    if (applyDiscountStudentId) setApplyDiscountStudentId("");
                                }}
                                placeholder="Search e.g., 'John', '12'"
                                className="bg-gray-50 border border-gray-300 text-sm rounded-lg block w-full p-3 transition-colors focus:ring-blue-500 focus:border-blue-500 shadow-sm"
                            />

                            {/* Search Results Dropdown */}
                            {applyDiscountSearchQuery && !applyDiscountStudentId && (
                                <ul className="absolute z-30 mt-1 w-full md:w-1/2 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                                    {students.filter(s => {
                                        const searchLower = applyDiscountSearchQuery.toLowerCase();
                                        return s.id.toString().includes(searchLower) ||
                                            s.firstName.toLowerCase().includes(searchLower) ||
                                            s.lastName.toLowerCase().includes(searchLower);
                                    }).length > 0 ? (
                                        students.filter(s => {
                                            const searchLower = applyDiscountSearchQuery.toLowerCase();
                                            return s.id.toString().includes(searchLower) ||
                                                s.firstName.toLowerCase().includes(searchLower) ||
                                                s.lastName.toLowerCase().includes(searchLower);
                                        }).map(s => (
                                            <li
                                                key={`apply-${s.id}`}
                                                onClick={() => {
                                                    setApplyDiscountStudentId(s.id.toString());
                                                    setApplyDiscountSearchQuery(`${s.firstName} ${s.lastName} (ID: ${s.id})`);
                                                    // Load existing active discounts
                                                    setSelectedDiscountsToApply(
                                                        s.studentDiscounts
                                                            ? s.studentDiscounts.filter((sd: any) => sd.isActive).map((sd: any) => sd.discountCategory?.id || sd.discountCategoryId)
                                                            : []
                                                    );
                                                }}
                                                className="px-4 py-3 hover:bg-blue-50 cursor-pointer border-b border-gray-50 last:border-0 transition-colors"
                                            >
                                                <div className="font-medium text-gray-900">{s.firstName} {s.lastName}</div>
                                                <div className="text-xs text-gray-500">ID: {s.id}</div>
                                            </li>
                                        ))
                                    ) : (
                                        <li className="px-4 py-3 text-sm text-gray-500">No students found matching your search.</li>
                                    )}
                                </ul>
                            )}
                        </div>
                    </div>

                    {applyDiscountStudentId && (
                        <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200 animate-in slide-in-from-bottom-2 duration-300 relative z-10 w-full md:w-2/3">
                            <h2 className="text-xl font-bold mb-4 text-slate-800">Assign Fee Discounts</h2>
                            <p className="text-sm text-gray-600 mb-6">Select which discounts should apply to this student's monthly fee structure. Note: Only Admin users can modify these assignments.</p>

                            <form onSubmit={async (e) => {
                                e.preventDefault();
                                setApplyingDiscounts(true);
                                try {
                                    const res = await authFetch(`${API_BASE_URL}/students/${applyDiscountStudentId}`, {
                                        method: 'PATCH',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ discountIds: selectedDiscountsToApply })
                                    });
                                    if (res.ok) {
                                        toast.success("Discounts applied successfully!");
                                        // Refresh student list to get updated .discounts
                                        const sRes = await authFetch(`${API_BASE_URL}/students`);
                                        if (sRes.ok) setStudents(await sRes.json());
                                    } else {
                                        throw new Error("Failed to apply discounts");
                                    }
                                } catch (err) {
                                    toast.error("Error applying discounts");
                                } finally {
                                    setApplyingDiscounts(false);
                                }
                            }}>
                                <div className="space-y-4 mb-6 max-h-96 overflow-y-auto p-4 border rounded-lg bg-slate-50">
                                    {discounts.length === 0 ? (
                                        <div className="text-sm text-gray-500">No discount categories exist. Create them in Fee Setup first.</div>
                                    ) : (
                                        discounts.map(d => {
                                            const isSelected = selectedDiscountsToApply.includes(d.id);
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
                                                        className="w-5 h-5 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                                                    />
                                                    <div className="ml-4 flex-1">
                                                        <span className="block text-sm font-semibold text-gray-900">{d.name}</span>
                                                        <span className="block text-xs text-gray-500 mt-0.5">
                                                            {d.type === 'PERCENTAGE' ? `${d.value}% Off Base Fee` : `$${d.value} Flat Off Base Fee`}
                                                            {d.applicationType === 'AUTO' && <span className="ml-2 inline-block px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 text-[10px] font-bold">AUTO: {d.logicReference}</span>}
                                                        </span>
                                                    </div>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>

                                <div className="flex justify-end pt-4 border-t">
                                    <button
                                        type="submit"
                                        disabled={applyingDiscounts}
                                        className="text-white bg-blue-600 hover:bg-blue-700 focus:ring-4 focus:ring-blue-300 font-medium rounded-lg text-sm px-6 py-2.5 transition-colors disabled:opacity-50"
                                    >
                                        {applyingDiscounts ? 'Saving...' : 'Save Discount Assignments'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    )}
                </div>
            )}
        </main>
    );
}
