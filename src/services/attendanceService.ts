import { supabase, isSupabaseConfigured } from '../lib/supabase';
import {
  AttendanceRecordSummary,
  AttendanceSessionRecord,
  AttendanceStatus,
} from '../types';
import {
  getRetentionCutoffDateIST,
  getTodayDateIST,
  isWithinRetentionWindow,
} from '../utils/retentionUtils';

const ATTENDANCE_SESSIONS_STORAGE_KEY = 'repz_attendance_sessions_';

/**
 * Generates sample records strictly within the last 7 days of Asia/Kolkata date
 */
function getInitialAttendanceRecords(classId: string): AttendanceSessionRecord[] {
  const today = getTodayDateIST();
  const [y, m, d] = today.split('-').map(Number);

  // Helper to make date N days ago
  const daysAgo = (n: number) => {
    const dt = new Date(Date.UTC(y, m - 1, d));
    dt.setUTCDate(dt.getUTCDate() - n);
    return dt.toISOString().split('T')[0];
  };

  const records: AttendanceSessionRecord[] = [
    {
      id: 'hist-01',
      classId,
      date: daysAgo(0), // Today
      dayOrderCode: 'A',
      periodNumber: 1,
      timeRange: '09:00 AM – 09:50 AM',
      subjectCode: 'CS501',
      subjectName: 'Operating Systems',
      room: 'LH-302',
      totalStudents: 16,
      presentCount: 14,
      absentCount: 2,
      markedByRepId: 'rep-1',
      markedByRepName: 'Aarav Menon',
      markedAt: `${daysAgo(0)}T09:12:00Z`,
      updatedAt: `${daysAgo(0)}T09:12:00Z`,
      absentStudentIds: ['stu-05', 'stu-14'],
      presentStudentIds: [],
      studentStatuses: { 'stu-05': 'absent', 'stu-14': 'absent' },
      synced: true,
    },
    {
      id: 'hist-02',
      classId,
      date: daysAgo(0), // Today
      dayOrderCode: 'A',
      periodNumber: 2,
      timeRange: '10:00 AM – 10:50 AM',
      subjectCode: 'CS502',
      subjectName: 'Database Management Systems',
      room: 'LH-302',
      totalStudents: 16,
      presentCount: 15,
      absentCount: 1,
      markedByRepId: 'rep-2',
      markedByRepName: 'Priya Nair',
      markedAt: `${daysAgo(0)}T10:15:00Z`,
      updatedAt: `${daysAgo(0)}T10:15:00Z`,
      absentStudentIds: ['stu-03'],
      presentStudentIds: [],
      studentStatuses: { 'stu-03': 'absent' },
      synced: true,
    },
    {
      id: 'hist-03',
      classId,
      date: daysAgo(1), // Yesterday
      dayOrderCode: 'F',
      periodNumber: 3,
      timeRange: '11:10 AM – 12:00 PM',
      subjectCode: 'CS503',
      subjectName: 'Computer Networks',
      room: 'LH-305',
      totalStudents: 16,
      presentCount: 16,
      absentCount: 0,
      markedByRepId: 'rep-1',
      markedByRepName: 'Aarav Menon',
      markedAt: `${daysAgo(1)}T11:20:00Z`,
      updatedAt: `${daysAgo(1)}T11:20:00Z`,
      absentStudentIds: [],
      presentStudentIds: [],
      studentStatuses: {},
      synced: true,
    },
    {
      id: 'hist-04',
      classId,
      date: daysAgo(2), // 2 days ago
      dayOrderCode: 'E',
      periodNumber: 1,
      timeRange: '09:00 AM – 09:50 AM',
      subjectCode: 'CS504',
      subjectName: 'Theory of Computation',
      room: 'LH-302',
      totalStudents: 16,
      presentCount: 13,
      absentCount: 3,
      markedByRepId: 'rep-2',
      markedByRepName: 'Priya Nair',
      markedAt: `${daysAgo(2)}T09:10:00Z`,
      updatedAt: `${daysAgo(2)}T09:10:00Z`,
      absentStudentIds: ['stu-05', 'stu-10', 'stu-14'],
      presentStudentIds: [],
      studentStatuses: { 'stu-05': 'absent', 'stu-10': 'absent', 'stu-14': 'absent' },
      synced: true,
    },
    {
      id: 'hist-05',
      classId,
      date: daysAgo(3), // 3 days ago
      dayOrderCode: 'D',
      periodNumber: 4,
      timeRange: '01:30 PM – 03:10 PM',
      subjectCode: 'CS511',
      subjectName: 'DBMS & SQL Lab',
      room: 'Lab-1',
      totalStudents: 16,
      presentCount: 14,
      absentCount: 2,
      markedByRepId: 'rep-1',
      markedByRepName: 'Aarav Menon',
      markedAt: `${daysAgo(3)}T13:40:00Z`,
      updatedAt: `${daysAgo(3)}T13:40:00Z`,
      absentStudentIds: ['stu-03', 'stu-14'],
      presentStudentIds: [],
      studentStatuses: { 'stu-03': 'absent', 'stu-14': 'absent' },
      synced: true,
    },
    {
      id: 'hist-06',
      classId,
      date: daysAgo(4), // 4 days ago
      dayOrderCode: 'C',
      periodNumber: 2,
      timeRange: '10:00 AM – 10:50 AM',
      subjectCode: 'CS505',
      subjectName: 'Software Engineering',
      room: 'LH-304',
      totalStudents: 16,
      presentCount: 15,
      absentCount: 1,
      markedByRepId: 'rep-2',
      markedByRepName: 'Priya Nair',
      markedAt: `${daysAgo(4)}T10:12:00Z`,
      updatedAt: `${daysAgo(4)}T10:12:00Z`,
      absentStudentIds: ['stu-08'],
      presentStudentIds: [],
      studentStatuses: { 'stu-08': 'absent' },
      synced: true,
    },
    {
      id: 'hist-07',
      classId,
      date: daysAgo(6), // 6 days ago (boundary of 7-day retention)
      dayOrderCode: 'B',
      periodNumber: 1,
      timeRange: '09:00 AM – 09:50 AM',
      subjectCode: 'CS502',
      subjectName: 'Database Management Systems',
      room: 'LH-302',
      totalStudents: 16,
      presentCount: 16,
      absentCount: 0,
      markedByRepId: 'rep-1',
      markedByRepName: 'Aarav Menon',
      markedAt: `${daysAgo(6)}T09:08:00Z`,
      updatedAt: `${daysAgo(6)}T09:08:00Z`,
      absentStudentIds: [],
      presentStudentIds: [],
      studentStatuses: {},
      synced: true,
    },
  ];

  return records;
}

export const attendanceService = {
  /**
   * Fetches attendance records for a class that remain strictly within the 7-day retention window
   * (calculated in Asia/Kolkata timezone).
   */
  async getAllSessions(classId: string): Promise<AttendanceSessionRecord[]> {
    const cutoffDate = getRetentionCutoffDateIST(7);

    if (isSupabaseConfigured && supabase) {
      try {
        // Query only records on or after cutoffDate
        const { data: sessions, error } = await supabase
          .from('attendance_sessions')
          .select(`
            *,
            entries:attendance_entries (student_id, status)
          `)
          .eq('class_id', classId)
          .gte('date', cutoffDate) // Strictly enforce 7-day window
          .order('date', { ascending: false })
          .order('period_number', { ascending: false });

        if (!error && sessions && sessions.length > 0) {
          return sessions.map((s) => {
            const studentStatuses: Record<string, AttendanceStatus> = {};
            const absentIds: string[] = [];
            const presentIds: string[] = [];

            const entries = (s.entries as Array<{ student_id: string; status: AttendanceStatus }>) || [];
            entries.forEach((e) => {
              studentStatuses[e.student_id] = e.status;
              if (e.status === 'absent') {
                absentIds.push(e.student_id);
              } else {
                presentIds.push(e.student_id);
              }
            });

            return {
              id: s.id,
              classId: s.class_id,
              semesterId: s.semester_id,
              date: s.date,
              dayOrderId: s.day_order_id,
              dayOrderCode: s.day_order_code,
              periodNumber: s.period_number,
              timeRange: s.time_range,
              subjectId: s.subject_id,
              subjectCode: s.subject_code,
              subjectName: s.subject_name,
              room: s.room,
              totalStudents: s.total_students,
              presentCount: s.present_count,
              absentCount: s.absent_count,
              markedByRepId: s.marked_by_rep_id,
              markedByRepName: s.marked_by_rep_name,
              markedAt: s.marked_at,
              updatedAt: s.updated_at,
              absentStudentIds: absentIds,
              presentStudentIds: presentIds,
              studentStatuses,
              synced: true,
            };
          });
        }
      } catch (err) {
        console.warn('Supabase getAllSessions error, loading local cache:', err);
      }
    }

    // LocalStorage fallback: enforce strict 7-day retention
    const cached = localStorage.getItem(`${ATTENDANCE_SESSIONS_STORAGE_KEY}${classId}`);
    let list: AttendanceSessionRecord[];

    if (cached) {
      try {
        list = JSON.parse(cached);
      } catch {
        list = getInitialAttendanceRecords(classId);
      }
    } else {
      list = getInitialAttendanceRecords(classId);
    }

    // AUTOMATIC DELETION: Filter out records older than 7 days
    const prunedList = list.filter((item) => isWithinRetentionWindow(item.date, 7));

    // Persist pruned list if any expired records were dropped
    if (prunedList.length !== list.length) {
      localStorage.setItem(
        `${ATTENDANCE_SESSIONS_STORAGE_KEY}${classId}`,
        JSON.stringify(prunedList)
      );
    }

    return prunedList;
  },

  /**
   * Fetches an existing attendance session for a specific date and period
   */
  async getSessionByDateAndPeriod(
    classId: string,
    dateStr: string,
    periodNumber: number
  ): Promise<AttendanceSessionRecord | null> {
    const all = await this.getAllSessions(classId);
    return all.find((s) => s.date === dateStr && s.periodNumber === periodNumber) || null;
  },

  /**
   * Saves attendance with DUPLICATE PREVENTION & 7-day retention verification
   */
  async saveAttendanceSession(
    classId: string,
    sessionData: {
      id?: string;
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
      studentStatuses: Record<string, AttendanceStatus>;
      markedByRepId: string;
      markedByRepName: string;
    },
    isEditing = false
  ): Promise<AttendanceSessionRecord> {
    const allSessions = await this.getAllSessions(classId);

    // Duplicate Check: Same class, date, and period
    const existingIndex = allSessions.findIndex(
      (s) =>
        s.date === sessionData.date &&
        s.periodNumber === sessionData.periodNumber &&
        (sessionData.id ? s.id !== sessionData.id : true)
    );

    if (existingIndex !== -1 && !isEditing) {
      throw new Error(
        `Duplicate Attendance Record: Attendance for Period ${sessionData.periodNumber} on ${sessionData.date} has already been marked by ${allSessions[existingIndex].markedByRepName}.`
      );
    }

    // Calculate present and absent counts
    const statusEntries = Object.entries(sessionData.studentStatuses);
    const totalStudents = statusEntries.length;
    const absentStudentIds = statusEntries
      .filter(([_, st]) => st === 'absent')
      .map(([id]) => id);
    const presentStudentIds = statusEntries
      .filter(([_, st]) => st === 'present')
      .map(([id]) => id);
    const absentCount = absentStudentIds.length;
    const presentCount = totalStudents - absentCount;

    const now = new Date().toISOString();
    const sessionId =
      sessionData.id ||
      (existingIndex !== -1 ? allSessions[existingIndex].id : `att-${Date.now()}`);

    const newRecord: AttendanceSessionRecord = {
      id: sessionId,
      classId,
      semesterId: sessionData.semesterId,
      date: sessionData.date,
      dayOrderId: sessionData.dayOrderId,
      dayOrderCode: sessionData.dayOrderCode,
      periodNumber: sessionData.periodNumber,
      timeRange: sessionData.timeRange,
      subjectId: sessionData.subjectId,
      subjectCode: sessionData.subjectCode,
      subjectName: sessionData.subjectName,
      room: sessionData.room || 'LH-302',
      totalStudents,
      presentCount,
      absentCount,
      markedByRepId: sessionData.markedByRepId,
      markedByRepName: sessionData.markedByRepName,
      markedAt: existingIndex !== -1 ? allSessions[existingIndex].markedAt : now,
      updatedAt: now,
      absentStudentIds,
      presentStudentIds,
      studentStatuses: sessionData.studentStatuses,
      synced: true,
    };

    // Save permanently to Supabase
    if (isSupabaseConfigured && supabase) {
      try {
        const { data: upsertedSession, error: sessionError } = await supabase
          .from('attendance_sessions')
          .upsert(
            {
              id: sessionId.startsWith('att-') ? undefined : sessionId,
              class_id: classId,
              semester_id: sessionData.semesterId,
              date: sessionData.date,
              day_order_id: sessionData.dayOrderId,
              day_order_code: sessionData.dayOrderCode,
              period_number: sessionData.periodNumber,
              time_range: sessionData.timeRange,
              subject_id: sessionData.subjectId,
              subject_code: sessionData.subjectCode,
              subject_name: sessionData.subjectName,
              room: sessionData.room || 'LH-302',
              total_students: totalStudents,
              present_count: presentCount,
              absent_count: absentCount,
              marked_by_rep_id: sessionData.markedByRepId,
              marked_by_rep_name: sessionData.markedByRepName,
              updated_at: now,
            },
            { onConflict: 'class_id, date, period_number' }
          )
          .select()
          .single();

        if (sessionError) {
          console.warn('Supabase attendance session upsert error:', sessionError);
        }

        const effectiveSessionId = upsertedSession ? upsertedSession.id : sessionId;
        newRecord.id = effectiveSessionId;

        // Save individual student entries
        const entriesPayload = statusEntries.map(([studentId, status]) => ({
          session_id: effectiveSessionId,
          student_id: studentId,
          status,
        }));

        await supabase
          .from('attendance_entries')
          .upsert(entriesPayload, { onConflict: 'session_id, student_id' });
      } catch (err) {
        console.warn('Supabase attendance save warning, saved locally:', err);
      }
    }

    // Update local cache
    let updatedSessions: AttendanceSessionRecord[];
    const targetIdx = allSessions.findIndex(
      (s) =>
        s.id === newRecord.id ||
        (s.date === newRecord.date && s.periodNumber === newRecord.periodNumber)
    );

    if (targetIdx !== -1) {
      updatedSessions = allSessions.map((s, idx) => (idx === targetIdx ? newRecord : s));
    } else {
      updatedSessions = [newRecord, ...allSessions];
    }

    localStorage.setItem(
      `${ATTENDANCE_SESSIONS_STORAGE_KEY}${classId}`,
      JSON.stringify(updatedSessions)
    );

    return newRecord;
  },

  /**
   * Converts session records to summary format for Attendance History
   */
  async getAttendanceHistorySummaries(classId: string): Promise<AttendanceRecordSummary[]> {
    const sessions = await this.getAllSessions(classId);
    return sessions.map((s) => ({
      id: s.id,
      date: s.date,
      dayOrderCode: s.dayOrderCode,
      periodNumber: s.periodNumber,
      timeRange: s.timeRange,
      subjectCode: s.subjectCode,
      subjectName: s.subjectName,
      presentCount: s.presentCount,
      absentCount: s.absentCount,
      totalStudents: s.totalStudents,
      markedByRepId: s.markedByRepId,
      markedByRepName: s.markedByRepName,
      markedAt: s.markedAt,
      absentStudentIds: s.absentStudentIds,
      synced: s.synced,
    }));
  },
};
