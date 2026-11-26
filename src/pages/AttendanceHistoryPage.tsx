import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BookOpen,
  Calendar,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Edit2,
  History,
  Info,
  MapPin,
  RefreshCw,
  Search,
  UserCheck,
  UserX,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { AttendanceSessionRecord, Student } from '../types';
import { attendanceService } from '../services/attendanceService';
import { studentService } from '../services/studentService';
import {
  formatDateDisplayIST,
  getRetentionCutoffDateIST,
  getRetentionDateRange,
  getTodayDateIST,
} from '../utils/retentionUtils';
import { Avatar } from '../components/ui/Avatar';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Modal } from '../components/ui/Modal';

type FilterScope = '7days' | 'today' | 'with-absentees' | 'mine' | 'corep';

export const AttendanceHistoryPage: React.FC = () => {
  const { activeRep, coRep, classProfile } = useAuth();
  const classId = classProfile.id;
  const navigate = useNavigate();

  // State
  const [sessions, setSessions] = useState<AttendanceSessionRecord[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDateFilter, setSelectedDateFilter] = useState<string>('all');
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState<string>('all');
  const [filterScope, setFilterScope] = useState<FilterScope>('7days');

  // Detail Modal
  const [selectedSession, setSelectedSession] = useState<AttendanceSessionRecord | null>(null);

  // Retention Cutoff in Asia/Kolkata
  const todayIST = useMemo(() => getTodayDateIST(), []);
  const cutoffDateIST = useMemo(() => getRetentionCutoffDateIST(7), []);
  const retentionDates = useMemo(() => getRetentionDateRange(7), []);

  // Load live attendance records
  const loadHistory = async () => {
    setIsLoading(true);
    try {
      const [fetchedSessions, fetchedStudents] = await Promise.all([
        attendanceService.getAllSessions(classId),
        studentService.getStudents(classId),
      ]);
      setSessions(fetchedSessions);
      setStudents(fetchedStudents);
    } catch (err) {
      console.error('Failed to load attendance history:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, [classId]);

  // Unique list of subjects present in the records for filtering
  const availableSubjects = useMemo(() => {
    const map = new Map<string, string>();
    sessions.forEach((s) => {
      map.set(s.subjectCode, s.subjectName);
    });
    return Array.from(map.entries()).map(([code, name]) => ({ code, name }));
  }, [sessions]);

  // Filtered Sessions
  const filteredSessions = useMemo(() => {
    return sessions.filter((s) => {
      // 1. Date Filter
      if (selectedDateFilter !== 'all' && s.date !== selectedDateFilter) {
        return false;
      }

      // 2. Subject Filter
      if (selectedSubjectFilter !== 'all' && s.subjectCode !== selectedSubjectFilter) {
        return false;
      }

      // 3. Quick Scope Filter
      if (filterScope === 'today' && s.date !== todayIST) return false;
      if (filterScope === 'with-absentees' && s.absentCount === 0) return false;
      if (filterScope === 'mine' && s.markedByRepId !== activeRep.id) return false;
      if (filterScope === 'corep' && s.markedByRepId !== coRep.id) return false;

      // 4. Search Filter
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();

      const basicMatch =
        s.subjectName.toLowerCase().includes(q) ||
        s.subjectCode.toLowerCase().includes(q) ||
        s.markedByRepName.toLowerCase().includes(q) ||
        s.date.includes(q) ||
        `day order ${s.dayOrderCode.toLowerCase()}`.includes(q);

      if (basicMatch) return true;

      // Also search by absent student names/roll numbers within the session
      const hasAbsentStudentMatch = s.absentStudentIds.some((stuId) => {
        const stu = students.find((st) => st.id === stuId);
        return (
          stu &&
          (stu.name.toLowerCase().includes(q) ||
            stu.registerNumber.toLowerCase().includes(q) ||
            (stu.rollNumber && stu.rollNumber.toLowerCase().includes(q)))
        );
      });

      return hasAbsentStudentMatch;
    });
  }, [
    sessions,
    students,
    selectedDateFilter,
    selectedSubjectFilter,
    filterScope,
    searchQuery,
    todayIST,
    activeRep.id,
    coRep.id,
  ]);

  // Group filtered sessions date-wise
  const sessionsByDate = useMemo(() => {
    const groups: Record<string, AttendanceSessionRecord[]> = {};

    filteredSessions.forEach((s) => {
      if (!groups[s.date]) {
        groups[s.date] = [];
      }
      groups[s.date].push(s);
    });

    // Sort dates in descending order (latest date first)
    const sortedDates = Object.keys(groups).sort((a, b) => (a < b ? 1 : -1));

    return sortedDates.map((dateStr) => ({
      date: dateStr,
      sessions: groups[dateStr].sort((a, b) => a.periodNumber - b.periodNumber),
    }));
  }, [filteredSessions]);

  // WEEKLY & DAILY SUMMARY METRICS (Calculated for the current 7-day retention period)
  const weeklySummary = useMemo(() => {
    let totalClassesHeld = 0;
    let totalPresentMarks = 0;
    let totalAbsentMarks = 0;

    sessions.forEach((s) => {
      totalClassesHeld += 1;
      totalPresentMarks += s.presentCount;
      totalAbsentMarks += s.absentCount;
    });

    const totalAttendanceMarks = totalPresentMarks + totalAbsentMarks;
    const avgAttendancePercentage =
      totalAttendanceMarks > 0
        ? Math.round((totalPresentMarks / totalAttendanceMarks) * 100)
        : 100;

    return {
      totalClassesHeld,
      totalPresentMarks,
      totalAbsentMarks,
      avgAttendancePercentage,
      activeDaysCount: new Set(sessions.map((s) => s.date)).size,
    };
  }, [sessions]);

  // Resolve absent students for the detail modal
  const absentStudentsList = useMemo(() => {
    if (!selectedSession) return [];
    return students.filter((stu) => selectedSession.absentStudentIds.includes(stu.id));
  }, [selectedSession, students]);

  return (
    <div className="space-y-4">
      {/* ========================================================================= */}
      {/* 1. SEVEN-DAY DATA RETENTION BANNER (ASIA/KOLKATA SERVER CRON POLICY)      */}
      {/* ========================================================================= */}
      <Card className="border-[#0878D1]/20 bg-gradient-to-r from-white via-white to-[#EAF4FC]/60 p-4 dark:border-[#0878D1]/30 dark:from-[#111B27] dark:via-[#111B27] dark:to-[#0878D1]/10">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#0878D1] text-white shadow-xs">
              <History className="h-5 w-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-display text-base font-bold text-slate-900 sm:text-lg dark:text-white">
                  7-Day Attendance History
                </h2>
                <Badge variant="primary">Asia/Kolkata IST</Badge>
                <Badge variant="success" dot>
                  Auto-Cleanup Active
                </Badge>
              </div>
              <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-300">
                Displaying retained records from{' '}
                <strong className="text-slate-900 dark:text-white">
                  {formatDateDisplayIST(cutoffDateIST)}
                </strong>{' '}
                to <strong className="text-slate-900 dark:text-white">Today</strong>.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <span className="hidden text-[11px] text-slate-500 sm:inline">
              Server-side cron deletes records older than 7 days daily at 00:05 IST
            </span>
            <button
              type="button"
              onClick={loadHistory}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 hover:text-[#0878D1] dark:border-slate-800 dark:bg-[#111B27] dark:text-slate-300 cursor-pointer"
              title="Refresh attendance records"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </Card>

      {/* ========================================================================= */}
      {/* 2. WEEKLY SUMMARY CARDS (Total classes, attendance rate, absentees)       */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-2xs dark:border-slate-800 dark:bg-[#111B27]">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-medium">7-Day Sessions</span>
            <CalendarDays className="h-4 w-4 text-[#0878D1]" />
          </div>
          <p className="mt-1.5 font-display text-2xl font-bold text-slate-900 dark:text-white">
            {weeklySummary.totalClassesHeld}
          </p>
          <p className="mt-0.5 text-[11px] text-slate-400">
            Across {weeklySummary.activeDaysCount} teaching days
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-2xs dark:border-slate-800 dark:bg-[#111B27]">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-medium">Class Average</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          </div>
          <p className="mt-1.5 font-display text-2xl font-bold text-[#005A9E] dark:text-[#7CC4FA]">
            {weeklySummary.avgAttendancePercentage}%
          </p>
          <p className="mt-0.5 text-[11px] text-slate-400">Past 7 days average</p>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-2xs dark:border-slate-800 dark:bg-[#111B27]">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-medium">Present Marks</span>
            <UserCheck className="h-4 w-4 text-[#0878D1]" />
          </div>
          <p className="mt-1.5 font-display text-2xl font-bold text-slate-900 dark:text-white">
            {weeklySummary.totalPresentMarks}
          </p>
          <p className="mt-0.5 text-[11px] text-slate-400">Student attendances</p>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-2xs dark:border-slate-800 dark:bg-[#111B27]">
          <div className="flex items-center justify-between text-slate-500">
            <span className="text-xs font-medium">Absentee Marks</span>
            <UserX className="h-4 w-4 text-red-600" />
          </div>
          <p className="mt-1.5 font-display text-2xl font-bold text-red-600 dark:text-red-400">
            {weeklySummary.totalAbsentMarks}
          </p>
          <p className="mt-0.5 text-[11px] text-slate-400">Absences recorded</p>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. SEARCH & DATE / SUBJECT FILTERS                                        */}
      {/* ========================================================================= */}
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-2xs sm:flex-row sm:items-center sm:justify-between dark:border-slate-800 dark:bg-[#111B27]">
        {/* WhatsApp-style Search Input */}
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-3 left-3.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by subject, code, date, or absent student name/reg..."
            className="h-10 w-full rounded-full border border-slate-200 bg-slate-50/80 pr-9 pl-10 text-xs text-slate-900 placeholder-slate-400 focus:border-[#0878D1] focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-[#0E1621] dark:text-slate-100"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute top-2.5 right-3 text-slate-400 hover:text-slate-600"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Dropdown Filters: Date & Subject */}
        <div className="flex flex-wrap items-center gap-2">
          {/* 7-Day Date Filter */}
          <div className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-700 dark:border-slate-700 dark:bg-[#0E1621] dark:text-slate-300">
            <Calendar className="h-3.5 w-3.5 text-[#0878D1]" />
            <select
              value={selectedDateFilter}
              onChange={(e) => setSelectedDateFilter(e.target.value)}
              className="bg-transparent font-semibold text-[#0878D1] focus:outline-none dark:text-[#66B8FA]"
            >
              <option value="all">All 7 Days</option>
              {retentionDates.map((dt) => (
                <option key={dt} value={dt}>
                  {dt === todayIST ? `Today (${dt})` : dt}
                </option>
              ))}
            </select>
          </div>

          {/* Subject Filter */}
          <div className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-700 dark:border-slate-700 dark:bg-[#0E1621] dark:text-slate-300">
            <BookOpen className="h-3.5 w-3.5 text-[#0878D1]" />
            <select
              value={selectedSubjectFilter}
              onChange={(e) => setSelectedSubjectFilter(e.target.value)}
              className="bg-transparent font-semibold text-[#0878D1] focus:outline-none dark:text-[#66B8FA]"
            >
              <option value="all">All Subjects</option>
              {availableSubjects.map((sub) => (
                <option key={sub.code} value={sub.code}>
                  {sub.code} ({sub.name})
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Quick Filter Scope Tabs (All 7 Days, Today, With Absentees, By Me, By Co-Rep) */}
      <div className="no-scrollbar flex gap-1.5 overflow-x-auto pb-0.5">
        <button
          type="button"
          onClick={() => setFilterScope('7days')}
          className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
            filterScope === '7days'
              ? 'bg-[#0878D1] text-white shadow-xs'
              : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:bg-[#111B27] dark:text-slate-400'
          }`}
        >
          All 7 Days ({sessions.length})
        </button>

        <button
          type="button"
          onClick={() => setFilterScope('today')}
          className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
            filterScope === 'today'
              ? 'bg-[#0878D1] text-white shadow-xs'
              : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:bg-[#111B27] dark:text-slate-400'
          }`}
        >
          Today ({sessions.filter((s) => s.date === todayIST).length})
        </button>

        <button
          type="button"
          onClick={() => setFilterScope('with-absentees')}
          className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
            filterScope === 'with-absentees'
              ? 'bg-red-600 text-white shadow-xs'
              : 'border border-slate-200 bg-white text-red-600 hover:bg-red-50 dark:border-slate-800 dark:bg-[#111B27] dark:text-red-400'
          }`}
        >
          With Absentees ({sessions.filter((s) => s.absentCount > 0).length})
        </button>

        <button
          type="button"
          onClick={() => setFilterScope('mine')}
          className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
            filterScope === 'mine'
              ? 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900'
              : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:bg-[#111B27] dark:text-slate-400'
          }`}
        >
          By {activeRep.fullName.split(' ')[0]} (
          {sessions.filter((s) => s.markedByRepId === activeRep.id).length})
        </button>

        <button
          type="button"
          onClick={() => setFilterScope('corep')}
          className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
            filterScope === 'corep'
              ? 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900'
              : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:bg-[#111B27] dark:text-slate-400'
          }`}
        >
          By {coRep.fullName.split(' ')[0]} (
          {sessions.filter((s) => s.markedByRepId === coRep.id).length})
        </button>
      </div>

      {/* ========================================================================= */}
      {/* 4. DATE-WISE ATTENDANCE LIST (WHATSAPP-INSPIRED STRUCTURED LIST)          */}
      {/* ========================================================================= */}
      {sessionsByDate.length === 0 ? (
        <Card className="p-12 text-center">
          <History className="mx-auto h-8 w-8 text-slate-300 dark:text-slate-600" />
          <p className="mt-2 text-sm font-semibold text-slate-800 dark:text-slate-200">
            No attendance records found
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Either no sessions were marked or records older than 7 days have been automatically deleted.
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {sessionsByDate.map((dateGroup) => {
            // Daily summary
            const dailyPresent = dateGroup.sessions.reduce((acc, s) => acc + s.presentCount, 0);
            const dailyAbsent = dateGroup.sessions.reduce((acc, s) => acc + s.absentCount, 0);
            const dailyTotal = dailyPresent + dailyAbsent;
            const dailyRate = dailyTotal > 0 ? Math.round((dailyPresent / dailyTotal) * 100) : 100;
            const isToday = dateGroup.date === todayIST;

            return (
              <Card key={dateGroup.date} padding="none" className="overflow-hidden">
                {/* Date Header with Daily Summary Badge */}
                <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/80 px-4 py-3 sm:px-5 dark:border-slate-800 dark:bg-[#0E1621]">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#EAF4FC] text-[#0878D1] dark:bg-[#0878D1]/20 dark:text-[#7CC4FA]">
                      <Calendar className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-display text-sm font-bold text-slate-900 dark:text-white">
                          {formatDateDisplayIST(dateGroup.date)}
                        </span>
                        {isToday && <Badge variant="primary">Today</Badge>}
                        <span className="rounded-full bg-slate-200 px-2 py-0.2 text-[10px] font-bold text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                          Day Order {dateGroup.sessions[0]?.dayOrderCode || 'A'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Daily Summary Counters */}
                  <div className="flex items-center gap-2 text-xs">
                    <span className="hidden text-slate-500 sm:inline">
                      {dateGroup.sessions.length} Period{dateGroup.sessions.length > 1 ? 's' : ''} •
                    </span>
                    <Badge variant={dailyRate >= 85 ? 'primary' : 'warning'}>
                      {dailyRate}% Daily Avg
                    </Badge>
                    {dailyAbsent > 0 ? (
                      <Badge variant="absent">{dailyAbsent} Total Absences</Badge>
                    ) : (
                      <Badge variant="success">100% Full</Badge>
                    )}
                  </div>
                </div>

                {/* Period Rows for this date */}
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {dateGroup.sessions.map((session) => {
                    return (
                      <div
                        key={session.id}
                        onClick={() => setSelectedSession(session)}
                        className="flex items-center justify-between gap-3 px-4 py-3.5 transition-colors hover:bg-slate-50/90 sm:px-5 dark:hover:bg-[#172434]/60 cursor-pointer"
                      >
                        <div className="flex min-w-0 items-center gap-3.5">
                          {/* Period Circle Badge */}
                          <div className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-2xl bg-[#EAF4FC] text-[#005A9E] dark:bg-[#0878D1]/20 dark:text-[#7CC4FA]">
                            <span className="text-[10px] font-medium opacity-75">Period</span>
                            <span className="text-xs font-extrabold">{session.periodNumber}</span>
                          </div>

                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                                {session.subjectName}
                              </p>
                              <Badge variant="neutral">{session.subjectCode}</Badge>
                              <span className="text-[11px] text-slate-400">
                                {session.timeRange}
                              </span>
                            </div>

                            <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                              <span className="inline-flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                {session.room || 'LH-302'}
                              </span>
                              <span>•</span>
                              <span>Marked by {session.markedByRepName}</span>
                              {session.absentCount > 0 && (
                                <>
                                  <span>•</span>
                                  <span className="text-red-600 dark:text-red-400 font-semibold">
                                    {session.absentCount} Absent
                                  </span>
                                </>
                              )}
                            </p>
                          </div>
                        </div>

                        {/* Right: Presence counters & chevron */}
                        <div className="flex shrink-0 items-center gap-3">
                          <div className="flex flex-col items-end gap-1 sm:flex-row sm:items-center">
                            <Badge variant="primary">
                              <UserCheck className="h-3 w-3" />
                              {session.presentCount}/{session.totalStudents} Present
                            </Badge>

                            {session.absentCount > 0 ? (
                              <Badge variant="absent">
                                <UserX className="h-3 w-3" />
                                {session.absentCount} Absent
                              </Badge>
                            ) : (
                              <Badge variant="success">All Present</Badge>
                            )}
                          </div>

                          <ChevronRight className="h-4 w-4 text-slate-300" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. DETAILED ATTENDANCE SESSION MODAL                                      */}
      {/* (Shows absent student names, register numbers, subject & edit action)     */}
      {/* ========================================================================= */}
      <Modal
        open={Boolean(selectedSession)}
        onClose={() => setSelectedSession(null)}
        title={
          selectedSession
            ? `${selectedSession.subjectName} (${selectedSession.subjectCode})`
            : ''
        }
        subtitle={
          selectedSession
            ? `${formatDateDisplayIST(selectedSession.date)} • Period ${selectedSession.periodNumber} (${selectedSession.timeRange})`
            : ''
        }
        maxWidthClass="max-w-xl"
      >
        {selectedSession && (
          <div className="space-y-4">
            {/* Session Stats Banner */}
            <div className="grid grid-cols-3 gap-2.5">
              <div className="rounded-2xl border border-[#0878D1]/20 bg-[#EAF4FC] p-3 text-center dark:bg-[#0878D1]/20">
                <p className="text-[11px] font-bold text-[#005A9E] dark:text-[#7CC4FA]">Present</p>
                <p className="mt-0.5 font-display text-lg font-bold text-[#005A9E] dark:text-white">
                  {selectedSession.presentCount}
                </p>
              </div>

              <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-center dark:border-red-900/60 dark:bg-red-950/60">
                <p className="text-[11px] font-bold text-red-700 dark:text-red-300">Absent</p>
                <p className="mt-0.5 font-display text-lg font-bold text-red-700 dark:text-red-200">
                  {selectedSession.absentCount}
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-100 p-3 text-center dark:border-slate-800 dark:bg-[#0E1621]">
                <p className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">Total</p>
                <p className="mt-0.5 font-display text-lg font-bold text-slate-900 dark:text-white">
                  {selectedSession.totalStudents}
                </p>
              </div>
            </div>

            {/* Representative & Schedule Metadata */}
            <div className="flex items-center justify-between rounded-2xl border border-slate-100 bg-slate-50/80 p-3 text-xs dark:border-slate-800 dark:bg-[#0E1621]">
              <div className="flex items-center gap-2.5">
                <Avatar name={selectedSession.markedByRepName} size="sm" variant="primary" />
                <div>
                  <p className="font-semibold text-slate-900 dark:text-slate-100">
                    Marked by {selectedSession.markedByRepName}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    Day Order {selectedSession.dayOrderCode} • Venue: {selectedSession.room || 'LH-302'}
                  </p>
                </div>
              </div>
              <Badge variant="success">Shared &amp; Synced</Badge>
            </div>

            {/* Absent Student Names & Register Numbers */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <h4 className="text-xs font-bold text-red-700 dark:text-red-300">
                  Absent Students ({absentStudentsList.length})
                </h4>
                <span className="text-[11px] text-slate-400">Names &amp; Register Numbers</span>
              </div>

              {absentStudentsList.length === 0 ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3 text-center text-xs font-medium text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-950/50 dark:text-emerald-200">
                  No absentees! 100% attendance recorded for this session.
                </div>
              ) : (
                <div className="max-h-52 overflow-y-auto divide-y divide-red-100 rounded-2xl border border-red-200/80 bg-red-50/40 dark:divide-red-900/40 dark:border-red-900/50 dark:bg-red-950/20">
                  {absentStudentsList.map((stu) => (
                    <div
                      key={stu.id}
                      className="flex items-center justify-between p-3 text-xs"
                    >
                      <div className="flex items-center gap-2.5">
                        <Avatar name={stu.name} size="xs" variant="absent" />
                        <div>
                          <p className="font-semibold text-slate-900 dark:text-slate-100">
                            {stu.name}
                          </p>
                          <p className="font-mono text-[11px] font-bold text-[#0878D1] dark:text-[#66B8FA]">
                            {stu.registerNumber} {stu.rollNumber ? `(${stu.rollNumber})` : ''}
                          </p>
                        </div>
                      </div>
                      <Badge variant="absent">ABSENT</Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Retention Notice */}
            <div className="flex items-center gap-2 rounded-xl bg-slate-50 p-2.5 text-[11px] text-slate-500 dark:bg-[#0E1621]">
              <Info className="h-3.5 w-3.5 text-[#0878D1]" />
              <span>
                Permanent retention window: Record will remain visible until 7 days from{' '}
                {selectedSession.date}.
              </span>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  const pNum = selectedSession.periodNumber;
                  setSelectedSession(null);
                  navigate(`/attendance?period=${pNum}`);
                }}
                leftIcon={<Edit2 className="h-3.5 w-3.5" />}
              >
                Edit Attendance
              </Button>
              <Button variant="outline" size="sm" onClick={() => setSelectedSession(null)}>
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
