"use client";

import React, { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface EffectivenessResult {
  alertType: string;
  positiveInteractionRate: number;
  totalAlerts: number;
}

export default function RadarEffectivenessWidget() {
  const [data, setData] = useState<EffectivenessResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/admin/dashboard/radar/effectiveness");
        if (!res.ok) throw new Error(`Erro ${res.status}`);
        const json = await res.json();
        setData(Array.isArray(json) ? json : []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro desconhecido");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <h3 className="text-sm font-semibold text-gray-800 mb-2">
        Eficácia do Radar Mobi
      </h3>
      {loading && <p className="text-sm text-gray-500">Carregando...</p>}
      {error && <p className="text-sm text-red-500">Erro: {error}</p>}
      {!loading && !error && data.length > 0 && (
        <div style={{ width: "100%", height: 220 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,128,0.1)" />
              <XAxis dataKey="alertType" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `${Math.round(v * 100)}%`} />
              <Tooltip formatter={(v: any) => `${(Number(v) * 100).toFixed(0)}%`} />
              <Bar dataKey="positiveInteractionRate" name="Interação" fill="var(--color-indigo-600)" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
      {!loading && !error && data.length === 0 && (
        <p className="text-sm text-gray-500">Nenhum dado disponível.</p>
      )}
    </div>
  );
}
