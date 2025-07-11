"use client";

import React, { useState, useRef, useMemo } from "react";
import { BRAZIL_STATE_GRID, BrazilStateTile } from "@/data/brazilStateGrid";
import { BRAZIL_REGION_STATES } from "@/data/brazilRegions";
// --- CORREÇÃO 1: Importar o hook correto e o seu tipo ---
import useAudienceRegionSummary, { StateBreakdown } from "@/hooks/useCreatorRegionSummary";

const TILE_SIZE = 32;
const COLORS = ["#fee5d9", "#fcae91", "#fb6a4a", "#de2d26", "#a50f15"];

function getColor(value: number, max: number): string {
  if (max === 0 || value === 0) return COLORS[0]!; 
  const idx = Math.min(COLORS.length - 1, Math.floor((value / max) * COLORS.length));
  return COLORS[idx]!; 
}

const gridDimensions = {
  width: BRAZIL_STATE_GRID.length > 0 ? Math.max(...BRAZIL_STATE_GRID.map(t => t.col)) + 1 : 0,
  height: BRAZIL_STATE_GRID.length > 0 ? Math.max(...BRAZIL_STATE_GRID.map(t => t.row)) + 1 : 0,
};

export default function CreatorRegionHeatmap() {
  // --- CORREÇÃO 2: Remover estados de filtros antigos ---
  const [region, setRegion] = useState<string>("");
  
  // --- CORREÇÃO 3: Chamar o hook com as opções corretas ---
  const { data, loading, error } = useAudienceRegionSummary({
    region,
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; state: StateBreakdown } | null>(null);

  const maxCount = useMemo(() => Math.max(0, ...Object.values(data || {}).map(d => d.count)), [data]);
  const hasData = useMemo(() => Object.keys(data || {}).length > 0, [data]);

  return (
    <div ref={containerRef} className="relative bg-white p-4 rounded-lg shadow-md border border-gray-200">
      {/* --- CORREÇÃO 4: Atualizar o título --- */}
      <h3 className="text-md font-semibold text-gray-700 mb-2">Distribuição da Audiência por Estado</h3>
      
      {/* --- CORREÇÃO 5: Remover a UI dos filtros antigos --- */}
      <div className="flex items-end space-x-2 mb-4 flex-wrap gap-y-2">
        <select 
          className="border p-1 text-sm rounded" 
          value={region} 
          onChange={e => setRegion(e.target.value)}
          aria-label="Filtrar por região"
        >
          <option value="">Todas as Regiões</option>
          {Object.keys(BRAZIL_REGION_STATES).map(r => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
      </div>
      {loading && <p className="text-center text-sm text-gray-500">Carregando mapa de audiência...</p>}
      {!loading && error && <p className="text-center text-sm text-red-500">Erro: {error}</p>}
      {!loading && hasData ? (
        <svg
          width={TILE_SIZE * gridDimensions.width}
          height={TILE_SIZE * gridDimensions.height}
          onMouseLeave={() => setTooltip(null)}
          className="mx-auto"
        >
          {BRAZIL_STATE_GRID.map((tile: BrazilStateTile) => {
            const stateData = data?.[tile.id];
            const fill = stateData ? getColor(stateData.count, maxCount) : "#f0f0f0";
            const x = tile.col * TILE_SIZE;
            const y = tile.row * TILE_SIZE;
            return (
              <g key={tile.id}>
                <rect
                  x={x}
                  y={y}
                  width={TILE_SIZE - 2}
                  height={TILE_SIZE - 2}
                  fill={fill}
                  stroke="#ccc"
                  onMouseEnter={(e: React.MouseEvent<SVGRectElement>) => {
                    if (stateData && containerRef.current) {
                      const tileRect = e.currentTarget.getBoundingClientRect();
                      const containerRect = containerRef.current.getBoundingClientRect();
                      setTooltip({
                        x: tileRect.left - containerRect.left + tileRect.width / 2,
                        y: tileRect.top - containerRect.top,
                        state: stateData,
                      });
                    }
                  }}
                />
                <text
                  x={x + TILE_SIZE / 2}
                  y={y + TILE_SIZE / 2}
                  textAnchor="middle"
                  dominantBaseline="central"
                  className="text-[10px] pointer-events-none select-none"
                >
                  {tile.id}
                </text>
              </g>
            );
          })}
        </svg>
      ) : (
        !loading && !error && <p className="text-center text-sm text-gray-500">Sem dados de audiência para os filtros selecionados.</p>
      )}
      {tooltip && (
        <div
          className="absolute bg-white text-xs shadow-md border rounded p-2 pointer-events-none z-10"
          style={{ left: tooltip.x, top: tooltip.y, transform: 'translate(-50%, -110%)' }}
        >
          {/* --- CORREÇÃO 6: Atualizar texto do tooltip --- */}
          <div className="font-semibold mb-1">{tooltip.state.state}</div>
          <div>Total de Seguidores: {tooltip.state.count.toLocaleString('pt-BR')}</div>
          <div className="max-h-48 overflow-y-auto mt-2 border-t pt-1">
            {Object.entries(tooltip.state.cities).map(([city, info]) => (
              <div key={city} className="mt-1">
                <div className="font-semibold">{city}: {info.count.toLocaleString('pt-BR')}</div>
                <div className="pl-2 text-gray-600">{`M: ${info.gender.male || 0} F: ${info.gender.female || 0} O: ${info.gender.other || 0}`}</div>
                <div className="pl-2 flex flex-wrap gap-1 mt-1">
                  {Object.entries(info.age).map(([group, c]) => (
                    <span key={group} className="text-[10px] bg-gray-100 px-1 rounded">{group}: {c}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
