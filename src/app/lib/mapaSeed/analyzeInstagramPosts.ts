// src/app/lib/mapaSeed/analyzeInstagramPosts.ts
// Analisa os posts do Instagram e extrai padrões narrativos.
// Modelo: gpt-4o · intensity: medium
//
// Não usa métricas de performance — só narrativa:
// temas, tom real, formatos, assets, e o que está ausente.

import { callClaudeJSON } from "@/app/lib/claudeService";
import { logger } from "@/app/lib/logger";
import type { InstagramMedia } from "@/app/lib/instagram/types";

// ─── Tipos públicos ───────────────────────────────────────────────────────────

export type AmostragemInstagram = "suficiente" | "baixa" | "insuficiente";

export interface InstagramPostSummary {
  tipo: string;
  legenda: string;
  hashtags: string[];
  data: string;
}

export interface InstagramPatterns {
  temas_recorrentes: string[];
  tom_real: string;
  formatos_usados: string[];
  assets_identificados: string[];
  ausencias_notaveis: string[];
  amostragem: AmostragemInstagram;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Mapeia media_type da API do Instagram para rótulo legível */
function mapMediaType(type: string | undefined): string {
  switch (type) {
    case "IMAGE":          return "Foto";
    case "VIDEO":          return "Vídeo";
    case "CAROUSEL_ALBUM": return "Carrossel";
    case "STORY":          return "Story";
    default:               return "Desconhecido";
  }
}

/** Extrai hashtags de uma legenda */
function extractHashtags(caption: string): string[] {
  return (caption.match(/#\w+/g) ?? []).map((h) => h.toLowerCase());
}

/** Classifica o tamanho da amostragem */
function classifyAmostragem(count: number): AmostragemInstagram {
  if (count >= 10) return "suficiente";
  if (count >= 5)  return "baixa";
  return "insuficiente";
}

/** Prepara posts da API para envio ao prompt — sem métricas */
export function preparePostSummaries(
  posts: InstagramMedia[],
  maxPosts = 30
): InstagramPostSummary[] {
  return posts.slice(0, maxPosts).map((post) => ({
    tipo:      mapMediaType(post.media_type),
    legenda:   (post.caption ?? "").slice(0, 500),
    hashtags:  extractHashtags(post.caption ?? ""),
    data:      post.timestamp ?? "",
  }));
}

// ─── Prompt ───────────────────────────────────────────────────────────────────

function buildPrompt(summaries: InstagramPostSummary[]): string {
  return `Você é um sistema de análise narrativa para criadores de conteúdo.

Sua tarefa é identificar padrões nos posts do Instagram de um criador
— não avaliar performance, mas entender o que aparece de forma recorrente
e o que isso revela sobre quem ele é.

Posts analisados (${summaries.length} posts):
${JSON.stringify(summaries, null, 2)}

Extraia exatamente os seguintes padrões:

- temas_recorrentes: lista dos assuntos que aparecem com mais frequência
  nas legendas e hashtags. Máx. 5 temas. Use substantivos ou frases curtas.

- tom_real: como o criador escreve de verdade — uma frase descritiva
  (ex: "casual e direto, com humor seco"). Baseie-se no estilo das legendas.

- formatos_usados: quais tipos de post predominam entre
  Foto, Vídeo, Carrossel, Story.

- assets_identificados: elementos concretos da vida do criador que
  aparecem no conteúdo (lugares, situações, pessoas, objetos, rotinas).
  Máx. 4 itens. Deixe vazio se não identificar nada concreto.

- ausencias_notaveis: assuntos ou formatos que parecem ausentes
  considerando o perfil geral do criador — não invente contexto externo.
  Deixe vazio se não houver evidência clara de ausência.

Retorne apenas JSON válido. Sem explicação adicional.
Não faça julgamentos de valor sobre o conteúdo.

Formato esperado:
{
  "temas_recorrentes": ["string"],
  "tom_real": "string",
  "formatos_usados": ["string"],
  "assets_identificados": ["string"],
  "ausencias_notaveis": ["string"]
}`;
}

// ─── Função principal ─────────────────────────────────────────────────────────

export async function analyzeInstagramPosts(
  posts: InstagramMedia[]
): Promise<InstagramPatterns> {
  const TAG = "[mapaSeed][analyzeInstagramPosts]";

  const summaries = preparePostSummaries(posts);
  const amostragem = classifyAmostragem(summaries.length);

  logger.info(`${TAG} Analisando ${summaries.length} posts. Amostragem: ${amostragem}`);

  // Com menos de 5 posts, retorna amostragem insuficiente sem chamar a IA
  if (amostragem === "insuficiente") {
    logger.warn(`${TAG} Histórico insuficiente (${summaries.length} posts). Pulando análise.`);
    return {
      temas_recorrentes:  [],
      tom_real:           "",
      formatos_usados:    [],
      assets_identificados: [],
      ausencias_notaveis: [],
      amostragem,
    };
  }

  type RawPatterns = Omit<InstagramPatterns, "amostragem">;

  const raw = await callClaudeJSON<RawPatterns>(buildPrompt(summaries), {
    intensity: "medium",
    maxTokens: 1024,
  });

  return {
    temas_recorrentes:    raw.temas_recorrentes    ?? [],
    tom_real:             raw.tom_real             ?? "",
    formatos_usados:      raw.formatos_usados      ?? [],
    assets_identificados: raw.assets_identificados ?? [],
    ausencias_notaveis:   raw.ausencias_notaveis   ?? [],
    amostragem,
  };
}
