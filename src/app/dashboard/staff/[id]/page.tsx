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
import { useTranslations } from "next-intl";
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
import { PersonPhotosSection } from "@/components/person/PersonPhotosSection";
import { PersonDocumentsSection } from "@/components/person/PersonDocumentsSection";
import { personUserId } from "@/lib/person-documents-api";

const KNOWN_ROLES = ["SUPER_ADMIN", "ADMIN", "HR_ADMIN", "SUB_ADMIN", "LIBRARIAN", "TEACHER", "GUARD", "PARENT", "STUDENT", "SYSTEM_ADMIN"] as const;
// Stored values → label keys (the value itself is what the API keeps).
const STAFF_CATEGORY_KEYS = {
    "Teaching Staff": "teaching",
    "Management": "management",
    "Support Staff": "support",
    "Admin Staff": "admin",
} as const;

export default function ViewStaffPage() {
    const t = useTranslations("staff");
    const tc = useTranslations("common");
    const tRole = useTranslations("nav.role");
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
            if (!res.ok) throw new Error(t("detail.fetchFailed"));
            const data = await res.json();
            setStaff(data);
        } catch (err: any) {
            setError(err.message || t("detail.loadFailed"));
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
                toast.success(t("exit.marked"));
                setShowExitModal(false);
                fetchStaffDetails(); // Refresh details on page
            } else {
                const err = await res.json();
                toast.error(err.message || t("exit.failed"));
            }
        } catch (error) {
            toast.error(t("exit.error"));
        } finally {
            setIsExiting(false);
        }
    };

    if (loading) {
        return (
            <div className="flex min-h-[60vh] items-center justify-center">
                <div className="font-medium text-ink-muted">{t("detail.loading")}</div>
            </div>
        );
    }

    if (error || !staff) {
        return (
            <PageShell>
                <Panel>
                    <EmptyState
                        title={t("detail.notFound")}
                        description={error || t("detail.couldNotLoad")}
                        action={
                            <Button variant="outline" render={<Link href="/dashboard/staff" />}>
                                {t("backToStaff")}
                            </Button>
                        }
                    />
                </Panel>
            </PageShell>
        );
    }

    const roleLabel = (role: string) =>
        (KNOWN_ROLES as readonly string[]).includes(role)
            ? tRole(role as (typeof KNOWN_ROLES)[number])
            : role.replace(/_/g, " ");
    /** Stored as Male / Female / Others; shown in the reader's language. */
    const genderLabel = (value: string | undefined) => {
        const key = ({ male: "field.male", female: "field.female", other: "field.other", others: "field.other" } as const)[
            (value ?? "").toLowerCase() as "male" | "female" | "other" | "others"
        ];
        return key ? tc(key) : value;
    };
    const staffCategoryLabel = (value: string | undefined) =>
        value && value in STAFF_CATEGORY_KEYS
            ? t(`staffCategory.${STAFF_CATEGORY_KEYS[value as keyof typeof STAFF_CATEGORY_KEYS]}`)
            : value;

    const activeAssignments = staff.subjectAssignments?.filter((a: any) => a.isActive) || [];
    const address = staff.address ?? {};
    const userId = personUserId(staff);

    const assignmentColumns: Column<any>[] = [
        { key: 'subject', header: tc('field.subject'), card: 'title', render: (row) => row.subject?.name ?? '—' },
        { key: 'class', header: tc('field.class'), card: 'meta', render: (row) => row.class?.name ?? '—' },
        { key: 'section', header: tc('field.section'), card: 'meta', render: (row) => row.section?.name ?? '—' },
    ];

    return (
        <>
            <ProfileShell
                section={t("section")}
                title={[staff.firstName, staff.lastName].filter(Boolean).join(" ") || t("detail.staffMember")}
                subtitle={staff.role
                    ? t("detail.subtitleWithRole", { id: staff.id, role: roleLabel(String(staff.role)) })
                    : t("detail.subtitle", { id: staff.id })}
                status={staff.isActive ? "ACTIVE" : "INACTIVE"}
                backHref="/dashboard/staff"
                backLabel={t("backToStaff")}
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
                                {t("list.markExit")}
                            </Button>
                        )}
                        <Button
                            disabled={readOnly}
                            title={readOnly ? READ_ONLY_TITLE : undefined}
                            render={<Link href={`/dashboard/staff/${staff.id}/edit`} />}
                        >
                            <Pencil />
                            {t("detail.editStaff")}
                        </Button>
                    </>
                )}
            >
                <PersonPhotosSection
                    readOnly
                    kinds={["self"]}
                    selfLabel={t("staffPhoto")}
                    userId={userId}
                    record={staff}
                    title={t("detail.photoOnFile")}
                />

                <ProfileSection title={t("detail.basicInfo")} cols={3}>
                    <ReadField label={t("detail.field.firstName")} value={staff.firstName} />
                    <ReadField label={t("detail.field.lastName")} value={staff.lastName} />
                    <ReadField label={tc("field.gender")} value={genderLabel(staff.gender)} />
                    <ReadField label={tc("field.dob")} value={formatDate(staff.dateOfBirth)} />
                    <ReadField label={t("detail.field.bloodGroup")} value={staff.bloodGroup} />
                    <ReadField label={t("detail.field.aadhaar")} value={staff.aadhaarNumber} />
                </ProfileSection>

                <ProfileSection title={t("detail.contactInfo")} cols={3}>
                    <ReadField label={tc("field.email")} value={staff.email} />
                    <ReadField label={t("detail.field.mobile")} value={staff.mobile} />
                    <ReadField label={t("detail.field.alternateMobile")} value={staff.alternateMobile} />
                </ProfileSection>

                <ProfileSection title={t("detail.addressDetails")} cols={3}>
                    <ReadField label={t("detail.field.addressLine1")} value={address.addressLine1} span="full" />
                    <ReadField label={t("detail.field.addressLine2")} value={address.addressLine2} span="full" />
                    <ReadField label={t("detail.field.landmark")} value={address.landmark} />
                    <ReadField label={t("detail.field.city")} value={address.city} />
                    <ReadField label={t("detail.field.state")} value={address.state} />
                    <ReadField label={t("detail.field.postalCode")} value={address.postalCode} />
                    <ReadField label={t("detail.field.country")} value={address.country} />
                </ProfileSection>

                <ProfileSection title={t("detail.demographics")} cols={4}>
                    <ReadField label={t("detail.field.fathersName")} value={staff.fathersName} />
                    <ReadField label={t("detail.field.mothersName")} value={staff.mothersName} />
                    <ReadField label={t("detail.field.category")} value={staff.category} />
                    <ReadField label={t("detail.field.religion")} value={staff.religion} />
                </ProfileSection>

                <ProfileSection title={t("detail.employment")} cols={3}>
                    <ReadField label={t("detail.field.staffCategory")} value={staffCategoryLabel(staff.staffCategory)} />
                    <ReadField label={t("detail.field.designation")} value={staff.designation?.title} />
                    <ReadField label={t("detail.field.joiningDate")} value={formatDate(staff.joiningDate)} />
                    <ReadField label={t("detail.field.exitDate")} value={formatDate(staff.exitDate)} />
                </ProfileSection>

                {staff.staffCategory === 'Teaching Staff' && (
                    <Panel>
                        <PanelHeader title={t("detail.subjectAssignments")} />
                        <DataTable
                            columns={assignmentColumns}
                            data={activeAssignments}
                            rowKey={(row) => row.id}
                            emptyMessage={t("detail.noAssignments")}
                        />
                    </Panel>
                )}

                {userId !== null && (
                    <PersonDocumentsSection
                        userId={userId}
                        owners={["SELF"]}
                        selfLabel={t("detail.ownDocuments")}
                        showTraceLink
                        disabled={!rbac.canManageTeachers || readOnly}
                        disabledReason={
                            readOnly
                                ? READ_ONLY_TITLE
                                : t("detail.documentsDisabled")
                        }
                    />
                )}
            </ProfileShell>

            {showExitModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-walnut-950/55 p-4 backdrop-blur-sm">
                    <Panel className="w-full max-w-md">
                        <PanelHeader title={t("exit.title")} />
                        <PanelBody>
                            <p className="text-[13.5px] text-ink-muted">
                                {t.rich("exit.intro", {
                                    name: `${staff.firstName} ${staff.lastName}`,
                                    id: staff.id,
                                    b: (c) => <span className="font-semibold text-ink">{c}</span>,
                                })}
                            </p>
                            <form onSubmit={handleConfirmExit} className="mt-4 space-y-4">
                                <div>
                                    <label htmlFor="exit-date" className="eyebrow text-[10px]">
                                        {t("exit.exitDate")} *
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
                                        {tc("action.cancel")}
                                    </Button>
                                    <Button type="submit" variant="destructive" disabled={isExiting}>
                                        {isExiting ? t("exit.marking") : t("exit.confirm")}
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
