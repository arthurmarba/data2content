// src/types/planner.ts
// Tipos compartilhados para o Planner de Conteúdo (Instagram)

export type PlannerPlatform = 'instagram';

// Status do slot no planner
export type PlannerSlotStatus = 'planned' | 'drafted' | 'test' | 'posted';

// Formatos suportados no MVP (alinhado com classification.ts -> formatCategories)
export type PlannerFormat = 'reel' | 'photo' | 'carousel' | 'story' | 'live' | 'long_video';

// Conjunto de categorias (IDs definidos em classification.ts)
export interface PlannerCategories {
  context?: string[]; // múltiplos contextos
  tone?: string; // tom principal
  proposal?: string[]; // múltiplas propostas (quando aplicável)
  reference?: string[]; // múltiplas referências
}

// Métricas esperadas (faixas)
export interface ExpectedMetrics {
  viewsP50?: number; // mediana
  viewsP90?: number; // alta prob.
  sharesP50?: number; // opcional, quando objetivo é teste de compartilhamentos
}

