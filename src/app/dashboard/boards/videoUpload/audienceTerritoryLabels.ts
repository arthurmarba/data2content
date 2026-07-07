/**
 * audienceTerritoryLabels.ts
 *
 * Utilitários PUROS de normalização/comparação de labels de território — zero
 * dependências de servidor (sem mongoose, logger/winston, models). Extraídos de
 * audienceInsightsService.ts para que componentes "use client" (ex.:
 * AudienceInsightsCard) possam comparar territórios sem arrastar o serviço
 * inteiro — e com ele winston/nodemailer — pro bundle do cliente.
 *
 * Regra: nada aqui pode importar código só-de-servidor. Se precisar, o lugar é
 * o serviço, não este módulo.
 */

/** Remove acentos/pontuação e colapsa espaços — base para comparar labels. */
export function normalizeLabel(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Verifica se dois labels de território se sobrepõem o suficiente para serem
 * considerados "o mesmo" — sem exigir match exato (classificações podem variar levemente).
 */
export function territoryLabelsMatch(a: string, b: string): boolean {
  const na = normalizeLabel(a);
  const nb = normalizeLabel(b);
  if (na === nb) return true;
  // Verifica se a primeira palavra significativa (≥4 chars) é comum
  const wordsA = na.split(" ").filter((w) => w.length >= 4);
  const wordsB = new Set(nb.split(" ").filter((w) => w.length >= 4));
  return wordsA.some((w) => wordsB.has(w));
}
