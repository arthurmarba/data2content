"use client";

export default function ContentAnalysisHistoryError({ reset }: { reset: () => void }) {
  return (
    <main className="grid min-h-dvh place-items-center bg-white px-6 text-center">
      <div>
        <h1 className="font-display text-xl font-bold tracking-[-0.03em] text-zinc-950">Não foi possível abrir suas análises.</h1>
        <p className="mt-2 text-sm text-zinc-500">Sua informação continua salva. Tente carregar novamente.</p>
        <button type="button" onClick={reset} className="mt-5 min-h-11 rounded-xl bg-zinc-950 px-5 text-sm font-bold text-white">
          Tentar novamente
        </button>
      </div>
    </main>
  );
}
