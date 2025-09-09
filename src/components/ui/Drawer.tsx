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

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <aside className="absolute right-0 top-0 h-full w-full sm:w-[480px] bg-white shadow-2xl border-l border-gray-200 p-5 overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900">{title || 'Detalhes'}</h2>
          <button className="text-sm text-gray-700 border rounded px-2 py-1" onClick={onClose}>Fechar</button>
        </div>
        <div>{children}</div>
      </aside>
    </div>
  );
}

