"use client";

import dynamic from 'next/dynamic';
import type { PlannerClientPageProps } from './PlannerClientPageSurface';

function PlannerClientPageSkeleton() {
  return (
    <div className="min-h-0 bg-transparent">
      <div className="py-3 sm:py-4">
        <div className="mb-3 sm:mb-5">
          <p className="dashboard-muted-label mb-2">Planejamento</p>
          <h1 className="text-2xl font-semibold leading-tight tracking-[-0.03em] text-zinc-950 sm:text-[30px]">Planejador de Conteúdo</h1>
          <p className="mt-1.5 text-[15px] leading-6 text-zinc-500">Carregando calendário...</p>
        </div>
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {[1, 2, 3, 4].map((row) => (
            <div
              key={`planner-shell-loading-${row}`}
              className={[
                'animate-pulse rounded-[24px] border border-zinc-100/80 bg-zinc-50/80 p-4 shadow-[0_12px_28px_rgba(24,24,27,0.03)] backdrop-blur-xl',
                row > 2 ? 'hidden xl:block' : '',
              ].join(' ')}
            >
              <div className="mb-3 h-11 w-56 rounded-xl bg-slate-100" />
              <div className="mb-3 h-9 w-full rounded-xl bg-slate-100" />
              <div className="grid grid-cols-2 gap-2">
                {Array.from({ length: 4 }).map((_, index) => (
                  <span key={`planner-shell-loading-${row}-${index}`} className="h-8 rounded-lg bg-slate-100" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const PlannerClientPageSurface = dynamic(
  () => import('./PlannerClientPageSurface').then((mod) => mod.PlannerClientPageSurface),
  {
    ssr: false,
    loading: () => <PlannerClientPageSkeleton />,
  }
);

export default function PlannerClientPage(props: PlannerClientPageProps) {
  return <PlannerClientPageSurface {...props} />;
}
