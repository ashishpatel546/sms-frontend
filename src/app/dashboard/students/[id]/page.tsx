"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Pencil, TrendingUp } from "lucide-react";
import { API_BASE_URL } from "@/lib/api";
import { authFetch } from "@/lib/auth";
import { useRbac } from "@/lib/rbac";
import { useReadOnlySession, READ_ONLY_TITLE } from "@/lib/support-session";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Panel, PanelBody, PanelHeader } from "@/components/ui/Panel";
import { PageShell } from "@/components/ui/PageHeader";
import { StatusChip } from "@/components/ui/StatusChip";
import {
    ProfileShell,
    ProfileSection,
    ReadField,
    formatDate,
    formatMoney,
} from "@/components/ui/ProfileShell";
import { PersonPhotosSection } from "@/components/person/PersonPhotosSection";
import { PersonDocumentsSection } from "@/components/person/PersonDocumentsSection";
import { personUserId } from "@/lib/person-documents-api";

export default function ViewStudentPage() {
    const params = useParams();
    const id = params?.id as string;
    const rbac = useRbac();
    const readOnly = useReadOnlySession();
    const [student, setStudent] = useState<any>(null);
    const [sibling, setSibling] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        if (!id) return;
        const fetchData = async () => {
            try {
                const res = await authFetch(`${API_BASE_URL}/students/${id}`);
                if (!res.ok) throw new Error("Failed to fetch student details");
                const data = await res.json();
                setStudent(data);

                if (data.siblingId) {
                    try {
                        const sibRes = await authFetch(`${API_BASE_URL}/students/${data.siblingId}`);
                        if (sibRes.ok) {
                            const sibData = await sibRes.json();
                            setSibling(sibData);
                        }
                    } catch (e) {
                        console.error("Failed to fetch sibling", e);
                    }
                }
            } catch (err: any) {
                setError(err.message || "Failed to load student details");
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [id]);

    if (loading) {
        return (
            <div className="flex min-h-[60vh] items-center justify-center">
                <div className="font-medium text-ink-muted">Loading student details…</div>
            </div>
        );
    }

    if (error || !student) {
        return (
            <PageShell>
                <Panel>
                    <EmptyState
                        title="Student not found"
                        description={error || "This student record could not be loaded."}
                        action={
                            <Button variant="outline" render={<Link href="/dashboard/students" />}>
                                Back to students
                            </Button>
                        }
                    />
                </Panel>
            </PageShell>
        );
    }

    const activeDiscounts = student.studentDiscounts?.filter((sd: any) => sd.isActive) || [];
    const address = student.address ?? {};
    const userId = personUserId(student);
    const hasGuardian = Boolean(student.guardianName || student.guardianRelation || student.guardianPhone);

    return (
        <ProfileShell
            section="Academics · Students"
            title={[student.firstName, student.lastName].filter(Boolean).join(" ") || "Student"}
            subtitle={`Student ID: ${student.id}`}
            status={student.isActive ? "ACTIVE" : "INACTIVE"}
            backHref="/dashboard/students"
            backLabel="Back to students"
            actions={rbac.canManageStudents && (
                <>
                    <Button
                        variant="outline"
                        disabled={readOnly}
                        title={readOnly ? READ_ONLY_TITLE : undefined}
                        render={<Link href={`/dashboard/students/${student.id}/promote`} />}
                    >
                        <TrendingUp />
                        Promote
                    </Button>
                    <Button
                        disabled={readOnly}
                        title={readOnly ? READ_ONLY_TITLE : undefined}
                        render={<Link href={`/dashboard/students/${student.id}/edit`} />}
                    >
                        <Pencil />
                        Edit student
                    </Button>
                </>
            )}
        >
            <PersonPhotosSection
                readOnly
                kinds={["self", "father", "mother", "guardian"]}
                selfLabel="Student photo"
                userId={userId}
                record={student}
                title="Photos on file"
            />

            <ProfileSection title="Basic information" cols={3}>
                <ReadField label="First name" value={student.firstName} />
                <ReadField label="Last name" value={student.lastName} />
                <ReadField label="Gender" value={student.gender} />
                <ReadField label="Date of birth" value={formatDate(student.dateOfBirth)} />
                <ReadField label="Blood group" value={student.bloodGroup} />
                <ReadField label="Aadhaar number" value={student.aadhaarNumber} />
                <ReadField label="PEN" value={student.pen} />
                <ReadField label="APAR ID" value={student.aparId} />
                <ReadField label="ABHA ID" value={student.abhaId} />
            </ProfileSection>

            <ProfileSection title="Contact information" cols={3}>
                <ReadField label="Email" value={student.email} />
                <ReadField label="Mobile number" value={student.mobile} />
                <ReadField label="Alternate mobile" value={student.alternateMobile} />
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

            <ProfileSection title="Father's details" cols={3}>
                <ReadField label="Name" value={student.fathersName} />
                <ReadField label="Aadhaar" value={student.fatherAadhaarNumber} />
                <ReadField label="PAN" value={student.fatherPan} />
                <ReadField label="Occupation" value={student.fatherOccupation} />
                <ReadField label="Annual income" value={formatMoney(student.fatherIncome)} />
            </ProfileSection>

            <ProfileSection title="Mother's details" cols={3}>
                <ReadField label="Name" value={student.mothersName} />
                <ReadField label="Aadhaar" value={student.motherAadhaarNumber} />
                <ReadField label="PAN" value={student.motherPan} />
                <ReadField label="Occupation" value={student.motherOccupation} />
                <ReadField label="Annual income" value={formatMoney(student.motherIncome)} />
            </ProfileSection>

            {hasGuardian && (
                <ProfileSection title="Guardian" cols={3}>
                    <ReadField label="Name" value={student.guardianName} />
                    <ReadField label="Relation" value={student.guardianRelation} />
                    <ReadField label="Phone" value={student.guardianPhone} />
                </ProfileSection>
            )}

            {sibling && (
                <ProfileSection title="Linked sibling" cols={3}>
                    <ReadField
                        label="Name"
                        value={
                            <Link
                                href={`/dashboard/students/${sibling.id}`}
                                className="font-semibold text-brand hover:underline"
                            >
                                {[sibling.firstName, sibling.lastName].filter(Boolean).join(" ")} (ID: {sibling.id})
                            </Link>
                        }
                    />
                    <ReadField label="Gender" value={sibling.gender} />
                    <ReadField
                        label="Status"
                        value={<StatusChip status={sibling.isActive ? "ACTIVE" : "INACTIVE"} />}
                    />
                </ProfileSection>
            )}

            <ProfileSection title="Demographics" cols={3}>
                <ReadField label="Category" value={student.category} />
                <ReadField label="Religion" value={student.religion} />
            </ProfileSection>

            {activeDiscounts.length > 0 && (
                <Panel>
                    <PanelHeader title="Applied fee discounts" />
                    <PanelBody>
                        <ul className="grid gap-3 sm:grid-cols-2">
                            {activeDiscounts.map((sd: any) => {
                                const disc = sd.discountCategory;
                                if (!disc) return null;
                                return (
                                    <li
                                        key={sd.id}
                                        className="flex items-center justify-between gap-3 rounded-lg border border-line px-3 py-2.5"
                                    >
                                        <span className="min-w-0">
                                            <span className="block truncate text-[14px] font-semibold text-ink">
                                                {disc.name}
                                            </span>
                                            <span className="eyebrow text-[10px]">
                                                {disc.applicationType} discount
                                            </span>
                                        </span>
                                        <span className="shrink-0 font-semibold text-accent-success-deep">
                                            {disc.type === "PERCENTAGE" ? `${disc.value}%` : `₹${disc.value}`}
                                        </span>
                                    </li>
                                );
                            })}
                        </ul>
                    </PanelBody>
                </Panel>
            )}

            {userId !== null && (
                <PersonDocumentsSection
                    userId={userId}
                    owners={["SELF", "FATHER", "MOTHER", "GUARDIAN"]}
                    selfLabel="Student"
                    showTraceLink
                    disabled={!rbac.canManageStudents || readOnly}
                    disabledReason={
                        readOnly
                            ? READ_ONLY_TITLE
                            : "Only sub admins and above can change what the school holds."
                    }
                />
            )}
        </ProfileShell>
    );
}
