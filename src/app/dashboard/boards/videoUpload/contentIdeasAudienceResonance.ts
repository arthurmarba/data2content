/**
 * contentIdeasAudienceResonance.ts
 *
 * Traduz `AudienceInsights` (sinais crus do classificador + comportamento) no
 * objeto enxuto `ContentIdeasAudienceResonance` que entra no prompt de pautas.
 *
 * GUARDRAIL central do produto (Etapa 9 × Audiência):
 *   - Sinais de TERRITÓRIO só passam se casarem com um território CONFIRMADO do
 *     mapa. Audiência-fora-do-mapa (divergência) é descartada aqui — ela é sinal
 *     de "revisar territórios" (tratado no card de audiência), nunca de criação.
 *   - Nenhum número/metrica atravessa: só rótulos humanos. A tradução para
 *     linguagem de reconhecimento (sem performance) acontece no prompt builder.
 */
import type { AudienceInsights } from "@/app/dashboard/boards/videoUpload/audienceInsightsService";
import type { ContentIdeasAudienceResonance } from "@/app/dashboard/boards/videoUpload/contentIdeasGeminiPromptBuilder";

// Humaniza rótulo cru do classificador: "Conectar/Relacionar" → "conectar",
// "Estilo de Vida e Bem-Estar" → "estilo de vida e bem-estar".
function humanize(raw: string): string {
  return raw.split("/")[0]!.trim().toLowerCase();
}

function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    // pontuação/barra viram espaço, para "Tecnologia/Digital" → "tecnologia digital"
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// Conectores genéricos que não devem, sozinhos, casar dois territórios.
// (sem isso, "a performance como estratégia" casaria com "vida como negócio"
//  só por causa de "como".)
const GENERIC_TERRITORY_WORDS = new Set([
  "como", "para", "sobre", "uma", "com", "dos", "das", "que", "por",
  "minha", "meu", "sua", "seu", "vida", "conteudo", "estrategia",
]);

/** Palavras significativas de um rótulo (≥4 chars, sem conectores genéricos). */
function significantWords(normalized: string): string[] {
  return normalized
    .split(" ")
    .filter((w) => w.length >= 4 && !GENERIC_TERRITORY_WORDS.has(w));
}

/**
 * Casa um rótulo de território vindo da audiência (vocabulário do classificador,
 * ex. "Tecnologia/Digital") contra a lista de territórios confirmados do mapa
 * (frases do criador, ex. "bastidor, processo e pauta"). Como são vocabulários
 * DIFERENTES, usa sobreposição de palavras — o MESMO critério que o serviço de
 * audiência usa em territoryLabelsMatch (matcher rígido `startsWith` matava o sinal).
 * Retorna o rótulo CONFIRMADO (não o da audiência) quando casa; senão null.
 */
function matchConfirmedTerritory(
  audienceLabel: string | null | undefined,
  confirmedTerritoryLabels: string[],
): string | null {
  if (!audienceLabel) return null;
  const a = normalize(audienceLabel);
  if (!a) return null;
  const wordsA = significantWords(a);
  const matched = confirmedTerritoryLabels.find((t) => {
    const c = normalize(t);
    if (c === a) return true;
    const wordsC = new Set(significantWords(c));
    return wordsA.some((w) => wordsC.has(w));
  });
  return matched ?? null;
}

/**
 * Produz o objeto de ressonância para o prompt. Retorna `null` quando não há
 * nenhum sinal aproveitável — nesse caso a geração se comporta como antes.
 */
export function buildContentIdeasAudienceResonance(
  insights: AudienceInsights | null | undefined,
  confirmedTerritoryLabels: string[],
): ContentIdeasAudienceResonance | null {
  if (!insights || !insights.hasAny) return null;

  // Território que mais ressoa: prioriza divergência (assunto que guardam ≠ centro
  // do mapa) e cai para o "mais salvo"; ambos precisam casar com o mapa confirmado.
  const resonantTerritory =
    matchConfirmedTerritory(insights.territoryDivergence?.audienceLabel, confirmedTerritoryLabels) ??
    matchConfirmedTerritory(insights.resonantTerritory?.label, confirmedTerritoryLabels);

  // Território órfão: confirmado, pouco postado, muito guardado → ângulo de descoberta.
  const underexploredTerritory = matchConfirmedTerritory(
    insights.orphanTerritory?.label,
    confirmedTerritoryLabels,
  );

  const resonance: ContentIdeasAudienceResonance = {
    resonantTerritory,
    // Evita repetir o mesmo território nas duas linhas.
    underexploredTerritory:
      underexploredTerritory && underexploredTerritory !== resonantTerritory
        ? underexploredTerritory
        : null,
    tone: insights.resonantTone ? humanize(insights.resonantTone.label) : null,
    intent: insights.resonantIntent ? humanize(insights.resonantIntent.label) : null,
    narrativeForm: insights.resonantNarrativeForm
      ? humanize(insights.resonantNarrativeForm.label)
      : null,
    stance: insights.resonantStance ? humanize(insights.resonantStance.label) : null,
  };

  // Se nenhum campo sobreviveu, não anexa o bloco.
  const hasAnySignal = Object.values(resonance).some((v) => v != null);
  return hasAnySignal ? resonance : null;
}
