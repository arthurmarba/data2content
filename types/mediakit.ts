// src/types/mediakit.ts

// Tipo para os itens da tabela de vídeos
export interface VideoListItem {
    _id: string;
    thumbnailUrl?: string | null;
    caption?: string;
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
    // O lowPerformingFormat foi removido intencionalmente
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
    engagementRate: KPIComparisonData; // <- A definição correta
    postingFrequency: KPIComparisonData;
    insightSummary?: {
      followerGrowth?: string;
      engagementRate?: string;
      postingFrequency?: string;
    };
  }
  
  // Props para o componente MediaKitView
  export interface MediaKitViewProps {
    user: any; // Idealmente, crie uma interface IUser e importe aqui
    summary: PerformanceSummary | null;
    videos: VideoListItem[];
    kpis: KpiComparison | null;
  }