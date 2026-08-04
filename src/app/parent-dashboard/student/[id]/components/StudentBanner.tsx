import React from "react";
import { Panel } from "@/components/ui/Panel";
import { useStudentInfo } from "../hooks/useStudentData";
import { Skeleton } from "@/components/ui/skeleton";
import { InitialsAvatar, initialsOf } from "@/components/ui/InitialsAvatar";

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
      
      <InitialsAvatar
        initials={initialsOf(info.firstName, info.lastName)}
        size="xl"
        className="shadow-soft"
      />
      
      <div className="flex-1 min-w-0">
        <h2 className="text-2xl font-bold text-ink truncate">
          {info.firstName} {info.lastName}
        </h2>
        <div className="mt-1.5 flex flex-wrap gap-2">
          {/* `className` already reads "Class 9" — prefixing it again produced
              "Class Class 9 - A" on screen. */}
          <span className="inline-flex items-center rounded border border-line bg-surface-secondary px-2 py-0.5 text-xs font-medium text-ink-muted">
            {info.className}
            {info.sectionName ? ` · Section ${info.sectionName}` : ''}
          </span>
          <span className="inline-flex items-center rounded border border-line bg-surface-secondary px-2 py-0.5 text-xs font-medium text-ink-muted">
            Roll {info.rollNo || '—'}
          </span>
        </div>
      </div>
    </Panel>
  );
};