"use client";

import React, { useState, useMemo, useCallback } from "react";
import { ComposableMap, Geographies, Geography } from "react-simple-maps";
import useCreatorRegionSummary, { StateBreakdown } from "@/hooks/useCreatorRegionSummary";
import { BRAZIL_REGION_STATES } from "@/data/brazilRegions";

const BRAZIL_GEO_URL = "https://raw.githubusercontent.com/codeforamerica/click_that_hood/master/public/data/brazil-states.geojson";
const COLORS = ["#f7f7f7", "#fee5d9", "#fcae91", "#fb6a4a", "#de2d26", "#a50f15"];

function getHeatmapColor(value: number, max: number): string {
  if (max === 0 || value === 0) return COLORS[0]!;
  
  const percentage = value / max;
  const colorIndex = Math.ceil(percentage * (COLORS.length - 1));
  const finalIndex = Math.min(colorIndex, COLORS.length - 1);

  return COLORS[finalIndex]!;
}

export default function CreatorBrazilMap() {
  const [gender, setGender] = useState<string>("");
  const [region, setRegion] = useState<string>("");
  const [minAge, setMinAge] = useState<string>("");
  const [maxAge, setMaxAge] = useState<string>("");
  
  const [tooltipContent, setTooltipContent] = useState<StateBreakdown | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });

  const { data, loading, error, refresh } = useCreatorRegionSummary({
    gender,
    region,
    minAge,
    maxAge,
  });

  const handleApplyFilters = useCallback(() => {
    refresh();
  }, [refresh]);

  const handleClearFilters = useCallback(() => {
    setGender("");
    setRegion("");
    setMinAge("");
    setMaxAge("");
    refresh();
  }, [refresh]);

  // --- LINHA CORRIGIDA ---
  const maxCount = useMemo(() => Math.max(0, ...Object.values(data || {}).map(d => d.count)), [data]);

  const handleMouseMove = useCallback((evt: React.MouseEvent) => {
    setTooltipPosition({ x: evt.clientX, y: evt.clientY });
  }, []);

  return (
    <div className="relative bg-white p-4 rounded-lg shadow-md border border-gray-200" onMouseMove={handleMouseMove}>
      <h3 className="text-md font-semibold text-gray-700 mb-2">Distribuição de Criadores por Estado</h3>
      
      <div className="flex items-end space-x-2 mb-4 flex-wrap gap-y-2">
        <select className="border p-1 text-sm rounded" value={region} onChange={e => setRegion(e.target.value)}>
          <option value="">Todas as Regiões</option>
          {Object.keys(BRAZIL_REGION_STATES).map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <select className="border p-1 text-sm rounded" value={gender} onChange={e => setGender(e.target.value)}>
          <option value="">Todos os Gêneros</option>
          <option value="male">Masculino</option>
          <option value="female">Feminino</option>
          <option value="other">Outro</option>
        </select>
        <input type="number" className="border p-1 text-sm w-20 rounded" placeholder="Idade min" value={minAge} onChange={e => setMinAge(e.target.value)} />
        <input type="number" className="border p-1 text-sm w-20 rounded" placeholder="Idade max" value={maxAge} onChange={e => setMaxAge(e.target.value)} />
        <button onClick={handleApplyFilters} className="px-3 py-1 bg-indigo-600 text-white rounded text-sm hover:bg-indigo-700">
          Aplicar
        </button>
        <button onClick={handleClearFilters} className="px-3 py-1 bg-gray-200 text-gray-700 rounded text-sm hover:bg-gray-300">
          Limpar
        </button>
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
                const stateData = data?.[stateId]; // Usar optional chaining aqui é uma boa prática
                return (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    fill={getHeatmapColor(stateData?.count || 0, maxCount)}
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
      {!loading && !error && Object.keys(data || {}).length === 0 && ( // Adicionado `|| {}` aqui também por segurança
        <p className="text-center text-sm text-gray-500 pt-4">Sem dados para os filtros selecionados.</p>
      )}

      {tooltipContent && (
        <div
          className="fixed bg-white text-xs shadow-lg border rounded p-3 pointer-events-none z-50 transition-opacity"
          style={{ left: tooltipPosition.x + 15, top: tooltipPosition.y + 15, minWidth: '200px' }}
        >
          <h4 className="font-bold text-sm mb-2">{tooltipContent.state} ({tooltipContent.count} criadores)</h4>
          <div className="max-h-48 overflow-y-auto">
            {Object.entries(tooltipContent.cities).length > 0 ? (
                Object.entries(tooltipContent.cities)
                    .sort(([, a], [, b]) => b.count - a.count)
                    .map(([city, info]) => (
                <div key={city} className="mt-1.5 border-t pt-1.5 first:border-t-0 first:pt-0">
                  <div className="font-semibold">{city}: {info.count}</div>
                  <div className="pl-2 text-gray-600">{`Masc: ${info.gender.male || 0}, Fem: ${info.gender.female || 0}, Outro: ${info.gender.other || 0}`}</div>
                  {Object.keys(info.age).length > 0 && 
                    <div className="pl-2 flex flex-wrap gap-x-2 gap-y-1 text-gray-500 mt-1">
                        {Object.entries(info.age).map(([group, c]) => (
                        <span key={group} className="text-[10px] bg-gray-100 px-1 rounded">{group}: {c}</span>
                        ))}
                    </div>
                  }
                </div>
              ))
            ) : (
                <p className="text-gray-500">Nenhuma cidade detalhada.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}