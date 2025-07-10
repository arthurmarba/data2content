// @/types/mediakit.ts

// Tipo para os itens da tabela de vídeos
export interface VideoListItem {
  _id: string;
  thumbnailUrl?: string | null;
  caption?: string;
  permalink?: string | null;
  postDate?: string | Date;
  // Classificação de conteúdo
  // Todos os campos são arrays para acomodar múltiplas tags
  format?: string[];
  proposal?: string[];
  context?: string[];
  tone?: string[];
  references?: string[];
  stats?: {
    views?: number;
    likes?: number;
    comments?: number;
    shares?: number;
    saves?: number;
    reach?: number; // NOVO: Adicionado para o cálculo de alcance
  };
}

// Para os cards de destaque
export interface PerformanceSummary {
  topPerformingFormat?: { name: string; metricName: string; valueFormatted: string } | null;
  topPerformingContext?: { name: string; metricName: string; valueFormatted: string } | null;
}

// Para cada KPI individual
export interface KPIComparisonData {
  currentValue: number | null;
  previousValue: number | null;
  percentageChange: number | null;
  chartData?: { name: string; value: number }[];
}

// Para o objeto completo de KPIs da API
export interface KpiComparison {
  comparisonPeriod?: string;
  followerGrowth: KPIComparisonData;
  engagementRate: KPIComparisonData;
  totalEngagement: KPIComparisonData;
  postingFrequency: KPIComparisonData;
  avgViewsPerPost: KPIComparisonData;
  avgCommentsPerPost: KPIComparisonData;
  avgSharesPerPost: KPIComparisonData;
  avgSavesPerPost: KPIComparisonData;
  avgReachPerPost: KPIComparisonData;
  insightSummary?: {
    followerGrowth?: string;
    engagementRate?: string;
    totalEngagement?: string;
    postingFrequency?: string;
    avgViewsPerPost?: string;
    avgCommentsPerPost?: string;
    avgSharesPerPost?: string;
    avgSavesPerPost?: string;
    avgReachPerPost?: string;
  };
}

// --- NOVOS TIPOS PARA DEMOGRAFIA ---

export interface DemographicsData {
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

// Para as props do componente MediaKitView
export interface MediaKitViewProps {
  user: any;
  summary: PerformanceSummary | null;
  videos: VideoListItem[];
  kpis: KpiComparison | null; // Dados iniciais
  demographics: DemographicsData | null;
}