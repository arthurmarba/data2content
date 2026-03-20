// src/app/discover/components/DiscoverFilters.tsx
'use client';

import React, { useMemo } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { getFlatFilterableCategories } from '@/app/lib/classification';
import {
  contentIntentCategories,
  contentSignalCategories,
  narrativeFormCategories,
} from '@/app/lib/classificationV2';
import {
  commercialModeCategories,
  proofStyleCategories,
  stanceCategories,
} from '@/app/lib/classificationV2_5';
import {
  buildDiscoverSelectedFromParams,
  canonicalizeDiscoverFilterValues,
  type DiscoverFilterCategoryId,
} from './discoverFilterState';

const toOptions = (type: "format" | "context" | "reference") =>
  getFlatFilterableCategories(type).map((category) => ({
    id: category.id,
    label:
      category.parentLabels.length > 0
        ? `${category.parentLabels.join(" › ")} › ${category.label}`
        : category.label,
  }));

export default function DiscoverFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const formats = useMemo(
    () =>
      toOptions("format").filter((cat) =>
        ['reel', 'photo', 'carousel', 'long_video'].includes(cat.id)
      ),
    []
  );
  const contentIntents = useMemo(
    () => contentIntentCategories.map((category) => ({ id: category.id, label: category.label })),
    []
  );
  const contexts = useMemo(() => toOptions("context"), []);
  const narrativeForms = useMemo(
    () => narrativeFormCategories.map((category) => ({ id: category.id, label: category.label })),
    []
  );
  const contentSignals = useMemo(
    () => contentSignalCategories.map((category) => ({ id: category.id, label: category.label })),
    []
  );
  const stances = useMemo(
    () => stanceCategories.map((category) => ({ id: category.id, label: category.label })),
    []
  );
  const proofStyles = useMemo(
    () => proofStyleCategories.map((category) => ({ id: category.id, label: category.label })),
    []
  );
  const commercialModes = useMemo(
    () => commercialModeCategories.map((category) => ({ id: category.id, label: category.label })),
    []
  );
  const references = useMemo(() => toOptions("reference"), []);
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
      <Select label="Intenção" name="contentIntent" options={contentIntents} />
      <Select label="Contexto" name="context" options={contexts} />
      <Select label="Narrativa" name="narrativeForm" options={narrativeForms} />
      <Select label="Sinais" name="contentSignals" options={contentSignals} />
      <Select label="Postura" name="stance" options={stances} />
      <Select label="Prova" name="proofStyle" options={proofStyles} />
      <Select label="Comercial" name="commercialMode" options={commercialModes} />
      <Select label="Referências" name="references" options={references} />
      {(current('format') || current('contentIntent') || current('context') || current('narrativeForm') || current('contentSignals') || current('stance') || current('proofStyle') || current('commercialMode') || current('references')) && (
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
