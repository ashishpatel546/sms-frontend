/**
 * Single source of truth for the admin/staff dashboard navigation.
 * Each item carries its Lucide icon, label, href, RBAC key, and group.
 * The Sidebar component uses this to render grouped nav with icons.
 */
import {
  LayoutDashboard,
  Bell,
  GraduationCap,
  Users,
  BookOpen,
  School,
  ClipboardList,
  CalendarCheck,
  CalendarDays,
  IndianRupee,
  FileText,
  Pencil,
  QrCode,
  BarChart2,
  Building2,
  Clock,
  ScrollText,
  Settings,
  MapPin,
  Shield,
  HelpCircle,
  Sparkles,
  Receipt,
  IdCard,
  Boxes,
  ShoppingBag,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
  /** Key on the RbacPermissions object that must be truthy for the item to appear.
   *  If omitted, the item is always visible (regardless of role).
   *
   *  Those permissions are resolved across EVERY role the user holds, so the
   *  menu is the union of what each role opens: an admin who also holds
   *  HR_ADMIN sees the Administration group AND the HR Portal group. */
  rbacKey?: string;
  /** Tailwind text-color class for the icon, e.g. "text-blue-500" */
  /**
   * GUARD is deny-by-default: when the logged-in role is GUARD the sidebar
   * shows ONLY items with this flag, ignoring the unkeyed-means-visible rule.
   */
  guardAllowed?: boolean;
  /**
   * Feature key from the school's plan that must be enabled for the item to
   * appear. Omit for modules that are part of every plan.
   *
   * Pass an ARRAY for a page that serves several modules — the item unlocks if
   * ANY one of them is in the plan. The scanner is the reason this exists: it
   * reads pickup, visitor and ID-card QRs, so gating it on `pickup_management`
   * alone hid a working scanner from schools that had only bought ID cards.
   *
   * The sidebar hides the item only once features are known to be loaded, so a
   * slow request shows the full menu rather than flashing a truncated one.
   */
  featureFlag?: string | string[];
}

/**
 * Is a nav item's module in the plan? An array of flags means "any of these" —
 * see the `featureFlag` docs above.
 */
export function isNavItemUnlocked(
  featureFlag: string | string[] | undefined,
  features: Record<string, boolean>,
): boolean {
  if (!featureFlag) return true;
  const flags = Array.isArray(featureFlag) ? featureFlag : [featureFlag];
  return flags.some((flag) => features[flag] === true);
}

export interface NavGroup {
  /** Section header label. If omitted, no header is rendered (always visible). */
  label?: string;
  items: NavItem[];
  /** Whether this group starts expanded. Defaults to false (collapsed). */
  defaultExpanded?: boolean;
}

export const NAV_CONFIG: NavGroup[] = [
  {
    items: [
      {
        id: 'dashboard',
        label: 'Dashboard',
        href: '/dashboard',
        icon: LayoutDashboard,
        guardAllowed: true,
      },
      {
        id: 'notifications',
        label: 'Notifications',
        href: '/dashboard/notifications',
        icon: Bell,
        guardAllowed: true,
      },
      {
        // Circulars sit beside Notifications because that is what they are to
        // a reader — the school talking to everyone at once. No `featureFlag`:
        // the module is part of every plan, so there is nothing to gate on.
        // `guardAllowed` because a notice addressed to the whole school
        // includes the person on the gate.
        id: 'circulars',
        label: 'Circulars',
        href: '/dashboard/circulars',
        icon: ScrollText,
        rbacKey: 'canViewCirculars',
        guardAllowed: true,
      },
    ],
  },
  {
    label: 'Academics',
    items: [
      {
        id: 'students',
        label: 'Students',
        href: '/dashboard/students',
        icon: GraduationCap,
      },
      {
        id: 'staff',
        label: 'Staff',
        href: '/dashboard/staff',
        icon: Users,
      },
      {
        // Cards are printed for students and staff, so it sits with the two
        // registers it draws from. Gated on the `id_cards` plan feature, which
        // is OFF by default — the same flag the backend controller requires,
        // so the menu entry and the API agree about who has the module.
        id: 'id-cards',
        label: 'ID Cards',
        href: '/dashboard/id-cards',
        icon: IdCard,
        featureFlag: 'id_cards',
        // Everyone who holds a card, not just the office: the page leads with
        // a "My card" tab and only shows the student/staff registers to
        // SUB_ADMIN+. Gating the menu on `canManageIdCards` would have left a
        // teacher's own card reachable only by typing the URL.
        rbacKey: 'canViewOwnIdCard',
        // GUARD is deny-by-default in the sidebar, so it needs saying out loud:
        // a guard carries a card like everyone else and may see their own.
        guardAllowed: true,
      },
      {
        id: 'subjects',
        label: 'Subjects',
        href: '/dashboard/subjects',
        icon: BookOpen,
      },
      {
        id: 'classes',
        label: 'Classes',
        href: '/dashboard/classes',
        icon: School,
      },
      {
        id: 'enrollment',
        label: 'Enrollment',
        href: '/dashboard/enrollment',
        icon: ClipboardList,
        rbacKey: 'canManageEnrollments',
      },
      {
        id: 'attendance',
        label: 'Attendance',
        href: '/dashboard/attendance',
        icon: CalendarCheck,
        featureFlag: 'attendance_management',
      },
      {
        id: 'leaves',
        label: 'Leaves',
        href: '/dashboard/leaves',
        icon: CalendarDays,
        featureFlag: 'leave_management',
      },
      {
        id: 'fees',
        label: 'Fees',
        href: '/dashboard/fees',
        icon: IndianRupee,
        featureFlag: 'fee_management',
        rbacKey: 'canAccessFees',
      },
      {
        id: 'exams',
        label: 'Examinations',
        href: '/dashboard/examinations',
        icon: FileText,
        featureFlag: 'exam_management',
      },
      {
        id: 'homework',
        label: 'Homework',
        href: '/dashboard/homework',
        icon: Pencil,
        featureFlag: 'homework_management',
      },
    ],
  },
  {
    label: 'Gate',
    items: [
      {
        id: 'pickup-scan',
        label: 'Scan QR',
        href: '/dashboard/pickup/scan',
        icon: QrCode,
        // One scanner, four code families — it branches on the code's prefix
        // (V1: visitor, IDC1: ID card, INV1: stock label, bare token: pickup,
        // falling back to a stock lookup so printed Code-128 and publishers'
        // EAN-13 barcodes resolve too). So it belongs to whichever of the
        // modules the school actually has.
        featureFlag: ['pickup_management', 'visitor_management', 'id_cards', 'inventory_management'],
        guardAllowed: true,
      },
      {
        id: 'visitors',
        label: 'Visitors',
        href: '/dashboard/visitors',
        icon: Users,
        featureFlag: 'visitor_management',
        rbacKey: 'canManageVisitors',
        guardAllowed: true,
      },
      {
        id: 'pickup-history',
        label: 'Pickup History',
        href: '/dashboard/pickup/history',
        icon: ClipboardList,
        featureFlag: 'pickup_management',
      },
    ],
  },
  {
    label: 'Reports',
    items: [
      {
        id: 'reports',
        label: 'Reports',
        href: '/dashboard/reports',
        icon: BarChart2,
        featureFlag: 'reports_analytics',
        rbacKey: 'isAdmin',
      },
    ],
  },
  {
    label: 'Library',
    items: [
      {
        id: 'library',
        label: 'Library',
        href: '/dashboard/library',
        icon: BookOpen,
        featureFlag: 'library_management',
      },
    ],
  },
  {
    label: 'Inventory',
    items: [
      {
        id: 'inventory',
        label: 'Inventory',
        href: '/dashboard/inventory',
        icon: Boxes,
        featureFlag: 'inventory_management',
        rbacKey: 'canManageInventory',
      },
      {
        // The other side of the counter: what *I* (or my children) bought and
        // borrowed. Everyone with an account qualifies — the API scopes every
        // answer to the JWT, so the menu can be generous where the store
        // registers above cannot.
        id: 'my-inventory',
        label: 'My Inventory',
        href: '/dashboard/my-inventory',
        icon: ShoppingBag,
        featureFlag: 'inventory_management',
        rbacKey: 'canViewOwnInventory',
        guardAllowed: true,
      },
    ],
  },
  {
    label: 'HR Portal',
    items: [
      {
        id: 'hr',
        label: 'HR Overview',
        href: '/dashboard/hr',
        icon: Building2,
        featureFlag: 'hr_portal',
        rbacKey: 'canAccessHR',
      },
      {
        id: 'hr-attendance',
        label: 'Staff Attendance',
        href: '/dashboard/hr/staff-attendance',
        icon: Clock,
        featureFlag: 'hr_portal',
        rbacKey: 'canAccessHR',
      },
      {
        id: 'hr-leaves',
        label: 'Staff Leaves',
        href: '/dashboard/hr/leaves',
        icon: CalendarDays,
        featureFlag: 'hr_portal',
        rbacKey: 'canAccessHR',
      },
      {
        id: 'hr-policies',
        label: 'Leave Policies',
        href: '/dashboard/hr/leave-policies',
        icon: ScrollText,
        featureFlag: 'hr_portal',
        rbacKey: 'canAccessHR',
      },
      {
        id: 'hr-payroll',
        label: 'Payroll',
        href: '/dashboard/hr/payroll',
        icon: IndianRupee,
        featureFlag: 'hr_portal',
        rbacKey: 'canManagePayroll',
      },
      {
        id: 'hr-salary',
        label: 'Salary Config',
        href: '/dashboard/hr/salary-config',
        icon: Settings,
        featureFlag: 'hr_portal',
        rbacKey: 'canAccessHR',
      },
      {
        id: 'hr-zones',
        label: 'Attendance Zones',
        href: '/dashboard/hr/staff-attendance/zones',
        icon: MapPin,
        featureFlag: 'hr_portal',
        rbacKey: 'canAccessHR',
      },
    ],
  },
  {
    label: 'My HR',
    items: [
      {
        id: 'my-attendance',
        label: 'My Attendance',
        href: '/dashboard/my-attendance',
        icon: Clock,
        featureFlag: 'hr_portal',
        rbacKey: 'canAccessHRSelfService',
        guardAllowed: true,
      },
      {
        id: 'my-leaves',
        label: 'My Leaves',
        href: '/dashboard/my-leaves',
        icon: CalendarDays,
        featureFlag: 'hr_portal',
        rbacKey: 'canAccessHRSelfService',
      },
      {
        id: 'my-salary',
        label: 'My Salary',
        href: '/dashboard/my-salary',
        icon: IndianRupee,
        featureFlag: 'hr_portal',
        rbacKey: 'canAccessHRSelfService',
      },
    ],
  },
  {
    label: 'Administration',
    items: [
      {
        id: 'admin',
        label: 'Admin Panel',
        href: '/dashboard/admin',
        icon: Shield,
        rbacKey: 'canAccessAdminPanel',
      },
      {
        id: 'billing',
        label: 'Billing',
        href: '/dashboard/billing',
        icon: Receipt,
        // Commercial terms are admin/owner business, nobody else's.
        rbacKey: 'isAdmin',
      },
    ],
  },
  {
    label: 'More',
    items: [
      {
        id: 'support',
        label: 'Help & Support',
        href: '/dashboard/support',
        icon: HelpCircle,
        guardAllowed: true,
      },
      {
        // ADMIN and above. The page itself is mostly read-only below
        // SUPER_ADMIN (`canEditSettings`) — holidays are the exception — but
        // reading it is genuinely useful to an admin, so the gate is on
        // reaching the page, not on editing it.
        id: 'settings',
        label: 'Settings',
        href: '/dashboard/settings',
        icon: Settings,
        rbacKey: 'canAccessSettings',
      },
    ],
  },
  {
    label: 'AI Assist',
    items: [
      {
        id: 'ai-chat',
        label: 'AI Chat',
        href: '/dashboard/ai/chat',
        icon: Sparkles,
        featureFlag: 'ai_tools',
      },
      {
        id: 'ai-explain',
        label: 'Explain Topic',
        href: '/dashboard/ai/explain',
        icon: Sparkles,
        featureFlag: 'ai_tools',
      },
      {
        id: 'ai-quiz',
        label: 'Practice Quiz',
        href: '/dashboard/ai/quiz',
        icon: Sparkles,
        featureFlag: 'ai_tools',
      },
      {
        id: 'ai-learning-path',
        label: 'Learning Path',
        href: '/dashboard/ai/learning-path',
        icon: Sparkles,
        featureFlag: 'ai_tools',
      },
      {
        id: 'ai-lesson-plan',
        label: 'Lesson Plan',
        href: '/dashboard/ai/lesson-plan',
        icon: Sparkles,
        featureFlag: 'ai_tools',
      },
      {
        id: 'ai-question-paper',
        label: 'Question Paper',
        href: '/dashboard/ai/question-paper',
        icon: Sparkles,
        featureFlag: 'ai_tools',
      },
      {
        id: 'ai-worksheet',
        label: 'Worksheet',
        href: '/dashboard/ai/worksheet',
        icon: Sparkles,
        featureFlag: 'ai_tools',
      },
      {
        id: 'ai-assignment',
        label: 'Assignment',
        href: '/dashboard/ai/assignment',
        icon: Sparkles,
        featureFlag: 'ai_tools',
      },
      {
        id: 'ai-teacher-chat',
        label: 'Teacher Chat',
        href: '/dashboard/ai/teacher-chat',
        icon: Sparkles,
        featureFlag: 'ai_tools',
      },
      // ── All roles ───────────────────────────────────────────────────
      {
        id: 'ai-subscription',
        label: 'My AI Plan',
        href: '/dashboard/ai/subscription',
        icon: Sparkles,
        featureFlag: 'ai_tools',
      },
    ],
  },
];
