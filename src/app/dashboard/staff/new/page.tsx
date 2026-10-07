"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { useTranslations } from "next-intl";
import { useRbac } from "@/lib/rbac";
import AddStaffForm from "@/components/AddStaffForm";
import { Panel, PanelBody } from "@/components/ui/Panel";
import { PageBody, PageHeader, PageShell } from "@/components/ui/PageHeader";
import { PersonPhotosSection, type StagedPhotos } from "@/components/person/PersonPhotosSection";
import { personUserId, uploadPersonPhoto } from "@/lib/person-documents-api";

export default function AddStaffPage() {
    const t = useTranslations("staff");
    const router = useRouter();
    const rbac = useRbac();

    // The photo is cropped here and uploaded the moment the staff record —
    // and therefore the user id every photo route is keyed on — exists.
    const [stagedPhotos, setStagedPhotos] = useState<StagedPhotos>({});

    useEffect(() => {
        if (!rbac.canManageTeachers) {
            toast.error(t("new.noPermission"));
            router.replace("/dashboard/staff");
        }
    }, [rbac.canManageTeachers, router, t]);

    const handleSuccess = async (newStaff: any) => {
        const photo = stagedPhotos.self;
        const userId = personUserId(newStaff);

        if (photo && userId) {
            try {
                await uploadPersonPhoto(userId, "self", photo.full, photo.thumb);
            } catch {
                toast.error(t("new.photoUploadFailed"));
            }
        } else if (photo) {
            toast.error(t("new.photoNotAttached"));
        }

        router.push("/dashboard/staff");
        router.refresh();
    };

    return (
        <PageShell>
            <PageHeader
                section={t("section")}
                title={t("new.title")}
                description={t("new.description")}
                backHref="/dashboard/staff"
                backLabel={t("backToStaff")}
            />

            <PageBody>
                <PersonPhotosSection
                    kinds={["self"]}
                    selfLabel={t("staffPhoto")}
                    staged={stagedPhotos}
                    onStagedChange={(kind, photo) =>
                        setStagedPhotos(prev => ({ ...prev, [kind]: photo }))
                    }
                />

                <Panel>
                    <PanelBody>
                        <AddStaffForm
                            onSuccess={(newStaff) => void handleSuccess(newStaff)}
                            onCancel={() => router.push("/dashboard/staff")}
                        />
                    </PanelBody>
                </Panel>
            </PageBody>
        </PageShell>
    );
}
