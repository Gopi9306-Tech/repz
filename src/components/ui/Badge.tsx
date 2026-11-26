import React from 'react';

type BadgeVariant = 'primary' | 'present' | 'absent' | 'success' | 'neutral' | 'warning';

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  dot?: boolean;
  className?: string;
}

const VARIANT_STYLES: Record<BadgeVariant, string> = {
  primary:
    'bg-[#EAF4FC] text-[#005A9E] border-[#0878D1]/15 dark:bg-[#0878D1]/20 dark:text-[#7CC4FA] dark:border-[#0878D1]/30',
  present:
    'bg-[#EAF4FC] text-[#0878D1] border-[#0878D1]/20 dark:bg-[#0878D1]/20 dark:text-[#66B8FA] dark:border-[#0878D1]/35',
  absent:
    'bg-red-50 text-red-700 border-red-200/80 dark:bg-red-950/60 dark:text-red-300 dark:border-red-800/50',
  // Green strictly reserved for success indicators
  success:
    'bg-emerald-50 text-emerald-700 border-emerald-200/80 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800/50',
  warning:
    'bg-amber-50 text-amber-800 border-amber-200/80 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800/50',
  neutral:
    'bg-slate-100 text-slate-600 border-slate-200/80 dark:bg-slate-800/80 dark:text-slate-300 dark:border-slate-700',
};

const DOT_STYLES: Record<BadgeVariant, string> = {
  primary: 'bg-[#0878D1]',
  present: 'bg-[#0878D1]',
  absent: 'bg-red-600 dark:bg-red-400',
  success: 'bg-emerald-600 dark:bg-emerald-400',
  warning: 'bg-amber-600 dark:bg-amber-400',
  neutral: 'bg-slate-500',
};

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'neutral',
  dot = false,
  className = '',
}) => {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap transition-colors ${VARIANT_STYLES[variant]} ${className}`}
    >
      {dot && <span className={`h-1.5 w-1.5 rounded-full ${DOT_STYLES[variant]}`} />}
      {children}
    </span>
  );
};
