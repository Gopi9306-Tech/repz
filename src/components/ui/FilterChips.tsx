import React from 'react';

export interface FilterChipOption {
  id: string;
  label: string;
  count?: number;
}

interface FilterChipsProps {
  options: FilterChipOption[];
  selectedId: string;
  onSelect: (id: string) => void;
  className?: string;
}

export const FilterChips: React.FC<FilterChipsProps> = ({
  options,
  selectedId,
  onSelect,
  className = '',
}) => {
  return (
    <div className={`no-scrollbar flex items-center gap-2 overflow-x-auto py-0.5 ${className}`}>
      {options.map((option) => {
        const active = option.id === selectedId;
        return (
          <button
            key={option.id}
            type="button"
            onClick={() => onSelect(option.id)}
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium transition-all duration-150 active:scale-[0.97] cursor-pointer ${
              active
                ? 'bg-[#EAF4FC] text-[#005A9E] ring-1 ring-[#0878D1]/25 dark:bg-[#0878D1]/25 dark:text-[#7CC4FA] dark:ring-[#0878D1]/40'
                : 'bg-white text-slate-600 border border-slate-200/80 hover:bg-slate-50 dark:bg-[#111B27] dark:text-slate-300 dark:border-slate-800 dark:hover:bg-[#172434]'
            }`}
          >
            <span>{option.label}</span>
            {option.count !== undefined && (
              <span
                className={`rounded-full px-1.5 py-0.2 text-[11px] font-semibold ${
                  active
                    ? 'bg-[#0878D1]/12 text-[#005A9E] dark:bg-[#0878D1]/30 dark:text-[#9FD4FC]'
                    : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                }`}
              >
                {option.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};
