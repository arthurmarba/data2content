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
} from "@google/genai";
import { logGeminiUsage } from "@/app/lib/llm/geminiUsageLog";
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

/** Teto absoluto: acima disso nem pela Files API vale a pena — não é reel. */
export const MAX_VIDEO_BYTES = 200 * 1024 * 1024;
export const MAX_VIDEO_SECONDS = 180;
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
export const SCENE_EVALUATION_VERSION = "cena_mapa_v3";

/** O que o worker gravou: papéis do mapa presentes no vídeo. */
export interface SceneEvaluation {
  /** Papéis canônicos presentes. É isto que o relatório ranqueia. */
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
  /**
   * true quando NENHUM item do mapa apareceu. Não é erro: é sinal de que o vídeo saiu
   * do mapa, e isso é assunto de reunião.
   */
  offMap: boolean;
  provider: string;
  version: string;
}

function buildPrompt(profile: MapProfile): { system: string; user: string; format: string } {
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
{"assets":["A1","A3"],"tons":["T2"],"assuntos":["S1"],"local":"L2","enquadramento":["E1","E5"],"estetica":["Q1","Q3"],"temas":["voltar a trabalhar depois da licença","culpa de deixar a filha na creche"],"objetos":["caneca","carrinho de bebê"],"falas":["eu chorei no estacionamento no primeiro dia","ninguém te prepara pra isso"],"titulo":"3 coisas que ninguém te conta","fala":"Gente, eu preciso falar sobre ontem"}

assets / tons / assuntos: só os códigos presentes. Listas vazias são resposta válida e esperada.
local: um código L, ou null se nenhum servir.
enquadramento / estetica: os códigos que se aplicam; liste todos, não escolha um só.
temas: de 1 a 4 assuntos que o vídeo tratou, ESPECÍFICOS e nas palavras do próprio vídeo. Escreva como quem descreve para quem não assistiu: "voltar a trabalhar depois da licença", não "maternidade"; "organizar a geladeira depois da feira", não "cozinha". Minúsculas, sem ponto final, no máximo 8 palavras cada. Genérico demais não serve — se der pra usar o mesmo tema em 100 vídeos diferentes, está vago.
objetos: até 4 objetos que aparecem em cena com função, 1 a 3 palavras, minúsculas, sem marca ("caneca", não "caneca da Stanley"). Lista vazia é válida.
falas: até 3 trechos ditos no vídeo, COPIADOS exatamente como foram falados. Prefira os que carregam a ideia do vídeo. Lista vazia se ninguém fala.
titulo: o texto escrito NA TELA na abertura, copiado exatamente. "" se não houver.
fala: a primeira frase dita em voz, copiada exatamente. "" se ninguém fala.`;

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

/** Traduz os códigos A1/T2 de volta para os papéis canônicos. */
export function parseSceneEvaluation(
  text: string | null | undefined,
  profile: MapProfile,
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
  const raw = parsed as Record<string, unknown>;

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

  return {
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
    // `offMap` continua olhando SÓ para o mapa: é a pergunta "o vídeo saiu do que ele
    // declarou?". Tema livre e objeto sempre existem, então incluí-los aqui zeraria o
    // sinal — nenhum vídeo seria mais "fora do mapa".
    offMap: assetRoleIds.length === 0 && toneIds.length === 0 && subjectIds.length === 0,
    provider: "",
    version: SCENE_EVALUATION_VERSION,
  };
}

/** Espera o arquivo sair de PROCESSING. A Files API é assíncrona. */
async function waitForFileReady(
  ai: GoogleGenAI,
  file: { name?: string; uri?: string; mimeType?: string; state?: string },
): Promise<{ uri: string; mimeType: string }> {
  let current = file;
  for (let attempt = 0; attempt < 30; attempt += 1) {
    if (current.state !== "PROCESSING" && current.uri) {
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
  const tempPath = path.join(os.tmpdir(), `d2c-cena-${randomUUID()}.mp4`);
  try {
    await fs.writeFile(tempPath, bytes);
    const uploaded = await ai.files.upload({ file: tempPath, config: { mimeType } });
    return await waitForFileReady(ai, uploaded as never);
  } finally {
    await fs.rm(tempPath, { force: true }).catch(() => {});
  }
}

export interface EvaluateSceneParams {
  /** URL fresca do mp4, da Graph API. Expira em horas. */
  mediaUrl: string;
  durationSeconds: number | null;
  profile: MapProfile;
  apiKey?: string;
  model?: string;
  fetchImpl?: typeof fetch;
}

export type EvaluateSceneOutcome =
  | { ok: true; result: SceneEvaluation }
  | { ok: false; reason: string; retryable: boolean };

const DEFAULT_MODEL = process.env.GEMINI_CENA_MODEL || "gemini-2.5-flash";

export async function evaluateSceneAgainstMap(
  params: EvaluateSceneParams,
): Promise<EvaluateSceneOutcome> {
  const { profile } = params;

  // Sem mapa não há pergunta a fazer — e é melhor não gastar chamada.
  if (
    profile.assets.length === 0 &&
    profile.toneIds.length === 0 &&
    profile.subjects.length === 0
  ) {
    return {
      ok: false,
      reason: "Criador sem asset, tom nem assunto no mapa — nada a conferir.",
      retryable: false,
    };
  }

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
  try {
    const ai = new GoogleGenAI({ apiKey });
    const safeMime = mimeType.startsWith("video/") ? mimeType : "video/mp4";
    // Inline enquanto cabe no request; acima disso, Files API. Sem esse segundo caminho
    // o relatório perde os reels mais longos, que são justamente os que mais variam.
    const videoPart =
      bytes.byteLength > MAX_INLINE_VIDEO_BYTES
        ? await uploadVideo(ai, bytes, safeMime).then((file) =>
            createPartFromUri(file.uri, file.mimeType),
          )
        : createPartFromBase64(bytes.toString("base64"), safeMime);

    const response = await ai.models.generateContent({
      model,
      contents: createUserContent([prompt.user, prompt.format, videoPart]),
      config: {
        systemInstruction: prompt.system,
        // Obrigatório no 2.5-flash: sem teto, os tokens de raciocínio dominam a conta.
        thinkingConfig: { thinkingBudget: 0 },
        responseMimeType: "application/json",
        temperature: 0,
      },
    });

    logGeminiUsage("cena", model, response);

    const parsed = parseSceneEvaluation(response.text, profile);
    if (!parsed) {
      return { ok: false, reason: "Resposta ilegível.", retryable: false };
    }
    return { ok: true, result: { ...parsed, provider: model } };
  } catch (error) {
    const message = error instanceof Error ? error.message : "erro desconhecido";
    logger.warn(`${TAG} falha na avaliação de cena: ${message}`);
    const retryable = /429|rate|quota|503|timeout|ECONN/i.test(message);
    return { ok: false, reason: message, retryable };
  }
}
