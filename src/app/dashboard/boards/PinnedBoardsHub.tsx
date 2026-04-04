"use client";

import React from "react";

type PinnedBoardsHubProps = {
  children: React.ReactNode;
  className?: string;
  railClassName?: string;
  itemClassName?: string;
  boardWidthClassName?: string;
  firstItemClassName?: string;
  restItemClassName?: string;
};

export default function PinnedBoardsHub({
  children,
  className = "",
  railClassName = "",
  itemClassName = "",
  boardWidthClassName = "w-[min(415px,calc(100vw-24px))] lg:w-[450px] xl:w-[470px]",
  firstItemClassName = "",
  restItemClassName = "",
}: PinnedBoardsHubProps) {
  const items = React.Children.toArray(children).filter(Boolean);
  const hasSingleBoard = items.length === 1;

  return (
    <div className={`relative h-full min-h-0 w-full ${className}`}>
      <div
        className={`
          dashboard-scrollbar h-full overflow-y-hidden lg:overflow-y-visible scroll-smooth scroll-pl-4 scroll-pr-4 sm:scroll-pl-6 sm:scroll-pr-6 lg:scroll-pl-8 lg:scroll-pr-8
          ${hasSingleBoard ? "overflow-x-hidden" : "overflow-x-auto snap-x snap-mandatory"}
        `}
      >
        <div
          className={`
            flex h-full items-stretch gap-8 px-4 pb-4 pt-4 sm:px-6 lg:gap-10 lg:px-8 lg:pb-5 lg:pt-11
            ${hasSingleBoard ? "min-w-0 justify-center" : "min-w-max"}
            ${railClassName}
          `}
        >
          {items.map((child, index) => (
            <div
              key={index}
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
