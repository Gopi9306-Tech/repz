import {
  Bell,
  CalendarClock,
  CheckSquare,
  History,
  LayoutDashboard,
  Settings,
  Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface NavItem {
  path: string;
  label: string;
  shortLabel: string;
  title: string;
  subtitle: string;
  icon: LucideIcon;
  badge?: string;
}

export const NAV_ITEMS: NavItem[] = [
  {
    path: '/dashboard',
    label: 'Dashboard',
    shortLabel: 'Home',
    title: 'Class Overview',
    subtitle: 'Today’s schedule & shared rep status',
    icon: LayoutDashboard,
  },
  {
    path: '/attendance',
    label: 'Attendance',
    shortLabel: 'Mark',
    title: 'Mark Attendance',
    subtitle: 'Tap students to mark present or absent',
    icon: CheckSquare,
  },
  {
    path: '/timetable',
    label: 'Timetable Setup',
    shortLabel: 'Timetable',
    title: 'Timetable Setup',
    subtitle: 'Manage weekly class periods & rooms',
    icon: CalendarClock,
  },
  {
    path: '/students',
    label: 'Student Details',
    shortLabel: 'Students',
    title: 'Student Directory',
    subtitle: 'Class roster & individual attendance records',
    icon: Users,
  },
  {
    path: '/history',
    label: 'Attendance History',
    shortLabel: 'History',
    title: 'Attendance History',
    subtitle: 'Submitted period logs across both reps',
    icon: History,
  },
  {
    path: '/reminders',
    label: 'Reminders',
    shortLabel: 'Reminders',
    title: 'Rep Reminders',
    subtitle: 'Period alerts & follow-up tasks',
    icon: Bell,
    badge: '4',
  },
  {
    path: '/settings',
    label: 'Settings',
    shortLabel: 'Settings',
    title: 'Class & Rep Settings',
    subtitle: 'Co-rep pairing, theme & preferences',
    icon: Settings,
  },
];

export const PRIMARY_MOBILE_PATHS = ['/dashboard', '/attendance', '/students', '/history'];
