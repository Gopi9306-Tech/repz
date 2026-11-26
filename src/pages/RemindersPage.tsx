import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Bell,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  Edit2,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Users2,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ReminderCategory, ReminderItem, ReminderPriority } from '../types';
import { remindersService } from '../services/remindersService';
import { googleCalendarService } from '../services/googleCalendarService';
import { formatDateDisplayIST, getTodayDateIST } from '../utils/retentionUtils';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Modal } from '../components/ui/Modal';
import { Toast } from '../components/ui/Toast';

type ViewTab = 'upcoming' | 'completed' | 'all';

export const RemindersPage: React.FC = () => {
  const { activeRep, coRep, classProfile } = useAuth();
  const classId = classProfile.id;

  // Data states
  const [reminders, setReminders] = useState<ReminderItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Tabs & Filters
  const [activeTab, setActiveTab] = useState<ViewTab>('upcoming');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editingReminder, setEditingReminder] = useState<ReminderItem | null>(null);
  const [syncingId, setSyncingId] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    dueDate: getTodayDateIST(),
    dueTime: '05:00 PM',
    category: 'Assignments' as ReminderCategory,
    priority: 'normal' as ReminderPriority,
    assignedToRepId: 'both' as string | 'both',
  });
  const [formError, setFormError] = useState<string | null>(null);

  // Load reminders from Supabase
  const loadReminders = async () => {
    setIsLoading(true);
    try {
      const data = await remindersService.getReminders(classId);
      setReminders(data);
    } catch (err) {
      console.error('Failed to load reminders:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadReminders();
  }, [classId]);

  // Derived filtered reminders
  const filteredReminders = useMemo(() => {
    return reminders.filter((rem) => {
      // 1. Tab filter
      if (activeTab === 'upcoming' && rem.completed) return false;
      if (activeTab === 'completed' && !rem.completed) return false;

      // 2. Category filter
      if (selectedCategory !== 'all' && rem.category !== selectedCategory) return false;

      // 3. Search query
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      return (
        rem.title.toLowerCase().includes(q) ||
        rem.description.toLowerCase().includes(q) ||
        rem.category.toLowerCase().includes(q)
      );
    });
  }, [reminders, activeTab, selectedCategory, searchQuery]);

  // Toggle reminder completion
  const handleToggleComplete = async (item: ReminderItem) => {
    try {
      const nextStatus = !item.completed;
      const updated = await remindersService.updateReminder(classId, item.id, {
        completed: nextStatus,
      });

      setReminders((prev) => prev.map((r) => (r.id === item.id ? updated : r)));
      setToastMsg(
        nextStatus
          ? `Marked "${item.title}" as completed.`
          : `Moved "${item.title}" back to upcoming.`
      );
    } catch (err) {
      console.error(err);
      setToastMsg('Failed to update status.');
    }
  };

  // Delete reminder
  const handleDeleteReminder = async (item: ReminderItem) => {
    try {
      await remindersService.deleteReminder(classId, item.id);
      setReminders((prev) => prev.filter((r) => r.id !== item.id));
      setToastMsg(`Removed reminder "${item.title}".`);
    } catch (err) {
      console.error(err);
      setToastMsg('Failed to delete reminder.');
    }
  };

  // Open Create Modal
  const openCreateModal = () => {
    setFormError(null);
    setFormData({
      title: '',
      description: '',
      dueDate: getTodayDateIST(),
      dueTime: '05:00 PM',
      category: 'Assignments',
      priority: 'normal',
      assignedToRepId: 'both',
    });
    setCreateModalOpen(true);
  };

  // Open Edit Modal
  const openEditModal = (item: ReminderItem) => {
    setFormError(null);
    setEditingReminder(item);
    setFormData({
      title: item.title,
      description: item.description,
      dueDate: item.dueDate,
      dueTime: item.dueTime,
      category: item.category,
      priority: item.priority,
      assignedToRepId: item.assignedToRepId,
    });
  };

  // Submit Handler (Create or Edit)
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      setFormError('Please enter a reminder title.');
      return;
    }

    try {
      if (editingReminder) {
        const updated = await remindersService.updateReminder(classId, editingReminder.id, {
          title: formData.title.trim(),
          description: formData.description.trim(),
          dueDate: formData.dueDate,
          dueTime: formData.dueTime,
          category: formData.category,
          priority: formData.priority,
          assignedToRepId: formData.assignedToRepId,
        });

        setReminders((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
        setEditingReminder(null);
        setToastMsg(`Updated reminder "${updated.title}".`);
      } else {
        const created = await remindersService.createReminder(classId, {
          title: formData.title.trim(),
          description: formData.description.trim(),
          dueDate: formData.dueDate,
          dueTime: formData.dueTime,
          category: formData.category,
          priority: formData.priority,
          assignedToRepId: formData.assignedToRepId,
        });

        setReminders((prev) => [created, ...prev]);
        setCreateModalOpen(false);
        setToastMsg(`Created reminder "${created.title}". Shared with Co-Rep.`);
      }
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Error saving reminder.');
    }
  };

  // GOOGLE CALENDAR INTEGRATION
  const handleSyncToGoogleCalendar = async (item: ReminderItem) => {
    setSyncingId(item.id);
    try {
      // PREVENT DUPLICATE EVENTS: Checks if already synced
      if (item.googleCalendarEventId) {
        setToastMsg(`Already synced to Google Calendar (Event ID: ${item.googleCalendarEventId}).`);
        setSyncingId(null);
        return;
      }

      const res = await googleCalendarService.syncReminderToGoogleCalendar(
        item,
        classProfile.classCode
      );

      // Save event ID to prevent duplicate events on subsequent clicks
      const updated = await remindersService.updateReminder(classId, item.id, {
        googleCalendarEventId: res.eventId,
        googleCalendarSyncedAt: new Date().toISOString(),
      });

      setReminders((prev) => prev.map((r) => (r.id === item.id ? updated : r)));
      setToastMsg(
        `Added "${item.title}" to Google Calendar! (${classProfile.classCode})`
      );
    } catch (err: unknown) {
      console.error('Google Calendar Sync Error:', err);
      // GRACEFUL FALLBACK
      setToastMsg('Google Calendar opened in a new tab.');
    } finally {
      setSyncingId(null);
    }
  };

  // Category Badge Styler
  const getCategoryBadgeVariant = (cat: ReminderCategory) => {
    switch (cat) {
      case 'Examinations':
        return 'absent';
      case 'Assignments':
        return 'primary';
      case 'Submissions':
        return 'warning';
      case 'College Events':
        return 'success';
      default:
        return 'neutral';
    }
  };

  return (
    <div className="space-y-4">
      {/* Top Header & Actions */}
      <Card className="border-[#0878D1]/20 bg-gradient-to-r from-white via-white to-[#EAF4FC]/60 p-4 dark:border-[#0878D1]/30 dark:from-[#111B27] dark:via-[#111B27] dark:to-[#0878D1]/10">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#0878D1] text-white shadow-xs">
              <Bell className="h-5 w-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-display text-base font-bold text-slate-900 sm:text-lg dark:text-white">
                  Class Reminders &amp; Calendar
                </h2>
                <Badge variant="primary">{classProfile.classCode}</Badge>
                <Badge variant="success" dot>
                  2 Reps Shared
                </Badge>
              </div>
              <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-300">
                Track deadlines, exams &amp; submissions • One-click sync with Google Calendar
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <button
              type="button"
              onClick={loadReminders}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 hover:text-[#0878D1] dark:border-slate-800 dark:bg-[#111B27] dark:text-slate-300 cursor-pointer"
              title="Refresh reminders"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>

            <Button
              size="sm"
              variant="primary"
              onClick={openCreateModal}
              leftIcon={<Plus className="h-4 w-4" />}
            >
              New Reminder
            </Button>
          </div>
        </div>
      </Card>

      {/* Tabs & Search Filter Bar */}
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-2xs sm:flex-row sm:items-center sm:justify-between dark:border-slate-800 dark:bg-[#111B27]">
        {/* Search */}
        <div className="relative flex-1 sm:max-w-md">
          <Search className="pointer-events-none absolute top-3 left-3.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search reminders by title or description..."
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

        {/* View Tabs: Upcoming vs Completed */}
        <div className="flex rounded-full border border-slate-200 bg-slate-100 p-0.5 dark:border-slate-800 dark:bg-[#0E1621]">
          <button
            type="button"
            onClick={() => setActiveTab('upcoming')}
            className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'upcoming'
                ? 'bg-white text-[#0878D1] shadow-xs dark:bg-[#172434] dark:text-[#7CC4FA]'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400'
            }`}
          >
            Upcoming ({reminders.filter((r) => !r.completed).length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('completed')}
            className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'completed'
                ? 'bg-white text-[#0878D1] shadow-xs dark:bg-[#172434] dark:text-[#7CC4FA]'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400'
            }`}
          >
            Completed ({reminders.filter((r) => r.completed).length})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('all')}
            className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'all'
                ? 'bg-white text-[#0878D1] shadow-xs dark:bg-[#172434] dark:text-[#7CC4FA]'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400'
            }`}
          >
            All ({reminders.length})
          </button>
        </div>
      </div>

      {/* 4 Category Filter Pills */}
      <div className="no-scrollbar flex gap-1.5 overflow-x-auto pb-0.5">
        <button
          type="button"
          onClick={() => setSelectedCategory('all')}
          className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
            selectedCategory === 'all'
              ? 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900'
              : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-800 dark:bg-[#111B27] dark:text-slate-400'
          }`}
        >
          All Categories
        </button>

        <button
          type="button"
          onClick={() => setSelectedCategory('Assignments')}
          className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
            selectedCategory === 'Assignments'
              ? 'bg-[#0878D1] text-white shadow-xs'
              : 'border border-slate-200 bg-white text-[#005A9E] hover:bg-slate-50 dark:border-slate-800 dark:bg-[#111B27] dark:text-[#7CC4FA]'
          }`}
        >
          Assignments ({reminders.filter((r) => r.category === 'Assignments').length})
        </button>

        <button
          type="button"
          onClick={() => setSelectedCategory('Examinations')}
          className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
            selectedCategory === 'Examinations'
              ? 'bg-red-600 text-white shadow-xs'
              : 'border border-slate-200 bg-white text-red-600 hover:bg-red-50 dark:border-slate-800 dark:bg-[#111B27] dark:text-red-400'
          }`}
        >
          Examinations ({reminders.filter((r) => r.category === 'Examinations').length})
        </button>

        <button
          type="button"
          onClick={() => setSelectedCategory('Submissions')}
          className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
            selectedCategory === 'Submissions'
              ? 'bg-amber-600 text-white shadow-xs'
              : 'border border-slate-200 bg-white text-amber-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-[#111B27] dark:text-amber-400'
          }`}
        >
          Submissions ({reminders.filter((r) => r.category === 'Submissions').length})
        </button>

        <button
          type="button"
          onClick={() => setSelectedCategory('College Events')}
          className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
            selectedCategory === 'College Events'
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'border border-slate-200 bg-white text-emerald-700 hover:bg-slate-50 dark:border-slate-800 dark:bg-[#111B27] dark:text-emerald-400'
          }`}
        >
          College Events ({reminders.filter((r) => r.category === 'College Events').length})
        </button>
      </div>

      {/* Reminders List (WhatsApp clean card style) */}
      <Card padding="none" className="overflow-hidden">
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {filteredReminders.length === 0 ? (
            <div className="p-12 text-center">
              <Bell className="mx-auto h-8 w-8 text-slate-300 dark:text-slate-600" />
              <p className="mt-2 text-sm font-semibold text-slate-800 dark:text-slate-200">
                No reminders found
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Tap &ldquo;New Reminder&rdquo; to add a shared assignment, exam, or submission deadline.
              </p>
            </div>
          ) : (
            filteredReminders.map((rem) => {
              const isHigh = rem.priority === 'high' && !rem.completed;
              const isGCalSynced = Boolean(rem.googleCalendarEventId);

              return (
                <div
                  key={rem.id}
                  className={`flex items-start justify-between gap-3 px-4 py-3.5 transition-colors sm:px-5 ${
                    rem.completed
                      ? 'bg-slate-50/60 opacity-70 dark:bg-[#0E1621]/60'
                      : 'hover:bg-slate-50/90 dark:hover:bg-[#172434]/60'
                  }`}
                >
                  <div className="flex min-w-0 items-start gap-3">
                    {/* Completion checkbox button */}
                    <button
                      type="button"
                      onClick={() => handleToggleComplete(rem)}
                      className={`mt-1 flex h-5.5 w-5.5 shrink-0 items-center justify-center rounded-full border transition-all cursor-pointer ${
                        rem.completed
                          ? 'border-emerald-600 bg-emerald-600 text-white shadow-xs'
                          : 'border-slate-300 bg-white hover:border-[#0878D1] dark:border-slate-600 dark:bg-[#111B27]'
                      }`}
                      title={rem.completed ? 'Mark pending' : 'Mark completed'}
                    >
                      {rem.completed && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                    </button>

                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p
                          className={`text-sm font-semibold ${
                            rem.completed
                              ? 'line-through text-slate-500'
                              : 'text-slate-900 dark:text-slate-100'
                          }`}
                        >
                          {rem.title}
                        </p>
                        <Badge variant={getCategoryBadgeVariant(rem.category)}>
                          {rem.category}
                        </Badge>
                        {isHigh && <Badge variant="absent">High Priority</Badge>}
                      </div>

                      {rem.description && (
                        <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                          {rem.description}
                        </p>
                      )}

                      <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
                        <span className="inline-flex items-center gap-1 font-medium text-slate-700 dark:text-slate-300">
                          <Calendar className="h-3 w-3 text-[#0878D1]" />
                          {formatDateDisplayIST(rem.dueDate)}
                        </span>
                        <span>•</span>
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3 w-3 text-[#0878D1]" />
                          {rem.dueTime}
                        </span>
                        <span>•</span>
                        <span className="inline-flex items-center gap-1">
                          <Users2 className="h-3 w-3 text-[#0878D1]" />
                          {rem.assignedToRepId === 'both' ? 'Both Reps' : 'Assigned Rep'}
                        </span>
                        {isGCalSynced && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.2 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                            <CheckCircle2 className="h-3 w-3" />
                            Google Calendar Synced
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions: Google Calendar Sync, Edit, Delete */}
                  <div className="flex shrink-0 items-center gap-1">
                    {/* Add to Google Calendar Button */}
                    <button
                      type="button"
                      onClick={() => handleSyncToGoogleCalendar(rem)}
                      disabled={syncingId === rem.id}
                      className={`flex h-8 items-center gap-1 rounded-full border px-2.5 text-xs font-semibold transition-all cursor-pointer ${
                        isGCalSynced
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800/60 dark:bg-emerald-950/60 dark:text-emerald-300'
                          : 'border-[#0878D1]/20 bg-[#EAF4FC] text-[#005A9E] hover:bg-[#DCEDFB] dark:bg-[#0878D1]/20 dark:text-[#7CC4FA]'
                      }`}
                      title={
                        isGCalSynced
                          ? 'Synced to Google Calendar'
                          : 'Add event to Google Calendar'
                      }
                    >
                      <svg className="h-3.5 w-3.5" viewBox="0 0 24 24">
                        <path
                          fill="#4285F4"
                          d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                        />
                        <path
                          fill="#34A853"
                          d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        />
                        <path
                          fill="#FBBC05"
                          d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                        />
                        <path
                          fill="#EA4335"
                          d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                        />
                      </svg>
                      <span className="hidden sm:inline">
                        {isGCalSynced ? 'Synced' : 'Google Cal'}
                      </span>
                    </button>

                    {/* Edit button */}
                    <button
                      type="button"
                      onClick={() => openEditModal(rem)}
                      className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-[#0878D1] dark:hover:bg-slate-800"
                      title="Edit reminder"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>

                    {/* Delete button */}
                    <button
                      type="button"
                      onClick={() => handleDeleteReminder(rem)}
                      className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/50"
                      title="Delete reminder"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </Card>

      {/* ========================================================================= */}
      {/* MODAL: CREATE OR EDIT REMINDER                                            */}
      {/* ========================================================================= */}
      <Modal
        open={createModalOpen || Boolean(editingReminder)}
        onClose={() => {
          setCreateModalOpen(false);
          setEditingReminder(null);
        }}
        title={editingReminder ? 'Edit Class Reminder' : 'Create Class Reminder'}
        subtitle={`Shared with both representatives of ${classProfile.classCode}`}
      >
        <form onSubmit={handleFormSubmit} className="space-y-4">
          {formError && (
            <div className="flex items-center gap-2 rounded-xl bg-red-50 p-3 text-xs font-medium text-red-700 dark:bg-red-950/60 dark:text-red-300">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Operating Systems Lab Assignment 2"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs focus:border-[#0878D1] focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-[#0E1621]"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
              Description
            </label>
            <textarea
              rows={3}
              placeholder="Detailed instructions, submission venue, or requirements..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs focus:border-[#0878D1] focus:bg-white focus:outline-none dark:border-slate-700 dark:bg-[#0E1621]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Category
              </label>
              <select
                value={formData.category}
                onChange={(e) =>
                  setFormData({ ...formData, category: e.target.value as ReminderCategory })
                }
                className="h-9 w-full rounded-xl border border-slate-200 bg-slate-50 px-2.5 text-xs focus:border-[#0878D1] focus:outline-none dark:border-slate-700 dark:bg-[#0E1621]"
              >
                <option value="Assignments">Assignments</option>
                <option value="Examinations">Examinations</option>
                <option value="Submissions">Submissions</option>
                <option value="College Events">College Events</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Priority
              </label>
              <select
                value={formData.priority}
                onChange={(e) =>
                  setFormData({ ...formData, priority: e.target.value as ReminderPriority })
                }
                className="h-9 w-full rounded-xl border border-slate-200 bg-slate-50 px-2.5 text-xs focus:border-[#0878D1] focus:outline-none dark:border-slate-700 dark:bg-[#0E1621]"
              >
                <option value="normal">Normal</option>
                <option value="high">High Priority</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Due Date
              </label>
              <input
                type="date"
                required
                value={formData.dueDate}
                onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                className="h-9 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs focus:border-[#0878D1] focus:outline-none dark:border-slate-700 dark:bg-[#0E1621]"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-700 dark:text-slate-300">
                Due Time
              </label>
              <input
                type="text"
                placeholder="05:00 PM"
                value={formData.dueTime}
                onChange={(e) => setFormData({ ...formData, dueTime: e.target.value })}
                className="h-9 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-xs focus:border-[#0878D1] focus:outline-none dark:border-slate-700 dark:bg-[#0E1621]"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-400">
              Assigned Representative
            </label>
            <select
              value={formData.assignedToRepId}
              onChange={(e) => setFormData({ ...formData, assignedToRepId: e.target.value })}
              className="h-9 w-full rounded-xl border border-slate-200 bg-slate-50 px-2.5 text-xs focus:border-[#0878D1] focus:outline-none dark:border-slate-700 dark:bg-[#0E1621]"
            >
              <option value="both">Both Representatives</option>
              <option value={activeRep.id}>{activeRep.fullName} (Active Rep)</option>
              <option value={coRep.id}>{coRep.fullName} (Co-Rep)</option>
            </select>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setCreateModalOpen(false);
                setEditingReminder(null);
              }}
            >
              Cancel
            </Button>
            <Button type="submit">
              {editingReminder ? 'Save Changes' : 'Create Reminder'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Global Toast */}
      <Toast message={toastMsg} type="success" onDismiss={() => setToastMsg(null)} />
    </div>
  );
};
