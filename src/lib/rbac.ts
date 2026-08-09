'use client';

import { getEffectiveRoles, getUser } from './auth';

/**
 * Numeric level for each role — mirrors the backend ROLE_HIERARCHY.
 * Update both places if roles change.
 *
 * SYSTEM_ADMIN is deliberately absent. It is a PLATFORM role, and the tenant
 * backend's MinRoleGuard refuses it outright (hub-minted tokens carry no
 * schoolId); platform staff reach a school through the ticketed login, which
 * mints an ordinary tenant-bound SUPER_ADMIN token. Scoring it here would only
 * light up buttons that every route then 403s.
 */
const ROLE_LEVEL: Record<string, number> = {
  SUPER_ADMIN: 100,
  ADMIN: 80,
  HR_ADMIN: 70,
  SUB_ADMIN: 60,
  LIBRARIAN: 50,
  TEACHER: 40,
  GUARD: 30,
  PARENT: 20,
  STUDENT: 10,
};

/**
 * HR Portal is an EXACT allow-list, not a hierarchy check — it mirrors
 * `HR_PORTAL_ROLES` in the backend's `hr-min-role.guard.ts`. ADMIN outranks
 * HR_ADMIN and still does not belong here: the portal is scoped to the people
 * who actually run HR.
 *
 * Multi-role is what makes this workable. An ADMIN who has additionally been
 * granted HR_ADMIN holds ['ADMIN', 'HR_ADMIN'], intersects this list, and gets
 * in — while a plain ADMIN still does not.
 */
const HR_PORTAL_ROLES = ['HR_ADMIN', 'SUPER_ADMIN', 'SYSTEM_ADMIN'] as const;

/** Roles that may manage the library, by name rather than by rank. */
const LIBRARY_ROLES = ['LIBRARIAN', 'ADMIN', 'SUPER_ADMIN', 'SYSTEM_ADMIN'] as const;

export interface RbacPermissions {
  /** The PRIMARY role — the one word to show when only one fits. */
  role: string | undefined;
  /** Every role held: primary ∪ additional. Falls back to [role] on old tokens. */
  roles: string[];

  /** Hierarchy checks — true if ANY held role meets or exceeds the named role */
  isSuperAdmin: boolean; // SUPER_ADMIN only
  isAdmin: boolean; // ADMIN+
  isSubAdmin: boolean; // SUB_ADMIN+
  isTeacher: boolean; // TEACHER+ (all staff)

  // ── Feature-specific permissions ────────────────────────────────────────
  /** Fees: view collection & student fees (SUB_ADMIN+) */
  canAccessFees: boolean;
  /** Fees: create/edit/delete categories, structures, discounts (ADMIN+) */
  canConfigureFees: boolean;

  /** Students: add / edit students, enroll (SUB_ADMIN+) */
  canManageStudents: boolean;
  /** Students: bulk promote / bulk exit (ADMIN+) */
  canBulkOperateStudents: boolean;

  /** Teachers: add / edit teachers, manage subject assignments (SUB_ADMIN+) */
  canManageTeachers: boolean;

  /** Subjects: create / update subjects (SUB_ADMIN+) */
  canManageSubjects: boolean;

  /** Classes: create / update class (ADMIN+) */
  canManageClasses: boolean;
  /** Sections: create / update sections, assign teacher (SUB_ADMIN+) */
  canManageSections: boolean;

  /** Holidays: view (TEACHER+), create/update (SUB_ADMIN+) */
  canManageHolidays: boolean;
  /** Holidays: delete (ADMIN+) */
  canDeleteHolidays: boolean;

  /** Academic sessions: create / update (ADMIN+) */
  canManageSessions: boolean;
  /** Academic sessions: delete (SUPER_ADMIN only) */
  canDeleteSessions: boolean;

  /** Exam categories, settings, grading system (ADMIN+) */
  canManageExamSettings: boolean;

  /** Admin Panel route (ADMIN+) */
  canAccessAdminPanel: boolean;

  /** Enrollment management (SUB_ADMIN+) */
  canManageEnrollments: boolean;

  /** HR Portal: view own attendance/leaves/salary (TEACHER+) */
  canAccessHRSelfService: boolean;
  /** HR Portal: manage staff attendance, leaves, policies (HR_ADMIN or SUPER_ADMIN only) */
  canAccessHR: boolean;
  /** HR Portal: manage attendance zones, policies, salary config (HR_ADMIN or SUPER_ADMIN only) */
  canManageHR: boolean;
  /** HR Portal: generate/finalize payroll (HR_ADMIN drafts, ADMIN+ finalizes) */
  canManagePayroll: boolean;
  /** HR Portal: does the user hold HR_ADMIN (primary or additional) */
  isHrAdmin: boolean;
  /** Library: does the user hold LIBRARIAN (primary or additional) */
  isLibrarian: boolean;
  /** Library: can manage books, issuances, settings (LIBRARIAN, ADMIN, SUPER_ADMIN) */
  canManageLibrary: boolean;
  /** AI Tools: student-facing AI (STUDENT, PARENT) */
  isStudent: boolean;

  /** Visitor management: the user is a gate guard and nothing more (restricted dashboard) */
  isGuard: boolean;
  /** Visitor management: scan/allow/exit/list (GUARD+) */
  canManageVisitors: boolean;
  /** Visitor management: CSV export + settings visibility (SUB_ADMIN+) */
  canExportVisitors: boolean;
  /** Visitor management settings (SUPER_ADMIN only) */
  canManageVisitorSettings: boolean;

  /** ID Cards: print student/staff cards, batch export (SUB_ADMIN+) */
  canManageIdCards: boolean;
  /**
   * ID Cards: see and download YOUR OWN card. Everyone who has a card may —
   * a guard, a teacher, a student. It is deliberately not a hierarchy step:
   * this is not a lesser version of `canManageIdCards`, it is a different
   * thing (your own identity document vs. the register of everyone else's).
   * The API backs it with a route that takes no id, so it cannot be aimed
   * at another person.
   */
  canViewOwnIdCard: boolean;

  // ── Multi-role helpers ──────────────────────────────────────────────────
  /** Does the user hold this exact role, primary or additional? */
  hasRole: (role: string) => boolean;
  /** Does the user hold ANY of these exact roles? */
  hasAnyRole: (roles: readonly string[]) => boolean;
  /** Does ANY held role sit at or above this one in the hierarchy? */
  hasMinRole: (role: string) => boolean;
}

/**
 * Returns a static snapshot of the current user's permissions, resolved across
 * EVERY role they hold rather than the single `role` claim.
 *
 * Two kinds of check, and the difference matters:
 *  · hierarchical ("SUB_ADMIN and above") uses the MAXIMUM level across the
 *    held roles, so a permission is granted when any one role clears the bar;
 *  · exact ("is a librarian", "HR Portal") is membership in the role set, so
 *    adding a role can only ever add access.
 *
 * @example
 * const { canConfigureFees, isAdmin } = useRbac();
 * if (!canConfigureFees) router.replace('/dashboard');
 */
export function useRbac(): RbacPermissions {
  const user = getUser();
  const roles = getEffectiveRoles(user);

  /** Highest rank held. Never use this to test for a specific role. */
  const level = roles.reduce((max, r) => Math.max(max, ROLE_LEVEL[r] ?? 0), 0);
  const has = (role: string) => roles.includes(role);
  const hasAny = (wanted: readonly string[]) => wanted.some((r) => roles.includes(r));
  const hasMin = (role: string) => roles.length > 0 && level >= (ROLE_LEVEL[role] ?? 0);

  return {
    role: user?.role,
    roles,

    isSuperAdmin: level >= 100,
    isAdmin: level >= 80,
    isSubAdmin: level >= 60,
    isTeacher: level >= 40,

    canAccessFees: level >= 60,
    canConfigureFees: level >= 80,

    canManageStudents: level >= 60,
    canBulkOperateStudents: level >= 80,

    canManageTeachers: level >= 60,

    canManageSubjects: level >= 60,

    canManageClasses: level >= 80,
    canManageSections: level >= 60,

    canManageHolidays: level >= 60,
    canDeleteHolidays: level >= 80,

    canManageSessions: level >= 80,
    canDeleteSessions: level >= 100,

    canManageExamSettings: level >= 80,

    canAccessAdminPanel: level >= 80,

    canManageEnrollments: level >= 60,

    // GUARD is staff too — needs self check-in / my-attendance
    canAccessHRSelfService: level >= 30,
    // Exact allow-list, mirroring HrMinRoleGuard: HR_ADMIN or SUPER_ADMIN, and
    // ADMIN alone is NOT enough. ADMIN + HR_ADMIN together is.
    canAccessHR: hasAny(HR_PORTAL_ROLES),
    canManageHR: hasAny(HR_PORTAL_ROLES),
    // Payroll finalize is an intentional ADMIN+ checks-and-balance escalation
    // (HR_ADMIN drafts, ADMIN/SUPER_ADMIN finalizes) — this one stays
    // hierarchical, so ADMIN keeps its access.
    canManagePayroll: level >= 70,
    isHrAdmin: has('HR_ADMIN'),
    isLibrarian: has('LIBRARIAN'),
    canManageLibrary: hasAny(LIBRARY_ROLES),
    isStudent: hasAny(['STUDENT', 'PARENT']),

    // The sidebar hides everything but `guardAllowed` items when this is true,
    // so it has to mean "gate duty is all this person does". A guard who has
    // additionally been granted TEACHER outranks the gate and keeps the full
    // menu; a plain GUARD still gets the locked-down one.
    isGuard: has('GUARD') && level <= 30,
    canManageVisitors: level >= 30,
    canExportVisitors: level >= 60,
    canManageVisitorSettings: level >= 100,

    canManageIdCards: level >= 60,
    // Any signed-in member of the school: STUDENT is level 10, the floor.
    canViewOwnIdCard: level >= 10,

    hasRole: has,
    hasAnyRole: hasAny,
    hasMinRole: hasMin,
  };
}
