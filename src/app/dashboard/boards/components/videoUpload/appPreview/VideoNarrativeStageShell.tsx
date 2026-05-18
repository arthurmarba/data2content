import type { ReactNode } from "react";

type VideoNarrativeStageShellProps = {
  eyebrow?: string;
  title: string;
  subtitle?: string | null;
  helper?: string | null;
  children?: ReactNode;
  footer?: ReactNode;
};

export function VideoNarrativeStageShell({
  eyebrow,
  title,
  subtitle,
  helper,
  children,
  footer,
}: VideoNarrativeStageShellProps) {
  return (
    <section className="mx-auto w-full max-w-3xl rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-7">
      {eyebrow ? <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{eyebrow}</p> : null}
      <h2 className="mt-2 text-2xl font-semibold tracking-normal text-zinc-950 sm:text-3xl">{title}</h2>
      {subtitle ? <p className="mt-3 text-sm leading-6 text-zinc-700 sm:text-base">{subtitle}</p> : null}
      {helper ? <p className="mt-2 text-sm leading-6 text-zinc-500">{helper}</p> : null}
      {children ? <div className="mt-6">{children}</div> : null}
      {footer ? <footer className="mt-6 border-t border-zinc-100 pt-5">{footer}</footer> : null}
    </section>
  );
}
