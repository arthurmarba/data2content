import Link from "next/link";

export default function AnalysisNotFound() {
  return (
    <main className="grid min-h-dvh place-items-center bg-white px-6 text-center">
      <div>
        <h1 className="font-display text-xl font-bold tracking-[-0.03em] text-zinc-950">Análise não encontrada.</h1>
        <p className="mt-2 text-sm text-zinc-500">Ela pode não pertencer a esta conta ou não estar mais disponível.</p>
        <Link href="/dashboard/boards/mobile-strategic-profile/settings/analyses" className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-zinc-950 px-5 text-sm font-bold text-white">
          Ver últimas análises
        </Link>
      </div>
    </main>
  );
}
