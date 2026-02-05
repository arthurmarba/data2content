// src/app/discover/components/DiscoverFilters.tsx
'use client';

import React, { useMemo } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { formatCategories, proposalCategories, contextCategories } from '@/app/lib/classification';

type Cat = { id: string; label: string; subcategories?: Cat[] };

function flatten(cats: Cat[]): { id: string; label: string }[] {
  const out: { id: string; label: string }[] = [];
  const walk = (arr: Cat[], prefix = '') => {
    for (const c of arr) {
      const label = prefix ? `${prefix} › ${c.label}` : c.label;
      out.push({ id: c.id, label });
      if (c.subcategories && c.subcategories.length) walk(c.subcategories, label);
    }
  };
  walk(cats);
  return out;
}

export default function DiscoverFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const formats = useMemo(
    () =>
      flatten(
        (formatCategories as any).filter((cat: Cat) =>
          ['reel', 'photo', 'carousel', 'long_video'].includes(cat.id)
        )
      ),
    []
  );
  const proposals = useMemo(() => flatten(proposalCategories as any), []);
  const contexts = useMemo(() => flatten(contextCategories as any), []);

  const current = (k: string) => params.get(k) || '';

  const setParam = (key: string, value: string) => {
    const sp = new URLSearchParams(params.toString());
    if (!value) sp.delete(key); else sp.set(key, value);
    router.replace(`${pathname}?${sp.toString()}`);
  };

  const Select = ({ label, name, options }: { label: string; name: string; options: {id:string;label:string}[] }) => (
    <label className="text-sm text-gray-700">
      <span className="mr-2">{label}</span>
      <select
        className="border rounded-md px-2 py-1 text-sm"
        value={current(name)}
        onChange={(e) => setParam(name, e.target.value)}
      >
        <option value="">Todos</option>
        {options.map(o => (
          <option key={o.id} value={o.id}>{o.label}</option>
        ))}
      </select>
    </label>
  );

  return (
    <div className="mt-4 flex flex-wrap gap-3 items-center">
      <Select label="Formato" name="format" options={formats} />
      <Select label="Proposta" name="proposal" options={proposals} />
      <Select label="Contexto" name="context" options={contexts} />
      {(current('format') || current('proposal') || current('context')) && (
        <button
          type="button"
          className="text-sm text-gray-600 underline"
          onClick={() => router.replace(pathname)}
        >
          Limpar filtros
        </button>
      )}
    </div>
  );
}
