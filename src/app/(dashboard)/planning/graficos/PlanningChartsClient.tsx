"use client";

import NextDynamic from "next/dynamic";

const PlanningChartsPage = NextDynamic(
  () => import("@/app/dashboard/planning/PlanningChartsPage"),
  {
    ssr: false,
    loading: () => <PlanningChartsRouteSkeleton />,
  },
);

function PlanningChartsRouteSkeleton() {
  return (
    <div className="px-2 pb-6 pt-2 lg:px-0">
      <div className="overflow-hidden rounded-[1.8rem] border border-zinc-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,248,249,0.94))]">
        <div className="sticky top-0 z-10 border-b border-zinc-100/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(255,255,255,0.94))] px-3 py-3">
          <div className="h-10 w-full animate-pulse rounded-full bg-zinc-100" />
        </div>
        <div className="space-y-3 px-3 py-4 sm:px-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="h-28 animate-pulse rounded-[1.4rem] bg-zinc-100" />
            <div className="h-28 animate-pulse rounded-[1.4rem] bg-zinc-100" />
          </div>
          <div className="h-[320px] animate-pulse rounded-[1.6rem] bg-zinc-100" />
          <div className="grid gap-3">
            <div className="h-24 animate-pulse rounded-[1.35rem] bg-zinc-100" />
            <div className="h-24 animate-pulse rounded-[1.35rem] bg-zinc-100" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default PlanningChartsPage;
