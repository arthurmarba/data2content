"use client";

import React, { useEffect, useId, useMemo } from 'react';

export interface TabItem {
  key: string;
  label: string;
}

interface TabsProps {
  items: TabItem[];
  value: string;
  onChange: (key: string) => void;
  className?: string;
}

export default function Tabs({ items, value, onChange, className = '' }: TabsProps) {
  const baseId = useId();
  const activeIndex = useMemo(() => Math.max(0, items.findIndex(i => i.key === value)), [items, value]);

  useEffect(() => {
    if (activeIndex < 0 && items[0]) onChange(items[0].key);
  }, [activeIndex, items, onChange]);

  return (
    <div className={className}>
      <div role="tablist" aria-label="Seções do relatório" className="flex flex-wrap gap-2">
        {items.map((t, idx) => {
          const selected = t.key === value;
          return (
            <button
              key={t.key}
              id={`${baseId}-tab-${t.key}`}
              role="tab"
              aria-selected={selected}
              aria-controls={`${baseId}-panel-${t.key}`}
              className={`px-3 py-1.5 rounded text-sm focus:outline-none focus:ring-2 focus:ring-offset-2 ${selected ? 'bg-black text-white' : 'border'}`}
              onClick={() => onChange(t.key)}
            >
              {t.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

