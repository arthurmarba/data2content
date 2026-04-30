"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  getFlatFilterableCategories,
  type FlatCategory,
} from "@/app/lib/classification";
import {
  contentSignalCategories,
  contentIntentCategories,
  narrativeFormCategories,
} from "@/app/lib/classificationV2";
import {
  commercialModeCategories,
  proofStyleCategories,
  stanceCategories,
} from "@/app/lib/classificationV2_5";
import {
  AdjustmentsHorizontalIcon,
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
type GroupedOptionSet = {
  key: string;
  label: string;
  root: Option | null;
  children: Option[];
};

type DiscoverChipsProps = {
  defaultView?: ViewState;
  onViewChange?: (view: ViewState) => void;
  compactView?: boolean;
};

const MASTER_ORDER: CategoryId[] = [
  "format",
  "contentIntent",
  "context",
  "narrativeForm",
  "proofStyle",
  "stance",
  "commercialMode",
  "contentSignals",
  "references",
];

const MASTER_LABELS: Record<CategoryId, string> = {
  format: "Formato",
  contentIntent: "Intenção",
  context: "Contexto",
  narrativeForm: "Narrativa",
  contentSignals: "Sinais",
  stance: "Postura",
  proofStyle: "Prova",
  commercialMode: "Comercial",
  references: "Referências",
};

const buildOptionsFromFlatCategories = (categories: FlatCategory[]): Option[] =>
  categories.map((category) => {
    const rootIndex = category.parentIds.length > 0 ? 0 : -1;
    return {
      id: category.id,
      label: category.label,
      depth: category.parentIds.length,
      groupId: rootIndex >= 0 ? category.parentIds[rootIndex]! : category.id,
      groupLabel: rootIndex >= 0 ? category.parentLabels[rootIndex]! : category.label,
      hasChildren: false,
    };
  });

const buildOptionsFromStrategicCategories = (
  categories: Array<{ id: string; label: string }>
): Option[] =>
  categories.map((category) => ({
    id: category.id,
    label: category.label,
    depth: 0,
    groupId: category.id,
    groupLabel: category.label,
    hasChildren: false,
  }));

export function groupOptionsByDisplay(options: Option[]): GroupedOptionSet[] {
  const roots = options.filter((option) => option.depth === 0);

  if (roots.length > 0) {
    return roots.map((root) => ({
      key: root.id,
      label: root.label,
      root,
      children: options.filter(
        (option) => option.groupId === root.id && option.depth > 0
      ),
    }));
  }

  const groups = new Map<string, GroupedOptionSet>();
  for (const option of options) {
    const group = groups.get(option.groupId) ?? {
      key: option.groupId,
      label: option.groupLabel,
      root: null,
      children: [],
    };
    group.children.push(option);
    groups.set(option.groupId, group);
  }

  return Array.from(groups.values());
}

const DISCOVER_FORMATS = getFlatFilterableCategories("format").filter((cat) =>
  ['reel', 'photo', 'carousel', 'long_video'].includes(cat.id)
);

const FILTER_DATA: FilterCategory[] = [
  {
    id: "format",
    label: MASTER_LABELS.format,
    options: buildOptionsFromFlatCategories(DISCOVER_FORMATS),
  },
  {
    id: "contentIntent",
    label: MASTER_LABELS.contentIntent,
    options: buildOptionsFromStrategicCategories(contentIntentCategories),
  },
  {
    id: "context",
    label: MASTER_LABELS.context,
    options: buildOptionsFromFlatCategories(getFlatFilterableCategories("context")),
  },
  {
    id: "narrativeForm",
    label: MASTER_LABELS.narrativeForm,
    options: buildOptionsFromStrategicCategories(narrativeFormCategories),
  },
  {
    id: "proofStyle",
    label: MASTER_LABELS.proofStyle,
    options: buildOptionsFromStrategicCategories(proofStyleCategories),
  },
  {
    id: "stance",
    label: MASTER_LABELS.stance,
    options: buildOptionsFromStrategicCategories(stanceCategories),
  },
  {
    id: "commercialMode",
    label: MASTER_LABELS.commercialMode,
    options: buildOptionsFromStrategicCategories(commercialModeCategories),
  },
  {
    id: "contentSignals",
    label: MASTER_LABELS.contentSignals,
    options: buildOptionsFromStrategicCategories(contentSignalCategories),
  },
  {
    id: "references",
    label: MASTER_LABELS.references,
    options: buildOptionsFromFlatCategories(getFlatFilterableCategories("reference")),
  },
];

const FILTER_LABEL_LOOKUP: Record<CategoryId, Map<string, string>> = Object.fromEntries(
  FILTER_DATA.map((category) => [
    category.id,
    new Map(category.options.map((option) => [option.id, option.label] as const)),
  ])
) as Record<CategoryId, Map<string, string>>;

export default function DiscoverChips({ defaultView = "master", onViewChange, compactView = false }: DiscoverChipsProps = {}) {
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
  const [compactFiltersOpen, setCompactFiltersOpen] = useState(false);

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

  const removeFilterAndApply = useCallback(
    (categoryId: CategoryId, optionId: string) => {
      const nextValues = (selectedFilters[categoryId] || []).filter((value) => value !== optionId);
      const nextState = { ...selectedFilters, [categoryId]: nextValues };
      setSelectedFilters(nextState);
      applyFilters(nextState);
    },
    [applyFilters, selectedFilters]
  );

  const handleApplyFilters = useCallback(() => {
    applyFilters(selectedFilters);
    if (compactView) setCompactFiltersOpen(false);
  }, [applyFilters, compactView, selectedFilters]);

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
    return groupOptionsByDisplay(currentCategory.options);
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

  const focusRingClassName =
    "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pink-200";
  const secondaryPillClassName =
    `dashboard-secondary-button inline-flex items-center rounded-full ${compactView ? "px-2.5 py-1 text-[11px]" : "px-3 py-1.5 text-xs"} font-semibold text-zinc-600 ${focusRingClassName}`;

  const activeFilterPreview = activeFilterChips.slice(0, 2);
  const hiddenActiveFilterCount = Math.max(0, activeFilterChips.length - activeFilterPreview.length);

  if (compactView && currentView === "master" && !compactFiltersOpen) {
    return (
      <div className="filter-container w-full bg-transparent">
        <style jsx global>{`
          .hide-scrollbar::-webkit-scrollbar { display: none; }
          .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        `}</style>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setCompactFiltersOpen(true)}
            className={`inline-flex h-10 shrink-0 items-center gap-2 rounded-full border border-zinc-200/90 bg-white px-3.5 text-[12px] font-semibold text-zinc-800 shadow-[0_8px_20px_rgba(24,24,27,0.045)] transition hover:border-zinc-300 ${focusRingClassName}`}
            aria-expanded={compactFiltersOpen}
          >
            <AdjustmentsHorizontalIcon className="h-4 w-4" aria-hidden="true" />
            Filtros
            {selectedCount > 0 ? (
              <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-zinc-950 px-1.5 text-[10px] font-bold text-white">
                {selectedCount}
              </span>
            ) : null}
          </button>
          <div className="hide-scrollbar flex min-w-0 flex-1 gap-1.5 overflow-x-auto py-0.5">
            {activeFilterPreview.length > 0 ? (
              activeFilterPreview.map((chip) => (
                <button
                  key={`${chip.categoryId}:${chip.value}`}
                  type="button"
                  onClick={() => removeFilterAndApply(chip.categoryId, chip.value)}
                  className={`inline-flex min-w-0 shrink-0 items-center gap-1.5 rounded-full border border-pink-200/70 bg-pink-50/72 px-2.5 py-1 text-[11px] font-medium text-pink-700 ${focusRingClassName}`}
                >
                  <span className="max-w-[8.5rem] truncate">{chip.label}</span>
                  <XMarkIcon className="h-3.5 w-3.5 text-pink-500/80" aria-hidden="true" />
                </button>
              ))
            ) : (
              <span className="inline-flex h-10 items-center whitespace-nowrap text-[12px] font-medium text-zinc-500">
                Refine por formato, intenção ou contexto.
              </span>
            )}
            {hiddenActiveFilterCount > 0 ? (
              <button
                type="button"
                onClick={() => setCompactFiltersOpen(true)}
                className={`inline-flex shrink-0 items-center rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-zinc-600 ${focusRingClassName}`}
              >
                +{hiddenActiveFilterCount}
              </button>
            ) : null}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="filter-container w-full bg-transparent">
      <style jsx global>{`
        .hide-scrollbar::-webkit-scrollbar { display: none; }
        .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>

      {currentView !== "master" && (
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div className="flex flex-wrap items-center gap-2 text-sm text-zinc-500">
            <button
              type="button"
              onClick={handleBack}
              aria-label="Voltar para categorias"
              className={`filter-button-back dashboard-secondary-button inline-flex h-8 w-8 items-center justify-center rounded-full p-0 text-zinc-600 ${focusRingClassName}`}
            >
              <ChevronLeftIcon className="h-4 w-4" aria-hidden="true" />
            </button>
            <span className="font-semibold text-zinc-900">
              {currentCategory?.label}
            </span>
            <span className="text-xs text-zinc-400">
              {`${currentCategory?.options.length ?? 0} opç${(currentCategory?.options.length ?? 0) === 1 ? "ão" : "ões"}${currentCategorySelectionCount > 0 ? ` • ${currentCategorySelectionCount} marcada${currentCategorySelectionCount === 1 ? "" : "s"}` : ""}`}
            </span>
          </div>
          {hasSelections && (
            <button
              type="button"
              onClick={handleClearAll}
              className={secondaryPillClassName}
            >
              Limpar tudo
            </button>
          )}
        </div>
      )}

      {compactView && currentView === "master" && compactFiltersOpen && (
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400">
              Filtros
            </p>
            <p className="mt-0.5 text-[12px] text-zinc-500">
              Ajuste a curadoria sem sair da comunidade.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setCompactFiltersOpen(false)}
            className={`inline-flex h-8 w-8 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-500 ${focusRingClassName}`}
            aria-label="Fechar filtros"
          >
            <XMarkIcon className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      )}

      {currentView === "master" && hasSelections && (
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-medium text-zinc-500">{selectedCount} selecionado{selectedCount === 1 ? "" : "s"}</span>
          <button
            type="button"
            onClick={handleClearAll}
            className={secondaryPillClassName}
          >
            Limpar tudo
          </button>
        </div>
      )}


      {activeFilterChips.length > 0 && (
        <div className={`${compactView ? "mt-3 gap-1.5 pt-3" : "mt-4 gap-2 pt-4"} flex flex-wrap items-center border-t border-zinc-200/70`}>
          {activeFilterChips.map((chip) => (
            <button
              key={`${chip.categoryId}:${chip.value}`}
              type="button"
              onClick={() => toggleFilter(chip.categoryId, chip.value)}
              className={`inline-flex min-w-0 max-w-full items-center gap-2 rounded-full border border-pink-200/70 bg-pink-50/68 ${compactView ? "px-2.5 py-1 text-[11px]" : "px-3 py-1.5 text-sm"} text-zinc-700 transition hover:border-pink-300 hover:bg-pink-50/78 ${focusRingClassName}`}
            >
              <span className="truncate">
                <span className="text-zinc-400">{chip.categoryLabel} · </span>
                <span className="font-medium text-pink-600">{chip.label}</span>
              </span>
              <XMarkIcon className="h-4 w-4 text-zinc-400" aria-hidden="true" />
            </button>
          ))}
        </div>
      )}

      {currentView === "master" && (
        <div className={`flex flex-wrap items-center ${compactView ? "gap-1.5 pb-1.5" : "gap-2 pb-2"}`}>
          {FILTER_DATA.map((category) => {
            const selectionCount = selectedFilters[category.id].length;
            const hasSelection = selectionCount > 0;
            return (
              <button
                key={category.id}
                type="button"
                onClick={() => handleMasterClick(category.id)}
                className={`filter-button-master inline-flex min-w-0 max-w-full items-center justify-start gap-2 rounded-full border ${compactView ? "px-3 py-1.5 text-[12px]" : "px-4 py-2 text-[13px]"} font-semibold text-left transition ${focusRingClassName} ${
                  hasSelection
                    ? "has-selection border-zinc-900 bg-zinc-900 text-white"
                    : "border-zinc-200/90 bg-white/82 text-zinc-700 hover:border-zinc-300 hover:bg-white hover:text-zinc-950"
                }`}
              >
                <span>{category.label}</span>
                {hasSelection && (
                  <span className={`inline-flex ${compactView ? "h-4.5 min-w-4.5 text-[10px]" : "h-5 min-w-5 text-[11px]"} items-center justify-center rounded-full bg-white/92 px-1.5 font-bold text-zinc-700 ring-1 ring-zinc-100/90`}>
                    {selectionCount}
                  </span>
                )}
                <ChevronRightIcon
                  className={`${compactView ? "h-3 w-3" : "h-3 w-3 sm:h-4 sm:w-4"} transition shrink-0 ${
                    hasSelection ? "text-white/80" : "text-zinc-400"
                  }`}
                  aria-hidden="true"
                />
              </button>
            );
          })}
        </div>
      )}

      {currentView !== "master" && currentCategory && (
        <div className="mt-4 space-y-4 border-t border-zinc-200/70 pt-4">
          {isHierarchicalCurrentCategory ? (
            groupedCurrentOptions.map(({ root, children }) => {
              const isRootSelected = root
                ? selectedFilters[currentCategory.id].includes(root.id)
                : false;
              return (
                <section key={root?.id ?? children[0]?.groupId ?? currentCategory.id} className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    {root ? (
                      <button
                        type="button"
                        onClick={() => toggleFilter(currentCategory.id, root.id)}
                        className={`inline-flex min-w-0 max-w-full items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-semibold transition ${focusRingClassName} ${
                          isRootSelected
                            ? "border-zinc-200/90 bg-zinc-50/82 text-zinc-950"
                            : "border-zinc-200/80 bg-zinc-50/72 text-zinc-700 hover:border-zinc-300 hover:bg-white"
                        }`}
                        aria-pressed={isRootSelected}
                      >
                        <span className="truncate">{root.label}</span>
                        {children.length > 0 && (
                          <span
                            className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                              isRootSelected ? "bg-white/88 text-zinc-700 ring-1 ring-zinc-100/90" : "bg-white text-zinc-400"
                            }`}
                          >
                            {children.length}
                          </span>
                        )}
                      </button>
                    ) : (
                      <p className="px-1 text-xs font-semibold uppercase tracking-[0.14em] text-zinc-400">
                        {children[0]?.groupLabel}
                      </p>
                    )}
                    {children.length > 0 && (
                      <span className="text-xs text-zinc-400">
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
                            className={`filter-button-child inline-flex min-w-0 max-w-[14rem] items-center justify-start rounded-full border px-3 py-1.5 text-sm font-medium text-left transition sm:max-w-[20rem] lg:max-w-[24rem] ${
                              isSelected
                                ? "is-selected border-pink-200/80 bg-pink-50/72 text-pink-600"
                                : "border-zinc-200/90 bg-white/82 text-zinc-700 hover:border-zinc-300 hover:text-zinc-950"
                            } ${focusRingClassName}`}
                            aria-pressed={isSelected}
                          >
                            {isSelected && (
                              <CheckIcon
                                className="mr-2 h-4 w-4 shrink-0 text-pink-500"
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
                    className={`filter-button-child inline-flex min-w-0 max-w-[14rem] items-center justify-start rounded-full border px-3 py-1.5 text-sm font-medium text-left transition sm:max-w-[20rem] lg:max-w-[24rem] ${
                      isSelected
                        ? "is-selected border-pink-200/80 bg-pink-50/72 text-pink-600"
                        : "border-zinc-200/90 bg-white/82 text-zinc-700 hover:border-zinc-300 hover:text-zinc-950"
                    } ${focusRingClassName}`}
                    aria-pressed={isSelected}
                  >
                    {isSelected && (
                      <CheckIcon
                        className="mr-2 h-4 w-4 shrink-0 text-pink-500"
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
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-zinc-200/70 pt-4">
          <p className="text-sm text-zinc-500">
            {hasPendingChanges
              ? "Existem ajustes prontos para aplicar no feed."
              : `${selectedCount} filtro${selectedCount === 1 ? "" : "s"} ativo${selectedCount === 1 ? "" : "s"}.`}
          </p>
          {hasPendingChanges && (
            <button
              type="button"
              onClick={handleApplyFilters}
              className={`dashboard-primary-button inline-flex items-center rounded-2xl px-3.5 py-2 text-sm font-semibold text-white ${focusRingClassName}`}
            >
              Aplicar {selectedCount > 0 ? `${selectedCount} filtro${selectedCount === 1 ? "" : "s"}` : "filtros"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
