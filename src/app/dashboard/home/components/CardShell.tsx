// src/app/dashboard/home/components/CardShell.tsx
// Contêiner base compartilhado pelos cards da Home.

"use client";

import React from "react";

function cn(...classes: Array<string | undefined | false | null>) {
  return classes.filter(Boolean).join(" ");
}

interface CardShellProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  icon?: React.ReactNode;
  description?: React.ReactNode;
  badge?: React.ReactNode;
  footer?: React.ReactNode;
  loading?: boolean;
  emptyState?: React.ReactNode;
  children?: React.ReactNode;
}

function CardSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      <div className="h-3 w-1/2 animate-pulse rounded-full bg-slate-200" />
      <div className="h-3 w-3/4 animate-pulse rounded-full bg-slate-200" />
      <div className="h-3 w-2/5 animate-pulse rounded-full bg-slate-200" />
    </div>
  );
}

const CardShell = React.forwardRef<HTMLDivElement, CardShellProps>(function CardShell(
  { title, icon, description, badge, footer, loading, emptyState, children, className, ...rest },
  ref
) {
  const hasContent = Boolean(children);
  const shouldShowContent = !loading && hasContent;
  const shouldShowEmpty = !loading && !hasContent && emptyState;

  return (
    <section
      ref={ref}
      className={cn(
        "relative flex flex-col rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-sm backdrop-blur transition-shadow duration-200 hover:shadow-md focus-within:shadow-md",
        className
      )}
      {...rest}
    >
      <header className="flex items-start gap-3">
        {icon ? (
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-brand-purple/10 text-lg text-brand-purple">
            {icon}
          </span>
        ) : null}

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <h3 className="text-base font-semibold text-slate-900">{title}</h3>
            {badge ? <span className="text-xs font-medium text-slate-500">{badge}</span> : null}
          </div>
          {description ? <p className="mt-1 text-sm text-slate-600">{description}</p> : null}
        </div>
      </header>

      <div className="mt-3 space-y-3">
        {loading ? <CardSkeleton /> : null}
        {shouldShowContent ? children : null}
        {shouldShowEmpty ? <div className="text-sm text-slate-500">{emptyState}</div> : null}
      </div>

      {footer ? <footer className="mt-4 flex flex-wrap gap-2">{footer}</footer> : null}
    </section>
  );
});

export default CardShell;
