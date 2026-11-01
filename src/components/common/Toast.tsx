import React from 'react';
import { ToastMessage } from '../../types';
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from 'lucide-react';

interface ToastContainerProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onDismiss }) => {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 w-full max-w-[420px] px-3 pointer-events-none">
      {toasts.map((toast) => {
        const isSuccess = toast.type === 'success';
        const isError = toast.type === 'error';
        const isWarning = toast.type === 'warning';

        return (
          <div
            key={toast.id}
            role="status"
            className={`pointer-events-auto flex items-start justify-between gap-3 p-3.5 rounded-xl text-xs font-medium backdrop-blur-xl shadow-2xl transition-all duration-200 border ${
              isSuccess
                ? 'bg-[#0b1b1f]/95 text-cyan-200 border-cyan-500/40 shadow-cyan-950/40'
                : isError
                ? 'bg-[#220d12]/95 text-rose-200 border-rose-500/40 shadow-rose-950/40'
                : isWarning
                ? 'bg-[#221808]/95 text-amber-200 border-amber-500/40 shadow-amber-950/40'
                : 'bg-[#0f172a]/95 text-slate-200 border-slate-700/60 shadow-slate-950/40'
            }`}
          >
            <div className="flex items-start gap-2.5 flex-1 min-w-0">
              {isSuccess && <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />}
              {isError && <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />}
              {isWarning && <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />}
              {!isSuccess && !isError && !isWarning && <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />}
              <div className="flex-1 min-w-0">
                <p className="whitespace-pre-line break-words text-xs leading-relaxed font-sans select-text">
                  {toast.text}
                </p>
              </div>
            </div>
            <button
              onClick={() => onDismiss(toast.id)}
              className="p-1 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors shrink-0 mt-0.5"
              aria-label="Đóng thông báo"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
