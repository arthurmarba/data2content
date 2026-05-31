// @/app/lib/planner/constants.ts
// Constantes do Planejador (sugestão de conteúdo e de teste)

export const PLANNER_TIMEZONE = 'America/Sao_Paulo' as const;

// Janelas de horário operacionais (blocos de 3h iniciando às 9h)
export const ALLOWED_BLOCKS = [9, 12, 15, 18] as const;

// Janela histórica (dias para trás)
export const WINDOW_DAYS = 90 as const;

// Robustez de amostra
export const MIN_SAMPLES = 3 as const;          // ideal
export const MIN_SAMPLES_FALLBACK = 2 as const; // aceitar com mediana quando volume baixo

// Superioridade (lift) mínima para considerar vencedor no bloco
export const LIFT_THRESHOLD = 1.15 as const;

// P90 ≈ 1.45 × P50
export const P90_MULT = 1.45 as const;

// Sugestões prioritárias por semana (conteúdo)
export const TARGET_SUGGESTIONS_MIN = 3 as const;
export const TARGET_SUGGESTIONS_MAX = 5 as const;

// --- Geração por slot (criação coerente) ---
// Decisão de produto: o criador vê um número fixo e calmo de pautas por slot —
// não um gerador que infla a cada clique. "Gerar novas ideias" SUBSTITUI a lista,
// não acumula. Mais coerência > mais volume.
//
// Pautas/ideias mostradas por slot. Mantido baixo de propósito: o criador deve
// conseguir ler todas e sentir qual conversa com o mapa, sem ansiedade de volume.
export const PAUTAS_PER_SLOT = 5 as const;
// A IA gera um excedente e cortamos para PAUTAS_PER_SLOT, garantindo qualidade
// após dedupe/filtro. É um buffer de qualidade, não uma oferta ao criador.
export const PAUTA_AI_OVERGENERATION = 10 as const;
// Inspirações a partir do próprio conteúdo do criador (referência, não pauta).
export const SELF_INSPIRATIONS_LIMIT = 8 as const;
// Inspirações da comunidade (outros criadores) exibidas no card.
export const COMMUNITY_INSPIRATIONS_LIMIT = 12 as const;

// Temperatura da amostragem para TESTE (softmax)
export const TEST_SAMPLING_TEMPERATURE = 0.9 as const;

// Util: as 3 horas de um bloco (ex.: 9 → [9,10,11])
export function hoursInBlock(blockStart: number): number[] {
  return [blockStart, (blockStart + 1) % 24, (blockStart + 2) % 24];
}
