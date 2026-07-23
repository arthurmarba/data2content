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
        left: Math.max(target.offsetLeft - 24, 0),
        behavior: "smooth",
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

    const closestIndex = boardElements.reduce(
      (closest, element, index) => {
        const distance = Math.abs(element.offsetLeft - container.scrollLeft);
        return distance < closest.distance ? { index, distance } : closest;
      },
      { index: 0, distance: Number.POSITIVE_INFINITY },
    ).index;
    setActiveIndex(closestIndex);
  }, []);

  return (
    <div className={`relative flex h-full min-h-0 w-full flex-col ${className}`}>
      {hasNavigation ? (
        <div className="flex h-9 shrink-0 items-center justify-end gap-2 px-4 sm:px-6 lg:px-8">
          <span className="mr-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-400">
            {activeIndex + 1} / {items.length} · {navigationLabels[activeIndex]}
          </span>
          <button
            type="button"
            onClick={() => scrollToIndex(activeIndex - 1)}
            disabled={activeIndex === 0}
            className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-zinc-200/80 bg-white text-zinc-600 transition-colors hover:border-zinc-300 hover:text-zinc-950 disabled:cursor-not-allowed disabled:opacity-30"
            aria-label="Painel anterior"
          >
            <ChevronLeftIcon className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => scrollToIndex(activeIndex + 1)}
            disabled={activeIndex === items.length - 1}
            className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-zinc-200/80 bg-white text-zinc-600 transition-colors hover:border-zinc-300 hover:text-zinc-950 disabled:cursor-not-allowed disabled:opacity-30"
            aria-label="Próximo painel"
          >
            <ChevronRightIcon className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : null}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className={`
          dashboard-scrollbar min-h-0 flex-1 overflow-y-hidden lg:overflow-y-visible scroll-smooth scroll-pl-4 scroll-pr-4 sm:scroll-pl-6 sm:scroll-pr-6 lg:scroll-pl-8 lg:scroll-pr-8
          ${hasSingleBoard ? "overflow-x-hidden" : "overflow-x-auto snap-x snap-mandatory"}
        `}
      >
        <div
          className={`
            flex h-full items-stretch gap-8 px-4 pb-4 pt-4 sm:px-6 lg:gap-10 lg:px-8 lg:pb-5 lg:pt-2
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
                ${hasSingleBoard ? "shrink" : "shrink-0 snap-start"}
                ${index === 0 ? firstItemClassName : restItemClassName}
                ${itemClassName}
              `}
            >
              {child}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
