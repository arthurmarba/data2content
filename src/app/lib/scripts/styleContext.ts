import { extractScriptStyleFeatures } from "./styleFeatures";
import type { ScriptStyleProfileSnapshot } from "./styleTraining";

export type ScriptStyleSignalsUsed = {
  hookPatterns: string[];
  ctaPatterns: string[];
  humorMarkers: string[];
  recurringExpressions: string[];
  avgSentenceLength: number;
  emojiDensity: number;
  narrativeCadence: {
    openingAvgChars: number;
    developmentAvgChars: number;
    closingAvgChars: number;
  };
};

export type ScriptStyleContext = {
  profileVersion: string;
  sampleSize: number;
  hasEnoughEvidence: boolean;
  writingGuidelines: string[];
  styleSignalsUsed: ScriptStyleSignalsUsed;
  styleExamples: string[];
};

const MIN_STYLE_SAMPLE_SIZE = 6;

function round(value: number, decimals = 3): number {
  if (!Number.isFinite(value)) return 0;
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function buildGuidelines(profile: ScriptStyleProfileSnapshot): string[] {
  const lines: string[] = [];
  const signals = profile.styleSignals;

  if (signals.avgSentenceLength <= 10 && signals.avgSentenceLength > 0) {
    lines.push("Use frases curtas e diretas com ritmo agil.");
  } else if (signals.avgSentenceLength <= 18 && signals.avgSentenceLength > 0) {
    lines.push("Use frases de tamanho medio em tom conversacional.");
  } else if (signals.avgSentenceLength > 18) {
    lines.push("Use frases mais desenvolvidas mantendo clareza.");
  }

  if (signals.emojiDensity >= 0.08) {
    lines.push("Use emojis com frequencia moderada para reforcar emocao.");
  } else if (signals.emojiDensity > 0) {
    lines.push("Use poucos emojis apenas em pontos de destaque.");
  }

  if (signals.hookPatterns.length) {
    lines.push(`Abra no estilo: ${signals.hookPatterns.slice(0, 2).join(" | ")}.`);
  }

  if (signals.ctaPatterns.length) {
    lines.push(`Use CTA no padrao recorrente: ${signals.ctaPatterns.slice(0, 3).join(", ")}.`);
  }

  if (signals.humorMarkers.length) {
    lines.push(`Humor recorrente com marcadores: ${signals.humorMarkers.slice(0, 4).join(", ")}.`);
  }

  if (signals.recurringExpressions.length) {
    lines.push(`Vocabulos frequentes: ${signals.recurringExpressions.slice(0, 6).join(", ")}.`);
  }

  if (signals.narrativeCadence.openingAvgChars > 0 && signals.narrativeCadence.closingAvgChars > 0) {
    lines.push(
      `Cadencia media: abertura ${Math.round(signals.narrativeCadence.openingAvgChars)} chars, fechamento ${Math.round(signals.narrativeCadence.closingAvgChars)} chars.`
    );
  }

  if (!lines.length) {
    lines.push("Use linguagem natural em portugues do Brasil e CTA claro no final.");
  }

  return lines;
}

export function buildScriptStyleContext(profile: ScriptStyleProfileSnapshot | null | undefined): ScriptStyleContext | null {
  if (!profile) return null;

  const styleSignalsUsed: ScriptStyleSignalsUsed = {
    hookPatterns: profile.styleSignals.hookPatterns.slice(0, 6),
    ctaPatterns: profile.styleSignals.ctaPatterns.slice(0, 6),
    humorMarkers: profile.styleSignals.humorMarkers.slice(0, 10),
    recurringExpressions: profile.styleSignals.recurringExpressions.slice(0, 20),
    avgSentenceLength: profile.styleSignals.avgSentenceLength,
    emojiDensity: profile.styleSignals.emojiDensity,
    narrativeCadence: {
      openingAvgChars: profile.styleSignals.narrativeCadence.openingAvgChars,
      developmentAvgChars: profile.styleSignals.narrativeCadence.developmentAvgChars,
      closingAvgChars: profile.styleSignals.narrativeCadence.closingAvgChars,
    },
  };

  return {
    profileVersion: profile.profileVersion,
    sampleSize: profile.sampleSize,
    hasEnoughEvidence: profile.sampleSize >= MIN_STYLE_SAMPLE_SIZE,
    writingGuidelines: buildGuidelines(profile),
    styleSignalsUsed,
    styleExamples: profile.styleExamples.slice(0, 12),
  };
}

export function computeStyleSimilarityScore(
  content: string,
  styleContext: ScriptStyleContext | null | undefined
): number | null {
  if (!styleContext) return null;
  if (!content?.trim()) return null;

  const features = extractScriptStyleFeatures(content);
  if (!features.normalizedContent) return null;

  const target = styleContext.styleSignalsUsed;
  const sentenceDistance = Math.abs(features.avgSentenceLength - target.avgSentenceLength);
  const sentenceScore = 1 - Math.min(1, sentenceDistance / 12);

  const emojiDistance = Math.abs(features.emojiDensity - target.emojiDensity);
  const emojiScore = 1 - Math.min(1, emojiDistance / 0.12);

  const ctaSet = new Set(target.ctaPatterns);
  const hasCtaMatch = features.ctaPatterns.some((item) => ctaSet.has(item));
  const ctaScore = hasCtaMatch ? 1 : target.ctaPatterns.length ? 0 : 0.7;

  const hookSet = new Set(target.hookPatterns);
  const hasHookMatch = features.hookPattern ? hookSet.has(features.hookPattern) : false;
  const hookScore = hasHookMatch ? 1 : target.hookPatterns.length ? 0.35 : 0.7;

  const weighted = sentenceScore * 0.35 + emojiScore * 0.2 + ctaScore * 0.25 + hookScore * 0.2;
  return round(Math.max(0, Math.min(1, weighted)), 3);
}
