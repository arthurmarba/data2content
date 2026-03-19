// src/app/discover/components/DiscoverFilters.tsx
'use client';

import React, { useMemo } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { formatCategories, proposalCategories, contextCategories, toneCategories, referenceCategories } from '@/app/lib/classification';
import {
  buildDiscoverSelectedFromParams,
  canonicalizeDiscoverFilterValues,
  type DiscoverFilterCategoryId,
} from './discoverFilterState';

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
  const tones = useMemo(() => flatten(toneCategories as any), []);
  const references = useMemo(() => flatten(referenceCategories as any), []);
  const currentState = useMemo(() => buildDiscoverSelectedFromParams(params), [params]);

  const current = (k: DiscoverFilterCategoryId) => currentState[k]?.[0] || '';

  const setParam = (key: DiscoverFilterCategoryId, value: string) => {
    const sp = new URLSearchParams(params.toString());
    const normalized = canonicalizeDiscoverFilterValues(key, value ? [value] : []);
    const normalizedValue = normalized[0];
    if (!normalizedValue) sp.delete(key);
    else sp.set(key, normalizedValue);
    router.replace(`${pathname}?${sp.toString()}`);
  };

  const Select = ({ label, name, options }: { label: string; name: DiscoverFilterCategoryId; options: {id:string;label:string}[] }) => (
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
      <Select label="Tom" name="tone" options={tones} />
      <Select label="Referências" name="references" options={references} />
      {(current('format') || current('proposal') || current('context') || current('tone') || current('references')) && (
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
