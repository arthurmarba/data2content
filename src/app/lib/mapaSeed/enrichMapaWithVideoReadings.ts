// src/app/lib/mapaSeed/enrichMapaWithVideoReadings.ts
// Cruza o mapa atual (declarativo + Instagram) com a síntese das leituras de
// vídeo que o criador escolheu publicar, gerando um mapa mais fiel ao que ele
// de fato produz. Espelha o padrão de enrichMapaWithInstagram.
// Modelo: gpt-4o · intensity: high

import { callClaudeJSON } from "@/app/lib/claudeService";
import { logger } from "@/app/lib/logger";
import type { IMapaData, MapaFonte } from "@/app/models/MapaSeed";
import type { CreatorStrategicProfileSynthesis } from "@/app/dashboard/boards/videoUpload/creatorStrategicProfileSynthesis";
import { applyCoreStabilityLocks, type CoreStabilityLocks } from "./coreStabilityLocks";

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
levar ao público, não o que apenas declarou.

Mapa atual:
${JSON.stringify(mapa, null, 2)}

Síntese dos vídeos publicados (comportamento intencional):
${JSON.stringify(digest, null, 2)}

Gere o mapa enriquecido com os seguintes campos:

- narrativa_central: se a síntese de vídeo confirma o mapa atual, mantenha. Se
  revela algo mais específico ou diferente com confiança média/alta, atualize.
  Se a confiança da narrativa de vídeo for baixa, prefira o mapa atual.
  Máx. 20 palavras.

- territorios: combine os do mapa atual com os territórios narrativos dos vídeos.
  Remova o que não aparece em nenhuma fonte. Máx. 5 territórios.

- narrativas_adjacentes: extensões coerentes que aparecem nas bordas — mantenha
  as existentes e adicione se os padrões de vídeo sugerirem uma direção nova.

- assets: combine os do mapa atual com os assets recorrentes dos vídeos.

- tom: se o tom do mapa e o tom dominante dos vídeos divergirem, use o tom dos
  vídeos (comportamento real). Registre a divergência em "observacoes".

- formatos: mantenha os formatos do mapa atual (a síntese de vídeo não os altera).

- observacoes: lista de divergências relevantes entre o declarado e o real nos
  vídeos. Máx. 2 observações. Linguagem calma e descritiva, sem julgamento.
  Deixe vazio [] se não houver divergência relevante.

Regras:
- Não invente informações que não existam em nenhuma das fontes.
- Se os vídeos confirmam o mapa atual, mantenha o mapa atual.
- Se houver poucas leituras analisadas, seja conservador nas conclusões.

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

export async function enrichMapaWithVideoReadings(
  mapaAtual: IMapaData,
  synthesis: CreatorStrategicProfileSynthesis,
  locks?: CoreStabilityLocks,
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

  const mapaEnriquecido: IMapaData = {
    narrativa_central:     narrativaFinal,
    territorios:           raw.territorios           ?? mapaAtual.territorios,
    narrativas_adjacentes: raw.narrativas_adjacentes ?? mapaAtual.narrativas_adjacentes,
    assets:                raw.assets                ?? mapaAtual.assets,
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
