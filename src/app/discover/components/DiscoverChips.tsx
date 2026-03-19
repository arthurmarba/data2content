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
  XMarkIcon,
} from "@heroicons/react/24/outline";
import {
  buildDiscoverSearchParams,
  buildDiscoverSelectedFromParams,
  createEmptyDiscoverSelection,
  type DiscoverFilterCategoryId,
  type DiscoverSelectedFilters,
} from "./discoverFilterState";

type CategoryId = DiscoverFilterCategoryId;
type Option = {
  id: string;
  label: string;
  depth: number;
  groupId: string;
  groupLabel: string;
  hasChildren: boolean;
};
type FilterCategory = { id: CategoryId; label: string; options: Option[] };
type SelectedFilters = DiscoverSelectedFilters;
type ViewState = "master" | CategoryId;

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

const flattenCategories = (input: Category[]): Option[] => {
  const result: Option[] = [];
  const visit = (
    items: Category[],
    root?: { id: string; label: string },
    depth = 0,
  ) => {
    items.forEach((item) => {
      const nextRoot = root ?? { id: item.id, label: item.label };
      result.push({
        id: item.id,
        label: item.label,
        depth,
        groupId: nextRoot.id,
        groupLabel: nextRoot.label,
        hasChildren: Boolean(item.subcategories?.length),
      });
      if (item.subcategories && item.subcategories.length) {
        visit(item.subcategories, nextRoot, depth + 1);
      }
    });
  };
  visit(input);
  return result;
};

const DISCOVER_FORMATS = formatCategories.filter((cat) =>
  ['reel', 'photo', 'carousel', 'long_video'].includes(cat.id)
);

const FILTER_DATA: FilterCategory[] = [
  {
    id: "format",
    label: MASTER_LABELS.format,
    options: flattenCategories(DISCOVER_FORMATS),
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

const FILTER_LABEL_LOOKUP: Record<CategoryId, Map<string, string>> = Object.fromEntries(
  FILTER_DATA.map((category) => [
    category.id,
    new Map(category.options.map((option) => [option.id, option.label] as const)),
  ])
) as Record<CategoryId, Map<string, string>>;

export default function DiscoverChips({ defaultView = "master", onViewChange }: DiscoverChipsProps = {}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const [selectedFilters, setSelectedFilters] = useState<SelectedFilters>(
    () => buildDiscoverSelectedFromParams(params)
  );
  const [appliedFilters, setAppliedFilters] = useState<SelectedFilters>(
    () => buildDiscoverSelectedFromParams(params)
  );
  const [currentView, setCurrentView] = useState<ViewState>(defaultView);

  useEffect(() => {
    const next = buildDiscoverSelectedFromParams(params);
    setSelectedFilters(next);
    setAppliedFilters(next);

    const normalizedSearch = buildDiscoverSearchParams(params, next);
    const normalizedQuery = normalizedSearch.toString();
    const currentQuery = params.toString();
    if (normalizedQuery !== currentQuery) {
      const href = normalizedQuery ? `${pathname}?${normalizedQuery}` : pathname;
      router.replace(href, { scroll: false });
    }
  }, [params, pathname, router]);

  useEffect(() => {
    setCurrentView(defaultView);
  }, [defaultView]);

  useEffect(() => {
    onViewChange?.(currentView);
  }, [currentView, onViewChange]);

  const hasSelections = MASTER_ORDER.some(
    (key) => selectedFilters[key].length > 0
  );
  const selectedCount = MASTER_ORDER.reduce(
    (sum, key) => sum + selectedFilters[key].length,
    0
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
      const search = buildDiscoverSearchParams(params, nextState);
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
    const emptyState = createEmptyDiscoverSelection();
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

  const currentCategorySelectionCount = currentCategory
    ? selectedFilters[currentCategory.id].length
    : 0;
  const isHierarchicalCurrentCategory = Boolean(
    currentCategory?.options.some((option) => option.depth > 0)
  );

  const groupedCurrentOptions = useMemo(() => {
    if (!currentCategory) return [];

    const roots = currentCategory.options.filter((option) => option.depth === 0);
    return roots.map((root) => ({
      root,
      children: currentCategory.options.filter(
        (option) => option.groupId === root.id && option.depth > 0
      ),
    }));
  }, [currentCategory]);

  const activeFilterChips = useMemo(
    () =>
      MASTER_ORDER.flatMap((categoryId) =>
        selectedFilters[categoryId].map((value) => ({
          categoryId,
          value,
          label: FILTER_LABEL_LOOKUP[categoryId].get(value) ?? value,
          categoryLabel: MASTER_LABELS[categoryId],
        }))
      ),
    [selectedFilters]
  );

  useEffect(() => {
    if (currentView !== "master" && !currentCategory) {
      setCurrentView("master");
    }
  }, [currentCategory, currentView]);

  return (
    <div className="filter-container w-full rounded-[1.25rem] border border-slate-200/80 bg-white/90 p-3 shadow-[0_8px_30px_rgba(15,23,42,0.04)] backdrop-blur-sm sm:p-4">
      <style jsx global>{`
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
            Refinar feed
          </p>
          <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
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
            <span className="font-medium text-slate-800">
              {currentView === "master"
                ? "Escolha a dimensão para refinar"
                : currentCategory?.label}
            </span>
            <span className="text-slate-400">
              {currentView === "master"
                ? `${selectedCount} selecionado${selectedCount === 1 ? "" : "s"}`
                : `${currentCategory?.options.length ?? 0} opç${(currentCategory?.options.length ?? 0) === 1 ? "ão" : "ões"}${currentCategorySelectionCount > 0 ? ` • ${currentCategorySelectionCount} marcada${currentCategorySelectionCount === 1 ? "" : "s"}` : ""}`}
            </span>
          </div>
        </div>

        {hasSelections && (
          <button
            type="button"
            onClick={handleClearAll}
            className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-magenta"
          >
            Limpar tudo
          </button>
        )}
      </div>

      {activeFilterChips.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
          {activeFilterChips.map((chip) => (
            <button
              key={`${chip.categoryId}:${chip.value}`}
              type="button"
              onClick={() => toggleFilter(chip.categoryId, chip.value)}
              className="inline-flex min-w-0 max-w-full items-center gap-2 rounded-full border border-brand-magenta/20 bg-brand-magenta/5 px-3 py-1.5 text-sm text-slate-700 transition hover:border-brand-magenta/30 hover:bg-brand-magenta/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-magenta"
            >
              <span className="truncate">
                <span className="text-slate-400">{chip.categoryLabel} · </span>
                <span className="font-medium text-brand-magenta">{chip.label}</span>
              </span>
              <XMarkIcon className="h-4 w-4 text-slate-400" aria-hidden="true" />
            </button>
          ))}
        </div>
      )}

      {currentView === "master" && (
        <div className="mt-4 flex flex-wrap gap-2">
          {FILTER_DATA.map((category) => {
            const selectionCount = selectedFilters[category.id].length;
            const hasSelection = selectionCount > 0;
            return (
              <button
                key={category.id}
                type="button"
                onClick={() => handleMasterClick(category.id)}
                className={`filter-button-master inline-flex min-w-0 max-w-full items-center justify-start gap-2 rounded-full border px-3.5 py-2 text-sm font-semibold text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-magenta ${
                  hasSelection
                    ? "has-selection border-brand-magenta/30 bg-brand-magenta/10 text-brand-magenta shadow-sm"
                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:text-brand-magenta"
                }`}
              >
                <span>{category.label}</span>
                {hasSelection && (
                  <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-white/90 px-1.5 text-[11px] font-bold text-brand-magenta">
                    {selectionCount}
                  </span>
                )}
                <ChevronRightIcon
                  className={`h-4 w-4 transition ${
                    hasSelection ? "text-brand-magenta/80" : "text-brand-magenta/60"
                  }`}
                  aria-hidden="true"
                />
              </button>
            );
          })}
        </div>
      )}

      {currentView !== "master" && currentCategory && (
        <div className="mt-4 space-y-4 border-t border-slate-100 pt-4">
          {isHierarchicalCurrentCategory ? (
            groupedCurrentOptions.map(({ root, children }) => {
              const isRootSelected = selectedFilters[currentCategory.id].includes(root.id);
              return (
                <section key={root.id} className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => toggleFilter(currentCategory.id, root.id)}
                      className={`inline-flex min-w-0 max-w-full items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-magenta ${
                        isRootSelected
                          ? "border-slate-300 bg-slate-900 text-white shadow-sm"
                          : "border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 hover:bg-slate-100"
                      }`}
                      aria-pressed={isRootSelected}
                    >
                      <span className="truncate">{root.label}</span>
                      {children.length > 0 && (
                        <span
                          className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                            isRootSelected ? "bg-white/15 text-white/90" : "bg-white text-slate-400"
                          }`}
                        >
                          {children.length}
                        </span>
                      )}
                    </button>
                    {children.length > 0 && (
                      <span className="text-xs text-slate-400">
                        {children.length} subtópico{children.length === 1 ? "" : "s"}
                      </span>
                    )}
                  </div>

                  {children.length > 0 && (
                    <div className="flex w-full flex-wrap content-start justify-start items-start gap-2">
                      {children.map((option) => {
                        const isSelected = selectedFilters[currentCategory.id].includes(option.id);
                        return (
                          <button
                            key={option.id}
                            type="button"
                            onClick={() => toggleFilter(currentCategory.id, option.id)}
                            className={`filter-button-child inline-flex min-w-0 max-w-[14rem] items-center justify-start rounded-full border px-3 py-1.5 text-sm font-medium text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-magenta sm:max-w-[20rem] lg:max-w-[24rem] ${
                              isSelected
                                ? "is-selected border-brand-magenta/30 bg-brand-magenta/10 text-brand-magenta shadow-sm"
                                : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:text-brand-magenta"
                            }`}
                            aria-pressed={isSelected}
                          >
                            {isSelected && (
                              <CheckIcon
                                className="mr-2 h-4 w-4 shrink-0 text-brand-magenta"
                                aria-hidden="true"
                              />
                            )}
                            <span
                              className="whitespace-normal break-words leading-snug sm:whitespace-nowrap sm:truncate"
                              title={option.label}
                            >
                              {option.label}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </section>
              );
            })
          ) : (
            <div className="flex w-full flex-wrap content-start justify-start items-start gap-2">
              {currentCategory.options.map((option) => {
                const isSelected = selectedFilters[currentCategory.id].includes(option.id);
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => toggleFilter(currentCategory.id, option.id)}
                    className={`filter-button-child inline-flex min-w-0 max-w-[14rem] items-center justify-start rounded-full border px-3 py-1.5 text-sm font-medium text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-magenta sm:max-w-[20rem] lg:max-w-[24rem] ${
                      isSelected
                        ? "is-selected border-brand-magenta/30 bg-brand-magenta/10 text-brand-magenta shadow-sm"
                        : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:text-brand-magenta"
                    }`}
                    aria-pressed={isSelected}
                  >
                    {isSelected && (
                      <CheckIcon
                        className="mr-2 h-4 w-4 shrink-0 text-brand-magenta"
                        aria-hidden="true"
                      />
                    )}
                    <span
                      className="whitespace-normal break-words leading-snug sm:whitespace-nowrap sm:truncate"
                      title={option.label}
                    >
                      {option.label}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {(hasPendingChanges || hasSelections) && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-4">
          <p className="text-sm text-slate-500">
            {hasPendingChanges
              ? "Existem ajustes prontos para aplicar no feed."
              : `${selectedCount} filtro${selectedCount === 1 ? "" : "s"} ativo${selectedCount === 1 ? "" : "s"}.`}
          </p>
          {hasPendingChanges && (
            <button
              type="button"
              onClick={handleApplyFilters}
              className="inline-flex items-center rounded-full border border-brand-magenta/30 bg-brand-magenta px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-brand-red focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-magenta"
            >
              Aplicar {selectedCount > 0 ? `${selectedCount} filtro${selectedCount === 1 ? "" : "s"}` : "filtros"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
