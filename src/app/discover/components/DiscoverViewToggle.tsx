"use client";

import React from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

export default function DiscoverViewToggle() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const view = (params.get('view') || '').toLowerCase();

  const setView = (v: 'grid'|'carousel') => {
    const sp = new URLSearchParams(params.toString());
    if (v) sp.set('view', v); else sp.delete('view');
    router.replace(`${pathname}?${sp.toString()}`);
  };

  const isGrid = view === 'grid' || view === '';

  return (
    <div className="mt-3 flex items-center gap-2">
      <span className="text-xs text-gray-500">Visualização:</span>
      <div className="inline-flex rounded-md border border-gray-300 overflow-hidden">
        <button
          className={`px-3 py-1.5 text-sm ${isGrid ? 'bg-gray-900 text-white' : 'bg-white text-gray-800 hover:bg-gray-50'}`}
          onClick={() => setView('grid')}
          aria-pressed={isGrid}
        >Grid</button>
        <button
          className={`px-3 py-1.5 text-sm ${!isGrid ? 'bg-gray-900 text-white' : 'bg-white text-gray-800 hover:bg-gray-50'}`}
          onClick={() => setView('carousel')}
          aria-pressed={!isGrid}
        >Carrossel</button>
      </div>
    </div>
  );
}

