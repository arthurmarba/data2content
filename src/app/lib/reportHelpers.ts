import { IDailyMetric } from "@/app/models/DailyMetric";

export interface AggregatedReport {
  top3: IDailyMetric[];           // Top 3 conteúdos (por exemplo, com base em compartilhamentos)
  bottom3: IDailyMetric[];        // Piores 3 conteúdos
  dayOfWeekStats: DayOfWeekStat[];
  durationStats: DurationStat[];
  // ... outros campos que quiser retornar
}

export interface DayOfWeekStat {
  dayName: string;        // Ex.: "Segunda-Feira", "Terça-Feira", etc.
  averageShares: number;  // Média de compartilhamentos (ou outra métrica) no dia
  totalPosts: number;
}

export interface DurationStat {
  range: string;          // Ex.: "0–14s", "15–29s"
  contentCount: number;
  averageShares: number;
}

/**
 * buildAggregatedReport:
 * Recebe um array de DailyMetric (por exemplo, dos últimos 7 dias)
 * e retorna um objeto com top3, bottom3, estatísticas de dia da semana,
 * faixas de duração etc.
 */
export function buildAggregatedReport(dailyMetrics: IDailyMetric[]): AggregatedReport {
  if (!dailyMetrics || dailyMetrics.length === 0) {
    return {
      top3: [],
      bottom3: [],
      dayOfWeekStats: [],
      durationStats: [],
    };
  }

  // 1) Ordena as métricas pelo número de compartilhamentos (decrescente)
  const sortedByShares = [...dailyMetrics].sort((a, b) => {
    const aShares = a.stats?.compartilhamentos || 0;
    const bShares = b.stats?.compartilhamentos || 0;
    return bShares - aShares;
  });

  const top3 = sortedByShares.slice(0, 3);
  const bottom3 = sortedByShares.slice(-3).reverse();

  // 2) Estatísticas de dia da semana
  const dayMap: Record<string, { totalShares: number; count: number }> = {};
  for (const dm of dailyMetrics) {
    const date = dm.postDate; // Supondo que postDate seja um Date
    const dayOfWeek = date.getDay(); // 0=Domingo, 1=Segunda, etc.
    if (!dayMap[dayOfWeek]) {
      dayMap[dayOfWeek] = { totalShares: 0, count: 0 };
    }
    dayMap[dayOfWeek].totalShares += dm.stats?.compartilhamentos || 0;
    dayMap[dayOfWeek].count += 1;
  }

  const dayOfWeekStats: DayOfWeekStat[] = Object.entries(dayMap).map(([dow, data]) => {
    const average = data.count > 0 ? data.totalShares / data.count : 0;
    return {
      dayName: mapDayOfWeek(Number(dow)),
      averageShares: average,
      totalPosts: data.count,
    };
  });

  // 3) Estatísticas de duração
  const durations = [ 
    { range: "0–14s", min: 0, max: 14 },
    { range: "15–29s", min: 15, max: 29 },
    { range: "30–39s", min: 30, max: 39 },
    { range: "40–59s", min: 40, max: 59 }, 
    { range: "60–74s", min: 60, max: 74 },
  ];

  const durationStats: DurationStat[] = durations.map((dur) => {
    let totalShares = 0;
    let count = 0;
    for (const dm of dailyMetrics) {
      const avgDuration = dm.stats?.mediaDuracao || 0;
      if (avgDuration >= dur.min && avgDuration <= dur.max) {
        totalShares += dm.stats?.compartilhamentos || 0;
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

  return {
    top3,
    bottom3,
    dayOfWeekStats,
    durationStats,
  };
}

/**
 * Converte o número do dia da semana (0-6) para seu nome em português.
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
