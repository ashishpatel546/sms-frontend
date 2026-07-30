import React from "react";
import { Panel } from "@/components/ui/Panel";
import { useStudentInfo } from "../hooks/useStudentData";
import { Skeleton } from "@/components/ui/skeleton";

export const StudentBanner = ({ studentId }: { studentId: string }) => {
  const { data: info, isLoading } = useStudentInfo(studentId);

  if (isLoading) {
    return (
      <Panel className="p-4 mx-2 mt-4 flex items-center gap-4">
        <Skeleton className="w-16 h-16 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
      </Panel>
    );
  }

  if (!info) return null;

  return (
    <Panel className="p-4 mx-2 mt-4 flex items-center gap-4 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-32 h-32 bg-brand/5 rounded-bl-full -z-10" />
      
      <div className="w-16 h-16 rounded-2xl bg-linear-to-br from-brand to-brand-light flex items-center justify-center text-white text-2xl font-bold shadow-md shrink-0">
        {info.firstName?.[0]}{info.lastName?.[0]}
      </div>
      
      <div className="flex-1 min-w-0">
        <h2 className="text-2xl font-bold text-ink truncate">
          {info.firstName} {info.lastName}
        </h2>
        <div className="flex flex-wrap gap-2 mt-1">
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-surface-secondary text-ink-muted border border-slate-200">
            Class {info.className} - {info.sectionName}
          </span>
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-surface-secondary text-ink-muted border border-slate-200">
            Roll: {info.rollNo || 'N/A'}
          </span>
        </div>
      </div>
    </Panel>
  );
};