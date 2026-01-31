"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { Category } from "@/app/lib/classification";
import {
  formatCategories,
  proposalCategories,
  contextCategories,
  toneCategories,
  referenceCategories,
} from "@/app/lib/classification";
import {
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from "@heroicons/react/24/outline";

type CategoryId = "format" | "proposal" | "context" | "tone" | "references";
type Option = { id: string; label: string };
type FilterCategory = { id: CategoryId; label: string; options: Option[] };
type SelectedFilters = Record<CategoryId, string[]>;
type ViewState = "master" | CategoryId;
type SearchParamsLike = Pick<URLSearchParams, "get" | "toString">;

type DiscoverChipsProps = {
  defaultView?: ViewState;
  onViewChange?: (view: ViewState) => void;
};

const MASTER_ORDER: CategoryId[] = [
  "format",
  "proposal",
  "context",
  "tone",
  "references",
];

const MASTER_LABELS: Record<CategoryId, string> = {
  format: "Formato",
  proposal: "Proposta",
  context: "Contexto",
  tone: "Tom",
  references: "Referências",
};

const createEmptySelection = (): SelectedFilters =>
  MASTER_ORDER.reduce((acc, key) => {
    acc[key] = [];
    return acc;
  }, {} as SelectedFilters);

const flattenCategories = (input: Category[]): Option[] => {
  const result: Option[] = [];
  const visit = (items: Category[]) => {
    items.forEach((item) => {
      result.push({ id: item.id, label: item.label });
      if (item.subcategories && item.subcategories.length) {
        visit(item.subcategories);
      }
    });
  };
  visit(input);
  return result;
};

const FILTER_DATA: FilterCategory[] = [
  {
    id: "format",
    label: MASTER_LABELS.format,
    options: flattenCategories(formatCategories),
  },
  {
    id: "proposal",
    label: MASTER_LABELS.proposal,
    options: flattenCategories(proposalCategories),
  },
  {
    id: "context",
    label: MASTER_LABELS.context,
    options: flattenCategories(contextCategories),
  },
  {
    id: "tone",
    label: MASTER_LABELS.tone,
    options: flattenCategories(toneCategories),
  },
  {
    id: "references",
    label: MASTER_LABELS.references,
    options: flattenCategories(referenceCategories),
  },
];

const buildSelectedFromParams = (params: SearchParamsLike): SelectedFilters => {
  const state = createEmptySelection();
  MASTER_ORDER.forEach((key) => {
    const raw = params.get(key);
    if (!raw) return;
    const parsed = raw
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);
    state[key] = Array.from(new Set(parsed));
  });
  return state;
};

export default function DiscoverChips({ defaultView = "master", onViewChange }: DiscoverChipsProps = {}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const [selectedFilters, setSelectedFilters] = useState<SelectedFilters>(
    () => buildSelectedFromParams(params)
  );
  const [appliedFilters, setAppliedFilters] = useState<SelectedFilters>(
    () => buildSelectedFromParams(params)
  );
  const [currentView, setCurrentView] = useState<ViewState>(defaultView);

  useEffect(() => {
    const next = buildSelectedFromParams(params);
    setSelectedFilters(next);
    setAppliedFilters(next);
  }, [params]);

  useEffect(() => {
    setCurrentView(defaultView);
  }, [defaultView]);

  useEffect(() => {
    onViewChange?.(currentView);
  }, [currentView, onViewChange]);

  const hasSelections = MASTER_ORDER.some(
    (key) => selectedFilters[key].length > 0
  );

  const filtersMatch = useCallback((a: SelectedFilters, b: SelectedFilters) => {
    return MASTER_ORDER.every((key) => {
      const left = [...(a[key] || [])].sort();
      const right = [...(b[key] || [])].sort();
      if (left.length !== right.length) return false;
      return left.every((value, index) => value === right[index]);
    });
  }, []);

  const updateUrl = useCallback(
    (nextState: SelectedFilters) => {
      const search = new URLSearchParams(params.toString());
      MASTER_ORDER.forEach((key) => {
        const values = nextState[key];
        if (values.length) {
          search.set(key, Array.from(new Set(values)).join(","));
        } else {
          search.delete(key);
        }
      });
      search.delete("videoOnly");
      const query = search.toString();
      const href = query ? `${pathname}?${query}` : pathname;
      router.replace(href, { scroll: false });
    },
    [params, pathname, router]
  );

  const hasPendingChanges = useMemo(
    () => !filtersMatch(selectedFilters, appliedFilters),
    [filtersMatch, selectedFilters, appliedFilters]
  );

  const applyFilters = useCallback(
    (nextState: SelectedFilters) => {
      setAppliedFilters(nextState);
      updateUrl(nextState);
    },
    [updateUrl]
  );

  const handleMasterClick = useCallback((categoryId: CategoryId) => {
    setCurrentView(categoryId);
  }, []);

  const handleBack = useCallback(() => {
    setCurrentView("master");
  }, []);

  const toggleFilter = useCallback(
    (categoryId: CategoryId, optionId: string) => {
      setSelectedFilters((prev) => {
        const current = prev[categoryId] || [];
        const exists = current.includes(optionId);
        const nextValues = exists
          ? current.filter((value) => value !== optionId)
          : [...current, optionId];
        const nextState = { ...prev, [categoryId]: nextValues };
        return nextState;
      });
    },
    []
  );

  const handleClearAll = useCallback(() => {
    const emptyState = createEmptySelection();
    setSelectedFilters(emptyState);
    applyFilters(emptyState);
    setCurrentView("master");
  }, [applyFilters]);

  const handleApplyFilters = useCallback(() => {
    applyFilters(selectedFilters);
  }, [applyFilters, selectedFilters]);

  const currentCategory =
    currentView === "master"
      ? null
      : FILTER_DATA.find((category) => category.id === currentView) || null;

  useEffect(() => {
    if (currentView !== "master" && !currentCategory) {
      setCurrentView("master");
    }
  }, [currentCategory, currentView]);

  return (
    <div className="filter-container flex flex-wrap overflow-visible items-center gap-1.5 p-1 sm:flex-wrap sm:overflow-visible sm:p-2">
      <style jsx global>{`
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
      {currentView !== "master" && (
        <button
          type="button"
          onClick={handleBack}
          aria-label="Voltar para categorias"
          className="filter-button-back inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-magenta"
        >
          <ChevronLeftIcon className="h-5 w-5" aria-hidden="true" />
        </button>
      )}

      {currentView === "master" && (
        <>
          {FILTER_DATA.map((category) => {
            const hasSelection = selectedFilters[category.id].length > 0;
            return (
              <button
                key={category.id}
                type="button"
                onClick={() => handleMasterClick(category.id)}
                className={`filter-button-master inline-flex min-w-max items-center justify-start gap-2 rounded-full border px-3 py-1.5 text-sm font-semibold text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-magenta ${hasSelection
                    ? "has-selection border-brand-magenta/30 bg-brand-magenta/10 text-brand-magenta shadow-sm"
                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:text-brand-magenta"
                  }`}
              >
                <span className="flex items-center gap-1">
                  <span>{category.label}</span>
                  {hasSelection && (
                    <span className="text-base leading-none text-brand-magenta" aria-hidden="true">
                      •
                    </span>
                  )}
                </span>
                <ChevronRightIcon
                  className={`h-4 w-4 transition ${hasSelection ? "text-brand-magenta/80" : "text-brand-magenta/60"
                    }`}
                  aria-hidden="true"
                />
              </button>
            );
          })}
        </>
      )}

      {currentView !== "master" && currentCategory && (
        <div className="w-full space-y-2">
          <span className="inline-flex items-center rounded-full bg-brand-magenta/10 px-3 py-1.5 text-sm font-semibold text-brand-magenta">
            {currentCategory.label}
          </span>
          <div className="flex flex-wrap items-start gap-2">
            {currentCategory.options.map((option) => {
              const isSelected = selectedFilters[currentCategory.id].includes(option.id);
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => toggleFilter(currentCategory.id, option.id)}
                  className={`filter-button-child inline-flex min-w-[8.5rem] items-center justify-start gap-2 rounded-full border px-3 py-1.5 text-sm font-medium text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-magenta sm:min-w-max ${isSelected
                      ? "is-selected border-brand-magenta/30 bg-brand-magenta/10 text-brand-magenta shadow-sm"
                      : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:text-brand-magenta"
                    }`}
                  aria-pressed={isSelected}
                >
                  <CheckIcon
                    className={`h-4 w-4 transition ${isSelected ? "opacity-100 text-brand-magenta" : "opacity-0 text-transparent"
                      }`}
                    aria-hidden="true"
                  />
                  <span className="whitespace-nowrap">{option.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {(hasPendingChanges || hasSelections) && (
        <div className="flex w-full flex-wrap items-center gap-1.5 justify-end sm:ml-auto sm:w-auto sm:flex-nowrap">
          {hasPendingChanges && (
            <button
              type="button"
              onClick={handleApplyFilters}
              className="inline-flex items-center rounded-full border border-brand-magenta/30 bg-brand-magenta px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-brand-red focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-magenta"
            >
              Aplicar filtros
            </button>
          )}
          {hasSelections && (
            <button
              type="button"
              onClick={handleClearAll}
              className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-magenta"
            >
              Limpar filtros
            </button>
          )}
        </div>
      )}

    </div>
  );
}
