// src/app/lib/mapaSeed/enrichMapaWithInstagram.ts
// Cruza os padrões do Instagram com o mapa seed declarativo
// e gera um mapa enriquecido mais fiel ao criador real.
// Modelo: OpenAI gpt-4o (via callClaudeJSON, nome legado) · intensity: high

import { callClaudeJSON } from "@/app/lib/claudeService";
import { logger } from "@/app/lib/logger";
import type { IMapaData, MapaFonte } from "@/app/models/MapaSeed";
import type { InstagramPatterns } from "./analyzeInstagramPosts";
import { applyCoreStabilityLocks, type CoreStabilityLocks } from "./coreStabilityLocks";

export type { CoreStabilityLocks } from "./coreStabilityLocks";

// ─── Prompt ───────────────────────────────────────────────────────────────────

function buildPrompt(mapa: IMapaData, patterns: InstagramPatterns): string {
  return `Você é um sistema de mapeamento narrativo para criadores de conteúdo.

Você tem dois conjuntos de dados sobre o mesmo criador:
1. O mapa seed — o que ele declarou sobre si mesmo no onboarding
2. Os padrões do Instagram — o que ele realmente publica

Sua tarefa é cruzar os dois e gerar um mapa enriquecido mais fiel
ao criador real do que cada fonte sozinha.

Mapa seed (onboarding declarativo):
${JSON.stringify(mapa, null, 2)}

Padrões do Instagram (comportamento real):
${JSON.stringify(patterns, null, 2)}

Gere o mapa enriquecido com os seguintes campos:

- narrativa_central: revise se necessário. Se o Instagram confirma a
  declaração, mantenha. Se revela algo mais específico ou diferente, atualize.
  Máx. 20 palavras.

- territorios: combine os declarados com os temas recorrentes reais.
  Remova o que não aparece em nenhuma fonte. Adicione o que aparece
  no Instagram mas não foi declarado. Máx. 5 territórios.
  IMPORTANTE: cada território deve ser específico e ancorado na
  narrativa_central deste criador. Evite rótulos genéricos de cultura ou
  entretenimento que poderiam descrever qualquer artista ou músico (ex:
  'negócio cultural', 'carreira artística' sozinhos são ambíguos demais).
  Se o criador fala sobre IA para criadores de conteúdo, o território deve
  deixar claro o contexto: 'carreira de criador digital com IA', não
  'consultoria em carreiras artísticas'. O rótulo deve responder: quem é
  ESTE criador especificamente?

- narrativas_adjacentes: extensões coerentes que aparecem nas bordas
  do conteúdo ou da vida — ainda não são o foco principal.

- assets: combine os declarados com os identificados no Instagram.

- tom: se o tom declarado e o tom real divergirem, use o tom real.
  Registre a divergência em "observacoes" se relevante.

- formatos: combine declarados com os realmente usados.

- observacoes: lista de divergências relevantes entre o declarado e o real.
  Máx. 2 observações. Use linguagem calma e descritiva, sem julgamento.
  Deixe vazio [] se não houver divergência relevante.

Regras:
- Não invente informações que não existam em nenhuma das fontes.
- Se o Instagram confirma o mapa seed, mantenha o mapa seed.
- Se a amostragem for baixa, seja conservador nas conclusões.

Retorne apenas JSON válido. Sem explicação adicional.

Formato esperado:
{
  "narrativa_central": "string",
  "territorios": ["string"],
  "narrativas_adjacentes": ["string"],
  "assets": ["string"],
  "tom": "string",
  "formatos": ["string"],
  "observacoes": ["string"]
}`;
}

// ─── Função principal ─────────────────────────────────────────────────────────

export async function enrichMapaWithInstagram(
  mapaAtual: IMapaData,
  patterns: InstagramPatterns,
  locks?: CoreStabilityLocks,
): Promise<IMapaData> {
  const TAG = "[mapaSeed][enrichMapaWithInstagram]";

  // Se amostragem insuficiente, retorna mapa com observação e sem enriquecimento
  if (patterns.amostragem === "insuficiente") {
    logger.warn(`${TAG} Amostragem insuficiente — mapa mantido sem enriquecimento.`);
    return {
      ...mapaAtual,
      maturidade: "instagram_enriched",
      fonte: ([...new Set([...mapaAtual.fonte, "instagram"])] as MapaFonte[]),
      amostragem_instagram: "insuficiente",
      observacoes: [
        "Histórico do Instagram insuficiente para enriquecimento — mapa baseado principalmente no onboarding.",
      ],
    };
  }

  logger.info(`${TAG} Enriquecendo mapa com Instagram (amostragem: ${patterns.amostragem})...`);

  type RawEnriched = Pick<
    IMapaData,
    | "narrativa_central"
    | "territorios"
    | "narrativas_adjacentes"
    | "assets"
    | "tom"
    | "formatos"
    | "observacoes"
  >;

  const raw = await callClaudeJSON<RawEnriched>(buildPrompt(mapaAtual, patterns), {
    intensity: "high",
    maxTokens: 1024,
  });

  if (!raw.narrativa_central || !raw.tom) {
    logger.error(`${TAG} Mapa enriquecido inválido:`, raw);
    throw new Error("Mapa enriquecido gerado sem campos obrigatórios.");
  }

  // Núcleo travado (G3): se o criador já confirmou narrativa/tom, o Instagram não
  // sobrescreve — mantém o confirmado e registra a divergência como observação calma.
  const { narrativaFinal, tomFinal, observacoes } = applyCoreStabilityLocks({
    mapaAtual,
    proposedNarrativa: raw.narrativa_central,
    proposedTom: raw.tom,
    baseObservacoes: raw.observacoes ?? [],
    locks,
    source: { narrativePrefix: "Seu Instagram sugere", tonePhrase: "no Instagram" },
  });

  const mapaEnriquecido: IMapaData = {
    narrativa_central:     narrativaFinal,
    territorios:           raw.territorios           ?? mapaAtual.territorios,
    narrativas_adjacentes: raw.narrativas_adjacentes ?? mapaAtual.narrativas_adjacentes,
    assets:                raw.assets                ?? mapaAtual.assets,
    tom:                   tomFinal,
    formatos:              raw.formatos              ?? mapaAtual.formatos,
    maturidade:            "instagram_enriched",
    fonte:                 ([...new Set([...mapaAtual.fonte, "instagram"])] as MapaFonte[]),
    observacoes:           observacoes.slice(0, 3),
    amostragem_instagram:  patterns.amostragem,
  };

  logger.info(`${TAG} Mapa enriquecido: "${mapaEnriquecido.narrativa_central}"`);
  return mapaEnriquecido;
}
