"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Pencil, UserMinus } from "lucide-react";
import { API_BASE_URL } from "@/lib/api";
import { authFetch } from "@/lib/auth";
import { useRbac } from "@/lib/rbac";
import { useReadOnlySession, READ_ONLY_TITLE } from "@/lib/support-session";
import toast from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/Panel";
import { PageShell } from "@/components/ui/PageHeader";
import { DataTable, type Column } from "@/components/ui/DataTable";
import {
    ProfileShell,
    ProfileSection,
    ReadField,
    formatDate,
} from "@/components/ui/ProfileShell";

export default function ViewStaffPage() {
    const params = useParams();
    const id = params?.id as string;
    const rbac = useRbac();
    const readOnly = useReadOnlySession();
    const [staff, setStaff] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    // Exit Modal States
    const [showExitModal, setShowExitModal] = useState(false);
    const [exitDate, setExitDate] = useState(new Date().toISOString().split('T')[0]);
    const [isExiting, setIsExiting] = useState(false);

    const fetchStaffDetails = async () => {
        try {
            const res = await authFetch(`${API_BASE_URL}/staff/${id}`);
            if (!res.ok) throw new Error("Failed to fetch staff details");
            const data = await res.json();
            setStaff(data);
        } catch (err: any) {
            setError(err.message || "Failed to load staff details");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (id) {
            fetchStaffDetails();
        }
    }, [id]);

    const handleConfirmExit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsExiting(true);
        try {
            const res = await authFetch(`${API_BASE_URL}/staff/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    exitDate: exitDate,
                    isActive: false
                })
            });
            if (res.ok) {
                toast.success("Staff exit marked successfully");
                setShowExitModal(false);
                fetchStaffDetails(); // Refresh details on page
            } else {
                const err = await res.json();
                toast.error(err.message || "Failed to mark exit");
            }
        } catch (error) {
            toast.error("An error occurred while marking exit");
        } finally {
            setIsExiting(false);
        }
    };

    if (loading) {
        return (
            <div className="flex min-h-[60vh] items-center justify-center">
                <div className="font-medium text-ink-muted">Loading staff details…</div>
            </div>
        );
    }

    if (error || !staff) {
        return (
            <PageShell>
                <Panel>
                    <EmptyState
                        title="Staff member not found"
                        description={error || "This staff record could not be loaded."}
                        action={
                            <Button variant="outline" render={<Link href="/dashboard/staff" />}>
                                Back to staff
                            </Button>
                        }
                    />
                </Panel>
            </PageShell>
        );
    }

    const activeAssignments = staff.subjectAssignments?.filter((a: any) => a.isActive) || [];
    const address = staff.address ?? {};

    const assignmentColumns: Column<any>[] = [
        { key: 'subject', header: 'Subject', card: 'title', render: (row) => row.subject?.name ?? '—' },
        { key: 'class', header: 'Class', card: 'meta', render: (row) => row.class?.name ?? '—' },
        { key: 'section', header: 'Section', card: 'meta', render: (row) => row.section?.name ?? '—' },
    ];

    return (
        <>
            <ProfileShell
                section="Academics · Staff"
                title={[staff.firstName, staff.lastName].filter(Boolean).join(" ") || "Staff member"}
                subtitle={`Staff ID: ${staff.id}${staff.role ? ` · ${String(staff.role).replace(/_/g, " ")}` : ""}`}
                status={staff.isActive ? "ACTIVE" : "INACTIVE"}
                backHref="/dashboard/staff"
                backLabel="Back to staff"
                actions={rbac.canManageTeachers && (
                    <>
                        {staff.isActive && (
                            <Button
                                variant="outline"
                                disabled={readOnly}
                                title={readOnly ? READ_ONLY_TITLE : undefined}
                                onClick={() => {
                                    setExitDate(new Date().toISOString().split('T')[0]);
                                    setShowExitModal(true);
                                }}
                            >
                                <UserMinus />
                                Mark exit
                            </Button>
                        )}
                        <Button
                            disabled={readOnly}
                            title={readOnly ? READ_ONLY_TITLE : undefined}
                            render={<Link href={`/dashboard/staff/${staff.id}/edit`} />}
                        >
                            <Pencil />
                            Edit staff
                        </Button>
                    </>
                )}
            >
                <ProfileSection title="Basic information" cols={3}>
                    <ReadField label="First name" value={staff.firstName} />
                    <ReadField label="Last name" value={staff.lastName} />
                    <ReadField label="Gender" value={staff.gender} />
                    <ReadField label="Date of birth" value={formatDate(staff.dateOfBirth)} />
                    <ReadField label="Blood group" value={staff.bloodGroup} />
                    <ReadField label="Aadhaar number" value={staff.aadhaarNumber} />
                </ProfileSection>

                <ProfileSection title="Contact information" cols={3}>
                    <ReadField label="Email" value={staff.email} />
                    <ReadField label="Mobile number" value={staff.mobile} />
                    <ReadField label="Alternate mobile" value={staff.alternateMobile} />
                </ProfileSection>

                <ProfileSection title="Address details" cols={3}>
                    <ReadField label="Address line 1" value={address.addressLine1} span="full" />
                    <ReadField label="Address line 2" value={address.addressLine2} span="full" />
                    <ReadField label="Landmark" value={address.landmark} />
                    <ReadField label="City" value={address.city} />
                    <ReadField label="State" value={address.state} />
                    <ReadField label="Postal code" value={address.postalCode} />
                    <ReadField label="Country" value={address.country} />
                </ProfileSection>

                <ProfileSection title="Demographics & family" cols={4}>
                    <ReadField label="Father's name" value={staff.fathersName} />
                    <ReadField label="Mother's name" value={staff.mothersName} />
                    <ReadField label="Category" value={staff.category} />
                    <ReadField label="Religion" value={staff.religion} />
                </ProfileSection>

                <ProfileSection title="Employment information" cols={3}>
                    <ReadField label="Staff category" value={staff.staffCategory} />
                    <ReadField label="Designation" value={staff.designation?.title} />
                    <ReadField label="Joining date" value={formatDate(staff.joiningDate)} />
                    <ReadField label="Exit date" value={formatDate(staff.exitDate)} />
                </ProfileSection>

                {staff.staffCategory === 'Teaching Staff' && (
                    <Panel>
                        <PanelHeader title="Subject assignments" />
                        <DataTable
                            columns={assignmentColumns}
                            data={activeAssignments}
                            rowKey={(row) => row.id}
                            emptyMessage="No active subject assignments."
                        />
                    </Panel>
                )}
            </ProfileShell>

            {showExitModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-walnut-950/55 p-4 backdrop-blur-sm">
                    <Panel className="w-full max-w-md">
                        <PanelHeader title="Mark staff exit" />
                        <PanelBody>
                            <p className="text-[13.5px] text-ink-muted">
                                You are marking exit for{" "}
                                <span className="font-semibold text-ink">
                                    {staff.firstName} {staff.lastName}
                                </span>{" "}
                                (ID: {staff.id}). This will also deactivate their user account.
                            </p>
                            <form onSubmit={handleConfirmExit} className="mt-4 space-y-4">
                                <div>
                                    <label htmlFor="exit-date" className="eyebrow text-[10px]">
                                        Exit date *
                                    </label>
                                    <input
                                        id="exit-date"
                                        type="date"
                                        required
                                        value={exitDate}
                                        onChange={e => setExitDate(e.target.value)}
                                        className="mt-1 block w-full rounded-lg border border-line-strong bg-surface px-3 py-2 text-[14px] text-ink focus:border-brand focus:ring-3 focus:ring-brand/16 focus:outline-none"
                                    />
                                </div>
                                <div className="flex justify-end gap-2 border-t border-line pt-4">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => setShowExitModal(false)}
                                    >
                                        Cancel
                                    </Button>
                                    <Button type="submit" variant="destructive" disabled={isExiting}>
                                        {isExiting ? "Marking exit…" : "Confirm exit"}
                                    </Button>
                                </div>
                            </form>
                        </PanelBody>
                    </Panel>
                </div>
            )}
        </>
    );
}
