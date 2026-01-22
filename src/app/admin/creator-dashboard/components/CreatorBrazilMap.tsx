/*
 * =============================================================================
 * ARQUIVO 1: src/app/admin/creator-dashboard/components/CreatorBrazilMap.tsx
 * =============================================================================
 */
"use client";

import React, { useState, useMemo, useCallback } from "react";
import { ComposableMap, Geographies, Geography } from "react-simple-maps";
// O nome do hook foi atualizado para refletir a sua função
import useAudienceRegionSummary, { StateBreakdown } from "@/hooks/useCreatorRegionSummary";
import { BRAZIL_REGION_STATES } from "@/data/brazilRegions";

const BRAZIL_GEO_URL = "https://raw.githubusercontent.com/codeforamerica/click_that_hood/master/public/data/brazil-states.geojson";
const COLORS = ["#eff3ff", "#bdd7e7", "#6baed6", "#3182bd", "#08519c"];

function getHeatmapColor(value: number, max: number): string {
  if (max === 0 || value === 0) return "#f7fafc";

  const percentage = value / max;
  const colorIndex = Math.floor(percentage * (COLORS.length - 1));
  const finalIndex = Math.min(colorIndex, COLORS.length - 1);

  return COLORS[finalIndex]!;
}

const MapLegend: React.FC<{ mode: 'count' | 'density' }> = ({ mode }) => (
  <div className="flex items-center justify-center mt-4 space-x-3 text-xs text-gray-600">
    <span>{mode === 'count' ? 'Menos Seguidores' : 'Menor Densidade'}</span>
    <div className="flex border border-gray-200 rounded-sm overflow-hidden">
      {COLORS.map((color) => (
        <div key={color} style={{ backgroundColor: color, width: '24px', height: '16px' }} />
      ))}
    </div>
    <span>{mode === 'count' ? 'Mais Seguidores' : 'Maior Densidade'}</span>
  </div>
);

export default function CreatorBrazilMap({ apiPrefix = '/api/admin', userId }: { apiPrefix?: string; userId?: string }) {
  // --- PASSO 1: Adicionar estados para os novos filtros ---
  const [region, setRegion] = useState<string>("");
  const [gender, setGender] = useState<string>("");
  const [ageRange, setAgeRange] = useState<string>("");
  const [viewMode, setViewMode] = useState<'count' | 'density'>('count');

  const [tooltipContent, setTooltipContent] = useState<StateBreakdown | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });

  // --- PASSO 2: Passar os novos filtros para o hook ---
  const { data, loading, error } = useAudienceRegionSummary({
    region,
    gender,
    ageRange,
    userId,
    apiPrefix,
  });

  const { maxCount, maxDensity } = useMemo(() => {
    const values = Object.values(data || {});
    if (values.length === 0) return { maxCount: 0, maxDensity: 0 };
    const maxCount = Math.max(0, ...values.map(d => d.count || 0));
    const maxDensity = Math.max(0, ...values.map(d => d.density || 0));
    return { maxCount, maxDensity };
  }, [data]);

  const handleMouseMove = useCallback((evt: React.MouseEvent) => {
    setTooltipPosition({ x: evt.clientX, y: evt.clientY });
  }, []);

  return (
    <div className="relative rounded-2xl border border-slate-200 bg-white px-5 py-5 shadow-sm" onMouseMove={handleMouseMove}>
      <div className="flex justify-between items-start mb-2">
        <h3 className="text-base font-semibold text-slate-900">Distribuição da Audiência por Estado</h3>
        <div className="flex items-center space-x-1 rounded-md bg-gray-100 p-1">
          <button onClick={() => setViewMode('count')} className={`px-2 py-1 text-xs rounded-md transition-colors ${viewMode === 'count' ? 'bg-white shadow-sm' : 'bg-transparent text-gray-500 hover:bg-gray-200'}`}>Absoluto</button>
          <button onClick={() => setViewMode('density')} className={`px-2 py-1 text-xs rounded-md transition-colors ${viewMode === 'density' ? 'bg-white shadow-sm' : 'bg-transparent text-gray-500 hover:bg-gray-200'}`}>Densidade</button>
        </div>
      </div>

      {/* --- PASSO 3: Adicionar os novos seletores de filtro à UI --- */}
      <div className="flex items-end space-x-2 mb-4 flex-wrap gap-y-2">
        <select className="border p-1 text-sm rounded" value={region} onChange={e => setRegion(e.target.value)}>
          <option value="">Todas as Regiões</option>
          {Object.keys(BRAZIL_REGION_STATES).map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <select className="border p-1 text-sm rounded" value={gender} onChange={e => setGender(e.target.value)}>
          <option value="">Todos os Gêneros</option>
          <option value="F">Feminino</option>
          <option value="M">Masculino</option>
          <option value="U">Desconhecido</option>
        </select>
        <select className="border p-1 text-sm rounded" value={ageRange} onChange={e => setAgeRange(e.target.value)}>
          <option value="">Todas as Idades</option>
          <option value="13-17">13-17</option>
          <option value="18-24">18-24</option>
          <option value="25-34">25-34</option>
          <option value="35-44">35-44</option>
          <option value="45-54">45-54</option>
          <option value="55-64">55-64</option>
          <option value="65+">65+</option>
        </select>
      </div>

      {loading && <p className="text-center text-sm text-gray-500 py-4">Carregando mapa...</p>}
      {!loading && error && <p className="text-center text-sm text-red-500 py-4">Erro ao carregar dados: {error}</p>}

      <div className="border border-gray-300 rounded-md p-2">
        <ComposableMap
          projection="geoMercator"
          projectionConfig={{ scale: 750, center: [-54, -15] }}
          style={{ width: "100%", height: "auto" }}
        >
          <Geographies geography={BRAZIL_GEO_URL}>
            {({ geographies }) =>
              geographies.map(geo => {
                const stateId = geo.properties.sigla;
                const stateData = data?.[stateId];
                const value = viewMode === 'count' ? (stateData?.count || 0) : (stateData?.density || 0);
                const max = viewMode === 'count' ? maxCount : maxDensity;
                return (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    fill={getHeatmapColor(value, max)}
                    stroke="#FFF"
                    strokeWidth={0.5}
                    style={{
                      default: { outline: "none" },
                      hover: { outline: "none", fill: "#fbbf24" },
                      pressed: { outline: "none" },
                    }}
                    onMouseEnter={() => stateData && setTooltipContent(stateData)}
                    onMouseLeave={() => setTooltipContent(null)}
                  />
                );
              })
            }
          </Geographies>
        </ComposableMap>
      </div>

      <MapLegend mode={viewMode} />

      {!loading && !error && Object.keys(data || {}).length === 0 && (
        <p className="text-center text-sm text-gray-500 pt-4">Sem dados de audiência para os filtros selecionados.</p>
      )}

      {tooltipContent && (
        <div
          className="fixed bg-gray-800 text-white text-xs shadow-lg rounded-md p-3 pointer-events-none z-50 transition-opacity"
          style={{ left: tooltipPosition.x + 15, top: tooltipPosition.y + 15, minWidth: '220px' }}
        >
          <h4 className="font-bold text-sm mb-2">{tooltipContent.state}</h4>
          <div className="space-y-1">
            <div><span className="font-semibold">Seguidores:</span> {tooltipContent.count.toLocaleString('pt-BR')}</div>
            {tooltipContent.density !== undefined && (
              <div>
                <span className="font-semibold">Densidade:</span> {(tooltipContent.density * 100).toFixed(2)}%
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
