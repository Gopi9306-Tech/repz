import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { DesktopSidebar } from './DesktopSidebar';
import { MobileBottomNav } from './MobileBottomNav';
import { NAV_ITEMS } from './navConfig';
import { TopAppBar } from './TopAppBar';

export const AppShell: React.FC = () => {
  const location = useLocation();
  const currentNav =
    NAV_ITEMS.find((item) => location.pathname.startsWith(item.path)) ?? NAV_ITEMS[0];

  return (
    <div className="flex min-h-screen bg-[#F3F6FA] text-slate-900 dark:bg-[#0B111A] dark:text-slate-100">
      <DesktopSidebar />

      <div className="flex min-w-0 flex-1 flex-col">
        <TopAppBar title={currentNav.title} subtitle={currentNav.subtitle} />

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-4 pb-24 sm:px-6 sm:pt-6 lg:pb-8">
          <div key={location.pathname} className="animate-page-in">
            <Outlet />
          </div>
        </main>
      </div>

      <MobileBottomNav />
    </div>
  );
};
