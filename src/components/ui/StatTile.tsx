import React from 'react';

interface StatTileProps {
  label: string;
  value: string | number;
  helper?: string;
  icon: React.ReactNode;
  tone?: 'primary' | 'absent' | 'neutral';
}

export const StatTile: React.FC<StatTileProps> = ({
  label,
  value,
  helper,
  icon,
  tone = 'primary',
}) => {
  const iconTone =
    tone === 'absent'
      ? 'bg-red-50 text-red-600 dark:bg-red-950/60 dark:text-red-400'
      : tone === 'neutral'
        ? 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
        : 'bg-[#EAF4FC] text-[#0878D1] dark:bg-[#0878D1]/20 dark:text-[#66B8FA]';

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-colors dark:border-slate-800 dark:bg-[#111B27]">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</p>
          <p className="mt-1.5 font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            {value}
          </p>
          {helper && (
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{helper}</p>
          )}
        </div>
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${iconTone}`}>
          {icon}
        </div>
      </div>
    </div>
  );
};
