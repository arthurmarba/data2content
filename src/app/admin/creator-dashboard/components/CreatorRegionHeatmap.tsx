"use client";

import React, { useState, useRef, useMemo } from "react";
import { BRAZIL_STATE_GRID, BrazilStateTile } from "@/data/brazilStateGrid";
import { BRAZIL_REGION_STATES } from "@/data/brazilRegions";
import useCreatorRegionSummary, { StateBreakdown } from "@/hooks/useCreatorRegionSummary";


const TILE_SIZE = 32;
const COLORS = ["#fee5d9", "#fcae91", "#fb6a4a", "#de2d26", "#a50f15"];

function getColor(value: number, max: number) {
  if (max === 0) return COLORS[0];
  const idx = Math.min(COLORS.length - 1, Math.floor((value / max) * COLORS.length));
  return COLORS[idx];
}

export default function CreatorRegionHeatmap() {
  const [gender, setGender] = useState("");
  const [region, setRegion] = useState("");
  const [minAge, setMinAge] = useState("");
  const [maxAge, setMaxAge] = useState("");
  const { data = {}, loading, error, refresh } = useCreatorRegionSummary({
    gender,
    region,
    minAge,
    maxAge,
  });
  const containerRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number; state: StateBreakdown } | null>(null);

  const handleApplyFilters = () => {
    refresh();
  };

  const maxCount = useMemo(() => Math.max(0, ...Object.values(data).map(d => d.count)), [data]);
  const hasData = useMemo(() => Object.keys(data).length > 0, [data]);

  return (
    <div ref={containerRef} className="relative bg-white p-4 rounded-lg shadow-md border border-gray-200">
      <h3 className="text-md font-semibold text-gray-700 mb-2">Distribui\u00E7\u00E3o de Criadores</h3>
      <div className="flex items-end space-x-2 mb-4">
        <select className="border p-1 text-sm" value={region} onChange={e => setRegion(e.target.value)}>
          <option value="">Todas as Regiões</option>
          {Object.keys(BRAZIL_REGION_STATES).map(r => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
        <select className="border p-1 text-sm" value={gender} onChange={e => setGender(e.target.value)}>
          <option value="">Todos os G\u00EAneros</option>
          <option value="male">Masculino</option>
          <option value="female">Feminino</option>
          <option value="other">Outro</option>
        </select>
        <input type="number" className="border p-1 text-sm w-20" placeholder="Idade min" value={minAge} onChange={e => setMinAge(e.target.value)} />
        <input type="number" className="border p-1 text-sm w-20" placeholder="Idade max" value={maxAge} onChange={e => setMaxAge(e.target.value)} />
        <button
          onClick={handleApplyFilters}
          className="px-3 py-1 bg-indigo-600 text-white rounded text-sm hover:bg-indigo-700"
        >
          Aplicar
        </button>
        <button
          onClick={() => {
            setGender("");
            setRegion("");
            setMinAge("");
            setMaxAge("");
            refresh();
          }}
          className="px-3 py-1 bg-gray-200 text-gray-700 rounded text-sm hover:bg-gray-300"
        >
          Limpar
        </button>
      </div>
      {loading && (
        <p className="text-center text-sm text-gray-500">Carregando...</p>
      )}
      {!loading && error && (
        <p className="text-center text-sm text-red-500">Erro: {error}</p>
      )}
      {!loading && hasData ? (
        <svg
          width={TILE_SIZE * 9}
          height={TILE_SIZE * 11}
          onMouseLeave={() => setTooltip(null)}
          className="mx-auto"
        >
          {BRAZIL_STATE_GRID.map((tile: BrazilStateTile) => {
            const stateData = data[tile.id];
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
                  onMouseEnter={e => {
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
        !loading && !error && (
          <p className="text-center text-sm text-gray-500">Sem dados para os filtros selecionados.</p>
        )
      )}
      {tooltip && (
        <div
          className="absolute bg-white text-xs shadow-md border rounded p-2"
          style={{ left: tooltip.x, top: tooltip.y - 10 }}
        >
          <div className="font-semibold mb-1">{tooltip.state.state}</div>
          <div>Total: {tooltip.state.count}</div>
          <div className="max-h-48 overflow-y-auto">
          {Object.entries(tooltip.state.cities).map(([city, info]) => (
            <div key={city} className="mt-1">
              <div className="font-semibold">{city}: {info.count}</div>
              <div className="pl-2">{`M: ${info.gender.male || 0} F: ${info.gender.female || 0} O: ${info.gender.other || 0}`}</div>
              <div className="pl-2 flex flex-wrap gap-1">
                {Object.entries(info.age).map(([group, c]) => (
                  <span key={group}>{group}:{c}</span>
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
