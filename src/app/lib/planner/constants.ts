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

// Temperatura da amostragem para TESTE (softmax)
export const TEST_SAMPLING_TEMPERATURE = 0.9 as const;

// Util: as 3 horas de um bloco (ex.: 9 → [9,10,11])
export function hoursInBlock(blockStart: number): number[] {
  return [blockStart, (blockStart + 1) % 24, (blockStart + 2) % 24];
}
