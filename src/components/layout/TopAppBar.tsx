import React from 'react';
import { Link } from 'react-router-dom';
import { Bell, CheckCircle2, GraduationCap, Moon, Settings, Sun } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { Avatar } from '../ui/Avatar';

interface TopAppBarProps {
  title: string;
  subtitle: string;
}

export const TopAppBar: React.FC<TopAppBarProps> = ({ title, subtitle }) => {
  const { activeRep, coRep, classProfile } = useAuth();
  const { isDark, toggleTheme } = useTheme();

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/95 backdrop-blur-md dark:border-slate-800 dark:bg-[#111B27]/95">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        {/* Left: Mobile Brand + Title / Desktop Page Title */}
        <div className="flex min-w-0 items-center gap-3">
          <Link
            to="/dashboard"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-[#0878D1] text-white shadow-sm lg:hidden"
            aria-label="Repz Home"
          >
            <GraduationCap className="h-5 w-5" />
          </Link>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="truncate font-display text-base font-bold tracking-tight text-slate-900 sm:text-lg dark:text-slate-100">
                {title}
              </h1>
              <span className="hidden rounded-full bg-[#EAF4FC] px-2 py-0.5 text-[11px] font-semibold text-[#005A9E] sm:inline-flex lg:hidden dark:bg-[#0878D1]/20 dark:text-[#7CC4FA]">
                {classProfile.classCode}
              </span>
            </div>
            <p className="truncate text-xs text-slate-500 dark:text-slate-400">
              <span className="lg:hidden">{classProfile.classCode} • </span>
              {subtitle}
            </p>
          </div>
        </div>

        {/* Right: WhatsApp-style clean icon actions & Co-Rep Sync Indicator */}
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          {/* Green strictly used as sync success indicator */}
          <div
            className="hidden items-center gap-1.5 rounded-full border border-emerald-200/80 bg-emerald-50/90 px-2.5 py-1 text-[11px] font-medium text-emerald-700 sm:inline-flex dark:border-emerald-800/50 dark:bg-emerald-950/60 dark:text-emerald-300"
            title={`Shared live with Co-Rep ${coRep.fullName}`}
          >
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>Co-Rep Synced</span>
          </div>

          <Link
            to="/reminders"
            className="relative flex h-9 w-9 items-center justify-center rounded-full text-slate-600 transition-colors hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-[#172434]"
            aria-label="Reminders"
            title="Reminders"
          >
            <Bell className="h-4.5 w-4.5" />
            <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-[#0878D1] ring-2 ring-white dark:ring-[#111B27]" />
          </Link>

          <button
            type="button"
            onClick={toggleTheme}
            className="flex h-9 w-9 items-center justify-center rounded-full text-slate-600 transition-colors hover:bg-slate-100 lg:hidden dark:text-slate-300 dark:hover:bg-[#172434] cursor-pointer"
            aria-label="Toggle theme"
            title={isDark ? 'Light theme' : 'Dark theme'}
          >
            {isDark ? <Sun className="h-4.5 w-4.5" /> : <Moon className="h-4.5 w-4.5" />}
          </button>

          <Link
            to="/settings"
            className="hidden h-9 w-9 items-center justify-center rounded-full text-slate-600 transition-colors hover:bg-slate-100 sm:flex lg:hidden dark:text-slate-300 dark:hover:bg-[#172434]"
            aria-label="Settings"
          >
            <Settings className="h-4.5 w-4.5" />
          </Link>

          <Link
            to="/settings"
            className="flex items-center gap-1.5 rounded-full border border-slate-200/80 bg-slate-50 py-1 pr-2.5 pl-1 transition-colors hover:border-[#0878D1]/30 dark:border-slate-700 dark:bg-[#0E1621]"
            title={`${activeRep.fullName} (${activeRep.slot})`}
          >
            <Avatar name={activeRep.fullName} size="xs" variant="primary" />
            <span className="hidden text-xs font-medium text-slate-700 md:inline dark:text-slate-200">
              {activeRep.fullName.split(' ')[0]}
            </span>
          </Link>
        </div>
      </div>
    </header>
  );
};
