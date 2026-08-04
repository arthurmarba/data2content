import type React from "react";

export default function DesktopWorkspaceHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  actions?: React.ReactNode;
}) {
  return (
    <header className="flex shrink-0 items-end justify-between gap-8 pb-5 pt-5 lg:pb-6 lg:pt-7">
      <div className="min-w-0">
        {eyebrow ? (
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-rose-600">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="mt-1 text-[clamp(1.75rem,2.3vw,2.4rem)] font-semibold leading-tight tracking-[-0.045em] text-zinc-950">
          {title}
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600">
          {description}
        </p>
      </div>
      {actions ? <div className="hidden shrink-0 items-center gap-3 lg:flex">{actions}</div> : null}
    </header>
  );
}
