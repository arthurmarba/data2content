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
    <div className="flex w-full flex-col gap-5 pb-6">
      <SkeletonBlock lines={6} />
      <SkeletonBlock lines={5} />
      <SkeletonBlock lines={4} />
      <SkeletonBlock lines={3} />
    </div>
  );
}
