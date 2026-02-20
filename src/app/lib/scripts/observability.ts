import { logger } from "@/app/lib/logger";

import type { ScriptIntelligenceContext } from "./intelligenceContext";
import { getScriptsPerformanceSnapshot } from "./performanceTelemetry";
import { SCRIPT_CATEGORY_DIMENSIONS, type ScriptCategoryDimension } from "./promptParser";
import { computeStyleSimilarityScore } from "./styleContext";
import type { ScriptAdjustMeta } from "./ai";

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
  };

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
