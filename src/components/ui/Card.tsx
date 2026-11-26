import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  interactive?: boolean;
  onClick?: () => void;
}

const PADDING_CLASSES = {
  none: '',
  sm: 'p-3.5',
  md: 'p-4 sm:p-5',
  lg: 'p-5 sm:p-6',
};

export const Card: React.FC<CardProps> = ({
  children,
  className = '',
  padding = 'md',
  interactive = false,
  onClick,
}) => {
  const Component = onClick ? 'button' : 'div';
  return (
    <Component
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] dark:border-slate-800 dark:bg-[#111B27] ${PADDING_CLASSES[padding]} ${
        interactive || onClick
          ? 'w-full text-left transition-all duration-150 hover:border-[#0878D1]/35 hover:shadow-sm active:scale-[0.99] cursor-pointer'
          : ''
      } ${className}`}
    >
      {children}
    </Component>
  );
};
