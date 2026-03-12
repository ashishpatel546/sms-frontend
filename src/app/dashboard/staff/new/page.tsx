"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import { useRbac } from "@/lib/rbac";
import AddStaffForm from "@/components/AddStaffForm";

export default function AddStaffPage() {
    const router = useRouter();
    const rbac = useRbac();

    useEffect(() => {
        if (!rbac.canManageTeachers) {
            toast.error("You don't have permission to add staff.");
            router.replace("/dashboard/staff");
        }
    }, [rbac.canManageTeachers, router]);

    return (
        <main className="p-4 bg-slate-50 min-h-screen space-y-6">
            <div className="max-w-4xl mx-auto bg-white p-8 rounded-lg shadow-sm border border-slate-200">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-2xl font-bold text-slate-800">Add New Staff</h2>
                    <Link href="/dashboard/staff" className="text-blue-600 hover:underline">
                        &larr; Back to Staff
                    </Link>
                </div>
                <AddStaffForm
                    onSuccess={() => {
                        router.push("/dashboard/staff");
                        router.refresh();
                    }}
                    onCancel={() => router.push("/dashboard/staff")}
                />
            </div>
        </main>
    );
}
