// src/types/mediakit.ts

// Tipos compartilhados para o Mídia Kit

// Para a tabela de vídeos
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
    postingFrequency: KPIComparisonData;
    avgViewsPerPost: KPIComparisonData;
    avgCommentsPerPost: KPIComparisonData;
    avgSharesPerPost: KPIComparisonData;
    avgSavesPerPost: KPIComparisonData;
    avgReachPerPost: KPIComparisonData;
    insightSummary?: {
      followerGrowth?: string;
      engagementRate?: string;
      postingFrequency?: string;
      avgViewsPerPost?: string;
      avgCommentsPerPost?: string;
      avgSharesPerPost?: string;
      avgSavesPerPost?: string;
      avgReachPerPost?: string;
    };
  }
  
  // Para as props do componente MediaKitView
  export interface MediaKitViewProps {
    user: any;
    summary: PerformanceSummary | null;
    videos: VideoListItem[];
    kpis: KpiComparison | null; // Dados iniciais
  }