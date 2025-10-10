"use client";

import React, { useCallback, useEffect, useState } from "react";
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

export default function DiscoverChips() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const [selectedFilters, setSelectedFilters] = useState<SelectedFilters>(
    () => buildSelectedFromParams(params)
  );
  const [currentView, setCurrentView] = useState<ViewState>("master");

  useEffect(() => {
    setSelectedFilters(buildSelectedFromParams(params));
  }, [params]);

  const hasSelections = MASTER_ORDER.some(
    (key) => selectedFilters[key].length > 0
  );

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
      const query = search.toString();
      const href = query ? `${pathname}?${query}` : pathname;
      router.replace(href, { scroll: false });
    },
    [params, pathname, router]
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
        updateUrl(nextState);
        return nextState;
      });
    },
    [updateUrl]
  );

  const handleClearAll = useCallback(() => {
    const emptyState = createEmptySelection();
    setSelectedFilters(emptyState);
    const search = new URLSearchParams(params.toString());
    MASTER_ORDER.forEach((key) => search.delete(key));
    const query = search.toString();
    const href = query ? `${pathname}?${query}` : pathname;
    router.replace(href, { scroll: false });
    setCurrentView("master");
  }, [params, pathname, router]);

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
    <div className="filter-container flex flex-wrap items-center gap-2 rounded-2xl border border-gray-200 bg-white/70 p-3 shadow-sm sm:p-4">
      {currentView !== "master" && (
        <button
          type="button"
          onClick={handleBack}
          aria-label="Voltar para categorias"
          className="filter-button-back inline-flex h-10 w-10 items-center justify-center rounded-full border border-transparent text-brand-magenta transition hover:bg-brand-magenta/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-magenta"
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
                className={`filter-button-master inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-magenta ${
                  hasSelection
                    ? "has-selection border-transparent bg-gradient-to-r from-brand-magenta to-brand-purple text-white shadow-sm"
                    : "border-gray-200 bg-white text-gray-700 hover:border-brand-magenta/40 hover:text-brand-magenta"
                }`}
              >
                <span className="flex items-center gap-1">
                  <span>{category.label}</span>
                  {hasSelection && (
                    <span className="text-base leading-none text-white" aria-hidden="true">
                      •
                    </span>
                  )}
                </span>
                <ChevronRightIcon
                  className={`h-4 w-4 transition ${
                    hasSelection ? "text-white/80" : "text-brand-magenta/60"
                  }`}
                  aria-hidden="true"
                />
              </button>
            );
          })}
          {hasSelections && (
            <button
              type="button"
              onClick={handleClearAll}
              className="ml-auto inline-flex items-center rounded-full border border-transparent bg-gray-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-gray-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-900"
            >
              Limpar filtros
            </button>
          )}
        </>
      )}

      {currentView !== "master" && currentCategory && (
        <>
          <span className="inline-flex items-center rounded-full bg-brand-magenta/10 px-4 py-2 text-sm font-semibold text-brand-magenta">
            {currentCategory.label}
          </span>
          {currentCategory.options.map((option) => {
            const isSelected = selectedFilters[currentCategory.id].includes(option.id);
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => toggleFilter(currentCategory.id, option.id)}
                className={`filter-button-child inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-magenta ${
                  isSelected
                    ? "is-selected border-transparent bg-gradient-to-r from-brand-magenta to-brand-purple text-white shadow-sm"
                    : "border-gray-200 bg-white text-gray-700 hover:border-brand-magenta/40 hover:text-brand-magenta"
                }`}
                aria-pressed={isSelected}
              >
                <CheckIcon
                  className={`h-4 w-4 transition ${
                    isSelected ? "opacity-100 text-white" : "opacity-0 text-transparent"
                  }`}
                  aria-hidden="true"
                />
                <span className="truncate">{option.label}</span>
              </button>
            );
          })}
        </>
      )}

    </div>
  );
}
