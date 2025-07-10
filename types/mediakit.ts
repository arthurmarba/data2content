// @/types/mediakit.ts

// Tipo para os itens da tabela de vídeos
export interface VideoListItem {
  _id: string;
  thumbnailUrl?: string | null;
  caption?: string;
  description?: string;
  permalink?: string | null;
  postDate?: string | Date;
  stats?: {
    views?: number;
    likes?: number;
    comments?: number;
    shares?: number;
  };
}

// Tipo para o resumo de performance (cards de destaque)
export interface PerformanceSummary {
  topPerformingFormat?: { name: string; metricName: string; valueFormatted: string } | null;
  topPerformingContext?: { name: string; metricName: string; valueFormatted: string } | null;
}

// Tipo para os dados de cada KPI individual
export interface KPIComparisonData {
  currentValue: number | null;
  previousValue: number | null;
  percentageChange: number | null;
  chartData?: { name: string; value: number }[];
}

// Tipo para o objeto completo de KPIs que vem da API
export interface KpiComparison {
  followerGrowth: KPIComparisonData;
  engagementRate: KPIComparisonData;
  postingFrequency: KPIComparisonData;
  avgReachPerPost?: KPIComparisonData;
  avgViewsPerPost?: KPIComparisonData;
  avgCommentsPerPost?: KPIComparisonData;
  avgSharesPerPost?: KPIComparisonData;
  avgSavesPerPost?: KPIComparisonData;
  insightSummary?: {
    followerGrowth?: string;
    engagementRate?: string;
    postingFrequency?: string;
  };
  comparisonPeriod: string;
}

// --- NOVOS TIPOS PARA DEMOGRAFIA ---

// CORREÇÃO: Renomeado de AudienceDemographics para DemographicsData para corresponder ao uso.
export interface DemographicsData { // <--- Este é o nome correto
  follower_demographics?: {
    gender?: Record<string, number>;
    age?: Record<string, number>;
    city?: Record<string, number>;
    country?: Record<string, number>;
  };
  engaged_audience_demographics?: {
    gender?: Record<string, number>;
    age?: Record<string, number>;
    city?: Record<string, number>;
    country?: Record<string, number>;
  };
}

// Props para o componente MediaKitView
export interface MediaKitViewProps {
  user: any;
  summary: PerformanceSummary | null;
  videos: VideoListItem[];
  kpis: KpiComparison | null;
  demographics: DemographicsData | null; // A linha precisa estar aqui
}