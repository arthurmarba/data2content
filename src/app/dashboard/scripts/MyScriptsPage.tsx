"use client";

import dynamic from "next/dynamic";
import type { MyScriptsPageProps } from "./MyScriptsPageSurface";

function MyScriptsPageSkeleton() {
  return (
    <div className="min-h-0 bg-transparent">
      <div className="px-3.5 pb-3 pt-1.5 sm:px-4 sm:py-2">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-5">
          {Array.from({ length: 6 }).map((_, idx) => (
            <div
              key={`scripts-shell-loading-${idx}`}
              className="dashboard-panel animate-pulse h-52 rounded-[1.5rem] sm:h-80 sm:rounded-[2rem]"
            >
              <div className="h-11 border-b border-zinc-100 bg-zinc-50/70" />
              <div className="p-5">
                <div className="h-4 w-2/3 rounded bg-zinc-100" />
                <div className="mt-3 h-3 w-full rounded bg-zinc-100/80" />
                <div className="mt-2 h-3 w-4/5 rounded bg-zinc-100/70" />
                <div className="mt-2 h-3 w-3/4 rounded bg-zinc-100/60" />
              </div>
              <div className="mx-5 mt-6 h-10 rounded-xl bg-zinc-50" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const MyScriptsPageSurface = dynamic(
  () => import("./MyScriptsPageSurface").then((mod) => mod.MyScriptsPageSurface),
  {
    ssr: false,
    loading: () => <MyScriptsPageSkeleton />,
  }
);

export default function MyScriptsPage(props: MyScriptsPageProps) {
  return <MyScriptsPageSurface {...props} />;
}
