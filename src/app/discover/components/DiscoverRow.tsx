// src/app/discover/components/DiscoverRow.tsx
"use client";

import React, { useMemo, useRef, useState } from 'react';
import { FaChevronLeft, FaChevronRight } from 'react-icons/fa';
import { useEffect } from 'react';
import { track } from '@/lib/track';

type PostCard = {
  id: string;
  coverUrl?: string | null;
  caption?: string;
  postDate?: string;
  creatorName?: string;
  postLink?: string;
  stats?: {
    total_interactions?: number;
    likes?: number;
    comments?: number;
    shares?: number;
    views?: number;
  };
  categories?: {
    format?: string[];
    proposal?: string[];
    context?: string[];
    tone?: string[];
    references?: string[];
  };
};

interface Props {
  items: PostCard[];
}

export default function DiscoverRow({ items }: Props) {
  const list = Array.isArray(items) ? items : [];
  const ref = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const scrollAmount = useMemo(() => 320, []);

  const scroll = (dir: 'left' | 'right') => {
    if (!ref.current) return;
    ref.current.scrollBy({ left: dir === 'right' ? scrollAmount : -scrollAmount, behavior: 'smooth' });
  };

  useEffect(() => {
    try { track('discover_row_impression', { count: list.length }); } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="relative" aria-live="polite">
      <div
        ref={ref}
        className="overflow-x-auto hide-scrollbar"
        onScroll={(e) => {
          const el = e.currentTarget;
          const idx = Math.round(el.scrollLeft / scrollAmount);
          setActiveIndex(Math.max(0, Math.min(idx, list.length - 1)));
        }}
      >
        <div className="flex gap-4 pr-2">
          {list.length === 0 ? (
            <div className="w-full py-8 text-center text-sm text-gray-500 border border-dashed border-gray-200 rounded-lg">
              Nada encontrado para esta seção.
            </div>
          ) : (
            list.map((it) => (
              <DiscoverCard key={it.id} item={it} />
            ))
          )}
        </div>
      </div>

      {list.length > 0 && (
        <div className="absolute top-1/2 -translate-y-1/2 w-full flex justify-between px-2 pointer-events-none">
          <button
            type="button"
            onClick={() => scroll('left')}
            className="pointer-events-auto w-9 h-9 rounded-full bg-white/80 hover:bg-white shadow flex items-center justify-center text-gray-700"
            aria-label="Anterior"
          >
            <FaChevronLeft />
          </button>
          <button
            type="button"
            onClick={() => scroll('right')}
            className="pointer-events-auto w-9 h-9 rounded-full bg-white/80 hover:bg-white shadow flex items-center justify-center text-gray-700"
            aria-label="Próximo"
          >
            <FaChevronRight />
          </button>
        </div>
      )}

      <p className="sr-only">Card {activeIndex + 1} de {Math.max(1, list.length)}</p>

      <style jsx global>{`
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}

const DiscoverCard = React.lazy(() => import('./DiscoverCard'));
