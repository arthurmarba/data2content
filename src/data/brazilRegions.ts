// Caminho: src/data/brazilRegions.ts

export const BRAZIL_REGION_STATES: Record<string, string[]> = {
  "Norte": ["AC", "AP", "AM", "PA", "RO", "RR", "TO"],
  "Nordeste": ["AL", "BA", "CE", "MA", "PB", "PE", "PI", "RN", "SE"],
  "Centro-Oeste": ["DF", "GO", "MT", "MS"],
  "Sudeste": ["ES", "MG", "RJ", "SP"],
  "Sul": ["PR", "RS", "SC"]
};

/**
 * Retorna uma lista de siglas de estados para uma dada região.
 * @param region O nome da região (ex: "Sudeste").
 * @returns Um array de strings com as siglas dos estados, ou um array vazio se a região não for encontrada.
 */
export function getStatesByRegion(region: string): string[] {
  return BRAZIL_REGION_STATES[region] || [];
}