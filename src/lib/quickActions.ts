'use client';

import {
  BarChart2,
  Bell,
  CalendarCheck,
  Clock,
  GraduationCap,
  IndianRupee,
  Pencil,
  QrCode,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { useRbac } from '@/lib/rbac';
import { useSchoolFeatures } from '@/lib/useSchoolFeatures';
import type { Pigment } from '@/components/ui/pigment';

/**
 * The quick-action tiles, in one place.
 *
 * This list used to exist twice — once in the dashboard's QuickActions panel
 * and again in the layout's mobile bottom sheet — which meant adding an action
 * meant remembering to add it in both, with its own hand-picked colour pair.
 *
 * Each tile carries a PIGMENT rather than a colour, so what a tile looks like
 * follows from what kind of action it is (see src/components/ui/pigment.ts).
 */
export interface QuickActionTile {
  label: string;
  href: string;
  icon: LucideIcon;
  pigment: Pigment;
  /** Module in the school's plan this action belongs to, if any. */
  featureFlag?: string;
}

export function useQuickActionTiles(): {
  /** RBAC-gated tiles, ignoring the school's plan. */
  tiles: QuickActionTile[];
  /**
   * The same list with modules the plan does not include dropped — and only
   * once the plan is actually known, so a slow or failed lookup shows
   * everything rather than silently shrinking the menu.
   */
  tilesInPlan: QuickActionTile[];
} {
  const rbac = useRbac();
  const { features, status } = useSchoolFeatures();

  // GUARD is deny-by-default: a gate-focused set, no student/fee/homework work.
  const tiles: QuickActionTile[] = rbac.isGuard
    ? [
        { label: 'Scan QR', href: '/dashboard/pickup/scan', icon: QrCode, pigment: 'info', featureFlag: 'pickup_management' },
        { label: 'Visitors', href: '/dashboard/visitors', icon: Users, pigment: 'info', featureFlag: 'visitor_management' },
        { label: 'My attendance', href: '/dashboard/my-attendance', icon: Clock, pigment: 'success', featureFlag: 'hr_portal' },
        { label: 'Notifications', href: '/dashboard/notifications', icon: Bell, pigment: 'attn' },
      ]
    : [
        { label: 'Take attendance', href: '/dashboard/attendance', icon: CalendarCheck, pigment: 'success', featureFlag: 'attendance_management' },
        { label: 'Notifications', href: '/dashboard/notifications', icon: Bell, pigment: 'attn' },
        { label: 'Homework', href: '/dashboard/homework', icon: Pencil, pigment: 'info', featureFlag: 'homework_management' },
        { label: 'Students', href: '/dashboard/students', icon: Users, pigment: 'info' },
        ...(rbac.canManageStudents
          ? [{ label: 'Add student', href: '/dashboard/students/new', icon: GraduationCap, pigment: 'info' as Pigment }]
          : []),
        ...(rbac.canAccessFees
          ? [{ label: 'Collect fee', href: '/dashboard/fees', icon: IndianRupee, pigment: 'attn' as Pigment, featureFlag: 'fee_management' }]
          : []),
        ...(rbac.canManageTeachers
          ? [{ label: 'Add staff', href: '/dashboard/staff/new', icon: Users, pigment: 'info' as Pigment }]
          : []),
        ...(rbac.isTeacher
          ? [{ label: 'Scan QR', href: '/dashboard/pickup/scan', icon: QrCode, pigment: 'info' as Pigment, featureFlag: 'pickup_management' }]
          : []),
        ...(rbac.isTeacher
          ? [{ label: 'Visitors', href: '/dashboard/visitors', icon: Users, pigment: 'info' as Pigment, featureFlag: 'visitor_management' }]
          : []),
        ...(rbac.isAdmin
          ? [{ label: 'Reports', href: '/dashboard/reports', icon: BarChart2, pigment: 'info' as Pigment, featureFlag: 'reports_analytics' }]
          : []),
        ...(rbac.canAccessHRSelfService
          ? [{ label: 'My attendance', href: '/dashboard/my-attendance', icon: Clock, pigment: 'success' as Pigment, featureFlag: 'hr_portal' }]
          : []),
      ];

  const tilesInPlan = tiles.filter(tile =>
    !tile.featureFlag || status !== 'ready' ? true : features[tile.featureFlag] === true,
  );

  return { tiles, tilesInPlan };
}
