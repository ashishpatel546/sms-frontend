"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { useRbac } from "@/lib/rbac";
import AddStaffForm from "@/components/AddStaffForm";
import { Panel, PanelBody } from "@/components/ui/Panel";
import { PageBody, PageHeader, PageShell } from "@/components/ui/PageHeader";
import { PersonPhotosSection, type StagedPhotos } from "@/components/person/PersonPhotosSection";
import { personUserId, uploadPersonPhoto } from "@/lib/person-documents-api";

export default function AddStaffPage() {
    const router = useRouter();
    const rbac = useRbac();

    // The photo is cropped here and uploaded the moment the staff record —
    // and therefore the user id every photo route is keyed on — exists.
    const [stagedPhotos, setStagedPhotos] = useState<StagedPhotos>({});

    useEffect(() => {
        if (!rbac.canManageTeachers) {
            toast.error("You don't have permission to add staff.");
            router.replace("/dashboard/staff");
        }
    }, [rbac.canManageTeachers, router]);

    const handleSuccess = async (newStaff: any) => {
        const photo = stagedPhotos.self;
        const userId = personUserId(newStaff);

        if (photo && userId) {
            try {
                await uploadPersonPhoto(userId, "self", photo.full, photo.thumb);
            } catch {
                toast.error("Staff member saved, but the photo did not upload. Add it from Edit.");
            }
        } else if (photo) {
            toast.error("Staff member saved, but the photo could not be attached. Add it from Edit.");
        }

        router.push("/dashboard/staff");
        router.refresh();
    };

    return (
        <PageShell>
            <PageHeader
                section="Academics · Staff"
                title="Add a staff member"
                description="Their record, their photo, and what they teach."
                backHref="/dashboard/staff"
                backLabel="Back to staff"
            />

            <PageBody>
                <PersonPhotosSection
                    kinds={["self"]}
                    selfLabel="Staff photo"
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
