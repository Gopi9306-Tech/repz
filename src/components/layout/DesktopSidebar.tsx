import React from 'react';
import { NavLink } from 'react-router-dom';
import { GraduationCap, Moon, Sun, Users2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { Avatar } from '../ui/Avatar';
import { NAV_ITEMS } from './navConfig';

export const DesktopSidebar: React.FC = () => {
  const { activeRep, coRep, classProfile } = useAuth();
  const { isDark, toggleTheme } = useTheme();

  return (
    <aside className="hidden lg:flex lg:w-72 lg:shrink-0 lg:flex-col border-r border-slate-200/80 bg-white dark:border-slate-800 dark:bg-[#111B27]">
      {/* Brand */}
      <div className="flex h-16 items-center gap-3 border-b border-slate-100 px-5 dark:border-slate-800">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#0878D1] text-white shadow-sm shadow-[#0878D1]/25">
          <GraduationCap className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-display text-lg font-extrabold tracking-tight text-slate-900 dark:text-white">
              Repz
            </span>
            <span className="rounded-full bg-[#EAF4FC] px-2 py-0.5 text-[10px] font-semibold tracking-wide text-[#005A9E] uppercase dark:bg-[#0878D1]/20 dark:text-[#7CC4FA]">
              Rep Only
            </span>
          </div>
          <p className="truncate text-xs text-slate-500 dark:text-slate-400">
            Class Attendance Desk
          </p>
        </div>
      </div>

      {/* Assigned Class & Co-Rep Banner */}
      <div className="px-4 pt-4 pb-2">
        <div className="rounded-2xl border border-[#0878D1]/15 bg-[#EAF4FC]/70 p-3.5 dark:border-[#0878D1]/25 dark:bg-[#0878D1]/12">
          <div className="flex items-center justify-between gap-2">
            <span className="font-display text-sm font-bold text-[#005A9E] dark:text-[#7CC4FA]">
              {classProfile.classCode}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-white/90 px-2 py-0.5 text-[11px] font-medium text-slate-700 dark:bg-[#111B27] dark:text-slate-300">
              <Users2 className="h-3 w-3 text-[#0878D1]" />2 Reps
            </span>
          </div>
          <p className="mt-0.5 truncate text-xs text-slate-600 dark:text-slate-300">
            {classProfile.semester} • {classProfile.section}
          </p>
          <div className="mt-2.5 flex items-center gap-2 border-t border-[#0878D1]/10 pt-2 text-[11px] text-slate-600 dark:border-[#0878D1]/20 dark:text-slate-300">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            <span className="truncate">
              Shared with <strong className="font-semibold">{coRep.fullName}</strong>
            </span>
          </div>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-2" aria-label="Primary Navigation">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `group flex items-center justify-between rounded-full px-3.5 py-2.5 text-sm font-medium transition-all duration-150 ${
                  isActive
                    ? 'bg-[#EAF4FC] text-[#005A9E] font-semibold dark:bg-[#0878D1]/20 dark:text-[#7CC4FA]'
                    : 'text-slate-600 hover:bg-slate-100/80 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-[#172434] dark:hover:text-white'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span className="flex items-center gap-3 min-w-0">
                    <Icon
                      className={`h-4.5 w-4.5 shrink-0 transition-colors ${
                        isActive
                          ? 'text-[#0878D1] dark:text-[#66B8FA]'
                          : 'text-slate-400 group-hover:text-slate-700 dark:text-slate-400 dark:group-hover:text-slate-200'
                      }`}
                    />
                    <span className="truncate">{item.label}</span>
                  </span>
                  {item.badge && (
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        isActive
                          ? 'bg-[#0878D1] text-white'
                          : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* Active Rep Footer */}
      <div className="border-t border-slate-100 p-3.5 dark:border-slate-800">
        <div className="flex items-center justify-between gap-2 rounded-2xl bg-slate-50/90 p-2.5 dark:bg-[#0E1621]">
          <div className="flex min-w-0 items-center gap-2.5">
            <Avatar name={activeRep.fullName} size="sm" variant="primary" online />
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-slate-900 dark:text-slate-100">
                {activeRep.fullName}
              </p>
              <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                {activeRep.slot} • {activeRep.rollNumber}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={toggleTheme}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-white hover:text-[#0878D1] dark:text-slate-400 dark:hover:bg-[#172434] dark:hover:text-[#7CC4FA] cursor-pointer"
            title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
            aria-label="Toggle theme"
          >
            {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </aside>
  );
};
