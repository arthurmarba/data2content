// src/app/dashboard/home/minimal/MinimalSkeleton.tsx

"use client";

import React from "react";

function SkeletonBlock({ lines = 3, className = "" }: { lines?: number; className?: string }) {
  return (
    <div className={`rounded-2xl border border-slate-200 bg-white p-6 shadow-sm ${className}`}>
      <div className="h-5 w-40 animate-pulse rounded bg-slate-200" />
      <div className="mt-4 space-y-3">
        {Array.from({ length: lines }).map((_, index) => (
          <div key={index} className="h-4 w-full animate-pulse rounded bg-slate-200" />
        ))}
      </div>
    </div>
  );
}

export default function MinimalSkeleton() {
  return (
    <div className="grid w-full grid-cols-1 gap-6 pb-8 lg:grid-cols-2 xl:grid-cols-3">
      <SkeletonBlock className="xl:col-span-3" lines={6} />
      <SkeletonBlock className="lg:col-span-2 xl:col-span-2" lines={5} />
      <SkeletonBlock className="lg:col-span-2 xl:col-span-1" lines={4} />
      <SkeletonBlock lines={3} />
    </div>
  );
}
