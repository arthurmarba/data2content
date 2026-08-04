"use client";

import React from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/24/outline";

type PinnedBoardsHubProps = {
  children: React.ReactNode;
  className?: string;
  railClassName?: string;
  itemClassName?: string;
  boardWidthClassName?: string;
  firstItemClassName?: string;
  restItemClassName?: string;
  navigationLabels?: string[];
};

export default function PinnedBoardsHub({
  children,
  className = "",
  railClassName = "",
  itemClassName = "",
  boardWidthClassName = "w-[min(415px,calc(100vw-24px))] lg:w-[450px] xl:w-[470px]",
  firstItemClassName = "",
  restItemClassName = "",
  navigationLabels = [],
}: PinnedBoardsHubProps) {
  const items = React.Children.toArray(children).filter(Boolean);
  const hasSingleBoard = items.length === 1;
  const hasNavigation = items.length > 1 && navigationLabels.length === items.length;
  const scrollContainerRef = React.useRef<HTMLDivElement | null>(null);
  const [activeIndex, setActiveIndex] = React.useState(0);

  React.useEffect(() => {
    setActiveIndex((current) => Math.min(current, Math.max(items.length - 1, 0)));
  }, [items.length]);

  const scrollToIndex = React.useCallback(
    (index: number) => {
      const nextIndex = Math.max(0, Math.min(index, items.length - 1));
      const container = scrollContainerRef.current;
      const target = container?.querySelector<HTMLElement>(
        `[data-pinned-board-index="${nextIndex}"]`,
      );
      if (!container || !target) return;

      container.scrollTo({
        left: Math.max(
          target.offsetLeft - (container.clientWidth - target.clientWidth) / 2,
          0,
        ),
        behavior:
          typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
            ? "auto"
            : "smooth",
      });
      setActiveIndex(nextIndex);
    },
    [items.length],
  );

  const handleScroll = React.useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const boardElements = Array.from(
      container.querySelectorAll<HTMLElement>("[data-pinned-board-index]"),
    );
    if (!boardElements.length) return;

    const containerCenter = container.scrollLeft + container.clientWidth / 2;
    const closestIndex = boardElements.reduce(
      (closest, element, index) => {
        const elementCenter = element.offsetLeft + element.clientWidth / 2;
        const distance = Math.abs(elementCenter - containerCenter);
        return distance < closest.distance ? { index, distance } : closest;
      },
      { index: 0, distance: Number.POSITIVE_INFINITY },
    ).index;
    setActiveIndex(closestIndex);
  }, []);

  return (
    <div className={`relative flex h-full min-h-0 w-full flex-col ${className}`}>
      {hasNavigation ? (
        <div className="flex h-14 shrink-0 items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <div className="min-w-0">
            <h1 className="text-sm font-semibold tracking-[-0.02em] text-zinc-950">Visão geral</h1>
            <p className="mt-0.5 truncate text-[12px] text-zinc-500">
              Atualizações e próximos passos do seu workspace
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span
              className="mr-1 hidden text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-500 sm:inline"
              aria-live="polite"
              aria-atomic="true"
            >
              {activeIndex + 1} de {items.length} · {navigationLabels[activeIndex]}
            </span>
            <button
              type="button"
              onClick={() => scrollToIndex(activeIndex - 1)}
              disabled={activeIndex === 0}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-zinc-200/90 bg-white text-zinc-700 shadow-sm transition hover:-translate-y-0.5 hover:border-zinc-300 hover:text-zinc-950 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:ring-offset-2"
              aria-label="Painel anterior"
            >
              <ChevronLeftIcon className="h-4 w-4" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => scrollToIndex(activeIndex + 1)}
              disabled={activeIndex === items.length - 1}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-zinc-200/90 bg-white text-zinc-700 shadow-sm transition hover:-translate-y-0.5 hover:border-zinc-300 hover:text-zinc-950 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400 focus-visible:ring-offset-2"
              aria-label="Próximo painel"
            >
              <ChevronRightIcon className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      ) : null}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        role="region"
        aria-label="Painéis da visão geral"
        className={`
          dashboard-scrollbar min-h-0 flex-1 overflow-y-hidden lg:overflow-y-visible scroll-smooth scroll-pl-4 scroll-pr-4 sm:scroll-pl-6 sm:scroll-pr-6 lg:scroll-pl-8 lg:scroll-pr-8
          ${hasSingleBoard ? "overflow-x-hidden" : "overflow-x-auto snap-x snap-mandatory"}
        `}
      >
        <div
          className={`
            flex h-full items-stretch gap-6 px-4 pb-4 pt-3 sm:px-6 lg:gap-8 lg:px-8 lg:pb-6 lg:pt-3
            ${hasSingleBoard ? "min-w-0 justify-center" : "min-w-max"}
            ${railClassName}
          `}
        >
          {items.map((child, index) => (
            <div
              key={index}
              data-pinned-board-index={index}
              className={`
                ${boardWidthClassName} h-full
                ${hasSingleBoard ? "shrink" : "shrink-0 snap-center"}
                ${index === 0 ? firstItemClassName : restItemClassName}
                ${itemClassName}
                transition-[opacity,transform] duration-300
                ${!hasSingleBoard && index !== activeIndex ? "opacity-[0.82]" : "opacity-100"}
              `}
              aria-current={index === activeIndex ? "true" : undefined}
            >
              {child}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
