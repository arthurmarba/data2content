/**
 * aiOrchestratorFunctionScope.ts
 *
 * 1.1b da otimização de custo: para intents de DADOS estreitos, o orquestrador
 * não precisa expor as 15 funções (~15k tokens) — só o punhado que aquele tipo
 * de pergunta de fato usa. Reduz tokens de input nos turnos de maior frequência.
 *
 * SEGURANÇA: cada allowlist deve ser um SUPERSET generoso do que as respostas
 * daquele intent precisam — subdimensionar tira do modelo uma ferramenta que ele
 * usaria (perda de capacidade). Intents abertos (`general`, `report`…) NÃO entram
 * no mapa: recebem o conjunto completo, sem mudança. A aplicação é env-gated
 * (default OFF) — ver `isIntentFunctionSubsetEnabled` — para permitir validação
 * em staging antes de confiar em produção.
 */

/**
 * Allowlist de funções por intent estreito. Nome do intent → nomes de função.
 * Mantenha cada lista deliberadamente generosa. Intent ausente = sem subset
 * (conjunto completo). NÃO inclua aqui intents abertos como `general`.
 */
export const FUNCTIONS_BY_INTENT: Record<string, readonly string[]> = {
  demographic_query: ["getLatestAudienceDemographics", "getLatestAccountInsights"],
  ASK_BEST_TIME: ["getDayPCOStats", "getAggregatedReport", "getDailyMetricHistory"],
  ranking_request: ["getCategoryRanking", "getTopPosts", "getFpcTrendHistory", "getUserTrend"],
  ASK_BEST_PERFORMER: [
    "getTopPosts",
    "getCategoryRanking",
    "getMetricDetailsById",
    "findPostsByCriteria",
  ],
};

/** Aplica o subset por intent? Default OFF — ligar com AI_FUNCTION_SUBSET_BY_INTENT=true. */
export function isIntentFunctionSubsetEnabled(): boolean {
  return process.env.AI_FUNCTION_SUBSET_BY_INTENT === "true";
}

/**
 * Dado o intent e a lista atual de funções (já com qualquer filtragem prévia,
 * ex.: remoção de `fetchCommunityInspirations`), devolve apenas as funções
 * relevantes para aquele intent — ou a lista intacta quando:
 *   - o subset está desligado por env, OU
 *   - o intent não está no mapa (intent aberto → conjunto completo).
 *
 * Pura e determinística. Preserva a ordem original e nunca inventa funções:
 * intersecta a allowlist com o que já estava disponível.
 */
export function selectFunctionsForIntent<T extends { name: string }>(
  intent: string,
  functions: T[],
): T[] {
  if (!isIntentFunctionSubsetEnabled()) return functions;
  const allow = FUNCTIONS_BY_INTENT[intent];
  if (!allow) return functions;
  const allowSet = new Set(allow);
  const subset = functions.filter((fn) => allowSet.has(fn.name));
  // Salvaguarda: se a interseção esvaziar (mapa dessincronizado dos schemas),
  // devolve a lista completa em vez de deixar o modelo sem ferramenta nenhuma.
  return subset.length > 0 ? subset : functions;
}
