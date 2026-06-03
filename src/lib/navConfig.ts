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
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
  /** Key on the RbacPermissions object that must be truthy for the item to appear.
   *  If omitted, the item is always visible (regardless of role). */
  rbacKey?: string;
  /** Tailwind text-color class for the icon, e.g. "text-blue-500" */
  iconColor: string;
}

export interface NavGroup {
  /** Section header label. If omitted, no header is rendered. */
  label?: string;
  items: NavItem[];
}

export const NAV_CONFIG: NavGroup[] = [
  {
    items: [
      {
        id: 'dashboard',
        label: 'Dashboard',
        href: '/dashboard',
        icon: LayoutDashboard,
        iconColor: 'text-violet-500',
      },
      {
        id: 'notifications',
        label: 'Notifications',
        href: '/dashboard/notifications',
        icon: Bell,
        iconColor: 'text-sky-500',
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
        iconColor: 'text-blue-500',
      },
      {
        id: 'staff',
        label: 'Staff',
        href: '/dashboard/staff',
        icon: Users,
        iconColor: 'text-indigo-500',
      },
      {
        id: 'subjects',
        label: 'Subjects',
        href: '/dashboard/subjects',
        icon: BookOpen,
        iconColor: 'text-emerald-500',
      },
      {
        id: 'classes',
        label: 'Classes',
        href: '/dashboard/classes',
        icon: School,
        iconColor: 'text-orange-500',
      },
      {
        id: 'enrollment',
        label: 'Enrollment',
        href: '/dashboard/enrollment',
        icon: ClipboardList,
        iconColor: 'text-amber-500',
        rbacKey: 'canManageEnrollments',
      },
      {
        id: 'attendance',
        label: 'Attendance',
        href: '/dashboard/attendance',
        icon: CalendarCheck,
        iconColor: 'text-green-500',
      },
      {
        id: 'leaves',
        label: 'Leaves',
        href: '/dashboard/leaves',
        icon: CalendarDays,
        iconColor: 'text-teal-500',
      },
      {
        id: 'fees',
        label: 'Fees',
        href: '/dashboard/fees',
        icon: IndianRupee,
        iconColor: 'text-rose-500',
        rbacKey: 'canAccessFees',
      },
      {
        id: 'exams',
        label: 'Examinations',
        href: '/dashboard/examinations',
        icon: FileText,
        iconColor: 'text-purple-500',
      },
      {
        id: 'homework',
        label: 'Homework',
        href: '/dashboard/homework',
        icon: Pencil,
        iconColor: 'text-pink-500',
      },
    ],
  },
  {
    label: 'Pickup',
    items: [
      {
        id: 'pickup-scan',
        label: 'Scan QR',
        href: '/dashboard/pickup/scan',
        icon: QrCode,
        iconColor: 'text-cyan-500',
      },
      {
        id: 'pickup-history',
        label: 'Pickup History',
        href: '/dashboard/pickup/history',
        icon: ClipboardList,
        iconColor: 'text-slate-400',
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
        iconColor: 'text-amber-500',
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
        iconColor: 'text-lime-600',
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
        iconColor: 'text-blue-500',
        rbacKey: 'canAccessHR',
      },
      {
        id: 'hr-attendance',
        label: 'Staff Attendance',
        href: '/dashboard/hr/staff-attendance',
        icon: Clock,
        iconColor: 'text-emerald-500',
        rbacKey: 'canAccessHR',
      },
      {
        id: 'hr-leaves',
        label: 'Staff Leaves',
        href: '/dashboard/hr/leaves',
        icon: CalendarDays,
        iconColor: 'text-teal-500',
        rbacKey: 'canAccessHR',
      },
      {
        id: 'hr-policies',
        label: 'Leave Policies',
        href: '/dashboard/hr/leave-policies',
        icon: ScrollText,
        iconColor: 'text-violet-500',
        rbacKey: 'canAccessHR',
      },
      {
        id: 'hr-payroll',
        label: 'Payroll',
        href: '/dashboard/hr/payroll',
        icon: IndianRupee,
        iconColor: 'text-rose-500',
        rbacKey: 'canManagePayroll',
      },
      {
        id: 'hr-salary',
        label: 'Salary Config',
        href: '/dashboard/hr/salary-config',
        icon: Settings,
        iconColor: 'text-orange-500',
        rbacKey: 'canAccessHR',
      },
      {
        id: 'hr-zones',
        label: 'Attendance Zones',
        href: '/dashboard/hr/staff-attendance/zones',
        icon: MapPin,
        iconColor: 'text-sky-500',
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
        iconColor: 'text-emerald-500',
        rbacKey: 'canAccessHRSelfService',
      },
      {
        id: 'my-leaves',
        label: 'My Leaves',
        href: '/dashboard/my-leaves',
        icon: CalendarDays,
        iconColor: 'text-teal-500',
        rbacKey: 'canAccessHRSelfService',
      },
      {
        id: 'my-salary',
        label: 'My Salary',
        href: '/dashboard/my-salary',
        icon: IndianRupee,
        iconColor: 'text-rose-500',
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
        iconColor: 'text-red-500',
        rbacKey: 'canAccessAdminPanel',
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
        iconColor: 'text-sky-500',
      },
      {
        id: 'settings',
        label: 'Settings',
        href: '/dashboard/settings',
        icon: Settings,
        iconColor: 'text-slate-400',
      },
    ],
  },
];
