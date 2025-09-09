import React from 'react';

export function SkeletonBlock({ className = '' }: { className?: string }) {
  return <div className={`bg-gray-100 rounded animate-pulse ${className}`} />;
}

export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  return (
    <div className="border border-gray-200 rounded-xl p-4">
      <SkeletonBlock className="h-4 w-36 mb-2" />
      {Array.from({ length: lines }).map((_, i) => (
        <SkeletonBlock key={i} className={`h-3 ${i === 0 ? 'w-3/4' : 'w-full'} mb-2`} />
      ))}
    </div>
  );
}

export function SkeletonGrid({ count = 2 }: { count?: number }) {
  return (
    <div className="grid md:grid-cols-2 gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}

