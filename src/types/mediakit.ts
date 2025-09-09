// src/types/mediakit.ts

// --- Métricas por post ---
export interface VideoStats {
  views?: number;
  likes?: number;
  comments?: number;
  shares?: number;
  saves?: number;   // alguns provedores retornam "saves"
  reach?: number;   // usado como fallback de views em alguns casos
}

// --- Item da listagem de vídeos ---
export interface VideoListItem {
  _id: string;

  // Texto e navegação
  caption?: string;
  description?: string;
  permalink?: string | null;
  postDate?: string | Date;

  // Thumbnails / mídia (podem vir com nomes distintos do backend)
  thumbnailUrl?: string | null;
  thumbnail_url?: string | null;
  coverUrl?: string | null;
  cover_url?: string | null;
  mediaUrl?: string | null;
  media_url?: string | null;
  previewImageUrl?: string | null;
  preview_image_url?: string | null;
  displayUrl?: string | null;
  display_url?: string | null;

  // Estratégia (podem vir como CSV string ou array)
  format?: string | string[] | null;
  proposal?: string | string[] | null;
  context?: string | string[] | null;
  tone?: string | string[] | null;
  references?: string | string[] | null;

  // Stats
  stats?: VideoStats;
}

// --- Resumo de performance (cards de destaque) ---
export interface PerformanceSummary {
  topPerformingFormat?: { name: string; metricName: string; valueFormatted: string } | null;
  topPerformingContext?: { name: string; metricName: string; valueFormatted: string } | null;
}

// --- KPIs individuais ---
export interface KPIComparisonData {
  currentValue: number | null;
  previousValue: number | null;
  percentageChange: number | null;
  chartData?: { name: string; value: number }[];
}

// --- Objeto completo de KPIs ---
export interface KpiComparison {
  comparisonPeriod?: string;
  followerGrowth: KPIComparisonData;
  engagementRate: KPIComparisonData;
  totalEngagement: KPIComparisonData;
  postingFrequency: KPIComparisonData;
  avgViewsPerPost: KPIComparisonData;
  avgLikesPerPost: KPIComparisonData;
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
    avgLikesPerPost?: string;
    avgCommentsPerPost?: string;
    avgSharesPerPost?: string;
    avgSavesPerPost?: string;
    avgReachPerPost?: string;
  };
}

// --- Demografia ---
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

// --- Props da view ---
export interface MediaKitViewProps {
  user: any;
  summary: PerformanceSummary | null;
  videos: VideoListItem[];
  kpis: KpiComparison | null;
  demographics: DemographicsData | null;
  // Exibe o banner institucional apenas em contexto de compartilhamento público
  showSharedBanner?: boolean;
}
