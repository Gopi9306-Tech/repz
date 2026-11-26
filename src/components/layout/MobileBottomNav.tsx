import React, { useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { ChevronRight, MoreHorizontal, Users2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { Modal } from '../ui/Modal';
import { NAV_ITEMS, PRIMARY_MOBILE_PATHS } from './navConfig';

export const MobileBottomNav: React.FC = () => {
  const [moreOpen, setMoreOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { activeRep, coRep, classProfile } = useAuth();

  const primaryItems = NAV_ITEMS.filter((item) => PRIMARY_MOBILE_PATHS.includes(item.path));
  const secondaryItems = NAV_ITEMS.filter((item) => !PRIMARY_MOBILE_PATHS.includes(item.path));
  const isMoreActive = secondaryItems.some((item) => location.pathname === item.path);

  return (
    <>
      <nav
        className="fixed right-0 bottom-0 left-0 z-30 border-t border-slate-200/80 bg-white/95 backdrop-blur-md lg:hidden dark:border-slate-800 dark:bg-[#111B27]/95"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        aria-label="Mobile Navigation"
      >
        <div className="mx-auto grid h-16 max-w-lg grid-cols-5 items-center px-1">
          {primaryItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className="flex flex-col items-center justify-center gap-0.5 py-1"
              >
                {({ isActive }) => (
                  <>
                    <span
                      className={`flex h-7 w-13 items-center justify-center rounded-full transition-all duration-150 ${
                        isActive
                          ? 'bg-[#EAF4FC] text-[#005A9E] dark:bg-[#0878D1]/25 dark:text-[#7CC4FA]'
                          : 'text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      <Icon className="h-4.5 w-4.5" strokeWidth={isActive ? 2.3 : 1.9} />
                    </span>
                    <span
                      className={`text-[11px] leading-tight ${
                        isActive
                          ? 'font-semibold text-[#005A9E] dark:text-[#7CC4FA]'
                          : 'font-medium text-slate-500 dark:text-slate-400'
                      }`}
                    >
                      {item.shortLabel}
                    </span>
                  </>
                )}
              </NavLink>
            );
          })}

          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            className="flex flex-col items-center justify-center gap-0.5 py-1 cursor-pointer"
          >
            <span
              className={`flex h-7 w-13 items-center justify-center rounded-full transition-all duration-150 ${
                isMoreActive
                  ? 'bg-[#EAF4FC] text-[#005A9E] dark:bg-[#0878D1]/25 dark:text-[#7CC4FA]'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              <MoreHorizontal className="h-4.5 w-4.5" strokeWidth={isMoreActive ? 2.3 : 1.9} />
            </span>
            <span
              className={`text-[11px] leading-tight ${
                isMoreActive
                  ? 'font-semibold text-[#005A9E] dark:text-[#7CC4FA]'
                  : 'font-medium text-slate-500 dark:text-slate-400'
              }`}
            >
              More
            </span>
          </button>
        </div>
      </nav>

      {/* WhatsApp-style Bottom Sheet for Timetable, Reminders & Settings */}
      <Modal
        open={moreOpen}
        onClose={() => setMoreOpen(false)}
        title="Class Tools"
        subtitle={`${classProfile.classCode} • ${classProfile.semester}`}
      >
        <div className="space-y-3">
          <div className="flex items-center gap-3 rounded-2xl border border-[#0878D1]/15 bg-[#EAF4FC]/70 p-3 dark:border-[#0878D1]/25 dark:bg-[#0878D1]/12">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#0878D1] text-white">
              <Users2 className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                {activeRep.fullName} &amp; {coRep.fullName}
              </p>
              <p className="text-[11px] text-slate-600 dark:text-slate-300">
                2 Representatives sharing {classProfile.classCode}
              </p>
            </div>
          </div>

          <div className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200/80 dark:divide-slate-800 dark:border-slate-800">
            {secondaryItems.map((item) => {
              const Icon = item.icon;
              const active = location.pathname === item.path;
              return (
                <button
                  key={item.path}
                  type="button"
                  onClick={() => {
                    setMoreOpen(false);
                    navigate(item.path);
                  }}
                  className={`flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left transition-colors cursor-pointer ${
                    active
                      ? 'bg-[#EAF4FC]/70 dark:bg-[#0878D1]/15'
                      : 'bg-white hover:bg-slate-50 dark:bg-[#111B27] dark:hover:bg-[#172434]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`flex h-9 w-9 items-center justify-center rounded-full ${
                        active
                          ? 'bg-[#0878D1] text-white'
                          : 'bg-[#EAF4FC] text-[#0878D1] dark:bg-[#0878D1]/20 dark:text-[#7CC4FA]'
                      }`}
                    >
                      <Icon className="h-4.5 w-4.5" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {item.label}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{item.subtitle}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {item.badge && (
                      <span className="rounded-full bg-[#0878D1] px-2 py-0.5 text-[11px] font-semibold text-white">
                        {item.badge}
                      </span>
                    )}
                    <ChevronRight className="h-4 w-4 text-slate-400" />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </Modal>
    </>
  );
};
