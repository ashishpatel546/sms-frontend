"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Pencil, TrendingUp } from "lucide-react";
import { useTranslations } from "next-intl";
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
    const t = useTranslations("students.detail");
    const f = useTranslations("students.form");
    const tc = useTranslations("common");
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
                if (!res.ok) throw new Error(t("fetchFailed"));
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
                setError(err.message || t("loadFailed"));
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [id, t]);

    if (loading) {
        return (
            <div className="flex min-h-[60vh] items-center justify-center">
                <div className="font-medium text-ink-muted">{t("loading")}</div>
            </div>
        );
    }

    if (error || !student) {
        return (
            <PageShell>
                <Panel>
                    <EmptyState
                        title={t("notFound")}
                        description={error || t("notFoundBody")}
                        action={
                            <Button variant="outline" render={<Link href="/dashboard/students" />}>
                                {t("back")}
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
            section={t("section")}
            title={[student.firstName, student.lastName].filter(Boolean).join(" ") || tc("field.student")}
            subtitle={t("studentId", { id: student.id })}
            status={student.isActive ? "ACTIVE" : "INACTIVE"}
            backHref="/dashboard/students"
            backLabel={t("back")}
            actions={rbac.canManageStudents && (
                <>
                    <Button
                        variant="outline"
                        disabled={readOnly}
                        title={readOnly ? READ_ONLY_TITLE : undefined}
                        render={<Link href={`/dashboard/students/${student.id}/promote`} />}
                    >
                        <TrendingUp />
                        {t("promote")}
                    </Button>
                    <Button
                        disabled={readOnly}
                        title={readOnly ? READ_ONLY_TITLE : undefined}
                        render={<Link href={`/dashboard/students/${student.id}/edit`} />}
                    >
                        <Pencil />
                        {t("editStudent")}
                    </Button>
                </>
            )}
        >
            <PersonPhotosSection
                readOnly
                kinds={["self", "father", "mother", "guardian"]}
                selfLabel={f("studentPhoto")}
                userId={userId}
                record={student}
                title={t("photosOnFile")}
            />

            <ProfileSection title={t("basicInfo")} cols={3}>
                <ReadField label={f("firstName")} value={student.firstName} />
                <ReadField label={f("lastName")} value={student.lastName} />
                <ReadField label={tc("field.gender")} value={student.gender} />
                <ReadField label={tc("field.dob")} value={formatDate(student.dateOfBirth)} />
                <ReadField label={t("bloodGroup")} value={student.bloodGroup} />
                <ReadField label={t("aadhaarNumber")} value={student.aadhaarNumber} />
                <ReadField label={t("pen")} value={student.pen} />
                <ReadField label={f("aparId")} value={student.aparId} />
                <ReadField label={f("abhaId")} value={student.abhaId} />
            </ProfileSection>

            <ProfileSection title={t("contactInfo")} cols={3}>
                <ReadField label={tc("field.email")} value={student.email} />
                <ReadField label={t("mobileNumber")} value={student.mobile} />
                <ReadField label={t("alternateMobile")} value={student.alternateMobile} />
            </ProfileSection>

            <ProfileSection title={t("addressDetails")} cols={3}>
                <ReadField label={f("addressLine1")} value={address.addressLine1} span="full" />
                <ReadField label={f("addressLine2")} value={address.addressLine2} span="full" />
                <ReadField label={f("landmark")} value={address.landmark} />
                <ReadField label={f("city")} value={address.city} />
                <ReadField label={f("state")} value={address.state} />
                <ReadField label={f("postalCode")} value={address.postalCode} />
                <ReadField label={f("country")} value={address.country} />
            </ProfileSection>

            <ProfileSection title={t("fathersDetails")} cols={3}>
                <ReadField label={tc("field.name")} value={student.fathersName} />
                <ReadField label={t("aadhaar")} value={student.fatherAadhaarNumber} />
                <ReadField label={t("pan")} value={student.fatherPan} />
                <ReadField label={t("occupation")} value={student.fatherOccupation} />
                <ReadField label={t("annualIncome")} value={formatMoney(student.fatherIncome)} />
            </ProfileSection>

            <ProfileSection title={t("mothersDetails")} cols={3}>
                <ReadField label={tc("field.name")} value={student.mothersName} />
                <ReadField label={t("aadhaar")} value={student.motherAadhaarNumber} />
                <ReadField label={t("pan")} value={student.motherPan} />
                <ReadField label={t("occupation")} value={student.motherOccupation} />
                <ReadField label={t("annualIncome")} value={formatMoney(student.motherIncome)} />
            </ProfileSection>

            {hasGuardian && (
                <ProfileSection title={f("guardian")} cols={3}>
                    <ReadField label={tc("field.name")} value={student.guardianName} />
                    <ReadField label={t("relation")} value={student.guardianRelation} />
                    <ReadField label={t("phone")} value={student.guardianPhone} />
                </ProfileSection>
            )}

            {sibling && (
                <ProfileSection title={t("linkedSibling")} cols={3}>
                    <ReadField
                        label={tc("field.name")}
                        value={
                            <Link
                                href={`/dashboard/students/${sibling.id}`}
                                className="font-semibold text-brand hover:underline"
                            >
                                {t("siblingName", { name: [sibling.firstName, sibling.lastName].filter(Boolean).join(" "), id: sibling.id })}
                            </Link>
                        }
                    />
                    <ReadField label={tc("field.gender")} value={sibling.gender} />
                    <ReadField
                        label={tc("field.status")}
                        value={<StatusChip status={sibling.isActive ? "ACTIVE" : "INACTIVE"} />}
                    />
                </ProfileSection>
            )}

            <ProfileSection title={f("demographics")} cols={3}>
                <ReadField label={f("category")} value={student.category} />
                <ReadField label={f("religion")} value={student.religion} />
            </ProfileSection>

            {activeDiscounts.length > 0 && (
                <Panel>
                    <PanelHeader title={t("appliedDiscounts")} />
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
                                                {t("discountType", { type: disc.applicationType })}
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
                    selfLabel={tc("field.student")}
                    showTraceLink
                    disabled={!rbac.canManageStudents || readOnly}
                    disabledReason={
                        readOnly
                            ? READ_ONLY_TITLE
                            : t("documentsLocked")
                    }
                />
            )}
        </ProfileShell>
    );
}
