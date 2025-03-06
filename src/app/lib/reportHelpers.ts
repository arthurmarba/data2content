// src/app/lib/reportHelpers.ts

import { DailyMetric } from "@/app/models/DailyMetric";

/**
 * Estrutura de retorno principal: 
 * Ajuste conforme os dados que quer repassar ao seu prompt de IA.
 */
export interface AggregatedReport {
  top3: DailyMetric[];           // Top 3 conteúdos (por ex., com base em compartilhamentos)
  bottom3: DailyMetric[];        // Piores 3 conteúdos
  dayOfWeekStats: DayOfWeekStat[];
  durationStats: DurationStat[];
  // ... outros campos que quiser retornar
}

export interface DayOfWeekStat {
  dayName: string;        // Ex.: "Segunda", "Terça"...
  averageShares: number;  // ou engajamento, etc.
  totalPosts: number;
}

export interface DurationStat {
  range: string;          // Ex.: "0–14s", "15–29s"
  contentCount: number;
  averageShares: number;
}

/**
 * buildAggregatedReport:
 * Recebe um array de DailyMetric (p.ex., dos últimos 7 dias)
 * e retorna um objeto com top3, bottom3, estatísticas de dia da semana,
 * faixas de duração etc.
 */
export function buildAggregatedReport(dailyMetrics: DailyMetric[]): AggregatedReport {
  if (!dailyMetrics || dailyMetrics.length === 0) {
    // Retorna algo vazio se não houver métricas
    return {
      top3: [],
      bottom3: [],
      dayOfWeekStats: [],
      durationStats: [],
    };
  }

  // 1) Cálculo de "score" para definir top/bottom 3
  //    Exemplo: usar "compartilhamentos" (stats.compartilhamentos) como critério.
  //    Se quiser usar engajamento ou curtidas, ajuste aqui.
  const sortedByShares = [...dailyMetrics].sort((a, b) => {
    const aShares = a.stats.compartilhamentos || 0;
    const bShares = b.stats.compartilhamentos || 0;
    return bShares - aShares; // decrescente
  });

  const top3 = sortedByShares.slice(0, 3);
  const bottom3 = sortedByShares.slice(-3).reverse(); // últimos 3, invertendo a ordem

  // 2) Estatísticas de dia da semana
  //    Agrupa dailyMetrics por dayOfWeek, soma "compartilhamentos" e conta posts.
  const dayMap: Record<string, { totalShares: number; count: number }> = {};
  for (const dm of dailyMetrics) {
    const date = dm.postDate;
    const dayOfWeek = date.getDay(); 
    // 0=Domingo, 1=Segunda... ou use getDayName se quiser nomes

    if (!dayMap[dayOfWeek]) {
      dayMap[dayOfWeek] = { totalShares: 0, count: 0 };
    }
    dayMap[dayOfWeek].totalShares += (dm.stats.compartilhamentos || 0);
    dayMap[dayOfWeek].count += 1;
  }

  // Converte dayMap em array ordenado por dayOfWeek
  const dayOfWeekStats: DayOfWeekStat[] = Object.entries(dayMap).map(([dow, data]) => {
    const average = data.count > 0 ? data.totalShares / data.count : 0;
    return {
      dayName: mapDayOfWeek(Number(dow)), // converte 0->"Domingo", 1->"Segunda" etc.
      averageShares: average,
      totalPosts: data.count,
    };
  });

  // 3) Estatísticas de duração
  //    Exemplo: agrupa em faixas 0–14, 15–29, 30–39, 60–74, etc.
  const durations = [ 
    { range: "0–14s", min: 0, max: 14 },
    { range: "15–29s", min: 15, max: 29 },
    { range: "30–39s", min: 30, max: 39 },
    { range: "40–59s", min: 40, max: 59 }, 
    { range: "60–74s", min: 60, max: 74 },
    // ... adicione outras faixas se quiser
  ];

  const durationStats: DurationStat[] = durations.map((dur) => {
    let totalShares = 0;
    let count = 0;
    for (const dm of dailyMetrics) {
      const avgDuration = dm.stats.mediaDuracao || 0; // ou tempoMedioVisualizacao, etc.
      if (avgDuration >= dur.min && avgDuration <= dur.max) {
        totalShares += (dm.stats.compartilhamentos || 0);
        count++;
      }
    }
    const avg = count > 0 ? totalShares / count : 0;
    return {
      range: dur.range,
      contentCount: count,
      averageShares: avg,
    };
  });

  // 4) Monta objeto final
  return {
    top3,
    bottom3,
    dayOfWeekStats,
    durationStats,
  };
}

/**
 * Exemplo simples de conversão de dayOfWeek (0 a 6) para nomes em português.
 * Ajuste conforme sua necessidade.
 */
function mapDayOfWeek(dow: number): string {
  const names = [
    "Domingo",
    "Segunda-Feira",
    "Terça-Feira",
    "Quarta-Feira",
    "Quinta-Feira",
    "Sexta-Feira",
    "Sábado",
  ];
  return names[dow] || "Desconhecido";
}
