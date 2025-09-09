import React, { useMemo } from 'react';

type Bucket = { dayOfWeek: number; hour: number; avg: number; count: number };

interface HeatmapProps {
  buckets: Bucket[];
}

// Simple 7x24 heatmap from buckets; normalizes by max avg to color intensity
export default function Heatmap({ buckets }: HeatmapProps) {
  const grid = useMemo(() => {
    const map = new Map<string, Bucket>();
    let max = 0;
    for (const b of buckets || []) {
      const key = `${b.dayOfWeek}-${b.hour}`;
      map.set(key, b);
      if (typeof b.avg === 'number' && isFinite(b.avg)) {
        max = Math.max(max, b.avg);
      }
    }
    return { map, max };
  }, [buckets]);

  const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  function colorFor(val: number) {
    if (!grid.max || grid.max <= 0) return 'bg-gray-50';
    const ratio = Math.min(1, Math.max(0, val / grid.max));
    // interpolate from gray-50 to emerald-500
    if (ratio === 0) return 'bg-gray-50';
    if (ratio < 0.25) return 'bg-emerald-100';
    if (ratio < 0.5) return 'bg-emerald-200';
    if (ratio < 0.75) return 'bg-emerald-300';
    return 'bg-emerald-400';
  }

  return (
    <div className="overflow-x-auto">
      <div className="inline-grid" style={{ gridTemplateColumns: `60px repeat(24, 1fr)` }}>
        <div />
        {Array.from({ length: 24 }).map((_, h) => (
          <div key={`h-${h}`} className="text-[10px] text-gray-500 text-center px-1 py-0.5">
            {h}h
          </div>
        ))}
        {Array.from({ length: 7 }).map((_, dIdx) => {
          const day = ((dIdx + 1 - 1 + 1) % 7) + 1; // keep 1..7
          return (
            <React.Fragment key={`d-${day}`}>
              <div className="text-[11px] text-gray-600 px-1 py-1">{dayNames[dIdx]}</div>
              {Array.from({ length: 24 }).map((_, h) => {
                const b = grid.map.get(`${day}-${h}`);
                const val = b?.avg ?? 0;
                const title = b ? `${dayNames[dIdx]} ${h}h — média: ${val.toFixed(1)} · n=${b.count}` : `${dayNames[dIdx]} ${h}h — sem dados`;
                return (
                  <div key={`c-${day}-${h}`} title={title} className={`w-6 h-4 sm:w-7 sm:h-5 md:w-8 md:h-6 border border-white ${colorFor(val)}`} />
                );
              })}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}

