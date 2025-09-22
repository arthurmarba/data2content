"use client";

import React, { useMemo } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

type Chip = { label: string; tab: string; gated?: boolean };
type ViewChip = { label: string; view: string; requiresReel?: boolean };

export default function DiscoverChips({ allowedPersonalized }: { allowedPersonalized?: boolean }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const chips = useMemo<Chip[]>(() => {
    const base: Chip[] = [
      { label: 'Virais', tab: 'trending' },
      { label: 'Novos', tab: 'community_new' },
      { label: 'Horários', tab: 'best_times_hot' },
      { label: 'Collabs', tab: 'collabs' },
    ];
    if (allowedPersonalized) base.splice(1, 0, { label: 'Para você', tab: 'for_you', gated: true });
    return base;
  }, [allowedPersonalized]);

  const current = params.get('tab') || 'trending';
  const currentView = params.get('view') || '';
  const hasActiveView = !!currentView;

  const onClick = (chip: Chip) => {
    const sp = new URLSearchParams(params.toString());
    sp.set('tab', chip.tab);
    // Remove filtros antigos se existirem
    sp.delete('format'); sp.delete('proposal'); sp.delete('context'); sp.delete('tone'); sp.delete('references'); sp.delete('view');
    router.replace(`${pathname}?${sp.toString()}`);
  };

  // Chips de filtros adicionais (client-side em DiscoverGrid)
  const viewChips = useMemo<ViewChip[]>(() => ([
    { label: 'Reels até 15s', view: 'reels_lt_15', requiresReel: true },
    { label: 'Reels 15–45s', view: 'reels_15_45', requiresReel: true },
    { label: 'Reels longos', view: 'reels_gt_45', requiresReel: true },
    { label: 'Virais no fim de semana', view: 'viral_weekend' },
    { label: 'Virais pela manhã', view: 'viral_morning' },
    { label: 'Virais à noite', view: 'viral_night' },
    { label: 'Campeões em comentários', view: 'top_comments' },
    { label: 'Campeões em salvamentos', view: 'top_saves' },
    { label: 'Campeões em compartilhamentos', view: 'top_shares' },
  ]), []);

  const onClickView = (chip: ViewChip) => {
    const sp = new URLSearchParams(params.toString());
    if (currentView === chip.view) {
      // toggle off
      sp.delete('view');
    } else {
      sp.set('view', chip.view);
    }
    router.replace(`${pathname}?${sp.toString()}`);
  };

  return (
    <div className="mt-2" aria-label="Seções e filtros do Discover">
      <div className="-mx-1 overflow-x-auto hide-scrollbar">
        <div className="flex flex-nowrap gap-2 px-1 py-1 items-center">
          {chips.map((chip) => {
            const active = current === chip.tab;
            return (
              <button
                key={chip.tab}
                onClick={() => onClick(chip)}
                className={`px-3 py-1.5 rounded-full border text-sm whitespace-nowrap ${
                  active ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-800 border-gray-300 hover:bg-gray-50'
                }`}
                aria-pressed={active}
              >
                {chip.label}
              </button>
            );
          })}

          {/* Separador sutil entre abas e filtros */}
          <span aria-hidden className="inline-block w-px h-5 bg-gray-200" />

          {hasActiveView && (
            <button
              onClick={() => {
                const sp = new URLSearchParams(params.toString());
                sp.delete('view');
                router.replace(`${pathname}?${sp.toString()}`);
              }}
              className="px-3 py-1.5 rounded-full border text-sm whitespace-nowrap bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
              aria-label="Limpar filtro"
            >
              Limpar filtros
            </button>
          )}

          {viewChips.map((chip) => {
            const active = currentView === chip.view;
            return (
              <button
                key={chip.view}
                onClick={() => onClickView(chip)}
                className={`px-3 py-1.5 rounded-full border text-sm whitespace-nowrap ${
                  active ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-800 border-gray-300 hover:bg-gray-50'
                }`}
                aria-pressed={active}
              >
                {chip.label}
              </button>
            );
          })}
        </div>
      </div>
      <style jsx global>{`
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}
