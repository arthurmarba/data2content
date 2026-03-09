"use client";

import React, { useEffect } from 'react';

interface DrawerProps {
  open: boolean;
  title?: string;
  onClose: () => void;
  children?: React.ReactNode;
}

export default function Drawer({ open, title, onClose, children }: DrawerProps) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    if (open) document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open || typeof document === 'undefined') return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <aside className="absolute inset-x-0 bottom-0 max-h-[88dvh] w-full overflow-hidden rounded-t-[1.75rem] border border-gray-200 bg-white shadow-2xl sm:inset-y-0 sm:right-0 sm:left-auto sm:max-h-none sm:w-[480px] sm:rounded-none sm:border-y-0 sm:border-r-0 sm:border-l">
        <div className="max-h-[88dvh] overflow-y-auto px-4 pb-[calc(env(safe-area-inset-bottom,0px)+1rem)] pt-3 sm:h-full sm:max-h-none sm:px-5 sm:pt-5 sm:pb-5">
          <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-slate-200 sm:hidden" aria-hidden />
          <div className="sticky top-0 z-10 -mx-4 mb-4 flex items-center justify-between border-b border-slate-100 bg-white/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:mb-4 sm:border-b-0 sm:bg-transparent sm:px-0 sm:py-0">
            <h2 className="pr-4 text-base font-semibold text-gray-900">{title || 'Detalhes'}</h2>
            <button className="rounded-lg border px-3 py-1.5 text-sm text-gray-700 transition hover:bg-slate-50" onClick={onClose}>Fechar</button>
          </div>
          <div>{children}</div>
        </div>
      </aside>
    </div>
  );
}
