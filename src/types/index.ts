export type RepSlot = 'Primary Rep' | 'Co-Rep';

export interface Representative {
  id: string;
  username?: string;
  fullName: string;
  rollNumber: string;
  email: string;
  phone: string;
  slot: RepSlot;
  avatarInitials: string;
  avatarUrl?: string;
  lastActive: string;
  isOnline: boolean;
  authUserId?: string;
}

export interface ClassProfile {
  id: string;
  classCode: string;
  department: string;
  semester: string;
  section: string;
  academicYear: string;
  totalStudents: number;
  classJoinCode: string;
  representatives: [Representative, Representative];
}

export type AttendanceStatus = 'present' | 'absent';

/**
 * Customizable additional column definition
 */
export interface CustomColumn {
  id: string;
  name: string;
  key: string;
  dataType: 'text' | 'number' | 'select' | 'boolean';
  options?: string[];
}

/**
 * Core student record representation
 */
export interface Student {
  id: string;
  classId?: string;
  registerNumber: string;
  name: string;
  rollNumber?: string;
  email?: string;
  phone?: string;
  attendancePercentage?: number;
  classesAttended?: number;
  totalClasses?: number;
  recentStreak?: AttendanceStatus[];
  notes?: string;
  extraData?: Record<string, string | number | boolean | null>;
}

export type DayOfWeek = 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday';

// ==============================================================================
// SEMESTER & DAY ORDER TIMETABLE DOMAIN MODELS
// ==============================================================================

export interface Semester {
  id: string;
  classId: string;
  name: string;
  academicYear: string;
  startDate: string;
  endDate: string;
  totalPeriodsPerDay: number;
  isActive: boolean;
  createdAt?: string;
}

export interface DayOrder {
  id: string;
  semesterId: string;
  code: string;
  name: string;
  description?: string;
  sortOrder: number;
}

export interface Subject {
  id: string;
  semesterId: string;
  code: string;
  name: string;
  color: string;
  sessionType: 'Lecture' | 'Lab' | 'Tutorial';
  facultyName?: string;
}

export interface PeriodSlot {
  id: string;
  semesterId: string;
  dayOrderId: string;
  periodNumber: number;
  startTime: string;
  endTime: string;
  subjectId?: string;
  subjectCode?: string;
  subjectName?: string;
  sessionType?: 'Lecture' | 'Lab' | 'Tutorial';
  room: string;
  notes?: string;
}

export interface DailyDayOrderLog {
  id: string;
  classId: string;
  date: string;
  dayOrderId: string;
  selectedByRepId?: string;
}

export interface TimetablePeriod {
  id: string;
  day?: DayOfWeek;
  dayOrderCode?: string;
  periodNumber: number;
  startTime: string;
  endTime: string;
  subjectCode: string;
  subjectName: string;
  room: string;
  sessionType: 'Lecture' | 'Lab' | 'Tutorial';
}

// ==============================================================================
// ATTENDANCE SESSION & RECORD TYPES
// ==============================================================================

export interface AttendanceSessionRecord {
  id: string;
  classId: string;
  semesterId?: string;
  date: string;
  dayOrderId?: string;
  dayOrderCode: string;
  periodNumber: number;
  timeRange: string;
  subjectId?: string;
  subjectCode: string;
  subjectName: string;
  room?: string;
  totalStudents: number;
  presentCount: number;
  absentCount: number;
  markedByRepId: string;
  markedByRepName: string;
  markedAt: string;
  updatedAt: string;
  absentStudentIds: string[];
  presentStudentIds: string[];
  studentStatuses: Record<string, AttendanceStatus>;
  synced: boolean;
}

export interface AttendanceRecordSummary {
  id: string;
  date: string;
  day?: DayOfWeek;
  dayOrderCode?: string;
  periodNumber: number;
  timeRange: string;
  subjectCode: string;
  subjectName: string;
  presentCount: number;
  absentCount: number;
  totalStudents: number;
  markedByRepId: string;
  markedByRepName: string;
  markedAt: string;
  absentStudentIds: string[];
  synced: boolean;
}

// ==============================================================================
// REMINDERS DOMAIN MODEL
// ==============================================================================

export type ReminderCategory =
  | 'Assignments'
  | 'Examinations'
  | 'Submissions'
  | 'College Events';

export type ReminderPriority = 'high' | 'normal';

export interface ReminderItem {
  id: string;
  classId?: string;
  title: string;
  description: string;
  dueDate: string;              // YYYY-MM-DD
  dueTime: string;              // e.g. "11:30 AM", "05:00 PM"
  dueDateLabel?: string;        // e.g. "Today", "Tomorrow", "Fri, Dec 4"
  category: ReminderCategory;
  priority: ReminderPriority;
  completed: boolean;
  assignedToRepId: string | 'both';
  googleCalendarEventId?: string; // Stored event ID to prevent duplicate calendar events
  googleCalendarSyncedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}
