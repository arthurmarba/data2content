// src/app/lib/mapaSeed/analyzeVideoCoherence.ts
// Analisa se um vídeo (título + descrição) conecta com o mapa do criador.
// Modelo: gpt-4o · intensity: medium

import { callClaudeJSON } from "@/app/lib/claudeService";
import { logger } from "@/app/lib/logger";
import type { IMapaData } from "@/app/models/MapaSeed";
import type { ICoerenciaResult } from "@/app/models/VideoAsset";

// ─── Tipos de entrada ─────────────────────────────────────────────────────────

export interface VideoInput {
  titulo: string;
  descricao?: string | null;
  videoUrl?: string | null;
}

// ─── Prompt ───────────────────────────────────────────────────────────────────

function buildPrompt(mapa: IMapaData, video: VideoInput): string {
  return `Você é um sistema de análise de coerência narrativa para criadores de conteúdo.

Seu trabalho é avaliar se um vídeo conecta com o mapa narrativo do criador
— não julgar qualidade, não avaliar performance, não dar conselhos de crescimento.

Mapa do criador:
${JSON.stringify(
  {
    narrativa_central:     mapa.narrativa_central,
    territorios:           mapa.territorios,
    narrativas_adjacentes: mapa.narrativas_adjacentes,
    tom:                   mapa.tom,
    formatos:              mapa.formatos,
  },
  null,
  2
)}

Vídeo a analisar:
- Título: ${video.titulo}
- Descrição: ${video.descricao ?? "(sem descrição)"}
${video.videoUrl ? `- URL: ${video.videoUrl}` : ""}

Avalie a coerência e retorne JSON com exatamente estes campos:

- conecta: true se o vídeo conecta com a narrativa central ou territórios do mapa.
  false se diverge de forma relevante.

- justificativa: 1 parágrafo curto (máx. 60 palavras) explicando a conexão
  ou divergência. Tom calmo, descritivo — sem pressão, sem elogio vazio.
  Use linguagem do criador, não de coach de redes sociais.

- pontos_de_conexao: lista de até 3 elementos do vídeo que ressoam com o mapa.
  Frases curtas. Deixe vazio [] se não houver.

- pontos_de_divergencia: lista de até 2 elementos do vídeo que divergem do mapa.
  Frases curtas. Deixe vazio [] se não houver divergência.

Regras:
- Não invente análise além do título e descrição fornecidos.
- Não use termos como "viral", "engajamento", "algoritmo".
- Se o título for vago ou curto demais, seja honesto na justificativa.

Formato esperado:
{
  "conecta": boolean,
  "justificativa": "string",
  "pontos_de_conexao": ["string"],
  "pontos_de_divergencia": ["string"]
}

Retorne apenas JSON válido. Sem explicação adicional.`;
}

// ─── Função principal ─────────────────────────────────────────────────────────

export async function analyzeVideoCoherence(
  mapa: IMapaData,
  video: VideoInput
): Promise<ICoerenciaResult> {
  const TAG = "[mapaSeed][analyzeVideoCoherence]";
  logger.info(`${TAG} Analisando coerência: "${video.titulo}"`);

  const raw = await callClaudeJSON<ICoerenciaResult>(buildPrompt(mapa, video), {
    intensity: "medium",
    maxTokens: 512,
  });

  if (typeof raw.conecta !== "boolean" || !raw.justificativa) {
    logger.error(`${TAG} Resultado inválido:`, raw);
    throw new Error("Análise de coerência gerou resultado inválido.");
  }

  const result: ICoerenciaResult = {
    conecta:               raw.conecta,
    justificativa:         raw.justificativa,
    pontos_de_conexao:     raw.pontos_de_conexao     ?? [],
    pontos_de_divergencia: raw.pontos_de_divergencia ?? [],
  };

  logger.info(`${TAG} Conecta: ${result.conecta}. Justificativa: "${result.justificativa.slice(0, 80)}..."`);
  return result;
}
