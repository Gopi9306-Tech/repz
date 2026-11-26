import React, { useEffect, useMemo, useState } from 'react';
import {
  BookOpen,
  CalendarClock,
  ChevronRight,
  Clock,
  Edit2,
  FileSpreadsheet,
  Layers,
  MapPin,
  Plus,
  Trash2,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  DayOrder,
  PeriodSlot,
  Semester,
  Subject,
} from '../types';
import {
  DEFAULT_PERIOD_TIMES,
  timetableService,
} from '../services/timetableService';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Modal } from '../components/ui/Modal';
import { Toast } from '../components/ui/Toast';

export const TimetableSetupPage: React.FC = () => {
  const { classProfile } = useAuth();
  const classId = classProfile.id;

  // State
  const [semesters, setSemesters] = useState<Semester[]>([]);
  const [activeSemester, setActiveSemester] = useState<Semester | null>(null);
  const [dayOrders, setDayOrders] = useState<DayOrder[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [periodSlots, setPeriodSlots] = useState<PeriodSlot[]>([]);
  const [_isLoading, setIsLoading] = useState(true);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Selected Day Order for mobile / tabbed view
  const [selectedDayOrderCode, setSelectedDayOrderCode] = useState<string>('A');

  // Modals
  const [createSemesterModalOpen, setCreateSemesterModalOpen] = useState(false);
  const [subjectsModalOpen, setSubjectsModalOpen] = useState(false);
  const [dayOrdersModalOpen, setDayOrdersModalOpen] = useState(false);
  const [editSlotModalOpen, setEditSlotModalOpen] = useState(false);
  const [editingSlot, setEditingSlot] = useState<PeriodSlot | null>(null);

  // Forms
  const [newSemesterForm, setNewSemesterForm] = useState({
    name: 'Semester 6 (Spring 2027)',
    academicYear: '2026-2027',
    startDate: '2027-01-05',
    endDate: '2027-05-30',
    totalPeriodsPerDay: 5,
    dayOrderList: 'A, B, C, D, E, F',
  });

  const [newSubjectForm, setNewSubjectForm] = useState({
    code: '',
    name: '',
    sessionType: 'Lecture' as Subject['sessionType'],
    facultyName: '',
    color: '#0878D1',
  });
  const [editingSubjectId, setEditingSubjectId] = useState<string | null>(null);

  const [newDayOrderCode, setNewDayOrderCode] = useState('');

  // Load semester data
  const loadSemesterData = async (targetSemId?: string) => {
    setIsLoading(true);
    try {
      const sems = await timetableService.getSemesters(classId);
      setSemesters(sems);

      const current = targetSemId
        ? sems.find((s) => s.id === targetSemId) || sems[0]
        : sems.find((s) => s.isActive) || sems[0];

      setActiveSemester(current);

      if (current) {
        const [dos, subs, slots] = await Promise.all([
          timetableService.getDayOrders(current.id),
          timetableService.getSubjects(current.id),
          timetableService.getPeriodSlots(current.id),
        ]);
        setDayOrders(dos);
        setSubjects(subs);
        setPeriodSlots(slots);
        if (dos.length > 0 && !dos.some((d) => d.code === selectedDayOrderCode)) {
          setSelectedDayOrderCode(dos[0].code);
        }
      }
    } catch (err) {
      console.error('Failed to load timetable:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSemesterData();
  }, [classId]);

  // Selected Day Order Object
  const currentDayOrder = useMemo(() => {
    return (
      dayOrders.find((d) => d.code === selectedDayOrderCode) ||
      dayOrders[0] || { id: '', code: 'A', name: 'Day Order A', sortOrder: 0 }
    );
  }, [dayOrders, selectedDayOrderCode]);

  // Slots for currently selected Day Order
  const currentDaySlots = useMemo(() => {
    if (!currentDayOrder.id) return [];
    return periodSlots
      .filter((s) => s.dayOrderId === currentDayOrder.id)
      .sort((a, b) => a.periodNumber - b.periodNumber);
  }, [periodSlots, currentDayOrder.id]);

  // Handlers: Semester Switch & Creation
  const handleCreateSemester = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSemesterForm.name.trim()) return;

    try {
      const codes = newSemesterForm.dayOrderList
        .split(',')
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean);

      const created = await timetableService.createSemester(
        classId,
        {
          name: newSemesterForm.name.trim(),
          academicYear: newSemesterForm.academicYear.trim(),
          startDate: newSemesterForm.startDate,
          endDate: newSemesterForm.endDate,
          totalPeriodsPerDay: Number(newSemesterForm.totalPeriodsPerDay) || 5,
        },
        codes.length > 0 ? codes : ['A', 'B', 'C', 'D', 'E', 'F']
      );

      setCreateSemesterModalOpen(false);
      setToastMsg(`Created semester "${created.name}" with day orders.`);
      await loadSemesterData(created.id);
    } catch (err) {
      console.error(err);
      setToastMsg('Failed to create semester.');
    }
  };

  // Handlers: Save Subject
  const handleSaveSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSemester || !newSubjectForm.code.trim() || !newSubjectForm.name.trim()) return;

    try {
      await timetableService.saveSubject(activeSemester.id, {
        id: editingSubjectId || undefined,
        code: newSubjectForm.code.trim().toUpperCase(),
        name: newSubjectForm.name.trim(),
        sessionType: newSubjectForm.sessionType,
        facultyName: newSubjectForm.facultyName.trim(),
        color: newSubjectForm.color,
      });

      const updatedSubs = await timetableService.getSubjects(activeSemester.id);
      setSubjects(updatedSubs);
      setNewSubjectForm({ code: '', name: '', sessionType: 'Lecture', facultyName: '', color: '#0878D1' });
      setEditingSubjectId(null);
      setToastMsg(editingSubjectId ? 'Subject updated.' : 'New subject added.');
    } catch (err) {
      console.error(err);
      setToastMsg('Failed to save subject.');
    }
  };

  const handleDeleteSubject = async (subId: string) => {
    if (!activeSemester) return;
    try {
      await timetableService.deleteSubject(activeSemester.id, subId);
      setSubjects((prev) => prev.filter((s) => s.id !== subId));
      setToastMsg('Subject removed.');
    } catch (err) {
      console.error(err);
      setToastMsg('Failed to delete subject.');
    }
  };

  // Handlers: Add Day Order
  const handleAddDayOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSemester || !newDayOrderCode.trim()) return;

    try {
      const code = newDayOrderCode.trim().toUpperCase();
      const added = await timetableService.addDayOrder(activeSemester.id, code, `Day Order ${code}`);
      setDayOrders((prev) => [...prev, added]);
      setNewDayOrderCode('');
      setToastMsg(`Added Day Order ${code}.`);
    } catch (err) {
      console.error(err);
      setToastMsg('Failed to add day order.');
    }
  };

  // Handlers: Period Slot Edit
  const openEditSlot = (slot: PeriodSlot) => {
    setEditingSlot({ ...slot });
    setEditSlotModalOpen(true);
  };

  const handleSaveSlot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSemester || !editingSlot) return;

    try {
      const selectedSub = subjects.find((s) => s.id === editingSlot.subjectId);
      const slotToSave: PeriodSlot = {
        ...editingSlot,
        subjectCode: selectedSub?.code,
        subjectName: selectedSub?.name,
        sessionType: selectedSub?.sessionType,
      };

      await timetableService.updatePeriodSlot(activeSemester.id, slotToSave);
      setPeriodSlots((prev) =>
        prev.map((s) =>
          s.dayOrderId === slotToSave.dayOrderId && s.periodNumber === slotToSave.periodNumber
            ? slotToSave
            : s
        )
      );
      setEditSlotModalOpen(false);
      setEditingSlot(null);
      setToastMsg(`Period ${slotToSave.periodNumber} updated for Day Order ${currentDayOrder.code}.`);
    } catch (err) {
      console.error(err);
      setToastMsg('Failed to save period.');
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Semester Selector & Management Header */}
      <Card className="border-[#0878D1]/15 bg-gradient-to-br from-white via-white to-[#EAF4FC]/60 dark:border-[#0878D1]/25 dark:from-[#111B27] dark:via-[#111B27] dark:to-[#0878D1]/10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="primary">{classProfile.classCode}</Badge>
              <Badge variant="success" dot>
                Shared Configuration
              </Badge>
              <span className="text-xs font-medium text-slate-500">
                {activeSemester?.academicYear || '2026-2027'}
              </span>
            </div>
            <div className="mt-1 flex items-center gap-2">
              <h2 className="font-display text-lg font-bold text-slate-900 sm:text-xl dark:text-white">
                {activeSemester?.name || 'Semester Timetable'}
              </h2>
            </div>
            <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-300">
              Configure once per semester • Select day order daily during attendance marking
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Semester Dropdown Switcher */}
            {semesters.length > 1 && (
              <select
                value={activeSemester?.id || ''}
                onChange={(e) => loadSemesterData(e.target.value)}
                className="h-9 rounded-full border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-800 shadow-xs focus:border-[#0878D1] focus:outline-none dark:border-slate-700 dark:bg-[#111B27] dark:text-slate-200"
              >
                {semesters.map((sem) => (
                  <option key={sem.id} value={sem.id}>
                    {sem.name}
                  </option>
                ))}
              </select>
            )}

            <Button
              size="sm"
              variant="outline"
              onClick={() => setSubjectsModalOpen(true)}
              leftIcon={<BookOpen className="h-3.5 w-3.5 text-[#0878D1]" />}
            >
              Subjects ({subjects.length})
            </Button>

            <Button
              size="sm"
              variant="outline"
              onClick={() => setDayOrdersModalOpen(true)}
              leftIcon={<Layers className="h-3.5 w-3.5 text-[#0878D1]" />}
            >
              Day Orders ({dayOrders.length})
            </Button>

            <Button
              size="sm"
              variant="primary"
              onClick={() => setCreateSemesterModalOpen(true)}
              leftIcon={<Plus className="h-3.5 w-3.5" />}
            >
              New Semester
            </Button>
          </div>
        </div>
      </Card>

      {/* Day Order Horizontal Tabs (WhatsApp Android pill style) */}
      <div className="flex flex-col gap-2 rounded-2xl border border-slate-200/80 bg-white p-3 shadow-xs dark:border-slate-800 dark:bg-[#111B27]">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-200">
            <CalendarClock className="h-4 w-4 text-[#0878D1]" />
            <span>Select Day Order to View or Edit Schedule:</span>
          </div>
          <span className="text-[11px] text-slate-400">
            {activeSemester?.totalPeriodsPerDay || 5} Periods / Day
          </span>
        </div>

        <div className="no-scrollbar flex gap-2 overflow-x-auto pt-1 pb-0.5">
          {dayOrders.map((dOrder) => {
            const isSelected = dOrder.code === selectedDayOrderCode;
            return (
              <button
                key={dOrder.id}
                type="button"
                onClick={() => setSelectedDayOrderCode(dOrder.code)}
                className={`flex shrink-0 items-center gap-2 rounded-full px-4 py-2 text-xs font-bold transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-[#0878D1] text-white shadow-xs'
                    : 'border border-slate-200/80 bg-slate-50 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-[#0E1621] dark:text-slate-300 dark:hover:bg-[#172434]'
                }`}
              >
                <span>{dOrder.name}</span>
                <span
                  className={`rounded-full px-1.5 py-0.2 text-[10px] ${
                    isSelected ? 'bg-white/25 text-white' : 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                  }`}
                >
                  {dOrder.code}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Periods List for the Selected Day Order */}
      <Card padding="none" className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#EAF4FC] font-display text-xs font-extrabold text-[#0878D1] dark:bg-[#0878D1]/20 dark:text-[#7CC4FA]">
              {currentDayOrder.code}
            </div>
            <div>
              <h3 className="font-display text-sm font-bold text-slate-900 dark:text-slate-100">
                {currentDayOrder.name} Schedule
              </h3>
              <p className="text-[11px] text-slate-500">
                Click any period to modify subject or timing
              </p>
            </div>
          </div>
          <Badge variant="primary">
            {currentDaySlots.length} Periods Configured
          </Badge>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {currentDaySlots.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">
              No periods found for this day order. Click below to add period slots.
            </div>
          ) : (
            currentDaySlots.map((slot) => {
              const hasSubject = Boolean(slot.subjectName);
              return (
                <div
                  key={slot.id}
                  onClick={() => openEditSlot(slot)}
                  className="flex items-center justify-between gap-3 px-4 py-3.5 transition-colors hover:bg-slate-50/90 sm:px-5 dark:hover:bg-[#172434]/60 cursor-pointer"
                >
                  <div className="flex min-w-0 items-center gap-3.5">
                    {/* Period badge */}
                    <div className="flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-2xl bg-[#EAF4FC] text-[#005A9E] dark:bg-[#0878D1]/20 dark:text-[#7CC4FA]">
                      <span className="text-[10px] font-medium opacity-75">Period</span>
                      <span className="text-xs font-extrabold">{slot.periodNumber}</span>
                    </div>

                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        {hasSubject ? (
                          <>
                            <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                              {slot.subjectName}
                            </p>
                            <Badge variant="neutral">{slot.subjectCode}</Badge>
                            {slot.sessionType && (
                              <Badge
                                variant={slot.sessionType === 'Lab' ? 'warning' : 'primary'}
                              >
                                {slot.sessionType}
                              </Badge>
                            )}
                          </>
                        ) : (
                          <span className="text-xs font-semibold text-slate-400 italic">
                            Free Period / Unassigned
                          </span>
                        )}
                      </div>

                      <p className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3 w-3 text-[#0878D1]" />
                          {slot.startTime} – {slot.endTime}
                        </span>
                        <span>•</span>
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {slot.room || 'LH-302'}
                        </span>
                      </p>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-2">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        openEditSlot(slot);
                      }}
                      className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-[#0878D1] dark:hover:bg-slate-800 dark:hover:text-[#66B8FA] cursor-pointer"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <ChevronRight className="h-4 w-4 text-slate-300" />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </Card>

      {/* Complete Semester Timetable Matrix Grid (All Day Orders side by side) */}
      <Card padding="none" className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/80 px-4 py-3 dark:border-slate-800 dark:bg-[#0E1621]">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-800 dark:text-slate-200">
            <FileSpreadsheet className="h-4 w-4 text-[#0878D1]" />
            <span>Complete Semester Timetable Matrix</span>
          </div>
          <span className="text-[11px] text-slate-400">Reusable across the semester</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-200 bg-slate-100/70 text-slate-600 uppercase tracking-wider dark:border-slate-800 dark:bg-[#111B27] dark:text-slate-400">
              <tr>
                <th className="px-3 py-3 w-28 text-center">Day Order</th>
                {DEFAULT_PERIOD_TIMES.slice(0, activeSemester?.totalPeriodsPerDay || 5).map((t) => (
                  <th key={t.periodNumber} className="px-3 py-3 min-w-[140px]">
                    <div>Period {t.periodNumber}</div>
                    <div className="text-[10px] font-normal lowercase text-slate-400">
                      {t.startTime}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {dayOrders.map((dOrder) => {
                const isSelected = dOrder.code === selectedDayOrderCode;
                return (
                  <tr
                    key={dOrder.id}
                    onClick={() => setSelectedDayOrderCode(dOrder.code)}
                    className={`cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-[#EAF4FC]/60 dark:bg-[#0878D1]/15'
                        : 'hover:bg-slate-50/70 dark:hover:bg-[#172434]/40'
                    }`}
                  >
                    <td className="px-3 py-3 text-center">
                      <div className="font-display text-xs font-bold text-[#0878D1] dark:text-[#7CC4FA]">
                        {dOrder.name}
                      </div>
                      <div className="text-[10px] text-slate-400">Order {dOrder.code}</div>
                    </td>

                    {DEFAULT_PERIOD_TIMES.slice(0, activeSemester?.totalPeriodsPerDay || 5).map((t) => {
                      const slot = periodSlots.find(
                        (s) => s.dayOrderId === dOrder.id && s.periodNumber === t.periodNumber
                      );
                      return (
                        <td key={t.periodNumber} className="px-3 py-2.5">
                          {slot?.subjectName ? (
                            <div className="rounded-xl border border-slate-200/80 bg-white p-2 shadow-2xs dark:border-slate-700 dark:bg-[#0E1621]">
                              <p className="font-semibold text-slate-900 truncate dark:text-slate-100">
                                {slot.subjectCode}
                              </p>
                              <p className="text-[10px] text-slate-500 truncate">
                                {slot.subjectName}
                              </p>
                              <p className="mt-0.5 text-[9px] font-medium text-[#0878D1] dark:text-[#7CC4FA]">
                                {slot.room || 'LH-302'}
                              </p>
                            </div>
                          ) : (
                            <span className="text-[11px] text-slate-400 italic">—</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* ========================================================================= */}
      {/* MODAL 1: EDIT PERIOD SLOT                                                */}
      {/* ========================================================================= */}
      <Modal
        open={editSlotModalOpen}
        onClose={() => setEditSlotModalOpen(false)}
        title={`Edit Period ${editingSlot?.periodNumber || ''} — Day Order ${currentDayOrder.code}`}
        subtitle="Changes are automatically saved for the entire semester"
      >
        {editingSlot && (
          <form onSubmit={handleSaveSlot} className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Assigned Subject
              </label>
              <select
                value={editingSlot.subjectId || ''}
                onChange={(e) => {
                  const sId = e.target.value;
                  const found = subjects.find((s) => s.id === sId);
                  setEditingSlot({
                    ...editingSlot,
                    subjectId: sId || undefined,
                    subjectCode: found?.code,
                    subjectName: found?.name,
                    sessionType: found?.sessionType,
                  });
                }}
                className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs font-medium text-slate-900 focus:border-[#0878D1] focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-[#0E1621] dark:text-slate-100"
              >
                <option value="">-- No Subject (Free Period) --</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.code} — {s.name} ({s.sessionType})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                  Start Time
                </label>
                <input
                  type="text"
                  value={editingSlot.startTime}
                  onChange={(e) =>
                    setEditingSlot({ ...editingSlot, startTime: e.target.value })
                  }
                  className="h-9 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs focus:border-[#0878D1] focus:outline-none dark:border-slate-700 dark:bg-[#0E1621]"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                  End Time
                </label>
                <input
                  type="text"
                  value={editingSlot.endTime}
                  onChange={(e) =>
                    setEditingSlot({ ...editingSlot, endTime: e.target.value })
                  }
                  className="h-9 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs focus:border-[#0878D1] focus:outline-none dark:border-slate-700 dark:bg-[#0E1621]"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                Classroom / Lab Venue
              </label>
              <input
                type="text"
                value={editingSlot.room || ''}
                onChange={(e) =>
                  setEditingSlot({ ...editingSlot, room: e.target.value })
                }
                placeholder="e.g. LH-302 or Lab-1"
                className="h-9 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs focus:border-[#0878D1] focus:outline-none dark:border-slate-700 dark:bg-[#0E1621]"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditSlotModalOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit">Save Period</Button>
            </div>
          </form>
        )}
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL 2: MANAGE SUBJECTS                                                  */}
      {/* ========================================================================= */}
      <Modal
        open={subjectsModalOpen}
        onClose={() => setSubjectsModalOpen(false)}
        title="Semester Subjects Master"
        subtitle={`Configure course codes & types for ${activeSemester?.name || ''}`}
        maxWidthClass="max-w-xl"
      >
        <div className="space-y-4">
          {/* Active subjects list */}
          <div className="divide-y divide-slate-100 max-h-56 overflow-y-auto rounded-2xl border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
            {subjects.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-500">
                No subjects created yet.
              </div>
            ) : (
              subjects.map((sub) => (
                <div
                  key={sub.id}
                  className="flex items-center justify-between p-3 text-xs hover:bg-slate-50 dark:hover:bg-[#172434]/40"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-[#0878D1] dark:text-[#7CC4FA]">
                        {sub.code}
                      </span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                        {sub.name}
                      </span>
                    </div>
                    {sub.facultyName && (
                      <p className="text-[11px] text-slate-400">Faculty: {sub.facultyName}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={sub.sessionType === 'Lab' ? 'warning' : 'primary'}>
                      {sub.sessionType}
                    </Badge>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingSubjectId(sub.id);
                        setNewSubjectForm({
                          code: sub.code,
                          name: sub.name,
                          sessionType: sub.sessionType,
                          facultyName: sub.facultyName || '',
                          color: sub.color,
                        });
                      }}
                      className="text-slate-400 hover:text-[#0878D1]"
                      title="Edit Subject"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteSubject(sub.id)}
                      className="text-slate-400 hover:text-red-600"
                      title="Remove Subject"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Add / Edit subject form */}
          <form
            onSubmit={handleSaveSubject}
            className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3.5 space-y-3 dark:border-slate-800 dark:bg-[#0E1621]"
          >
            <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
              {editingSubjectId ? 'Edit Subject' : 'Add New Subject'}
            </p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block text-[11px] text-slate-500">Subject Code</label>
                <input
                  type="text"
                  required
                  placeholder="CS506"
                  value={newSubjectForm.code}
                  onChange={(e) =>
                    setNewSubjectForm({ ...newSubjectForm, code: e.target.value.toUpperCase() })
                  }
                  className="h-8 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-xs uppercase focus:border-[#0878D1] focus:outline-none dark:border-slate-700 dark:bg-[#111B27]"
                />
              </div>
              <div>
                <label className="mb-1 block text-[11px] text-slate-500">Subject Name</label>
                <input
                  type="text"
                  required
                  placeholder="Artificial Intelligence"
                  value={newSubjectForm.name}
                  onChange={(e) =>
                    setNewSubjectForm({ ...newSubjectForm, name: e.target.value })
                  }
                  className="h-8 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-xs focus:border-[#0878D1] focus:outline-none dark:border-slate-700 dark:bg-[#111B27]"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block text-[11px] text-slate-500">Session Type</label>
                <select
                  value={newSubjectForm.sessionType}
                  onChange={(e) =>
                    setNewSubjectForm({
                      ...newSubjectForm,
                      sessionType: e.target.value as Subject['sessionType'],
                    })
                  }
                  className="h-8 w-full rounded-lg border border-slate-200 bg-white px-2 text-xs focus:border-[#0878D1] focus:outline-none dark:border-slate-700 dark:bg-[#111B27]"
                >
                  <option value="Lecture">Lecture</option>
                  <option value="Lab">Lab</option>
                  <option value="Tutorial">Tutorial</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-[11px] text-slate-500">Faculty / Teacher</label>
                <input
                  type="text"
                  placeholder="Dr. Smith"
                  value={newSubjectForm.facultyName}
                  onChange={(e) =>
                    setNewSubjectForm({ ...newSubjectForm, facultyName: e.target.value })
                  }
                  className="h-8 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-xs focus:border-[#0878D1] focus:outline-none dark:border-slate-700 dark:bg-[#111B27]"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              {editingSubjectId && (
                <Button
                  size="sm"
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setEditingSubjectId(null);
                    setNewSubjectForm({
                      code: '',
                      name: '',
                      sessionType: 'Lecture',
                      facultyName: '',
                      color: '#0878D1',
                    });
                  }}
                >
                  Cancel
                </Button>
              )}
              <Button size="sm" type="submit">
                {editingSubjectId ? 'Update Subject' : 'Add Subject'}
              </Button>
            </div>
          </form>
        </div>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL 3: MANAGE DAY ORDERS                                                */}
      {/* ========================================================================= */}
      <Modal
        open={dayOrdersModalOpen}
        onClose={() => setDayOrdersModalOpen(false)}
        title="Customizable Day Orders"
        subtitle={`Day Orders configured for ${activeSemester?.name || ''}`}
      >
        <div className="space-y-4">
          <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200 dark:divide-slate-800 dark:border-slate-800">
            {dayOrders.map((dOrder) => (
              <div
                key={dOrder.id}
                className="flex items-center justify-between p-3 text-xs"
              >
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#EAF4FC] font-bold text-[#0878D1] dark:bg-[#0878D1]/20 dark:text-[#7CC4FA]">
                    {dOrder.code}
                  </span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">
                    {dOrder.name}
                  </span>
                </div>
                {dayOrders.length > 1 && (
                  <button
                    type="button"
                    onClick={() => {
                      timetableService.deleteDayOrder(activeSemester!.id, dOrder.id);
                      setDayOrders((prev) => prev.filter((d) => d.id !== dOrder.id));
                    }}
                    className="text-slate-400 hover:text-red-600"
                    title="Remove Day Order"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Add custom day order */}
          <form onSubmit={handleAddDayOrder} className="flex gap-2">
            <input
              type="text"
              required
              maxLength={2}
              placeholder="e.g. G"
              value={newDayOrderCode}
              onChange={(e) => setNewDayOrderCode(e.target.value.toUpperCase())}
              className="h-9 w-24 rounded-xl border border-slate-200 bg-white px-3 font-mono text-xs uppercase focus:border-[#0878D1] focus:outline-none dark:border-slate-700 dark:bg-[#111B27]"
            />
            <Button size="sm" type="submit" leftIcon={<Plus className="h-3.5 w-3.5" />}>
              Add Day Order
            </Button>
          </form>
        </div>
      </Modal>

      {/* ========================================================================= */}
      {/* MODAL 4: CREATE SEMESTER                                                  */}
      {/* ========================================================================= */}
      <Modal
        open={createSemesterModalOpen}
        onClose={() => setCreateSemesterModalOpen(false)}
        title="Configure New Semester"
        subtitle="Set academic dates, day orders, and number of daily periods"
      >
        <form onSubmit={handleCreateSemester} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Semester Name
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Semester 6 (Spring 2027)"
              value={newSemesterForm.name}
              onChange={(e) =>
                setNewSemesterForm({ ...newSemesterForm, name: e.target.value })
              }
              className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs focus:border-[#0878D1] focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-[#0E1621]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                Academic Year
              </label>
              <input
                type="text"
                required
                placeholder="2026-2027"
                value={newSemesterForm.academicYear}
                onChange={(e) =>
                  setNewSemesterForm({ ...newSemesterForm, academicYear: e.target.value })
                }
                className="h-9 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs focus:border-[#0878D1] focus:outline-none dark:border-slate-700 dark:bg-[#0E1621]"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                Periods Per Day
              </label>
              <input
                type="number"
                min={4}
                max={8}
                value={newSemesterForm.totalPeriodsPerDay}
                onChange={(e) =>
                  setNewSemesterForm({
                    ...newSemesterForm,
                    totalPeriodsPerDay: Number(e.target.value) || 5,
                  })
                }
                className="h-9 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs focus:border-[#0878D1] focus:outline-none dark:border-slate-700 dark:bg-[#0E1621]"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                Start Date
              </label>
              <input
                type="date"
                required
                value={newSemesterForm.startDate}
                onChange={(e) =>
                  setNewSemesterForm({ ...newSemesterForm, startDate: e.target.value })
                }
                className="h-9 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs focus:border-[#0878D1] focus:outline-none dark:border-slate-700 dark:bg-[#0E1621]"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
                End Date
              </label>
              <input
                type="date"
                required
                value={newSemesterForm.endDate}
                onChange={(e) =>
                  setNewSemesterForm({ ...newSemesterForm, endDate: e.target.value })
                }
                className="h-9 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs focus:border-[#0878D1] focus:outline-none dark:border-slate-700 dark:bg-[#0E1621]"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
              Day Orders (Comma-separated)
            </label>
            <input
              type="text"
              value={newSemesterForm.dayOrderList}
              onChange={(e) =>
                setNewSemesterForm({ ...newSemesterForm, dayOrderList: e.target.value })
              }
              placeholder="A, B, C, D, E, F"
              className="h-9 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs focus:border-[#0878D1] focus:outline-none dark:border-slate-700 dark:bg-[#0E1621]"
            />
            <span className="text-[10px] text-slate-400">
              Representatives choose the day order manually for each calendar day
            </span>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setCreateSemesterModalOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit">Create Semester Timetable</Button>
          </div>
        </form>
      </Modal>

      {/* Global Toast */}
      <Toast message={toastMsg} type="success" onDismiss={() => setToastMsg(null)} />
    </div>
  );
};
