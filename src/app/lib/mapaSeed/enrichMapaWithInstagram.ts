// src/app/lib/mapaSeed/enrichMapaWithInstagram.ts
// Cruza os padrões do Instagram com o mapa seed declarativo
// e gera um mapa enriquecido mais fiel ao criador real.
// Modelo: OpenAI gpt-4o (via callClaudeJSON, nome legado) · intensity: high

import { callClaudeJSON } from "@/app/lib/claudeService";
import { logger } from "@/app/lib/logger";
import type { IMapaData, MapaFonte } from "@/app/models/MapaSeed";
import type { InstagramPatterns } from "./analyzeInstagramPosts";
import {
  applyCoreStabilityLocks,
  applyEditedArrayLocks,
  type CoreStabilityLocks,
} from "./coreStabilityLocks";
import { MAPA_LAYERS_GUIDE, MAPA_COERENCIA_RULE } from "./mapaLayersGuide";

export type { CoreStabilityLocks } from "./coreStabilityLocks";

// ─── Prompt ───────────────────────────────────────────────────────────────────

function buildPrompt(mapa: IMapaData, patterns: InstagramPatterns): string {
  return `Você é o sistema de mapeamento narrativo da Data2Content.

Você tem dois conjuntos de dados sobre o MESMO criador (o dono desta conta):
1. O mapa atual — o que ele declarou sobre si no onboarding
2. Os padrões do Instagram — o que ele realmente publica (MATÉRIA-PRIMA: pistas
   do que ele é, NÃO a narrativa pronta)

Sua tarefa é cruzar os dois e gerar um mapa enriquecido mais fiel ao criador
real. Atenção: os padrões do Instagram descrevem o CONTEÚDO; a narrativa que
você gera é sobre QUEM ELE É. Não copie a descrição do conteúdo para a narrativa.

Mapa atual (onboarding declarativo):
${JSON.stringify(mapa, null, 2)}

Padrões do Instagram (comportamento real):
${JSON.stringify(patterns, null, 2)}

Respeite rigorosamente a definição de cada camada — é o que torna o mapa preciso.

${MAPA_LAYERS_GUIDE}

Gere o mapa enriquecido com os campos abaixo, seguindo o gabarito acima:

- narrativa_central: a IDENTIDADE do dono da conta (missão ou tensão de vida).
  Se o Instagram confirma a declaração, mantenha. Se revela algo mais específico,
  atualize — mas SEMPRE como identidade da pessoa, nunca como descrição do que
  os posts falam, nunca em 3ª pessoa sobre "criadores".
- territorios: substantivos curtos e objetivos (1-3 palavras), sem sufixo de
  público. Combine os declarados com os temas recorrentes reais; remova o que não
  aparece em nenhuma fonte. 2 a 4 itens.
- temas: o cruzamento território × narrativa — cenas concretas, não ecos do
  assunto. Derive das situações que aparecem no conteúdo. 2 a 4 itens.
- narrativas_adjacentes: extensões coerentes nas bordas — ainda não são o foco.
- assets: combine os declarados com os identificados no Instagram. Elementos
  concretos da vida, curtos.
- tom: se o tom declarado e o real divergirem, use o tom real e registre em
  "observacoes".
- formatos: combine declarados com os realmente usados.
- observacoes: divergências relevantes entre o declarado e o real. Máx. 2.
  Linguagem calma, sem julgamento. Vazio [] se não houver.

Regras:
- Não invente informações que não existam em nenhuma das fontes.
- Se o Instagram confirma o mapa, mantenha o mapa.
- Se a amostragem for baixa, seja conservador.
- ${MAPA_COERENCIA_RULE}

Retorne apenas JSON válido. Sem explicação adicional.

Formato esperado:
{
  "narrativa_central": "string",
  "territorios": ["string"],
  "temas": ["string"],
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
  editedSections?: string[],
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
    | "temas"
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

  // Seções editadas pelo criador (territorios/temas/assets) não são sobrescritas.
  const lockedArrays = applyEditedArrayLocks({
    mapaAtual,
    proposed: { territorios: raw.territorios, temas: raw.temas, assets: raw.assets },
    editedSections,
  });

  const mapaEnriquecido: IMapaData = {
    narrativa_central:     narrativaFinal,
    territorios:           lockedArrays.territorios,
    temas:                 lockedArrays.temas,
    narrativas_adjacentes: raw.narrativas_adjacentes ?? mapaAtual.narrativas_adjacentes,
    assets:                lockedArrays.assets,
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
