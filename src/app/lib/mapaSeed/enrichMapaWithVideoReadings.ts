// src/app/lib/mapaSeed/enrichMapaWithVideoReadings.ts
// Cruza o mapa atual (declarativo + Instagram) com a síntese das leituras de
// vídeo que o criador escolheu publicar, gerando um mapa mais fiel ao que ele
// de fato produz. Espelha o padrão de enrichMapaWithInstagram.
// Modelo: gpt-4o · intensity: high

import { callClaudeJSON } from "@/app/lib/claudeService";
import { logger } from "@/app/lib/logger";
import type { IMapaData, MapaFonte } from "@/app/models/MapaSeed";
import type { CreatorStrategicProfileSynthesis } from "@/app/dashboard/boards/videoUpload/creatorStrategicProfileSynthesis";
import {
  applyCoreStabilityLocks,
  applyEditedArrayLocks,
  type CoreStabilityLocks,
} from "./coreStabilityLocks";
import { MAPA_LAYERS_GUIDE, MAPA_COERENCIA_RULE } from "./mapaLayersGuide";

// ─── Resumo compacto e seguro da síntese ───────────────────────────────────────

/**
 * Extrai apenas os rótulos/resumos relevantes da síntese para alimentar o
 * prompt. A síntese já é sanitizada (sem URLs, sem dados crus do provider),
 * então é seguro injetá-la no prompt.
 */
export interface VideoSynthesisDigest {
  narrativa_central: string | null;
  confianca_narrativa: "low" | "medium" | "high" | null;
  territorios: string[];
  tom_dominante: string | null;
  assets_recorrentes: string[];
  padroes_recorrentes: string[];
  leituras_analisadas: number;
}

export function buildVideoSynthesisDigest(
  synthesis: CreatorStrategicProfileSynthesis,
): VideoSynthesisDigest {
  const topLabels = (signals: { label: string }[], max: number) =>
    signals.slice(0, max).map((s) => s.label).filter(Boolean);

  return {
    narrativa_central: synthesis.mainNarrative?.label ?? null,
    confianca_narrativa: synthesis.mainNarrative?.confidence ?? null,
    territorios: topLabels(synthesis.narrativeTerritories, 5),
    tom_dominante: synthesis.dominantTone,
    assets_recorrentes: topLabels(synthesis.confirmedLifeAssets, 5),
    padroes_recorrentes: topLabels(synthesis.recurringPatterns, 4),
    leituras_analisadas: synthesis.analyzedReadingsCount,
  };
}

// ─── Prompt ─────────────────────────────────────────────────────────────────────

function buildPrompt(mapa: IMapaData, digest: VideoSynthesisDigest): string {
  return `Você é um sistema de mapeamento narrativo para criadores de conteúdo.

Você tem dois conjuntos de dados sobre o mesmo criador:
1. O mapa atual — o que ele declarou no onboarding e/ou o que o Instagram revelou
2. A síntese dos vídeos que ele ESCOLHEU PUBLICAR — o comportamento mais
   intencional e recente do criador (sinais acumulados de leituras de vídeo)

Sua tarefa é cruzar os dois e gerar um mapa enriquecido mais fiel ao criador
real. A síntese de vídeo tem peso forte: representa o que o criador decidiu
levar ao público, não o que apenas declarou. Atenção: a síntese descreve o
CONTEÚDO dos vídeos; a narrativa que você gera é sobre QUEM ELE É — não copie a
descrição do conteúdo para a narrativa.

Mapa atual:
${JSON.stringify(mapa, null, 2)}

Síntese dos vídeos publicados (comportamento intencional):
${JSON.stringify(digest, null, 2)}

Respeite rigorosamente a definição de cada camada — é o que torna o mapa preciso.

${MAPA_LAYERS_GUIDE}

Gere o mapa enriquecido com os campos abaixo, seguindo o gabarito acima:

- narrativa_central: a IDENTIDADE do dono da conta (missão ou tensão de vida).
  Se a síntese confirma o mapa, mantenha. Se revela algo mais específico com
  confiança média/alta, atualize — SEMPRE como identidade da pessoa, nunca como
  descrição do que os vídeos falam, nunca em 3ª pessoa sobre "criadores". Se a
  confiança da narrativa de vídeo for baixa, prefira o mapa atual.
- territorios: substantivos curtos e objetivos (1-3 palavras), sem sufixo de
  público. Combine os do mapa com os territórios dos vídeos; remova o que não
  aparece em nenhuma fonte. 2 a 4 itens.
- temas: o cruzamento território × narrativa — cenas concretas, não ecos do
  assunto. Derive das situações recorrentes nos vídeos. 2 a 4 itens.
- narrativas_adjacentes: extensões coerentes nas bordas — mantenha as existentes
  e adicione se os vídeos sugerirem direção nova.
- assets: combine os do mapa com os assets recorrentes dos vídeos. Curtos.
- tom: se o tom do mapa e o dos vídeos divergirem, use o dos vídeos e registre em
  "observacoes".
- formatos: mantenha os formatos do mapa atual (a síntese de vídeo não os altera).
- observacoes: divergências relevantes. Máx. 2. Linguagem calma, sem julgamento.
  Vazio [] se não houver.

Regras:
- Não invente informações que não existam em nenhuma das fontes.
- Se os vídeos confirmam o mapa atual, mantenha o mapa atual.
- Se houver poucas leituras analisadas, seja conservador nas conclusões.
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

export async function enrichMapaWithVideoReadings(
  mapaAtual: IMapaData,
  synthesis: CreatorStrategicProfileSynthesis,
  locks?: CoreStabilityLocks,
  editedSections?: string[],
): Promise<IMapaData> {
  const TAG = "[mapaSeed][enrichMapaWithVideoReadings]";

  const digest = buildVideoSynthesisDigest(synthesis);

  // Sem leituras publicadas suficientes — mantém o mapa sem enriquecimento de vídeo.
  if (digest.leituras_analisadas < 1) {
    logger.warn(`${TAG} Nenhuma leitura publicada — mapa mantido sem enriquecimento de vídeo.`);
    return mapaAtual;
  }

  logger.info(
    `${TAG} Enriquecendo mapa com ${digest.leituras_analisadas} leitura(s) de vídeo publicada(s)...`,
  );

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

  const raw = await callClaudeJSON<RawEnriched>(buildPrompt(mapaAtual, digest), {
    intensity: "high",
    maxTokens: 1024,
  });

  if (!raw.narrativa_central || !raw.tom) {
    logger.error(`${TAG} Mapa enriquecido inválido:`, raw);
    throw new Error("Mapa enriquecido (vídeo) gerado sem campos obrigatórios.");
  }

  // Núcleo travado (G3): mesmo o vídeo (fonte mais autoritativa) respeita o que o
  // criador confirmou — mantém o confirmado e registra a divergência como observação.
  const { narrativaFinal, tomFinal, observacoes } = applyCoreStabilityLocks({
    mapaAtual,
    proposedNarrativa: raw.narrativa_central,
    proposedTom: raw.tom,
    baseObservacoes: raw.observacoes ?? [],
    locks,
    source: { narrativePrefix: "Seus vídeos sugerem", tonePhrase: "nos vídeos" },
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
    maturidade:            "video_enriched",
    fonte:                 ([...new Set([...mapaAtual.fonte, "video"])] as MapaFonte[]),
    observacoes:           observacoes.slice(0, 3),
    amostragem_instagram:  mapaAtual.amostragem_instagram,
  };

  logger.info(`${TAG} Mapa enriquecido com vídeo: "${mapaEnriquecido.narrativa_central}"`);
  return mapaEnriquecido;
}
