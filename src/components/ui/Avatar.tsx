import React from 'react';

interface AvatarProps {
  name: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'primary' | 'tint' | 'neutral' | 'absent';
  online?: boolean;
  className?: string;
}

const SIZE_MAP = {
  xs: 'h-7 w-7 text-[11px]',
  sm: 'h-9 w-9 text-xs',
  md: 'h-11 w-11 text-sm',
  lg: 'h-12 w-12 text-base',
  xl: 'h-16 w-16 text-lg',
};

const VARIANT_MAP = {
  primary: 'bg-[#0878D1] text-white',
  tint: 'bg-[#EAF4FC] text-[#005A9E] dark:bg-[#0878D1]/20 dark:text-[#60B4F7]',
  neutral: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200',
  absent: 'bg-red-50 text-red-700 dark:bg-red-950/60 dark:text-red-300',
};

export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export const Avatar: React.FC<AvatarProps> = ({
  name,
  size = 'md',
  variant = 'tint',
  online = false,
  className = '',
}) => {
  return (
    <div className={`relative inline-flex shrink-0 ${className}`}>
      <div
        className={`flex items-center justify-center rounded-full font-semibold tracking-tight select-none transition-colors ${SIZE_MAP[size]} ${VARIANT_MAP[variant]}`}
        aria-label={name}
      >
        {getInitials(name)}
      </div>
      {online && (
        <span
          className="absolute right-0 bottom-0 h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-[#111B27]"
          title="Online"
        />
      )}
    </div>
  );
};
