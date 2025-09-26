"use client";

import React, { useMemo, useState, useCallback } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { formatCategories, proposalCategories, contextCategories, toneCategories, referenceCategories, Category, getCategoryById } from '@/app/lib/classification';

function flatten(cats: Category[]): { id: string; label: string }[] {
  const out: { id: string; label: string }[] = [];
  const walk = (arr: Category[]) => {
    for (const c of arr) {
      // Exibe apenas o rótulo da própria categoria, sem prefixos de pai (ex.: "Cultura Pop › Livros" -> "Livros")
      out.push({ id: c.id, label: c.label });
      if (c.subcategories && c.subcategories.length) walk(c.subcategories);
    }
  };
  walk(cats);
  return out;
}

export default function DiscoverChips() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const formats = useMemo(() => flatten(formatCategories as any), []);
  const proposals = useMemo(() => flatten(proposalCategories as any), []);
  const contexts = useMemo(() => flatten(contextCategories as any), []);
  const tones = useMemo(() => flatten(toneCategories as any), []);
  const references = useMemo(() => flatten(referenceCategories as any), []);

  const getSelected = (key: string) => (params.get(key)?.split(',').map(s => s.trim()).filter(Boolean)) || [];
  const selected = {
    format: getSelected('format'),
    proposal: getSelected('proposal'),
    context: getSelected('context'),
    tone: getSelected('tone'),
    references: getSelected('references'),
  };

  // Tabs (guias) por categoria
  const TABS: Array<{ key: keyof typeof selected; label: string }> = [
    { key: 'format', label: 'Formato' },
    { key: 'proposal', label: 'Proposta' },
    { key: 'context', label: 'Contexto' },
    { key: 'tone', label: 'Tom' },
    { key: 'references', label: 'Referências' },
  ];
  const tabParam = (params.get('tab') || '').toLowerCase();
  const defaultTab: keyof typeof selected = 'format';
  const isValidTab = TABS.some(t => t.key === (tabParam as any));
  const activeTab: keyof typeof selected = isValidTab ? (tabParam as keyof typeof selected) : defaultTab;

  const setActiveTab = useCallback((key: keyof typeof selected) => {
    const sp = new URLSearchParams(params.toString());
    sp.set('tab', key);
    router.replace(`${pathname}?${sp.toString()}`);
  }, [params, pathname, router]);

  const updateParamList = (key: keyof typeof selected, id: string, on?: boolean) => {
    const list = new Set(selected[key]);
    if (on === undefined) {
      if (list.has(id)) list.delete(id); else list.add(id);
    } else {
      if (on) list.add(id); else list.delete(id);
    }
    const sp = new URLSearchParams(params.toString());
    const value = Array.from(list).join(',');
    if (value) sp.set(key, value); else sp.delete(key);
    router.replace(`${pathname}?${sp.toString()}`);
  };

  const clearAll = () => {
    const sp = new URLSearchParams(params.toString());
    ['format','proposal','context','tone','references','exp','view','tab'].forEach(k => sp.delete(k));
    router.replace(`${pathname}?${sp.toString()}`);
  };

  const SelectedRow = () => {
    const items: Array<{ key: keyof typeof selected; id: string; label: string }> = [];
    (Object.keys(selected) as (keyof typeof selected)[]).forEach((k) => {
      selected[k].forEach((id) => {
        const typeMap: any = { format: 'format', proposal: 'proposal', context: 'context', tone: 'tone', references: 'reference' };
        const cat = getCategoryById(id, typeMap[k]);
        items.push({ key: k, id, label: cat?.label || id });
      });
    });
    if (items.length === 0) return null;
    return (
      <div className="flex items-center justify-between bg-white py-1">
        <div className="flex flex-wrap gap-2" aria-label="Selecionados">
          {items.map((it) => (
            <button
              key={`${it.key}:${it.id}`}
              onClick={() => updateParamList(it.key, it.id, false)}
              className="px-2 py-0.5 rounded-full border text-xs bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100"
              title="Remover filtro"
            >
              {it.label} ×
            </button>
          ))}
        </div>
        <button onClick={clearAll} className="px-3 py-1 rounded-full border text-xs whitespace-nowrap bg-white text-gray-700 border-gray-300 hover:bg-gray-50">
          Limpar filtros
        </button>
      </div>
    );
  };

  // Expand/Collapse por guia (Top N + Ver todos)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const TOP_N = 10;
  const toggleExpand = (key: string) => setExpanded(prev => ({ ...prev, [key]: !prev[key] }));

  const Row = ({ title, name, options }: { title: string; name: keyof typeof selected; options: { id: string; label: string }[] }) => {
    const isActive = activeTab === name;
    if (!isActive) return null;
    const showAll = !!expanded[name];
    const list = showAll ? options : options.slice(0, TOP_N);
    const hasMore = options.length > TOP_N;
    return (
      <div>
        <div className="text-xs font-semibold text-gray-500 mb-1">{title}</div>
        <div className="-mx-1 overflow-x-auto hide-scrollbar">
          <div className="flex flex-nowrap gap-2 px-1 py-1 items-center">
            {list.map((o) => {
              const active = selected[name].includes(o.id);
              return (
                <button
                  key={o.id}
                  onClick={() => updateParamList(name, o.id)}
                  className={`px-3 py-1.5 rounded-full border text-sm whitespace-nowrap ${
                    active ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-800 border-gray-300 hover:bg-gray-50'
                  }`}
                  aria-pressed={active}
                >
                  {o.label}
                </button>
              );
            })}
            {hasMore && (
              <button
                onClick={() => toggleExpand(name)}
                className="px-3 py-1.5 rounded-full border text-sm whitespace-nowrap bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
              >
                {showAll ? 'Ver menos' : 'Ver todos'}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="mt-2 space-y-2" aria-label="Filtros por categoria">
      <SelectedRow />

      {/* Segmented control */}
      <div role="tablist" aria-label="Categorias" className="flex gap-1 overflow-x-auto hide-scrollbar pb-1">
        {TABS.map((t) => {
          const on = activeTab === t.key;
          return (
            <button
              key={t.key}
              role="tab"
              aria-selected={on}
              aria-controls={`chips-${t.key}`}
              onClick={() => setActiveTab(t.key)}
              className={`px-3 py-1.5 rounded-full border text-sm whitespace-nowrap ${on ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-800 border-gray-300 hover:bg-gray-50'}`}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Uma linha por vez: só a guia ativa */}
      <div id={`chips-${activeTab}`}>
        <Row title="Formato" name="format" options={formats} />
        <Row title="Proposta" name="proposal" options={proposals} />
        <Row title="Contexto" name="context" options={contexts} />
        <Row title="Tom" name="tone" options={tones} />
        <Row title="Referências" name="references" options={references} />
      </div>

      <style jsx global>{`
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}
