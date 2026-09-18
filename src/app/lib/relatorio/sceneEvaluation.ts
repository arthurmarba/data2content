import { compactVideoPrompt, expandCompactScene, LEGACY_SCENE_FORMAT, COMPACT_SCENE_FORMAT, type SceneResponseFormat } from "./compactSceneFormat";
import { resolveSceneFormat } from "./sceneReadingRollout";
import { governedGenerateContent, withGeminiGovernance, governanceHash, recordGeminiOutcome } from "@/app/lib/llm/geminiGovernance";
import { VISUAL_READING_REVISION } from "./readingRevision";
import type { PublishedMediaItem } from "./publishedMedia";
/**
 * sceneEvaluation.ts — avalia um vídeo da semana CONTRA o mapa do criador.
 *
 * A diferença em relação a `sceneExtraction.ts`, que isto substitui: lá a pergunta era
 * aberta ("classifique este vídeo num vocabulário global de 24 papéis"); aqui é
 * FECHADA ("quais destes 7 assets do mapa DELE aparecem neste vídeo?").
 *
 * Isso importa por três razões:
 *
 *   • É o que a arquitetura pede. O card "Seu Mapa" é o dicionário e muda devagar; a
 *     semana é a medição. O worker não descobre categorias — ele confere quais das
 *     categorias já declaradas se realizaram.
 *
 *   • É mais barato e mais preciso. O prompt encolhe de 24 papéis genéricos para os 5–8
 *     itens do mapa daquele criador, com o rótulo que ELE escreveu ("a esposa",
 *     "a cozinha bagunçada"). Reconhecer "a esposa está em cena" é uma pergunta muito
 *     mais fácil que "que papel social aparece aqui".
 *
 *   • Fecha o ciclo do produto. Quando o vídeo não tem nada do mapa, isso é um sinal
 *     sobre o mapa — não um erro de classificação.
 *
 * A Regra 3 continua garantida pelo registro: o modelo responde com o rótulo do
 * criador e `sceneEvaluation` devolve o PAPEL canônico. "a esposa (Lívia)" entra,
 * "parceiro em cena" sai.
 */

import os from "node:os";
import path from "node:path";
import { promises as fs } from "node:fs";
import { randomUUID } from "node:crypto";
import {
  GoogleGenAI,
  createPartFromBase64,
  createPartFromUri,
  createUserContent,
  type PartMediaResolutionLevel,
} from "@google/genai";
import { logger } from "@/app/lib/logger";
import { GEMINI_INLINE_VIDEO_BYTES_LIMIT } from "@/app/dashboard/boards/videoUpload/videoNarrativeGeminiInlineLimit";
import {
  CANONICAL_AESTHETICS,
  CANONICAL_FRAMINGS,
  CANONICAL_PLACES,
  canonicalToneById,
} from "./mapRegistry";
import type { MapProfile } from "./mapProfiles";

const TAG = "[relatorio][sceneEvaluation]";

/**
 * Acima deste tamanho o vídeo vai pela Files API em vez de inline.
 *
 * 14MB, não 18: o part inline viaja em base64 dentro do request, o base64 infla ~33%,
 * e o Gemini corta o request em ~20MB. Um vídeo de 18MB vira ~24MB de payload e o
 * request é rejeitado. Medido: 2 dos primeiros 11 reels da base passavam de 18MB, então
 * sem o caminho da Files API o relatório perderia ~20% dos vídeos.
 */
export const MAX_INLINE_VIDEO_BYTES = GEMINI_INLINE_VIDEO_BYTES_LIMIT;
/** Tentativas de envio pela Files API antes de desistir do vídeo. A reprovação é
 * moeda ao ar: com duas tentativas ainda sobrava um quarto do lote no chão. */
const UPLOAD_ATTEMPTS = 3;

/** Teto absoluto: acima disso nem pela Files API vale a pena — não é reel. */
export const MAX_VIDEO_BYTES = 200 * 1024 * 1024;
export const MAX_VIDEO_SECONDS = 180;
export const MAX_VISUAL_IMAGE_BYTES = 6 * 1024 * 1024;
// Não há corte silencioso de slides: todo item informado precisa ser lido.
/**
 * Versão do contrato de avaliação. É a chave de idempotência: o worker pula qualquer
 * post que já tenha esta versão gravada.
 *
 * SÓ mude quando o PROMPT ou o vocabulário mudarem de forma que invalide o que já foi
 * lido — mudar aqui obriga a reavaliar a base inteira, e isso custa.
 *
 * v2: o prompt passou a levar também os ASSUNTOS do mapa (`mapa.temas`) e a perguntar
 * quais deles o vídeo tratou. Os registros v1 não têm `subjectIds` e por isso precisam
 * ser refeitos — sem isso a tela 04 continuaria mostrando intenção em vez de assunto.
 *
 * v3: o segundo eixo. Até aqui a resposta era 100% fechada, e por isso o relatório
 * repetia a grossura do mapa: "Casa" para quem gravou no quarto, na sala e na varanda;
 * "Objeto do cotidiano" para uma boneca. A v3 mantém a pergunta fechada (é ela que
 * torna os criadores comparáveis) e acrescenta o que só o VÍDEO sabe — o cômodo, o
 * objeto pelo nome, o título na tela e a primeira fala. Também aperta o critério de
 * roupa, que na v2 acendia em todo vídeo porque todo mundo grava vestido.
 */
export const SCENE_EVALUATION_VERSION = "cena_mapa_v4";

/** O que o worker gravou: papéis do mapa presentes no vídeo. */
export interface SceneEvaluation {
  /** Papéis canônicos presentes. É isto que o relatório ranqueia. */
  slides?: Array<{ position: number; type: "IMAGE" | "VIDEO"; role: string; description: string; onScreenText: string | null; transcript: string | null }>;
  responseFormat?: SceneResponseFormat;
  readingCompleteness?: "complete" | "partial";
  visualCoverage?: { expected: number; analyzed: number; complete: boolean };
  assetRoleIds: string[];
  /** Tons canônicos do mapa identificados na fala/cena. */
  toneIds: string[];
  /**
   * Assuntos do MAPA que o vídeo abordou. Vocabulário fechado de 20 gavetas, mantido
   * só como agrupamento grosso — é o que permite dizer "Criar filho" quando se quer
   * juntar. O que o relatório mostra é `subjects`, abaixo.
   */
  subjectIds: string[];
  /**
   * Sobre o que o vídeo falou, NOMEADO PELO VÍDEO e em texto livre: "voltar a
   * trabalhar depois da licença", e não "Criar filho".
   *
   * Aberto de propósito. As 20 gavetas do mapa espremiam tudo em rótulos vagos, e um
   * relatório que se repete toda semana precisa da frase específica — é ela que muda.
   * Duas criadoras que falarem da mesma coisa com as mesmas palavras se juntam e a
   * linha ganha peso; se ninguém repetir, a linha fica embaixo. Ver `weight.ts`.
   */
  subjects: string[];
  /** Trechos ditos, verbatim. Não é resumo — é o que saiu da boca. */
  quotes: string[];
  /** Enquadramentos de `CANONICAL_FRAMINGS`. */
  framingIds: string[];
  /** Traços estéticos de `CANONICAL_AESTHETICS`. */
  aestheticIds: string[];
  /**
   * Onde foi gravado, no vocabulário GLOBAL de `CANONICAL_PLACES` — não no do mapa.
   * É o que responde "sala, quarto ou varanda?" quando o mapa só sabe dizer "casa".
   */
  placeId: string | null;
  /**
   * Os objetos em cena, pelo nome, em texto livre e no máximo 3: "caneca", "carrinho
   * de bebê", "câmera". Não entra em ranking — entra na leitura. "Objeto do cotidiano"
   * não diz nada; "segurando uma caneca" diz.
   */
  objects: string[];
  /** O texto na tela na abertura, verbatim. Vazio quando não há. */
  screenTitle: string | null;
  /** A primeira frase falada, verbatim. É o gancho — e é o que se discute na reunião. */
  openingLine: string | null;
  /** Transcrição integral sanitizada do áudio. Fica em storage próprio, não em Metric.sceneElements. */
  transcript: string | null;
  transcriptSegments: Array<{ startMs: number | null; endMs: number | null; text: string }>;
  sceneTimeline: Array<{
    startMs: number | null;
    endMs: number | null;
    role: string;
    description: string;
    spokenText: string | null;
    onScreenText: string | null;
    setting: string | null;
    objects: string[];
    framing: string[];
  }>;
  narrativeStructure: string[];
  promise: string | null;
  cta: string | null;
  /**
   * true quando NENHUM item do mapa apareceu. Não é erro: é sinal de que o vídeo saiu
   * do mapa, e isso é assunto de reunião.
   */
  offMap: boolean;
  provider: string;
  version: string;
}

export function buildPrompt(profile: MapProfile): { system: string; user: string; format: string } {
  const assetLines = profile.assets
    .map((asset, index) => `A${index + 1}. ${asset.ownLabel}`)
    .join("\n");
  const toneLines = profile.toneIds
    .map((toneId, index) => `T${index + 1}. ${canonicalToneById(toneId)?.label ?? toneId}`)
    .join("\n");
  // Os temas vão com a FRASE do criador — reconhecer "sair do trabalho a tempo de viver
  // a vida familiar" num vídeo é muito mais fácil que classificar o assunto do zero.
  const subjectLines = profile.subjects
    .map((subject, index) => `S${index + 1}. ${subject.ownLabel}`)
    .join("\n");
  // A lista de lugares é a MESMA para todo criador — é isso que permite ranquear
  // cômodo entre criadores, coisa que o rótulo livre do mapa nunca permitiria.
  const placeLines = CANONICAL_PLACES.map(
    (place, index) => `L${index + 1}. ${place.label} — ${place.hint}`,
  ).join("\n");
  const framingLines = CANONICAL_FRAMINGS.map(
    (trait, index) => `E${index + 1}. ${trait.label} — ${trait.hint}`,
  ).join("\n");
  const aestheticLines = CANONICAL_AESTHETICS.map(
    (trait, index) => `Q${index + 1}. ${trait.label} — ${trait.hint}`,
  ).join("\n");

  const system = `Você confere se elementos JÁ CONHECIDOS de um criador aparecem em um vídeo dele.

Você NÃO descobre categorias novas, NÃO avalia qualidade e NÃO interpreta intenção. Você responde uma pergunta de presença: cada item da lista aparece neste vídeo, ou não?

Critério de presença para PESSOA ou ANIMAL: aparece em imagem, ou é ouvido, ou é dirigido diretamente pela fala do criador ("a mãe aqui atrás", "fala pro papai"). Mencionar de passada não conta.
Critério para LUGAR: é o cenário de pelo menos metade do vídeo.
Critério para OBJETO: aparece em imagem de forma reconhecível E tem função no vídeo — é usado, mostrado de propósito, comentado ou é o motivo da gravação.
Critério para ROUPA, LOOK ou ACESSÓRIO: só conta quando a roupa É o assunto — é mostrada de propósito, provada, citada, tem a marca dita, ou o vídeo existe para exibi-la. NÃO conta a roupa que a pessoa simplesmente está vestindo enquanto fala de outra coisa. Todo vídeo tem alguém vestido; quase nenhum é sobre roupa.
Critério para ASSUNTO: o vídeo trata daquilo — na fala, no texto na tela ou na própria situação mostrada. Não basta ser compatível com o assunto; tem que ser sobre ele.

Na dúvida, NÃO marque. Um falso positivo entra no ranking do território e engana todo mundo; um falso negativo só perde um dado.

Depois da conferência, você também DESCREVE quatro coisas que só quem viu o vídeo sabe. Aí não há lista do criador: você observa e relata, sem interpretar.`;

  const user = `ELEMENTOS DO MAPA DESTE CRIADOR

Assets de vida:
${assetLines || "(nenhum)"}

Tons de fala:
${toneLines || "(nenhum)"}

Assuntos que ele costuma tratar:
${subjectLines || "(nenhum)"}

Responda quais aparecem neste vídeo, pelos códigos.

ONDE FOI GRAVADO — UM código desta lista fixa, o lugar de mais da metade do vídeo:
${placeLines}

ENQUADRAMENTO — todos os códigos que se aplicam:
${framingLines}

ESTÉTICA — todos os códigos que se aplicam:
${aestheticLines}`;

  const format = `Responda SÓ com JSON, sem cercas de código:
{"assets":["A1","A3"],"tons":["T2"],"assuntos":["S1"],"local":"L2","enquadramento":["E1","E5"],"estetica":["Q1","Q3"],"temas":["voltar a trabalhar depois da licença","culpa de deixar a filha na creche"],"objetos":["caneca","carrinho de bebê"],"falas":["eu chorei no estacionamento no primeiro dia","ninguém te prepara pra isso"],"titulo":"3 coisas que ninguém te conta","fala":"Gente, eu preciso falar sobre ontem","transcricao":"transcrição integral e literal na ordem em que foi falada","segmentos":[{"inicioMs":0,"fimMs":4200,"texto":"Gente, eu preciso falar sobre ontem"}],"cenas":[{"inicioMs":0,"fimMs":4200,"papel":"gancho","descricao":"close no rosto na cozinha","fala":"Gente, eu preciso falar sobre ontem","textoTela":"3 coisas que ninguém te conta","cenario":"cozinha","objetos":["caneca"],"enquadramentos":["close"]}],"estrutura":["gancho","contexto","virada","cta"],"promessa":"explicar o que aconteceu ontem","cta":"me conta se você já passou por isso"}

assets / tons / assuntos: só os códigos presentes. Listas vazias são resposta válida e esperada.
local: um código L, ou null se nenhum servir.
enquadramento / estetica: os códigos que se aplicam; liste todos, não escolha um só.
temas: de 1 a 4 assuntos que o vídeo tratou, ESPECÍFICOS e nas palavras do próprio vídeo. Escreva como quem descreve para quem não assistiu: "voltar a trabalhar depois da licença", não "maternidade"; "organizar a geladeira depois da feira", não "cozinha". Minúsculas, sem ponto final, no máximo 8 palavras cada. Genérico demais não serve — se der pra usar o mesmo tema em 100 vídeos diferentes, está vago.
objetos: até 4 objetos que aparecem em cena com função, 1 a 3 palavras, minúsculas, sem marca ("caneca", não "caneca da Stanley"). Lista vazia é válida.
falas: até 3 trechos ditos no vídeo, COPIADOS exatamente como foram falados. Prefira os que carregam a ideia do vídeo. Lista vazia se ninguém fala.
titulo: o texto escrito NA TELA na abertura, copiado exatamente. "" se não houver.
fala: a primeira frase dita em voz, copiada exatamente. "" se ninguém fala.
transcricao: copie integralmente o que foi falado, na ordem, sem resumir nem corrigir a linguagem. "" quando não houver áudio/fala. Nunca inclua descrição visual aqui.
segmentos: blocos consecutivos da fala com inicioMs/fimMs dentro da duração. Preserve o texto literal. Lista vazia quando não houver fala.
cenas: de 1 a 12 blocos temporais observáveis. papel deve ser um de gancho, contexto, problema, demonstração, prova, explicação, virada, entrega, cta ou outro. Não invente milissegundos fora do vídeo.
estrutura: sequência dos papéis narrativos realmente presentes, sem duplicações consecutivas.
promessa: o que a abertura promete entregar, em uma frase; "" se não houver promessa clara.
cta: a chamada final copiada ou descrita de forma literal; "" se não houver.`;

  return { system, user, format };
}

/**
 * O documento a gravar em `Metric.sceneElements`.
 *
 * Existe porque a escrita estava DUPLICADA em dois lugares — o worker do QStash e o
 * script de backfill — e os dois divergiram assim que a v3 acrescentou campos: o worker
 * passou a gravar tema, objeto e fala, e o backfill continuou gravando só os três
 * campos da v2, em silêncio. O resultado é o pior tipo de bug de dado, porque a leitura
 * do vídeo foi paga e jogada fora.
 *
 * Quem grava cena grava por aqui.
 */
export function sceneElementsUpdate(scene: SceneEvaluation): Record<string, unknown> {
  return {
    assetRoleIds: scene.assetRoleIds,
    toneIds: scene.toneIds,
    subjectIds: scene.subjectIds,
    subjects: scene.subjects,
    objects: scene.objects,
    quotes: scene.quotes,
    placeId: scene.placeId,
    framingIds: scene.framingIds,
    aestheticIds: scene.aestheticIds,
    screenTitle: scene.screenTitle,
    openingLine: scene.openingLine,
    offMap: scene.offMap,
    provider: scene.provider,
    version: scene.version,
    readingCompleteness: scene.readingCompleteness ?? "complete",
    analyzedAt: new Date(),
  };
}

/**
 * Higiene do texto livre que volta do modelo.
 *
 * Tema, objeto e fala são as três coisas que NÃO têm vocabulário fechado, e é aí que
 * mora a riqueza do relatório — mas texto livre de modelo entra no sistema com o
 * mesmo cuidado que entraria texto de usuário: recorta, normaliza, deduplica.
 *
 * A normalização não é cosmética: é ela que faz duas criadoras que disseram a mesma
 * coisa virarem UMA linha com peso 2 em vez de duas linhas com peso 1 (ver `weight.ts`).
 * Sem isso, "Voltar a trabalhar depois da licença." e "voltar a trabalhar depois da
 * licença" nunca se encontrariam.
 */
function freeTextList(
  value: unknown,
  options: { maxItems: number; maxChars: number; keepCase?: boolean },
): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    if (typeof item !== "string") continue;
    let text = item.replace(/\s+/g, " ").trim().replace(/[.;,]+$/, "");
    if (!options.keepCase) text = text.toLowerCase();
    if (!text || text.length > options.maxChars) continue;
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(text);
    if (out.length >= options.maxItems) break;
  }
  return out;
}

/** Título na tela e primeira fala: uma linha, verbatim, ou nada. */
function singleLine(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const text = value.replace(/\s+/g, " ").trim();
  return text && text.length <= 300 ? text : null;
}

function longText(value: unknown, maxChars = 30_000): string | null {
  if (typeof value !== "string") return null;
  const text = value.replace(/\r\n/g, "\n").replace(/[ \t]+/g, " ").trim();
  return text ? text.slice(0, maxChars) : null;
}

function milliseconds(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? Math.round(value)
    : null;
}

function transcriptSegments(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 160).flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const raw = item as Record<string, unknown>;
    const text = longText(raw.texto, 1600);
    if (!text) return [];
    const startMs = milliseconds(raw.inicioMs);
    const rawEnd = milliseconds(raw.fimMs);
    return [{
      startMs,
      endMs: rawEnd !== null && (startMs === null || rawEnd >= startMs) ? rawEnd : null,
      text,
    }];
  });
}

function sceneTimeline(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 40).flatMap((item, index) => {
    if (!item || typeof item !== "object") return [];
    const raw = item as Record<string, unknown>;
    const description = longText(raw.descricao, 800);
    if (!description) return [];
    const startMs = milliseconds(raw.inicioMs);
    const rawEnd = milliseconds(raw.fimMs);
    return [{
      startMs,
      endMs: rawEnd !== null && (startMs === null || rawEnd >= startMs) ? rawEnd : null,
      role: singleLine(raw.papel)?.slice(0, 60) || `scene_${index + 1}`,
      description,
      spokenText: longText(raw.fala, 2000),
      onScreenText: singleLine(raw.textoTela)?.slice(0, 500) || null,
      setting: singleLine(raw.cenario)?.slice(0, 120) || null,
      objects: freeTextList(raw.objetos, { maxItems: 8, maxChars: 80, keepCase: true }),
      framing: freeTextList(raw.enquadramentos, { maxItems: 8, maxChars: 80, keepCase: true }),
    }];
  });
}

/** Traduz os códigos A1/T2 de volta para os papéis canônicos. */
export function parseSceneEvaluation(
  text: string | null | undefined,
  profile: MapProfile,
  options?: { format: SceneResponseFormat; durationSeconds: number | null; partial?: boolean },
): SceneEvaluation | null {
  if (!text?.trim()) return null;
  const cleaned = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start === -1 || end <= start) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const raw = options?.format === COMPACT_SCENE_FORMAT
    ? expandCompactScene(parsed as Record<string, unknown>, options.durationSeconds, options.partial)
    : parsed as Record<string, unknown>;
  if (!raw) return null;

  const codes = (value: unknown, prefix: "A" | "T" | "S" | "L" | "E" | "Q"): number[] => {
    const list = Array.isArray(value) ? value : [];
    const out: number[] = [];
    for (const item of list) {
      if (typeof item !== "string") continue;
      const match = new RegExp(`^${prefix}(\\d+)$`, "i").exec(item.trim());
      if (!match) continue;
      const index = Number(match[1]) - 1;
      if (index >= 0 && !out.includes(index)) out.push(index);
    }
    return out;
  };

  // Índice fora da lista do criador é descartado — o modelo não pode inventar item.
  const assetRoleIds: string[] = [];
  for (const index of codes(raw.assets, "A")) {
    const asset = profile.assets[index];
    if (asset && !assetRoleIds.includes(asset.roleId)) assetRoleIds.push(asset.roleId);
  }
  const toneIds: string[] = [];
  for (const index of codes(raw.tons, "T")) {
    const toneId = profile.toneIds[index];
    if (toneId && !toneIds.includes(toneId)) toneIds.push(toneId);
  }

  const subjectIds: string[] = [];
  for (const index of codes(raw.assuntos, "S")) {
    const subject = profile.subjects[index];
    if (subject && !subjectIds.includes(subject.subjectId)) subjectIds.push(subject.subjectId);
  }

  const placeId = CANONICAL_PLACES[codes([raw.local], "L")[0] ?? -1]?.id ?? null;
  const framingIds = codes(raw.enquadramento, "E")
    .map((index) => CANONICAL_FRAMINGS[index]?.id)
    .filter((id): id is string => Boolean(id));
  const aestheticIds = codes(raw.estetica, "Q")
    .map((index) => CANONICAL_AESTHETICS[index]?.id)
    .filter((id): id is string => Boolean(id));

  const subjects = freeTextList(raw.temas, { maxItems: 4, maxChars: 80 });
  const objects = freeTextList(raw.objetos, { maxItems: 4, maxChars: 32 });
  const quotes = freeTextList(raw.falas, { maxItems: 3, maxChars: 220, keepCase: true });
  const transcript = longText(raw.transcricao);

  return {
    responseFormat: options?.format ?? LEGACY_SCENE_FORMAT,
    slides: Array.isArray(raw.slides) ? raw.slides.map((slide: any) => ({
      position: Number(slide.posicao), type: slide.tipo as "IMAGE" | "VIDEO",
      role: singleLine(slide.papel) || "outro", description: singleLine(slide.descricao) || "",
      onScreenText: longText(slide.texto), transcript: longText(slide.transcricao),
    })) : undefined,
    assetRoleIds,
    toneIds,
    subjectIds,
    subjects,
    quotes,
    framingIds,
    aestheticIds,
    placeId,
    objects,
    screenTitle: singleLine(raw.titulo),
    openingLine: singleLine(raw.fala),
    transcript,
    transcriptSegments: transcriptSegments(raw.segmentos),
    sceneTimeline: sceneTimeline(raw.cenas),
    narrativeStructure: freeTextList(raw.estrutura, { maxItems: 12, maxChars: 80 }),
    promise: singleLine(raw.promessa),
    cta: singleLine(raw.cta),
    // `offMap` continua olhando SÓ para o mapa: é a pergunta "o vídeo saiu do que ele
    // declarou?". Tema livre e objeto sempre existem, então incluí-los aqui zeraria o
    // sinal — nenhum vídeo seria mais "fora do mapa".
    offMap: assetRoleIds.length === 0 && toneIds.length === 0 && subjectIds.length === 0,
    provider: "",
    version: SCENE_EVALUATION_VERSION,
  };
}

/**
 * Espera o arquivo ficar ACTIVE. A Files API é assíncrona e o `upload` responde antes
 * de o vídeo terminar de processar — às vezes sem `state` nenhum. Aceitar qualquer
 * estado diferente de PROCESSING mandava o arquivo cru para `generateContent`, que
 * recusava com FAILED_PRECONDITION ("not in an ACTIVE state") e queimava o lote.
 * Só ACTIVE serve; ausência de estado conta como ainda processando.
 */
async function waitForFileReady(
  ai: GoogleGenAI,
  file: { name?: string; uri?: string; mimeType?: string; state?: string },
): Promise<{ uri: string; mimeType: string }> {
  let current = file;
  for (let attempt = 0; attempt < 30; attempt += 1) {
    if (current.state === "FAILED") throw new Error("gemini_file_processing_failed");
    if (current.state === "ACTIVE" && current.uri) {
      return { uri: current.uri, mimeType: current.mimeType ?? "video/mp4" };
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
    if (!current.name) break;
    current = (await ai.files.get({ name: current.name })) as typeof current;
  }
  throw new Error("gemini_file_processing_timeout");
}

/**
 * Sobe o vídeo pela Files API. O SDK recebe caminho de arquivo, então os bytes passam
 * por um temporário — mesmo padrão já usado em geminiVideoNarrativeClientFactory.
 * O temporário é removido sempre, inclusive em erro.
 */
async function uploadVideo(
  ai: GoogleGenAI,
  bytes: Buffer,
  mimeType: string,
): Promise<{ uri: string; mimeType: string }> {
  const tempPath = path.join(os.tmpdir(), `d2c-cena-${randomUUID()}.${mimeType.startsWith("image/") ? "img" : "mp4"}`);
  try {
    await fs.writeFile(tempPath, bytes);
    // A Files API reprova arquivo válido de vez em quando: o MESMO mp4 volta
    // "The file failed to be processed" (código 13) numa tentativa e ACTIVE na
    // seguinte. Sem esta segunda chance, um terço do lote se perdia num defeito
    // que não é do vídeo nem nosso.
    for (let attempt = 1; ; attempt += 1) {
      const uploaded = (await ai.files.upload({
        file: tempPath,
        config: { mimeType },
      })) as { name?: string };
      try {
        return await waitForFileReady(ai, uploaded as never);
      } catch (error) {
        // O arquivo reprovado NÃO é apagado antes de reenviar: apagar e subir os
        // mesmos bytes fazia a Files API repetir a reprovação, enquanto deixar o
        // reprovado de lado dava um envio limpo. Ele expira sozinho em 48h.
        const transitório =
          error instanceof Error && error.message === "gemini_file_processing_failed";
        if (!transitório || attempt >= UPLOAD_ATTEMPTS) throw error;
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }
  } finally {
    await fs.rm(tempPath, { force: true }).catch(() => {});
  }
}

export interface EvaluateSceneParams {
  responseFormat?: SceneResponseFormat;
  experiment?: { id: string; budgetPolicyId: string };
  metricId?: string;
  /** URL fresca do mp4, da Graph API. Expira em horas. */
  mediaUrl: string;
  durationSeconds: number | null;
  profile: MapProfile;
  apiKey?: string;
  model?: string;
  /**
   * Resolução de mídia por parte. Os modelos 3.x leem vídeo a 70 tokens por quadro
   * por padrão, contra ~258 do 2.5-flash: alta recupera detalhe visual ao custo de
   * mais entrada. Sem valor, vale o padrão do modelo — produção não muda.
   */
  mediaResolution?: PartMediaResolutionLevel;
  fetchImpl?: typeof fetch;
}

export type EvaluateSceneOutcome =
  | { ok: true; result: SceneEvaluation }
  | { ok: false; reason: string; retryable: boolean };

/**
 * Erro de saldo/faturamento não melhora com retry imediato. Separá-lo de um 429 de
 * tráfego evita três chamadas inúteis por conteúdo quando o crédito pré-pago acaba.
 */
export function isRetryableGeminiSceneError(message: string): boolean {
  if (
    /prepayment credits? (?:are )?depleted|insufficient (?:prepaid )?credits?|billing (?:is )?(?:disabled|required)|payment required/i.test(
      message,
    )
  ) {
    return false;
  }
  return /429|rate.?limit|quota|resource_exhausted|503|timeout|ECONN/i.test(message);
}

const DEFAULT_MODEL = process.env.GEMINI_CENA_MODEL || "gemini-2.5-flash";

export interface EvaluateImagesParams {
  metricId?: string;
  mediaUrls: string[];
  mediaItems?: PublishedMediaItem[];
  profile: MapProfile;
  apiKey?: string;
  model?: string;
  fetchImpl?: typeof fetch;
}

/** Instrução extra da leitura de foto/carrossel; exportada para o lote enviar o mesmo pedido. */
export function visualReadingInstruction(itemCount: number): string {
  return [
    "Esta leitura é de uma foto ou carrossel, não de um Reel contínuo.",
    `Existem ${itemCount} itens na ordem apresentada. Analise todos, inclusive áudio e movimento dos itens VIDEO.`,
    'Mantenha os campos de vocabulário do mapa, temas, objetos, estética, estrutura, promessa e CTA.',
    'Substitua cenas temporais por slides: [{"posicao":1,"tipo":"IMAGE ou VIDEO","papel":"gancho, contexto, entrega, prova, cta ou outro","descricao":"descrição observável","texto":"texto integral visível","transcricao":"fala literal apenas se VIDEO"}].',
    'Retorne exatamente um slide por item e preserve sua posição e tipo. Não invente tempos para imagens.',
    'Nos campos globais cenas, segmentos use []; transcricao e fala use "". O áudio de cada vídeo pertence exclusivamente ao seu slide.',
    'Em titulo use o texto de abertura do primeiro item. Em falas copie trechos escritos ou falados observados, sem inventar.',
  ].join(" ");
}

/**
 * Lê foto e carrossel com o mesmo vocabulário canônico usado nos Reels. A ordem dos
 * parts é a ordem dos slides, portanto `titulo` representa o gancho da primeira tela.
 */
async function evaluateImagesInternal(
  params: EvaluateImagesParams,
): Promise<EvaluateSceneOutcome> {
  const { profile } = params;
  const apiKey = (params.apiKey ?? process.env.GEMINI_API_KEY ?? "").trim();
  if (!apiKey) return { ok: false, reason: "GEMINI_API_KEY ausente.", retryable: false };

  const items = params.mediaItems ?? params.mediaUrls.map((url, index) => ({ position: index + 1, type: "IMAGE" as const, url }));
  if (!items.length) return { ok: false, reason: "Foto/carrossel sem mídia utilizável.", retryable: false };
  const doFetch = params.fetchImpl ?? fetch;
  const model = params.model ?? DEFAULT_MODEL;
  try {
    const ai = new GoogleGenAI({ apiKey });
    const parts: Array<ReturnType<typeof createPartFromBase64> | string> = [];
    let inlineBytes = 0;
    for (const item of items) {
      const label = `Item ${item.position} de ${items.length} (${item.type})`;
      if (!item.url) return { ok: false, reason: `${label}: URL ausente; leitura incompleta.`, retryable: true };
      const response = await doFetch(item.url, { signal: AbortSignal.timeout(20000) }).catch(() => { throw new Error(`${label}: falha de rede; leitura incompleta.`); });
      if (!response.ok) return { ok: false, reason: `${label}: HTTP ${response.status}; leitura incompleta.`, retryable: true };
      const bytes = Buffer.from(await response.arrayBuffer());
      const maxBytes = item.type === "VIDEO" ? MAX_VIDEO_BYTES : MAX_VISUAL_IMAGE_BYTES;
      if (!bytes.length || bytes.length > maxBytes) return { ok: false, reason: `${label}: mídia vazia ou acima do teto; leitura incompleta.`, retryable: false };
      const mimeType = response.headers.get("content-type")?.split(";")[0]?.trim() || (item.type === "VIDEO" ? "video/mp4" : "image/jpeg");
      if (!mimeType.startsWith(item.type === "VIDEO" ? "video/" : "image/")) return { ok: false, reason: `${label}: conteúdo incompatível; leitura incompleta.`, retryable: false };
      parts.push(label);
      // O teto é do pedido inteiro, não de cada imagem separadamente.
      if (inlineBytes + bytes.length > MAX_INLINE_VIDEO_BYTES) {
        const file = await uploadVideo(ai, bytes, mimeType).catch((error) => { throw new Error(`${label}: ${error instanceof Error ? error.message : "falha no envio"}`); });
        parts.push(createPartFromUri(file.uri, file.mimeType));
      } else {
        inlineBytes += bytes.length;
        parts.push(createPartFromBase64(bytes.toString("base64"), mimeType));
      }
    }
    const prompt = buildPrompt(profile);
    const instruction = visualReadingInstruction(items.length);
    const response = await governedGenerateContent(ai, {
      model, contents: createUserContent([prompt.user, prompt.format, instruction, ...parts]),
      // Mesma regra do vídeo: o orçamento numérico só vale no 2.5; os 3.x pedem nível.
      config: { systemInstruction: prompt.system, thinkingConfig: model.startsWith("gemini-2.") ? { thinkingBudget: 0 } : { thinkingLevel: "low" }, responseMimeType: "application/json", temperature: 0, maxOutputTokens: SCENE_MAX_OUTPUT_TOKENS },
    }, "cena");
    const parsed = parseSceneEvaluation(response.text, profile);
    const slides = parsed?.slides;
    if (String(response.candidates?.[0]?.finishReason ?? "") === "MAX_TOKENS" || !parsed || !slides || slides.length !== items.length || slides.some((slide, index) => slide.position !== items[index]?.position || slide.type !== items[index]?.type || !slide.description.trim())) {
      return { ok: false, reason: "Gemini devolveu leitura incompleta: slides ausentes, fora de ordem ou sem descrição.", retryable: false };
    }
    return { ok: true, result: { ...parsed, slides: slides.map(slide => ({ ...slide, transcript: slide.type === "VIDEO" ? slide.transcript : null })),
      transcript: null, transcriptSegments: [], openingLine: null,
      sceneTimeline: slides.map(slide => ({ startMs: null, endMs: null, role: slide.role, description: slide.description, spokenText: null, onScreenText: slide.onScreenText, setting: null, objects: [], framing: [] })),
      visualCoverage: { expected: items.length, analyzed: slides.length, complete: true }, version: VISUAL_READING_REVISION, provider: model } };
  } catch (error) {
    const message = error instanceof Error ? error.message : "erro desconhecido";
    logger.warn(`${TAG} falha na leitura de foto/carrossel: ${message}`);
    return { ok: false, reason: message, retryable: isRetryableGeminiSceneError(message) || /fetch|abort|network|falha de rede/i.test(message) };
  }
}

/**
 * Teto da resposta de uma leitura. A maior leitura legítima medida (set/2026, 353 Reels
 * de até 179s) cabe em ~5 mil tokens. Sem teto, vídeos em que o modelo entra em loop
 * repetindo a fala iam até 65.526 tokens (~US$ 0,16 cada), voltavam cortados e eram
 * relidos a cada repescagem — 23 vídeos pagaram 54% de toda a saída da cena.
 */
export const SCENE_MAX_OUTPUT_TOKENS = 16384;

/**
 * Fecha um objeto JSON cortado no último campo completo de primeiro nível. Os campos
 * do mapa vêm antes da transcrição no formato pedido, então sobrevivem quando o corte
 * acontece no texto longo.
 */
export function closeTruncatedObject(text: string): string | null {
  const start = text.indexOf("{");
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  let lastComplete = -1;
  for (let index = start; index < text.length; index += 1) {
    const char = text[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') inString = true;
    else if (char === "{" || char === "[") depth += 1;
    else if (char === "}" || char === "]") depth -= 1;
    else if (char === "," && depth === 1) lastComplete = index;
  }
  return lastComplete === -1 ? null : `${text.slice(start, lastComplete)}}`;
}

/**
 * Fala repetida em loop não é fala: é o defeito que estourou o teto. Medido em set/2026:
 * leitura sã fica em ~15 caracteres/s (máximo 24,8) e quase sem trecho de 6 palavras
 * repetido.
 */
export function speechLooksHealthy(text: string | null, durationSeconds: number | null): boolean {
  if (!text) return false;
  const words = text.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length > 12) {
    const seen = new Set<string>();
    let repeated = 0;
    for (let index = 0; index + 6 <= words.length; index += 1) {
      const key = words.slice(index, index + 6).join(" ");
      if (seen.has(key)) repeated += 1;
      else seen.add(key);
    }
    if (repeated / (words.length - 5) > 0.2) return false;
  }
  return !durationSeconds || text.length / durationSeconds <= 30;
}

/**
 * Aproveita a leitura cortada: o que o vídeo mostra (mapa, lugar, temas) fica; a fala
 * só fica se passar no teste de loop. Sem transcrição, a evidência publicada registra
 * a fala como indisponível em vez de guardar repetição como se fosse o roteiro.
 */
function salvageSceneEvaluation(
  text: string | undefined,
  profile: MapProfile,
  durationSeconds: number | null,
  format: SceneResponseFormat = LEGACY_SCENE_FORMAT,
): SceneEvaluation | null {
  const closed = text ? closeTruncatedObject(text) : null;
  const parsed = closed ? parseSceneEvaluation(closed, profile, { format, durationSeconds, partial: true }) : null;
  if (!parsed) return null;
  const speechKept = speechLooksHealthy(parsed.transcript, durationSeconds);
  logger.warn(`${TAG} leitura aproveitada parcialmente; fala ${speechKept ? "mantida" : "descartada"}.`);
  return speechKept
    ? { ...parsed, readingCompleteness: "partial" }
    : {
        ...parsed,
        readingCompleteness: "partial",
        transcript: null,
        transcriptSegments: [],
        sceneTimeline: parsed.sceneTimeline.map((scene) => ({ ...scene, spokenText: null })),
      };
}

async function evaluateSceneInternal(
  params: EvaluateSceneParams,
): Promise<EvaluateSceneOutcome> {
  const { profile } = params;

  const apiKey = (params.apiKey ?? process.env.GEMINI_API_KEY ?? "").trim();
  if (!apiKey) return { ok: false, reason: "GEMINI_API_KEY ausente.", retryable: false };
  if (params.durationSeconds !== null && params.durationSeconds > MAX_VIDEO_SECONDS) {
    return {
      ok: false,
      reason: `Vídeo de ${Math.round(params.durationSeconds)}s acima do teto de ${MAX_VIDEO_SECONDS}s.`,
      retryable: false,
    };
  }

  const doFetch = params.fetchImpl ?? fetch;
  let bytes: Buffer;
  let mimeType: string;
  try {
    const response = await doFetch(params.mediaUrl);
    if (!response.ok) {
      return {
        ok: false,
        reason: `Download do vídeo falhou: HTTP ${response.status}.`,
        retryable: response.status === 403 || response.status >= 500,
      };
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.byteLength > MAX_VIDEO_BYTES) {
      return {
        ok: false,
        reason: `Vídeo de ${(buffer.byteLength / 1024 / 1024).toFixed(1)}MB — grande demais para ser reel.`,
        retryable: false,
      };
    }
    bytes = buffer;
    mimeType = response.headers.get("content-type")?.split(";")[0]?.trim() || "video/mp4";
  } catch (error) {
    return {
      ok: false,
      reason: `Download do vídeo falhou: ${error instanceof Error ? error.message : "erro"}.`,
      retryable: true,
    };
  }

  const model = params.model ?? DEFAULT_MODEL;
  const prompt = buildPrompt(profile);
  if (params.responseFormat === COMPACT_SCENE_FORMAT) prompt.format = compactVideoPrompt(prompt.format);
  try {
    const ai = new GoogleGenAI({ apiKey });
    const safeMime = mimeType.startsWith("video/") ? mimeType : "video/mp4";
    // Inline enquanto cabe no request; acima disso, Files API. Sem esse segundo caminho
    // o relatório perde os reels mais longos, que são justamente os que mais variam.
    const videoPart =
      bytes.byteLength > MAX_INLINE_VIDEO_BYTES
        ? await uploadVideo(ai, bytes, safeMime).then((file) =>
            createPartFromUri(file.uri, file.mimeType, params.mediaResolution),
          )
        : createPartFromBase64(bytes.toString("base64"), safeMime, params.mediaResolution);

    const read = async (temperature: number) => {
      const response = await governedGenerateContent(ai, {
        model,
        contents: createUserContent([prompt.user, prompt.format, videoPart]),
        config: {
          systemInstruction: prompt.system,
          // Obrigatório no 2.5-flash: sem teto, os tokens de raciocínio dominam a conta.
          // Os modelos 3.x recusam o orçamento numérico com 400 INVALID_ARGUMENT e pedem
          // thinkingLevel — medido em 18/09/2026 no gemini-3.5-flash-lite.
          thinkingConfig: model.startsWith("gemini-2.") ? { thinkingBudget: 0 } : { thinkingLevel: "low" },
          responseMimeType: "application/json",
          temperature,
          maxOutputTokens: SCENE_MAX_OUTPUT_TOKENS,
        },
      }, "cena");
      const cut = String(response.candidates?.[0]?.finishReason ?? "") === "MAX_TOKENS";
      return { text: response.text, cut, parsed: cut ? null : parseSceneEvaluation(response.text, profile, { format: params.responseFormat ?? LEGACY_SCENE_FORMAT, durationSeconds: params.durationSeconds }) };
    };

    const first = await read(0);
    const parsed = first.parsed ?? salvageSceneEvaluation(first.text, profile, params.durationSeconds, params.responseFormat);
    if (!parsed) {
      return { ok: false, reason: "Resposta ilegível.", retryable: false };
    }
    return { ok: true, result: { ...parsed, provider: model } };
  } catch (error) {
    const message = error instanceof Error ? error.message : "erro desconhecido";
    logger.warn(`${TAG} falha na avaliação de cena: ${message}`);
    const retryable = isRetryableGeminiSceneError(message);
    return { ok: false, reason: message, retryable };
  }
}

// A chave independe da revisão do prompt: publicar código não autoriza reler a base.
export async function evaluateSceneAgainstMap(params: EvaluateSceneParams): Promise<EvaluateSceneOutcome> {
  if (!params.metricId) return evaluateSceneInternal(params);
  const contentKey = params.experiment ? `experiment:${params.experiment.id}:${params.metricId}:${params.responseFormat}` : `published:${params.metricId}`;
  const format = params.experiment ? params.responseFormat : await resolveSceneFormat(params.profile.creatorId, contentKey);
  if (params.experiment && !format) throw new Error("Experimento exige formato explícito");
  return withGeminiGovernance({ creatorId: params.profile.creatorId, contentKey, fingerprint: governanceHash(params.profile), responseFormat: format,
    durationSeconds: params.durationSeconds, budgetPolicyId: params.experiment?.budgetPolicyId, maxAttempts: params.experiment ? 1 : undefined }, async () => {
    const outcome = await evaluateSceneInternal({ ...params, responseFormat: format });
    await recordGeminiOutcome("cena", outcome.ok ? outcome.result.readingCompleteness ?? "complete" : "unusable");
    return outcome;
  });
}
export function evaluateImagesAgainstMap(params: EvaluateImagesParams): Promise<EvaluateSceneOutcome> {
  return params.metricId
    ? withGeminiGovernance({ creatorId: params.profile.creatorId, contentKey: `published:${params.metricId}`, fingerprint: governanceHash(params.profile) }, async () => {
        const outcome = await evaluateImagesInternal(params);
        await recordGeminiOutcome("cena", outcome.ok ? "complete" : "unusable");
        return outcome;
      })
    : evaluateImagesInternal(params);
}
