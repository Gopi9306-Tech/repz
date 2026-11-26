import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { ReminderCategory, ReminderItem, ReminderPriority } from '../types';
import { getTodayDateIST } from '../utils/retentionUtils';

const REMINDERS_STORAGE_KEY = 'repz_reminders_';

/**
 * Baseline initial reminders categorized into the 4 required types:
 * 1. Assignments
 * 2. Examinations
 * 3. Submissions
 * 4. College Events
 */
function getInitialReminders(classId: string): ReminderItem[] {
  const today = getTodayDateIST();
  const [y, m, d] = today.split('-').map(Number);

  const getFutureDate = (plusDays: number) => {
    const dt = new Date(Date.UTC(y, m - 1, d));
    dt.setUTCDate(dt.getUTCDate() + plusDays);
    return dt.toISOString().split('T')[0];
  };

  return [
    {
      id: 'rem-01',
      classId,
      title: 'Operating Systems Assignment 3 Submission',
      description: 'Collect CPU scheduling simulation reports in LH-302 before 04:00 PM.',
      dueDate: getFutureDate(1),
      dueTime: '04:00 PM',
      dueDateLabel: 'Tomorrow',
      category: 'Assignments',
      priority: 'high',
      completed: false,
      assignedToRepId: 'both',
    },
    {
      id: 'rem-02',
      classId,
      title: 'DBMS Mid-Semester Lab Examination',
      description: 'Batch A & B SQL practical assessment in Lab-2. Verify system access.',
      dueDate: getFutureDate(3),
      dueTime: '09:30 AM',
      dueDateLabel: 'In 3 days',
      category: 'Examinations',
      priority: 'high',
      completed: false,
      assignedToRepId: 'both',
    },
    {
      id: 'rem-03',
      classId,
      title: 'Inter-College Hackathon Registration Deadline',
      description: 'Submit compiled list of participating class teams to HOD office.',
      dueDate: getFutureDate(4),
      dueTime: '05:00 PM',
      dueDateLabel: 'In 4 days',
      category: 'College Events',
      priority: 'normal',
      completed: false,
      assignedToRepId: 'rep-1',
    },
    {
      id: 'rem-04',
      classId,
      title: 'Collect Sports On-Duty Forms from Athletes',
      description: 'Verify signatures from Physical Education Department before updating logs.',
      dueDate: getFutureDate(2),
      dueTime: '01:15 PM',
      dueDateLabel: 'In 2 days',
      category: 'Submissions',
      priority: 'normal',
      completed: false,
      assignedToRepId: 'rep-2',
    },
    {
      id: 'rem-05',
      classId,
      title: 'Computer Networks Seminar Presentation',
      description: 'Auditorium B session on IPv6 transitions and network security.',
      dueDate: getFutureDate(0), // Today
      dueTime: '11:10 AM',
      dueDateLabel: 'Today',
      category: 'College Events',
      priority: 'normal',
      completed: true,
      assignedToRepId: 'both',
    },
  ];
}

export const remindersService = {
  /**
   * Fetches all shared reminders for a class from Supabase (or local storage fallback).
   */
  async getReminders(classId: string): Promise<ReminderItem[]> {
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('reminders')
          .select('*')
          .eq('class_id', classId)
          .order('due_date', { ascending: true })
          .order('created_at', { ascending: false });

        if (!error && data && data.length > 0) {
          return data.map((d) => ({
            id: d.id,
            classId: d.class_id,
            title: d.title,
            description: d.description || '',
            dueDate: d.due_date,
            dueTime: d.due_time || '09:00 AM',
            category: d.category as ReminderCategory,
            priority: d.priority as ReminderPriority,
            completed: d.completed,
            assignedToRepId: d.assigned_to_rep_id || 'both',
            googleCalendarEventId: d.google_calendar_event_id,
            googleCalendarSyncedAt: d.google_calendar_synced_at,
            createdAt: d.created_at,
            updatedAt: d.updated_at,
          }));
        }
      } catch (err) {
        console.warn('Error fetching reminders from Supabase, loading fallback:', err);
      }
    }

    const cached = localStorage.getItem(`${REMINDERS_STORAGE_KEY}${classId}`);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch {
        // ignore
      }
    }

    const initial = getInitialReminders(classId);
    localStorage.setItem(`${REMINDERS_STORAGE_KEY}${classId}`, JSON.stringify(initial));
    return initial;
  },

  /**
   * Creates a new shared class reminder
   */
  async createReminder(
    classId: string,
    reminderData: Omit<ReminderItem, 'id' | 'completed' | 'createdAt' | 'updatedAt'>
  ): Promise<ReminderItem> {
    const newId = `rem-${Date.now()}`;
    const now = new Date().toISOString();

    const newReminder: ReminderItem = {
      ...reminderData,
      id: newId,
      classId,
      completed: false,
      createdAt: now,
      updatedAt: now,
    };

    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('reminders')
          .insert({
            class_id: classId,
            title: reminderData.title.trim(),
            description: reminderData.description.trim(),
            due_date: reminderData.dueDate,
            due_time: reminderData.dueTime,
            category: reminderData.category,
            priority: reminderData.priority,
            completed: false,
            assigned_to_rep_id: reminderData.assignedToRepId,
            google_calendar_event_id: reminderData.googleCalendarEventId,
          })
          .select()
          .single();

        if (!error && data) {
          newReminder.id = data.id;
        }
      } catch (err) {
        console.warn('Supabase createReminder warning, saved locally:', err);
      }
    }

    const current = await this.getReminders(classId);
    const updated = [newReminder, ...current];
    localStorage.setItem(`${REMINDERS_STORAGE_KEY}${classId}`, JSON.stringify(updated));
    return newReminder;
  },

  /**
   * Updates an existing reminder
   */
  async updateReminder(
    classId: string,
    reminderId: string,
    updates: Partial<ReminderItem>
  ): Promise<ReminderItem> {
    const current = await this.getReminders(classId);
    const target = current.find((r) => r.id === reminderId);
    if (!target) {
      throw new Error('Reminder not found.');
    }

    const now = new Date().toISOString();
    const updatedRecord: ReminderItem = {
      ...target,
      ...updates,
      updatedAt: now,
    };

    if (isSupabaseConfigured && supabase) {
      try {
        await supabase
          .from('reminders')
          .update({
            title: updatedRecord.title,
            description: updatedRecord.description,
            due_date: updatedRecord.dueDate,
            due_time: updatedRecord.dueTime,
            category: updatedRecord.category,
            priority: updatedRecord.priority,
            completed: updatedRecord.completed,
            assigned_to_rep_id: updatedRecord.assignedToRepId,
            google_calendar_event_id: updatedRecord.googleCalendarEventId,
            google_calendar_synced_at: updatedRecord.googleCalendarSyncedAt,
            updated_at: now,
          })
          .eq('id', reminderId);
      } catch (err) {
        console.warn('Supabase updateReminder warning:', err);
      }
    }

    const updatedList = current.map((r) => (r.id === reminderId ? updatedRecord : r));
    localStorage.setItem(`${REMINDERS_STORAGE_KEY}${classId}`, JSON.stringify(updatedList));
    return updatedRecord;
  },

  /**
   * Deletes a reminder from Supabase and local cache
   */
  async deleteReminder(classId: string, reminderId: string): Promise<void> {
    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('reminders').delete().eq('id', reminderId);
      } catch (err) {
        console.warn('Supabase deleteReminder warning:', err);
      }
    }

    const current = await this.getReminders(classId);
    const updated = current.filter((r) => r.id !== reminderId);
    localStorage.setItem(`${REMINDERS_STORAGE_KEY}${classId}`, JSON.stringify(updated));
  },
};
