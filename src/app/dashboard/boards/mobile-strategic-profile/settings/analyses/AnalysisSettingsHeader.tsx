import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export function AnalysisSettingsHeader({ title, backHref }: { title: string; backHref: string }) {
  return (
    <header className="sticky top-0 z-20 border-b border-zinc-100 bg-white/95 px-4 py-3 backdrop-blur-md">
      <div className="mx-auto flex max-w-2xl items-center gap-3">
        <Link
          href={backHref}
          aria-label="Voltar"
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-zinc-700 transition hover:bg-zinc-100"
        >
          <ArrowLeft className="h-5 w-5" strokeWidth={1.8} />
        </Link>
        <h1 className="font-display text-[1.05rem] font-bold tracking-[-0.025em] text-zinc-950">{title}</h1>
      </div>
    </header>
  );
}
