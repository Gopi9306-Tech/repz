import React from 'react';
import { CheckCircle2, Info, X } from 'lucide-react';

interface ToastProps {
  message: string | null;
  type?: 'success' | 'info';
  onDismiss: () => void;
}

export const Toast: React.FC<ToastProps> = ({ message, type = 'success', onDismiss }) => {
  if (!message) return null;

  return (
    <div className="pointer-events-none fixed right-4 bottom-22 left-4 z-50 flex justify-center sm:right-6 sm:bottom-6 sm:left-auto">
      <div
        className={`animate-sheet-up pointer-events-auto flex max-w-md items-center gap-2.5 rounded-2xl border px-4 py-3 shadow-lg ${
          type === 'success'
            ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800/60 dark:bg-emerald-950/95 dark:text-emerald-200'
            : 'border-[#0878D1]/25 bg-white text-slate-800 dark:border-slate-700 dark:bg-[#172434] dark:text-slate-100'
        }`}
      >
        {type === 'success' ? (
          <CheckCircle2 className="h-4.5 w-4.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
        ) : (
          <Info className="h-4.5 w-4.5 shrink-0 text-[#0878D1]" />
        )}
        <p className="text-xs font-medium sm:text-sm">{message}</p>
        <button
          type="button"
          onClick={onDismiss}
          className="ml-1 rounded-full p-1 opacity-70 hover:opacity-100 cursor-pointer"
          aria-label="Dismiss notification"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
};
