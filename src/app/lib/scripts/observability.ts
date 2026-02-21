import { logger } from "@/app/lib/logger";

import type { ScriptIntelligenceContext } from "./intelligenceContext";
import { getScriptsPerformanceSnapshot } from "./performanceTelemetry";
import { SCRIPT_CATEGORY_DIMENSIONS, type ScriptCategoryDimension } from "./promptParser";
import { computeStyleSimilarityScore } from "./styleContext";
import type { ScriptAdjustMeta } from "./ai";
import { evaluateTechnicalScriptQuality } from "./ai";

type ScriptOperation = "create" | "adjust";

export type ScriptOutputDiagnostics = {
  operation: ScriptOperation;
  intelligenceEnabled: boolean;
  promptLength: number;
  titleLength: number;
  contentLength: number;
  paragraphCount: number;
  hasCta: boolean;
  explicitCategoryCount: number;
  explicitCategoryComplianceRate: number;
  promptMode?: ScriptIntelligenceContext["promptMode"];
  resolvedCategories?: Partial<Record<ScriptCategoryDimension, string>>;
  dnaSampleSize?: number;
  dnaHasEnoughEvidence?: boolean;
  styleProfileEnabled?: boolean;
  styleSampleSize?: number;
  styleSimilarityScore?: number;
  styleFallbackUsed?: boolean;
  adjustMode?: ScriptAdjustMeta["adjustMode"];
  targetScope?: ScriptAdjustMeta["targetScope"];
  targetIndex?: number | null;
  scopeFound?: boolean;
  scopeEnforced?: boolean;
  outOfScopeChangeRate?: number;
  relaxationLevel?: number;
  usedFallbackRules?: boolean;
  contentLengthDelta?: number;
  contentLengthDeltaPct?: number;
  sceneCount?: number;
  hasTechnicalColumns?: boolean;
  hasPerformanceDirection?: boolean;
  hasOnScreenText?: boolean;
  perceivedQualityScore?: number;
  hookStrength?: number;
  specificityScore?: number;
  speakabilityScore?: number;
  ctaStrength?: number;
  diversityScore?: number;
};

type BuildScriptOutputDiagnosticsInput = {
  operation: ScriptOperation;
  prompt: string;
  title: string;
  content: string;
  intelligenceContext?: ScriptIntelligenceContext | null;
  previousContent?: string;
  adjustMeta?: ScriptAdjustMeta;
};

function countParagraphs(content: string): number {
  return content
    .split(/\n\s*\n/g)
    .map((part) => part.trim())
    .filter(Boolean).length;
}

function hasCta(content: string): boolean {
  return /(cta|comente|coment[aá]rio|salve|salvar|compartilhe|compartilha|me conta|link na bio|clique no link)/i.test(
    content
  );
}

function detectTechnicalRows(content: string): Array<{
  tempo: string;
  enquadramento: string;
  acao: string;
  textoTela: string;
  fala: string;
  direcao: string;
}> {
  const parseFlowRows = (rawContent: string) => {
    const rows: Array<{
      tempo: string;
      enquadramento: string;
      acao: string;
      textoTela: string;
      fala: string;
      direcao: string;
    }> = [];
    const lines = (rawContent || "").replace(/\r/g, "").split("\n");
    const sceneHeaders: Array<{ start: number; tempo: string }> = [];
    for (let i = 0; i < lines.length; i += 1) {
      const line = (lines[i] || "").trim();
      const sceneMatch = line.match(/^\s*(?:\[\s*)?(?:CENA|SCENE)\s*(?:#\s*)?\d{1,3}\s*:\s*([^\]\n]+?)(?:\]\s*)?$/i);
      if (!sceneMatch) continue;
      const headingPayload = sceneMatch[1] || "";
      const tempoMatch = headingPayload.match(/\(([^)]+)\)\s*$/);
      sceneHeaders.push({
        start: i,
        tempo: tempoMatch?.[1] ? tempoMatch[1].trim() : "",
      });
    }

    for (let idx = 0; idx < sceneHeaders.length; idx += 1) {
      const current = sceneHeaders[idx];
      if (!current) continue;
      const next = sceneHeaders[idx + 1];
      const block = lines.slice(current.start + 1, next ? next.start : lines.length);
      let enquadramento = "";
      let acao = "";
      let textoTela = "";
      let fala = "";
      let direcao = "";
      for (const line of block) {
        const trimmed = line.trim();
        let match = trimmed.match(/^enquadramento\s*:\s*(.+)$/i);
        if (match?.[1]) {
          enquadramento = match[1].trim();
          continue;
        }
        match = trimmed.match(/^(?:a[cç][aã]o|a[cç][aã]o\/movimento)\s*:\s*(.+)$/i);
        if (match?.[1]) {
          acao = match[1].trim();
          continue;
        }
        match = trimmed.match(/^texto na tela\s*:\s*(.+)$/i);
        if (match?.[1]) {
          textoTela = match[1].trim();
          continue;
        }
        match = trimmed.match(/^fala\s*:\s*(.+)$/i);
        if (match?.[1]) {
          fala = match[1].replace(/^"+|"+$/g, "").trim();
          continue;
        }
        match = trimmed.match(/^(?:performance|dire[cç][aã]o de performance)\s*:\s*(.+)$/i);
        if (match?.[1]) {
          direcao = match[1].trim();
        }
      }
      if (enquadramento || acao || textoTela || fala || direcao) {
        rows.push({
          tempo: current.tempo || "",
          enquadramento,
          acao,
          textoTela,
          fala,
          direcao,
        });
      }
    }
    return rows;
  };

  const rows: Array<{
    tempo: string;
    enquadramento: string;
    acao: string;
    textoTela: string;
    fala: string;
    direcao: string;
  }> = [];
  const lines = (content || "").split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("|")) continue;
    if (/^\|\s*tempo\s*\|/i.test(trimmed)) continue;
    const cols = trimmed
      .split("|")
      .map((part) => part.trim())
      .filter(Boolean);
    if (!cols.length) continue;
    if (cols.every((part) => /^:?-{2,}:?$/.test(part))) continue;
    if (cols.length < 6) continue;
    rows.push({
      tempo: cols[0] || "",
      enquadramento: cols[1] || "",
      acao: cols[2] || "",
      textoTela: cols[3] || "",
      fala: cols[4] || "",
      direcao: cols.slice(5).join(" | "),
    });
  }
  if (rows.length > 0) return rows;
  return parseFlowRows(content || "");
}

function countScenes(content: string): number {
  return (content.match(/^\s*(?:\[\s*)?(?:CENA|SCENE)\s*(?:#\s*)?\d{1,3}\s*:[^\]\n]+(?:\]\s*)?$/gim) || []).length;
}

function hasTechnicalColumns(content: string): boolean {
  if (
    /^\|\s*tempo\s*\|\s*enquadramento\s*\|\s*a[çc][aã]o\/movimento\s*\|\s*texto na tela\s*\|\s*fala \(literal\)\s*\|\s*dire[cç][aã]o de performance\s*\|?$/im.test(
      content
    )
  ) {
    return true;
  }
  const hasScenes = countScenes(content) > 0;
  if (!hasScenes) return false;
  return (
    /enquadramento\s*:/i.test(content) &&
    /(?:a[cç][aã]o|a[cç][aã]o\/movimento)\s*:/i.test(content) &&
    /(?:performance|dire[cç][aã]o de performance)\s*:/i.test(content) &&
    /texto na tela\s*:/i.test(content) &&
    /fala\s*:/i.test(content)
  );
}

function computeExplicitCompliance(
  context: ScriptIntelligenceContext | null | undefined
): { explicitCount: number; complianceRate: number } {
  if (!context) {
    return { explicitCount: 0, complianceRate: 1 };
  }

  let explicitCount = 0;
  let honoredCount = 0;

  for (const dimension of SCRIPT_CATEGORY_DIMENSIONS) {
    const explicit = context.explicitCategories[dimension];
    if (!explicit) continue;
    explicitCount += 1;
    if (context.resolvedCategories[dimension] === explicit) {
      honoredCount += 1;
    }
  }

  if (!explicitCount) {
    return { explicitCount: 0, complianceRate: 1 };
  }

  return {
    explicitCount,
    complianceRate: Number((honoredCount / explicitCount).toFixed(3)),
  };
}

export function buildScriptOutputDiagnostics(
  input: BuildScriptOutputDiagnosticsInput
): ScriptOutputDiagnostics {
  const normalizedPrompt = (input.prompt || "").trim();
  const normalizedTitle = (input.title || "").trim();
  const normalizedContent = (input.content || "").trim();

  const compliance = computeExplicitCompliance(input.intelligenceContext);

  const diagnostics: ScriptOutputDiagnostics = {
    operation: input.operation,
    intelligenceEnabled: Boolean(input.intelligenceContext),
    promptLength: normalizedPrompt.length,
    titleLength: normalizedTitle.length,
    contentLength: normalizedContent.length,
    paragraphCount: countParagraphs(normalizedContent),
    hasCta: hasCta(normalizedContent),
    explicitCategoryCount: compliance.explicitCount,
    explicitCategoryComplianceRate: compliance.complianceRate,
    sceneCount: countScenes(normalizedContent),
    hasTechnicalColumns: hasTechnicalColumns(normalizedContent),
  };
  const technicalRows = detectTechnicalRows(normalizedContent);
  diagnostics.hasPerformanceDirection = technicalRows.length > 0 && technicalRows.every((row) => Boolean(row.direcao.trim()));
  diagnostics.hasOnScreenText = technicalRows.some((row) => Boolean(row.textoTela.trim() && row.textoTela.trim() !== "..."));
  if ((diagnostics.sceneCount || 0) > 0) {
    const quality = evaluateTechnicalScriptQuality(normalizedContent, normalizedPrompt);
    diagnostics.perceivedQualityScore = quality.perceivedQuality;
    diagnostics.hookStrength = quality.hookStrength;
    diagnostics.specificityScore = quality.specificityScore;
    diagnostics.speakabilityScore = quality.speakabilityScore;
    diagnostics.ctaStrength = quality.ctaStrength;
    diagnostics.diversityScore = quality.diversityScore;
  }

  if (input.intelligenceContext) {
    diagnostics.promptMode = input.intelligenceContext.promptMode;
    diagnostics.resolvedCategories = input.intelligenceContext.resolvedCategories;
    diagnostics.dnaSampleSize = input.intelligenceContext.dnaProfile.sampleSize;
    diagnostics.dnaHasEnoughEvidence = input.intelligenceContext.dnaProfile.hasEnoughEvidence;
    diagnostics.styleProfileEnabled = Boolean(input.intelligenceContext.styleProfile);
    diagnostics.styleSampleSize = input.intelligenceContext.styleSampleSize;
    diagnostics.styleFallbackUsed = Boolean(
      input.intelligenceContext.styleProfile && !input.intelligenceContext.styleProfile.hasEnoughEvidence
    );
    const similarity = computeStyleSimilarityScore(
      normalizedContent,
      input.intelligenceContext.styleProfile
    );
    if (typeof similarity === "number") {
      diagnostics.styleSimilarityScore = similarity;
    }
    diagnostics.relaxationLevel = input.intelligenceContext.relaxationLevel;
    diagnostics.usedFallbackRules = input.intelligenceContext.usedFallbackRules;
  }

  if (typeof input.previousContent === "string") {
    const previousLength = input.previousContent.trim().length;
    const delta = normalizedContent.length - previousLength;
    diagnostics.contentLengthDelta = delta;
    diagnostics.contentLengthDeltaPct = previousLength
      ? Number((delta / previousLength).toFixed(3))
      : 0;
  }

  if (input.adjustMeta) {
    diagnostics.adjustMode = input.adjustMeta.adjustMode;
    diagnostics.targetScope = input.adjustMeta.targetScope;
    diagnostics.targetIndex = input.adjustMeta.targetIndex ?? null;
    diagnostics.scopeFound = input.adjustMeta.scopeFound;
    diagnostics.scopeEnforced = input.adjustMeta.scopeEnforced;
    diagnostics.outOfScopeChangeRate = input.adjustMeta.outOfScopeChangeRate;
  }

  return diagnostics;
}

export function logScriptsGenerationObservability(params: {
  userId: string;
  operation: ScriptOperation;
  scriptId?: string | null;
  aiVersionId?: string | null;
  diagnostics: ScriptOutputDiagnostics;
}) {
  logger.info(`[scripts][intelligence][${params.operation}]`, {
    userId: params.userId,
    scriptId: params.scriptId || null,
    aiVersionId: params.aiVersionId || null,
    diagnostics: params.diagnostics,
    performance: getScriptsPerformanceSnapshot(),
  });
}
