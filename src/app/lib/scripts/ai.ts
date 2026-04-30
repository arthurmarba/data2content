import OpenAI from "openai";

import { getCategoryById } from "@/app/lib/classification";
import { logger } from "@/app/lib/logger";
import { recordScriptsStageDuration } from "./performanceTelemetry";
import type { ScriptIntelligenceContext } from "./intelligenceContext";
import {
  describeScriptAdjustTarget,
  detectScriptAdjustScope,
  type ScriptAdjustMode,
  type ScriptAdjustTarget,
} from "./adjustScope";
import { mergeScopedSegment, resolveScopedSegment } from "./scriptSegmentation";
import { parsePromptForScriptIntelligence } from "./promptParser";

type ScriptDraft = {
  title: string;
  content: string;
};

export type ScriptSemanticReviewMeta = {
  attempted: boolean;
  retried: boolean;
  acceptedAfterRetry: boolean;
  initialOverallScore?: number;
  finalOverallScore?: number;
  initialPasses?: boolean;
  finalPasses?: boolean;
  initialIssues?: string[];
  finalIssues?: string[];
  rewriteBrief?: string;
};

type ScriptDraftWithReview = ScriptDraft & {
  reviewMeta?: ScriptSemanticReviewMeta;
};

type GenerateInput = {
  prompt: string;
  title?: string;
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

type AdjustResult = ScriptDraftWithReview & {
  adjustMeta: ScriptAdjustMeta;
};

type ScriptModelTier = "base" | "premium";
type ScriptModelOperation = "generate" | "adjust";
type CallModelOptions = {
  userPrompt: string;
  operation: ScriptModelOperation;
  adjustMode?: ScriptAdjustMode;
};

export type ScriptModelSelection = {
  model: string;
  tier: ScriptModelTier;
  reason:
  | "hybrid_disabled"
  | "operation_generate_default"
  | "operation_adjust_default"
  | "operation_adjust_rewrite_default"
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
const QUICK_BLUEPRINT_INTENT_REGEX =
  /(vis[aã]o r[aá]pida|visao rapida|bem direto|mais curt[oa]|enxut[oa]|objetiv[oa]|sem enrola[cç][aã]o|quatro cenas|4 cenas)/i;
const DEEP_BLUEPRINT_INTENT_REGEX =
  /(mais dire[cç][aã]o|mais detalhad|aprofund|passo a passo|mais complet[oa]|mais robust[oa]|quebre melhor|cinco cenas|5 cenas|seis cenas|6 cenas)/i;
const CONSTRAINT_TOKEN_REGEX =
  /(sem|com|evite|obrigat[oó]ri|inclua|não|nao|tom|estrutura|objetivo|p[úu]blico|persona|cta|gancho|par[aá]grafo|hook|copy)/gi;
const BULLET_ITEM_REGEX = /(?:^|\n)\s*(?:[-*]|\d+[.)])/gm;
const TECHNICAL_SCRIPT_START = "[ROTEIRO COPY-FIRST V1]";
const TECHNICAL_SCRIPT_END = "[/ROTEIRO COPY-FIRST V1]";
const LEGACY_TECHNICAL_SCRIPT_START = "[ROTEIRO TÉCNICO V1 — FORMATO DE FLUXO]";
const LEGACY_TECHNICAL_SCRIPT_END = "[/ROTEIRO TÉCNICO V1 — FORMATO DE FLUXO]";
const TECHNICAL_SCENE_HEADING_REGEX =
  /^\s*(?:\[\s*)?(?:CENA|SCENE)\s*(?:#\s*)?(\d{1,2})\s*:\s*([^\]\n]+?)(?:\]\s*)?$/i;
const TECHNICAL_HEADER_LINE =
  "| Tempo | Visual | Fala | Direção |";
const TECHNICAL_HEADER_SEPARATOR = "| :--- | :--- | :--- | :--- |";
const TECHNICAL_HEADER_DETECT_REGEX =
  /^\|\s*tempo\s*\|\s*visual\s*\|\s*fala\s*\|\s*dire[cç][aã]o\s*\|?$/i;

const FLOW_VISUAL_REGEX = /^(?:visual|texto na tela|texto|imagem|mostre|enquadramento|a[cç][aã]o)\s*:\s*(.+)$/i;
const FLOW_FALA_REGEX = /^fala(?: \(literal\))?\s*:\s*(.+)$/i;
const FLOW_DIRECAO_REGEX = /^(?:tom|dire[cç][aã]o|performance|nota)\s*:\s*(.+)$/i;
const FLOW_TEMPO_IN_HEADING_REGEX = /\(([^)]+)\)\s*$/;
const CTA_LITERAL_REGEX = /\b(comente|coment[aá]rio|salve|salvar|compartilhe|compartilha|direct|dm|me chama|segue|seguir|link|me conta|me diz|responde aqui|qual foi|e voc[eê])\b/i;
const CTA_HEADING_REGEX = /\b(CTA|CALL TO ACTION|CHAMADA)\b/i;
const CTA_OVERLAY_REGEX = /\b(comente|salve|compartilhe|cta|link|direct|dm|segue)\b/i;
const INSTRUCTIONAL_LITERAL_REGEX =
  /^\s*(mostre|mostra|explique|explica|apresente|apresenta|grave|abra|feche|finalize|encerre|fa[cç]a|diga|fale)\b/i;
const TITLE_CHANGE_INTENT_REGEX =
  /(t[íi]tulo|headline|nome do roteiro|renomeie|renomear|mude o t[íi]tulo|troque o t[íi]tulo|ajuste o t[íi]tulo)/i;
const PATCH_HEADING_INTENT_REGEX =
  /(estrutura|sequ[eê]ncia|ordem|gancho|cta|prova|virada|nome da cena|t[ií]tulo da cena)/i;
const PATCH_TEMPO_INTENT_REGEX = /(tempo|timing|dura[cç][aã]o|segundos|seg\b|minuto)/i;
const PATCH_VISUAL_INTENT_REGEX =
  /(visual|imagem|enquadramento|b-roll|broll|texto na tela|cen[aá]rio|mostre|mostra)/i;
const PATCH_DIRECAO_INTENT_REGEX =
  /(dire[cç][aã]o|tom|entona[cç][aã]o|cad[êe]ncia|ritmo|performance|gesto|postura)/i;
const GENERIC_SCRIPT_CLICHE_REGEX =
  /\b(nesse v[ií]deo|neste v[ií]deo|hoje eu vou te mostrar|vou te mostrar|voc[eê] precisa|aprenda isso|fica comigo at[eé] o final)\b/i;
const PRACTICAL_MARKER_REGEX =
  /\b(na pr[aá]tica|passo|ajuste|ritual|processo|crit[eé]rio|sinal|erro|troca|troque|pare de|comece|fa[cç]a|teste|observe|repare|h[aá]bito|rotina|checklist|jeito|forma de|como)\b/i;
const ABSTRACT_CLAIM_REGEX =
  /\b(importante|essencial|fundamental|necess[aá]rio|estrat[eé]gic[oa]|valor|jornada|mindset|energia|consist[eê]ncia|resultado)\b/i;
const PRACTICAL_VALUE_PROMISE_REGEX =
  /\b(diagn[oó]stico|ajuste|passo|crit[eé]rio|erro|ritual|sinal|decis[aã]o|micro passo|mecanismo)\b/i;
const BLUEPRINT_SPEECH_REGEX =
  /\b(mensagem da cena|o que precisa comunicar|frase[- ]?exemplo|exemplo opcional|ideia central|ponto central|abrir com|fechar perguntando|cta sugerido|dizer que|nomear o erro)\b/i;
const PRACTICAL_SHOOT_MARKER_REGEX =
  /\b(close|plano|meio-corpo|rosto|celular|trip[eé]|painel|espelho|mesa|m[aã]o|b-roll|broll|corte|texto na tela|porta|janela|fundo|cen[aá]rio|luz|volante|garrafa|mochila|quadro|notas|aponta|mostra|abre|retorna|grava|gravar)\b/i;
const STRATEGIC_REASON_REGEX =
  /\b(por que assim|porque assim|faz sentido porque|isso funciona porque|neste perfil|no perfil|categori|narrativ|gancho|contexto vencedor|formato|tom|refer[eê]ncia|engajamento|lift|janela|hor[aá]rio|publica[cç][aã]o|hist[oó]rico)\b/i;
const SCRIPT_NARRATIVE_QUALITY_RULES = [
  "Abra com observação vivida, confissão, contraste ou opinião concreta; evite promessa genérica.",
  "Construa arco humano: gancho -> dor/tensão real -> mudança prática -> motivo humano/prova -> CTA conversacional.",
  "Na Fala, descreva o que precisa ser comunicado em cada cena e, quando ajudar, inclua só uma frase-exemplo curta em vez de tentar fechar o texto inteiro.",
  "Em Visual e Direção, deixe claro como gravar a cena de forma prática: enquadramento, ação, objeto, cenário, ritmo e gesto.",
  "Use detalhes concretos e cotidianos em vez de abstrações: ritual, objeto, cenário, sensação, hábito ou reação.",
  "Quando fizer sentido, inclua vulnerabilidade, contradição ou ironia leve para gerar identificação.",
  "O CTA final deve parecer continuação da conversa e convidar resposta real; evite CTA robótico e genérico.",
  "Evite clichês como 'nesse vídeo', 'hoje eu vou te mostrar', 'você precisa' e 'aprenda isso', salvo pedido explícito.",
].map((rule) => `- ${rule}`).join("\n");

// Legacy fallbacks for parsers
const FLOW_ENQUADRAMENTO_REGEX = /^enquadramento\s*:\s*(.+)$/i;
const FLOW_ACAO_REGEX = /^(?:a[cç][aã]o|a[cç][aã]o\/movimento)\s*:\s*(.+)$/i;
const FLOW_PERFORMANCE_REGEX = /^(?:performance|dire[cç][aã]o de performance)\s*:\s*(.+)$/i;
const FLOW_TEXTO_TELA_REGEX = /^texto na tela\s*:\s*(.+)$/i;

type TechnicalSceneRow = {
  tempo: string;
  visual: string;
  fala: string;
  direcao: string;
};

type TechnicalSceneBlock = {
  index: number;
  heading: string;
  row: TechnicalSceneRow;
};

type TechnicalEditorialBrief = {
  whatToPost: string;
  whyPostThisWay: string;
  whenToPost: string;
  howVideoShouldWork: string;
};

type TechnicalContractOptions = {
  runQualityPass?: boolean;
  editorialDecision?: ScriptIntelligenceContext["editorialDecision"] | null;
  preferredSceneCount?: number | null;
  maxSceneCount?: number | null;
};

type BlueprintDensityProfile = {
  preferredSceneCount: number;
  maxSceneCount: number;
  promptGuidance: string;
};

export type TechnicalScriptQualityScore = {
  perceivedQuality: number;
  hookStrength: number;
  specificityScore: number;
  speakabilityScore: number;
  shootabilityScore: number;
  strategyScore: number;
  ctaStrength: number;
  diversityScore: number;
  utilityScore: number;
  concisionScore: number;
  sceneCount: number;
};

const QUALITY_PASS_MIN_SCORE = 0.78;
const SEMANTIC_REVIEW_MIN_SCORE = 7.4;
const SEMANTIC_REVIEW_MIN_DIMENSION_SCORE = 6.8;
export const TECHNICAL_SCRIPT_MAX_CHARS = (() => {
  const parsed = Number(process.env.SCRIPTS_TECHNICAL_SCRIPT_MAX_CHARS ?? 3000);
  return Number.isFinite(parsed) && parsed >= 1800 ? Math.floor(parsed) : 3000;
})();
const TECHNICAL_SCENE_VISUAL_MAX_CHARS = (() => {
  const parsed = Number(process.env.SCRIPTS_TECHNICAL_SCENE_VISUAL_MAX_CHARS ?? 150);
  return Number.isFinite(parsed) && parsed >= 80 ? Math.floor(parsed) : 150;
})();
const TECHNICAL_SCENE_FALA_MAX_CHARS = (() => {
  const parsed = Number(process.env.SCRIPTS_TECHNICAL_SCENE_FALA_MAX_CHARS ?? 190);
  return Number.isFinite(parsed) && parsed >= 100 ? Math.floor(parsed) : 190;
})();
const TECHNICAL_SCENE_DIRECTION_MAX_CHARS = (() => {
  const parsed = Number(process.env.SCRIPTS_TECHNICAL_SCENE_DIRECTION_MAX_CHARS ?? 90);
  return Number.isFinite(parsed) && parsed >= 40 ? Math.floor(parsed) : 90;
})();
const TECHNICAL_SCENE_REASON_MAX_CHARS = (() => {
  const parsed = Number(process.env.SCRIPTS_TECHNICAL_SCENE_REASON_MAX_CHARS ?? 108);
  return Number.isFinite(parsed) && parsed >= 60 ? Math.floor(parsed) : 108;
})();
const TECHNICAL_EDITORIAL_WHAT_MAX_CHARS = 125;
const TECHNICAL_EDITORIAL_WHY_MAX_CHARS = 135;
const TECHNICAL_EDITORIAL_WHEN_MAX_CHARS = 72;
const TECHNICAL_EDITORIAL_HOW_MAX_CHARS = 105;
const INTELLIGENCE_PROMPT_MAX_CHARS = (() => {
  const parsed = Number(process.env.SCRIPTS_INTELLIGENCE_PROMPT_MAX_CHARS ?? 3200);
  return Number.isFinite(parsed) && parsed >= 1200 ? Math.floor(parsed) : 3200;
})();

type ScriptSemanticQualityAssessment = {
  overall: number;
  passes: boolean;
  adherence: number;
  specificity: number;
  humanity: number;
  titleAlignment: number;
  creatorFit: number;
  hook: number;
  cta: number;
  utility: number;
  issues: string[];
  rewriteBrief: string;
};

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

function clampTextByBoundary(value: string, max: number, fallback = "...") {
  const normalized = typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
  if (!normalized) return fallback;
  if (normalized.length <= max) return normalized;

  const sliced = normalized.slice(0, max).trimEnd();
  const sentenceBoundary = Math.max(
    sliced.lastIndexOf(". "),
    sliced.lastIndexOf("! "),
    sliced.lastIndexOf("? "),
    sliced.lastIndexOf("; ")
  );
  const commaBoundary = sliced.lastIndexOf(", ");
  const wordBoundary = sliced.lastIndexOf(" ");

  const bestBoundary =
    sentenceBoundary > max * 0.55
      ? sentenceBoundary + 1
      : commaBoundary > max * 0.7
        ? commaBoundary
        : wordBoundary > max * 0.7
          ? wordBoundary
          : sliced.length;

  const compacted = sliced
    .slice(0, bestBoundary)
    .replace(/[,:;–—-]\s*$/u, "")
    .trimEnd();

  if (!compacted) return fallback;
  return `${compacted}...`;
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

function parseTemperature(value: string | undefined | null, defaultValue: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return defaultValue;
  return Math.max(0, Math.min(2, parsed));
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

function extractRequestedSceneCount(prompt: string): number | null {
  const normalized = String(prompt || "").toLowerCase();
  const numericMatch = normalized.match(/\b([4-6])\s*cenas?\b/);
  if (numericMatch?.[1]) return Number(numericMatch[1]);
  if (/\bquatro cenas?\b/.test(normalized)) return 4;
  if (/\bcinco cenas?\b/.test(normalized)) return 5;
  if (/\bseis cenas?\b/.test(normalized)) return 6;
  return null;
}

export function resolveBlueprintDensityProfile(prompt: string): BlueprintDensityProfile {
  const normalized = String(prompt || "").trim();
  const explicitSceneCount = extractRequestedSceneCount(normalized);
  if (explicitSceneCount && explicitSceneCount >= 4 && explicitSceneCount <= 6) {
    return {
      preferredSceneCount: explicitSceneCount,
      maxSceneCount: explicitSceneCount,
      promptGuidance:
        explicitSceneCount === 4
          ? "Use exatamente 4 cenas; não abra cenas extras."
          : `Use exatamente ${explicitSceneCount} cenas; só distribua o arco nelas, sem prolixidade.`,
    };
  }

  const complexityScore = computePromptComplexityScore(normalized, "generate");
  const looksQuick = QUICK_BLUEPRINT_INTENT_REGEX.test(normalized);
  const wantsDepth = DEEP_BLUEPRINT_INTENT_REGEX.test(normalized);
  const isSimplePrompt =
    normalized.length <= 120 &&
    normalized.split("\n").filter((line) => line.trim()).length <= 2 &&
    complexityScore <= 1;

  if (wantsDepth || complexityScore >= 3) {
    return {
      preferredSceneCount: 5,
      maxSceneCount: 6,
      promptGuidance: "Abra para 5 cenas quando a prova ou a virada precisarem de bloco próprio; só use 6 se realmente necessário.",
    };
  }

  if (looksQuick || isSimplePrompt) {
    return {
      preferredSceneCount: 4,
      maxSceneCount: 4,
      promptGuidance: "Use 4 cenas por padrão e deixe cada cena mais seca e filmável.",
    };
  }

  return {
    preferredSceneCount: 4,
    maxSceneCount: 5,
    promptGuidance: "Prefira 4 cenas; só abra 5 se faltar clareza real na prova ou na virada.",
  };
}

export function selectScriptModelForPrompt(params: {
  userPrompt: string;
  operation: ScriptModelOperation;
  adjustMode?: ScriptAdjustMode;
}): ScriptModelSelection {
  const baseModel = (process.env.OPENAI_MODEL || "gpt-4o-mini").trim() || "gpt-4o-mini";
  const advancedModel = (
    process.env.OPENAI_MODEL_ADVANCED ||
    process.env.OPENAI_MODEL_PREMIUM ||
    "gpt-4o"
  ).trim();
  const hybridEnabled = parseBoolean(process.env.OPENAI_MODEL_HYBRID_ENABLED, true);
  const operationRoutingEnabled = parseBoolean(
    process.env.OPENAI_MODEL_HYBRID_OPERATION_ROUTING_ENABLED,
    true
  );
  const adjustRewritePremiumEnabled = parseBoolean(
    process.env.OPENAI_MODEL_HYBRID_ADJUST_REWRITE_PREMIUM_ENABLED,
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
      const shouldPreferPremiumForAdjust =
        adjustRewritePremiumEnabled &&
        (params.adjustMode === "rewrite_full" || params.adjustMode === "new_script");
      if (shouldPreferPremiumForAdjust) {
        return {
          model: advancedModel,
          tier: "premium",
          reason: "operation_adjust_rewrite_default",
          fallbackModel: baseModel,
        };
      }
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

export function shouldRunQualityPassForAdjustMode(mode: ScriptAdjustMode): boolean {
  return mode === "rewrite_full" || mode === "new_script";
}

export function selectScriptTemperature(params: {
  operation: ScriptModelOperation;
  adjustMode?: ScriptAdjustMode;
}): number {
  const baseTemp = parseTemperature(process.env.OPENAI_TEMP, 0.4);
  const generateTemp = parseTemperature(process.env.OPENAI_TEMP_GENERATE, baseTemp);
  const adjustTemp = parseTemperature(process.env.OPENAI_TEMP_ADJUST, baseTemp);
  const adjustPatchDefault = Math.max(0, Math.min(adjustTemp, 0.25));
  const adjustRewriteDefault = Math.max(adjustTemp, 0.45);
  const adjustPatchTemp = parseTemperature(process.env.OPENAI_TEMP_ADJUST_PATCH, adjustPatchDefault);
  const adjustRewriteTemp = parseTemperature(process.env.OPENAI_TEMP_ADJUST_REWRITE, adjustRewriteDefault);

  if (params.operation === "generate") return generateTemp;
  if (params.adjustMode === "patch") return adjustPatchTemp;
  if (params.adjustMode === "rewrite_full" || params.adjustMode === "new_script") {
    return adjustRewriteTemp;
  }
  return adjustTemp;
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
  if (!normalized) return "esse tema";
  const parsedIntent = parsePromptForScriptIntelligence(normalized).intent;
  const explicitSubject = parsedIntent.subjectHint?.trim();
  if (explicitSubject) {
    return clampText(stripMarkdownMarkers(explicitSubject), "esse tema", 80);
  }
  if (parsedIntent.wantsWinnerBasedScript) {
    return "o que ja funciona no seu perfil";
  }
  const patterns = [
    /(?:sobre|tema|assunto)\s+(.+)$/i,
    /(?:para)\s+(.+)$/i,
  ];
  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (!match?.[1]) continue;
    const candidate = stripMarkdownMarkers(match[1]).replace(/[?.!,:;]+$/g, "").trim();
    if (candidate.length >= 4) return clampText(candidate, "esse tema", 80);
  }
  const cleaned = normalized
    .replace(/\b(crie|gere|fa[cç]a|ajuste|reescreva|roteiro|script|novo|uma|um|para|pra)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (cleaned.length >= 6 && cleaned.length <= 80 && !/\b(meu perfil|meu estilo|mais engaja)\b/i.test(cleaned)) {
    return clampText(cleaned, "esse tema", 80);
  }
  return "esse tema";
}

function compactPromptExample(value: string, max = 140): string {
  const normalized = sanitizeTableCell(value || "", "");
  if (!normalized) return "";
  return normalized.length > max ? `${normalized.slice(0, max - 1).trim()}…` : normalized;
}

function uniqueCompactValues(values: Array<string | null | undefined>, maxItems: number, maxChars = 120): string[] {
  const output: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    const normalized = compactPromptExample(value || "", maxChars);
    if (!normalized) continue;
    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(normalized);
    if (output.length >= maxItems) break;
  }
  return output;
}

function buildPracticalValueBlock(prompt: string): string {
  const objective = inferScriptObjective(prompt);
  const baseLines = [
    "- O espectador precisa sair com pelo menos 1 diagnóstico concreto e 1 ajuste aplicável.",
    "- Se o assunto for amplo, escolha um recorte útil e operacional em vez de falar de tudo.",
    "- Não entregue tese vaga: mostre mecanismo, critério, passo, erro ou ritual observável.",
    "- O criador precisa conseguir visualizar como gravar cada cena sem depender de um texto final perfeito.",
    "- Descreva captação prática: enquadramento, ação, objeto, cenário, corte, gesto ou apoio visual quando fizer sentido.",
  ];

  if (objective === "converter") {
    baseLines.push("- Mostre o custo de continuar errando e o micro-passo que aproxima da conversão.");
  } else if (objective === "autoridade") {
    baseLines.push("- Traga um critério, erro recorrente ou leitura prática que prove repertório real.");
  } else if (objective === "engajar") {
    baseLines.push("- Mesmo se o foco for engajamento, entregue insight reaplicável; não pare em opinião vazia.");
  } else {
    baseLines.push("- Ensine algo que a pessoa consiga testar ainda hoje sem depender de contexto extra.");
  }

  return `Utilidade prática obrigatória:\n${baseLines.join("\n")}\n\n`;
}

export function resolveEditorialAnchorTitle(input: {
  prompt: string;
  title?: string;
  intelligenceContext?: ScriptIntelligenceContext | null;
}): string {
  const explicitTitle = clampText(input.title, "", 80);
  if (explicitTitle) return explicitTitle;

  const parsedPrompt = input.intelligenceContext?.intent ?? parsePromptForScriptIntelligence(input.prompt).intent;
  const subjectHint = clampText(parsedPrompt?.subjectHint, "", 70);
  if (subjectHint) {
    return clampText(`Plano de vídeo: ${subjectHint}`, subjectHint, 80);
  }

  const topic = clampText(extractTopicHint(input.prompt), "", 70);
  if (topic && topic !== "esse tema") {
    return clampText(`Plano de vídeo: ${topic}`, topic, 80);
  }

  const promptFallback = clampText(input.prompt.split(/\s+/).slice(0, 8).join(" "), "Roteiro técnico", 80);
  return promptFallback || "Roteiro técnico";
}

function joinPromptSectionsWithinBudget(sections: Array<string | null | undefined>, maxChars: number): string {
  const cleaned = sections
    .map((section) => String(section || "").trim())
    .filter(Boolean);
  if (!cleaned.length) return "";

  let result = "";
  for (const section of cleaned) {
    const next = result ? `${result}\n${section}` : section;
    if (next.length <= maxChars) {
      result = next;
      continue;
    }
    const remaining = maxChars - (result ? result.length + 1 : 0);
    if (remaining < 120) break;
    result = `${result}${result ? "\n" : ""}${section.slice(0, remaining - 1).trim()}…`;
    break;
  }
  return result;
}

function compactTechnicalEditorialValue(value: string, maxChars: number, fallback: string): string {
  return clampTextByBoundary(sanitizeTableCell(value, fallback), maxChars, fallback);
}

function compactEditorialTiming(value: string): string {
  const normalized = String(value || "").replace(/\r/g, "").replace(/\s+/g, " ").trim();
  if (!normalized) return "";
  const parts = normalized.split("|").map((part) => part.trim()).filter(Boolean);
  const weekdayPart = parts.find((part) => /dias com mais recorr[êe]ncia/i.test(part)) || "";
  const hoursPart = parts.find((part) => /hor[áa]rios com mais recorr[êe]ncia/i.test(part)) || "";
  const weekdays = weekdayPart
    .replace(/dias com mais recorr[êe]ncia:\s*/i, "")
    .replace(/\se\s/gi, "/")
    .replace(/\s+/g, "")
    .trim();
  const hours = hoursPart
    .replace(/hor[áa]rios com mais recorr[êe]ncia:\s*/i, "")
    .replace(/\se\s/gi, "/")
    .replace(/\s+/g, "")
    .trim();
  if (weekdays || hours) {
    return [weekdays, hours].filter(Boolean).join(", ");
  }
  return compactTechnicalEditorialValue(normalized, TECHNICAL_EDITORIAL_WHEN_MAX_CHARS, "");
}

function compactSceneStrategicReason(value: string, maxChars: number): string {
  const normalized = sanitizeTableCell(value, "");
  if (!normalized) return "";

  const tightened = normalized
    .replace(/\b(tende a|costuma|geralmente|normalmente)\b/gi, "")
    .replace(/\b(nesse|neste)\s+perfil\b/gi, "no perfil")
    .replace(/\bde forma\b/gi, "")
    .replace(/\bmais cedo\b/gi, "cedo")
    .replace(/\bde que\b/gi, "que")
    .replace(/\bquando parecer extensão natural da pauta\b/gi, "quando parece continuação da pauta")
    .replace(/\bem reels curtos\b/gi, "")
    .replace(/\s+/g, " ")
    .replace(/\s+,/g, ",")
    .trim();

  const firstSentence = tightened.split(/(?<=[.!?])\s+/)[0] || tightened;
  return clampTextByBoundary(firstSentence, maxChars, "");
}

function compactEvidenceLabel(value: string): string {
  const normalized = sanitizeTableCell(value, "");
  if (!normalized) return "";
  return normalized
    .replace(/\bproposal\b/gi, "prop")
    .replace(/\bcontext\b/gi, "ctx")
    .replace(/\btone\b/gi, "tom")
    .replace(/\broteiro\(s\) vencedor\(es\)\b/gi, "roteiros fortes")
    .replace(/\blegenda\(s\) forte\(s\)\b/gi, "legendas fortes")
    .replace(/\bdias com mais recorr[êe]ncia:\s*/gi, "")
    .replace(/\bhor[áa]rios com mais recorr[êe]ncia:\s*/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractPromptValueAfterColon(value: string): string {
  const index = value.indexOf(":");
  if (index < 0) return "";
  return value.slice(index + 1).trim();
}

function deriveTechnicalEditorialBriefFromPrompt(fallbackPrompt: string): TechnicalEditorialBrief {
  const topic = sanitizeTableCell(extractTopicHint(fallbackPrompt), "o tema principal do vídeo");
  const objective = inferScriptObjective(fallbackPrompt);
  const whyByObjective =
    objective === "converter"
      ? `Melhor quando mostra o custo do erro antes do próximo passo.`
      : objective === "autoridade"
        ? `Melhor quando organiza a pauta em critério claro, não em opinião vaga.`
        : objective === "engajar"
          ? `Melhor quando abre pela dor real e fecha com pergunta específica.`
          : `Melhor quando deixa a promessa prática visível logo na abertura.`;

  return {
    whatToPost: `Reels sobre ${topic} com promessa concreta e recorte observável.`,
    whyPostThisWay: whyByObjective,
    whenToPost: "Use a janela forte; sem sinal claro, mantenha consistência.",
    howVideoShouldWork: "gancho claro -> contexto real -> ajuste -> fechamento conversacional",
  };
}

function buildTechnicalEditorialBriefFromDecision(
  decision: ScriptIntelligenceContext["editorialDecision"] | null | undefined,
  fallbackPrompt: string
): TechnicalEditorialBrief {
  const fallback = deriveTechnicalEditorialBriefFromPrompt(fallbackPrompt);
  if (!decision) return fallback;

  const whyEvidencePieces = uniqueCompactValues(
    [
      ...(decision.whyThisShouldWork || []),
      ...(decision.evidence || []).filter((line) =>
        /\b(proposal|context|tone|roteiro\(s\)|lift|timing|legenda\(s\)|hor[aá]rios?|dias?)\b/i.test(line)
      ),
    ],
    2,
    84
  ).map((item) => compactEvidenceLabel(item));
  const whyPostThisWay = compactTechnicalEditorialValue(
    whyEvidencePieces.join("; "),
    TECHNICAL_EDITORIAL_WHY_MAX_CHARS,
    fallback.whyPostThisWay
  );
  const postDirective = compactTechnicalEditorialValue(
    (decision.postDirective || fallback.whatToPost).replace(/^Poste um reels sobre\s*/i, "Reels sobre "),
    TECHNICAL_EDITORIAL_WHAT_MAX_CHARS,
    fallback.whatToPost
  );
  const howVideoShouldWork = compactTechnicalEditorialValue(
    [decision.narrativeAngle ? `Ângulo: ${decision.narrativeAngle}.` : "", decision.recommendedStructure || ""]
      .filter(Boolean)
      .join(" "),
    TECHNICAL_EDITORIAL_HOW_MAX_CHARS,
    fallback.howVideoShouldWork
  );

  return {
    whatToPost: postDirective,
    whyPostThisWay,
    whenToPost: compactEditorialTiming(decision.postingWindow || fallback.whenToPost),
    howVideoShouldWork,
  };
}

function extractTechnicalEditorialBrief(content: string): TechnicalEditorialBrief | null {
  const normalized = (content || "").replace(/\r/g, "");
  if (!normalized) return null;

  const lines = normalized.split("\n");
  let whatToPost = "";
  let whyPostThisWay = "";
  let whenToPost = "";
  let howVideoShouldWork = "";
  let activeField: keyof TechnicalEditorialBrief | null = null;

  for (const rawLine of lines) {
    const trimmed = stripMarkdownMarkers(rawLine).trim();
    if (!trimmed) continue;
    if (
      trimmed === TECHNICAL_SCRIPT_START ||
      trimmed === TECHNICAL_SCRIPT_END ||
      trimmed === LEGACY_TECHNICAL_SCRIPT_START ||
      trimmed === LEGACY_TECHNICAL_SCRIPT_END
    ) {
      continue;
    }
    if (TECHNICAL_SCENE_HEADING_REGEX.test(trimmed)) break;
    if (trimmed.startsWith("|")) continue;

    if (/^o que postar\s*:/i.test(trimmed)) {
      whatToPost = extractPromptValueAfterColon(trimmed);
      activeField = "whatToPost";
      continue;
    }
    if (/^por que postar(?: assim)?\s*:/i.test(trimmed) || /^por que esse v[ií]deo\s*:/i.test(trimmed)) {
      whyPostThisWay = extractPromptValueAfterColon(trimmed);
      activeField = "whyPostThisWay";
      continue;
    }
    if (/^quando postar\s*:/i.test(trimmed) || /^janela de publica[cç][aã]o\s*:/i.test(trimmed)) {
      whenToPost = extractPromptValueAfterColon(trimmed);
      activeField = "whenToPost";
      continue;
    }
    if (/^como esse v[ií]deo deve funcionar\s*:/i.test(trimmed) || /^estrutura editorial\s*:/i.test(trimmed)) {
      howVideoShouldWork = extractPromptValueAfterColon(trimmed);
      activeField = "howVideoShouldWork";
      continue;
    }

    if (activeField === "whatToPost") whatToPost = appendPromptValue(whatToPost, trimmed);
    if (activeField === "whyPostThisWay") whyPostThisWay = appendPromptValue(whyPostThisWay, trimmed);
    if (activeField === "whenToPost") whenToPost = appendPromptValue(whenToPost, trimmed);
    if (activeField === "howVideoShouldWork") howVideoShouldWork = appendPromptValue(howVideoShouldWork, trimmed);
  }

  if (!whatToPost && !whyPostThisWay && !whenToPost && !howVideoShouldWork) return null;

  return {
    whatToPost: compactTechnicalEditorialValue(whatToPost, TECHNICAL_EDITORIAL_WHAT_MAX_CHARS, ""),
    whyPostThisWay: compactTechnicalEditorialValue(whyPostThisWay, TECHNICAL_EDITORIAL_WHY_MAX_CHARS, ""),
    whenToPost: compactTechnicalEditorialValue(whenToPost, TECHNICAL_EDITORIAL_WHEN_MAX_CHARS, ""),
    howVideoShouldWork: compactTechnicalEditorialValue(howVideoShouldWork, TECHNICAL_EDITORIAL_HOW_MAX_CHARS, ""),
  };
}

function resolveTechnicalEditorialBrief(params: {
  rawContent: string;
  fallbackPrompt: string;
  editorialDecision?: ScriptIntelligenceContext["editorialDecision"] | null;
}): TechnicalEditorialBrief {
  const extracted = extractTechnicalEditorialBrief(params.rawContent);
  if (extracted?.whatToPost || extracted?.whyPostThisWay || extracted?.whenToPost || extracted?.howVideoShouldWork) {
    return {
      whatToPost: extracted.whatToPost || buildTechnicalEditorialBriefFromDecision(params.editorialDecision, params.fallbackPrompt).whatToPost,
      whyPostThisWay:
        extracted.whyPostThisWay || buildTechnicalEditorialBriefFromDecision(params.editorialDecision, params.fallbackPrompt).whyPostThisWay,
      whenToPost: extracted.whenToPost || buildTechnicalEditorialBriefFromDecision(params.editorialDecision, params.fallbackPrompt).whenToPost,
      howVideoShouldWork:
        extracted.howVideoShouldWork ||
        buildTechnicalEditorialBriefFromDecision(params.editorialDecision, params.fallbackPrompt).howVideoShouldWork,
    };
  }
  return buildTechnicalEditorialBriefFromDecision(params.editorialDecision, params.fallbackPrompt);
}

function appendPromptValue(current: string, next: string): string {
  const normalized = sanitizeTableCell(next, "");
  if (!normalized) return current;
  return current ? `${current} ${normalized}` : normalized;
}

function serializeTechnicalEditorialBrief(brief: TechnicalEditorialBrief | null | undefined): string {
  if (!brief) return "";
  const whatToPost = compactTechnicalEditorialValue(brief.whatToPost, TECHNICAL_EDITORIAL_WHAT_MAX_CHARS, "");
  const whyPostThisWay = compactTechnicalEditorialValue(
    brief.whyPostThisWay,
    TECHNICAL_EDITORIAL_WHY_MAX_CHARS,
    ""
  );
  const whenToPost = compactTechnicalEditorialValue(brief.whenToPost, TECHNICAL_EDITORIAL_WHEN_MAX_CHARS, "");
  const howVideoShouldWork = compactTechnicalEditorialValue(
    brief.howVideoShouldWork,
    TECHNICAL_EDITORIAL_HOW_MAX_CHARS,
    ""
  );
  const lines = [
    whatToPost ? `O que postar: ${whatToPost}` : null,
    whyPostThisWay ? `Por que postar assim: ${whyPostThisWay}` : null,
    whenToPost ? `Quando postar: ${whenToPost}` : null,
    howVideoShouldWork ? `Como esse vídeo deve funcionar: ${howVideoShouldWork}` : null,
  ].filter(Boolean);
  return lines.join("\n");
}

function defaultHeadingForScene(index: number, totalScenes = 4): string {
  if (index === 1) return "GANCHO";
  if (index === 2) return "CONTEXTO";
  if (index === 3) return "DEMONSTRAÇÃO";
  if (index === totalScenes) return "CTA";
  if (index === 4) return "PROVA";
  if (index === 5) return "VIRADA";
  return "REFORÇO";
}

function sanitizeSceneHeadingLabel(value: string): string {
  return stripMarkdownMarkers(value || "")
    .replace(/[^\p{L}\p{N}\s/_-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function splitHeadingLabelAndTempo(rawHeading: string): { heading: string; tempo: string | null } {
  const cleaned = stripMarkdownMarkers(rawHeading || "").replace(/\s+/g, " ").trim();
  if (!cleaned) return { heading: "", tempo: null };
  const tempoMatch = cleaned.match(FLOW_TEMPO_IN_HEADING_REGEX);
  const tempo = tempoMatch?.[1] ? tempoMatch[1].replace(/\s+/g, " ").trim() : null;
  const heading = sanitizeSceneHeadingLabel(cleaned.replace(FLOW_TEMPO_IN_HEADING_REGEX, "").trim());
  return { heading, tempo };
}

function normalizeSceneHeadingLabel(value: string, index: number, totalScenes = 4): string {
  const fallback = defaultHeadingForScene(index, totalScenes);
  const normalized = sanitizeSceneHeadingLabel(value);
  if (index === totalScenes) return "CTA";
  if (index <= 3) return fallback;
  if (!normalized) return fallback;
  if (CTA_HEADING_REGEX.test(normalized)) return fallback;
  return normalized;
}

function sanitizeTableCell(value: string, fallback = "..."): string {
  const sanitized = stripMarkdownMarkers(value || "")
    .replace(/\|/g, "/")
    .replace(/\s+/g, " ")
    .trim();
  return sanitized || fallback;
}

function resolveSceneTextBudgets(totalScenes: number) {
  const squeezeFactor = totalScenes >= 6 ? 0.86 : totalScenes === 5 ? 0.93 : 1;
  return {
    visual: Math.max(90, Math.floor(TECHNICAL_SCENE_VISUAL_MAX_CHARS * squeezeFactor)),
    fala: Math.max(120, Math.floor(TECHNICAL_SCENE_FALA_MAX_CHARS * squeezeFactor)),
    direction: Math.max(55, Math.floor(TECHNICAL_SCENE_DIRECTION_MAX_CHARS * squeezeFactor)),
    reason: Math.max(80, Math.floor(TECHNICAL_SCENE_REASON_MAX_CHARS * squeezeFactor)),
  };
}

function compactDirectionBlueprint(value: string, totalScenes: number, fallback = "..."): string {
  const normalized = sanitizeTableCell(value, fallback);
  if (!normalized || normalized === fallback) return fallback;
  const budgets = resolveSceneTextBudgets(totalScenes);

  const parts = normalized.split(/\bPor que assim:\s*/i);
  const direction = clampTextByBoundary(parts[0] || "", budgets.direction, "");
  const strategyReason = compactSceneStrategicReason(parts.slice(1).join(" ").trim(), budgets.reason);

  if (strategyReason) {
    return `${direction || "Tom e execução objetivos."} Por que assim: ${strategyReason}`;
  }
  return direction || fallback;
}

function compactTechnicalRow(row: TechnicalSceneRow, totalScenes: number): TechnicalSceneRow {
  const budgets = resolveSceneTextBudgets(totalScenes);
  return {
    tempo: sanitizeTableCell(row.tempo, "00-03s"),
    visual: clampTextByBoundary(sanitizeTableCell(row.visual, "..."), budgets.visual, "..."),
    fala: clampTextByBoundary(sanitizeTableCell(row.fala, "..."), budgets.fala, "..."),
    direcao: compactDirectionBlueprint(row.direcao, totalScenes, "..."),
  };
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

  if (cols.length >= 5) {
    return {
      tempo: sanitizeTableCell(cols[0] || "", "00-03s"),
      visual: sanitizeTableCell(cols[1] + " " + cols[2] + " " + cols[3] || ""),
      fala: sanitizeTableCell(cols[4] || ""),
      direcao: sanitizeTableCell(cols[5] || ""),
    };
  }

  while (cols.length < 4) cols.push("");
  if (cols.length > 4) {
    cols[3] = cols.slice(3).join(" / ");
  }
  return {
    tempo: sanitizeTableCell(cols[0] || "", "00-03s"),
    visual: sanitizeTableCell(cols[1] || ""),
    fala: sanitizeTableCell(cols[2] || ""),
    direcao: sanitizeTableCell(cols[3] || ""),
  };
}

function parseTechnicalRowFromFlowLines(
  lines: string[],
  tempoFallback: string
): TechnicalSceneRow | null {
  let visual = "";
  let fala = "";
  let direcao = "";

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    let match = trimmed.match(FLOW_VISUAL_REGEX);
    if (match?.[1]) {
      visual = sanitizeTableCell(match[1], visual || "...");
      continue;
    }
    match = trimmed.match(FLOW_FALA_REGEX);
    if (match?.[1]) {
      fala = sanitizeTableCell(match[1], fala || "...");
      fala = fala.replace(/^"+|"+$/g, "").trim() || fala;
      continue;
    }
    match = trimmed.match(FLOW_DIRECAO_REGEX);
    if (match?.[1]) {
      direcao = sanitizeTableCell(match[1], direcao || "...");
      continue;
    }
    match = trimmed.match(FLOW_ENQUADRAMENTO_REGEX) || trimmed.match(FLOW_ACAO_REGEX) || trimmed.match(FLOW_TEXTO_TELA_REGEX);
    if (match?.[1]) {
      visual = visual ? `${visual} ${sanitizeTableCell(match[1], "...")}` : sanitizeTableCell(match[1], "...");
      continue;
    }
    match = trimmed.match(FLOW_PERFORMANCE_REGEX);
    if (match?.[1]) {
      direcao = sanitizeTableCell(match[1], direcao || "...");
    }
  }

  const hasFlowFields = Boolean(visual || fala || direcao);
  if (!hasFlowFields) return null;

  return {
    tempo: sanitizeTableCell(tempoFallback || "00-03s", "00-03s"),
    visual: sanitizeTableCell(visual, "..."),
    fala: sanitizeTableCell(fala, "..."),
    direcao: sanitizeTableCell(direcao, "..."),
  };
}

function isTechnicalScript(content: string): boolean {
  const normalized = (content || "").trim();
  if (!normalized) return false;
  if (
    normalized.includes(TECHNICAL_SCRIPT_START) ||
    normalized.includes(TECHNICAL_SCRIPT_END) ||
    normalized.includes(LEGACY_TECHNICAL_SCRIPT_START) ||
    normalized.includes(LEGACY_TECHNICAL_SCRIPT_END)
  ) {
    return true;
  }
  let hasSceneHeading = false;
  let hasTechnicalStructure = false;
  for (const line of normalized.split("\n")) {
    const trimmed = line.trim();
    if (!hasSceneHeading && TECHNICAL_SCENE_HEADING_REGEX.test(trimmed)) {
      hasSceneHeading = true;
    }
    if (
      !hasTechnicalStructure &&
      (
        TECHNICAL_HEADER_DETECT_REGEX.test(trimmed) ||
        FLOW_VISUAL_REGEX.test(trimmed) ||
        FLOW_FALA_REGEX.test(trimmed) ||
        FLOW_DIRECAO_REGEX.test(trimmed) ||
        FLOW_ENQUADRAMENTO_REGEX.test(trimmed) ||
        FLOW_ACAO_REGEX.test(trimmed) ||
        FLOW_PERFORMANCE_REGEX.test(trimmed) ||
        FLOW_TEXTO_TELA_REGEX.test(trimmed)
      )
    ) {
      hasTechnicalStructure = true;
    }
    if (hasSceneHeading && hasTechnicalStructure) return true;
  }
  return false;
}

function parseTechnicalScenes(content: string): TechnicalSceneBlock[] {
  const normalized = (content || "").replace(/\r/g, "");
  if (!normalized) return [];
  const lines = normalized.split("\n");
  const sceneMarkers: Array<{ lineIndex: number; sceneIndex: number; heading: string; tempoFromHeading: string | null }> = [];
  lines.forEach((line, lineIndex) => {
    const match = line.match(TECHNICAL_SCENE_HEADING_REGEX);
    if (!match?.[1]) return;
    const parsedHeading = splitHeadingLabelAndTempo(match[2] || "");
    sceneMarkers.push({
      lineIndex,
      sceneIndex: Number(match[1]),
      heading: parsedHeading.heading || defaultHeadingForScene(Number(match[1]), 4),
      tempoFromHeading: parsedHeading.tempo,
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
    if (!row) {
      row = parseTechnicalRowFromFlowLines(blockLines, marker.tempoFromHeading || "00-03s");
    }
    parsed.push({
      index: marker.sceneIndex,
      heading: marker.heading,
      row: row || {
        tempo: marker.tempoFromHeading || "00-03s",
        visual: "...",
        fala: "...",
        direcao: "...",
      },
    });
  });

  return parsed.sort((a, b) => a.index - b.index);
}

function buildDefaultTechnicalRow(
  sceneIndex: number,
  totalScenes: number,
  topic: string,
  objective: ReturnType<typeof inferScriptObjective>
): TechnicalSceneRow {
  const safeTopic = sanitizeTableCell(topic, "seu tema principal");
  const isLast = sceneIndex >= totalScenes;
  if (sceneIndex === 1) {
    return {
      tempo: "00-03s",
      visual: `Close no rosto, câmera parada na altura dos olhos e micro-pausa antes da primeira frase. Texto na tela: FOI ISSO QUE DESTRAVOU ${safeTopic.toUpperCase()}.`,
      fala: `Abrir com a virada central de ${safeTopic}: dizer que isso só destravou quando você parou de fazer do jeito óbvio. Frase-exemplo opcional: eu só destravei isso quando parei de insistir no caminho mais automático.`,
      direcao: "Tom de confissão segura, ritmo firme e olhar direto na lente. Por que assim: confissão em close deixa a promessa clara cedo e segura retenção.",
    };
  }
  if (sceneIndex === 2) {
    return {
      tempo: "03-10s",
      visual: `Corte mostrando o atrito do processo no contexto real: pressa, bagunça, tela, rotina ou frustração ligada a ${safeTopic}. Texto na tela: A PARTE QUE TE DERRUBA.`,
      fala: `Nomear o erro ou atrito que derruba ${safeTopic} no dia a dia antes de entregar a dica. Se ajudar, conectar com uma situação concreta que o criador vive ou observa.`,
      direcao: "Tom íntimo e direto, como quem explica uma verdade desconfortável. Por que assim: contexto concreto evita tese solta e aumenta identificação.",
    };
  }
  if (sceneIndex === 3) {
    return {
      tempo: "10-20s",
      visual: `Mostrar o ajuste acontecendo na prática: mão fazendo, tela aberta, ritual montado ou objeto em uso. Texto na tela: O AJUSTE QUE FACILITOU TUDO.`,
      fala: `Explicar o ajuste, critério ou ritual que deixa ${safeTopic} mais simples de repetir. Se quiser, incluir uma frase-exemplo curta mostrando antes e depois.`,
      direcao: "Cadência natural, didática e sem cara de aula. Por que assim: ajuste visível passa mais utilidade que opinião solta.",
    };
  }
  if (!isLast && sceneIndex === 4) {
    return {
      tempo: totalScenes >= 6 ? "20-28s" : "20-30s",
      visual: `Mostrar prova visível: rotina mais leve, resultado no processo, sensação de alívio ou consequência concreta. Texto na tela: QUANDO VIROU RITUAL.`,
      fala: `Fechar a prova da cena anterior: mostrar o que mudou quando o ajuste virou hábito, critério ou rotina.`,
      direcao: "Tom de realização, mais calmo e convincente. Por que assim: prova concreta segura melhor a retenção que repetir a dica.",
    };
  }
  if (!isLast && sceneIndex === 5) {
    return {
      tempo: "28-36s",
      visual: `Retorno para o rosto com pausa curta antes da conclusão. Texto na tela: O MOTIVO REAL.`,
      fala: `Amarrar o motivo humano por trás do ajuste: mostrar por que isso funcionou melhor do que depender de motivação ou improviso.`,
      direcao: "Tom conclusivo, contato visual forte e pausa curta na virada. Por que assim: virada humana aumenta identificação e memorabilidade.",
    };
  }
  const ctaTempo = totalScenes <= 4 ? "20-30s" : totalScenes === 5 ? "30-38s" : "36-45s";
  if (objective === "converter") {
    return {
      tempo: ctaTempo,
      visual: `Texto na tela: COMENTA "QUERO". Gesto apontando para os comentários como continuação natural da conversa.`,
      fala: `Se quiser, eu continuo essa lógica no seu caso. Comenta "quero" aqui embaixo que eu trago a próxima parte.`,
      direcao: "Amigável, sorriso curto e sensação de conversa em andamento. Por que assim: CTA de continuidade converte melhor quando parece continuação da pauta.",
    };
  }
  return {
    tempo: ctaTempo,
    visual: `Texto na tela: E VOCÊ?. Gesto leve com a mão, encerrando sem parecer anúncio.`,
    fala: `E você, qual foi o ajuste que mais te ajudou com ${safeTopic}? Me conta aqui embaixo.`,
    direcao: "Tom conversacional, curioso e com sorriso leve no final. Por que assim: pergunta específica gera comentário melhor que CTA genérico.",
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
  if (GENERIC_SCRIPT_CLICHE_REGEX.test(cleaned)) return fallback;
  const wordCount = cleaned.split(/\s+/).filter(Boolean).length;
  if (wordCount < 4) return fallback;
  if (wordCount < 6) {
    const hasNaturalSignal =
      /[!?]/.test(cleaned) ||
      /(eu|voc[eê]|voce|quando|porque|mas|parece|foi|s[oó]|nem)/i.test(cleaned);
    if (!hasNaturalSignal) return fallback;
  }
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

  // Punchy hook
  if (words >= 4 && words <= 18) score += 0.25;
  else if (words > 18 && words <= 26) score += 0.1;
  // Personal connection
  if (/(voc[eê]|voce|seu|sua|te|se voc[eê]|se voce)/i.test(speech)) score += 0.2;
  if (/\b(eu|pra mim|comigo|s[oó] consegui|confesso|parece loucura|na verdade|foi quando)\b/i.test(speech)) score += 0.1;
  if (/\b(abrir com|nomear o erro|virada central|come[çc]ar pelo atrito|gancho)\b/i.test(speech)) score += 0.12;
  if (words <= 8 && /(voc[eê]|voce)/i.test(speech) && /\b(n[aã]o|travado|errando|perdendo|confundindo)\b/i.test(speech)) {
    score += 0.12;
  }
  // Urgency / Actionable
  if (/\b(hoje|agora|pare|n[aã]o fa[cç]a|imediata)\b/i.test(speech)) score += 0.2;
  // Curiosity & Agitation
  if (/\b(erro|segredo|motivo|verdade|descubra|sabia que|por que|cai|destrava|resultado|ganha)\b/i.test(speech)) score += 0.25;
  // Visual anchor
  if (hasMeaningfulOverlay(row.visual)) score += 0.1;
  if (GENERIC_SCRIPT_CLICHE_REGEX.test(speech)) score -= 0.22;
  return roundScore(score);
}

function scoreSceneSpecificity(row: TechnicalSceneRow): number {
  let score = 0;
  const visual = sanitizeTableCell(row.visual, "").toLowerCase();
  const fala = sanitizeTableCell(row.fala, "").toLowerCase();

  // Strong visual directives
  if (/\b(close|corte|mostra|aponta|transi[cç][aã]o|b-roll|broll|zoom|texto|texto na tela|aparece|fundo)\b/.test(visual)) score += 0.3;
  // Adequate visual description
  if (visual.length >= 15) score += 0.2;
  if (hasMeaningfulOverlay(row.visual)) score += 0.25;
  // Storytelling / demonstration in copy
  if (countWords(fala) >= 8 && /\b(exemplo|olha|veja|isso|assim|na pr[aá]tica|passo|como)\b/i.test(fala)) score += 0.25;
  return roundScore(score);
}

function scoreUtilityScene(row: TechnicalSceneRow): number {
  const speech = sanitizeTableCell(row.fala, "");
  if (!speech) return 0;

  let score = 0;
  const words = countWords(speech);

  if (PRACTICAL_MARKER_REGEX.test(speech)) score += 0.38;
  if (/\b(quando|se|antes de|depois de|ent[aã]o eu|por isso|assim|na pr[aá]tica)\b/i.test(speech)) score += 0.2;
  if (/\b(1|2|3|um|uma|dois|duas|primeiro|segundo)\b/i.test(speech)) score += 0.08;
  if (words >= 8 && /\b(erro|ajuste|passo|troca|ritual|crit[eé]rio|sinal|processo)\b/i.test(speech)) score += 0.22;
  if (/\b(eu parei de|eu comecei a|o que mudou foi|o que eu faço [ée]|eu troquei)\b/i.test(speech)) score += 0.16;
  if (ABSTRACT_CLAIM_REGEX.test(speech) && !PRACTICAL_MARKER_REGEX.test(speech)) score -= 0.18;

  return roundScore(score);
}

function scoreShootability(row: TechnicalSceneRow): number {
  const visual = sanitizeTableCell(row.visual, "");
  const direction = sanitizeTableCell(row.direcao, "");
  if (!visual && !direction) return 0;

  let score = 0;
  if (PRACTICAL_SHOOT_MARKER_REGEX.test(visual)) score += 0.34;
  if (/\b(mostra|aponta|abre|retorna|ajeita|segura|entra|sai|corta|mostrando)\b/i.test(visual)) score += 0.2;
  if (visual.length >= 24) score += 0.16;
  if (hasMeaningfulOverlay(row.visual)) score += 0.08;
  if (/\b(tom|ritmo|cad[êe]ncia|pausa|olhar|gesto|postura|energia|sorriso)\b/i.test(direction)) score += 0.14;
  if (/\b(curto|leve|firme|calmo|direto|conversacional|did[aá]tico|confiante)\b/i.test(direction)) score += 0.08;
  if (direction.length >= 18) score += 0.08;
  if (visual.length < 18 && !PRACTICAL_SHOOT_MARKER_REGEX.test(visual)) score -= 0.12;

  return roundScore(score);
}

function scoreStrategicReasoning(row: TechnicalSceneRow): number {
  const direction = sanitizeTableCell(row.direcao, "");
  if (!direction) return 0;

  let score = 0;
  if (/\b(por que assim|porque assim)\b/i.test(direction)) score += 0.38;
  if (STRATEGIC_REASON_REGEX.test(direction)) score += 0.24;
  if (/\b(gancho|categoria|narrativa|formato|tom|perfil|engajamento|lift)\b/i.test(direction)) score += 0.14;
  if (/\b(hor[aá]rio|janela|publica[cç][aã]o)\b/i.test(direction)) score += 0.08;
  if (/\b(\d+\s+roteiro|\d+\s+legenda|lift\s+\d|proposal\s+[a-z_]+|context\s+[a-z_]+|tone\s+[a-z_]+)\b/i.test(direction)) {
    score += 0.12;
  }
  if (direction.length >= 48) score += 0.16;

  return roundScore(score);
}

function scoreSpeakability(row: TechnicalSceneRow): number {
  const speech = sanitizeTableCell(row.fala, "");
  if (!speech) return 0;
  if (INSTRUCTIONAL_LITERAL_REGEX.test(speech)) return 0;
  if (GENERIC_SCRIPT_CLICHE_REGEX.test(speech)) return 0.18;

  let score = 0;
  const words = countWords(speech);
  // Sweet spot for a fast-paced vertical video scene
  if (words >= 6 && words <= 28) score += 0.4;
  else if (words > 28 && words <= 42) score += 0.2;

  if (BLUEPRINT_SPEECH_REGEX.test(speech)) score += 0.22;
  if (/\b(frase[- ]?exemplo|exemplo opcional|cta sugerido)\b/i.test(speech)) score += 0.12;

  // Conversational markers
  if (/\b(gente|galera|voc[eê]|eu|olha|ent[aã]o|mas a[ií])\b/i.test(speech)) score += 0.3;

  // Natural flow or consequence
  if (/\b(sempre|nunca|melhor|pior|isso|aquilo|na verdade)\b/i.test(speech)) score += 0.15;

  // Short punchy sentences check (has commas or periods breaking it up if it's long)
  if (words > 15 && /[.?!,]\s/.test(speech)) score += 0.15;

  return roundScore(score);
}

function scoreCtaStrength(lastScene?: TechnicalSceneRow): number {
  if (!lastScene) return 0;
  let score = 0;
  const speech = sanitizeTableCell(lastScene.fala, "");
  const overlay = sanitizeTableCell(lastScene.visual, "");
  const wordCount = countWords(speech);
  if (CTA_LITERAL_REGEX.test(speech)) score += 0.65;
  if (/\b(comenta|salva|compartilha|direct|dm|link|segue)\b/i.test(speech)) score += 0.2;
  if (/\b(e voc[eê]|qual foi|me conta|me diz|qual tem sido|como voc[eê])\b/i.test(speech) || speech.includes("?")) score += 0.2;
  if (/\b(agora|hoje|neste|nesse)\b/i.test(speech)) score += 0.05;
  if (/\b(comente|salve|compartilhe|cta|link|direct|dm)\b/i.test(overlay)) score += 0.1;
  if (wordCount <= 4) score -= 0.25;
  if (/^(comente|salve|compartilhe|segue)\b/i.test(speech.trim())) score -= 0.15;
  if (/^(comente aqui agora|salve isso|compartilhe isso)\b/i.test(speech.trim().toLowerCase())) score -= 0.2;
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

function scoreConcision(scenes: TechnicalSceneBlock[]): number {
  if (!scenes.length) return 0;

  const totalScenes = scenes.length;
  const budgets = resolveSceneTextBudgets(totalScenes);
  const serializedLength = [TECHNICAL_SCRIPT_START, ...scenes.map((scene) => serializeSceneBlock(scene, totalScenes)), TECHNICAL_SCRIPT_END]
    .join("\n\n")
    .trim().length;
  const idealScriptLength = totalScenes <= 4 ? 2100 : totalScenes === 5 ? 2500 : 2850;
  const softMaxLength = Math.min(TECHNICAL_SCRIPT_MAX_CHARS, totalScenes <= 4 ? 2700 : totalScenes === 5 ? 3000 : 3200);

  let score = 1;
  if (serializedLength > idealScriptLength) {
    const overflowRatio = (serializedLength - idealScriptLength) / Math.max(softMaxLength - idealScriptLength, 1);
    score -= Math.min(0.46, overflowRatio * 0.46);
  }
  if (serializedLength >= softMaxLength) {
    score -= 0.14;
  }

  let overflowPenalty = 0;
  for (const scene of scenes) {
    const compacted = compactTechnicalRow(scene.row, totalScenes);
    overflowPenalty += Math.max(0, sanitizeTableCell(compacted.visual, "").length - budgets.visual) / Math.max(budgets.visual, 1);
    overflowPenalty += Math.max(0, sanitizeTableCell(compacted.fala, "").length - budgets.fala) / Math.max(budgets.fala, 1);
    const directionParts = sanitizeTableCell(compacted.direcao, "").split(/\bPor que assim:\s*/i);
    overflowPenalty += Math.max(0, (directionParts[0] || "").trim().length - budgets.direction) / Math.max(budgets.direction, 1);
    overflowPenalty += Math.max(0, directionParts.slice(1).join(" ").trim().length - budgets.reason) / Math.max(budgets.reason, 1);
  }

  score -= Math.min(0.24, overflowPenalty * 0.08);
  if (serializedLength <= idealScriptLength * 0.72) {
    score -= 0.06;
  }

  return roundScore(clamp01(score));
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
      shootabilityScore: 0,
      strategyScore: 0,
      ctaStrength: 0,
      diversityScore: 0,
      utilityScore: 0,
      concisionScore: 0,
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
  const shootabilityScore = roundScore(
    scenes.reduce((sum, scene) => sum + scoreShootability(scene.row), 0) / scenes.length
  );
  const strategyScore = roundScore(
    scenes.reduce((sum, scene) => sum + scoreStrategicReasoning(scene.row), 0) / scenes.length
  );
  const ctaStrength = scoreCtaStrength(scenes[scenes.length - 1]?.row);
  const diversityScore = scoreDiversity(scenes);
  const concisionScore = scoreConcision(scenes);
  const utilityScenes = scenes.slice(1, Math.max(2, scenes.length - 1));
  const utilityScore = roundScore(
    (utilityScenes.length ? utilityScenes : scenes).reduce((sum, scene) => sum + scoreUtilityScene(scene.row), 0) /
      (utilityScenes.length ? utilityScenes.length : scenes.length)
  );
  const perceivedQuality = roundScore(
    hookStrength * 0.18 +
    specificityScore * 0.16 +
    speakabilityScore * 0.1 +
    shootabilityScore * 0.14 +
    strategyScore * 0.12 +
    ctaStrength * 0.14 +
    utilityScore * 0.16 +
    diversityScore * 0.04 +
    concisionScore * 0.06
  );
  return {
    perceivedQuality,
    hookStrength,
    specificityScore,
    speakabilityScore,
    shootabilityScore,
    strategyScore,
    ctaStrength,
    diversityScore,
    utilityScore,
    concisionScore,
    sceneCount: scenes.length,
  };
}

function shouldRunQualityPass(score: TechnicalScriptQualityScore): boolean {
  return (
    score.sceneCount < 4 ||
    score.perceivedQuality < QUALITY_PASS_MIN_SCORE ||
    score.hookStrength < 0.62 ||
    score.specificityScore < 0.62 ||
    (score.speakabilityScore < 0.55 && score.shootabilityScore < 0.62) ||
    score.strategyScore < 0.45 ||
    score.ctaStrength < 0.8 ||
    score.utilityScore < 0.55 ||
    score.concisionScore < 0.62
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
    const fallbackRow = buildDefaultTechnicalRow(sceneIndex, total, topic, objective);
    const isLast = idx === total - 1;
    const nextRow: TechnicalSceneRow = {
      tempo: sanitizeTableCell(scene.row.tempo, fallbackRow.tempo),
      visual: sanitizeTableCell(scene.row.visual, fallbackRow.visual),
      fala: ensureLiteralSpeech(scene.row.fala, fallbackRow.fala),
      direcao: isActionableDirection(scene.row.direcao)
        ? sanitizeTableCell(scene.row.direcao, fallbackRow.direcao)
        : fallbackRow.direcao,
    };

    if (sanitizeTableCell(nextRow.visual, "").length < 20) {
      nextRow.visual = fallbackRow.visual;
    }
    if (scoreSceneSpecificity(nextRow) < 0.55) {
      nextRow.visual = fallbackRow.visual;
    }
    if (scoreShootability(nextRow) < 0.55) {
      nextRow.visual = fallbackRow.visual;
      nextRow.direcao = fallbackRow.direcao;
    }
    if (sceneIndex === 1 && scoreHookStrength(nextRow) < 0.6) {
      nextRow.fala = fallbackRow.fala;
      nextRow.visual = fallbackRow.visual;
    }
    if (!isLast) {
      if (CTA_LITERAL_REGEX.test(nextRow.fala)) {
        nextRow.fala = fallbackRow.fala;
      }
      if (CTA_OVERLAY_REGEX.test(nextRow.visual)) {
        nextRow.visual = fallbackRow.visual;
      }
    }
    if (isLast) {
      nextRow.fala = ensureCtaSpeech(nextRow.fala, fallbackRow.fala);
      nextRow.visual = CTA_OVERLAY_REGEX.test(nextRow.visual)
        ? nextRow.visual
        : fallbackRow.visual;
    }
    const compactedRow = compactTechnicalRow(nextRow, total);
    return {
      index: sceneIndex,
      heading: normalizeSceneHeadingLabel(scene.heading, sceneIndex, total),
      row: compactedRow,
    };
  });
}

export function evaluateTechnicalScriptQuality(content: string, userPrompt = ""): TechnicalScriptQualityScore {
  const parsed = parseTechnicalScenes(content || "");
  const scenes = parsed.length ? parsed : buildTechnicalScenesFromLegacyContent(content || "", userPrompt || "roteiro");
  return evaluateTechnicalScriptQualityFromScenes(scenes);
}

function formatSceneHeadingForDisplay(heading: string): string {
  const normalized = sanitizeSceneHeadingLabel(heading);
  if (!normalized) return "CENA";
  if (CTA_HEADING_REGEX.test(normalized)) return "CHAMADA PARA AÇÃO";
  if (normalized === "GANCHO") return "O GANCHO";
  if (normalized === "PROVA") return "A PROVA";
  return normalized;
}

function formatTempoForHeading(tempoRaw: string): string {
  const tempo = sanitizeTableCell(tempoRaw, "00-03s");
  const compact = tempo.replace(/\s+/g, "");
  const mmssMatch = compact.match(/^(\d{1,2}):?(\d{2})-(\d{1,2}):?(\d{2})$/);
  if (mmssMatch?.[1] && mmssMatch[2] && mmssMatch[3] && mmssMatch[4]) {
    const fromMin = String(Number(mmssMatch[1]));
    const fromSec = mmssMatch[2];
    const toMin = String(Number(mmssMatch[3]));
    const toSec = mmssMatch[4];
    return `${fromMin}:${fromSec} - ${toMin}:${toSec}`;
  }
  const ssMatch = compact.match(/^(\d{2})-(\d{2})s$/i);
  if (ssMatch?.[1] && ssMatch[2]) {
    return `0:${ssMatch[1]} - 0:${ssMatch[2]}`;
  }
  return tempo;
}

function serializeSceneBlock(scene: TechnicalSceneBlock, totalScenes: number): string {
  const heading = normalizeSceneHeadingLabel(scene.heading, scene.index, totalScenes);
  const row = compactTechnicalRow(scene.row, totalScenes);
  const headingLabel = formatSceneHeadingForDisplay(heading);
  const tempo = formatTempoForHeading(row.tempo);
  const visual = sanitizeTableCell(row.visual, "...");
  const fala = sanitizeTableCell(row.fala, "...").replace(/^"+|"+$/g, "");
  const direcao = sanitizeTableCell(row.direcao, "...");
  return [
    `CENA ${scene.index}: ${headingLabel} (${tempo})`,
    `Visual: ${visual}`,
    ``,
    `Fala: "${fala}"`,
    ``,
    `Direção: ${direcao}`,
  ].join("\n");
}

function serializeTechnicalScript(
  scenes: TechnicalSceneBlock[],
  editorialBrief?: TechnicalEditorialBrief | null
): string {
  const sortedScenes = scenes.sort((a, b) => a.index - b.index);
  const totalScenes = sortedScenes.length;
  const blocks = sortedScenes.map((scene) => serializeSceneBlock(scene, totalScenes));
  const editorialBlock = serializeTechnicalEditorialBrief(editorialBrief);
  const serialized = [TECHNICAL_SCRIPT_START, editorialBlock, ...blocks, TECHNICAL_SCRIPT_END]
    .filter(Boolean)
    .join("\n\n")
    .trim();
  if (serialized.length <= TECHNICAL_SCRIPT_MAX_CHARS) return serialized;

  const reservedChars =
    TECHNICAL_SCRIPT_START.length + TECHNICAL_SCRIPT_END.length + editorialBlock.length + 8;
  const bodyBudget = Math.max(400, TECHNICAL_SCRIPT_MAX_CHARS - reservedChars);
  const compactBody = clampTextByBoundary(blocks.join("\n\n"), bodyBudget, "").trim();

  return [TECHNICAL_SCRIPT_START, editorialBlock, compactBody, TECHNICAL_SCRIPT_END]
    .filter(Boolean)
    .join("\n\n")
    .trim();
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
    heading: defaultHeadingForScene(sceneIndex, 4),
    row: buildDefaultTechnicalRow(sceneIndex, 4, topic, objective),
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
  return serializeTechnicalScript(
    buildTechnicalScenesFromLegacyContent(normalized, fallbackPrompt),
    resolveTechnicalEditorialBrief({ rawContent: normalized, fallbackPrompt })
  );
}

function fallbackGenerate(prompt: string): ScriptDraft {
  const normalized = prompt.trim();
  const title = resolveEditorialAnchorTitle({ prompt: normalized });
  const content = convertLegacyScriptToTechnical("", `${title}\n${normalized || "reels de 30s"}`);
  return { title, content };
}

function fallbackAdjust(input: AdjustInput): ScriptDraft {
  return {
    title: clampText(input.title, "Roteiro técnico ajustado", 80),
    content: convertLegacyScriptToTechnical(input.content, input.prompt),
  };
}

function fallbackAdjustScoped(
  segmentText: string,
  prompt: string,
  target?: ScriptAdjustTarget
): string {
  const normalizedSegment = String(segmentText || "").trim();
  if (!normalizedSegment) return convertLegacyScriptToTechnical("", prompt);
  if (isTechnicalScript(normalizedSegment)) return normalizedSegment;
  if (target?.type === "editorial") return normalizedSegment;
  if (target?.type === "paragraph" || target?.type === "first_paragraph" || target?.type === "last_paragraph") {
    return normalizedSegment;
  }
  return convertLegacyScriptToTechnical(normalizedSegment, prompt);
}

export function buildGenerateScriptPrompt(input: GenerateInput): string {
  const userPrompt = input.prompt.trim();
  const editorialAnchorTitle = resolveEditorialAnchorTitle(input);
  const densityProfile = resolveBlueprintDensityProfile(userPrompt);
  const intelligenceBlock =
    input.intelligenceContext && input.intelligenceContext.resolvedCategories
      ? buildIntelligencePromptBlock(input.intelligenceContext)
      : "";
  const parsedPrompt = parsePromptForScriptIntelligence(userPrompt);
  const intent = input.intelligenceContext?.intent ?? parsedPrompt.intent;
  const subjectHint = intent?.subjectHint?.trim() || "";
  const winnerBasedGuidance = intent?.wantsWinnerBasedScript
    ? `Instrução de alinhamento com perfil:\n` +
      `- Use como espinha dorsal o que já mais performa no perfil do criador.\n` +
      `- Priorize padrões vencedores de abertura, cadência, vulnerabilidade, desenvolvimento e CTA observados no histórico.\n` +
      `- Se houver conflito entre uma ideia nova e o repertório vencedor do criador, prefira o repertório vencedor.\n\n`
    : "";
  const topicGuidance = subjectHint
    ? `Instrução de assunto central:\n` +
      `- O tema principal deste roteiro é: ${subjectHint}\n` +
      `- Não trate o assunto de forma genérica; deixe o tema explícito já nas primeiras cenas e mantenha coerência até o final.\n` +
      `- Sempre que possível, conecte o assunto a uma experiência, hábito, dor ou situação concreta.\n\n`
    : "";
  const practicalValueBlock = buildPracticalValueBlock(userPrompt);

  return (
    `Crie um blueprint técnico profissional em português do Brasil para creator.\n` +
    `Pedido do usuário: ${userPrompt}\n` +
    `Título âncora do roteiro: ${editorialAnchorTitle}\n` +
    `${input.title?.trim() ? `Esse título já veio salvo pelo usuário e deve orientar o blueprint sem ser contradito.\n` : ""}` +
    `Use esse título como bússola editorial: o gancho abre a promessa do título, o meio desenvolve a promessa e o fechamento conclui a promessa.\n` +
    `Se uma cena fugir do título, reescreva a cena.\n` +
    `Antes de descrever as cenas, faça silenciosamente esta ordem mental: 1) decida qual vídeo faz mais sentido postar agora; 2) defina o ângulo e a estrutura; 3) só então descreva como gravar.\n` +
    `Essa decisão deve considerar pedido do usuário, título âncora, categorias vencedoras, repertório vencedor do perfil, linguagem das legendas fortes e timing quando houver sinal.\n` +
    `Densidade do blueprint: ${densityProfile.promptGuidance}\n` +
    `${intelligenceBlock}\n\n` +
    `${winnerBasedGuidance}` +
    `${topicGuidance}` +
    `${practicalValueBlock}` +
    `Qualidade narrativa obrigatória:\n` +
    `${SCRIPT_NARRATIVE_QUALITY_RULES}\n\n` +
    `Preferência de progressão por cena:\n` +
    `- Cena 1: gancho forte com confissão, contraste, opinião ou observação impossível de ignorar\n` +
    `- Cena 2: dor, frustração, tensão ou contexto real que sustenta o tema\n` +
    `- Cena 3: virada prática, ritual, ajuste concreto, critério ou demonstração viva\n` +
    `- Cena 4 em diante: prova, motivo humano, consequência ou aprofundamento antes do CTA\n` +
    `- Última cena: CTA natural, conversacional e específico\n\n` +
    `Regras obrigatórias:\n` +
    `- Retornar APENAS JSON válido com os campos title e content\n` +
    `- Entregar um plano prático de gravação, não um monólogo final perfeito\n` +
    `- O criador precisa bater o olho e entender como vai gravar o vídeo de ponta a ponta\n` +
    `- O blueprint também precisa explicar por que esse vídeo deve ser gravado desse jeito com base no que mais gera resultado no perfil\n` +
    `- Antes das cenas, inclua 4 linhas curtas de direção editorial: O que postar / Por que postar assim / Quando postar / Como esse vídeo deve funcionar\n` +
    `- "Por que postar assim" deve citar pelo menos 1 evidência concreta do perfil: combinação de categorias, quantidade de roteiros/legendas fortes, lift ou timing observado\n` +
    `- Cada uma dessas 4 linhas deve caber em 1 frase curta e densa\n` +
    `- content deve seguir EXATAMENTE o formato técnico abaixo:\n` +
    `${TECHNICAL_SCRIPT_START}\n` +
    `O que postar: Resumo curto do vídeo que faz mais sentido publicar agora.\n` +
    `Por que postar assim: 1 frase curta com evidência concreta do perfil, como categoria vencedora, lift, volume de exemplos ou timing.\n` +
    `Quando postar: Janela observada do perfil em 1 frase curta; sem sinal, diga só para manter consistência.\n` +
    `Como esse vídeo deve funcionar: Estrutura editorial em 1 linha (ex.: erro visível -> contexto real -> ajuste -> pergunta final).\n\n` +
    `CENA 1: O GANCHO (0:00 - 0:06)\n` +
    `Visual: Close no rosto, câmera parada e texto na tela reforçando a virada principal.\n\n` +
    `Fala: Abrir nomeando o erro, virada ou tensão central. Frase-exemplo opcional curta se ajudar.\n\n` +
    `Direção: Tom, ritmo, gesto e execução. Por que assim: justificativa curta baseada em engajamento, categoria, narrativa ou timing quando houver sinal.\n\n` +
    `CENA 2: CONTEXTO (0:07 - 0:15)\n` +
    `Visual: Mostrar a situação real, atrito, cenário ou prova cotidiana.\n\n` +
    `Fala: Explicar o que precisa ficar claro nessa cena e qual erro ou dor precisa aparecer.\n\n` +
    `Direção: Tom, ritmo, gesto e execução. Por que assim: justificativa curta baseada em engajamento, categoria, narrativa ou timing quando houver sinal.\n\n` +
    `CENA 3: DEMONSTRAÇÃO (0:16 - 0:25)\n` +
    `Visual: Mostrar o ajuste acontecendo na prática com objeto, tela, gesto ou rotina.\n\n` +
    `Fala: Explicar o ajuste, passo, critério ou ritual. Pode incluir uma frase-exemplo curta.\n\n` +
    `Direção: Tom, ritmo, gesto e execução. Por que assim: justificativa curta baseada em engajamento, categoria, narrativa ou timing quando houver sinal.\n\n` +
    `CENA 4: CHAMADA PARA AÇÃO (0:26 - 0:35)\n` +
    `Visual: Fechamento simples com gesto, texto na tela e continuidade da conversa.\n\n` +
    `Fala: Sugerir como fechar e qual CTA natural usar, sem soar burocrático.\n\n` +
    `Direção: Tom, ritmo, gesto e execução. Por que assim: justificativa curta baseada em engajamento, categoria, narrativa ou timing quando houver sinal.\n` +
    `${TECHNICAL_SCRIPT_END}\n` +
    `- Cada cena deve conter obrigatoriamente os campos: Visual, Fala e Direção\n` +
    `- Prefira ${densityProfile.preferredSceneCount} cenas neste pedido\n` +
    `- Nunca ultrapasse ${densityProfile.maxSceneCount} cenas neste pedido\n` +
    `- Mínimo 4 e máximo 6 cenas\n` +
    `- Resposta compacta: priorize clareza e filmabilidade, sem texto sobrando\n` +
    `- Visual idealmente até ${TECHNICAL_SCENE_VISUAL_MAX_CHARS} caracteres\n` +
    `- Fala idealmente até ${TECHNICAL_SCENE_FALA_MAX_CHARS} caracteres\n` +
    `- Na Direção, a parte de execução deve ser curta e o "Por que assim:" também curto e objetivo\n` +
    `- O "Por que assim:" de cada cena deve usar só 1 motivo curto e não repetir o preâmbulo editorial inteiro\n` +
    `- O blueprint completo deve caber idealmente em até ${TECHNICAL_SCRIPT_MAX_CHARS} caracteres\n` +
    `- Somente a ÚLTIMA cena pode ter heading CTA\n` +
    `- Se tiver 5 cenas: Cena 4 é PROVA e Cena 5 é CHAMADA PARA AÇÃO\n` +
    `- Se tiver 6 cenas: Cena 4 é PROVA, Cena 5 é VIRADA e Cena 6 é CHAMADA PARA AÇÃO\n` +
    `- Visual: descrever como gravar de forma prática, com enquadramento, ação, cenário, objeto, apoio visual ou transição quando fizer sentido\n` +
    `- Fala: descrever o que precisa ser comunicado em cada cena; use no máximo uma frase-exemplo curta quando realmente ajudar\n` +
    `- O roteiro precisa entregar utilidade real: diagnóstico + ajuste + prova/situação observável\n` +
    `- Direção: orientação objetiva de tom/ritmo/entonação/gesto e execução da captação\n` +
    `- Em TODAS as cenas, a Direção deve incluir "Por que assim:" justificando a escolha com base em categorias, narrativa vencedora, tom, formato, lift, volume de exemplos ou horário/janela quando houver sinal real\n` +
    `- Se não houver dado de horário, justifique sem inventar timing\n` +
    `- Última cena obrigatoriamente com CTA claro ou CTA sugerido muito nítido\n` +
    `- Imitar o estilo do criador sem copiar frases literalmente\n` +
    `- Linguagem natural, de creator para humano\n` +
    `- Não citar outros criadores, marcas ou perfis sem pedido explícito\n` +
    `- Não incluir @menções ou hashtags, exceto se o usuário pedir explicitamente`
  );
}

export function extractAdjustIntentGuidance(userPrompt: string): string {
  const normalized = userPrompt.trim();
  if (!normalized) return "";

  const moreMatch = normalized.match(/(?:pra|para)?\s*ser\s+mais\s+(.{3,80})/i) || normalized.match(/\bmais\s+(.{3,80})/i);
  const requestedAttribute = moreMatch?.[1]
    ?.replace(/[.,;:!?]+$/g, "")
    .trim();

  if (!requestedAttribute) {
    return (
      `- Se o pedido parecer amplo, preserve a espinha dorsal do roteiro e ajuste apenas o atributo solicitado pelo usuário\n` +
      `- Evite reescrever tudo do zero quando o comando for incremental\n`
    );
  }

  return (
    `- O atributo principal pedido pelo usuário é: ${requestedAttribute}\n` +
    `- Intensifique esse atributo sem descaracterizar o restante do roteiro\n` +
    `- Preserve gancho, lógica e progressão sempre que isso não entrar em conflito com o pedido\n`
  );
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

  const captionExamples = uniqueCompactValues(
    context.captionEvidence.slice(0, 4).map((item) => item.caption),
    2,
    150
  )
    .map((item, index) => `${index + 1}) ${item}`)
    .join("\n");

  const evidenceBlock = captionExamples
    ? `Exemplos reais de linguagem do criador (resumo):\n${captionExamples}`
    : "Sem exemplos suficientes de legenda. Use regras base do roteirista.";

  const styleGuidelines =
    context.styleProfile?.writingGuidelines?.length
      ? context.styleProfile.writingGuidelines.slice(0, 4).map((line) => `- ${line}`).join("\n")
      : "- Sem sinais suficientes de estilo por roteiros salvos.";

  const styleExamples =
    context.styleProfile?.styleExamples?.length
      ? uniqueCompactValues(context.styleProfile.styleExamples, 2, 120)
        .map((item, index) => `${index + 1}) ${item}`)
        .join("\n")
      : "";

  const hookExamples = uniqueCompactValues(
    [
      ...(context.linkedOutcome?.topExamples?.map((item) => item.hookSample || "") || []),
      ...(context.styleProfile?.styleSignalsUsed.hookPatterns || []),
      ...(context.dnaProfile.openingPatterns || []),
    ],
    3,
    90
  );

  const ctaExamples = uniqueCompactValues(
    [
      ...(context.linkedOutcome?.topExamples?.map((item) => item.ctaSample || "") || []),
      ...(context.styleProfile?.styleSignalsUsed.ctaPatterns || []),
      ...(context.dnaProfile.ctaPatterns || []),
    ],
    3,
    90
  );

  const practicalEvidenceLines = uniqueCompactValues(
    [
      ...(context.linkedOutcome?.topExamples?.map((item) => item.caption || "") || []),
      ...context.captionEvidence.map((item) => item.caption || ""),
    ],
    2,
    130
  )
    .map((item, index) => `${index + 1}) ${item}`)
    .join("\n");

  const winningScriptExamplesBlock = (context.winningScriptExamples || []).length
    ? (context.winningScriptExamples || [])
        .slice(0, 2)
        .map((item, index) => {
          const opening = item.opening ? `Gancho: ${item.opening}` : "";
          const development = item.development ? `Movimento útil: ${item.development}` : "";
          const cta = item.cta ? `Fechamento: ${item.cta}` : "";
          const parts = [opening, development, cta].filter(Boolean).join(" | ");
          return `${index + 1}) ${item.title} | lift ${item.lift.toFixed(2)}${parts ? ` | ${parts}` : ""}`;
        })
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

  const linkedOutcomeLines = context.linkedOutcome?.topExamples?.length
    ? context.linkedOutcome.topExamples
        .slice(0, 2)
        .map((item, index) => {
          const hook = item.hookSample ? ` | Gancho: ${item.hookSample}` : "";
          const cta = item.ctaSample ? ` | CTA: ${item.ctaSample}` : "";
          return `${index + 1}) Lift ${item.lift.toFixed(2)} | ${item.caption.slice(0, 150)}${hook}${cta}`;
        })
        .join("\n")
    : "";

  const linkedWinnersByDimension = context.linkedOutcome?.topByDimension
    ? [
        context.linkedOutcome.topByDimension.proposal?.[0]
          ? `- proposal vencedora: ${context.linkedOutcome.topByDimension.proposal[0].id}`
          : null,
        context.linkedOutcome.topByDimension.context?.[0]
          ? `- context vencedor: ${context.linkedOutcome.topByDimension.context[0].id}`
          : null,
        context.linkedOutcome.topByDimension.format?.[0]
          ? `- format vencedor: ${context.linkedOutcome.topByDimension.format[0].id}`
          : null,
        context.linkedOutcome.topByDimension.tone?.[0]
          ? `- tone vencedor: ${context.linkedOutcome.topByDimension.tone[0].id}`
          : null,
        context.linkedOutcome.topByDimension.references?.[0]
          ? `- references vencedora: ${context.linkedOutcome.topByDimension.references[0].id}`
          : null,
      ]
        .filter(Boolean)
        .join("\n")
    : "";

  const linkedOutcomeBlock =
    context.linkedOutcome?.enabled && context.linkedOutcome.sampleSizeLinked > 0
      ? `\nSinais de roteiros vinculados vencedores:\n` +
        `- Amostra vinculada: ${context.linkedOutcome.sampleSizeLinked}\n` +
        `- Confiança: ${context.linkedOutcome.confidence}\n` +
        `${linkedWinnersByDimension || "- Sem dimensão líder clara."}\n` +
        `${linkedOutcomeLines ? `- Padrões de alto lift:\n${linkedOutcomeLines}\n` : ""}` +
        `- Priorize padrões com lift alto sem copiar textos literalmente.`
      : "";
  const timingBlock = context.engagementTiming
    ? `\nJanela de publicação observada nos conteúdos fortes:\n` +
      `- Base temporal: ${context.engagementTiming.sampleSize} posts com data\n` +
      `- Timezone de leitura: ${context.engagementTiming.timezone}\n` +
      `- ${context.engagementTiming.summary}\n` +
      `- Use isso como justificativa de publicação somente quando ajudar; não invente horário se o sinal não existir.`
    : "";

  const creatorPlaybookBlock = [
    hookExamples.length ? `- Ganchos que costumam soar naturais aqui: ${hookExamples.join(" | ")}` : null,
    ctaExamples.length ? `- CTAs/fechamentos que soam naturais aqui: ${ctaExamples.join(" | ")}` : null,
    practicalEvidenceLines ? `- Ângulos vivos do perfil:\n${practicalEvidenceLines}` : null,
    winningScriptExamplesBlock ? `- Roteiros reais do perfil que performaram bem:\n${winningScriptExamplesBlock}` : null,
    "- Converta os padrões vencedores em roteiro útil: diagnóstico concreto + ajuste aplicável + prova ou situação observável.",
    "- A direção deve justificar por que cada escolha faz sentido com base em categorias, narrativa, formato, tom, sinais de lift ou janela de publicação quando houver sinal.",
  ]
    .filter(Boolean)
    .join("\n");
  const editorialDecision = context.editorialDecision;
  const editorialDecisionReasons = editorialDecision
    ? uniqueCompactValues(editorialDecision.whyThisShouldWork, 3, 130)
        .map((item) => `- ${item}`)
        .join("\n")
    : "";
  const editorialDecisionEvidence = editorialDecision
    ? uniqueCompactValues(editorialDecision.evidence, 3, 110)
        .map((item) => `- ${item}`)
        .join("\n")
    : "";
  const editorialDecisionBlock = editorialDecision
    ? [
        "Decisão editorial recomendada:",
        `- O que postar: ${compactPromptExample(editorialDecision.postDirective, 150)}`,
        `- Ângulo narrativo: ${compactPromptExample(editorialDecision.narrativeAngle, 110)}`,
        `- Estrutura recomendada: ${compactPromptExample(editorialDecision.recommendedStructure, 120)}`,
        editorialDecisionReasons ? `- Por que isso tende a funcionar:\n${editorialDecisionReasons}` : null,
        editorialDecisionEvidence ? `- Evidências que sustentam a decisão:\n${editorialDecisionEvidence}` : null,
        editorialDecision.postingWindow
          ? `- Janela observada: ${compactPromptExample(editorialDecision.postingWindow, 110)}`
          : null,
        "- Primeiro decida silenciosamente o vídeo que deveria ser postado; só depois transforme isso em cenas filmáveis.",
      ]
        .filter(Boolean)
        .join("\n")
    : "";
  const body = joinPromptSectionsWithinBudget(
    [
      `- Modo do pedido: ${context.promptMode}\n` +
        `- Métrica usada: ${context.metricUsed}\n` +
        `- Janela historica: ${context.lookbackDays} dias\n` +
        `${categoryLines || "- Sem categorias resolvidas."}\n` +
        `- Evidencias de DNA: ${context.dnaProfile.sampleSize} legendas\n` +
        `- Perfil de linguagem:\n${dnaLines}`,
      editorialDecisionBlock,
      `Playbook acionável do perfil:\n${creatorPlaybookBlock}`,
      evidenceBlock,
      styleBlock,
      linkedOutcomeBlock,
      timingBlock,
    ],
    INTELLIGENCE_PROMPT_MAX_CHARS
  );

  return body
    ? `\n\nContexto inteligente do criador (aplique silenciosamente, sem explicar ao usuario):\n${body}`
    : "";
}

function parseDraftFromResponse(raw: string): ScriptDraft {
  const parsed = parseLooseJsonObject(raw);
  const title = clampText(parsed?.title, "Novo roteiro", 80);
  const content = clampText(parsed?.content, "Roteiro gerado.", TECHNICAL_SCRIPT_MAX_CHARS);
  return { title, content };
}

function parseLooseJsonObject(raw: string): any {
  const trimmed = (raw || "").trim();
  if (!trimmed) {
    throw new Error("Resposta vazia do modelo");
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1));
    }
    throw new Error("Resposta JSON inválida do modelo");
  }
}

function normalizeTenPointScore(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.min(10, Math.max(0, Math.round(parsed * 10) / 10));
}

function parseIssuesList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => String(item || "").trim())
    .filter(Boolean)
    .slice(0, 6);
}

function normalizeSemanticReviewAssessment(raw: any): ScriptSemanticQualityAssessment {
  const overall = normalizeTenPointScore(raw?.overall);
  const adherence = normalizeTenPointScore(raw?.adherence);
  const specificity = normalizeTenPointScore(raw?.specificity);
  const humanity = normalizeTenPointScore(raw?.humanity);
  const titleAlignment = normalizeTenPointScore(raw?.titleAlignment);
  const creatorFit = normalizeTenPointScore(raw?.creatorFit);
  const hook = normalizeTenPointScore(raw?.hook);
  const cta = normalizeTenPointScore(raw?.cta);
  const utility = normalizeTenPointScore(raw?.utility);
  const issues = parseIssuesList(raw?.issues);
  const rewriteBrief = clampText(
    raw?.rewriteBrief,
    issues.join("; ") || "Reescreva com mais especificidade, voz humana e aderência ao pedido.",
    600
  );
  const passes =
    (raw?.passes === true || overall >= SEMANTIC_REVIEW_MIN_SCORE) &&
    adherence >= SEMANTIC_REVIEW_MIN_DIMENSION_SCORE &&
    specificity >= SEMANTIC_REVIEW_MIN_DIMENSION_SCORE &&
    humanity >= SEMANTIC_REVIEW_MIN_DIMENSION_SCORE &&
    titleAlignment >= SEMANTIC_REVIEW_MIN_DIMENSION_SCORE &&
    utility >= SEMANTIC_REVIEW_MIN_DIMENSION_SCORE &&
    hook >= SEMANTIC_REVIEW_MIN_DIMENSION_SCORE &&
    cta >= 6.2;
  return {
    overall,
    passes,
    adherence,
    specificity,
    humanity,
    titleAlignment,
    creatorFit,
    hook,
    cta,
    utility,
    issues,
    rewriteBrief,
  };
}

function parseSemanticQualityAssessmentFromResponse(raw: string): ScriptSemanticQualityAssessment {
  const parsed = parseLooseJsonObject(raw);
  return normalizeSemanticReviewAssessment(parsed);
}

function getOpenAIClient(): OpenAI | null {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;
  if (!openAIClientCache || openAIClientCacheKey !== apiKey) {
    openAIClientCache = new OpenAI({
      apiKey,
      baseURL: process.env.OPENAI_BASE_URL || "https://api.openai.com/v1",
    });
    openAIClientCacheKey = apiKey;
  }
  return openAIClientCache;
}

function selectScriptSemanticJudgeModel(): string {
  const configured = (
    process.env.OPENAI_MODEL_SCRIPT_JUDGE ||
    process.env.OPENAI_MODEL_ADVANCED ||
    process.env.OPENAI_MODEL_PREMIUM ||
    process.env.OPENAI_MODEL ||
    "gpt-4o-mini"
  ).trim();
  return configured || "gpt-4o-mini";
}

function buildSemanticReviewContextSummary(context: ScriptIntelligenceContext | null | undefined): string {
  if (!context) return "- Sem contexto adicional do criador.";
  const lines = [
    context.resolvedCategories.proposal ? `- proposal: ${context.resolvedCategories.proposal}` : null,
    context.resolvedCategories.context ? `- context: ${context.resolvedCategories.context}` : null,
    context.resolvedCategories.tone ? `- tone: ${context.resolvedCategories.tone}` : null,
    `- DNA captions: ${context.dnaProfile.sampleSize}`,
    `- Style samples: ${context.styleSampleSize}`,
    context.editorialDecision?.postDirective
      ? `- Decisão editorial: ${compactPromptExample(context.editorialDecision.postDirective, 130)}`
      : null,
    context.editorialDecision?.narrativeAngle
      ? `- Ângulo recomendado: ${compactPromptExample(context.editorialDecision.narrativeAngle, 90)}`
      : null,
    context.editorialDecision?.recommendedStructure
      ? `- Estrutura recomendada: ${compactPromptExample(context.editorialDecision.recommendedStructure, 90)}`
      : null,
  ].filter(Boolean);
  const styleLines = context.styleProfile?.writingGuidelines?.slice(0, 4) || [];
  const hookLines = uniqueCompactValues(
    [
      ...(context.linkedOutcome?.topExamples?.map((item) => item.hookSample || "") || []),
      ...(context.styleProfile?.styleSignalsUsed.hookPatterns || []),
    ],
    2,
    90
  );
  const ctaLines = uniqueCompactValues(
    [
      ...(context.linkedOutcome?.topExamples?.map((item) => item.ctaSample || "") || []),
      ...(context.styleProfile?.styleSignalsUsed.ctaPatterns || []),
    ],
    2,
    90
  );
  const winningScripts = (context.winningScriptExamples || [])
    .slice(0, 2)
    .map((item) => {
      const parts = [
        item.opening ? `gancho: ${item.opening}` : "",
        item.development ? `movimento: ${item.development}` : "",
        item.cta ? `cta: ${item.cta}` : "",
      ]
        .filter(Boolean)
        .join(" | ");
      return parts ? `- Exemplo real (${item.title}): ${parts}` : null;
    })
    .filter(Boolean) as string[];
  return [
    ...lines,
    ...(context.engagementTiming ? [`- Timing vencedor: ${context.engagementTiming.summary}`] : []),
    ...(context.editorialDecision?.whyThisShouldWork?.length
      ? [
          `- Por que isso deveria funcionar: ${uniqueCompactValues(
            context.editorialDecision.whyThisShouldWork,
            2,
            100
          ).join(" | ")}`,
        ]
      : []),
    ...(styleLines.length ? ["- Sinais de estilo prioritários:", ...styleLines.map((line) => `  - ${line}`)] : []),
    ...(hookLines.length ? [`- Hooks vencedores: ${hookLines.join(" | ")}`] : []),
    ...(ctaLines.length ? [`- CTAs vencedores: ${ctaLines.join(" | ")}`] : []),
    ...winningScripts,
  ].join("\n");
}

function buildSemanticReviewPrompt(params: {
  userPrompt: string;
  operation: ScriptModelOperation;
  draft: ScriptDraft;
  editorialAnchorTitle: string;
  intelligenceContext?: ScriptIntelligenceContext | null;
  adjustMode?: ScriptAdjustMode;
}): string {
  const operationLabel =
    params.operation === "generate"
      ? "geração de novo roteiro"
      : `ajuste de roteiro${params.adjustMode ? ` (${params.adjustMode})` : ""}`;
  return (
    `Faça uma revisão editorial rigorosa de um roteiro para creator brasileiro.\n` +
    `Pedido original do usuário: ${params.userPrompt}\n` +
    `Tipo de operação: ${operationLabel}\n` +
    `Título âncora do roteiro: ${params.editorialAnchorTitle}\n` +
    `Contexto do criador:\n${buildSemanticReviewContextSummary(params.intelligenceContext)}\n\n` +
    `Roteiro entregue:\nTítulo: ${params.draft.title}\n${params.draft.content}\n\n` +
    `Este produto deve priorizar blueprint prático de gravação. Não cobre texto final perfeito se a cena estiver clara, filmável e útil.\n` +
    `Além disso, a resposta deve justificar por que cada escolha faz sentido para o engajamento do perfil, como um diretor explicando a lógica da gravação.\n` +
    `Critérios de nota (0 a 10):\n` +
    `- adherence: responde exatamente o pedido e mantém o tema central\n` +
    `- specificity: tem detalhes concretos, evita generalidades e deixa claro como a cena vai acontecer\n` +
    `- humanity: soa humano, conversacional e sem cara de manual/publicidade genérica\n` +
    `- titleAlignment: cumpre a promessa do título e mantém todas as cenas servindo a mesma pauta\n` +
    `- utility: entrega um ajuste, passo, critério, erro ou diagnóstico aplicável; não é só tese bonita\n` +
    `- creatorFit: respeita o perfil/estilo do criador quando houver sinais suficientes\n` +
    `- hook: deixa claro como abrir o vídeo com força real e sem clichê, mesmo que a frase final ainda seja só sugerida\n` +
    `- cta: fecha com CTA natural, específico e não robótico, mesmo que esteja descrito como sugestão\n\n` +
    `Marque como ruim se houver copy genérico, clichês, abstração, tese fraca, CTA burocrático, falta de dor real, falta de utilidade prática, falta de clareza de captação, falta de justificativa estratégica ou falta de aderência ao pedido.\n` +
    `Retorne APENAS JSON válido com:\n` +
    `{"overall": number, "passes": boolean, "adherence": number, "specificity": number, "humanity": number, "titleAlignment": number, "utility": number, "creatorFit": number, "hook": number, "cta": number, "issues": string[], "rewriteBrief": string}\n`
  );
}

async function requestSemanticQualityAssessmentFromModel(params: {
  client: OpenAI;
  prompt: string;
  model: string;
}): Promise<ScriptSemanticQualityAssessment> {
  const completion = await params.client.chat.completions.create({
    model: params.model,
    temperature: 0.1,
    response_format: { type: "json_object" } as any,
    messages: [
      {
        role: "system",
        content:
          "Você é editor-chefe de roteiros curtos para creators. Avalie com rigor e responda somente JSON válido.",
      },
      { role: "user", content: params.prompt },
    ],
  } as any);

  const raw = completion.choices?.[0]?.message?.content || "{}";
  return parseSemanticQualityAssessmentFromResponse(raw);
}

function shouldRunSemanticReview(options: CallModelOptions): boolean {
  if (options.operation === "generate") return true;
  return options.adjustMode === "rewrite_full" || options.adjustMode === "new_script";
}

function buildRetryPromptWithReviewFeedback(basePrompt: string, assessment: ScriptSemanticQualityAssessment): string {
  const issueLines = assessment.issues.length
    ? assessment.issues.map((issue) => `- ${issue}`).join("\n")
    : "- Reescreva com mais especificidade, mais voz humana e menos generalidade.";
  return (
    `${basePrompt}\n\n` +
    `Correção obrigatória após revisão editorial:\n` +
    `${issueLines}\n` +
    `- Objetivo da reescrita: ${assessment.rewriteBrief}\n` +
    `- Refaça o roteiro inteiro do zero, sem reaproveitar frases genéricas do rascunho ruim\n` +
    `- O roteiro final precisa deixar pelo menos um ajuste aplicável claro para o espectador\n` +
    `- Deixe o assunto explícito cedo, crie progressão real e elimine qualquer CTA burocrático\n` +
    `- Faça o criador conseguir visualizar a gravação com clareza: o que mostrar, como gravar e o que comunicar em cada cena\n`
  );
}

async function requestScriptDraftFromModel(params: {
  client: OpenAI;
  prompt: string;
  model: string;
  temperature: number;
}): Promise<ScriptDraft> {
  const completion = await params.client.chat.completions.create({
    model: params.model,
    temperature: params.temperature,
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
  const client = getOpenAIClient();
  if (!client) return null;
  const modelSelection = selectScriptModelForPrompt({
    userPrompt: options.userPrompt,
    operation: options.operation,
    adjustMode: options.adjustMode,
  });
  const temperature = selectScriptTemperature({
    operation: options.operation,
    adjustMode: options.adjustMode,
  });

  const llmStartMs = Date.now();
  try {
    try {
      return await requestScriptDraftFromModel({
        client,
        prompt,
        model: modelSelection.model,
        temperature,
      });
    } catch (primaryError) {
      if (
        modelSelection.tier === "premium" &&
        modelSelection.fallbackModel &&
        modelSelection.fallbackModel !== modelSelection.model
      ) {
        logger.warn("[scripts][llm][fallback_model_retry]", {
          operation: options.operation,
          adjustMode: options.adjustMode || null,
          primaryModel: modelSelection.model,
          fallbackModel: modelSelection.fallbackModel,
          temperature,
          reason: modelSelection.reason,
          error: primaryError instanceof Error ? primaryError.message : String(primaryError || ""),
        });
        return requestScriptDraftFromModel({
          client,
          prompt,
          model: modelSelection.fallbackModel,
          temperature,
        });
      }
      throw primaryError;
    }
  } finally {
    recordScriptsStageDuration("llm.call", Date.now() - llmStartMs);
  }
}

async function assessDraftSemanticQuality(params: {
  draft: ScriptDraft;
  userPrompt: string;
  options: CallModelOptions;
  editorialAnchorTitle: string;
  intelligenceContext?: ScriptIntelligenceContext | null;
}): Promise<ScriptSemanticQualityAssessment | null> {
  const client = getOpenAIClient();
  if (!client) return null;
  try {
    return await requestSemanticQualityAssessmentFromModel({
      client,
      prompt: buildSemanticReviewPrompt({
        userPrompt: params.userPrompt,
        operation: params.options.operation,
        draft: params.draft,
        editorialAnchorTitle: params.editorialAnchorTitle,
        intelligenceContext: params.intelligenceContext,
        adjustMode: params.options.adjustMode,
      }),
      model: selectScriptSemanticJudgeModel(),
    });
  } catch (error) {
    logger.warn("[scripts][review][semantic_assessment_failed]", {
      operation: params.options.operation,
      adjustMode: params.options.adjustMode || null,
      error: error instanceof Error ? error.message : String(error || ""),
    });
    return null;
  }
}

async function maybeRefineDraftWithSemanticReview(params: {
  basePrompt: string;
  userPrompt: string;
  draft: ScriptDraft;
  editorialAnchorTitle: string;
  options: CallModelOptions;
  intelligenceContext?: ScriptIntelligenceContext | null;
  allowedIdentitySources: string[];
}): Promise<ScriptDraftWithReview> {
  if (!shouldRunSemanticReview(params.options)) {
    return {
      ...params.draft,
      reviewMeta: {
        attempted: false,
        retried: false,
        acceptedAfterRetry: false,
      },
    };
  }

  const initialAssessment = await assessDraftSemanticQuality({
    draft: params.draft,
    userPrompt: params.userPrompt,
    options: params.options,
    editorialAnchorTitle: params.editorialAnchorTitle,
    intelligenceContext: params.intelligenceContext,
  });
  if (!initialAssessment) {
    return {
      ...params.draft,
      reviewMeta: {
        attempted: true,
        retried: false,
        acceptedAfterRetry: false,
      },
    };
  }
  if (initialAssessment.passes) {
    return {
      ...params.draft,
      reviewMeta: {
        attempted: true,
        retried: false,
        acceptedAfterRetry: false,
        initialOverallScore: initialAssessment.overall,
        finalOverallScore: initialAssessment.overall,
        initialPasses: initialAssessment.passes,
        finalPasses: initialAssessment.passes,
        initialIssues: initialAssessment.issues,
        finalIssues: initialAssessment.issues,
        rewriteBrief: initialAssessment.rewriteBrief,
      },
    };
  }

  const retryPrompt = buildRetryPromptWithReviewFeedback(params.basePrompt, initialAssessment);
  const retryDraft = await callModel(retryPrompt, params.options);
  if (!retryDraft) {
    return params.draft;
  }

  const retrySanitized = sanitizeScriptIdentityLeakage(retryDraft, params.allowedIdentitySources);
  const retryDensityProfile =
    params.options.operation === "generate" ? resolveBlueprintDensityProfile(params.userPrompt) : null;
  const retryNormalized = enforceTechnicalScriptContract(retrySanitized, params.userPrompt, {
    runQualityPass: false,
    editorialDecision: params.intelligenceContext?.editorialDecision,
    preferredSceneCount: retryDensityProfile?.preferredSceneCount,
    maxSceneCount: retryDensityProfile?.maxSceneCount,
  });
  const retryAssessment = await assessDraftSemanticQuality({
      draft: retryNormalized,
      userPrompt: params.userPrompt,
      options: params.options,
      editorialAnchorTitle: params.editorialAnchorTitle,
      intelligenceContext: params.intelligenceContext,
    });

  const baseMeta: ScriptSemanticReviewMeta = {
    attempted: true,
    retried: true,
    acceptedAfterRetry: false,
    initialOverallScore: initialAssessment.overall,
    initialPasses: initialAssessment.passes,
    initialIssues: initialAssessment.issues,
    rewriteBrief: initialAssessment.rewriteBrief,
  };

  if (!retryAssessment) {
    const retryHeuristic = evaluateTechnicalScriptQuality(retryNormalized.content, params.userPrompt);
    const currentHeuristic = evaluateTechnicalScriptQuality(params.draft.content, params.userPrompt);
    if (retryHeuristic.perceivedQuality >= currentHeuristic.perceivedQuality) {
      return {
        ...retryNormalized,
        reviewMeta: {
          ...baseMeta,
          acceptedAfterRetry: true,
        },
      };
    }
    return {
      ...params.draft,
      reviewMeta: {
        ...baseMeta,
        finalOverallScore: initialAssessment.overall,
        finalPasses: initialAssessment.passes,
        finalIssues: initialAssessment.issues,
      },
    };
  }

  if (retryAssessment.passes && !initialAssessment.passes) {
    return {
      ...retryNormalized,
      reviewMeta: {
        ...baseMeta,
        acceptedAfterRetry: true,
        finalOverallScore: retryAssessment.overall,
        finalPasses: retryAssessment.passes,
        finalIssues: retryAssessment.issues,
      },
    };
  }
  if (retryAssessment.overall > initialAssessment.overall) {
    return {
      ...retryNormalized,
      reviewMeta: {
        ...baseMeta,
        acceptedAfterRetry: true,
        finalOverallScore: retryAssessment.overall,
        finalPasses: retryAssessment.passes,
        finalIssues: retryAssessment.issues,
      },
    };
  }
  return {
    ...params.draft,
    reviewMeta: {
      ...baseMeta,
      finalOverallScore: retryAssessment.overall,
      finalPasses: retryAssessment.passes,
      finalIssues: retryAssessment.issues,
    },
  };
}

function buildNormalizedTechnicalScenes(
  content: string,
  fallbackPrompt: string,
  options?: Pick<TechnicalContractOptions, "preferredSceneCount" | "maxSceneCount">
): TechnicalSceneBlock[] {
  const topic = extractTopicHint(fallbackPrompt);
  const objective = inferScriptObjective(fallbackPrompt);
  const parsed = parseTechnicalScenes(content);
  const normalized = parsed.length ? parsed : buildTechnicalScenesFromLegacyContent(content, fallbackPrompt);

  const scenes: TechnicalSceneBlock[] = normalized.length
    ? normalized
    : [1, 2, 3, 4].map((sceneIndex) => ({
      index: sceneIndex,
      heading: defaultHeadingForScene(sceneIndex, 4),
      row: buildDefaultTechnicalRow(sceneIndex, 4, topic, objective),
    }));

  scenes.sort((a, b) => a.index - b.index);
  while (scenes.length < 4) {
    const nextIndex = scenes.length + 1;
    scenes.push({
      index: nextIndex,
      heading: defaultHeadingForScene(nextIndex, Math.max(4, nextIndex)),
      row: buildDefaultTechnicalRow(nextIndex, Math.max(4, nextIndex), topic, objective),
    });
  }
  const preferredSceneCount = Math.max(4, Math.min(6, options?.preferredSceneCount || 4));
  const maxSceneCount = Math.max(preferredSceneCount, Math.min(6, options?.maxSceneCount || 6));
  if (scenes.length > maxSceneCount) {
    const keepIndices = new Set<number>();
    if (maxSceneCount <= 4) {
      [1, 2, 3].forEach((index) => keepIndices.add(index));
      keepIndices.add(scenes.length);
    } else {
      for (let index = 1; index < maxSceneCount; index += 1) {
        keepIndices.add(index);
      }
      keepIndices.add(scenes.length);
    }
    const trimmed = scenes.filter((scene) => keepIndices.has(scene.index));
    if (trimmed.length >= 4) {
      scenes.length = 0;
      scenes.push(...trimmed.slice(0, maxSceneCount));
    }
  }
  if (scenes.length > 6) scenes.length = 6;
  if (scenes.length > preferredSceneCount && maxSceneCount === preferredSceneCount) {
    scenes.length = preferredSceneCount;
  }

  return scenes.map((scene, idx, all) => {
    const sceneIndex = idx + 1;
    const totalScenes = all.length;
    const fallbackRow = buildDefaultTechnicalRow(sceneIndex, totalScenes, topic, objective);
    const isLast = idx === all.length - 1;
    const heading = normalizeSceneHeadingLabel(scene.heading, sceneIndex, totalScenes);
    const falaBase = ensureLiteralSpeech(scene.row.fala, fallbackRow.fala);
    const fala = isLast
      ? ensureCtaSpeech(falaBase, fallbackRow.fala)
      : CTA_LITERAL_REGEX.test(falaBase)
        ? fallbackRow.fala
        : falaBase;
    const visualBase = sanitizeTableCell(scene.row.visual, fallbackRow.visual);
    const visual = !isLast && CTA_OVERLAY_REGEX.test(visualBase)
      ? fallbackRow.visual
      : visualBase;
    const direcaoRaw = sanitizeTableCell(scene.row.direcao, fallbackRow.direcao);
    return {
      index: sceneIndex,
      heading,
      row: {
        tempo: sanitizeTableCell(scene.row.tempo, fallbackRow.tempo),
        visual,
        fala,
        direcao: isActionableDirection(direcaoRaw) ? direcaoRaw : fallbackRow.direcao,
      },
    };
  });
}

function equalsLoose(a: string, b: string): boolean {
  return sanitizeTableCell(a || "", "").toLowerCase() === sanitizeTableCell(b || "", "").toLowerCase();
}

function inferPatchFieldPolicy(prompt: string): {
  allowHeading: boolean;
  allowTempo: boolean;
  allowVisual: boolean;
  allowDirecao: boolean;
} {
  return {
    allowHeading: PATCH_HEADING_INTENT_REGEX.test(prompt),
    allowTempo: PATCH_TEMPO_INTENT_REGEX.test(prompt),
    allowVisual: PATCH_VISUAL_INTENT_REGEX.test(prompt),
    allowDirecao: PATCH_DIRECAO_INTENT_REGEX.test(prompt),
  };
}

function applyConservativePatchMerge(
  originalContent: string,
  candidateContent: string,
  prompt: string
): { content: string; outOfScopeChangeRate: number } {
  const originalScenes = parseTechnicalScenes(originalContent);
  const candidateScenes = parseTechnicalScenes(candidateContent);
  if (!originalScenes.length || !candidateScenes.length) {
    return { content: candidateContent, outOfScopeChangeRate: -1 };
  }

  const policy = inferPatchFieldPolicy(prompt);
  const candidateByIndex = new Map<number, TechnicalSceneBlock>();
  candidateScenes.forEach((scene) => candidateByIndex.set(scene.index, scene));

  let outOfScopeChanges = 0;
  let outOfScopeChecks = 0;

  const mergedScenes = originalScenes.map((originalScene) => {
    const candidateScene = candidateByIndex.get(originalScene.index);
    if (!candidateScene) return originalScene;

    if (!policy.allowHeading) {
      outOfScopeChecks += 1;
      if (!equalsLoose(candidateScene.heading, originalScene.heading)) outOfScopeChanges += 1;
    }
    if (!policy.allowTempo) {
      outOfScopeChecks += 1;
      if (!equalsLoose(candidateScene.row.tempo, originalScene.row.tempo)) outOfScopeChanges += 1;
    }
    if (!policy.allowVisual) {
      outOfScopeChecks += 1;
      if (!equalsLoose(candidateScene.row.visual, originalScene.row.visual)) outOfScopeChanges += 1;
    }
    if (!policy.allowDirecao) {
      outOfScopeChecks += 1;
      if (!equalsLoose(candidateScene.row.direcao, originalScene.row.direcao)) outOfScopeChanges += 1;
    }

    return {
      index: originalScene.index,
      heading: policy.allowHeading ? (candidateScene.heading || originalScene.heading) : originalScene.heading,
      row: {
        tempo: policy.allowTempo ? (candidateScene.row.tempo || originalScene.row.tempo) : originalScene.row.tempo,
        visual: policy.allowVisual ? (candidateScene.row.visual || originalScene.row.visual) : originalScene.row.visual,
        // Fala segue sendo o campo mais comum para ajustes textuais, mesmo no modo blueprint.
        fala: candidateScene.row.fala || originalScene.row.fala,
        direcao: policy.allowDirecao
          ? (candidateScene.row.direcao || originalScene.row.direcao)
          : originalScene.row.direcao,
      },
    };
  });

  const outOfScopeChangeRate =
    outOfScopeChecks > 0 ? Number((outOfScopeChanges / outOfScopeChecks).toFixed(4)) : 0;

  return {
    content: serializeTechnicalScript(mergedScenes),
    outOfScopeChangeRate,
  };
}

export function enforceTechnicalScriptContract(
  draft: ScriptDraft,
  fallbackPrompt: string,
  options?: TechnicalContractOptions
): ScriptDraft {
  const runQualityPass = options?.runQualityPass ?? true;
  const fallback = fallbackGenerate(fallbackPrompt);
  const title = clampText(draft.title, fallback.title, 80);
  const rawContent = clampText(draft.content, "", TECHNICAL_SCRIPT_MAX_CHARS) || fallback.content;
  const editorialBrief = resolveTechnicalEditorialBrief({
    rawContent,
    fallbackPrompt,
    editorialDecision: options?.editorialDecision,
  });
  let scenes = buildNormalizedTechnicalScenes(rawContent, fallbackPrompt, {
    preferredSceneCount: options?.preferredSceneCount,
    maxSceneCount: options?.maxSceneCount,
  });
  const scoreBefore = evaluateTechnicalScriptQualityFromScenes(scenes);
  if (runQualityPass && shouldRunQualityPass(scoreBefore)) {
    const polished = polishScenesForQuality(scenes, fallbackPrompt);
    const polishedScore = evaluateTechnicalScriptQualityFromScenes(polished);
    const shouldAdoptPolished =
      polishedScore.perceivedQuality >= scoreBefore.perceivedQuality ||
      polishedScore.perceivedQuality >= QUALITY_PASS_MIN_SCORE;
    if (shouldAdoptPolished) {
      scenes = polished;
    }
  }
  const normalizedContent = serializeTechnicalScript(scenes, editorialBrief);
  return {
    title: clampText(title, fallback.title, 80),
    content: clampText(normalizedContent, fallback.content, TECHNICAL_SCRIPT_MAX_CHARS),
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
  }, Math.max(targetSceneIndex, 4));
}

function extractScopedTargetContent(rawContent: string, target: ScriptAdjustTarget): string {
  const normalized = String(rawContent || "").trim();
  if (!normalized) return normalized;
  if (target.type === "scene") {
    return extractScopedSceneContent(normalized, target.index);
  }
  const resolved = resolveScopedSegment(normalized, target);
  if (resolved?.segment.text) return resolved.segment.text;
  return normalized;
}

function buildScopedTargetOutputRule(target: ScriptAdjustTarget): string {
  if (target.type === "scene") {
    return "- Retorne APENAS o bloco completo da cena alvo (CENA ... + Visual + Fala + Direção)";
  }
  if (target.type === "editorial") {
    return "- Retorne APENAS a linha editorial alvo atualizada, preservando o mesmo label";
  }
  if (target.type === "paragraph" || target.type === "first_paragraph" || target.type === "last_paragraph") {
    return "- Retorne APENAS o trecho alvo atualizado, sem reescrever outras partes";
  }
  return "- Retorne APENAS o trecho alvo atualizado";
}

function sanitizeAdjustedScript(input: AdjustInput, draft: ScriptDraft): ScriptDraft {
  const originalTitle = clampText(input.title, "Roteiro ajustado", 80);
  const originalContent = clampText(input.content, "", TECHNICAL_SCRIPT_MAX_CHARS);
  const prompt = input.prompt.trim();
  const shouldAllowTitleChange = TITLE_CHANGE_INTENT_REGEX.test(prompt);
  const nextTitle = shouldAllowTitleChange
    ? clampText(draft.title, originalTitle, 80)
    : originalTitle;
  const nextContent = clampText(draft.content, originalContent, TECHNICAL_SCRIPT_MAX_CHARS);

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
      content: clampText(merged, originalContent, TECHNICAL_SCRIPT_MAX_CHARS),
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

export async function generateScriptFromPrompt(input: GenerateInput): Promise<ScriptDraftWithReview> {
  const userPrompt = input.prompt.trim();
  if (!userPrompt) {
    throw new Error("Informe um prompt para gerar o roteiro.");
  }

  const editorialAnchorTitle = resolveEditorialAnchorTitle(input);
  const densityProfile = resolveBlueprintDensityProfile(userPrompt);
  const llmPrompt = buildGenerateScriptPrompt(input);
  const allowedIdentitySources = [userPrompt, input.title || "", editorialAnchorTitle];

  try {
    const result = await callModel(llmPrompt, {
      userPrompt,
      operation: "generate",
    });
    if (result) {
      const sanitized = sanitizeScriptIdentityLeakage(result, allowedIdentitySources);
      const anchoredDraft: ScriptDraft = {
        title: input.title?.trim()
          ? clampText(input.title, editorialAnchorTitle, 80)
          : clampText(sanitized.title, editorialAnchorTitle, 80),
        content: sanitized.content,
      };
      const normalized = enforceTechnicalScriptContract(anchoredDraft, `${editorialAnchorTitle}\n${userPrompt}`, {
        runQualityPass: false,
        editorialDecision: input.intelligenceContext?.editorialDecision,
        preferredSceneCount: densityProfile.preferredSceneCount,
        maxSceneCount: densityProfile.maxSceneCount,
      });
      const refined = await maybeRefineDraftWithSemanticReview({
        basePrompt: llmPrompt,
        userPrompt,
        draft: normalized,
        editorialAnchorTitle,
        options: {
          userPrompt,
          operation: "generate",
        },
        intelligenceContext: input.intelligenceContext,
        allowedIdentitySources,
      });
      const finalDraft = enforceTechnicalScriptContract(refined, `${editorialAnchorTitle}\n${userPrompt}`, {
        runQualityPass: refined === normalized ? true : false,
        editorialDecision: input.intelligenceContext?.editorialDecision,
        preferredSceneCount: densityProfile.preferredSceneCount,
        maxSceneCount: densityProfile.maxSceneCount,
      });
      return {
        ...finalDraft,
        reviewMeta: refined.reviewMeta,
      };
    }
  } catch (error) {
    logger.warn("[scripts][generate][model_failed_using_local_fallback]", {
      promptLength: userPrompt.length,
      hasIntelligenceContext: Boolean(input.intelligenceContext),
      error: error instanceof Error ? error.message : String(error || ""),
    });
  }

  const fallback = sanitizeScriptIdentityLeakage(fallbackGenerate(`${editorialAnchorTitle}\n${userPrompt}`), allowedIdentitySources);
  return {
    ...enforceTechnicalScriptContract(fallback, `${editorialAnchorTitle}\n${userPrompt}`, {
      editorialDecision: input.intelligenceContext?.editorialDecision,
      preferredSceneCount: densityProfile.preferredSceneCount,
      maxSceneCount: densityProfile.maxSceneCount,
    }),
    reviewMeta: {
      attempted: false,
      retried: false,
      acceptedAfterRetry: false,
    },
  };
}

export async function adjustScriptFromPrompt(input: AdjustInput): Promise<AdjustResult> {
  const userPrompt = input.prompt.trim();
  if (!userPrompt) {
    throw new Error("Descreva o ajuste que você quer aplicar.");
  }

  const editorialAnchorTitle = resolveEditorialAnchorTitle({
    prompt: userPrompt,
    title: input.title,
    intelligenceContext: input.intelligenceContext,
  });
  const fallbackPromptForAdjust = `${editorialAnchorTitle}\n${userPrompt}`;

  const baseContent = isTechnicalScript(input.content)
    ? input.content.trim()
    : convertLegacyScriptToTechnical(input.content, fallbackPromptForAdjust);
  const inputForAdjust: AdjustInput = {
    ...input,
    content: baseContent,
  };

  const scope = detectScriptAdjustScope(userPrompt);
  const shouldEnforceScopedPatch = scope.mode === "patch" && scope.target.type !== "none";
  const shouldRunQualityPassForAdjust = shouldRunQualityPassForAdjustMode(scope.mode);
  const scopedResolution = shouldEnforceScopedPatch
    ? resolveScopedSegment(baseContent, scope.target)
    : null;

  if (shouldEnforceScopedPatch && !scopedResolution) {
    throw new ScriptAdjustScopeError(
      `${describeScriptAdjustTarget(scope.target)} não foi encontrado no roteiro atual.`
    );
  }

  const intelligenceBlock =
    input.intelligenceContext && input.intelligenceContext.resolvedCategories
      ? buildIntelligencePromptBlock(input.intelligenceContext)
      : "";
  const adjustIntentGuidance = extractAdjustIntentGuidance(userPrompt);
  const technicalFormatRules =
    `Formato técnico obrigatório:\n` +
    `- Manter bloco ${TECHNICAL_SCRIPT_START} ... ${TECHNICAL_SCRIPT_END}\n` +
    `- Preservar ou atualizar as 4 linhas editoriais antes das cenas: O que postar / Por que postar assim / Quando postar / Como esse vídeo deve funcionar\n` +
    `- Cada cena deve seguir: CENA N: TITULO (tempo) + Visual + Fala + Direção\n` +
    `- Visual deve explicar como gravar a cena de forma prática: enquadramento, cenário, ação, objeto, apoio visual ou corte quando útil\n` +
    `- Fala deve descrever o que precisa ser comunicado na cena; use no máximo uma frase-exemplo curta quando realmente ajudar\n` +
    `- Mantenha qualidade narrativa humana: confissão/opinião concreta, dor real, virada prática, motivo humano e CTA conversacional quando fizer sentido\n` +
    `- Preserve ou reforce utilidade prática: diagnóstico, ajuste, passo, critério ou prova observável\n` +
    `- Direção de Performance sempre acionável (tom de voz, velocidade, pausa, gesto e execução)\n` +
    `- Somente a última cena pode ter heading CTA\n` +
    `- Se houver 5 cenas, use CENA 4: A PROVA e CENA 5: CHAMADA PARA AÇÃO\n` +
    `- Se houver 6 cenas, use CENA 4: A PROVA, CENA 5: VIRADA e CENA 6: CHAMADA PARA AÇÃO\n` +
    `- Última cena com CTA explícito ou CTA sugerido muito claro\n` +
    `- Mínimo 4 e máximo 6 cenas`;
  const scopedTargetOutputRule = buildScopedTargetOutputRule(scope.target);

  const llmPrompt = shouldEnforceScopedPatch
    ? `Ajuste apenas o trecho alvo do roteiro técnico com base no pedido do usuário.\n` +
    `Título âncora do roteiro: ${editorialAnchorTitle}\n` +
    `Título atual: ${inputForAdjust.title}\n` +
    `Roteiro atual:\n${inputForAdjust.content}\n\n` +
    `${intelligenceBlock}\n\n` +
    `Regras de interpretação do pedido:\n` +
    `${adjustIntentGuidance}\n` +
    `Trecho alvo: ${describeScriptAdjustTarget(scope.target)}\n` +
    `Conteúdo atual do trecho alvo:\n${scopedResolution?.segment.text || ""}\n\n` +
    `Ajuste solicitado: ${userPrompt}\n\n` +
    `Regras obrigatórias:\n` +
    `- Edite somente o trecho alvo\n` +
    `- Não reescreva outras partes do roteiro\n` +
    `- O trecho revisado precisa continuar servindo a promessa do título âncora\n` +
    `${scopedTargetOutputRule}\n` +
    `${scope.target.type === "scene" ? "- Preserve a mesma numeração da cena alvo\n" : ""}` +
    `- Retorne JSON válido com {"title","content"}\n` +
    `- "title": mantenha o título atual, salvo pedido explícito para alterá-lo\n` +
    `- "content": retorne APENAS o trecho alvo revisado\n` +
    `- Não inclua explicações fora do JSON\n` +
    `${technicalFormatRules}`
    : `Ajuste o roteiro técnico existente com base no pedido do usuário.\n` +
    `Título âncora do roteiro: ${editorialAnchorTitle}\n` +
    `Título atual: ${inputForAdjust.title}\n` +
    `Roteiro atual:\n${inputForAdjust.content}\n\n` +
    `${intelligenceBlock}\n\n` +
    `Regras de interpretação do pedido:\n` +
    `${adjustIntentGuidance}\n` +
    `Ajuste solicitado: ${userPrompt}\n\n` +
    `Regras obrigatórias:\n` +
    `- Preserve integralmente o que não foi pedido para mudar\n` +
    `- Se o pedido for pontual (ex.: primeiro parágrafo), altere só esse trecho\n` +
    `- Toda alteração precisa continuar coerente com a promessa do título âncora\n` +
    `- Retorne sempre o roteiro técnico completo atualizado (nunca apenas um trecho)\n` +
    `- Use o formato técnico canônico em todas as cenas\n` +
    `- Imitar o estilo do criador sem copiar frases literalmente\n` +
    `- Não citar outros criadores, marcas ou perfis sem pedido explícito\n` +
    `- Não incluir @menções ou hashtags, exceto se o usuário pedir explicitamente\n` +
    `- Resposta em JSON válido com {"title","content"}\n` +
    `- Não inclua explicações fora do JSON\n` +
    `${technicalFormatRules}`;

  const allowedIdentitySources = [userPrompt, inputForAdjust.title, editorialAnchorTitle, inputForAdjust.content];

  try {
    const result = await callModel(llmPrompt, {
      userPrompt,
      operation: "adjust",
      adjustMode: scope.mode,
    });
    if (result) {
      const sanitized = sanitizeScriptIdentityLeakage(result, allowedIdentitySources);
      if (shouldEnforceScopedPatch && scopedResolution) {
        const scopedRaw = extractScopedTargetContent(
          clampText(sanitized.content, scopedResolution.segment.text, TECHNICAL_SCRIPT_MAX_CHARS),
          scope.target
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
        const technicalDraft = enforceTechnicalScriptContract(mergedDraft, fallbackPromptForAdjust, {
          runQualityPass: shouldRunQualityPassForAdjust,
          editorialDecision: input.intelligenceContext?.editorialDecision,
        });
        return {
          ...technicalDraft,
          reviewMeta: {
            attempted: false,
            retried: false,
            acceptedAfterRetry: false,
          },
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
      const reviewOptions: CallModelOptions = {
        userPrompt,
        operation: "adjust",
        adjustMode: scope.mode,
      };
      let technicalDraft = enforceTechnicalScriptContract(adjusted, fallbackPromptForAdjust, {
        runQualityPass: shouldRunQualityPassForAdjust && !shouldRunSemanticReview(reviewOptions),
        editorialDecision: input.intelligenceContext?.editorialDecision,
      });
      technicalDraft = await maybeRefineDraftWithSemanticReview({
        basePrompt: llmPrompt,
        userPrompt,
        draft: technicalDraft,
        editorialAnchorTitle,
        options: reviewOptions,
        intelligenceContext: input.intelligenceContext,
        allowedIdentitySources,
      });
      const shouldApplyConservativePatch = scope.mode === "patch" && scope.target.type === "none";
      let outOfScopeChangeRate = -1;
      if (shouldApplyConservativePatch) {
        const conservativeMerge = applyConservativePatchMerge(baseContent, technicalDraft.content, userPrompt);
        technicalDraft = {
          ...technicalDraft,
          content: conservativeMerge.content,
        };
        outOfScopeChangeRate = conservativeMerge.outOfScopeChangeRate;
      }
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
          scopeEnforced: shouldApplyConservativePatch,
          outOfScopeChangeRate,
        },
      };
    }
  } catch (error) {
    logger.warn("[scripts][adjust][model_failed_using_local_fallback]", {
      promptLength: userPrompt.length,
      hasIntelligenceContext: Boolean(input.intelligenceContext),
      adjustMode: scope.mode,
      targetType: scope.target.type,
      error: error instanceof Error ? error.message : String(error || ""),
    });
  }

  if (shouldEnforceScopedPatch && scopedResolution) {
    const fallbackSnippet = fallbackAdjustScoped(
      scopedResolution.segment.text,
      fallbackPromptForAdjust,
      scope.target
    );
    const mergedContent = mergeScopedSegment(baseContent, scopedResolution, fallbackSnippet);
    const mergedDraft = sanitizeAdjustedScript(inputForAdjust, {
      title: inputForAdjust.title,
      content: mergedContent,
    });
    const technicalDraft = enforceTechnicalScriptContract(mergedDraft, fallbackPromptForAdjust, {
      runQualityPass: shouldRunQualityPassForAdjust,
      editorialDecision: input.intelligenceContext?.editorialDecision,
    });
    return {
      ...technicalDraft,
      reviewMeta: {
        attempted: false,
        retried: false,
        acceptedAfterRetry: false,
      },
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
  let technicalDraft = enforceTechnicalScriptContract(adjusted, fallbackPromptForAdjust, {
    runQualityPass: shouldRunQualityPassForAdjust,
    editorialDecision: input.intelligenceContext?.editorialDecision,
  });
  const shouldApplyConservativePatch = scope.mode === "patch" && scope.target.type === "none";
  let outOfScopeChangeRate = -1;
  if (shouldApplyConservativePatch) {
    const conservativeMerge = applyConservativePatchMerge(baseContent, technicalDraft.content, userPrompt);
    technicalDraft = {
      ...technicalDraft,
      content: conservativeMerge.content,
    };
    outOfScopeChangeRate = conservativeMerge.outOfScopeChangeRate;
  }
  return {
    ...technicalDraft,
    reviewMeta: {
      attempted: false,
      retried: false,
      acceptedAfterRetry: false,
    },
    adjustMeta: {
      adjustMode: scope.mode,
      targetScope: scope.target.type,
      targetIndex:
        scope.target.type === "scene" || scope.target.type === "paragraph"
          ? scope.target.index
          : null,
      scopeFound: scopedResolution !== null || scope.target.type === "none",
      scopeEnforced: shouldApplyConservativePatch,
      outOfScopeChangeRate,
    },
  };
}
