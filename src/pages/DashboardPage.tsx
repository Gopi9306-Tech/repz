import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Bell,
  Calendar,
  CalendarClock,
  CalendarDays,
  Check,
  CheckCircle2,
  CheckSquare,
  Clock,
  History,
  MapPin,
  Plus,
  ShieldCheck,
  Users,
  Users2,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  AttendanceSessionRecord,
  DayOrder,
  PeriodSlot,
  ReminderCategory,
  ReminderItem,
  ReminderPriority,
  Student,
} from '../types';
import { studentService } from '../services/studentService';
import { timetableService } from '../services/timetableService';
import { attendanceService } from '../services/attendanceService';
import { remindersService } from '../services/remindersService';
import { formatDateDisplayIST, getTodayDateIST } from '../utils/retentionUtils';
import { Avatar } from '../components/ui/Avatar';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Modal } from '../components/ui/Modal';
import { StatTile } from '../components/ui/StatTile';
import { Toast } from '../components/ui/Toast';

export const DashboardPage: React.FC = () => {
  const { activeRep, coRep, classProfile } = useAuth();
  const classId = classProfile.id;
  const navigate = useNavigate();

  // State: Core data
  const [students, setStudents] = useState<Student[]>([]);
  const [sessions, setSessions] = useState<AttendanceSessionRecord[]>([]);
  const [dayOrders, setDayOrders] = useState<DayOrder[]>([]);
  const [periodSlots, setPeriodSlots] = useState<PeriodSlot[]>([]);
  const [selectedDayOrder, setSelectedDayOrder] = useState<DayOrder | null>(null);
  const [liveReminders, setLiveReminders] = useState<ReminderItem[]>([]);

  // Quick Add Reminder Modal State
  const [addReminderModalOpen, setAddReminderModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState<ReminderCategory>('Assignments');
  const [newDueDate, setNewDueDate] = useState(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  });
  const [newDueTime, setNewDueTime] = useState('11:59 PM');
  const [newPriority, setNewPriority] = useState<ReminderPriority>('normal');
  const [newDescription, setNewDescription] = useState('');
  const [isSubmittingReminder, setIsSubmittingReminder] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const todayDate = useMemo(() => getTodayDateIST(), []);

  // 1. Load all live data
  const loadDashboardData = async () => {
    try {
      const [studentList, sessionList, sems, reminderList] = await Promise.all([
        studentService.getStudents(classId),
        attendanceService.getAllSessions(classId),
        timetableService.getSemesters(classId),
        remindersService.getReminders(classId),
      ]);

      setStudents(studentList);
      setSessions(sessionList);
      setLiveReminders(reminderList);

      const currentSem = sems.find((s) => s.isActive) || sems[0];

      if (currentSem) {
        const [dos, slots] = await Promise.all([
          timetableService.getDayOrders(currentSem.id),
          timetableService.getPeriodSlots(currentSem.id),
        ]);
        setDayOrders(dos);
        setPeriodSlots(slots);

        // Fetch or initialize today's day order
        const savedDo = await timetableService.getDailyDayOrder(classId, todayDate);
        if (savedDo) {
          setSelectedDayOrder(savedDo);
        } else if (dos.length > 0) {
          setSelectedDayOrder(dos[0]);
          await timetableService.setDailyDayOrder(classId, todayDate, dos[0], activeRep.id);
        }
      }
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, [classId, todayDate]);

  // Handle Day Order Switching directly from Dashboard
  const handleSelectDayOrder = async (doItem: DayOrder) => {
    setSelectedDayOrder(doItem);
    try {
      await timetableService.setDailyDayOrder(classId, todayDate, doItem, activeRep.id);
      setToastMessage(`Today set to ${doItem.name} (${doItem.code})`);
    } catch (err) {
      console.error('Error saving today day order:', err);
    }
  };

  // Periods configured for the currently selected Day Order
  const todayPeriodSlots = useMemo(() => {
    if (!selectedDayOrder) return [];
    return periodSlots
      .filter((s) => s.dayOrderId === selectedDayOrder.id)
      .sort((a, b) => a.periodNumber - b.periodNumber);
  }, [periodSlots, selectedDayOrder]);

  // Today's attendance sessions recorded so far
  const todaySessions = useMemo(() => {
    return sessions.filter((s) => s.date === todayDate);
  }, [sessions, todayDate]);

  // Calculate metrics for today
  const todayMarkedCount = todaySessions.length;
  const todayTotalPeriods = todayPeriodSlots.length || 5;

  const todayPresentSum = useMemo(() => {
    return todaySessions.reduce((acc, s) => acc + s.presentCount, 0);
  }, [todaySessions]);

  const todayAbsentSum = useMemo(() => {
    return todaySessions.reduce((acc, s) => acc + s.absentCount, 0);
  }, [todaySessions]);

  const todayAttendancePercentage = useMemo(() => {
    const totalRecorded = todayPresentSum + todayAbsentSum;
    if (totalRecorded === 0) return null;
    return Math.round((todayPresentSum / totalRecorded) * 100);
  }, [todayPresentSum, todayAbsentSum]);

  // Overall class average attendance
  const overallClassAverage = useMemo(() => {
    if (students.length === 0) return 88;
    const total = students.reduce((acc, s) => acc + (s.attendancePercentage ?? 100), 0);
    return Math.round(total / students.length);
  }, [students]);

  // Watchlist: Students below 75%
  const lowAttendanceStudents = useMemo(() => {
    return students.filter((s) => (s.attendancePercentage ?? 100) < 75);
  }, [students]);

  // Upcoming Reminders
  const pendingReminders = useMemo(() => {
    return liveReminders
      .filter((r) => !r.completed)
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  }, [liveReminders]);

  // Recent Attendance Activity (latest 4 records across the 7-day retention window)
  const recentSessions = useMemo(() => {
    return [...sessions].slice(0, 4);
  }, [sessions]);

  // Handle Quick Add Reminder Submit
  const handleCreateReminderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    setIsSubmittingReminder(true);
    try {
      const created = await remindersService.createReminder(classId, {
        title: newTitle.trim(),
        category: newCategory,
        dueDate: newDueDate,
        dueTime: newDueTime,
        priority: newPriority,
        description: newDescription.trim(),
        assignedToRepId: 'both',
      });

      setLiveReminders((prev) => [created, ...prev]);
      setAddReminderModalOpen(false);
      setNewTitle('');
      setNewDescription('');
      setToastMessage('Reminder added successfully');
    } catch (err) {
      console.error('Failed to create reminder:', err);
      setToastMessage('Failed to create reminder');
    } finally {
      setIsSubmittingReminder(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* ========================================================================= */}
      {/* 1. TOP CLASS HERO CARD (WhatsApp-inspired Azure header + 2-Rep Sync)       */}
      {/* ========================================================================= */}
      <Card className="overflow-hidden border-[#0878D1]/20 bg-gradient-to-br from-white via-white to-[#EAF4FC] dark:border-[#0878D1]/30 dark:from-[#111B27] dark:via-[#111B27] dark:to-[#0878D1]/15">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="primary">{classProfile.classCode}</Badge>
              <Badge variant="success" dot>
                2 Reps Connected
              </Badge>
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
                <Calendar className="h-3.5 w-3.5 text-[#0878D1]" />
                {formatDateDisplayIST(todayDate)}
              </span>
              <span className="hidden rounded-full bg-[#EAF4FC] px-2.5 py-0.5 text-[11px] font-semibold text-[#005A9E] sm:inline-flex items-center gap-1 dark:bg-[#0878D1]/20 dark:text-[#7CC4FA]">
                <ShieldCheck className="h-3 w-3 text-[#0878D1]" />
                7-Day Clean Retention Active
              </span>
            </div>

            <h2 className="font-display text-xl font-bold tracking-tight text-slate-900 sm:text-2xl dark:text-white">
              Welcome back, {activeRep.fullName.split(' ')[0]}
            </h2>
            <p className="text-xs text-slate-600 sm:text-sm dark:text-slate-300">
              {classProfile.department} • {classProfile.semester} ({classProfile.section}) • Shared with Co-Rep{' '}
              <span className="font-semibold text-slate-800 dark:text-slate-200">{coRep.fullName}</span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              onClick={() =>
                navigate(
                  `/attendance?date=${todayDate}&dayOrder=${selectedDayOrder?.code || 'A'}&period=${
                    todaySessions.length + 1 <= todayTotalPeriods ? todaySessions.length + 1 : 1
                  }`
                )
              }
              leftIcon={<CheckSquare className="h-4 w-4" />}
            >
              Mark Attendance
            </Button>
            <Button
              variant="secondary"
              onClick={() => setAddReminderModalOpen(true)}
              leftIcon={<Plus className="h-4 w-4" />}
            >
              Add Reminder
            </Button>
          </div>
        </div>
      </Card>

      {/* ========================================================================= */}
      {/* 2. COMPACT QUICK ACTIONS BAR (WhatsApp Rounded Action Pills)               */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <button
          type="button"
          onClick={() =>
            navigate(
              `/attendance?date=${todayDate}&dayOrder=${selectedDayOrder?.code || 'A'}`
            )
          }
          className="flex items-center gap-3 rounded-2xl border border-[#0878D1]/25 bg-[#EAF4FC]/90 p-3 text-left transition-all hover:bg-[#EAF4FC] active:scale-[0.98] cursor-pointer dark:border-[#0878D1]/40 dark:bg-[#0878D1]/15 dark:hover:bg-[#0878D1]/25"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#0878D1] text-white shadow-xs">
            <CheckSquare className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-xs font-bold text-[#005A9E] dark:text-[#7CC4FA]">
              Mark Attendance
            </p>
            <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">
              Period register
            </p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => navigate('/students')}
          className="flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white p-3 text-left transition-all hover:bg-slate-50 active:scale-[0.98] cursor-pointer dark:border-slate-800 dark:bg-[#111B27] dark:hover:bg-[#172434]"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
            <Users className="h-5 w-5 text-[#0878D1]" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-xs font-bold text-slate-900 dark:text-slate-100">
              View Students
            </p>
            <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">
              {students.length} on roster
            </p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => navigate('/timetable')}
          className="flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white p-3 text-left transition-all hover:bg-slate-50 active:scale-[0.98] cursor-pointer dark:border-slate-800 dark:bg-[#111B27] dark:hover:bg-[#172434]"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
            <CalendarDays className="h-5 w-5 text-[#0878D1]" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-xs font-bold text-slate-900 dark:text-slate-100">
              View Timetable
            </p>
            <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">
              Semester schedule
            </p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setAddReminderModalOpen(true)}
          className="flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white p-3 text-left transition-all hover:bg-slate-50 active:scale-[0.98] cursor-pointer dark:border-slate-800 dark:bg-[#111B27] dark:hover:bg-[#172434]"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
            <Bell className="h-5 w-5 text-[#0878D1]" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-xs font-bold text-slate-900 dark:text-slate-100">
              Add Reminder
            </p>
            <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">
              Deadlines & tests
            </p>
          </div>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* 3. CORE SUMMARY METRICS (Compact Tiles with Present/Absent counts)        */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        {/* Total Students */}
        <StatTile
          label="Total Students"
          value={students.length}
          helper={`${classProfile.classCode} active roster`}
          icon={<Users className="h-5 w-5" />}
          tone="primary"
        />

        {/* Today's Attendance Summary */}
        <StatTile
          label="Today's Periods"
          value={`${todayMarkedCount} / ${todayTotalPeriods}`}
          helper={
            todayMarkedCount === todayTotalPeriods
              ? 'All periods marked'
              : `${todayTotalPeriods - todayMarkedCount} period(s) remaining`
          }
          icon={<Clock className="h-5 w-5" />}
          tone="primary"
        />

        {/* Present & Absent Counts */}
        <div className="rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-2xs transition-all hover:border-[#0878D1]/30 dark:border-slate-800 dark:bg-[#111B27]">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
              Today&apos;s Attendance
            </span>
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              <span className="h-2 w-2 rounded-full bg-red-500" />
            </div>
          </div>
          <div className="mt-1.5 flex items-baseline gap-2">
            <span className="font-display text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {todayPresentSum}
            </span>
            <span className="text-xs font-medium text-slate-400">present</span>
            <span className="text-slate-300 dark:text-slate-600">•</span>
            <span className="font-display text-2xl font-bold text-red-600 dark:text-red-400">
              {todayAbsentSum}
            </span>
            <span className="text-xs font-medium text-slate-400">absent</span>
          </div>
          <p className="mt-0.5 truncate text-[11px] text-slate-500 dark:text-slate-400">
            {todayMarkedCount > 0 ? `Across ${todayMarkedCount} marked period(s)` : 'No periods recorded yet'}
          </p>
        </div>

        {/* Attendance Percentage */}
        <StatTile
          label="Attendance Rate"
          value={
            todayAttendancePercentage !== null
              ? `${todayAttendancePercentage}%`
              : `${overallClassAverage}%`
          }
          helper={
            todayAttendancePercentage !== null
              ? "Today's recorded average"
              : 'Class semester average'
          }
          icon={<CheckCircle2 className="h-5 w-5" />}
          tone="neutral"
        />
      </div>

      {/* ========================================================================= */}
      {/* 4. MAIN SPLIT: TODAY'S TIMETABLE + ACTIVITY / REMINDERS                   */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        {/* LEFT COLUMN: Day Order Selector + Today's Timetable + Recent Activity */}
        <div className="space-y-5 lg:col-span-7">
          {/* Day Order Selector & Today's Timetable Card */}
          <Card padding="none" className="overflow-hidden">
            {/* Header with Day Order Selector */}
            <div className="border-b border-slate-100 bg-slate-50/70 p-4 dark:border-slate-800 dark:bg-[#172434]/50">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <CalendarClock className="h-4 w-4 text-[#0878D1]" />
                    <h3 className="font-display text-base font-bold text-slate-900 dark:text-slate-100">
                      Today&apos;s Timetable
                    </h3>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Day order controls periods & subjects for attendance
                  </p>
                </div>

                <Link
                  to="/timetable"
                  className="text-xs font-semibold text-[#0878D1] hover:text-[#005A9E] dark:text-[#66B8FA]"
                >
                  Edit Semester Setup →
                </Link>
              </div>

              {/* Day Order Selector Pills */}
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                <span className="mr-1 text-xs font-medium text-slate-600 dark:text-slate-300">
                  Day Order:
                </span>
                {dayOrders.map((dOrder) => {
                  const isSelected = selectedDayOrder?.id === dOrder.id;
                  return (
                    <button
                      key={dOrder.id}
                      type="button"
                      onClick={() => handleSelectDayOrder(dOrder)}
                      className={`flex h-8 items-center gap-1.5 rounded-xl px-3 text-xs font-semibold transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-[#0878D1] text-white shadow-xs'
                          : 'bg-white text-slate-700 hover:bg-slate-100 border border-slate-200/80 dark:border-slate-700 dark:bg-[#111B27] dark:text-slate-300 dark:hover:bg-slate-800'
                      }`}
                    >
                      <span>{dOrder.code}</span>
                      {isSelected && <Check className="h-3 w-3 stroke-[3]" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* List of Periods for Selected Day Order */}
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {todayPeriodSlots.length === 0 ? (
                <div className="p-8 text-center">
                  <CalendarClock className="mx-auto h-8 w-8 text-slate-300" />
                  <p className="mt-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
                    No periods scheduled for Day Order {selectedDayOrder?.code || ''}
                  </p>
                  <p className="text-xs text-slate-500">
                    Configure periods and subjects in the Timetable module.
                  </p>
                </div>
              ) : (
                todayPeriodSlots.map((period) => {
                  const marked = todaySessions.find(
                    (s) => s.periodNumber === period.periodNumber
                  );

                  return (
                    <div
                      key={period.id}
                      className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between transition-colors hover:bg-slate-50/70 dark:hover:bg-[#172434]/40"
                    >
                      <div className="flex min-w-0 items-center gap-3.5">
                        {/* Period Number Box */}
                        <div
                          className={`flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-2xl text-xs font-bold ${
                            marked
                              ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                              : 'bg-[#EAF4FC] text-[#005A9E] dark:bg-[#0878D1]/20 dark:text-[#7CC4FA]'
                          }`}
                        >
                          <span className="text-[10px] font-medium opacity-75">
                            P{period.periodNumber}
                          </span>
                          <span>{period.startTime.split(' ')[0]}</span>
                        </div>

                        {/* Subject & Timing */}
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                              {period.subjectName}
                            </p>
                            <Badge variant="neutral">{period.subjectCode}</Badge>
                            <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                              {period.sessionType}
                            </span>
                          </div>
                          <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                            <span>
                              {period.startTime} – {period.endTime}
                            </span>
                            <span>•</span>
                            <span className="inline-flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {period.room}
                            </span>
                          </p>
                        </div>
                      </div>

                      {/* Status & Actions */}
                      <div className="flex shrink-0 items-center gap-2 sm:flex-col sm:items-end">
                        {marked ? (
                          <>
                            <div className="flex items-center gap-1.5">
                              <Badge variant="success">
                                <CheckCircle2 className="h-3 w-3" />
                                Marked
                              </Badge>
                              <span className="text-xs font-semibold text-red-600 dark:text-red-400">
                                {marked.absentCount} absent
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                              <span>by {marked.markedByRepName.split(' ')[0]}</span>
                              <span>•</span>
                              <button
                                type="button"
                                onClick={() =>
                                  navigate(
                                    `/attendance?date=${todayDate}&dayOrder=${
                                      selectedDayOrder?.code || 'A'
                                    }&period=${period.periodNumber}`
                                  )
                                }
                                className="font-semibold text-[#0878D1] hover:underline cursor-pointer dark:text-[#66B8FA]"
                              >
                                Edit
                              </button>
                            </div>
                          </>
                        ) : (
                          <>
                            <Badge variant="primary">Pending</Badge>
                            <Button
                              size="sm"
                              variant="primary"
                              onClick={() =>
                                navigate(
                                  `/attendance?date=${todayDate}&dayOrder=${
                                    selectedDayOrder?.code || 'A'
                                  }&period=${period.periodNumber}`
                                )
                              }
                            >
                              Mark Now
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </Card>

          {/* Recent Attendance Activity Card (Connected to 7-Day History) */}
          <Card padding="none" className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <History className="h-4 w-4 text-[#0878D1]" />
                <div>
                  <h3 className="font-display text-base font-bold text-slate-900 dark:text-slate-100">
                    Recent Attendance Activity
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Latest submissions within the active 7-day retention window
                  </p>
                </div>
              </div>

              <Link
                to="/history"
                className="inline-flex items-center gap-1 text-xs font-semibold text-[#0878D1] hover:text-[#005A9E] dark:text-[#66B8FA]"
              >
                View 7-Day History <ArrowRight className="h-3 w-3" />
              </Link>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {recentSessions.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-500">
                  No attendance sessions recorded yet.
                </div>
              ) : (
                recentSessions.map((rec) => {
                  const isToday = rec.date === todayDate;
                  return (
                    <div
                      key={rec.id}
                      onClick={() =>
                        navigate(
                          `/attendance?date=${rec.date}&dayOrder=${rec.dayOrderCode}&period=${rec.periodNumber}`
                        )
                      }
                      className="flex items-center justify-between gap-3 px-5 py-3.5 transition-colors hover:bg-slate-50/80 cursor-pointer dark:hover:bg-[#172434]/60"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-xl bg-slate-100 text-xs font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                          <span className="text-[9px] font-medium opacity-75">DO-{rec.dayOrderCode}</span>
                          <span>P{rec.periodNumber}</span>
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                              {rec.subjectName}
                            </p>
                            <Badge variant="neutral">{rec.subjectCode}</Badge>
                          </div>
                          <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                            <span className="font-medium text-slate-700 dark:text-slate-300">
                              {isToday ? 'Today' : formatDateDisplayIST(rec.date)}
                            </span>
                            <span>•</span>
                            <span>Marked by {rec.markedByRepName.split(' ')[0]}</span>
                          </p>
                        </div>
                      </div>

                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                            {rec.presentCount} P
                          </span>
                          <span className="text-xs font-bold text-red-600 dark:text-red-400">
                            {rec.absentCount} A
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-400">Tap to edit</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </Card>
        </div>

        {/* RIGHT COLUMN: Shared Representatives + Upcoming Reminders + Watchlist */}
        <div className="space-y-5 lg:col-span-5">
          {/* Shared Class Representatives Card */}
          <Card>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users2 className="h-4.5 w-4.5 text-[#0878D1]" />
                <h3 className="font-display text-sm font-bold text-slate-900 dark:text-slate-100">
                  Shared Class Representatives
                </h3>
              </div>
              <Badge variant="success" dot>
                Synchronized
              </Badge>
            </div>

            <div className="mt-3.5 space-y-2.5">
              {classProfile.representatives.map((rep) => {
                const isYou = rep.id === activeRep.id;
                return (
                  <div
                    key={rep.id}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50/70 p-2.5 dark:border-slate-800 dark:bg-[#0E1621]"
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <Avatar
                        name={rep.fullName}
                        size="sm"
                        variant={isYou ? 'primary' : 'tint'}
                        online={rep.isOnline}
                      />
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold text-slate-900 dark:text-slate-100">
                          {rep.fullName}{' '}
                          {isYou && (
                            <span className="text-[#0878D1] dark:text-[#66B8FA]">(You)</span>
                          )}
                        </p>
                        <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                          {rep.slot} • {rep.lastActive}
                        </p>
                      </div>
                    </div>
                    <Badge variant={isYou ? 'primary' : 'neutral'}>{rep.rollNumber}</Badge>
                  </div>
                );
              })}
              <p className="text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                Both representatives share real-time access to student records, timetable configuration, attendance, and reminders.
              </p>
            </div>
          </Card>

          {/* Upcoming Class Reminders Preview */}
          <Card padding="none" className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3.5 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4 text-[#0878D1]" />
                <h3 className="font-display text-sm font-bold text-slate-900 dark:text-slate-100">
                  Upcoming Class Reminders
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setAddReminderModalOpen(true)}
                  className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-900 cursor-pointer dark:hover:bg-slate-800"
                  title="Add reminder"
                >
                  <Plus className="h-4 w-4" />
                </button>
                <Link
                  to="/reminders"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-[#0878D1] hover:text-[#005A9E] dark:text-[#66B8FA]"
                >
                  View all ({pendingReminders.length}) <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {pendingReminders.length === 0 ? (
                <div className="p-5 text-center text-xs text-slate-500">
                  No pending reminders scheduled.
                </div>
              ) : (
                pendingReminders.slice(0, 3).map((item) => (
                  <Link
                    key={item.id}
                    to="/reminders"
                    className="flex items-start justify-between gap-3 px-4 py-3 transition-colors hover:bg-slate-50 dark:hover:bg-[#172434]/70"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-xs font-semibold text-slate-900 dark:text-slate-100">
                          {item.title}
                        </p>
                        {item.priority === 'high' && (
                          <span className="h-1.5 w-1.5 rounded-full bg-red-600" title="High priority" />
                        )}
                        {item.googleCalendarEventId && (
                          <span className="text-[10px] text-emerald-600 font-medium">✓ Cal</span>
                        )}
                      </div>
                      <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
                        {formatDateDisplayIST(item.dueDate)} • {item.dueTime}
                      </p>
                    </div>
                    <Badge variant={item.category === 'Examinations' ? 'absent' : 'primary'}>
                      {item.category}
                    </Badge>
                  </Link>
                ))
              )}
            </div>
          </Card>

          {/* Below 75% Watchlist */}
          <Card>
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-display text-sm font-bold text-slate-900 dark:text-slate-100">
                  Below 75% Watchlist
                </h3>
                <p className="text-[11px] text-slate-500">Requires representative intervention</p>
              </div>
              <Link
                to="/students"
                className="inline-flex items-center gap-1 text-xs font-semibold text-[#0878D1] dark:text-[#66B8FA]"
              >
                All students ({students.length}) →
              </Link>
            </div>

            <div className="mt-3 space-y-2">
              {lowAttendanceStudents.length === 0 ? (
                <p className="py-2 text-center text-xs text-emerald-600 font-medium">
                  Great job! All students are currently above 75%.
                </p>
              ) : (
                lowAttendanceStudents.map((stu) => (
                  <div
                    key={stu.id}
                    className="flex items-center justify-between gap-2 rounded-xl bg-red-50/70 px-3 py-2 dark:bg-red-950/30"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-slate-900 dark:text-slate-100">
                        {stu.name}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        {stu.rollNumber} • {stu.classesAttended ?? 0}/{stu.totalClasses ?? 0} classes
                      </p>
                    </div>
                    <Badge variant="absent">{stu.attendancePercentage}%</Badge>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 5. ADD REMINDER QUICK MODAL (Inline Dashboard Action)                     */}
      {/* ========================================================================= */}
      <Modal
        open={addReminderModalOpen}
        onClose={() => setAddReminderModalOpen(false)}
        title="Add New Reminder"
        maxWidthClass="max-w-md"
      >
        <form onSubmit={handleCreateReminderSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="e.g., DBMS Assignment 2 Submission"
              className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#0878D1] focus:outline-hidden dark:border-slate-700 dark:bg-[#111B27] dark:text-slate-100"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Category
              </label>
              <select
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value as ReminderCategory)}
                className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#0878D1] focus:outline-hidden dark:border-slate-700 dark:bg-[#111B27] dark:text-slate-100"
              >
                <option value="Assignments">Assignments</option>
                <option value="Examinations">Examinations</option>
                <option value="Submissions">Submissions</option>
                <option value="College Events">College Events</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Priority
              </label>
              <select
                value={newPriority}
                onChange={(e) => setNewPriority(e.target.value as ReminderPriority)}
                className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#0878D1] focus:outline-hidden dark:border-slate-700 dark:bg-[#111B27] dark:text-slate-100"
              >
                <option value="normal">Normal</option>
                <option value="high">High</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Due Date
              </label>
              <input
                type="date"
                required
                value={newDueDate}
                onChange={(e) => setNewDueDate(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#0878D1] focus:outline-hidden dark:border-slate-700 dark:bg-[#111B27] dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Due Time
              </label>
              <input
                type="text"
                value={newDueTime}
                onChange={(e) => setNewDueTime(e.target.value)}
                placeholder="11:59 PM"
                className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#0878D1] focus:outline-hidden dark:border-slate-700 dark:bg-[#111B27] dark:text-slate-100"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Description
            </label>
            <textarea
              rows={2}
              value={newDescription}
              onChange={(e) => setNewDescription(e.target.value)}
              placeholder="Instructions or notes for students..."
              className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-[#0878D1] focus:outline-hidden dark:border-slate-700 dark:bg-[#111B27] dark:text-slate-100"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setAddReminderModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmittingReminder}>
              {isSubmittingReminder ? 'Adding...' : 'Save Reminder'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Toast Notification */}
      {toastMessage && (
        <Toast
          message={toastMessage}
          type="success"
          onDismiss={() => setToastMessage(null)}
        />
      )}
    </div>
  );
};
