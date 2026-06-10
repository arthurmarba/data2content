// src/app/lib/mapaSeed/analyzeInstagramPosts.ts
// Analisa os posts do Instagram e extrai padrões narrativos.
//
// Caminho primário: Gemini 2.5 Flash multimodal — lê legendas de todos os posts
// + as thumbnails (imagens) dos posts de maior ressonância (saves+shares). A imagem
// é o sinal mais forte do Instagram e estava sendo descartada.
//
// Fallback (sem chave Gemini, em teste, ou se nenhuma imagem puder ser baixada):
// OpenAI gpt-4o só-texto (`callClaudeJSON` é o nome legado da função; o serviço
// usa OpenAI SDK por dentro).
//
// Não usa métricas como pressão de performance — saves/shares só priorizam QUAIS
// thumbnails merecem leitura visual profunda, nunca aparecem para o criador.

import { GoogleGenAI, createUserContent, createPartFromBase64, type Part } from "@google/genai";
import { callClaudeJSON } from "@/app/lib/claudeService";
import { logger } from "@/app/lib/logger";
import type { InstagramMedia } from "@/app/lib/instagram/types";

const TAG = "[mapaSeed][analyzeInstagramPosts]";

// ─── Tipos públicos ───────────────────────────────────────────────────────────

export type AmostragemInstagram = "suficiente" | "baixa" | "insuficiente";

export interface InstagramPostSummary {
  id: string;
  tipo: string;
  legenda: string;
  hashtags: string[];
  data: string;
  /** Melhor URL de imagem (capa) do post, quando disponível. */
  imageUrl: string | null;
}

export interface InstagramPatterns {
  temas_recorrentes: string[];
  tom_real: string;
  formatos_usados: string[];
  assets_identificados: string[];
  ausencias_notaveis: string[];
  amostragem: AmostragemInstagram;
}

export interface AnalyzeInstagramPostsOptions {
  /**
   * saves+shares por instagramMediaId — usado só internamente para priorizar
   * quais thumbnails recebem leitura visual. Nunca exposto ao criador.
   */
  resonanceByMediaId?: Map<string, number>;
  /** Quantas thumbnails enviar para leitura visual (default 12). */
  maxVisualPosts?: number;
}

// ─── Constantes ─────────────────────────────────────────────────────────────────

const MAX_POSTS = 30;
const DEFAULT_MAX_VISUAL_POSTS = 12;
const GEMINI_VISUAL_MODEL = "gemini-2.5-flash";
/** Acima disso, pula a imagem (thumbnails do IG são pequenas; isso é só guarda). */
const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const IMAGE_FETCH_TIMEOUT_MS = 8000;

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

/**
 * Resolve a melhor URL de imagem (capa) do post.
 * Espelha a lógica de coverUrl em metricActions.ts:
 *   carrossel → primeira mídia filha · vídeo → thumbnail · foto → media_url.
 */
function resolveImageUrl(post: InstagramMedia): string | null {
  if (post.media_type === "CAROUSEL_ALBUM") {
    const firstChild = post.children?.data?.[0];
    if (firstChild) {
      if (firstChild.media_type === "VIDEO") {
        return firstChild.thumbnail_url || firstChild.media_url || null;
      }
      return firstChild.media_url || firstChild.thumbnail_url || null;
    }
    return post.media_url || post.thumbnail_url || null;
  }
  if (post.media_type === "VIDEO") {
    return post.thumbnail_url || post.media_url || null;
  }
  return post.media_url || post.thumbnail_url || null;
}

function readGeminiApiKey(): string | null {
  return (
    process.env.GOOGLE_GEMINI_API_KEY?.trim() ||
    process.env.GEMINI_API_KEY?.trim() ||
    null
  );
}

/** Prepara posts da API para envio ao prompt — sem métricas */
export function preparePostSummaries(
  posts: InstagramMedia[],
  maxPosts = MAX_POSTS,
): InstagramPostSummary[] {
  return posts.slice(0, maxPosts).map((post) => ({
    id:       post.id,
    tipo:     mapMediaType(post.media_type),
    legenda:  (post.caption ?? "").slice(0, 500),
    hashtags: extractHashtags(post.caption ?? ""),
    data:     post.timestamp ?? "",
    imageUrl: resolveImageUrl(post),
  }));
}

/**
 * Seleciona os posts que recebem leitura visual: ranqueia por ressonância
 * (saves+shares) quando disponível; senão mantém a ordem de recência do fetch.
 * Só entram posts com imagem utilizável.
 */
export function selectVisualPosts(
  summaries: InstagramPostSummary[],
  resonanceByMediaId: Map<string, number> | undefined,
  max: number,
): InstagramPostSummary[] {
  const withImage = summaries.filter((s) => !!s.imageUrl);
  if (withImage.length === 0) return [];

  if (resonanceByMediaId && resonanceByMediaId.size > 0) {
    // Ordena por ressonância desc, estável para empates (mantém recência).
    return [...withImage]
      .map((s, i) => ({ s, i, r: resonanceByMediaId.get(s.id) ?? 0 }))
      .sort((a, b) => (b.r - a.r) || (a.i - b.i))
      .slice(0, max)
      .map((x) => x.s);
  }

  // Sem dados de ressonância: os mais recentes (fetch já vem em ordem desc).
  return withImage.slice(0, max);
}

// ─── Schema de resposta (compartilhado entre Gemini e gpt-4o) ───────────────────

const RESPONSE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "temas_recorrentes",
    "tom_real",
    "formatos_usados",
    "assets_identificados",
    "ausencias_notaveis",
  ],
  properties: {
    temas_recorrentes:    { type: "array", maxItems: 5, items: { type: "string", maxLength: 80 } },
    tom_real:             { type: "string", maxLength: 200 },
    formatos_usados:      { type: "array", maxItems: 6, items: { type: "string", maxLength: 40 } },
    assets_identificados: { type: "array", maxItems: 6, items: { type: "string", maxLength: 80 } },
    ausencias_notaveis:   { type: "array", maxItems: 5, items: { type: "string", maxLength: 80 } },
  },
} as const;

type RawPatterns = Omit<InstagramPatterns, "amostragem">;

function normalizeRaw(raw: Partial<RawPatterns> | null | undefined, amostragem: AmostragemInstagram): InstagramPatterns {
  return {
    temas_recorrentes:    raw?.temas_recorrentes    ?? [],
    tom_real:             raw?.tom_real             ?? "",
    formatos_usados:      raw?.formatos_usados      ?? [],
    assets_identificados: raw?.assets_identificados ?? [],
    ausencias_notaveis:   raw?.ausencias_notaveis   ?? [],
    amostragem,
  };
}

// ─── Prompts ────────────────────────────────────────────────────────────────────

const SYSTEM_INSTRUCTION = [
  "Você é um sistema de análise narrativa para criadores de conteúdo da plataforma Data2Content.",
  "Sua tarefa é identificar padrões nos posts do Instagram de um criador — não avaliar performance,",
  "mas entender o que aparece de forma recorrente e o que isso revela sobre quem ele é.",
  "Você recebe as legendas de todos os posts e as IMAGENS (capas) dos posts mais representativos.",
  "Use as imagens como sinal principal de assets e território visual; use as legendas para tom e temas.",
  "Não faça julgamentos de valor. Não invente contexto externo. NUNCA use: algoritmo, viralizar,",
  "engajamento, tendência, crescimento, seguidores.",
].join("\n");

function buildTaskInstruction(summaries: InstagramPostSummary[], hasImages: boolean): string {
  return [
    `Posts analisados (${summaries.length} legendas${hasImages ? ", com imagens dos mais representativos" : ""}):`,
    JSON.stringify(summaries.map(({ id, tipo, legenda, hashtags, data }) => ({ id, tipo, legenda, hashtags, data })), null, 2),
    "",
    "Extraia exatamente os seguintes padrões:",
    "",
    "- temas_recorrentes: assuntos que aparecem com mais frequência nas legendas, hashtags",
    hasImages ? "  E nas imagens. Máx. 5. Substantivos ou frases curtas." : "  Máx. 5. Substantivos ou frases curtas.",
    "- tom_real: como o criador se comunica de verdade — uma frase descritiva",
    '  (ex: "casual e direto, com humor seco"). Baseie-se no estilo das legendas.',
    "- formatos_usados: quais tipos de post predominam (Foto, Vídeo, Carrossel, Story).",
    "- assets_identificados: elementos concretos da vida do criador que aparecem no conteúdo",
    hasImages
      ? "  (lugares, situações, pessoas, objetos, rotinas) — priorize o que você VÊ nas imagens. Máx. 6. Vazio se nada concreto."
      : "  (lugares, situações, pessoas, objetos, rotinas). Máx. 6. Vazio se nada concreto.",
    "- ausencias_notaveis: assuntos ou formatos que parecem ausentes considerando o perfil geral.",
    "  Não invente contexto externo. Vazio se não houver evidência clara.",
    "",
    "Responda em JSON estrito conforme o schema. Sem explicação adicional.",
  ]
    .filter(Boolean)
    .join("\n");
}

// ─── Caminho gpt-4o (texto-only, fallback) ──────────────────────────────────────

async function analyzeTextOnly(
  summaries: InstagramPostSummary[],
  amostragem: AmostragemInstagram,
): Promise<InstagramPatterns> {
  const prompt = [
    SYSTEM_INSTRUCTION,
    "",
    buildTaskInstruction(summaries, false),
    "",
    "Formato esperado:",
    '{ "temas_recorrentes": ["string"], "tom_real": "string", "formatos_usados": ["string"], "assets_identificados": ["string"], "ausencias_notaveis": ["string"] }',
  ].join("\n");

  const raw = await callClaudeJSON<RawPatterns>(prompt, { intensity: "medium", maxTokens: 1024 });
  return normalizeRaw(raw, amostragem);
}

// ─── Caminho Gemini multimodal (primário) ───────────────────────────────────────

/** Baixa uma imagem e devolve um Part inline base64, ou null em qualquer falha. */
async function fetchImagePart(url: string): Promise<Part | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), IMAGE_FETCH_TIMEOUT_MS);
    let res: Response;
    try {
      res = await fetch(url, { signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
    if (!res.ok) return null;
    const contentType = res.headers.get("content-type") ?? "";
    const mimeType = contentType.startsWith("image/") ? (contentType.split(";")[0] || "image/jpeg") : "image/jpeg";
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.byteLength === 0 || buf.byteLength > MAX_IMAGE_BYTES) return null;
    return createPartFromBase64(buf.toString("base64"), mimeType);
  } catch {
    return null;
  }
}

async function analyzeWithGeminiMultimodal(
  apiKey: string,
  summaries: InstagramPostSummary[],
  visualPosts: InstagramPostSummary[],
  amostragem: AmostragemInstagram,
): Promise<InstagramPatterns | null> {
  // Baixa as thumbnails em paralelo; cada falha vira null e é descartada.
  const fetched = await Promise.all(
    visualPosts.map(async (post) => ({
      post,
      part: post.imageUrl ? await fetchImagePart(post.imageUrl) : null,
    })),
  );
  const imageParts = fetched.filter((x): x is { post: InstagramPostSummary; part: Part } => !!x.part);

  if (imageParts.length === 0) {
    logger.warn(`${TAG} Nenhuma thumbnail pôde ser baixada — caindo no caminho de texto.`);
    return null;
  }

  const parts: Array<string | Part> = [buildTaskInstruction(summaries, true)];
  for (const { post, part } of imageParts) {
    parts.push(`Imagem do post ${post.id} (${post.tipo}):`);
    parts.push(part);
  }

  const genAI = new GoogleGenAI({ apiKey });
  const response = await genAI.models.generateContent({
    model: GEMINI_VISUAL_MODEL,
    contents: createUserContent(parts),
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      responseMimeType: "application/json",
      responseSchema: RESPONSE_SCHEMA,
      temperature: 0.2,
    },
  });

  const text = response.text;
  if (!text) return null;
  let raw: Partial<RawPatterns>;
  try {
    raw = JSON.parse(text);
  } catch {
    logger.warn(`${TAG} Resposta multimodal não-JSON — caindo no caminho de texto.`);
    return null;
  }
  logger.info(`${TAG} Leitura visual concluída com ${imageParts.length} thumbnails.`);
  return normalizeRaw(raw, amostragem);
}

// ─── Função principal ─────────────────────────────────────────────────────────

export async function analyzeInstagramPosts(
  posts: InstagramMedia[],
  options?: AnalyzeInstagramPostsOptions,
): Promise<InstagramPatterns> {
  const summaries = preparePostSummaries(posts);
  const amostragem = classifyAmostragem(summaries.length);

  logger.info(`${TAG} Analisando ${summaries.length} posts. Amostragem: ${amostragem}`);

  // Com menos de 5 posts, retorna amostragem insuficiente sem chamar a IA
  if (amostragem === "insuficiente") {
    logger.warn(`${TAG} Histórico insuficiente (${summaries.length} posts). Pulando análise.`);
    return normalizeRaw(null, amostragem);
  }

  // Caminho primário: Gemini multimodal (lê as thumbnails dos posts de maior ressonância).
  // Pulado em teste e quando não há chave — cai para gpt-4o texto-only.
  const geminiKey = readGeminiApiKey();
  if (geminiKey && process.env.NODE_ENV !== "test") {
    try {
      const visualPosts = selectVisualPosts(
        summaries,
        options?.resonanceByMediaId,
        options?.maxVisualPosts ?? DEFAULT_MAX_VISUAL_POSTS,
      );
      if (visualPosts.length > 0) {
        const visual = await analyzeWithGeminiMultimodal(geminiKey, summaries, visualPosts, amostragem);
        if (visual) return visual;
      } else {
        logger.info(`${TAG} Nenhum post com imagem utilizável — usando caminho de texto.`);
      }
    } catch (err) {
      logger.warn(`${TAG} Leitura visual falhou (ignorada, caindo no texto):`, err);
    }
  }

  // Fallback: análise textual via gpt-4o (comportamento histórico).
  return analyzeTextOnly(summaries, amostragem);
}
