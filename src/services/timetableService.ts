import { supabase, isSupabaseConfigured } from '../lib/supabase';
import {
  DayOrder,
  PeriodSlot,
  Semester,
  Subject,
} from '../types';

const STORAGE_PREFIX = 'repz_tt_';

// Initial default subjects
const INITIAL_SUBJECTS: Omit<Subject, 'id' | 'semesterId'>[] = [
  { code: 'CS501', name: 'Operating Systems', color: '#0878D1', sessionType: 'Lecture', facultyName: 'Dr. Ramesh' },
  { code: 'CS502', name: 'Database Management Systems', color: '#005A9E', sessionType: 'Lecture', facultyName: 'Prof. Ananya' },
  { code: 'CS503', name: 'Computer Networks', color: '#0284C7', sessionType: 'Lecture', facultyName: 'Dr. Joseph' },
  { code: 'CS504', name: 'Theory of Computation', color: '#4F46E5', sessionType: 'Lecture', facultyName: 'Prof. Swaminathan' },
  { code: 'CS505', name: 'Software Engineering', color: '#0D9488', sessionType: 'Lecture', facultyName: 'Dr. Preeti' },
  { code: 'CS511', name: 'DBMS & SQL Lab', color: '#7C3AED', sessionType: 'Lab', facultyName: 'Prof. Ananya' },
  { code: 'CS512', name: 'OS & Networks Lab', color: '#2563EB', sessionType: 'Lab', facultyName: 'Dr. Joseph' },
];

// Standard period timings
export const DEFAULT_PERIOD_TIMES = [
  { periodNumber: 1, startTime: '09:00 AM', endTime: '09:50 AM' },
  { periodNumber: 2, startTime: '10:00 AM', endTime: '10:50 AM' },
  { periodNumber: 3, startTime: '11:10 AM', endTime: '12:00 PM' },
  { periodNumber: 4, startTime: '01:30 PM', endTime: '02:20 PM' },
  { periodNumber: 5, startTime: '02:30 PM', endTime: '03:20 PM' },
  { periodNumber: 6, startTime: '03:30 PM', endTime: '04:20 PM' },
];

/**
 * Creates initial default semester for class
 */
function createInitialSemester(classId: string): {
  semester: Semester;
  dayOrders: DayOrder[];
  subjects: Subject[];
  periodSlots: PeriodSlot[];
} {
  const semId = `sem-${classId}-5`;
  const semester: Semester = {
    id: semId,
    classId,
    name: 'Semester 5 (Autumn 2026)',
    academicYear: '2026-2027',
    startDate: '2026-07-15',
    endDate: '2026-12-15',
    totalPeriodsPerDay: 5,
    isActive: true,
  };

  const dayOrderCodes = ['A', 'B', 'C', 'D', 'E', 'F'];
  const dayOrders: DayOrder[] = dayOrderCodes.map((code, index) => ({
    id: `do-${semId}-${code}`,
    semesterId: semId,
    code,
    name: `Day Order ${code}`,
    description: `Configured day order ${code}`,
    sortOrder: index,
  }));

  const subjects: Subject[] = INITIAL_SUBJECTS.map((s, idx) => ({
    id: `sub-${semId}-${idx + 1}`,
    semesterId: semId,
    ...s,
  }));

  // Build grid of period slots
  const periodSlots: PeriodSlot[] = [];
  dayOrders.forEach((dOrder, dIdx) => {
    for (let pNum = 1; pNum <= 5; pNum++) {
      const time = DEFAULT_PERIOD_TIMES[pNum - 1];
      const subIdx = (dIdx + pNum - 1) % subjects.length;
      const sub = subjects[subIdx];

      periodSlots.push({
        id: `slot-${dOrder.id}-p${pNum}`,
        semesterId: semId,
        dayOrderId: dOrder.id,
        periodNumber: pNum,
        startTime: time.startTime,
        endTime: time.endTime,
        subjectId: sub.id,
        subjectCode: sub.code,
        subjectName: sub.name,
        sessionType: sub.sessionType,
        room: pNum === 4 && sub.sessionType === 'Lab' ? 'Lab-1' : 'LH-302',
      });
    }
  });

  return { semester, dayOrders, subjects, periodSlots };
}

export const timetableService = {
  /**
   * Get all semesters configured for a class
   */
  async getSemesters(classId: string): Promise<Semester[]> {
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('semesters')
          .select('*')
          .eq('class_id', classId)
          .order('start_date', { ascending: false });

        if (!error && data && data.length > 0) {
          return data.map((d) => ({
            id: d.id,
            classId: d.class_id,
            name: d.name,
            academicYear: d.academic_year,
            startDate: d.start_date,
            endDate: d.end_date,
            totalPeriodsPerDay: d.total_periods_per_day,
            isActive: d.is_active,
            createdAt: d.created_at,
          }));
        }
      } catch (err) {
        console.warn('Error fetching semesters from Supabase:', err);
      }
    }

    const cached = localStorage.getItem(`${STORAGE_PREFIX}semesters_${classId}`);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch {
        // ignore
      }
    }

    // Initialize initial default semester
    const initial = createInitialSemester(classId);
    this.saveSemesterBundleLocally(classId, initial.semester, initial.dayOrders, initial.subjects, initial.periodSlots);
    return [initial.semester];
  },

  /**
   * Create a new semester
   */
  async createSemester(
    classId: string,
    data: Omit<Semester, 'id' | 'classId' | 'isActive'>,
    dayOrderCodes: string[] = ['A', 'B', 'C', 'D', 'E', 'F']
  ): Promise<Semester> {
    const semId = `sem-${Date.now()}`;
    const newSem: Semester = {
      id: semId,
      classId,
      ...data,
      isActive: true,
    };

    const dayOrders: DayOrder[] = dayOrderCodes.map((code, index) => ({
      id: `do-${semId}-${code}`,
      semesterId: semId,
      code,
      name: `Day Order ${code}`,
      description: `Configured day order ${code}`,
      sortOrder: index,
    }));

    const subjects: Subject[] = INITIAL_SUBJECTS.map((s, idx) => ({
      id: `sub-${semId}-${idx + 1}`,
      semesterId: semId,
      ...s,
    }));

    const periodSlots: PeriodSlot[] = [];
    dayOrders.forEach((dOrder) => {
      for (let pNum = 1; pNum <= newSem.totalPeriodsPerDay; pNum++) {
        const time = DEFAULT_PERIOD_TIMES[pNum - 1] || {
          periodNumber: pNum,
          startTime: `${pNum + 8}:00 AM`,
          endTime: `${pNum + 8}:50 AM`,
        };

        periodSlots.push({
          id: `slot-${dOrder.id}-p${pNum}`,
          semesterId: semId,
          dayOrderId: dOrder.id,
          periodNumber: pNum,
          startTime: time.startTime,
          endTime: time.endTime,
          room: 'LH-302',
        });
      }
    });

    if (isSupabaseConfigured && supabase) {
      try {
        const { data: insertedSem } = await supabase
          .from('semesters')
          .insert({
            class_id: classId,
            name: newSem.name,
            academic_year: newSem.academicYear,
            start_date: newSem.startDate,
            end_date: newSem.endDate,
            total_periods_per_day: newSem.totalPeriodsPerDay,
            is_active: true,
          })
          .select()
          .single();

        if (insertedSem) {
          newSem.id = insertedSem.id;
        }
      } catch (err) {
        console.warn('Supabase createSemester warning:', err);
      }
    }

    const currentSems = await this.getSemesters(classId);
    const updated = [newSem, ...currentSems.map((s) => ({ ...s, isActive: false }))];
    localStorage.setItem(`${STORAGE_PREFIX}semesters_${classId}`, JSON.stringify(updated));

    this.saveSemesterBundleLocally(classId, newSem, dayOrders, subjects, periodSlots);
    return newSem;
  },

  /**
   * Get all Day Orders for a semester
   */
  async getDayOrders(semesterId: string): Promise<DayOrder[]> {
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('day_orders')
          .select('*')
          .eq('semester_id', semesterId)
          .order('sort_order', { ascending: true });

        if (!error && data && data.length > 0) {
          return data.map((d) => ({
            id: d.id,
            semesterId: d.semester_id,
            code: d.code,
            name: d.name,
            description: d.description,
            sortOrder: d.sort_order,
          }));
        }
      } catch (err) {
        console.warn('Error fetching day orders from Supabase:', err);
      }
    }

    const cached = localStorage.getItem(`${STORAGE_PREFIX}day_orders_${semesterId}`);
    return cached ? JSON.parse(cached) : [];
  },

  /**
   * Add a custom day order (e.g. Day Order G, Special Order)
   */
  async addDayOrder(semesterId: string, code: string, name: string): Promise<DayOrder> {
    const existing = await this.getDayOrders(semesterId);
    const newDo: DayOrder = {
      id: `do-${semesterId}-${code.toUpperCase()}`,
      semesterId,
      code: code.toUpperCase(),
      name: name || `Day Order ${code.toUpperCase()}`,
      sortOrder: existing.length,
    };

    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('day_orders').insert({
          semester_id: semesterId,
          code: newDo.code,
          name: newDo.name,
          sort_order: newDo.sortOrder,
        });
      } catch (err) {
        console.warn('Supabase addDayOrder warning:', err);
      }
    }

    const updated = [...existing, newDo];
    localStorage.setItem(`${STORAGE_PREFIX}day_orders_${semesterId}`, JSON.stringify(updated));
    return newDo;
  },

  /**
   * Delete Day Order
   */
  async deleteDayOrder(semesterId: string, dayOrderId: string): Promise<void> {
    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('day_orders').delete().eq('id', dayOrderId);
      } catch (err) {
        console.warn('Supabase deleteDayOrder warning:', err);
      }
    }

    const existing = await this.getDayOrders(semesterId);
    const updated = existing.filter((d) => d.id !== dayOrderId);
    localStorage.setItem(`${STORAGE_PREFIX}day_orders_${semesterId}`, JSON.stringify(updated));
  },

  /**
   * Get all Subjects for a semester
   */
  async getSubjects(semesterId: string): Promise<Subject[]> {
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('subjects')
          .select('*')
          .eq('semester_id', semesterId)
          .order('code', { ascending: true });

        if (!error && data && data.length > 0) {
          return data.map((s) => ({
            id: s.id,
            semesterId: s.semester_id,
            code: s.code,
            name: s.name,
            color: s.color,
            sessionType: s.session_type,
            facultyName: s.faculty_name,
          }));
        }
      } catch (err) {
        console.warn('Error fetching subjects from Supabase:', err);
      }
    }

    const cached = localStorage.getItem(`${STORAGE_PREFIX}subjects_${semesterId}`);
    return cached ? JSON.parse(cached) : [];
  },

  /**
   * Add or update Subject
   */
  async saveSubject(semesterId: string, subject: Omit<Subject, 'id' | 'semesterId'> & { id?: string }): Promise<Subject> {
    const existing = await this.getSubjects(semesterId);
    const subObj: Subject = {
      id: subject.id || `sub-${semesterId}-${Date.now()}`,
      semesterId,
      code: subject.code.trim().toUpperCase(),
      name: subject.name.trim(),
      color: subject.color || '#0878D1',
      sessionType: subject.sessionType,
      facultyName: subject.facultyName || '',
    };

    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('subjects').upsert({
          id: subject.id,
          semester_id: semesterId,
          code: subObj.code,
          name: subObj.name,
          color: subObj.color,
          session_type: subObj.sessionType,
          faculty_name: subObj.facultyName,
        });
      } catch (err) {
        console.warn('Supabase saveSubject warning:', err);
      }
    }

    const updated = subject.id
      ? existing.map((s) => (s.id === subject.id ? subObj : s))
      : [...existing, subObj];

    localStorage.setItem(`${STORAGE_PREFIX}subjects_${semesterId}`, JSON.stringify(updated));
    return subObj;
  },

  /**
   * Delete Subject
   */
  async deleteSubject(semesterId: string, subjectId: string): Promise<void> {
    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('subjects').delete().eq('id', subjectId);
      } catch (err) {
        console.warn('Supabase deleteSubject warning:', err);
      }
    }

    const existing = await this.getSubjects(semesterId);
    const updated = existing.filter((s) => s.id !== subjectId);
    localStorage.setItem(`${STORAGE_PREFIX}subjects_${semesterId}`, JSON.stringify(updated));
  },

  /**
   * Get all period slots for a semester
   */
  async getPeriodSlots(semesterId: string): Promise<PeriodSlot[]> {
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('timetable_periods')
          .select(`
            *,
            subject:subjects (code, name, session_type)
          `)
          .eq('semester_id', semesterId);

        if (!error && data && data.length > 0) {
          return data.map((p) => ({
            id: p.id,
            semesterId: p.semester_id,
            dayOrderId: p.day_order_id,
            periodNumber: p.period_number,
            startTime: p.start_time,
            endTime: p.end_time,
            subjectId: p.subject_id,
            subjectCode: p.subject?.code,
            subjectName: p.subject?.name,
            sessionType: p.subject?.session_type,
            room: p.room,
            notes: p.notes,
          }));
        }
      } catch (err) {
        console.warn('Error fetching period slots from Supabase:', err);
      }
    }

    const cached = localStorage.getItem(`${STORAGE_PREFIX}period_slots_${semesterId}`);
    return cached ? JSON.parse(cached) : [];
  },

  /**
   * Update or Assign a Period Slot
   */
  async updatePeriodSlot(semesterId: string, slot: PeriodSlot): Promise<PeriodSlot> {
    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('timetable_periods').upsert({
          id: slot.id.startsWith('slot-') ? undefined : slot.id,
          semester_id: semesterId,
          day_order_id: slot.dayOrderId,
          period_number: slot.periodNumber,
          start_time: slot.startTime,
          end_time: slot.endTime,
          subject_id: slot.subjectId,
          room: slot.room,
          notes: slot.notes || '',
        });
      } catch (err) {
        console.warn('Supabase updatePeriodSlot warning:', err);
      }
    }

    const existing = await this.getPeriodSlots(semesterId);
    const exists = existing.some((s) => s.dayOrderId === slot.dayOrderId && s.periodNumber === slot.periodNumber);
    const updated = exists
      ? existing.map((s) => (s.dayOrderId === slot.dayOrderId && s.periodNumber === slot.periodNumber ? slot : s))
      : [...existing, slot];

    localStorage.setItem(`${STORAGE_PREFIX}period_slots_${semesterId}`, JSON.stringify(updated));
    return slot;
  },

  /**
   * Daily Day Order Logging: Rep sets which Day Order applies for a date
   */
  async getDailyDayOrder(classId: string, dateStr: string): Promise<DayOrder | null> {
    const cached = localStorage.getItem(`${STORAGE_PREFIX}daily_${classId}_${dateStr}`);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch {
        // ignore
      }
    }
    return null;
  },

  async setDailyDayOrder(classId: string, dateStr: string, dayOrder: DayOrder, repId?: string): Promise<void> {
    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('daily_day_order_logs').upsert({
          class_id: classId,
          date: dateStr,
          day_order_id: dayOrder.id,
          selected_by_rep_id: repId,
        });
      } catch (err) {
        console.warn('Supabase setDailyDayOrder warning:', err);
      }
    }

    localStorage.setItem(`${STORAGE_PREFIX}daily_${classId}_${dateStr}`, JSON.stringify(dayOrder));
  },

  /**
   * Helper: Cache whole semester bundle locally
   */
  saveSemesterBundleLocally(
    classId: string,
    sem: Semester,
    dayOrders: DayOrder[],
    subjects: Subject[],
    periodSlots: PeriodSlot[]
  ) {
    localStorage.setItem(`${STORAGE_PREFIX}semesters_${classId}`, JSON.stringify([sem]));
    localStorage.setItem(`${STORAGE_PREFIX}day_orders_${sem.id}`, JSON.stringify(dayOrders));
    localStorage.setItem(`${STORAGE_PREFIX}subjects_${sem.id}`, JSON.stringify(subjects));
    localStorage.setItem(`${STORAGE_PREFIX}period_slots_${sem.id}`, JSON.stringify(periodSlots));
  },
};
