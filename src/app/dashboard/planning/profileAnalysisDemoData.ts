// src/app/dashboard/planning/profileAnalysisDemoData.ts
// Dados de demonstração em alta fidelidade para o board de Análise de Perfil.

export const PROFILE_ANALYSIS_DEMO_DATA = {
  trendData: {
    chartData: [
      { date: "2026-01-05", reach: 12500, totalInteractions: 850, postsCount: 3 },
      { date: "2026-01-12", reach: 14200, totalInteractions: 920, postsCount: 4 },
      { date: "2026-01-19", reach: 18500, totalInteractions: 1250, postsCount: 3 },
      { date: "2026-01-26", reach: 21000, totalInteractions: 1480, postsCount: 5 },
      { date: "2026-02-02", reach: 19800, totalInteractions: 1320, postsCount: 4 },
      { date: "2026-02-09", reach: 25400, totalInteractions: 1850, postsCount: 4 },
      { date: "2026-02-16", reach: 28900, totalInteractions: 2100, postsCount: 3 },
      { date: "2026-02-23", reach: 32500, totalInteractions: 2450, postsCount: 4 },
      { date: "2026-03-02", reach: 31000, totalInteractions: 2320, postsCount: 5 },
      { date: "2026-03-09", reach: 38700, totalInteractions: 2980, postsCount: 4 },
      { date: "2026-03-16", reach: 45200, totalInteractions: 3450, postsCount: 4 },
      { date: "2026-03-23", reach: 42800, totalInteractions: 3210, postsCount: 3 },
    ],
  },
  timeData: {
    buckets: [
      { hour: 8, averageInteractions: 450, postsCount: 2 },
      { hour: 10, averageInteractions: 620, postsCount: 5 },
      { hour: 12, averageInteractions: 890, postsCount: 8 },
      { hour: 15, averageInteractions: 740, postsCount: 4 },
      { hour: 18, averageInteractions: 1250, postsCount: 12 },
      { hour: 19, averageInteractions: 1680, postsCount: 15 },
      { hour: 20, averageInteractions: 1420, postsCount: 10 },
      { hour: 22, averageInteractions: 980, postsCount: 6 },
    ],
  },
  durationData: {
    buckets: [
      { key: "0-15s", label: "0-15s", averageInteractions: 850, postsCount: 12 },
      { key: "15-30s", label: "15-30s", averageInteractions: 1450, postsCount: 25 },
      { key: "30-60s", label: "30-60s", averageInteractions: 1890, postsCount: 18 },
      { key: "60s+", label: "60s+", averageInteractions: 1120, postsCount: 5 },
    ],
    totalVideoPosts: 60,
    totalPostsWithDuration: 60,
    durationCoverageRate: 1.0,
  },
  timingBenchmark: {
    cohort: { reason: "Criadores de Gastronomia & Lifestyle" },
    bestHour: 19,
    bestDurationBucket: "30-60s",
    hourBenchmark: [
      { hour: 8, average: 400 },
      { hour: 10, average: 580 },
      { hour: 12, average: 850 },
      { hour: 15, average: 700 },
      { hour: 18, average: 1100 },
      { hour: 19, average: 1500 },
      { hour: 20, average: 1300 },
      { hour: 22, average: 900 },
    ],
    durationBenchmark: [
      { label: "0-15s", average: 800 },
      { label: "15-30s", average: 1300 },
      { label: "30-60s", average: 1700 },
      { label: "60s+", average: 1000 },
    ],
  },
  formatData: {
    chartData: [
      { name: "Reels", value: 2450, postsCount: 45 },
      { name: "Estático", value: 850, postsCount: 10 },
      { name: "Carrossel", value: 1680, postsCount: 15 },
    ],
  },
  proposalData: {
    chartData: [
      { name: "Educação/Tutorial", value: 2850, postsCount: 20 },
      { name: "Entretenimento", value: 1920, postsCount: 15 },
      { name: "Inspiracional", value: 2100, postsCount: 18 },
      { name: "Venda Direta", value: 1250, postsCount: 7 },
    ],
  },
  contextData: {
    chartData: [
      { name: "Receitas Rápidas", value: 3450, postsCount: 12 },
      { name: "Rotina de Manhã", value: 1850, postsCount: 8 },
      { name: "Review de Airfryer", value: 2980, postsCount: 5 },
      { name: "Dicas de Mercado", value: 1650, postsCount: 10 },
    ],
  },
  toneData: {
    chartData: [
      { name: "Pragmático", value: 2450, postsCount: 25 },
      { name: "Descontraído", value: 1980, postsCount: 20 },
      { name: "Especialista", value: 2150, postsCount: 15 },
    ],
  },
  referenceData: {
    chartData: [
      { name: "Cozinha Prática", value: 2100, postsCount: 30 },
      { name: "Vida Real", value: 1850, postsCount: 25 },
    ],
  },
  contentIntentData: {
    chartData: [
      { name: "Atração", value: 3120, postsCount: 20 },
      { name: "Retenção", value: 1950, postsCount: 25 },
      { name: "Conversão", value: 1450, postsCount: 15 },
    ],
  },
  narrativeFormData: {
    chartData: [
      { name: "Passo a Passo", value: 3250, postsCount: 18 },
      { name: "Vlog Diário", value: 1780, postsCount: 22 },
      { name: "Lista/Top 5", value: 2450, postsCount: 12 },
    ],
  },
  contentSignalsData: {
    chartData: [
      { name: "Uso de Texto", value: 2150, postsCount: 30 },
      { name: "Áudio Tendência", value: 2850, postsCount: 15 },
    ],
  },
  stanceData: {
    chartData: [
      { name: "Autoridade", value: 2540, postsCount: 25 },
      { name: "Amigável", value: 2100, postsCount: 20 },
    ],
  },
  proofStyleData: {
    chartData: [
      { name: "Resultado Real", value: 2980, postsCount: 15 },
      { name: "Depoimento", value: 1850, postsCount: 10 },
    ],
  },
  commercialModeData: {
    chartData: [
      { name: "Orgânico", value: 2450, postsCount: 50 },
      { name: "Publi", value: 1920, postsCount: 10 },
    ],
  },
  similarCreators: {
    canShow: true,
    creatorCount: 1250,
    items: [
      { id: "1", name: "Cozinha da Ju", avatarUrl: null },
      { id: "2", name: "Dicas do Chef", avatarUrl: null },
      { id: "3", name: "Vida Saudável", avatarUrl: null },
    ],
  },
  directioningSummary: {
    headline: "Foque em Reels de 30-60s com 'Receitas Rápidas' e tom Pragmático.",
    priorityLabel: "Aumentar",
    priorityState: "scale",
    primarySignal: {
      text: "Seu alcance cresceu 25% com tutoriais práticos.",
      tone: "positive",
      metricLabel: "Alcance",
    },
    confidence: {
      label: "Alta Confiança",
      description: "Padrão consistente nos últimos 90 dias.",
    },
  },
  postsData: {
    posts: [
      { id: "p1", caption: "Bolo de caneca em 1 min!", type: "REEL", stats: { reach: 12500, total_interactions: 850, video_duration_seconds: 45 } },
      { id: "p2", caption: "Minha rotina matinal", type: "REEL", stats: { reach: 8500, total_interactions: 420, video_duration_seconds: 30 } },
      { id: "p3", caption: "Onde comer em SP", type: "REEL", stats: { reach: 15200, total_interactions: 1100, video_duration_seconds: 55 } },
    ],
    pagination: { totalPages: 1 },
  },
};
