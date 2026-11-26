import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BellRing,
  Copy,
  Database,
  LogOut,
  Moon,
  ShieldCheck,
  Sun,
  Users2,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { isSupabaseConfigured } from '../lib/supabase';
import { Avatar } from '../components/ui/Avatar';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Toast } from '../components/ui/Toast';
import { ToggleSwitch } from '../components/ui/ToggleSwitch';

export const SettingsPage: React.FC = () => {
  const { activeRep, coRep, classProfile, signOut, simulateRepLogin } = useAuth();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();

  const [coRepAlerts, setCoRepAlerts] = useState(true);
  const [periodReminders, setPeriodReminders] = useState(true);
  const [highlightLowAttendance, setHighlightLowAttendance] = useState(true);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(classProfile.classJoinCode);
      setToastMsg(`Copied pairing code ${classProfile.classJoinCode}`);
    } catch {
      setToastMsg(`Pairing code: ${classProfile.classJoinCode}`);
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/login', { replace: true });
  };

  const handleSwitchRepSession = async (email: string, repName: string) => {
    await simulateRepLogin(email);
    setToastMsg(`Session switched to ${repName}. Both access identical class records.`);
  };

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      {/* Assigned Class Banner */}
      <Card>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                {classProfile.classCode}
              </h2>
              <Badge variant="primary">{classProfile.semester}</Badge>
            </div>
            <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-300">
              {classProfile.department} • {classProfile.section} ({classProfile.academicYear})
            </p>
          </div>
          <button
            type="button"
            onClick={handleCopyCode}
            className="inline-flex items-center gap-2 self-start rounded-full border border-[#0878D1]/25 bg-[#EAF4FC] px-3.5 py-2 text-xs font-semibold text-[#005A9E] transition-colors hover:bg-[#DCEDFB] dark:border-[#0878D1]/35 dark:bg-[#0878D1]/20 dark:text-[#7CC4FA] cursor-pointer"
          >
            <span className="font-mono">{classProfile.classJoinCode}</span>
            <Copy className="h-3.5 w-3.5" />
          </button>
        </div>
      </Card>

      {/* Two Representatives Sharing Same Class */}
      <Card padding="none" className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <Users2 className="h-4.5 w-4.5 text-[#0878D1]" />
            <div>
              <h3 className="font-display text-sm font-bold text-slate-900 dark:text-slate-100">
                Paired Class Representatives (2/2)
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Both reps have identical real-time access to {classProfile.classCode}
              </p>
            </div>
          </div>
          <Badge variant="success" dot>
            Synced
          </Badge>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {classProfile.representatives.map((rep) => {
            const isCurrent = rep.id === activeRep.id || rep.email === activeRep.email;
            return (
              <div
                key={rep.id}
                className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="flex items-center gap-3">
                  <Avatar
                    name={rep.fullName}
                    size="md"
                    variant={isCurrent ? 'primary' : 'tint'}
                    online={rep.isOnline}
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {rep.fullName}
                      </p>
                      <Badge variant={isCurrent ? 'primary' : 'neutral'}>{rep.slot}</Badge>
                    </div>
                    <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                      {rep.rollNumber} • {rep.email}
                    </p>
                  </div>
                </div>

                {isCurrent ? (
                  <Badge variant="success">Current Active Session</Badge>
                ) : (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleSwitchRepSession(rep.email, rep.fullName)}
                  >
                    Switch to {rep.fullName.split(' ')[0]}
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      {/* Theme Appearance */}
      <Card>
        <h3 className="font-display text-sm font-bold text-slate-900 dark:text-slate-100">
          Appearance
        </h3>
        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
          Choose between Light and Dark interface themes
        </p>

        <div className="mt-3.5 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setTheme('light')}
            className={`flex items-center gap-3 rounded-2xl border p-3.5 text-left transition-all cursor-pointer ${
              theme === 'light'
                ? 'border-[#0878D1] bg-[#EAF4FC]/70 text-[#005A9E]'
                : 'border-slate-200 bg-slate-50/70 text-slate-600 dark:border-slate-800 dark:bg-[#0E1621] dark:text-slate-300'
            }`}
          >
            <Sun className="h-5 w-5" />
            <div>
              <p className="text-sm font-semibold">Light Theme</p>
              <p className="text-[11px] opacity-80">#F3F6FA &amp; White</p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setTheme('dark')}
            className={`flex items-center gap-3 rounded-2xl border p-3.5 text-left transition-all cursor-pointer ${
              theme === 'dark'
                ? 'border-[#0878D1] bg-[#0878D1]/20 text-[#7CC4FA]'
                : 'border-slate-200 bg-slate-50/70 text-slate-600 dark:border-slate-800 dark:bg-[#0E1621] dark:text-slate-300'
            }`}
          >
            <Moon className="h-5 w-5" />
            <div>
              <p className="text-sm font-semibold">Dark Theme</p>
              <p className="text-[11px] opacity-80">Low-glare Slate</p>
            </div>
          </button>
        </div>
      </Card>

      {/* Notification & Register Preferences */}
      <Card padding="none" className="overflow-hidden">
        <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-4 dark:border-slate-800">
          <BellRing className="h-4.5 w-4.5 text-[#0878D1]" />
          <h3 className="font-display text-sm font-bold text-slate-900 dark:text-slate-100">
            Representative Preferences
          </h3>
        </div>

        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          <div className="flex items-center justify-between gap-4 px-5 py-3.5">
            <div>
              <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                Co-Rep Submission Alerts
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Notify when your paired representative ({coRep.fullName}) marks a period
              </p>
            </div>
            <ToggleSwitch
              checked={coRepAlerts}
              onChange={setCoRepAlerts}
              ariaLabel="Co-Rep Submission Alerts"
            />
          </div>

          <div className="flex items-center justify-between gap-4 px-5 py-3.5">
            <div>
              <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                Period Start Reminders
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Remind 5 minutes before scheduled timetable periods
              </p>
            </div>
            <ToggleSwitch
              checked={periodReminders}
              onChange={setPeriodReminders}
              ariaLabel="Period Start Reminders"
            />
          </div>

          <div className="flex items-center justify-between gap-4 px-5 py-3.5">
            <div>
              <p className="text-sm font-medium text-slate-900 dark:text-slate-100">
                Highlight Students Below 75%
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Show red threshold indicator in attendance &amp; student lists
              </p>
            </div>
            <ToggleSwitch
              checked={highlightLowAttendance}
              onChange={setHighlightLowAttendance}
              ariaLabel="Highlight Students Below 75%"
            />
          </div>
        </div>
      </Card>

      {/* Access Scope & Backend Readiness Info */}
      <Card>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#EAF4FC] text-[#0878D1] dark:bg-[#0878D1]/20 dark:text-[#7CC4FA]">
              <Database className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Supabase Auth &amp; RLS Status
                </p>
                <Badge variant={isSupabaseConfigured ? 'success' : 'primary'}>
                  {isSupabaseConfigured ? 'Live Supabase Auth' : 'Ready for Keys'}
                </Badge>
              </div>
              <p className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                <ShieldCheck className="h-3.5 w-3.5 text-[#0878D1]" />
                RLS enforced: Representatives can only read their assigned class.
              </p>
            </div>
          </div>

          <Button
            variant="danger"
            onClick={handleSignOut}
            leftIcon={<LogOut className="h-4 w-4" />}
          >
            Log Out
          </Button>
        </div>
      </Card>

      <Toast message={toastMsg} type="success" onDismiss={() => setToastMsg(null)} />
    </div>
  );
};
