"use client";

import React, { useEffect, useRef, useState } from 'react';
import { track } from '@/lib/track';

export interface CardActionsMenuProps {
  postId: string;
  postLink?: string;
  creatorName?: string;
  onHide?: () => void; // esconde localmente
}

export default function CardActionsMenu({ postId, postLink, creatorName, onHide }: CardActionsMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const act = (name: string, fn?: () => void) => () => {
    try { track(name, { postId, creatorName }); } catch {}
    fn?.();
    setOpen(false);
  };

  const copy = async () => {
    try {
      if (postLink) await navigator.clipboard.writeText(postLink);
    } catch {}
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-label="Mais opções"
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(v => !v); try { track('discover_card_menu_open', { postId }); } catch {} }}
        className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-black/50 text-white hover:bg-black/70"
      >
        <span className="leading-none">⋮</span>
      </button>
      {open && (
        <div className="absolute right-0 mt-1 w-48 rounded-md border border-gray-200 bg-white shadow-lg z-10">
          <button className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50" onClick={act('discover_save_click')}>Salvar no Planner</button>
          <button className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50" onClick={act('discover_not_interested', onHide)}>Não relevante</button>
          <button className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50" onClick={act('discover_less_from_creator', onHide)}>Ver menos deste criador</button>
          <button className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50" onClick={act('discover_copy_link', copy)}>Copiar link</button>
          <button className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50" onClick={act('discover_report')}>Reportar</button>
        </div>
      )}
    </div>
  );
}

