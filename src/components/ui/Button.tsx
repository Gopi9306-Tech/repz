import React from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    'bg-[#0878D1] text-white hover:bg-[#005A9E] active:bg-[#004A82] shadow-sm shadow-[#0878D1]/20',
  secondary:
    'bg-[#EAF4FC] text-[#005A9E] hover:bg-[#DCEDFB] dark:bg-[#0878D1]/20 dark:text-[#7CC4FA] dark:hover:bg-[#0878D1]/30',
  outline:
    'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-[#111B27] dark:text-slate-200 dark:hover:bg-[#172434]',
  ghost:
    'bg-transparent text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800/70',
  danger:
    'bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 dark:bg-red-950/60 dark:text-red-300 dark:border-red-800/60 dark:hover:bg-red-900/50',
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'h-9 px-3.5 text-xs gap-1.5',
  md: 'h-10 px-4.5 text-sm gap-2',
  lg: 'h-11 px-5 text-sm gap-2',
};

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  leftIcon,
  rightIcon,
  className = '',
  children,
  ...rest
}) => {
  return (
    <button
      className={`inline-flex items-center justify-center rounded-full font-medium transition-all duration-150 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 cursor-pointer ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${fullWidth ? 'w-full' : ''} ${className}`}
      {...rest}
    >
      {leftIcon && <span className="shrink-0">{leftIcon}</span>}
      <span>{children}</span>
      {rightIcon && <span className="shrink-0">{rightIcon}</span>}
    </button>
  );
};
