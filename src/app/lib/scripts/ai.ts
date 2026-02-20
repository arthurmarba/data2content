import OpenAI from "openai";

import { getCategoryById } from "@/app/lib/classification";
import { recordScriptsStageDuration } from "./performanceTelemetry";
import type { ScriptIntelligenceContext } from "./intelligenceContext";
import {
  describeScriptAdjustTarget,
  detectScriptAdjustScope,
  type ScriptAdjustMode,
  type ScriptAdjustTarget,
} from "./adjustScope";
import { mergeScopedSegment, resolveScopedSegment } from "./scriptSegmentation";

type ScriptDraft = {
  title: string;
  content: string;
};

type GenerateInput = {
  prompt: string;
  intelligenceContext?: ScriptIntelligenceContext | null;
};

type AdjustInput = {
  prompt: string;
  title: string;
  content: string;
  intelligenceContext?: ScriptIntelligenceContext | null;
};

export type ScriptAdjustMeta = {
  adjustMode: ScriptAdjustMode;
  targetScope: ScriptAdjustTarget["type"];
  targetIndex?: number | null;
  scopeFound: boolean;
  scopeEnforced: boolean;
  outOfScopeChangeRate: number;
};

type AdjustResult = ScriptDraft & {
  adjustMeta: ScriptAdjustMeta;
};

type ScriptModelTier = "base" | "premium";
type ScriptModelOperation = "generate" | "adjust";
type CallModelOptions = {
  userPrompt: string;
  operation: ScriptModelOperation;
};

export type ScriptModelSelection = {
  model: string;
  tier: ScriptModelTier;
  reason:
    | "hybrid_disabled"
    | "operation_generate_default"
    | "operation_adjust_default"
    | "explicit_intent"
    | "complexity"
    | "default_base";
  fallbackModel: string | null;
};

let openAIClientCache: OpenAI | null = null;
let openAIClientCacheKey: string | null = null;

const SHORTEN_INTENT_REGEX =
  /(resum|encurt|reduz|compact|mais curto|diminu|simplifi|sintetiz|vers[aã]o curta|menos palavras)/i;
const FIRST_PARAGRAPH_INTENT_REGEX =
  /(primeir[oa].{0,30}par[aá]grafo|par[aá]grafo inicial|abertura|introdu[cç][aã]o|intro)/i;
const HAS_CTA_REGEX =
  /(cta|comente|coment[aá]rio|salve|salvar|compartilhe|compartilha|me conta|me diga|link na bio)/i;
const MENTION_REGEX = /@([A-Za-z0-9._]{2,30})/g;
const HASHTAG_REGEX = /#([\p{L}0-9_]{2,40})/gu;
const PREMIUM_MODEL_INTENT_REGEX =
  /(premium|refin[ao]|mais criativ|mais elaborad|mais detalhad|storytelling|copywriter|brand voice|tom de voz|cinematogr[aá]f)/i;
const CONSTRAINT_TOKEN_REGEX =
  /(sem|com|evite|obrigat[oó]ri|inclua|não|nao|tom|estrutura|objetivo|p[úu]blico|persona|cta|gancho|par[aá]grafo|hook|copy)/gi;
const BULLET_ITEM_REGEX = /(?:^|\n)\s*(?:[-*]|\d+[.)])/gm;
const TECHNICAL_SCRIPT_START = "[ROTEIRO_TECNICO_V1]";
const TECHNICAL_SCRIPT_END = "[/ROTEIRO_TECNICO_V1]";
const TECHNICAL_SCENE_HEADING_REGEX = /^\s*\[(?:CENA|SCENE)\s*(?:#\s*)?(\d{1,2})\s*:\s*([^\]]+)\]\s*$/i;
const TECHNICAL_HEADER_LINE =
  "| Tempo | Enquadramento | Ação/Movimento | Texto na Tela | Fala (literal) | Direção de Performance |";
const TECHNICAL_HEADER_SEPARATOR = "| :--- | :--- | :--- | :--- | :--- | :--- |";
const TECHNICAL_HEADER_DETECT_REGEX =
  /^\|\s*tempo\s*\|\s*enquadramento\s*\|\s*a[çc][aã]o\/movimento\s*\|\s*texto na tela\s*\|\s*fala \(literal\)\s*\|\s*dire[cç][aã]o de performance\s*\|?$/i;
const CTA_LITERAL_REGEX = /\b(comente|coment[aá]rio|salve|salvar|compartilhe|compartilha|direct|dm|me chama|segue|seguir|link)\b/i;
const INSTRUCTIONAL_LITERAL_REGEX =
  /^\s*(mostre|mostra|explique|explica|apresente|apresenta|grave|abra|feche|finalize|encerre|fa[cç]a|diga|fale)\b/i;

type TechnicalSceneRow = {
  tempo: string;
  enquadramento: string;
  acao: string;
  textoTela: string;
  fala: string;
  direcao: string;
};

type TechnicalSceneBlock = {
  index: number;
  heading: string;
  row: TechnicalSceneRow;
};

export type TechnicalScriptQualityScore = {
  perceivedQuality: number;
  hookStrength: number;
  specificityScore: number;
  speakabilityScore: number;
  ctaStrength: number;
  diversityScore: number;
  sceneCount: number;
};

const QUALITY_PASS_MIN_SCORE = 0.78;

export class ScriptAdjustScopeError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(message: string) {
    super(message);
    this.name = "ScriptAdjustScopeError";
    this.status = 422;
    this.code = "SCRIPT_ADJUST_SCOPE_NOT_FOUND";
  }
}

function clampText(value: unknown, fallback: string, max: number) {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (!normalized) return fallback;
  return normalized.slice(0, max);
}

function parseBoolean(value: string | undefined | null, defaultValue: boolean): boolean {
  if (typeof value !== "string") return defaultValue;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return defaultValue;
  if (["1", "true", "yes", "on", "enabled"].includes(normalized)) return true;
  if (["0", "false", "no", "off", "disabled"].includes(normalized)) return false;
  return defaultValue;
}

function parseIntWithDefault(value: string | undefined | null, defaultValue: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return defaultValue;
  return Math.floor(parsed);
}

function countRegexMatches(input: string, regex: RegExp): number {
  const matches = input.match(regex);
  return matches ? matches.length : 0;
}

function computePromptComplexityScore(prompt: string, operation: ScriptModelOperation): number {
  const normalized = prompt.trim();
  if (!normalized) return 0;

  const lengthThreshold = Math.max(140, parseIntWithDefault(process.env.OPENAI_MODEL_HYBRID_LENGTH_THRESHOLD, 280));
  const constraintThreshold = Math.max(
    2,
    parseIntWithDefault(process.env.OPENAI_MODEL_HYBRID_CONSTRAINT_THRESHOLD, 5)
  );

  const sentenceCount = normalized
    .split(/[.!?]+\s+/)
    .map((part) => part.trim())
    .filter(Boolean).length;
  const bulletCount = countRegexMatches(normalized, BULLET_ITEM_REGEX);
  const constraintCount = countRegexMatches(normalized, CONSTRAINT_TOKEN_REGEX);
  const lineCount = normalized
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean).length;

  let score = 0;
  if (normalized.length >= lengthThreshold) score += 1;
  if (constraintCount >= constraintThreshold) score += 1;
  if (sentenceCount >= 4) score += 1;
  if (lineCount >= 5 || bulletCount >= 3) score += 1;
  if (operation === "adjust" && normalized.length >= Math.floor(lengthThreshold * 0.75)) score += 1;

  return score;
}

export function selectScriptModelForPrompt(params: {
  userPrompt: string;
  operation: ScriptModelOperation;
}): ScriptModelSelection {
  const baseModel = (process.env.OPENAI_MODEL || "gpt-4o-mini").trim() || "gpt-4o-mini";
  const advancedModel = (
    process.env.OPENAI_MODEL_ADVANCED ||
    process.env.OPENAI_MODEL_PREMIUM ||
    "gpt-4.1"
  ).trim();
  const hybridEnabled = parseBoolean(process.env.OPENAI_MODEL_HYBRID_ENABLED, true);
  const operationRoutingEnabled = parseBoolean(
    process.env.OPENAI_MODEL_HYBRID_OPERATION_ROUTING_ENABLED,
    true
  );
  if (!hybridEnabled || !advancedModel || advancedModel === baseModel) {
    return {
      model: baseModel,
      tier: "base",
      reason: "hybrid_disabled",
      fallbackModel: null,
    };
  }

  if (operationRoutingEnabled) {
    if (params.operation === "generate") {
      return {
        model: advancedModel,
        tier: "premium",
        reason: "operation_generate_default",
        fallbackModel: baseModel,
      };
    }

    if (params.operation === "adjust") {
      return {
        model: baseModel,
        tier: "base",
        reason: "operation_adjust_default",
        fallbackModel: null,
      };
    }
  }

  const normalizedPrompt = params.userPrompt.trim();
  if (PREMIUM_MODEL_INTENT_REGEX.test(normalizedPrompt)) {
    return {
      model: advancedModel,
      tier: "premium",
      reason: "explicit_intent",
      fallbackModel: baseModel,
    };
  }

  const complexityScore = computePromptComplexityScore(normalizedPrompt, params.operation);
  const scoreThreshold = Math.max(2, parseIntWithDefault(process.env.OPENAI_MODEL_HYBRID_SCORE_THRESHOLD, 2));
  if (complexityScore >= scoreThreshold) {
    return {
      model: advancedModel,
      tier: "premium",
      reason: "complexity",
      fallbackModel: baseModel,
    };
  }

  return {
    model: baseModel,
    tier: "base",
    reason: "default_base",
    fallbackModel: null,
  };
}

function splitParagraphs(value: string) {
  return value
    .split(/\n\s*\n/g)
    .map((part) => part.trim())
    .filter(Boolean);
}

function extractMentions(value: string): Set<string> {
  const mentions = new Set<string>();
  for (const match of value.matchAll(MENTION_REGEX)) {
    const handle = String(match[1] || "").toLowerCase().trim();
    if (handle) mentions.add(handle);
  }
  return mentions;
}

function extractHashtags(value: string): Set<string> {
  const hashtags = new Set<string>();
  for (const match of value.matchAll(HASHTAG_REGEX)) {
    const tag = String(match[1] || "").toLowerCase().trim();
    if (tag) hashtags.add(tag);
  }
  return hashtags;
}

function compactWhitespace(value: string): string {
  return value
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function buildIdentityAllowList(allowedTexts: string[]) {
  const mentions = new Set<string>();
  const hashtags = new Set<string>();

  for (const text of allowedTexts) {
    const source = String(text || "");
    for (const mention of extractMentions(source)) {
      mentions.add(mention);
    }
    for (const hashtag of extractHashtags(source)) {
      hashtags.add(hashtag);
    }
  }

  return { mentions, hashtags };
}

export function sanitizeScriptIdentityLeakage(draft: ScriptDraft, allowedTexts: string[]): ScriptDraft {
  const allowList = buildIdentityAllowList(allowedTexts);

  const sanitizeText = (value: string) => {
    const mentionsSanitized = value.replace(MENTION_REGEX, (match, handle) => {
      const normalized = String(handle || "").toLowerCase().trim();
      if (!normalized) return "";
      if (allowList.mentions.has(normalized)) return match;
      return "criador";
    });

    const hashtagsSanitized = mentionsSanitized.replace(HASHTAG_REGEX, (match, hashtag) => {
      const normalized = String(hashtag || "").toLowerCase().trim();
      if (!normalized) return "";
      if (allowList.hashtags.has(normalized)) return match;
      return "";
    });

    return compactWhitespace(hashtagsSanitized);
  };

  return {
    title: sanitizeText(draft.title),
    content: sanitizeText(draft.content),
  };
}

function stripMarkdownMarkers(value: string): string {
  return (value || "")
    .replace(/\*\*/g, "")
    .replace(/^[-*]\s+/, "")
    .replace(/^"+|"+$/g, "")
    .trim();
}

function inferScriptObjective(text: string): "converter" | "engajar" | "autoridade" | "educar" {
  const normalized = (text || "").toLowerCase();
  if (/(vender|convers[aã]o|converter|lead|oferta|cliente|mentoria|fechar)/i.test(normalized)) {
    return "converter";
  }
  if (/(autoridade|posicionamento|credibilidade|especialista)/i.test(normalized)) {
    return "autoridade";
  }
  if (/(viral|alcance|engajar|engajamento|compartilhamento|salvamento)/i.test(normalized)) {
    return "engajar";
  }
  return "educar";
}

function extractTopicHint(value: string): string {
  const normalized = compactWhitespace(value || "");
  if (!normalized) return "seu tema principal";
  const patterns = [
    /(?:sobre|tema|assunto)\s+(.+)$/i,
    /(?:para)\s+(.+)$/i,
  ];
  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (!match?.[1]) continue;
    const candidate = stripMarkdownMarkers(match[1]).replace(/[?.!,:;]+$/g, "").trim();
    if (candidate.length >= 4) return clampText(candidate, "seu tema principal", 80);
  }
  const cleaned = normalized
    .replace(/\b(crie|gere|fa[cç]a|ajuste|reescreva|roteiro|script|novo|uma|um|para|pra)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  return clampText(cleaned || normalized, "seu tema principal", 80);
}

function defaultHeadingForScene(index: number): string {
  if (index === 1) return "GANCHO";
  if (index === 2) return "CONTEXTO";
  if (index === 3) return "DEMONSTRAÇÃO";
  if (index === 4) return "CTA";
  if (index === 5) return "PROVA";
  return "REFORÇO CTA";
}

function normalizeSceneHeadingLabel(value: string, index: number): string {
  const normalized = stripMarkdownMarkers(value || "")
    .replace(/[^\p{L}\p{N}\s/_-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
  if (!normalized) return defaultHeadingForScene(index);
  if (index >= 4) return normalized.includes("CTA") ? normalized : "CTA";
  return normalized;
}

function sanitizeTableCell(value: string, fallback = "..."): string {
  const sanitized = stripMarkdownMarkers(value || "")
    .replace(/\|/g, "/")
    .replace(/\s+/g, " ")
    .trim();
  return sanitized || fallback;
}

function isTableSeparatorLine(line: string): boolean {
  const cols = line
    .split("|")
    .map((part) => part.trim())
    .filter(Boolean);
  if (!cols.length) return false;
  return cols.every((part) => /^:?-{2,}:?$/.test(part));
}

function parseTechnicalRowFromLine(line: string): TechnicalSceneRow | null {
  const trimmedLine = line.trim();
  if (TECHNICAL_HEADER_DETECT_REGEX.test(trimmedLine)) return null;
  if (isTableSeparatorLine(trimmedLine)) return null;
  const cols = trimmedLine
    .split("|")
    .map((part) => part.trim())
    .filter(Boolean);
  if (!cols.length) return null;
  while (cols.length < 6) cols.push("");
  if (cols.length > 6) {
    cols[5] = cols.slice(5).join(" / ");
  }
  return {
    tempo: sanitizeTableCell(cols[0] || "", "00-03s"),
    enquadramento: sanitizeTableCell(cols[1] || ""),
    acao: sanitizeTableCell(cols[2] || ""),
    textoTela: sanitizeTableCell(cols[3] || ""),
    fala: sanitizeTableCell(cols[4] || ""),
    direcao: sanitizeTableCell(cols[5] || ""),
  };
}

function isTechnicalScript(content: string): boolean {
  const normalized = (content || "").trim();
  if (!normalized) return false;
  if (normalized.includes(TECHNICAL_SCRIPT_START)) return true;
  let hasSceneHeading = false;
  let hasTechnicalHeader = false;
  for (const line of normalized.split("\n")) {
    const trimmed = line.trim();
    if (!hasSceneHeading && TECHNICAL_SCENE_HEADING_REGEX.test(trimmed)) {
      hasSceneHeading = true;
    }
    if (!hasTechnicalHeader && TECHNICAL_HEADER_DETECT_REGEX.test(trimmed)) {
      hasTechnicalHeader = true;
    }
    if (hasSceneHeading && hasTechnicalHeader) return true;
  }
  return false;
}

function parseTechnicalScenes(content: string): TechnicalSceneBlock[] {
  const normalized = (content || "").replace(/\r/g, "");
  if (!normalized) return [];
  const lines = normalized.split("\n");
  const sceneMarkers: Array<{ lineIndex: number; sceneIndex: number; heading: string }> = [];
  lines.forEach((line, lineIndex) => {
    const match = line.match(TECHNICAL_SCENE_HEADING_REGEX);
    if (!match?.[1]) return;
    sceneMarkers.push({
      lineIndex,
      sceneIndex: Number(match[1]),
      heading: normalizeSceneHeadingLabel(match[2] || "", Number(match[1])),
    });
  });
  if (!sceneMarkers.length) return [];

  const parsed: TechnicalSceneBlock[] = [];
  sceneMarkers.forEach((marker, idx) => {
    const nextLine = sceneMarkers[idx + 1]?.lineIndex ?? lines.length;
    const blockLines = lines.slice(marker.lineIndex + 1, nextLine);
    let row: TechnicalSceneRow | null = null;
    for (const line of blockLines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("|")) continue;
      const parsedRow = parseTechnicalRowFromLine(trimmed);
      if (!parsedRow) continue;
      row = parsedRow;
      break;
    }
    parsed.push({
      index: marker.sceneIndex,
      heading: marker.heading,
      row: row || {
        tempo: "00-03s",
        enquadramento: "...",
        acao: "...",
        textoTela: "...",
        fala: "...",
        direcao: "...",
      },
    });
  });

  return parsed.sort((a, b) => a.index - b.index);
}

function buildDefaultTechnicalRow(
  sceneIndex: number,
  topic: string,
  objective: ReturnType<typeof inferScriptObjective>
): TechnicalSceneRow {
  const safeTopic = sanitizeTableCell(topic, "seu tema principal");
  if (sceneIndex === 1) {
    return {
      tempo: "00-03s",
      enquadramento: "Close no rosto (lente 1x), câmera na altura dos olhos.",
      acao: "Entrada rápida com gesto de mão e micro-pausa antes da frase principal.",
      textoTela: `PARE DE ERRAR: ${safeTopic.toUpperCase()}`,
      fala: `Se você quer destravar ${safeTopic}, presta atenção nesses próximos segundos.`,
      direcao: "Ritmo alto, olhar direto na lente e entonação firme na primeira frase.",
    };
  }
  if (sceneIndex === 2) {
    return {
      tempo: "03-10s",
      enquadramento: "Plano médio com corte para detalhe da ação.",
      acao: "Mostrar o cenário real do problema com movimento curto de câmera.",
      textoTela: "ERRO QUE MAIS DERRUBA RESULTADO",
      fala: `Quando você ignora esse ponto em ${safeTopic}, o resultado cai antes de ganhar tração.`,
      direcao: "Tom didático, frase objetiva e pausa curta após o problema central.",
    };
  }
  if (sceneIndex === 3) {
    return {
      tempo: "10-20s",
      enquadramento: "Plano médio + insert de apoio (antes/depois).",
      acao: "Demonstrar a correção em dois movimentos visuais simples.",
      textoTela: "AJUSTE PRÁTICO EM 2 PASSOS",
      fala: `Eu resolvo assim: primeiro corrijo a base, depois repito a execução com consistência.`,
      direcao: "Cadência progressiva, reforçar 'primeiro' e 'depois' com gesto de contagem.",
    };
  }
  if (objective === "converter") {
    return {
      tempo: sceneIndex === 4 ? "20-30s" : "30-35s",
      enquadramento: "Close final com gesto apontando para a legenda.",
      acao: "Encerrar com benefício claro e chamada direta para ação.",
      textoTela: "COMENTE “QUERO”",
      fala: "Se você quer aplicar isso no seu caso, comenta “quero” e me chama no direct.",
      direcao: "Tom confiante, sorriso curto no fechamento e pausa antes do CTA.",
    };
  }
  return {
    tempo: sceneIndex === 4 ? "20-30s" : "30-35s",
    enquadramento: "Close final com texto de reforço no centro da tela.",
    acao: "Fechar com benefício final e CTA explícito.",
    textoTela: "SALVE E COMPARTILHE",
    fala: "Se isso te ajudou, salva este roteiro e compartilha com alguém do seu nicho.",
    direcao: "Entonação conclusiva, fala curta e clara com gesto de confirmação.",
  };
}

function isActionableDirection(text: string): boolean {
  return /\b(ritmo|olhar|entona[cç][aã]o|cad[êe]ncia|dic[cç][aã]o|pausa|gesto|postura|sorriso|energia|tom)\b/i.test(text);
}

function ensureLiteralSpeech(
  speech: string,
  fallback: string
): string {
  const cleaned = sanitizeTableCell(speech, fallback);
  if (INSTRUCTIONAL_LITERAL_REGEX.test(cleaned)) return fallback;
  if (cleaned.split(/\s+/).filter(Boolean).length < 6) return fallback;
  return cleaned;
}

function ensureCtaSpeech(speech: string, fallback: string): string {
  if (CTA_LITERAL_REGEX.test(speech)) return speech;
  return fallback;
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function roundScore(value: number): number {
  return Math.round(clamp01(value) * 1000) / 1000;
}

function countWords(text: string): number {
  return (text || "").trim().split(/\s+/).filter(Boolean).length;
}

function hasMeaningfulOverlay(value: string): boolean {
  const normalized = sanitizeTableCell(value, "").toLowerCase();
  if (!normalized || normalized === "...") return false;
  return normalized.length >= 6;
}

function scoreHookStrength(row?: TechnicalSceneRow): number {
  if (!row) return 0;
  let score = 0;
  const speech = sanitizeTableCell(row.fala, "");
  const words = countWords(speech);
  if (words >= 8 && words <= 26) score += 0.3;
  if (/\b(voc[eê]|se voc[eê]|hoje|agora)\b/i.test(speech)) score += 0.2;
  if (/\b(erro|perde|cai|destrava|corrig|resultado|ganha)\b/i.test(speech)) score += 0.3;
  if (hasMeaningfulOverlay(row.textoTela)) score += 0.2;
  return roundScore(score);
}

function scoreSceneSpecificity(row: TechnicalSceneRow): number {
  let score = 0;
  const combined = `${row.enquadramento} ${row.acao} ${row.textoTela} ${row.fala}`.toLowerCase();
  if (/\b(\d+|passo|antes|depois|close|plano|insert|corte|lente|1x|2x|3x)\b/.test(combined)) score += 0.35;
  if (sanitizeTableCell(row.acao, "").length >= 24) score += 0.25;
  if (hasMeaningfulOverlay(row.textoTela)) score += 0.2;
  if (countWords(row.fala) >= 10 && /\b(eu|voc[eê]|quando|se)\b/i.test(row.fala)) score += 0.2;
  return roundScore(score);
}

function scoreSpeakability(row: TechnicalSceneRow): number {
  const speech = sanitizeTableCell(row.fala, "");
  if (!speech) return 0;
  if (INSTRUCTIONAL_LITERAL_REGEX.test(speech)) return 0;
  let score = 0;
  const words = countWords(speech);
  if (words >= 8 && words <= 34) score += 0.5;
  else if (words >= 6 && words <= 40) score += 0.25;
  if (/\b(eu|voc[eê]|se voc[eê]|quando voc[eê])\b/i.test(speech)) score += 0.25;
  if (/\b(corrig|melhor|ganha|destrava|resultado|salv|comenta|compartilha)\b/i.test(speech)) score += 0.25;
  return roundScore(score);
}

function scoreCtaStrength(lastScene?: TechnicalSceneRow): number {
  if (!lastScene) return 0;
  let score = 0;
  const speech = sanitizeTableCell(lastScene.fala, "");
  const overlay = sanitizeTableCell(lastScene.textoTela, "");
  if (CTA_LITERAL_REGEX.test(speech)) score += 0.65;
  if (/\b(comenta|salva|compartilha|direct|dm|link|segue)\b/i.test(speech)) score += 0.2;
  if (/\b(agora|hoje|neste|nesse)\b/i.test(speech)) score += 0.05;
  if (/\b(comente|salve|compartilhe|cta|link|direct|dm)\b/i.test(overlay)) score += 0.1;
  return roundScore(score);
}

function scoreDiversity(scenes: TechnicalSceneBlock[]): number {
  const speeches = scenes.map((scene) => sanitizeTableCell(scene.row.fala, "").toLowerCase()).filter(Boolean);
  if (!speeches.length) return 0;
  const allTokens = speeches
    .flatMap((text) => text.split(/\s+/))
    .map((token) => token.replace(/[^\p{L}\p{N}]/gu, "").trim())
    .filter((token) => token.length > 3);
  if (!allTokens.length) return 0.35;
  const uniqueTokens = new Set(allTokens);
  const ratio = uniqueTokens.size / allTokens.length;
  const duplicateLines = speeches.length - new Set(speeches).size;
  const duplicatePenalty = duplicateLines > 0 ? 0.15 : 0;
  return roundScore(clamp01(ratio * 1.25 - duplicatePenalty));
}

function evaluateTechnicalScriptQualityFromScenes(
  scenes: TechnicalSceneBlock[],
): TechnicalScriptQualityScore {
  if (!scenes.length) {
    return {
      perceivedQuality: 0,
      hookStrength: 0,
      specificityScore: 0,
      speakabilityScore: 0,
      ctaStrength: 0,
      diversityScore: 0,
      sceneCount: 0,
    };
  }
  const hookStrength = scoreHookStrength(scenes[0]?.row);
  const specificityScore = roundScore(
    scenes.reduce((sum, scene) => sum + scoreSceneSpecificity(scene.row), 0) / scenes.length
  );
  const speakabilityScore = roundScore(
    scenes.reduce((sum, scene) => sum + scoreSpeakability(scene.row), 0) / scenes.length
  );
  const ctaStrength = scoreCtaStrength(scenes[scenes.length - 1]?.row);
  const diversityScore = scoreDiversity(scenes);
  const perceivedQuality = roundScore(
    hookStrength * 0.25 +
    specificityScore * 0.25 +
    speakabilityScore * 0.2 +
    ctaStrength * 0.2 +
    diversityScore * 0.1
  );
  return {
    perceivedQuality,
    hookStrength,
    specificityScore,
    speakabilityScore,
    ctaStrength,
    diversityScore,
    sceneCount: scenes.length,
  };
}

function shouldRunQualityPass(score: TechnicalScriptQualityScore): boolean {
  return (
    score.sceneCount < 4 ||
    score.perceivedQuality < QUALITY_PASS_MIN_SCORE ||
    score.hookStrength < 0.62 ||
    score.specificityScore < 0.62 ||
    score.speakabilityScore < 0.75 ||
    score.ctaStrength < 0.8
  );
}

function polishScenesForQuality(
  scenes: TechnicalSceneBlock[],
  fallbackPrompt: string
): TechnicalSceneBlock[] {
  const topic = extractTopicHint(fallbackPrompt);
  const objective = inferScriptObjective(fallbackPrompt);
  const total = scenes.length;

  return scenes.map((scene, idx) => {
    const sceneIndex = idx + 1;
    const fallbackRow = buildDefaultTechnicalRow(sceneIndex, topic, objective);
    const isLast = idx === total - 1;
    const nextRow: TechnicalSceneRow = {
      tempo: sanitizeTableCell(scene.row.tempo, fallbackRow.tempo),
      enquadramento: sanitizeTableCell(scene.row.enquadramento, fallbackRow.enquadramento),
      acao: sanitizeTableCell(scene.row.acao, fallbackRow.acao),
      textoTela: sanitizeTableCell(scene.row.textoTela, fallbackRow.textoTela),
      fala: ensureLiteralSpeech(scene.row.fala, fallbackRow.fala),
      direcao: isActionableDirection(scene.row.direcao)
        ? sanitizeTableCell(scene.row.direcao, fallbackRow.direcao)
        : fallbackRow.direcao,
    };

    if (sanitizeTableCell(nextRow.acao, "").length < 20) {
      nextRow.acao = fallbackRow.acao;
    }
    if (!hasMeaningfulOverlay(nextRow.textoTela)) {
      nextRow.textoTela = fallbackRow.textoTela;
    }
    if (scoreSceneSpecificity(nextRow) < 0.55) {
      nextRow.acao = fallbackRow.acao;
      nextRow.textoTela = fallbackRow.textoTela;
    }
    if (sceneIndex === 1 && scoreHookStrength(nextRow) < 0.6) {
      nextRow.fala = fallbackRow.fala;
      nextRow.textoTela = fallbackRow.textoTela;
    }
    if (isLast) {
      nextRow.fala = ensureCtaSpeech(nextRow.fala, fallbackRow.fala);
      nextRow.textoTela = /\b(comente|salve|compartilhe|cta|link|direct|dm)\b/i.test(nextRow.textoTela)
        ? nextRow.textoTela
        : fallbackRow.textoTela;
    }
    return {
      index: sceneIndex,
      heading: isLast ? "CTA" : normalizeSceneHeadingLabel(scene.heading, sceneIndex),
      row: nextRow,
    };
  });
}

export function evaluateTechnicalScriptQuality(content: string, userPrompt = ""): TechnicalScriptQualityScore {
  const parsed = parseTechnicalScenes(content || "");
  const scenes = parsed.length ? parsed : buildTechnicalScenesFromLegacyContent(content || "", userPrompt || "roteiro");
  return evaluateTechnicalScriptQualityFromScenes(scenes);
}

function serializeSceneBlock(scene: TechnicalSceneBlock): string {
  const heading = normalizeSceneHeadingLabel(scene.heading, scene.index);
  const row = scene.row;
  return [
    `[CENA ${scene.index}: ${heading}]`,
    TECHNICAL_HEADER_LINE,
    TECHNICAL_HEADER_SEPARATOR,
    `| ${sanitizeTableCell(row.tempo, "00-03s")} | ${sanitizeTableCell(row.enquadramento)} | ${sanitizeTableCell(row.acao)} | ${sanitizeTableCell(row.textoTela)} | ${sanitizeTableCell(row.fala)} | ${sanitizeTableCell(row.direcao)} |`,
  ].join("\n");
}

function serializeTechnicalScript(scenes: TechnicalSceneBlock[]): string {
  const blocks = scenes
    .sort((a, b) => a.index - b.index)
    .map((scene) => serializeSceneBlock(scene));
  return [TECHNICAL_SCRIPT_START, ...blocks, TECHNICAL_SCRIPT_END].join("\n\n").trim();
}

function extractLegacySignals(content: string): { hook?: string; development?: string; cta?: string; paragraphs: string[] } {
  const lines = (content || "")
    .split("\n")
    .map((line) => stripMarkdownMarkers(line).trim())
    .filter(Boolean);
  const result: { hook?: string; development?: string; cta?: string; paragraphs: string[] } = {
    paragraphs: splitParagraphs(content || "").map((part) => stripMarkdownMarkers(part)),
  };
  lines.forEach((line) => {
    if (!result.hook && /^gancho\s*:/i.test(line)) {
      result.hook = line.split(":").slice(1).join(":").trim();
      return;
    }
    if (!result.development && /^(desenvolvimento|corpo|passos?)\s*:/i.test(line)) {
      result.development = line.split(":").slice(1).join(":").trim();
      return;
    }
    if (!result.cta && /^(cta|chamada|call to action)\s*:/i.test(line)) {
      result.cta = line.split(":").slice(1).join(":").trim();
    }
  });
  return result;
}

function buildTechnicalScenesFromLegacyContent(content: string, fallbackPrompt: string): TechnicalSceneBlock[] {
  const normalized = (content || "").trim();
  const topic = extractTopicHint(`${fallbackPrompt} ${normalized}`);
  const objective = inferScriptObjective(`${fallbackPrompt}\n${normalized}`);
  const legacySignals = extractLegacySignals(normalized);
  const scenes: TechnicalSceneBlock[] = [1, 2, 3, 4].map((sceneIndex) => ({
    index: sceneIndex,
    heading: defaultHeadingForScene(sceneIndex),
    row: buildDefaultTechnicalRow(sceneIndex, topic, objective),
  }));

  if (legacySignals.hook) {
    scenes[0]!.row.fala = ensureLiteralSpeech(legacySignals.hook, scenes[0]!.row.fala);
  }
  if (legacySignals.development) {
    scenes[2]!.row.fala = ensureLiteralSpeech(legacySignals.development, scenes[2]!.row.fala);
  } else if (legacySignals.paragraphs[1]) {
    scenes[2]!.row.fala = ensureLiteralSpeech(legacySignals.paragraphs[1], scenes[2]!.row.fala);
  }
  if (legacySignals.cta) {
    scenes[3]!.row.fala = ensureCtaSpeech(
      ensureLiteralSpeech(legacySignals.cta, scenes[3]!.row.fala),
      scenes[3]!.row.fala
    );
  }
  if (!legacySignals.hook && legacySignals.paragraphs[0]) {
    scenes[1]!.row.fala = ensureLiteralSpeech(legacySignals.paragraphs[0], scenes[1]!.row.fala);
  }

  return scenes;
}

export function convertLegacyScriptToTechnical(content: string, fallbackPrompt: string): string {
  const normalized = (content || "").trim();
  if (isTechnicalScript(normalized)) return normalized;
  return serializeTechnicalScript(buildTechnicalScenesFromLegacyContent(normalized, fallbackPrompt));
}

function fallbackGenerate(prompt: string): ScriptDraft {
  const normalized = prompt.trim();
  const titleBase = normalized ? normalized.split(/\s+/).slice(0, 7).join(" ") : "Roteiro técnico";
  const title = clampText(titleBase, "Roteiro técnico", 80);
  const content = convertLegacyScriptToTechnical("", normalized || "reels de 30s");
  return { title, content };
}

function fallbackAdjust(input: AdjustInput): ScriptDraft {
  return {
    title: clampText(input.title, "Roteiro técnico ajustado", 80),
    content: convertLegacyScriptToTechnical(input.content, input.prompt),
  };
}

function fallbackAdjustScoped(segmentText: string, prompt: string): string {
  const normalizedSegment = String(segmentText || "").trim();
  if (!normalizedSegment) return convertLegacyScriptToTechnical("", prompt);
  if (isTechnicalScript(normalizedSegment)) return normalizedSegment;
  return convertLegacyScriptToTechnical(normalizedSegment, prompt);
}

function resolveCategoryLabel(dimension: keyof NonNullable<ScriptIntelligenceContext["resolvedCategories"]>, id: string): string {
  const map = {
    proposal: "proposal",
    context: "context",
    format: "format",
    tone: "tone",
    references: "reference",
  } as const;

  const category = getCategoryById(id, map[dimension]);
  if (!category) return id;
  return `${category.label} (${id})`;
}

export function buildIntelligencePromptBlock(context: ScriptIntelligenceContext | null | undefined): string {
  if (!context) return "";

  const resolved = context.resolvedCategories;
  const categoryLines = [
    resolved.proposal ? `- proposal: ${resolveCategoryLabel("proposal", resolved.proposal)}` : null,
    resolved.context ? `- context: ${resolveCategoryLabel("context", resolved.context)}` : null,
    resolved.format ? `- format: ${resolveCategoryLabel("format", resolved.format)}` : null,
    resolved.tone ? `- tone: ${resolveCategoryLabel("tone", resolved.tone)}` : null,
    resolved.references ? `- references: ${resolveCategoryLabel("references", resolved.references)}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const dnaLines = context.dnaProfile.writingGuidelines.length
    ? context.dnaProfile.writingGuidelines.map((line) => `- ${line}`).join("\n")
    : "- Use linguagem natural em portugues do Brasil com CTA claro.";

  const captionExamples = context.captionEvidence
    .slice(0, 3)
    .map((item, index) => `${index + 1}) ${item.caption.replace(/\s+/g, " ").slice(0, 180)}`)
    .join("\n");

  const evidenceBlock = captionExamples
    ? `Exemplos reais de linguagem do criador (resumo):\n${captionExamples}`
    : "Sem exemplos suficientes de legenda. Use regras base do roteirista.";

  const styleGuidelines =
    context.styleProfile?.writingGuidelines?.length
      ? context.styleProfile.writingGuidelines.map((line) => `- ${line}`).join("\n")
      : "- Sem sinais suficientes de estilo por roteiros salvos.";

  const styleExamples =
    context.styleProfile?.styleExamples?.length
      ? context.styleProfile.styleExamples
          .slice(0, 3)
          .map((item, index) => `${index + 1}) ${item}`)
          .join("\n")
      : "";

  const styleBlock =
    context.styleProfile && context.styleSampleSize > 0
      ? `\nPerfil de estilo do usuario (roteiros salvos):\n` +
        `- Versao do perfil: ${context.styleProfileVersion || "desconhecida"}\n` +
        `- Amostra de roteiros: ${context.styleSampleSize}\n` +
        `- Regras de estilo:\n${styleGuidelines}\n` +
        `${styleExamples ? `- Exemplos resumidos de estilo:\n${styleExamples}\n` : ""}` +
        `- Imite o estilo do criador sem copiar frases literalmente.`
      : "\nPerfil de estilo indisponivel: use apenas categorias vencedoras e regras base.";

  return (
    `\n\nContexto inteligente do criador (aplique silenciosamente, sem explicar ao usuario):\n` +
    `- Modo do pedido: ${context.promptMode}\n` +
    `- Métrica usada: ${context.metricUsed}\n` +
    `- Janela historica: ${context.lookbackDays} dias\n` +
    `${categoryLines || "- Sem categorias resolvidas."}\n` +
    `- Evidencias de DNA: ${context.dnaProfile.sampleSize} legendas\n` +
    `- Perfil de linguagem:\n${dnaLines}\n` +
    `${evidenceBlock}\n` +
    `${styleBlock}`
  );
}

function parseDraftFromResponse(raw: string): ScriptDraft {
  const trimmed = (raw || "").trim();
  if (!trimmed) {
    throw new Error("Resposta vazia do modelo");
  }

  const direct = (() => {
    try {
      return JSON.parse(trimmed);
    } catch {
      return null;
    }
  })();

  let parsed = direct;
  if (!parsed) {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
      parsed = JSON.parse(trimmed.slice(start, end + 1));
    }
  }

  const title = clampText(parsed?.title, "Novo roteiro", 80);
  const content = clampText(parsed?.content, "Roteiro gerado.", 12000);
  return { title, content };
}

async function requestScriptDraftFromModel(params: {
  client: OpenAI;
  prompt: string;
  model: string;
}): Promise<ScriptDraft> {
  const completion = await params.client.chat.completions.create({
    model: params.model,
    temperature: Number(process.env.OPENAI_TEMP || 0.4),
    response_format: { type: "json_object" } as any,
    messages: [
      {
        role: "system",
        content:
          "Você é especialista em roteiros para creators no Brasil. Responda estritamente JSON com {\"title\": string, \"content\": string}. Não inclua explicações, comentários, markdown ou campos extras.",
      },
      { role: "user", content: params.prompt },
    ],
  } as any);

  const raw = completion.choices?.[0]?.message?.content || "{}";
  return parseDraftFromResponse(raw);
}

async function callModel(prompt: string, options: CallModelOptions): Promise<ScriptDraft | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  if (!openAIClientCache || openAIClientCacheKey !== apiKey) {
    openAIClientCache = new OpenAI({ apiKey });
    openAIClientCacheKey = apiKey;
  }
  const modelSelection = selectScriptModelForPrompt({
    userPrompt: options.userPrompt,
    operation: options.operation,
  });

  const llmStartMs = Date.now();
  try {
    try {
      return await requestScriptDraftFromModel({
        client: openAIClientCache,
        prompt,
        model: modelSelection.model,
      });
    } catch (primaryError) {
      if (
        modelSelection.tier === "premium" &&
        modelSelection.fallbackModel &&
        modelSelection.fallbackModel !== modelSelection.model
      ) {
        return requestScriptDraftFromModel({
          client: openAIClientCache,
          prompt,
          model: modelSelection.fallbackModel,
        });
      }
      throw primaryError;
    }
  } finally {
    recordScriptsStageDuration("llm.call", Date.now() - llmStartMs);
  }
}

function buildNormalizedTechnicalScenes(
  content: string,
  fallbackPrompt: string
): TechnicalSceneBlock[] {
  const topic = extractTopicHint(fallbackPrompt);
  const objective = inferScriptObjective(fallbackPrompt);
  const parsed = parseTechnicalScenes(content);
  const normalized = parsed.length ? parsed : buildTechnicalScenesFromLegacyContent(content, fallbackPrompt);

  const scenes: TechnicalSceneBlock[] = normalized.length
    ? normalized
    : [1, 2, 3, 4].map((sceneIndex) => ({
        index: sceneIndex,
        heading: defaultHeadingForScene(sceneIndex),
        row: buildDefaultTechnicalRow(sceneIndex, topic, objective),
      }));

  scenes.sort((a, b) => a.index - b.index);
  while (scenes.length < 4) {
    const nextIndex = scenes.length + 1;
    scenes.push({
      index: nextIndex,
      heading: defaultHeadingForScene(nextIndex),
      row: buildDefaultTechnicalRow(nextIndex, topic, objective),
    });
  }
  if (scenes.length > 6) scenes.length = 6;

  return scenes.map((scene, idx, all) => {
    const sceneIndex = idx + 1;
    const fallbackRow = buildDefaultTechnicalRow(sceneIndex, topic, objective);
    const isLast = idx === all.length - 1;
    const heading = isLast
      ? "CTA"
      : normalizeSceneHeadingLabel(scene.heading, sceneIndex);
    const falaBase = ensureLiteralSpeech(scene.row.fala, fallbackRow.fala);
    const fala = isLast ? ensureCtaSpeech(falaBase, fallbackRow.fala) : falaBase;
    const direcaoRaw = sanitizeTableCell(scene.row.direcao, fallbackRow.direcao);
    return {
      index: sceneIndex,
      heading,
      row: {
        tempo: sanitizeTableCell(scene.row.tempo, fallbackRow.tempo),
        enquadramento: sanitizeTableCell(scene.row.enquadramento, fallbackRow.enquadramento),
        acao: sanitizeTableCell(scene.row.acao, fallbackRow.acao),
        textoTela: sanitizeTableCell(scene.row.textoTela, fallbackRow.textoTela),
        fala,
        direcao: isActionableDirection(direcaoRaw) ? direcaoRaw : fallbackRow.direcao,
      },
    };
  });
}

export function enforceTechnicalScriptContract(draft: ScriptDraft, fallbackPrompt: string): ScriptDraft {
  const fallback = fallbackGenerate(fallbackPrompt);
  const title = clampText(draft.title, fallback.title, 80);
  const rawContent = clampText(draft.content, "", 12000) || fallback.content;
  let scenes = buildNormalizedTechnicalScenes(rawContent, fallbackPrompt);
  const scoreBefore = evaluateTechnicalScriptQualityFromScenes(scenes);
  if (shouldRunQualityPass(scoreBefore)) {
    const polished = polishScenesForQuality(scenes, fallbackPrompt);
    const polishedScore = evaluateTechnicalScriptQualityFromScenes(polished);
    const shouldAdoptPolished =
      polishedScore.perceivedQuality >= scoreBefore.perceivedQuality ||
      polishedScore.perceivedQuality >= QUALITY_PASS_MIN_SCORE;
    if (shouldAdoptPolished) {
      scenes = polished;
    } else if (scoreBefore.perceivedQuality < 0.62) {
      scenes = buildNormalizedTechnicalScenes("", fallbackPrompt);
    }
  }
  const normalizedContent = serializeTechnicalScript(scenes);
  return {
    title: clampText(title, fallback.title, 80),
    content: clampText(normalizedContent, fallback.content, 12000),
  };
}

function extractScopedSceneContent(rawContent: string, targetSceneIndex: number): string {
  const scenes = parseTechnicalScenes(rawContent);
  if (!scenes.length) return rawContent;
  const target = scenes.find((scene) => scene.index === targetSceneIndex) || scenes[0];
  if (!target) return rawContent;
  return serializeSceneBlock({
    index: targetSceneIndex,
    heading: target.heading,
    row: target.row,
  });
}

function sanitizeAdjustedScript(input: AdjustInput, draft: ScriptDraft): ScriptDraft {
  const originalTitle = clampText(input.title, "Roteiro ajustado", 80);
  const originalContent = clampText(input.content, "", 12000);
  const nextTitle = clampText(draft.title, originalTitle, 80);
  const nextContent = clampText(draft.content, originalContent, 12000);
  const prompt = input.prompt.trim();

  if (!originalContent) {
    return { title: nextTitle, content: nextContent };
  }

  const originalParagraphs = splitParagraphs(originalContent);
  const nextParagraphs = splitParagraphs(nextContent);
  const requestsShortVersion = SHORTEN_INTENT_REGEX.test(prompt);
  const requestsFirstParagraphOnly = FIRST_PARAGRAPH_INTENT_REGEX.test(prompt);

  if (requestsFirstParagraphOnly && originalParagraphs.length > 1 && nextParagraphs.length > 0) {
    const merged = [nextParagraphs[0], ...originalParagraphs.slice(1)].join("\n\n");
    return {
      title: nextTitle,
      content: clampText(merged, originalContent, 12000),
    };
  }

  if (isTechnicalScript(nextContent)) {
    return { title: nextTitle, content: nextContent };
  }

  const likelyLossOfContent =
    originalContent.length >= 500 &&
    nextContent.length < originalContent.length * 0.55 &&
    !requestsShortVersion;

  if (likelyLossOfContent) {
    return {
      title: nextTitle,
      content: originalContent,
    };
  }

  return { title: nextTitle, content: nextContent };
}

export async function generateScriptFromPrompt(input: GenerateInput): Promise<ScriptDraft> {
  const userPrompt = input.prompt.trim();
  if (!userPrompt) {
    throw new Error("Informe um prompt para gerar o roteiro.");
  }

  const intelligenceBlock = buildIntelligencePromptBlock(input.intelligenceContext);

  const llmPrompt =
    `Crie um roteiro técnico profissional em português do Brasil para creator.\n` +
    `Pedido do usuário: ${userPrompt}\n` +
    `${intelligenceBlock}\n\n` +
    `Regras obrigatórias:\n` +
    `- Retornar APENAS JSON válido com os campos title e content\n` +
    `- Entregar roteiro pronto para gravação, sem explicar raciocínio\n` +
    `- content deve seguir EXATAMENTE o formato técnico abaixo:\n` +
    `${TECHNICAL_SCRIPT_START}\n` +
    `[CENA 1: GANCHO]\n` +
    `${TECHNICAL_HEADER_LINE}\n` +
    `${TECHNICAL_HEADER_SEPARATOR}\n` +
    `| ... |\n` +
    `[CENA 2: CONTEXTO]\n` +
    `${TECHNICAL_HEADER_LINE}\n` +
    `${TECHNICAL_HEADER_SEPARATOR}\n` +
    `| ... |\n` +
    `[CENA 3: DEMONSTRAÇÃO]\n` +
    `${TECHNICAL_HEADER_LINE}\n` +
    `${TECHNICAL_HEADER_SEPARATOR}\n` +
    `| ... |\n` +
    `[CENA 4: CTA]\n` +
    `${TECHNICAL_HEADER_LINE}\n` +
    `${TECHNICAL_HEADER_SEPARATOR}\n` +
    `| ... |\n` +
    `${TECHNICAL_SCRIPT_END}\n` +
    `- Cada cena deve ter 1 linha de tabela com 6 colunas obrigatórias\n` +
    `- Mínimo 4 e máximo 6 cenas\n` +
    `- Fala (literal): frase pronta para câmera, proibido texto instrucional\n` +
    `- Direção de Performance: orientação objetiva de tom/ritmo/entonação/gesto\n` +
    `- Última cena obrigatoriamente com CTA explícito\n` +
    `- Imitar o estilo do criador sem copiar frases literalmente\n` +
    `- Linguagem natural, objetiva e adequada ao criador\n` +
    `- Não citar outros criadores, marcas ou perfis sem pedido explícito\n` +
    `- Não incluir @menções ou hashtags, exceto se o usuário pedir explicitamente`;

  try {
    const result = await callModel(llmPrompt, {
      userPrompt,
      operation: "generate",
    });
    if (result) {
      const sanitized = sanitizeScriptIdentityLeakage(result, [userPrompt]);
      return enforceTechnicalScriptContract(sanitized, userPrompt);
    }
  } catch {
    // Fallback local.
  }

  const fallback = sanitizeScriptIdentityLeakage(fallbackGenerate(userPrompt), [userPrompt]);
  return enforceTechnicalScriptContract(fallback, userPrompt);
}

export async function adjustScriptFromPrompt(input: AdjustInput): Promise<AdjustResult> {
  const userPrompt = input.prompt.trim();
  if (!userPrompt) {
    throw new Error("Descreva o ajuste que você quer aplicar.");
  }

  const baseContent = isTechnicalScript(input.content)
    ? input.content.trim()
    : convertLegacyScriptToTechnical(input.content, userPrompt);
  const inputForAdjust: AdjustInput = {
    ...input,
    content: baseContent,
  };

  const scope = detectScriptAdjustScope(userPrompt);
  const shouldEnforceScopedPatch = scope.mode === "patch" && scope.target.type !== "none";
  const scopedResolution = shouldEnforceScopedPatch
    ? resolveScopedSegment(baseContent, scope.target)
    : null;

  if (shouldEnforceScopedPatch && !scopedResolution) {
    throw new ScriptAdjustScopeError(
      `${describeScriptAdjustTarget(scope.target)} não foi encontrado no roteiro atual.`
    );
  }

  const intelligenceBlock = buildIntelligencePromptBlock(input.intelligenceContext);
  const technicalFormatRules =
    `Formato técnico obrigatório:\n` +
    `- Manter bloco ${TECHNICAL_SCRIPT_START} ... ${TECHNICAL_SCRIPT_END}\n` +
    `- Cada cena com heading [CENA N: ...] + tabela de 6 colunas (${TECHNICAL_HEADER_LINE})\n` +
    `- Fala sempre literal (frase pronta para câmera)\n` +
    `- Direção de Performance sempre acionável\n` +
    `- Última cena com CTA explícito\n` +
    `- Mínimo 4 e máximo 6 cenas`;

  const llmPrompt = shouldEnforceScopedPatch
    ? `Ajuste apenas a cena alvo do roteiro técnico com base no pedido do usuário.\n` +
      `Título atual: ${inputForAdjust.title}\n` +
      `Roteiro atual:\n${inputForAdjust.content}\n\n` +
      `${intelligenceBlock}\n\n` +
      `Trecho alvo: ${describeScriptAdjustTarget(scope.target)}\n` +
      `Conteúdo atual do trecho alvo:\n${scopedResolution?.segment.text || ""}\n\n` +
      `Ajuste solicitado: ${userPrompt}\n\n` +
      `Regras obrigatórias:\n` +
      `- Edite somente a cena alvo\n` +
      `- Não reescreva outras cenas\n` +
      `- Retorne APENAS o bloco completo da cena alvo ([CENA ...] + tabela)\n` +
      `- Preserve a mesma numeração da cena alvo\n` +
      `- Retorne JSON válido com {"title","content"}\n` +
      `- "title": mantenha o título atual, salvo pedido explícito para alterá-lo\n` +
      `- "content": retorne APENAS o bloco da cena alvo revisado\n` +
      `- Não inclua explicações fora do JSON\n` +
      `${technicalFormatRules}`
    : `Ajuste o roteiro técnico existente com base no pedido do usuário.\n` +
      `Título atual: ${inputForAdjust.title}\n` +
      `Roteiro atual:\n${inputForAdjust.content}\n\n` +
      `${intelligenceBlock}\n\n` +
      `Ajuste solicitado: ${userPrompt}\n\n` +
      `Regras obrigatórias:\n` +
      `- Preserve integralmente o que não foi pedido para mudar\n` +
      `- Se o pedido for pontual (ex.: primeiro parágrafo), altere só esse trecho\n` +
      `- Retorne sempre o roteiro técnico completo atualizado (nunca apenas um trecho)\n` +
      `- Use o formato técnico canônico em todas as cenas\n` +
      `- Imitar o estilo do criador sem copiar frases literalmente\n` +
      `- Não citar outros criadores, marcas ou perfis sem pedido explícito\n` +
      `- Não incluir @menções ou hashtags, exceto se o usuário pedir explicitamente\n` +
      `- Resposta em JSON válido com {"title","content"}\n` +
      `- Não inclua explicações fora do JSON\n` +
      `${technicalFormatRules}`;

  const allowedIdentitySources = [userPrompt, inputForAdjust.title, inputForAdjust.content];

  try {
    const result = await callModel(llmPrompt, {
      userPrompt,
      operation: "adjust",
    });
    if (result) {
      const sanitized = sanitizeScriptIdentityLeakage(result, allowedIdentitySources);
      if (shouldEnforceScopedPatch && scopedResolution) {
        const scopedRaw = extractScopedSceneContent(
          clampText(sanitized.content, scopedResolution.segment.text, 6000),
          scopedResolution.normalizedTargetIndex || 1
        );
        const mergedContent = mergeScopedSegment(
          baseContent,
          scopedResolution,
          scopedRaw
        );
        const mergedDraft = sanitizeAdjustedScript(inputForAdjust, {
          title: sanitized.title,
          content: mergedContent,
        });
        const technicalDraft = enforceTechnicalScriptContract(mergedDraft, userPrompt);
        return {
          ...technicalDraft,
          adjustMeta: {
            adjustMode: scope.mode,
            targetScope: scopedResolution.normalizedTargetType,
            targetIndex: scopedResolution.normalizedTargetIndex,
            scopeFound: true,
            scopeEnforced: true,
            outOfScopeChangeRate: 0,
          },
        };
      }

      const adjusted = sanitizeAdjustedScript(inputForAdjust, sanitized);
      const technicalDraft = enforceTechnicalScriptContract(adjusted, userPrompt);
      return {
        ...technicalDraft,
        adjustMeta: {
          adjustMode: scope.mode,
          targetScope: scope.target.type,
          targetIndex:
            scope.target.type === "scene" || scope.target.type === "paragraph"
              ? scope.target.index
              : null,
          scopeFound: scopedResolution !== null || scope.target.type === "none",
          scopeEnforced: false,
          outOfScopeChangeRate: -1,
        },
      };
    }
  } catch {
    // Fallback local.
  }

  if (shouldEnforceScopedPatch && scopedResolution) {
    const fallbackSnippet = fallbackAdjustScoped(scopedResolution.segment.text, userPrompt);
    const mergedContent = mergeScopedSegment(baseContent, scopedResolution, fallbackSnippet);
    const mergedDraft = sanitizeAdjustedScript(inputForAdjust, {
      title: inputForAdjust.title,
      content: mergedContent,
    });
    const technicalDraft = enforceTechnicalScriptContract(mergedDraft, userPrompt);
    return {
      ...technicalDraft,
      adjustMeta: {
        adjustMode: scope.mode,
        targetScope: scopedResolution.normalizedTargetType,
        targetIndex: scopedResolution.normalizedTargetIndex,
        scopeFound: true,
        scopeEnforced: true,
        outOfScopeChangeRate: 0,
      },
    };
  }

  const fallback = sanitizeScriptIdentityLeakage(fallbackAdjust(inputForAdjust), allowedIdentitySources);
  const adjusted = sanitizeAdjustedScript(inputForAdjust, fallback);
  const technicalDraft = enforceTechnicalScriptContract(adjusted, userPrompt);
  return {
    ...technicalDraft,
    adjustMeta: {
      adjustMode: scope.mode,
      targetScope: scope.target.type,
      targetIndex:
        scope.target.type === "scene" || scope.target.type === "paragraph"
          ? scope.target.index
          : null,
      scopeFound: scopedResolution !== null || scope.target.type === "none",
      scopeEnforced: false,
      outOfScopeChangeRate: -1,
    },
  };
}
