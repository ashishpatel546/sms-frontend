'use client';

import { getUser } from './auth';

/**
 * Numeric level for each role — mirrors the backend ROLE_HIERARCHY.
 * Update both places if roles change.
 */
const ROLE_LEVEL: Record<string, number> = {
    SUPER_ADMIN: 100,
    ADMIN: 80,
    HR_ADMIN: 70,
    SUB_ADMIN: 60,
    LIBRARIAN: 50,
    TEACHER: 40,
    PARENT: 20,
    STUDENT: 10,
};

export interface RbacPermissions {
    role: string | undefined;

    /** Hierarchy checks — true if user meets or exceeds the named role */
    isSuperAdmin: boolean;   // SUPER_ADMIN only
    isAdmin: boolean;        // ADMIN+
    isSubAdmin: boolean;     // SUB_ADMIN+
    isTeacher: boolean;      // TEACHER+ (all staff)

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
    /** HR Portal: manage staff attendance, leaves, policies (HR_ADMIN+) */
    canAccessHR: boolean;
    /** HR Portal: manage attendance zones, policies, salary config (HR_ADMIN+) */
    canManageHR: boolean;
    /** HR Portal: generate/finalize payroll (ADMIN+) */
    canManagePayroll: boolean;
    /** HR Portal: is the user an HR_ADMIN specifically */
    isHrAdmin: boolean;
    /** Library: is the user a LIBRARIAN specifically */
    isLibrarian: boolean;
    /** Library: can manage books, issuances, settings (LIBRARIAN, ADMIN, SUPER_ADMIN) */
    canManageLibrary: boolean;
}

/**
 * Returns a static snapshot of the current user's permissions.
 * Call this once at the top of a component or layout.
 *
 * @example
 * const { canManageFees, isAdmin } = useRbac();
 * if (!canManageFees) router.replace('/dashboard');
 */
export function useRbac(): RbacPermissions {
    const user = getUser();
    const level = ROLE_LEVEL[user?.role ?? ''] ?? 0;

    return {
        role: user?.role,

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

        canAccessHRSelfService: level >= 40,
        canAccessHR: level >= 70,
        canManageHR: level >= 70,
        canManagePayroll: level >= 70,
        isHrAdmin: level === 70,
        isLibrarian: user?.role === 'LIBRARIAN',
        canManageLibrary: ['LIBRARIAN', 'ADMIN', 'SUPER_ADMIN', 'SYSTEM_ADMIN'].includes(user?.role ?? ''),
    };
}
