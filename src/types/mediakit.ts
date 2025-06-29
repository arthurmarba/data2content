// src/types/mediakit.ts

// Tipos compartilhados para o Mídia Kit

// Para a tabela de vídeos
export interface VideoListItem {
    _id: string;
    thumbnailUrl?: string | null;
    caption?: string;
    permalink?: string | null;
    postDate?: string | Date;
    // <<< INÍCIO DA CORREÇÃO: Campos de estratégia adicionados >>>
    // Adicionando os campos que o componente VideosTable.tsx espera.
    // Eles são opcionais ('?') porque nem todo vídeo pode ter essas tags.
    proposal?: string;
    context?: string;
    format?: string;
    // <<< FIM DA CORREÇÃO >>>
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