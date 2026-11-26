import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  HelpCircle,
  Info,
  Layers,
  MapPin,
  RotateCcw,
  Search,
  ShieldCheck,
  UserCheck,
  UserX,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  AttendanceSessionRecord,
  AttendanceStatus,
  DayOrder,
  PeriodSlot,
  Semester,
  Student,
} from '../types';
import { studentService } from '../services/studentService';
import { timetableService } from '../services/timetableService';
import { attendanceService } from '../services/attendanceService';
import { Avatar } from '../components/ui/Avatar';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Modal } from '../components/ui/Modal';
import { Toast } from '../components/ui/Toast';

export const AttendancePage: React.FC = () => {
  const { activeRep, coRep, classProfile } = useAuth();
  const classId = classProfile.id;
  const [searchParams] = useSearchParams();

  // Workflow Step 1: Date Selection (defaults to URL param or today in IST)
  const [selectedDate, setSelectedDate] = useState<string>(
    () => searchParams.get('date') || new Date().toISOString().split('T')[0]
  );

  // Workflow Step 2 & 3: Day Order and Semester Timetable Retrieval
  const [activeSemester, setActiveSemester] = useState<Semester | null>(null);
  const [dayOrders, setDayOrders] = useState<DayOrder[]>([]);
  const [selectedDayOrder, setSelectedDayOrder] = useState<DayOrder | null>(null);
  const [periodSlots, setPeriodSlots] = useState<PeriodSlot[]>([]);

  // Workflow Step 4 & 5: Period and Subject Selection
  const [selectedPeriodNumber, setSelectedPeriodNumber] = useState<number>(1);

  // Workflow Step 6: Students Roster
  const [students, setStudents] = useState<Student[]>([]);

  // Workflow Step 7 & 8: Attendance status map (Default PRESENT, tap to toggle ABSENT)
  const [attendanceMap, setAttendanceMap] = useState<Record<string, AttendanceStatus>>({});

  // Existing session state (for duplicate prevention and editing mode)
  const [existingSession, setExistingSession] = useState<AttendanceSessionRecord | null>(null);
  const [isEditMode, setIsEditMode] = useState<boolean>(false);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'present' | 'absent'>('all');

  // Confirmation Modal & UI feedback
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);

  // 1. Load active semester, day orders, timetable periods, and students
  useEffect(() => {
    async function initData() {
      try {
        const [sems, studentList] = await Promise.all([
          timetableService.getSemesters(classId),
          studentService.getStudents(classId),
        ]);

        setStudents(studentList);

        const currentSem = sems.find((s) => s.isActive) || sems[0];
        setActiveSemester(currentSem);

        if (currentSem) {
          const [dos, slots] = await Promise.all([
            timetableService.getDayOrders(currentSem.id),
            timetableService.getPeriodSlots(currentSem.id),
          ]);
          setDayOrders(dos);
          setPeriodSlots(slots);

          // Check if there is a dayOrder passed via URL query, or an existing Day Order choice for selectedDate
          const urlDayOrder = searchParams.get('dayOrder');
          const matchedUrlDo = urlDayOrder ? dos.find((d) => d.code.toUpperCase() === urlDayOrder.toUpperCase()) : null;
          const savedDayOrder = await timetableService.getDailyDayOrder(classId, selectedDate);
          const initialDo = matchedUrlDo || savedDayOrder || dos[0] || null;
          setSelectedDayOrder(initialDo);

          const paramPeriod = Number(searchParams.get('period'));
          if (paramPeriod) {
            setSelectedPeriodNumber(paramPeriod);
          }
        }
      } catch (err) {
        console.error('Failed to initialize attendance page:', err);
      }
    }

    initData();
  }, [classId]);

  // 2. Automatically retrieve day order log whenever selectedDate changes
  useEffect(() => {
    async function checkDateDayOrder() {
      if (!classId || dayOrders.length === 0) return;
      const savedDo = await timetableService.getDailyDayOrder(classId, selectedDate);
      if (savedDo) {
        setSelectedDayOrder(savedDo);
      }
    }
    checkDateDayOrder();
  }, [selectedDate, classId, dayOrders]);

  // 3. Filter period slots under the selected Day Order
  const dayOrderPeriods = useMemo(() => {
    if (!selectedDayOrder) return [];
    return periodSlots
      .filter((s) => s.dayOrderId === selectedDayOrder.id)
      .sort((a, b) => a.periodNumber - b.periodNumber);
  }, [periodSlots, selectedDayOrder]);

  // 4. Automatically retrieve active period & subject details
  const activePeriod = useMemo(() => {
    return (
      dayOrderPeriods.find((p) => p.periodNumber === selectedPeriodNumber) ||
      dayOrderPeriods[0] || {
        id: 'default-p1',
        periodNumber: 1,
        startTime: '09:00 AM',
        endTime: '09:50 AM',
        subjectCode: 'CS501',
        subjectName: 'Operating Systems',
        sessionType: 'Lecture' as const,
        room: 'LH-302',
      }
    );
  }, [dayOrderPeriods, selectedPeriodNumber]);

  // 5. Check if an attendance record already exists for this (classId, selectedDate, activePeriod.periodNumber)
  useEffect(() => {
    async function checkExistingRecord() {
      if (!classId || !selectedDate || !activePeriod.periodNumber) return;

      const record = await attendanceService.getSessionByDateAndPeriod(
        classId,
        selectedDate,
        activePeriod.periodNumber
      );

      if (record) {
        setExistingSession(record);
        setIsEditMode(true);
        setDuplicateWarning(
          `Already Marked: Attendance for Period ${activePeriod.periodNumber} on ${selectedDate} was marked by ${record.markedByRepName}. You are in Editing Mode.`
        );

        // Load existing statuses
        const loadedStatuses: Record<string, AttendanceStatus> = {};
        students.forEach((s) => {
          loadedStatuses[s.id] = record.studentStatuses[s.id] || 'present';
        });
        setAttendanceMap(loadedStatuses);
      } else {
        setExistingSession(null);
        setIsEditMode(false);
        setDuplicateWarning(null);

        // REQUIREMENT 7: Set every student as PRESENT by default
        const defaultPresent: Record<string, AttendanceStatus> = {};
        students.forEach((s) => {
          defaultPresent[s.id] = 'present';
        });
        setAttendanceMap(defaultPresent);
      }
    }

    checkExistingRecord();
  }, [classId, selectedDate, activePeriod.periodNumber, students]);

  // Handle Day Order Selection (Workflow Step 2 & 3)
  const handleSelectDayOrder = async (dOrder: DayOrder) => {
    setSelectedDayOrder(dOrder);
    await timetableService.setDailyDayOrder(classId, selectedDate, dOrder, activeRep.id);
    setToastMsg(`Set ${dOrder.name} for ${selectedDate}. Timetable updated!`);
  };

  // REQUIREMENT 8: Clicking a student changes their status (one-tap toggle between present and absent)
  const toggleStudentStatus = (studentId: string) => {
    setAttendanceMap((prev) => {
      const current = prev[studentId] ?? 'present';
      return {
        ...prev,
        [studentId]: current === 'present' ? 'absent' : 'present',
      };
    });
  };

  // Quick reset all students to Present
  const handleSetAllPresent = () => {
    const updated: Record<string, AttendanceStatus> = {};
    students.forEach((s) => {
      updated[s.id] = 'present';
    });
    setAttendanceMap(updated);
    setToastMsg('All students set to Present.');
  };

  // REQUIREMENTS: Total, Present, and Absent Counts
  const counts = useMemo(() => {
    let present = 0;
    let absent = 0;
    students.forEach((s) => {
      const st = attendanceMap[s.id] ?? 'present';
      if (st === 'absent') absent += 1;
      else present += 1;
    });
    return {
      total: students.length,
      present,
      absent,
    };
  }, [students, attendanceMap]);

  // List of absent students for review in confirmation modal
  const absentStudentsList = useMemo(() => {
    return students.filter((s) => attendanceMap[s.id] === 'absent');
  }, [students, attendanceMap]);

  // Search by register number or student name
  const filteredStudents = useMemo(() => {
    return students.filter((stu) => {
      const status = attendanceMap[stu.id] ?? 'present';
      if (filterMode === 'present' && status !== 'present') return false;
      if (filterMode === 'absent' && status !== 'absent') return false;

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      return (
        stu.name.toLowerCase().includes(q) ||
        stu.registerNumber.toLowerCase().includes(q) ||
        (stu.rollNumber && stu.rollNumber.toLowerCase().includes(q))
      );
    });
  }, [students, attendanceMap, filterMode, searchQuery]);

  // REQUIREMENT 9: Save Attendance (invoked after confirmation)
  const handleConfirmSubmitAttendance = async () => {
    setIsSubmitting(true);
    try {
      const saved = await attendanceService.saveAttendanceSession(
        classId,
        {
          id: existingSession?.id,
          semesterId: activeSemester?.id,
          date: selectedDate,
          dayOrderId: selectedDayOrder?.id,
          dayOrderCode: selectedDayOrder?.code || 'A',
          periodNumber: activePeriod.periodNumber,
          timeRange: `${activePeriod.startTime} – ${activePeriod.endTime}`,
          subjectId: activePeriod.subjectId,
          subjectCode: activePeriod.subjectCode || 'GEN01',
          subjectName: activePeriod.subjectName || 'General Period',
          room: activePeriod.room || 'LH-302',
          studentStatuses: attendanceMap,
          markedByRepId: activeRep.id,
          markedByRepName: activeRep.fullName,
        },
        isEditMode
      );

      setExistingSession(saved);
      setIsEditMode(true);
      setConfirmModalOpen(false);
      setToastMsg(
        `Attendance successfully saved for Period ${activePeriod.periodNumber} (${counts.present} Present, ${counts.absent} Absent). Synced with ${coRep.fullName}.`
      );
    } catch (err: unknown) {
      console.error(err);
      setToastMsg(err instanceof Error ? err.message : 'Failed to save attendance.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4 pb-24 sm:pb-8">
      {/* ========================================================================= */}
      {/* WORKFLOW BAR: STEP 1 (Date) & STEP 2 (Day Order)                         */}
      {/* ========================================================================= */}
      <Card padding="sm" className="border-[#0878D1]/20 bg-gradient-to-r from-white via-white to-[#EAF4FC]/60 dark:from-[#111B27] dark:via-[#111B27] dark:to-[#0878D1]/10">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between px-1">
          {/* Step 1: Select Attendance Date */}
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#0878D1] text-white shadow-xs">
              <Calendar className="h-4.5 w-4.5" />
            </div>
            <div>
              <label className="block text-[10px] font-semibold tracking-wider text-slate-500 uppercase">
                Step 1: Attendance Date
              </label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="h-8 rounded-lg border border-slate-200 bg-white px-2.5 font-sans text-xs font-bold text-slate-900 shadow-2xs focus:border-[#0878D1] focus:outline-none dark:border-slate-700 dark:bg-[#0E1621] dark:text-slate-100"
              />
            </div>
          </div>

          {/* Step 2: Select Applicable Day Order */}
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-200">
              <Layers className="h-3.5 w-3.5 text-[#0878D1]" />
              <span>Step 2: Day Order:</span>
            </div>
            <div className="no-scrollbar flex gap-1.5 overflow-x-auto pt-1 sm:pt-0">
              {dayOrders.map((dOrder) => {
                const isSelected = selectedDayOrder?.id === dOrder.id;
                return (
                  <button
                    key={dOrder.id}
                    type="button"
                    onClick={() => handleSelectDayOrder(dOrder)}
                    className={`flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-xs font-bold transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-[#0878D1] text-white shadow-xs'
                        : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-[#0E1621] dark:text-slate-300'
                    }`}
                  >
                    <span>Order {dOrder.code}</span>
                    {isSelected && <Check className="h-3 w-3" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </Card>

      {/* Duplicate Warning / Edit Mode Alert */}
      {duplicateWarning && (
        <div className="flex items-start gap-2.5 rounded-2xl border border-amber-200/90 bg-amber-50/90 p-3.5 text-xs text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/60 dark:text-amber-200">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <div className="flex-1">
            <span className="font-semibold">{duplicateWarning}</span>
            <p className="mt-0.5 text-[11px] text-amber-700 dark:text-amber-300">
              Editing this session will update the shared records for both representatives.
            </p>
          </div>
          <Badge variant="warning">Edit Mode</Badge>
        </div>
      )}

      {/* ========================================================================= */}
      {/* WORKFLOW BAR: STEP 3 & 4 (Periods retrieved automatically from Day Order)  */}
      {/* ========================================================================= */}
      <Card padding="sm">
        <div className="mb-2 flex items-center justify-between gap-2 px-1">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
            <Clock className="h-3.5 w-3.5 text-[#0878D1]" />
            <span>
              Step 3: Choose Period for Day Order {selectedDayOrder?.code || 'A'}:
            </span>
          </div>
          <span className="text-[11px] text-slate-500">
            Auto-retrieved from Semester Timetable
          </span>
        </div>

        <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
          {dayOrderPeriods.map((period) => {
            const isSelected = period.periodNumber === activePeriod.periodNumber;
            return (
              <button
                key={period.id}
                type="button"
                onClick={() => setSelectedPeriodNumber(period.periodNumber)}
                className={`flex shrink-0 flex-col rounded-2xl border px-3.5 py-2.5 text-left transition-all cursor-pointer ${
                  isSelected
                    ? 'border-[#0878D1] bg-[#EAF4FC] text-[#005A9E] dark:border-[#0878D1] dark:bg-[#0878D1]/20 dark:text-[#7CC4FA]'
                    : 'border-slate-200/80 bg-slate-50/70 text-slate-700 hover:bg-slate-100 dark:border-slate-800 dark:bg-[#0E1621] dark:text-slate-300'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold">
                    P{period.periodNumber} • {period.subjectCode || 'Free'}
                  </span>
                  {isSelected && (
                    <CheckCircle2 className="h-3.5 w-3.5 text-[#0878D1] dark:text-[#66B8FA]" />
                  )}
                </div>
                <span className="mt-0.5 text-[11px] opacity-80">
                  {period.startTime} • {period.room || 'LH-302'}
                </span>
              </button>
            );
          })}
        </div>
      </Card>

      {/* ========================================================================= */}
      {/* WORKFLOW STEP 5: AUTOMATICALLY DISPLAY CORRESPONDING SUBJECT & VENUE       */}
      {/* ========================================================================= */}
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800 dark:bg-[#111B27]">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-display text-base font-bold text-slate-900 dark:text-slate-100">
              {activePeriod.subjectName || 'General Period'}
            </h2>
            <Badge variant="primary">{activePeriod.subjectCode || 'CS501'}</Badge>
            {activePeriod.sessionType && (
              <Badge variant={activePeriod.sessionType === 'Lab' ? 'warning' : 'neutral'}>
                {activePeriod.sessionType}
              </Badge>
            )}
            {isEditMode && <Badge variant="warning">Editing Saved Record</Badge>}
          </div>

          <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span>
              Period {activePeriod.periodNumber} ({activePeriod.startTime} – {activePeriod.endTime})
            </span>
            <span>•</span>
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3 w-3" /> {activePeriod.room || 'LH-302'}
            </span>
            <span>•</span>
            <span>Day Order {selectedDayOrder?.code || 'A'}</span>
          </p>
        </div>

        {/* Live Counters (Total, Present, Absent) */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
            <span>Total:</span>
            <span>{counts.total}</span>
          </div>

          {/* Clearly distinguish Present */}
          <div className="flex items-center gap-1.5 rounded-full border border-[#0878D1]/20 bg-[#EAF4FC] px-3 py-1.5 text-xs font-bold text-[#005A9E] dark:bg-[#0878D1]/20 dark:text-[#7CC4FA]">
            <UserCheck className="h-3.5 w-3.5" />
            <span>{counts.present} Present</span>
          </div>

          {/* Clearly distinguish Absent in Red */}
          <div className="flex items-center gap-1.5 rounded-full border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-bold text-red-700 dark:border-red-900/60 dark:bg-red-950/60 dark:text-red-300">
            <UserX className="h-3.5 w-3.5 text-red-600" />
            <span>{counts.absent} Absent</span>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={handleSetAllPresent}
            leftIcon={<RotateCcw className="h-3.5 w-3.5" />}
          >
            All Present
          </Button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SEARCH & ATTENDANCE FILTER BAR                                            */}
      {/* ========================================================================= */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 sm:max-w-md">
          <Search className="pointer-events-none absolute top-3 left-3.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search student by name, register number or roll..."
            className="h-10 w-full rounded-full border border-slate-200 bg-white pr-9 pl-10 text-xs text-slate-900 placeholder-slate-400 shadow-2xs focus:border-[#0878D1] focus:ring-2 focus:ring-[#0878D1]/10 focus:outline-none dark:border-slate-800 dark:bg-[#111B27] dark:text-slate-100"
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

        {/* Filter Chips: All, Present, Absent */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setFilterMode('all')}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
              filterMode === 'all'
                ? 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900'
                : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:bg-[#111B27] dark:text-slate-400'
            }`}
          >
            All ({counts.total})
          </button>
          <button
            type="button"
            onClick={() => setFilterMode('present')}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
              filterMode === 'present'
                ? 'bg-[#0878D1] text-white shadow-xs'
                : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:bg-[#111B27] dark:text-slate-400'
            }`}
          >
            Present ({counts.present})
          </button>
          <button
            type="button"
            onClick={() => setFilterMode('absent')}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
              filterMode === 'absent'
                ? 'bg-red-600 text-white shadow-xs'
                : 'border border-slate-200 bg-white text-red-600 hover:bg-red-50 dark:border-slate-800 dark:bg-[#111B27] dark:text-red-400'
            }`}
          >
            Absent ({counts.absent})
          </button>
        </div>
      </div>

      {/* Speed Tip for Mobile */}
      <div className="flex items-center gap-2 px-1 text-[11px] text-slate-500">
        <HelpCircle className="h-3.5 w-3.5 text-[#0878D1]" />
        <span>
          <strong>Fast Mobile Marking:</strong> Every student defaults to <strong>PRESENT</strong>. Simply tap any student to mark them <strong>ABSENT</strong>.
        </span>
      </div>

      {/* ========================================================================= */}
      {/* WORKFLOW STEP 6, 7 & 8: WHATSAPP-INSPIRED STUDENT ROSTER                  */}
      {/* ========================================================================= */}
      <Card padding="none" className="overflow-hidden">
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {filteredStudents.length === 0 ? (
            <div className="px-5 py-12 text-center text-xs text-slate-500">
              No students match the search criteria.
            </div>
          ) : (
            filteredStudents.map((stu) => {
              const status = attendanceMap[stu.id] ?? 'present';
              const isAbsent = status === 'absent';

              return (
                <div
                  key={stu.id}
                  onClick={() => toggleStudentStatus(stu.id)}
                  className={`flex items-center justify-between gap-3 px-4 py-3.5 transition-colors sm:px-5 cursor-pointer select-none active:scale-[0.99] ${
                    isAbsent
                      ? 'bg-red-50/70 hover:bg-red-50/90 dark:bg-red-950/30 dark:hover:bg-red-950/45'
                      : 'hover:bg-slate-50/90 dark:hover:bg-[#172434]/60'
                  }`}
                >
                  {/* Left: Avatar + Names & Register Numbers */}
                  <div className="flex min-w-0 items-center gap-3.5">
                    <Avatar
                      name={stu.name}
                      size="md"
                      variant={isAbsent ? 'absent' : 'tint'}
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p
                          className={`truncate text-sm font-semibold ${
                            isAbsent
                              ? 'text-red-900 dark:text-red-200'
                              : 'text-slate-900 dark:text-slate-100'
                          }`}
                        >
                          {stu.name}
                        </p>
                        {stu.rollNumber && (
                          <span className="rounded-full bg-slate-100 px-2 py-0.2 text-[10px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                            {stu.rollNumber}
                          </span>
                        )}
                      </div>

                      <div className="mt-0.5 flex items-center gap-2 text-xs text-slate-500">
                        <span className="font-mono font-bold text-[#0878D1] dark:text-[#66B8FA]">
                          {stu.registerNumber}
                        </span>
                        <span>•</span>
                        <span className="text-[11px]">
                          {isAbsent ? (
                            <strong className="text-red-600 dark:text-red-400">Marked Absent</strong>
                          ) : (
                            'Present'
                          )}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Distinct Present / Absent Badge & Action Pill */}
                  <div className="flex shrink-0 items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    {isAbsent ? (
                      <button
                        type="button"
                        onClick={() => toggleStudentStatus(stu.id)}
                        className="flex items-center gap-1.5 rounded-full bg-red-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-xs transition-transform active:scale-95 cursor-pointer"
                        title="Click to mark Present"
                      >
                        <UserX className="h-3.5 w-3.5" />
                        <span>ABSENT</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => toggleStudentStatus(stu.id)}
                        className="flex items-center gap-1.5 rounded-full border border-[#0878D1]/20 bg-[#EAF4FC] px-3.5 py-1.5 text-xs font-bold text-[#005A9E] transition-transform active:scale-95 hover:bg-[#DCEDFB] dark:bg-[#0878D1]/20 dark:text-[#7CC4FA] cursor-pointer"
                        title="Click to mark Absent"
                      >
                        <Check className="h-3.5 w-3.5" />
                        <span>PRESENT</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </Card>

      {/* ========================================================================= */}
      {/* WORKFLOW STEP 9: STICKY SUBMISSION BAR                                     */}
      {/* ========================================================================= */}
      <div className="sticky bottom-18 z-20 lg:bottom-4">
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200/90 bg-white/95 p-3.5 shadow-lg backdrop-blur-md dark:border-slate-700 dark:bg-[#111B27]/95">
          <div className="min-w-0">
            <p className="truncate text-xs font-bold text-slate-900 sm:text-sm dark:text-slate-100">
              {activePeriod.subjectCode} Period {activePeriod.periodNumber} •{' '}
              <span className="text-[#0878D1] dark:text-[#7CC4FA]">{counts.present} Present</span>,{' '}
              <span className="text-red-600 dark:text-red-400">{counts.absent} Absent</span>
            </p>
            <p className="truncate text-[11px] text-slate-500">
              {selectedDate} (Day Order {selectedDayOrder?.code || 'A'}) • Marking as {activeRep.fullName.split(' ')[0]}
            </p>
          </div>

          <Button
            size="md"
            variant="primary"
            onClick={() => setConfirmModalOpen(true)}
            leftIcon={<Check className="h-4 w-4" />}
            className="shrink-0"
          >
            {isEditMode ? 'Update Attendance' : 'Save Attendance'}
          </Button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SUBMISSION CONFIRMATION MODAL (REQUIREMENT: Ask confirmation before submit) */}
      {/* ========================================================================= */}
      <Modal
        open={confirmModalOpen}
        onClose={() => setConfirmModalOpen(false)}
        title={isEditMode ? 'Confirm Attendance Update' : 'Confirm Attendance Submission'}
        subtitle={`Period ${activePeriod.periodNumber} (${activePeriod.subjectName}) on ${selectedDate}`}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-2.5 dark:border-slate-800 dark:bg-[#0E1621]">
              <p className="text-[10px] text-slate-500 uppercase">Total</p>
              <p className="font-display text-lg font-bold text-slate-900 dark:text-slate-100">
                {counts.total}
              </p>
            </div>
            <div className="rounded-xl border border-[#0878D1]/20 bg-[#EAF4FC] p-2.5 dark:bg-[#0878D1]/20">
              <p className="text-[10px] text-[#005A9E] dark:text-[#7CC4FA] uppercase font-semibold">
                Present
              </p>
              <p className="font-display text-lg font-bold text-[#005A9E] dark:text-white">
                {counts.present}
              </p>
            </div>
            <div className="rounded-xl border border-red-200 bg-red-50 p-2.5 dark:border-red-900/60 dark:bg-red-950/60">
              <p className="text-[10px] text-red-700 dark:text-red-300 uppercase font-semibold">
                Absent
              </p>
              <p className="font-display text-lg font-bold text-red-700 dark:text-red-200">
                {counts.absent}
              </p>
            </div>
          </div>

          {/* Absent Students List for Verification */}
          <div>
            <div className="mb-1.5 flex items-center justify-between text-xs font-semibold">
              <span className="text-red-700 dark:text-red-300">
                Absent Students ({absentStudentsList.length})
              </span>
              <span className="text-slate-400 text-[11px]">Please verify before saving</span>
            </div>

            {absentStudentsList.length === 0 ? (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-3 text-center text-xs font-medium text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-950/50 dark:text-emerald-200">
                Full class is marked Present (0 Absentees).
              </div>
            ) : (
              <div className="max-h-40 overflow-y-auto divide-y divide-red-100 rounded-xl border border-red-200/80 bg-red-50/50 dark:divide-red-900/40 dark:border-red-900/60 dark:bg-red-950/30">
                {absentStudentsList.map((stu) => (
                  <div key={stu.id} className="flex items-center justify-between p-2.5 text-xs">
                    <div>
                      <span className="font-semibold text-slate-900 dark:text-slate-100">
                        {stu.name}
                      </span>
                      <span className="ml-2 font-mono text-[11px] text-[#0878D1] dark:text-[#66B8FA]">
                        {stu.registerNumber}
                      </span>
                    </div>
                    <Badge variant="absent">ABSENT</Badge>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 rounded-xl bg-slate-50 p-3 text-[11px] text-slate-500 dark:bg-[#0E1621]">
            <ShieldCheck className="h-4 w-4 text-[#0878D1]" />
            <span>
              Permanent Supabase Record: Accessible immediately by both representatives.
            </span>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirmModalOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={handleConfirmSubmitAttendance}
              disabled={isSubmitting}
              leftIcon={<Check className="h-4 w-4" />}
            >
              {isSubmitting
                ? 'Submitting...'
                : isEditMode
                ? 'Confirm & Update'
                : 'Confirm & Submit'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Global Notification Toast */}
      <Toast message={toastMsg} type="success" onDismiss={() => setToastMsg(null)} />
    </div>
  );
};
